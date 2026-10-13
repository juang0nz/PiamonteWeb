-- Separa el nivel "eliminada" del estado "activa" en las categorías.
-- Ejecutar manualmente en Supabase -> SQL Editor -> Run.
-- Requiere auditoria_etapa_1.sql, auditoria_etapa_2.sql y
-- baja_logica_catalogo_super_admin.sql instalados.
-- Este archivo es el último de la serie: redefine
-- super_admin_eliminar_categoria_auditada y admin_actualizar_categoria_auditada
-- con la versión final, por lo que debe ejecutarse después de los anteriores.
--
-- Niveles de estado del catálogo:
--   productos.disponible  -> agotado temporal, sigue visible en el catálogo.
--   productos.activo      -> eliminado del panel y del catálogo.
--   categorias.activa     -> visible u oculta en el catálogo público.
--   categorias.eliminada  -> eliminada del panel y del catálogo.

begin;

alter table public.categorias
  add column if not exists eliminada boolean not null default false;

comment on column public.categorias.eliminada is
  'Baja lógica de la categoría. Distinta de "activa", que sólo la oculta del catálogo.';

create index if not exists categorias_comercio_eliminada_orden_idx
  on public.categorias (comercio_id, eliminada, orden);

-- Impide que un producto quede asignado a una categoría eliminada,
-- incluso si la asignación se intenta de forma concurrente.
create or replace function public.validar_categoria_no_eliminada()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if exists (
    select 1
    from public.categorias
    where id = new.categoria_id
      and eliminada = true
  ) then
    raise exception 'La categoría fue eliminada del catálogo.'
      using errcode = '23503';
  end if;
  return new;
end;
$$;

drop trigger if exists productos_categoria_no_eliminada on public.productos;

create trigger productos_categoria_no_eliminada
before insert or update of categoria_id on public.productos
for each row
execute function public.validar_categoria_no_eliminada();

-- La eliminación de categoría pasa a marcar "eliminada" y deja de alterar
-- "activa", para que ambos niveles queden independientes.
create or replace function public.super_admin_eliminar_categoria_auditada(
  p_operacion_id uuid,
  p_comercio_id uuid,
  p_categoria_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_anterior jsonb;
  v_producto record;
  v_secuencia integer := 1;
begin
  if not (
    exists (
      select 1
      from public.super_admins
      where user_id = auth.uid()
        and activo = true
    )
    or exists (
      select 1
      from public.admin_comercios
      where user_id = auth.uid()
        and comercio_id = p_comercio_id
        and rol = 'admin'
        and activo = true
    )
  ) then
    raise exception 'No tenés permisos para eliminar categorías de este comercio.'
      using errcode = '42501';
  end if;

  if not public.auditoria_iniciar_operacion(
    p_operacion_id,
    p_comercio_id,
    'categoria',
    p_categoria_id
  ) then
    return true;
  end if;

  select jsonb_build_object(
    'nombre', nombre,
    'activa', activa,
    'eliminada', eliminada
  )
  into v_anterior
  from public.categorias
  where id = p_categoria_id
    and comercio_id = p_comercio_id
  for update;

  if v_anterior is null then
    raise exception 'La categoría no pertenece al comercio autorizado.'
      using errcode = 'P0002';
  end if;

  if (v_anterior ->> 'eliminada')::boolean then
    raise exception 'La categoría ya estaba eliminada.'
      using errcode = 'P0002';
  end if;

  -- La categoría se elimina aunque todavía tenga productos vigentes. Esos
  -- productos no se borran ni se reasignan: se marcan como eliminados en la
  -- misma transacción y conservan su categoria_id para mantener el historial.
  update public.categorias
  set eliminada = true
  where id = p_categoria_id
    and comercio_id = p_comercio_id;

  perform public.auditoria_finalizar_operacion(
    p_operacion_id,
    v_secuencia,
    p_comercio_id,
    'eliminar',
    'categoria',
    p_categoria_id,
    v_anterior,
    jsonb_build_object(
      'nombre', v_anterior ->> 'nombre',
      'activa', (v_anterior ->> 'activa')::boolean,
      'eliminada', true
    )
  );

  for v_producto in
    update public.productos
    set activo = false
    where categoria_id = p_categoria_id
      and comercio_id = p_comercio_id
      and activo = true
    returning id, nombre
  loop
    v_secuencia := v_secuencia + 1;
    perform public.auditoria_finalizar_operacion(
      p_operacion_id,
      v_secuencia,
      p_comercio_id,
      'eliminar',
      'producto',
      v_producto.id,
      jsonb_build_object('nombre', v_producto.nombre, 'activo', true),
      jsonb_build_object(
        'nombre', v_producto.nombre,
        'activo', false,
        'motivo', 'categoria_eliminada'
      )
    );
  end loop;

  return true;
end;
$$;

-- Una categoría eliminada no puede volver a editarse desde el panel.
-- Se conserva la validación de permisos original, centralizada en
-- auditoria_iniciar_operacion -> auditoria_actor_autorizado.
create or replace function public.admin_actualizar_categoria_auditada(
  p_operacion_id uuid,
  p_comercio_id uuid,
  p_categoria_id uuid,
  p_nombre text,
  p_descripcion text,
  p_imagen_url text,
  p_activa boolean
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_anterior jsonb;
begin
  if not public.auditoria_iniciar_operacion(
    p_operacion_id,
    p_comercio_id,
    'categoria',
    p_categoria_id
  ) then
    return true;
  end if;

  select jsonb_build_object(
    'nombre', nombre,
    'descripcion', descripcion,
    'imagen_url', imagen_url,
    'activa', activa,
    'eliminada', eliminada
  )
  into v_anterior
  from public.categorias
  where id = p_categoria_id
    and comercio_id = p_comercio_id
  for update;

  if v_anterior is null then
    raise exception 'La categoría no pertenece al comercio autorizado.'
      using errcode = 'P0002';
  end if;

  if (v_anterior ->> 'eliminada')::boolean then
    raise exception 'La categoría fue eliminada del catálogo.'
      using errcode = 'P0002';
  end if;

  update public.categorias
  set nombre = p_nombre,
      descripcion = p_descripcion,
      imagen_url = p_imagen_url,
      activa = p_activa
  where id = p_categoria_id
    and comercio_id = p_comercio_id;

  perform public.auditoria_finalizar_operacion(
    p_operacion_id,
    1,
    p_comercio_id,
    'actualizar',
    'categoria',
    p_categoria_id,
    v_anterior,
    jsonb_build_object(
      'nombre', p_nombre,
      'descripcion', p_descripcion,
      'imagen_url', p_imagen_url,
      'activa', p_activa,
      'eliminada', false
    )
  );

  return true;
end;
$$;

grant execute on function public.super_admin_eliminar_categoria_auditada(
  uuid, uuid, uuid
) to authenticated;

grant execute on function public.admin_actualizar_categoria_auditada(
  uuid, uuid, uuid, text, text, text, boolean
) to authenticated;

revoke all on function public.super_admin_eliminar_categoria_auditada(
  uuid, uuid, uuid
) from public, anon, service_role;

revoke all on function public.admin_actualizar_categoria_auditada(
  uuid, uuid, uuid, text, text, text, boolean
) from public, anon, service_role;

revoke all on function public.validar_categoria_no_eliminada()
  from public, anon;

commit;

-- Verificación posterior sugerida:
-- select nombre, activa, eliminada from public.categorias order by orden;
