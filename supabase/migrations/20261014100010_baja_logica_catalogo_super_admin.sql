-- Baja lógica auditada de categorías y productos para administradores autorizados.
-- Ejecutar manualmente en Supabase -> SQL Editor -> Run.
-- Requiere auditoria_etapa_1.sql y auditoria_etapa_2.sql instalados.

begin;

alter table public.productos
  add column if not exists activo boolean not null default true;

create index if not exists productos_comercio_activo_orden_idx
  on public.productos (comercio_id, activo, orden);

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
    'activa', activa
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

  update public.categorias
  set activa = false
  where id = p_categoria_id
    and comercio_id = p_comercio_id;

  perform public.auditoria_finalizar_operacion(
    p_operacion_id,
    1,
    p_comercio_id,
    'eliminar',
    'categoria',
    p_categoria_id,
    v_anterior,
    jsonb_build_object(
      'nombre', v_anterior ->> 'nombre',
      'activa', false
    )
  );

  return true;
end;
$$;

create or replace function public.super_admin_eliminar_producto_auditado(
  p_operacion_id uuid,
  p_comercio_id uuid,
  p_producto_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_anterior jsonb;
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
    raise exception 'No tenés permisos para eliminar productos de este comercio.'
      using errcode = '42501';
  end if;

  if not public.auditoria_iniciar_operacion(
    p_operacion_id,
    p_comercio_id,
    'producto',
    p_producto_id
  ) then
    return true;
  end if;

  select jsonb_build_object(
    'nombre', nombre,
    'activo', activo
  )
  into v_anterior
  from public.productos
  where id = p_producto_id
    and comercio_id = p_comercio_id
  for update;

  if v_anterior is null then
    raise exception 'El producto no pertenece al comercio autorizado.'
      using errcode = 'P0002';
  end if;

  update public.productos
  set activo = false
  where id = p_producto_id
    and comercio_id = p_comercio_id;

  perform public.auditoria_finalizar_operacion(
    p_operacion_id,
    1,
    p_comercio_id,
    'eliminar',
    'producto',
    p_producto_id,
    v_anterior,
    jsonb_build_object(
      'nombre', v_anterior ->> 'nombre',
      'activo', false
    )
  );

  return true;
end;
$$;

grant execute on function public.super_admin_eliminar_categoria_auditada(
  uuid, uuid, uuid
) to authenticated;

grant execute on function public.super_admin_eliminar_producto_auditado(
  uuid, uuid, uuid
) to authenticated;

revoke all on function public.super_admin_eliminar_categoria_auditada(
  uuid, uuid, uuid
) from public, anon, service_role;

revoke all on function public.super_admin_eliminar_producto_auditado(
  uuid, uuid, uuid
) from public, anon, service_role;

commit;
