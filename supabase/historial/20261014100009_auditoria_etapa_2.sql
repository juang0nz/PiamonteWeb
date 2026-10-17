-- Auditoría administrativa: etapa 2 (RPC atómicas).
-- Revisar y ejecutar manualmente en Supabase -> SQL Editor -> Run.
--
-- Este script PREPARA las funciones de migración, pero no cambia las rutas
-- actuales ni revoca los permisos existentes de service_role. La aplicación
-- seguirá utilizando sus escrituras actuales hasta una etapa posterior de
-- migración controlada.
--
-- Las RPC se invocarán con el cliente Supabase de la sesión autenticada.
-- Nunca deben invocarse con service_role: auth.uid() debe ser el usuario real.

begin;

-- La invitación de Supabase Auth ocurre fuera de PostgreSQL. Esta entidad
-- permite conservar una intención auditable y completar o marcar como fallida
-- la asignación dentro de una transacción posterior.
alter table public.auditoria_eventos
  drop constraint if exists auditoria_eventos_entidad_check;

alter table public.auditoria_eventos
  add constraint auditoria_eventos_entidad_check check (
    entidad in (
      'categoria',
      'producto',
      'variante',
      'pedido',
      'admin_comercio',
      'admin_invitacion',
      'horario'
    )
  );

create table if not exists public.auditoria_invitaciones_admin (
  id uuid primary key default gen_random_uuid(),
  operacion_id uuid not null unique,
  comercio_id uuid not null
    references public.comercios(id)
    on update restrict
    on delete restrict,
  actor_user_id uuid not null,
  email_normalizado text not null
    check (length(email_normalizado) between 3 and 320),
  usuario_auth_id uuid,
  estado text not null default 'iniciada'
    check (estado in ('iniciada', 'completada', 'fallida')),
  motivo_fallo text,
  iniciada_en timestamptz not null default now(),
  actualizada_en timestamptz not null default now()
);

comment on table public.auditoria_invitaciones_admin is
  'Outbox auditable para invitaciones externas de Supabase Auth. No contiene tokens.';

create index if not exists auditoria_invitaciones_admin_comercio_idx
  on public.auditoria_invitaciones_admin (comercio_id, iniciada_en desc);

alter table public.auditoria_invitaciones_admin enable row level security;
revoke all on table public.auditoria_invitaciones_admin
  from public, anon, authenticated, service_role;

create or replace function public.auditoria_iniciar_operacion(
  p_operacion_id uuid,
  p_comercio_id uuid,
  p_entidad text,
  p_registro_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_actor uuid := auth.uid();
  v_actor_existente uuid;
begin
  if p_operacion_id is null
     or p_comercio_id is null
     or p_registro_id is null
     or p_entidad not in (
       'categoria', 'producto', 'variante', 'pedido', 'admin_comercio'
     ) then
    raise exception 'Datos inválidos para iniciar la operación.'
      using errcode = '22023';
  end if;

  if not public.auditoria_actor_autorizado(p_comercio_id) then
    raise exception 'El actor no está autorizado para el comercio.'
      using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(p_operacion_id::text, 0)
  );

  select distinct actor_user_id
    into v_actor_existente
  from public.auditoria_eventos
  where operacion_id = p_operacion_id;

  if v_actor_existente is not null then
    if v_actor_existente <> v_actor then
      raise exception 'La operación pertenece a otro actor.'
        using errcode = '42501';
    end if;
    return false;
  end if;

  return true;
end;
$$;

drop function if exists public.auditoria_finalizar_operacion(
  uuid, smallint, uuid, text, text, uuid, jsonb, jsonb
);

create or replace function public.auditoria_finalizar_operacion(
  p_operacion_id uuid,
  p_secuencia integer,
  p_comercio_id uuid,
  p_accion text,
  p_entidad text,
  p_registro_id uuid,
  p_valores_anteriores jsonb,
  p_valores_nuevos jsonb
)
returns uuid
language sql
security definer
set search_path = pg_catalog, public, auth
as $$
  select public.auditoria_registrar_evento_interno(
    p_operacion_id,
    p_secuencia::smallint,
    p_comercio_id,
    p_accion,
    p_entidad,
    p_registro_id,
    p_valores_anteriores,
    p_valores_nuevos
  );
$$;

-- Registra la intención antes de llamar a Auth Admin API. La aplicación debe
-- invitar después y luego completar o marcar como fallida la operación.
create or replace function public.super_admin_iniciar_invitacion_auditada(
  p_operacion_id uuid,
  p_comercio_id uuid,
  p_email text
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_actor uuid := auth.uid();
  v_email text := lower(trim(p_email));
  v_invitacion public.auditoria_invitaciones_admin%rowtype;
begin
  if v_actor is null
     or not exists (
       select 1 from public.super_admins
       where user_id = v_actor and activo = true
     ) then
    raise exception 'Solo un Super Admin activo puede invitar administradores.'
      using errcode = '42501';
  end if;

  if p_operacion_id is null
     or p_comercio_id is null
     or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
     or length(v_email) > 320 then
    raise exception 'Los datos de la invitación no son válidos.'
      using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.comercios
    where id = p_comercio_id and activo = true
  ) then
    raise exception 'El comercio no existe o está inactivo.'
      using errcode = 'P0002';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(p_operacion_id::text, 0)
  );

  select * into v_invitacion
  from public.auditoria_invitaciones_admin
  where operacion_id = p_operacion_id
  for update;

  if v_invitacion.id is not null then
    if v_invitacion.actor_user_id <> v_actor
       or v_invitacion.comercio_id <> p_comercio_id
       or v_invitacion.email_normalizado <> v_email then
      raise exception 'La operación pertenece a otra invitación.'
        using errcode = '42501';
    end if;
    if v_invitacion.estado <> 'iniciada' then
      raise exception 'La invitación ya fue finalizada.'
        using errcode = '40001';
    end if;
    return v_invitacion.id;
  end if;

  insert into public.auditoria_invitaciones_admin (
    operacion_id, comercio_id, actor_user_id, email_normalizado
  )
  values (p_operacion_id, p_comercio_id, v_actor, v_email)
  returning * into v_invitacion;

  perform public.auditoria_registrar_evento_interno(
    p_operacion_id,
    1::smallint,
    p_comercio_id,
    'invitacion_iniciada',
    'admin_invitacion',
    p_operacion_id,
    null,
    jsonb_build_object(
      'email', v_email,
      'estado', 'iniciada'
    )
  );

  return v_invitacion.id;
end;
$$;

-- La asignación y su evento se confirman en una única transacción. Esta RPC
-- no llama Auth Admin API: debe recibir el UUID devuelto por Auth después de
-- una invitación exitosa.
create or replace function public.super_admin_completar_invitacion_auditada(
  p_operacion_id uuid,
  p_user_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_invitacion public.auditoria_invitaciones_admin%rowtype;
begin
  if not exists (
    select 1 from public.super_admins
    where user_id = auth.uid() and activo = true
  ) then
    raise exception 'Solo un Super Admin activo puede completar invitaciones.'
      using errcode = '42501';
  end if;

  select * into v_invitacion
  from public.auditoria_invitaciones_admin
  where operacion_id = p_operacion_id
  for update;

  if v_invitacion.id is null or v_invitacion.actor_user_id <> auth.uid() then
    raise exception 'La invitación no existe o no pertenece al actor.'
      using errcode = '42501';
  end if;
  if v_invitacion.estado = 'completada' then
    return true;
  end if;
  if v_invitacion.estado <> 'iniciada' or p_user_id is null then
    raise exception 'La invitación no puede completarse.'
      using errcode = '40001';
  end if;
  if not exists (select 1 from auth.users where id = p_user_id) then
    raise exception 'El usuario de Auth no existe.'
      using errcode = 'P0002';
  end if;

  insert into public.admin_comercios (user_id, comercio_id, rol, activo)
  values (p_user_id, v_invitacion.comercio_id, 'admin', true);

  update public.auditoria_invitaciones_admin
  set usuario_auth_id = p_user_id,
      estado = 'completada',
      actualizada_en = now()
  where id = v_invitacion.id;

  perform public.auditoria_registrar_evento_interno(
    p_operacion_id,
    2::smallint,
    v_invitacion.comercio_id,
    'asignar',
    'admin_comercio',
    p_user_id,
    null,
    jsonb_build_object(
      'user_id', p_user_id,
      'comercio_id', v_invitacion.comercio_id,
      'rol', 'admin',
      'activo', true
    )
  );
  return true;
end;
$$;

-- Si Auth falla, se cierra la intención sin registrar secretos ni mensajes
-- arbitrarios. Si falla la asignación después de crear Auth, queda fallida y
-- debe reintentarse o compensarse manualmente; nunca se borra el usuario.
drop function if exists public.super_admin_marcar_invitacion_fallida(
  uuid, text
);

create or replace function public.super_admin_marcar_invitacion_fallida(
  p_operacion_id uuid,
  p_motivo text,
  p_user_id uuid default null
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_invitacion public.auditoria_invitaciones_admin%rowtype;
  v_motivo text := coalesce(nullif(trim(p_motivo), ''), 'error_externo');
begin
  if not exists (
    select 1 from public.super_admins
    where user_id = auth.uid() and activo = true
  ) then
    raise exception 'Solo un Super Admin activo puede cerrar invitaciones.'
      using errcode = '42501';
  end if;
  if v_motivo not in (
    'error_externo', 'usuario_ya_existia', 'asignacion_fallida',
    'correo_invalido', 'reintento_manual'
  ) then
    raise exception 'Motivo de fallo no permitido.' using errcode = '22023';
  end if;

  select * into v_invitacion
  from public.auditoria_invitaciones_admin
  where operacion_id = p_operacion_id
  for update;

  if v_invitacion.id is null or v_invitacion.actor_user_id <> auth.uid() then
    raise exception 'La invitación no existe o no pertenece al actor.'
      using errcode = '42501';
  end if;
  if v_invitacion.estado = 'fallida' then
    return true;
  end if;
  if v_invitacion.estado <> 'iniciada' then
    raise exception 'La invitación ya fue completada.'
      using errcode = '40001';
  end if;

  update public.auditoria_invitaciones_admin
  set estado = 'fallida',
      usuario_auth_id = p_user_id,
      motivo_fallo = v_motivo,
      actualizada_en = now()
  where id = v_invitacion.id;

  perform public.auditoria_registrar_evento_interno(
    p_operacion_id,
    2::smallint,
    v_invitacion.comercio_id,
    'invitacion_fallida',
    'admin_invitacion',
    p_operacion_id,
    jsonb_build_object('estado', 'iniciada'),
    jsonb_strip_nulls(jsonb_build_object(
      'estado', 'fallida',
      'motivo', v_motivo,
      'usuario_auth_id', p_user_id
    ))
  );
  return true;
end;
$$;

-- Categorías: crear una categoría.
create or replace function public.admin_crear_categoria_auditada(
  p_operacion_id uuid,
  p_comercio_id uuid,
  p_nombre text,
  p_slug text,
  p_descripcion text,
  p_imagen_url text,
  p_orden integer
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_id uuid;
  v_continuar boolean;
begin
  v_continuar := public.auditoria_iniciar_operacion(
    p_operacion_id, p_comercio_id, 'categoria', gen_random_uuid()
  );

  if not v_continuar then
    select registro_id into v_id
    from public.auditoria_eventos
    where operacion_id = p_operacion_id
    order by secuencia
    limit 1;
    return v_id;
  end if;

  insert into public.categorias (
    comercio_id, nombre, slug, descripcion, imagen_url, orden, activa
  )
  values (
    p_comercio_id, p_nombre, p_slug, p_descripcion, p_imagen_url,
    coalesce(p_orden, 0), true
  )
  returning id into v_id;

  perform public.auditoria_finalizar_operacion(
    p_operacion_id, 1, p_comercio_id, 'crear', 'categoria', v_id,
    null,
    jsonb_build_object(
      'nombre', p_nombre,
      'slug', p_slug,
      'descripcion', p_descripcion,
      'imagen_url', p_imagen_url,
      'orden', coalesce(p_orden, 0),
      'activa', true
    )
  );
  return v_id;
end;
$$;

-- Categorías: editar datos o activar/desactivar.
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
  v_nuevo jsonb;
  v_continuar boolean;
begin
  v_continuar := public.auditoria_iniciar_operacion(
    p_operacion_id, p_comercio_id, 'categoria', p_categoria_id
  );
  if not v_continuar then return true; end if;

  select jsonb_build_object(
    'nombre', nombre,
    'descripcion', descripcion,
    'imagen_url', imagen_url,
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
  set nombre = p_nombre,
      descripcion = p_descripcion,
      imagen_url = p_imagen_url,
      activa = p_activa
  where id = p_categoria_id
    and comercio_id = p_comercio_id;

  v_nuevo := jsonb_build_object(
    'nombre', p_nombre,
    'descripcion', p_descripcion,
    'imagen_url', p_imagen_url,
    'activa', p_activa
  );
  perform public.auditoria_finalizar_operacion(
    p_operacion_id, 1, p_comercio_id, 'actualizar', 'categoria',
    p_categoria_id, v_anterior, v_nuevo
  );
  return true;
end;
$$;

-- Productos: crear un producto.
create or replace function public.admin_crear_producto_auditado(
  p_operacion_id uuid,
  p_comercio_id uuid,
  p_categoria_id uuid,
  p_nombre text,
  p_descripcion text,
  p_imagen_url text,
  p_tipo text,
  p_precio_base numeric,
  p_orden integer
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_id uuid;
  v_continuar boolean;
begin
  v_continuar := public.auditoria_iniciar_operacion(
    p_operacion_id, p_comercio_id, 'producto', gen_random_uuid()
  );
  if not v_continuar then
    select registro_id into v_id
    from public.auditoria_eventos
    where operacion_id = p_operacion_id
    order by secuencia
    limit 1;
    return v_id;
  end if;

  if not exists (
    select 1 from public.categorias
    where id = p_categoria_id
      and comercio_id = p_comercio_id
      and activa = true
  ) then
    raise exception 'La categoría no pertenece al comercio o está inactiva.'
      using errcode = 'P0002';
  end if;

  insert into public.productos (
    comercio_id, categoria_id, nombre, descripcion, imagen_url, tipo,
    precio_base, disponible, destacado, orden
  )
  values (
    p_comercio_id, p_categoria_id, p_nombre, p_descripcion, p_imagen_url,
    coalesce(p_tipo, 'simple'), p_precio_base, true, false,
    coalesce(p_orden, 0)
  )
  returning id into v_id;

  perform public.auditoria_finalizar_operacion(
    p_operacion_id, 1, p_comercio_id, 'crear', 'producto', v_id,
    null,
    jsonb_build_object(
      'categoria_id', p_categoria_id,
      'nombre', p_nombre,
      'descripcion', p_descripcion,
      'imagen_url', p_imagen_url,
      'tipo', coalesce(p_tipo, 'simple'),
      'precio_base', p_precio_base,
      'disponible', true,
      'destacado', false,
      'orden', coalesce(p_orden, 0)
    )
  );
  return v_id;
end;
$$;

-- Productos: editar datos, precio, categoría, destacado o disponibilidad.
create or replace function public.admin_actualizar_producto_auditado(
  p_operacion_id uuid,
  p_comercio_id uuid,
  p_producto_id uuid,
  p_categoria_id uuid,
  p_nombre text,
  p_descripcion text,
  p_imagen_url text,
  p_precio_base numeric,
  p_disponible boolean,
  p_destacado boolean
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_anterior jsonb;
  v_nuevo jsonb;
  v_continuar boolean;
begin
  v_continuar := public.auditoria_iniciar_operacion(
    p_operacion_id, p_comercio_id, 'producto', p_producto_id
  );
  if not v_continuar then return true; end if;

  if not exists (
    select 1 from public.categorias
    where id = p_categoria_id
      and comercio_id = p_comercio_id
      and activa = true
  ) then
    raise exception 'La categoría no pertenece al comercio o está inactiva.'
      using errcode = 'P0002';
  end if;

  select jsonb_build_object(
    'categoria_id', categoria_id,
    'nombre', nombre,
    'descripcion', descripcion,
    'imagen_url', imagen_url,
    'precio_base', precio_base,
    'disponible', disponible,
    'destacado', destacado
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
  set categoria_id = p_categoria_id,
      nombre = p_nombre,
      descripcion = p_descripcion,
      imagen_url = p_imagen_url,
      precio_base = p_precio_base,
      disponible = p_disponible,
      destacado = p_destacado
  where id = p_producto_id
    and comercio_id = p_comercio_id;

  v_nuevo := jsonb_build_object(
    'categoria_id', p_categoria_id,
    'nombre', p_nombre,
    'descripcion', p_descripcion,
    'imagen_url', p_imagen_url,
    'precio_base', p_precio_base,
    'disponible', p_disponible,
    'destacado', p_destacado
  );
  perform public.auditoria_finalizar_operacion(
    p_operacion_id, 1, p_comercio_id, 'actualizar', 'producto',
    p_producto_id, v_anterior, v_nuevo
  );
  return true;
end;
$$;

-- Variantes: crear o editar nombre, precio y disponibilidad.
create or replace function public.admin_crear_variante_auditada(
  p_operacion_id uuid,
  p_comercio_id uuid,
  p_producto_id uuid,
  p_nombre text,
  p_precio numeric,
  p_orden integer
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_id uuid;
  v_continuar boolean;
begin
  v_continuar := public.auditoria_iniciar_operacion(
    p_operacion_id, p_comercio_id, 'variante', gen_random_uuid()
  );
  if not v_continuar then
    select registro_id into v_id
    from public.auditoria_eventos
    where operacion_id = p_operacion_id
    order by secuencia
    limit 1;
    return v_id;
  end if;

  if not exists (
    select 1 from public.productos
    where id = p_producto_id and comercio_id = p_comercio_id
  ) then
    raise exception 'El producto no pertenece al comercio autorizado.'
      using errcode = 'P0002';
  end if;

  insert into public.variantes_producto (
    producto_id, nombre, precio, disponible, orden
  )
  values (
    p_producto_id, p_nombre, p_precio, true, coalesce(p_orden, 0)
  )
  returning id into v_id;

  perform public.auditoria_finalizar_operacion(
    p_operacion_id, 1, p_comercio_id, 'crear', 'variante', v_id,
    null,
    jsonb_build_object(
      'producto_id', p_producto_id,
      'nombre', p_nombre,
      'precio', p_precio,
      'disponible', true,
      'orden', coalesce(p_orden, 0)
    )
  );
  return v_id;
end;
$$;

create or replace function public.admin_actualizar_variante_auditada(
  p_operacion_id uuid,
  p_comercio_id uuid,
  p_variante_id uuid,
  p_nombre text,
  p_precio numeric,
  p_disponible boolean
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_producto_id uuid;
  v_anterior jsonb;
  v_nuevo jsonb;
  v_continuar boolean;
begin
  select producto_id into v_producto_id
  from public.variantes_producto
  where id = p_variante_id
  for update;

  if v_producto_id is null
     or not exists (
       select 1 from public.productos
       where id = v_producto_id and comercio_id = p_comercio_id
     ) then
    raise exception 'La variante no pertenece al comercio autorizado.'
      using errcode = 'P0002';
  end if;

  v_continuar := public.auditoria_iniciar_operacion(
    p_operacion_id, p_comercio_id, 'variante', p_variante_id
  );
  if not v_continuar then return true; end if;

  select jsonb_build_object(
    'nombre', nombre, 'precio', precio, 'disponible', disponible
  )
  into v_anterior
  from public.variantes_producto
  where id = p_variante_id
  for update;

  update public.variantes_producto
  set nombre = p_nombre,
      precio = p_precio,
      disponible = p_disponible
  where id = p_variante_id
    and producto_id = v_producto_id;

  v_nuevo := jsonb_build_object(
    'nombre', p_nombre, 'precio', p_precio, 'disponible', p_disponible
  );
  perform public.auditoria_finalizar_operacion(
    p_operacion_id, 1, p_comercio_id, 'actualizar', 'variante',
    p_variante_id, v_anterior, v_nuevo
  );
  return true;
end;
$$;

-- Disponibilidad: funciones específicas para no permitir que el cliente
-- reenvíe ni modifique campos que no forman parte de esta operación.
create or replace function public.admin_cambiar_disponibilidad_producto_auditada(
  p_operacion_id uuid,
  p_comercio_id uuid,
  p_producto_id uuid,
  p_disponible boolean
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_anterior jsonb;
  v_continuar boolean;
begin
  v_continuar := public.auditoria_iniciar_operacion(
    p_operacion_id, p_comercio_id, 'producto', p_producto_id
  );
  if not v_continuar then return true; end if;

  select jsonb_build_object('disponible', disponible)
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
  set disponible = p_disponible
  where id = p_producto_id
    and comercio_id = p_comercio_id;

  perform public.auditoria_finalizar_operacion(
    p_operacion_id, 1, p_comercio_id, 'cambiar_disponibilidad',
    'producto', p_producto_id, v_anterior,
    jsonb_build_object('disponible', p_disponible)
  );
  return true;
end;
$$;

create or replace function public.admin_cambiar_disponibilidad_variante_auditada(
  p_operacion_id uuid,
  p_comercio_id uuid,
  p_variante_id uuid,
  p_disponible boolean
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_producto_id uuid;
  v_anterior jsonb;
  v_continuar boolean;
begin
  select vp.producto_id
    into v_producto_id
  from public.variantes_producto vp
  join public.productos p on p.id = vp.producto_id
  where vp.id = p_variante_id
    and p.comercio_id = p_comercio_id
  for update of vp;

  if v_producto_id is null then
    raise exception 'La variante no pertenece al comercio autorizado.'
      using errcode = 'P0002';
  end if;

  v_continuar := public.auditoria_iniciar_operacion(
    p_operacion_id, p_comercio_id, 'variante', p_variante_id
  );
  if not v_continuar then return true; end if;

  select jsonb_build_object('disponible', disponible)
  into v_anterior
  from public.variantes_producto
  where id = p_variante_id
  for update;

  update public.variantes_producto
  set disponible = p_disponible
  where id = p_variante_id
    and producto_id = v_producto_id;

  perform public.auditoria_finalizar_operacion(
    p_operacion_id, 1, p_comercio_id, 'cambiar_disponibilidad',
    'variante', p_variante_id, v_anterior,
    jsonb_build_object('disponible', p_disponible)
  );
  return true;
end;
$$;

-- Estado de pedidos: valida transición, comercio y auditoría atómicamente.
create or replace function public.admin_actualizar_estado_pedido_auditado(
  p_operacion_id uuid,
  p_comercio_id uuid,
  p_pedido_id uuid,
  p_estado_esperado text,
  p_nuevo_estado text
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_anterior jsonb;
  v_continuar boolean;
begin
  if p_estado_esperado not in (
    'pendiente', 'confirmado', 'en_preparacion', 'listo',
    'entregado', 'cancelado'
  ) or p_nuevo_estado not in (
    'pendiente', 'confirmado', 'en_preparacion', 'listo',
    'entregado', 'cancelado'
  ) then
    raise exception 'Estado de pedido inválido.' using errcode = '22023';
  end if;

  if not (
    (p_estado_esperado = 'pendiente'
      and p_nuevo_estado in ('en_preparacion', 'cancelado'))
    or (p_estado_esperado = 'confirmado'
      and p_nuevo_estado in ('listo', 'cancelado'))
    or (p_estado_esperado = 'en_preparacion'
      and p_nuevo_estado = 'listo')
    or (p_estado_esperado = 'listo'
      and p_nuevo_estado = 'entregado')
  ) then
    raise exception 'La transición de estado no está permitida.'
      using errcode = '40001';
  end if;

  v_continuar := public.auditoria_iniciar_operacion(
    p_operacion_id, p_comercio_id, 'pedido', p_pedido_id
  );
  if not v_continuar then return true; end if;

  select jsonb_build_object('estado', estado)
  into v_anterior
  from public.pedidos
  where id = p_pedido_id
    and comercio_id = p_comercio_id
    and estado = p_estado_esperado
  for update;

  if v_anterior is null then
    raise exception 'El pedido no existe o cambió de estado.'
      using errcode = '40001';
  end if;

  update public.pedidos
  set estado = p_nuevo_estado,
      actualizado_en = now()
  where id = p_pedido_id
    and comercio_id = p_comercio_id
    and estado = p_estado_esperado;

  perform public.auditoria_finalizar_operacion(
    p_operacion_id, 1, p_comercio_id, 'cambiar_estado', 'pedido',
    p_pedido_id, v_anterior,
    jsonb_build_object('estado', p_nuevo_estado)
  );
  return true;
end;
$$;

-- Permisos administrativos: solo un Super Admin puede crear, asignar,
-- activar o desactivar vínculos. El user_id es el objetivo, nunca el actor.
create or replace function public.super_admin_asignar_administrador_auditado(
  p_operacion_id uuid,
  p_comercio_id uuid,
  p_user_id uuid,
  p_rol text default 'admin'
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_anterior jsonb;
begin
  if not exists (
    select 1 from public.super_admins
    where user_id = auth.uid() and activo = true
  ) then
    raise exception 'Solo un Super Admin activo puede administrar permisos.'
      using errcode = '42501';
  end if;
  if p_rol is distinct from 'admin' then
    raise exception 'Solo se puede asignar el rol admin desde esta función.'
      using errcode = '22023';
  end if;
  if not exists (select 1 from auth.users where id = p_user_id) then
    raise exception 'El usuario objetivo no existe.'
      using errcode = 'P0002';
  end if;
  if not exists (
    select 1 from public.comercios
    where id = p_comercio_id and activo = true
  ) then
    raise exception 'El comercio no existe o está inactivo.'
      using errcode = 'P0002';
  end if;
  if not public.auditoria_iniciar_operacion(
    p_operacion_id, p_comercio_id, 'admin_comercio', p_user_id
  ) then
    return true;
  end if;

  select jsonb_build_object(
    'user_id', user_id,
    'comercio_id', comercio_id,
    'rol', rol,
    'activo', activo
  )
  into v_anterior
  from public.admin_comercios
  where user_id = p_user_id
    and comercio_id = p_comercio_id
  for update;

  if v_anterior is not null then
    raise exception 'El administrador ya está asignado al comercio.'
      using errcode = '23505';
  end if;

  insert into public.admin_comercios (user_id, comercio_id, rol, activo)
  values (p_user_id, p_comercio_id, 'admin', true);

  perform public.auditoria_finalizar_operacion(
    p_operacion_id, 1, p_comercio_id, 'asignar', 'admin_comercio',
    p_user_id, null,
    jsonb_build_object(
      'user_id', p_user_id, 'comercio_id', p_comercio_id,
      'rol', 'admin', 'activo', true
    )
  );
  return true;
end;
$$;

create or replace function public.super_admin_cambiar_estado_administrador_auditado(
  p_operacion_id uuid,
  p_comercio_id uuid,
  p_user_id uuid,
  p_activo boolean
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_anterior jsonb;
begin
  if not exists (
    select 1 from public.super_admins
    where user_id = auth.uid() and activo = true
  ) then
    raise exception 'Solo un Super Admin activo puede administrar permisos.'
      using errcode = '42501';
  end if;
  if not public.auditoria_iniciar_operacion(
    p_operacion_id, p_comercio_id, 'admin_comercio', p_user_id
  ) then
    return true;
  end if;

  select jsonb_build_object(
    'user_id', user_id,
    'comercio_id', comercio_id,
    'rol', rol,
    'activo', activo
  )
  into v_anterior
  from public.admin_comercios
  where user_id = p_user_id
    and comercio_id = p_comercio_id
  for update;

  if v_anterior is null then
    raise exception 'La asignación administrativa no existe.'
      using errcode = 'P0002';
  end if;

  update public.admin_comercios
  set activo = p_activo
  where user_id = p_user_id
    and comercio_id = p_comercio_id;

  perform public.auditoria_finalizar_operacion(
    p_operacion_id, 1, p_comercio_id, 'cambiar_estado',
    'admin_comercio', p_user_id, v_anterior,
    jsonb_build_object(
      'user_id', p_user_id, 'comercio_id', p_comercio_id,
      'rol', 'admin', 'activo', p_activo
    )
  );
  return true;
end;
$$;

-- Horarios: no se crea una RPC porque actualmente no existe una tabla
-- persistente de horarios. Queda pendiente de la migración de ese modelo.

-- Las RPC de negocio se exponen solo a usuarios autenticados. Todas vuelven
-- a validar auth.uid(), comercio y rol dentro de la base.
grant execute on function public.admin_crear_categoria_auditada(
  uuid, uuid, text, text, text, text, integer
) to authenticated;
grant execute on function public.admin_actualizar_categoria_auditada(
  uuid, uuid, uuid, text, text, text, boolean
) to authenticated;
grant execute on function public.admin_crear_producto_auditado(
  uuid, uuid, uuid, text, text, text, text, numeric, integer
) to authenticated;
grant execute on function public.admin_actualizar_producto_auditado(
  uuid, uuid, uuid, uuid, text, text, text, numeric, boolean, boolean
) to authenticated;
grant execute on function public.admin_crear_variante_auditada(
  uuid, uuid, uuid, text, numeric, integer
) to authenticated;
grant execute on function public.admin_actualizar_variante_auditada(
  uuid, uuid, uuid, text, numeric, boolean
) to authenticated;
grant execute on function public.admin_cambiar_disponibilidad_producto_auditada(
  uuid, uuid, uuid, boolean
) to authenticated;
grant execute on function public.admin_cambiar_disponibilidad_variante_auditada(
  uuid, uuid, uuid, boolean
) to authenticated;
grant execute on function public.admin_actualizar_estado_pedido_auditado(
  uuid, uuid, uuid, text, text
) to authenticated;
grant execute on function public.super_admin_asignar_administrador_auditado(
  uuid, uuid, uuid, text
) to authenticated;
grant execute on function public.super_admin_cambiar_estado_administrador_auditado(
  uuid, uuid, uuid, boolean
) to authenticated;
grant execute on function public.super_admin_iniciar_invitacion_auditada(
  uuid, uuid, text
) to authenticated;
grant execute on function public.super_admin_completar_invitacion_auditada(
  uuid, uuid
) to authenticated;
grant execute on function public.super_admin_marcar_invitacion_fallida(
  uuid, text, uuid
) to authenticated;

revoke all on function public.auditoria_iniciar_operacion(
  uuid, uuid, text, uuid
) from public, anon, authenticated, service_role;
revoke all on function public.auditoria_finalizar_operacion(
  uuid, integer, uuid, text, text, uuid, jsonb, jsonb
) from public, anon, authenticated, service_role;

revoke all on function public.admin_crear_categoria_auditada(
  uuid, uuid, text, text, text, text, integer
) from public, anon, service_role;
revoke all on function public.admin_actualizar_categoria_auditada(
  uuid, uuid, uuid, text, text, text, boolean
) from public, anon, service_role;
revoke all on function public.admin_crear_producto_auditado(
  uuid, uuid, uuid, text, text, text, text, numeric, integer
) from public, anon, service_role;
revoke all on function public.admin_actualizar_producto_auditado(
  uuid, uuid, uuid, uuid, text, text, text, numeric, boolean, boolean
) from public, anon, service_role;
revoke all on function public.admin_crear_variante_auditada(
  uuid, uuid, uuid, text, numeric, integer
) from public, anon, service_role;
revoke all on function public.admin_actualizar_variante_auditada(
  uuid, uuid, uuid, text, numeric, boolean
) from public, anon, service_role;
revoke all on function public.admin_cambiar_disponibilidad_producto_auditada(
  uuid, uuid, uuid, boolean
) from public, anon, service_role;
revoke all on function public.admin_cambiar_disponibilidad_variante_auditada(
  uuid, uuid, uuid, boolean
) from public, anon, service_role;
revoke all on function public.admin_actualizar_estado_pedido_auditado(
  uuid, uuid, uuid, text, text
) from public, anon, service_role;
revoke all on function public.super_admin_asignar_administrador_auditado(
  uuid, uuid, uuid, text
) from public, anon, service_role;
revoke all on function public.super_admin_cambiar_estado_administrador_auditado(
  uuid, uuid, uuid, boolean
) from public, anon, service_role;
revoke all on function public.super_admin_iniciar_invitacion_auditada(
  uuid, uuid, text
) from public, anon, service_role;
revoke all on function public.super_admin_completar_invitacion_auditada(
  uuid, uuid
) from public, anon, service_role;
revoke all on function public.super_admin_marcar_invitacion_fallida(
  uuid, text, uuid
) from public, anon, service_role;

commit;

-- Verificación manual sugerida:
-- select routine_name
-- from information_schema.routines
-- where routine_schema = 'public'
--   and routine_name like '%auditada%'
-- order by routine_name;
--
-- Prueba manual (con sesión de un Super Admin, nunca con service_role):
-- 1) iniciar_invitacion -> llamar Auth Admin API desde el servidor.
-- 2) completar_invitacion con data.user.id si Auth tuvo éxito.
-- 3) marcar_invitacion_fallida con un motivo permitido si Auth o la
--    asignación falló.
