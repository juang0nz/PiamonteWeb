-- PIA-2: demanda, tiempos estimados configurables y pausa de pedidos.
--
-- Qué resuelve:
--   1. Crea public.comercio_configuracion (1:1 con comercios): nivel de demanda
--      (normal/alta), rangos de tiempo estimado en minutos por modalidad y nivel, pausa de
--      recepción de pedidos con mensaje editable. Lectura pública de la fila del comercio
--      activo (la carta y el checkout la necesitan sin sesión); escritura únicamente por la
--      RPC auditada admin_actualizar_configuracion_comercio (owner/admin/super admin).
--   2. Agrega pedidos.tiempo_estimado_min / tiempo_estimado_max: el rango vigente se
--      congela al aceptar el pedido (transición a en_preparacion) dentro de la RPC
--      admin_actualizar_estado_pedido_auditado, que se redefine con la misma firma y los
--      mismos permisos. Los pedidos históricos quedan en null.
--   3. Amplía la auditoría con la entidad comercio_configuracion: check de
--      auditoria_eventos y lista de entidades de auditoria_iniciar_operacion (misma función,
--      mismo cuerpo, una entidad más).
--   4. Publica comercio_configuracion en Realtime para que la carta reaccione a la pausa.
--
-- Requiere: la foto base y 20261017210509_limpiar_rpc_pedidos.sql aplicadas.
-- Idempotente: sí (if not exists, create or replace, drop ... if exists, on conflict).
--
-- Los valores iniciales (15-30 retiro, 30-45 envío; +15 en demanda alta; mensaje de pausa)
-- son provisorios: el administrador los ajusta desde el panel "Operación". La fila inicial se
-- inserta para cada comercio existente, así producción y desarrollo quedan configurados al
-- aplicar la migración.

begin;

-- 1. Configuración operativa del comercio ------------------------------------------------

create table if not exists public.comercio_configuracion (
  comercio_id       uuid primary key references public.comercios(id) on delete cascade,
  demanda           text        not null default 'normal',
  retiro_normal_min integer     not null default 15,
  retiro_normal_max integer     not null default 30,
  envio_normal_min  integer     not null default 30,
  envio_normal_max  integer     not null default 45,
  retiro_alta_min   integer     not null default 30,
  retiro_alta_max   integer     not null default 45,
  envio_alta_min    integer     not null default 45,
  envio_alta_max    integer     not null default 60,
  pedidos_pausados  boolean     not null default false,
  mensaje_pausa     text        not null default 'Estamos con mucha demanda. En un rato volvemos a tomar pedidos.',
  actualizado_en    timestamptz not null default now(),
  constraint comercio_configuracion_demanda_check
    check (demanda in ('normal', 'alta')),
  constraint comercio_configuracion_mensaje_pausa_check
    check (length(btrim(mensaje_pausa)) between 1 and 280),
  constraint comercio_configuracion_rangos_check check (
    retiro_normal_min >= 0 and retiro_normal_max >= retiro_normal_min and retiro_normal_max <= 240
    and envio_normal_min >= 0 and envio_normal_max >= envio_normal_min and envio_normal_max <= 240
    and retiro_alta_min >= 0 and retiro_alta_max >= retiro_alta_min and retiro_alta_max <= 240
    and envio_alta_min >= 0 and envio_alta_max >= envio_alta_min and envio_alta_max <= 240
  )
);

comment on table public.comercio_configuracion is
  'Configuración operativa por comercio (PIA-2): demanda, tiempos estimados y pausa de pedidos. PIA-3/4/5 agregan sus columnas acá.';

-- El event trigger ensure_rls ya lo hace; se deja explícito.
alter table public.comercio_configuracion enable row level security;

-- actualizado_en: se reutiliza la función de trigger existente (su cuerpo es genérico).
drop trigger if exists comercio_configuracion_actualizado_en on public.comercio_configuracion;
create trigger comercio_configuracion_actualizado_en
before update on public.comercio_configuracion
for each row execute function public.clientes_actualizar_actualizado_en();

-- Lectura pública de la fila del comercio activo (carta y checkout sin sesión).
drop policy if exists "Lectura publica de configuracion del comercio activo" on public.comercio_configuracion;
create policy "Lectura publica de configuracion del comercio activo"
  on public.comercio_configuracion
  for select to anon, authenticated
  using (exists (
    select 1 from public.comercios c
    where c.id = comercio_configuracion.comercio_id and c.activo = true
  ));

-- Sin escritura directa para ningún rol de la API: solo la RPC auditada (dueño postgres).
revoke all on table public.comercio_configuracion from public, anon, authenticated, service_role;
grant select on table public.comercio_configuracion to anon, authenticated, service_role;

-- Fila inicial por comercio con los valores provisorios.
insert into public.comercio_configuracion (comercio_id)
select id from public.comercios
on conflict (comercio_id) do nothing;

-- Realtime: la carta escucha cambios de configuración (pausa, demanda). Idempotente.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'comercio_configuracion'
  ) then
    alter publication supabase_realtime add table public.comercio_configuracion;
  end if;
end
$$;

-- 2. Tiempo estimado congelado en el pedido ----------------------------------------------

alter table public.pedidos
  add column if not exists tiempo_estimado_min integer,
  add column if not exists tiempo_estimado_max integer;

alter table public.pedidos drop constraint if exists pedidos_tiempo_estimado_check;
alter table public.pedidos add constraint pedidos_tiempo_estimado_check check (
  (tiempo_estimado_min is null and tiempo_estimado_max is null)
  or (tiempo_estimado_min >= 0 and tiempo_estimado_max >= tiempo_estimado_min)
);

comment on column public.pedidos.tiempo_estimado_min is
  'Minuto inferior del rango estimado vigente al aceptar el pedido (PIA-2). Null en pedidos previos o aún no aceptados.';
comment on column public.pedidos.tiempo_estimado_max is
  'Minuto superior del rango estimado vigente al aceptar el pedido (PIA-2).';

-- 3. Auditoría: entidad comercio_configuracion -------------------------------------------

alter table public.auditoria_eventos drop constraint if exists auditoria_eventos_entidad_check;
alter table public.auditoria_eventos add constraint auditoria_eventos_entidad_check check (
  entidad in ('categoria', 'producto', 'variante', 'pedido', 'admin_comercio',
              'admin_invitacion', 'horario', 'comercio_configuracion')
);

-- Misma función que la foto base; el único cambio es la entidad nueva en la lista de
-- entidades válidas. La autorización para ella es la rama general (super admin o
-- owner/admin del comercio), que ya excluye al rol empleado.
create or replace function public.auditoria_iniciar_operacion (
  p_operacion_id uuid,
  p_comercio_id  uuid,
  p_entidad      text,
  p_registro_id  uuid
)
  returns boolean
  language plpgsql
  security definer
  set search_path to 'pg_catalog', 'public', 'auth'
  as $function$
declare
  v_actor uuid := auth.uid();
  v_existente record;
  v_autorizado boolean;
begin
  if p_operacion_id is null
    or p_comercio_id is null
    or p_registro_id is null
    or p_entidad not in (
      'categoria',
      'producto',
      'variante',
      'pedido',
      'admin_comercio',
      'comercio_configuracion'
    ) then
    raise exception 'Datos inválidos para iniciar la operación.' using errcode = '22023';
  end if;

  v_autorizado := case
    when p_entidad = 'pedido' then public.es_personal_de_comercio(p_comercio_id)
    else public.es_super_admin_activo() or public.es_admin_de_comercio(p_comercio_id)
  end;

  if not coalesce(v_autorizado, false) then
    raise exception 'El actor no está autorizado para esta operación.' using errcode = '42501';
  end if;

  -- El actor también debe poder escribir el evento más adelante.
  -- Se valida acá para no abortar a mitad de la operación.
  if not public.auditoria_actor_autorizado(p_comercio_id) then
    raise exception 'El actor no está autorizado para el comercio.' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_operacion_id::text, 0));

  -- Idempotencia por operación completa: una operacion_id reutilizada debe
  -- corresponder al mismo actor, comercio, entidad y registro. De lo
  -- contrario un reintento podría devolver "ya aplicada" para otra
  -- operación distinta y omitir su auditoría.
  select
    min(actor_user_id::text) as actor,
    count(distinct actor_user_id) as actores,
    min(comercio_id::text) as comercio,
    count(distinct comercio_id) as comercios,
    min(entidad) as entidad,
    count(distinct entidad) as entidades,
    min(registro_id::text) as registro,
    count(distinct registro_id) as registros
  into v_existente
  from public.auditoria_eventos
  where operacion_id = p_operacion_id;

  if v_existente.actor is not null then
    if v_existente.actores > 1 or v_existente.actor is distinct from v_actor::text then
      raise exception 'La operación pertenece a otro actor.' using errcode = '42501';
    end if;

    if v_existente.comercios > 1
      or v_existente.comercio is distinct from p_comercio_id::text
      or v_existente.entidades > 1
      or v_existente.entidad is distinct from p_entidad then
      raise exception 'La operación ya se registró con otros parámetros.' using errcode = '22023';
    end if;

    -- Una misma operación puede abarcar varios registros de la misma
    -- entidad (por ejemplo, los productos arrastrados al eliminar una
    -- categoría). Sólo se exige coincidencia cuando hubo un único registro.
    if v_existente.registros = 1 and v_existente.registro is distinct from p_registro_id::text then
      raise exception 'La operación ya se registró con otros parámetros.' using errcode = '22023';
    end if;

    return false;
  end if;

  return true;
end;
$function$;

revoke all on function public.auditoria_iniciar_operacion(uuid, uuid, text, uuid)
  from public, anon, authenticated, service_role;

-- 4. RPC auditada de configuración --------------------------------------------------------

create or replace function public.admin_actualizar_configuracion_comercio (
  p_operacion_id uuid,
  p_comercio_id  uuid,
  p_cambios      jsonb
)
  returns public.comercio_configuracion
  language plpgsql
  security definer
  set search_path to 'pg_catalog', 'public', 'auth'
  as $function$
declare
  v_fila      public.comercio_configuracion;
  v_anterior  jsonb;
  v_nuevo     jsonb;
  v_continuar boolean;
  v_clave     text;
begin
  if p_operacion_id is null or p_comercio_id is null then
    raise exception 'Datos inválidos para actualizar la configuración.' using errcode = '22023';
  end if;

  if p_cambios is null or jsonb_typeof(p_cambios) <> 'object' or p_cambios = '{}'::jsonb then
    raise exception 'No hay cambios de configuración para aplicar.' using errcode = '22023';
  end if;

  -- Solo las claves de esta tarea. Las columnas que agreguen PIA-3/4/5 se suman en sus
  -- propias migraciones, redefiniendo esta función.
  for v_clave in select jsonb_object_keys(p_cambios) loop
    if v_clave not in (
      'demanda',
      'retiro_normal_min', 'retiro_normal_max',
      'envio_normal_min', 'envio_normal_max',
      'retiro_alta_min', 'retiro_alta_max',
      'envio_alta_min', 'envio_alta_max',
      'pedidos_pausados', 'mensaje_pausa'
    ) then
      raise exception 'Clave de configuración no permitida: %', v_clave using errcode = '22023';
    end if;
  end loop;

  if not (public.es_super_admin_activo() or public.es_admin_de_comercio(p_comercio_id)) then
    raise exception 'No tenés permisos para modificar la configuración del comercio.' using errcode = '42501';
  end if;

  if not exists (select 1 from public.comercios where id = p_comercio_id) then
    raise exception 'El comercio no existe.' using errcode = 'P0002';
  end if;

  v_continuar := public.auditoria_iniciar_operacion(
    p_operacion_id,
    p_comercio_id,
    'comercio_configuracion',
    p_comercio_id
  );

  -- Garantiza la fila (comercios creados después de la migración) y la bloquea.
  insert into public.comercio_configuracion (comercio_id)
  values (p_comercio_id)
  on conflict (comercio_id) do nothing;

  select * into v_fila
  from public.comercio_configuracion
  where comercio_id = p_comercio_id
  for update;

  -- Reintento de una operación ya aplicada: devuelve el estado actual sin volver a auditar.
  if not v_continuar then
    return v_fila;
  end if;

  v_anterior := to_jsonb(v_fila) - 'actualizado_en' - 'comercio_id';

  begin
    update public.comercio_configuracion set
      demanda           = coalesce(p_cambios->>'demanda', demanda),
      retiro_normal_min = coalesce((p_cambios->>'retiro_normal_min')::integer, retiro_normal_min),
      retiro_normal_max = coalesce((p_cambios->>'retiro_normal_max')::integer, retiro_normal_max),
      envio_normal_min  = coalesce((p_cambios->>'envio_normal_min')::integer, envio_normal_min),
      envio_normal_max  = coalesce((p_cambios->>'envio_normal_max')::integer, envio_normal_max),
      retiro_alta_min   = coalesce((p_cambios->>'retiro_alta_min')::integer, retiro_alta_min),
      retiro_alta_max   = coalesce((p_cambios->>'retiro_alta_max')::integer, retiro_alta_max),
      envio_alta_min    = coalesce((p_cambios->>'envio_alta_min')::integer, envio_alta_min),
      envio_alta_max    = coalesce((p_cambios->>'envio_alta_max')::integer, envio_alta_max),
      pedidos_pausados  = coalesce((p_cambios->>'pedidos_pausados')::boolean, pedidos_pausados),
      mensaje_pausa     = coalesce(nullif(btrim(p_cambios->>'mensaje_pausa'), ''), mensaje_pausa)
    where comercio_id = p_comercio_id
    returning * into v_fila;
  exception
    when check_violation then
      raise exception 'Valores de configuración inválidos: la demanda debe ser normal o alta, los minutos van de 0 a 240 con máximo mayor o igual al mínimo y el mensaje de pausa tiene hasta 280 caracteres.'
        using errcode = '22023';
    when invalid_text_representation then
      raise exception 'Tipo de dato inválido en la configuración.' using errcode = '22023';
  end;

  v_nuevo := to_jsonb(v_fila) - 'actualizado_en' - 'comercio_id';

  perform public.auditoria_finalizar_operacion(
    p_operacion_id,
    1,
    p_comercio_id,
    'actualizar',
    'comercio_configuracion',
    p_comercio_id,
    v_anterior,
    v_nuevo
  );

  return v_fila;
end;
$function$;

revoke all on function public.admin_actualizar_configuracion_comercio(uuid, uuid, jsonb)
  from public, anon, service_role;
grant execute on function public.admin_actualizar_configuracion_comercio(uuid, uuid, jsonb)
  to authenticated;

-- 5. Congelar el tiempo estimado al aceptar el pedido ------------------------------------

-- Misma firma, mismas validaciones y mismos permisos que la foto base. Cambio: al pasar a
-- en_preparacion, si el pedido aún no tiene rango, toma el vigente de comercio_configuracion
-- según modalidad y demanda y lo guarda; cambiar la demanda después no altera el pedido.
create or replace function public.admin_actualizar_estado_pedido_auditado (
  p_operacion_id    uuid,
  p_comercio_id     uuid,
  p_pedido_id       uuid,
  p_estado_esperado text,
  p_nuevo_estado    text
)
  returns boolean
  language plpgsql
  security definer
  set search_path to 'pg_catalog', 'public', 'auth'
  as $function$
declare
  v_anterior    jsonb;
  v_nuevo       jsonb;
  v_continuar   boolean;
  v_es_empleado boolean;
  v_modalidad   text;
  v_tiempo_min  integer;
  v_tiempo_max  integer;
begin
  if p_estado_esperado is null
    or p_nuevo_estado is null
    or p_estado_esperado not in ('pendiente', 'confirmado', 'en_preparacion', 'listo', 'entregado', 'cancelado')
    or p_nuevo_estado not in ('pendiente', 'confirmado', 'en_preparacion', 'listo', 'entregado', 'cancelado') then
    raise exception 'Estado de pedido inválido.' using errcode = '22023';
  end if;

  if not (
    (p_estado_esperado = 'pendiente' and p_nuevo_estado in ('en_preparacion', 'cancelado'))
    or (p_estado_esperado = 'confirmado' and p_nuevo_estado in ('listo', 'cancelado'))
    or (p_estado_esperado = 'en_preparacion' and p_nuevo_estado = 'listo')
    or (p_estado_esperado = 'listo' and p_nuevo_estado = 'entregado')
  ) then
    raise exception 'La transición de estado no está permitida.' using errcode = '40001';
  end if;

  -- Un Empleado puro (sin Super Admin ni rol admin en el comercio) sólo
  -- avanza el flujo: recibir, preparar, marcar listo y entregar.
  v_es_empleado := public.es_empleado_de_comercio(p_comercio_id)
    and not public.es_super_admin_activo()
    and not public.es_admin_de_comercio(p_comercio_id);

  if v_es_empleado and p_nuevo_estado = 'cancelado' then
    raise exception 'Un Empleado no puede cancelar pedidos.' using errcode = '42501';
  end if;

  v_continuar := public.auditoria_iniciar_operacion(
    p_operacion_id,
    p_comercio_id,
    'pedido',
    p_pedido_id
  );

  if not v_continuar then
    return true;
  end if;

  select
    jsonb_build_object('estado', estado),
    modalidad,
    tiempo_estimado_min,
    tiempo_estimado_max
  into v_anterior, v_modalidad, v_tiempo_min, v_tiempo_max
  from public.pedidos
  where id = p_pedido_id
    and comercio_id = p_comercio_id
    and estado = p_estado_esperado
  for update;

  if v_anterior is null then
    raise exception 'El pedido no existe o cambió de estado.' using errcode = '40001';
  end if;

  v_nuevo := jsonb_build_object('estado', p_nuevo_estado);

  -- Congelado del tiempo estimado: solo al aceptar y solo si todavía no tiene rango.
  if p_nuevo_estado = 'en_preparacion' and v_tiempo_min is null then
    select
      case
        when v_modalidad = 'retiro' then
          case when c.demanda = 'alta' then c.retiro_alta_min else c.retiro_normal_min end
        else
          case when c.demanda = 'alta' then c.envio_alta_min else c.envio_normal_min end
      end,
      case
        when v_modalidad = 'retiro' then
          case when c.demanda = 'alta' then c.retiro_alta_max else c.retiro_normal_max end
        else
          case when c.demanda = 'alta' then c.envio_alta_max else c.envio_normal_max end
      end
    into v_tiempo_min, v_tiempo_max
    from public.comercio_configuracion c
    where c.comercio_id = p_comercio_id;

    if v_tiempo_min is not null then
      v_nuevo := v_nuevo || jsonb_build_object(
        'tiempo_estimado_min', v_tiempo_min,
        'tiempo_estimado_max', v_tiempo_max
      );
    end if;
  end if;

  update public.pedidos set
    estado = p_nuevo_estado,
    actualizado_en = now(),
    tiempo_estimado_min = coalesce(tiempo_estimado_min, v_tiempo_min),
    tiempo_estimado_max = coalesce(tiempo_estimado_max, v_tiempo_max)
  where id = p_pedido_id
    and comercio_id = p_comercio_id
    and estado = p_estado_esperado;

  perform public.auditoria_finalizar_operacion(
    p_operacion_id,
    1,
    p_comercio_id,
    'cambiar_estado',
    'pedido',
    p_pedido_id,
    v_anterior,
    v_nuevo
  );

  return true;
end;
$function$;

-- Idénticos a la foto base: la ejecuta authenticated (y postgres como dueño); nunca anon ni
-- service_role.
revoke all on function public.admin_actualizar_estado_pedido_auditado(uuid, uuid, uuid, text, text)
  from public, anon, service_role;
grant execute on function public.admin_actualizar_estado_pedido_auditado(uuid, uuid, uuid, text, text)
  to authenticated;

commit;
