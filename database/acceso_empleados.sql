-- Gestión de acceso por correo. Ejecutar manualmente después de empleados_etapa_1.sql.
-- No cambia roles, vínculos, RLS existentes ni tablas internas de Supabase Auth.
begin;

create or replace function public.admin_iniciar_acceso_empleado_auditado(
  p_operacion_id uuid,
  p_comercio_id uuid,
  p_user_id uuid,
  p_tipo text
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_existente public.auditoria_eventos%rowtype;
begin
  if auth.uid() is null or not (
    public.es_super_admin_activo() or public.es_admin_de_comercio(p_comercio_id)
  ) then
    raise exception 'No tenés autorización para administrar empleados.' using errcode = '42501';
  end if;
  if p_operacion_id is null or p_user_id is null or p_comercio_id is null
     or p_tipo is null or p_tipo not in ('invitacion', 'recuperacion') then
    raise exception 'Operación de acceso inválida.' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.comercios where id = p_comercio_id and activo
  ) or not exists (
    select 1 from public.admin_comercios
    where comercio_id = p_comercio_id and user_id = p_user_id and rol = 'empleado' and activo
  ) or exists (
    select 1 from public.admin_comercios
    where user_id = p_user_id and (comercio_id <> p_comercio_id or rol <> 'empleado')
  ) or exists (
    select 1 from public.super_admins where user_id = p_user_id
  ) then
    raise exception 'La cuenta no es un empleado exclusivo y activo del comercio.' using errcode = '42501';
  end if;
  if not exists (
    select 1 from auth.users
    where id = p_user_id and email is not null
      and (banned_until is null or banned_until <= now())
      and (p_tipo <> 'invitacion' or email_confirmed_at is null)
  ) then
    raise exception 'La cuenta no admite esta acción de acceso.' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_operacion_id::text, 0));
  perform pg_advisory_xact_lock(hashtextextended('acceso_empleado:' || p_user_id::text, 0));
  select * into v_existente from public.auditoria_eventos
    where operacion_id = p_operacion_id order by secuencia limit 1;
  if found then
    if v_existente.actor_user_id <> auth.uid()
       or v_existente.comercio_id <> p_comercio_id
       or v_existente.registro_id <> p_user_id
       or v_existente.accion <> 'acceso_solicitado'
       or v_existente.valores_nuevos->>'tipo' is distinct from p_tipo then
      raise exception 'La operación ya existe con otros parámetros.' using errcode = '42501';
    end if;
    return false;
  end if;
  if exists (
    select 1 from public.auditoria_eventos
    where registro_id = p_user_id and accion = 'acceso_solicitado'
      and creado_en > now() - interval '60 seconds'
  ) then
    raise exception 'Esperá un minuto antes de enviar otro correo de acceso.' using errcode = '54000';
  end if;

  perform public.auditoria_registrar_evento_interno(
    p_operacion_id, 1::smallint, p_comercio_id, 'acceso_solicitado',
    'admin_comercio', p_user_id, null,
    jsonb_build_object('tipo', p_tipo, 'estado', 'solicitado')
  );
  return true;
end;
$$;

create or replace function public.admin_finalizar_acceso_empleado_auditado(
  p_operacion_id uuid,
  p_enviado boolean
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_inicio public.auditoria_eventos%rowtype;
begin
  if p_operacion_id is null or p_enviado is null then
    raise exception 'Faltan datos de la operación.' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_operacion_id::text, 0));
  select * into v_inicio from public.auditoria_eventos
    where operacion_id = p_operacion_id and secuencia = 1;
  if not found or auth.uid() is null or v_inicio.actor_user_id is distinct from auth.uid()
     or v_inicio.accion <> 'acceso_solicitado'
     or not (public.es_super_admin_activo() or public.es_admin_de_comercio(v_inicio.comercio_id)) then
    raise exception 'No tenés autorización para finalizar esta operación.' using errcode = '42501';
  end if;
  if exists (
    select 1 from public.auditoria_eventos where operacion_id = p_operacion_id and secuencia = 2
  ) then
    return false;
  end if;
  perform public.auditoria_registrar_evento_interno(
    p_operacion_id, 2::smallint, v_inicio.comercio_id,
    case when p_enviado then 'acceso_correo_enviado' else 'acceso_correo_fallido' end,
    'admin_comercio', v_inicio.registro_id, null,
    jsonb_build_object(
      'tipo', v_inicio.valores_nuevos->>'tipo',
      'estado', case when p_enviado then 'enviado' else 'fallido' end
    )
  );
  return true;
end;
$$;

revoke all on function public.admin_iniciar_acceso_empleado_auditado(uuid, uuid, uuid, text)
  from public, anon, authenticated, service_role;
revoke all on function public.admin_finalizar_acceso_empleado_auditado(uuid, boolean)
  from public, anon, authenticated, service_role;
grant execute on function public.admin_iniciar_acceso_empleado_auditado(uuid, uuid, uuid, text)
  to authenticated;
grant execute on function public.admin_finalizar_acceso_empleado_auditado(uuid, boolean)
  to authenticated;

commit;
