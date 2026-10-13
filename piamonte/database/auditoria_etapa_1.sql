-- Auditoría administrativa: etapa 1 (fundación).
-- Revisar y ejecutar manualmente en Supabase → SQL Editor → Run.
--
-- Este script NO modifica las escrituras administrativas existentes, NO crea
-- triggers sobre tablas de negocio y NO habilita todavía la interfaz.
-- La activación se realizará en una segunda migración, al mismo tiempo que
-- cada escritura sea reemplazada por una RPC atómica e idempotente.

begin;

create table if not exists public.auditoria_eventos (
  id uuid primary key default gen_random_uuid(),
  operacion_id uuid not null,
  secuencia smallint not null default 1 check (secuencia > 0),
  creado_en timestamptz not null default now(),
  actor_user_id uuid not null,
  comercio_id uuid not null
    references public.comercios(id)
    on update restrict
    on delete restrict,
  accion text not null
    check (accion ~ '^[a-z][a-z0-9_]{1,63}$'),
  entidad text not null
    check (
      entidad in (
        'categoria',
        'producto',
        'variante',
        'pedido',
        'admin_comercio',
        'horario'
      )
    ),
  registro_id uuid not null,
  valores_anteriores jsonb,
  valores_nuevos jsonb,
  constraint auditoria_valores_objeto_check check (
    (valores_anteriores is null or jsonb_typeof(valores_anteriores) = 'object')
    and
    (valores_nuevos is null or jsonb_typeof(valores_nuevos) = 'object')
    and
    (valores_anteriores is not null or valores_nuevos is not null)
  ),
  constraint auditoria_operacion_secuencia_unique
    unique (operacion_id, secuencia)
);

comment on table public.auditoria_eventos is
  'Registro inmutable de operaciones administrativas. Solo los Super Admin activos pueden consultarlo.';

comment on column public.auditoria_eventos.operacion_id is
  'Clave de idempotencia de una operación administrativa completa.';

comment on column public.auditoria_eventos.secuencia is
  'Orden determinista cuando una misma operación genera más de un evento.';

comment on column public.auditoria_eventos.actor_user_id is
  'UUID del usuario de Supabase Auth validado por el servidor. Se conserva aunque el usuario sea eliminado.';

comment on column public.auditoria_eventos.registro_id is
  'UUID del registro afectado. Para admin_comercios se utiliza el user_id asignado.';

create index if not exists auditoria_eventos_fecha_idx
  on public.auditoria_eventos (creado_en desc);

create index if not exists auditoria_eventos_comercio_fecha_idx
  on public.auditoria_eventos (comercio_id, creado_en desc);

create index if not exists auditoria_eventos_actor_fecha_idx
  on public.auditoria_eventos (actor_user_id, creado_en desc);

create index if not exists auditoria_eventos_accion_fecha_idx
  on public.auditoria_eventos (accion, creado_en desc);

create index if not exists auditoria_eventos_entidad_registro_idx
  on public.auditoria_eventos (entidad, registro_id, creado_en desc);

-- Detecta claves sensibles de primer nivel. Las RPC de la etapa 2 además
-- construirán valores anteriores/nuevos mediante listas blancas de columnas.
create or replace function public.auditoria_contiene_clave_sensible(
  p_valor jsonb
)
returns boolean
language sql
immutable
strict
set search_path = pg_catalog, public
as $$
  select p_valor ?| array[
    'password',
    'contrasena',
    'token',
    'access_token',
    'refresh_token',
    'authorization',
    'secret',
    'service_role'
  ];
$$;

alter table public.auditoria_eventos
  drop constraint if exists auditoria_sin_secretos_check;

alter table public.auditoria_eventos
  add constraint auditoria_sin_secretos_check check (
    not coalesce(
      public.auditoria_contiene_clave_sensible(valores_anteriores),
      false
    )
    and
    not coalesce(
      public.auditoria_contiene_clave_sensible(valores_nuevos),
      false
    )
  );

-- Valida al actor real del JWT contra el estado actual de la base.
-- Las futuras RPC SECURITY DEFINER se invocarán con el cliente de sesión,
-- no con service_role, por lo que auth.uid() conserva al usuario responsable.
create or replace function public.auditoria_actor_autorizado(
  p_comercio_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, auth
as $$
  select
    auth.uid() is not null
    and
    exists (
      select 1
      from auth.users u
      where u.id = auth.uid()
    )
    and
    (
      exists (
        select 1
        from public.super_admins sa
        where sa.user_id = auth.uid()
          and sa.activo = true
      )
      or
      exists (
        select 1
        from public.admin_comercios ac
        where ac.user_id = auth.uid()
          and ac.comercio_id = p_comercio_id
          and ac.activo = true
      )
    );
$$;

-- Función interna para las futuras RPC atómicas. El actor se obtiene siempre
-- mediante auth.uid(); no existe un parámetro de actor que pueda falsificarse.
-- No se concede EXECUTE a service_role ni a usuarios: únicamente podrá
-- invocarla otra función SECURITY DEFINER propietaria de la operación.
create or replace function public.auditoria_registrar_evento_interno(
  p_operacion_id uuid,
  p_secuencia smallint,
  p_comercio_id uuid,
  p_accion text,
  p_entidad text,
  p_registro_id uuid,
  p_valores_anteriores jsonb,
  p_valores_nuevos jsonb
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_evento_id uuid;
  v_actor_user_id uuid := auth.uid();
begin
  if p_operacion_id is null
     or v_actor_user_id is null
     or p_comercio_id is null
     or p_registro_id is null then
    raise exception 'Faltan datos obligatorios para registrar la auditoría.'
      using errcode = '22023';
  end if;

  if not public.auditoria_actor_autorizado(p_comercio_id) then
    raise exception 'El actor no está autorizado para el comercio.'
      using errcode = '42501';
  end if;

  if public.auditoria_contiene_clave_sensible(p_valores_anteriores)
     or public.auditoria_contiene_clave_sensible(p_valores_nuevos) then
    raise exception 'Los valores de auditoría contienen claves sensibles.'
      using errcode = '22023';
  end if;

  insert into public.auditoria_eventos (
    operacion_id,
    secuencia,
    actor_user_id,
    comercio_id,
    accion,
    entidad,
    registro_id,
    valores_anteriores,
    valores_nuevos
  )
  values (
    p_operacion_id,
    p_secuencia,
    v_actor_user_id,
    p_comercio_id,
    p_accion,
    p_entidad,
    p_registro_id,
    p_valores_anteriores,
    p_valores_nuevos
  )
  returning id into v_evento_id;

  return v_evento_id;
end;
$$;

-- Inmutabilidad defensiva: ni siquiera una futura concesión accidental de
-- UPDATE/DELETE debe permitir alterar el historial.
create or replace function public.auditoria_bloquear_mutacion()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if TG_OP = 'DELETE'
     and current_setting(
       'app.auditoria_retencion_autorizada',
       true
     ) = 'true' then
    return old;
  end if;

  raise exception 'Los registros de auditoría son inmutables.'
    using errcode = '42501';
end;
$$;

drop trigger if exists auditoria_eventos_bloquear_update
  on public.auditoria_eventos;
create trigger auditoria_eventos_bloquear_update
before update on public.auditoria_eventos
for each row execute function public.auditoria_bloquear_mutacion();

drop trigger if exists auditoria_eventos_bloquear_delete
  on public.auditoria_eventos;
create trigger auditoria_eventos_bloquear_delete
before delete on public.auditoria_eventos
for each row execute function public.auditoria_bloquear_mutacion();

alter table public.auditoria_eventos enable row level security;

revoke all on table public.auditoria_eventos
  from anon, authenticated, service_role;
grant select on table public.auditoria_eventos to authenticated;

drop policy if exists "Super Admin consulta auditoría"
  on public.auditoria_eventos;
create policy "Super Admin consulta auditoría"
  on public.auditoria_eventos
  for select
  to authenticated
  using (public.es_super_admin_activo());

-- No existe política de lectura para administradores comunes.
-- No existen políticas INSERT, UPDATE o DELETE para ningún usuario de la app.
-- Una purga por retención requerirá una transacción ejecutada por el propietario:
--   select set_config(
--     'app.auditoria_retencion_autorizada',
--     'true',
--     true
--   );
--   delete from public.auditoria_eventos where creado_en < ...;
-- La aplicación no posee DELETE ni una RPC que pueda establecer esa marca.

revoke all on function public.auditoria_contiene_clave_sensible(jsonb)
  from public, anon, authenticated, service_role;
revoke all on function public.auditoria_actor_autorizado(uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.auditoria_registrar_evento_interno(
  uuid, smallint, uuid, text, text, uuid, jsonb, jsonb
) from public, anon, authenticated, service_role;
revoke all on function public.auditoria_bloquear_mutacion()
  from public, anon, authenticated, service_role;

commit;

-- Verificación manual: solo debe aparecer una política SELECT para
-- authenticated, limitada a public.es_super_admin_activo().
select policyname, cmd, roles, qual
from pg_policies
where schemaname = 'public'
  and tablename = 'auditoria_eventos'
order by policyname;
