-- BORRADOR v2: conserva owner/admin/operador y agrega empleado. NO EJECUTAR SIN VALIDACION.

-- Preparado con roles observados en Supabase; no ejecutado ni probado contra la base.

-- owner conserva capacidades administrativas; operador no obtiene permisos nuevos.

-- Pendiente comprobar helpers/RPCs existentes y firma antigua de asignacion.

-- Rol Empleado: autorización y auditoría de base de datos.

-- Ejecutar manualmente en Supabase -> SQL Editor -> Run.

-- Requiere super_admin.sql, auditoria_etapa_1.sql,

-- auditoria_etapa_2.sql y notificaciones_pedidos_realtime.sql.

--

-- Este script no crea usuarios de Auth ni modifica pedidos existentes.

-- Debe aprobarse antes de adaptar auth.ts, middleware, layouts y APIs.

begin;

-- PRECONDICION: no se eliminan sobrecargas a ciegas.

-- Una firma antigua debe evaluarse según sus dependencias antes de migrar.

DO $$

BEGIN if to_regprocedure(

  'public.super_admin_asignar_administrador_auditado(uuid,uuid,uuid)'

) is not null then raise exception 'Existe una versión de 3 parámetros de super_admin_asignar_administrador_auditado. Revisar dependencias antes de continuar.';

end if;

end $$;

-- 1. Roles admitidos por comercio.

do $$ declare v_constraint record;

begin if exists (

  select

    1

  from

    public.admin_comercios

  where

    rol is null

    or rol not in ('owner', 'admin', 'operador', 'empleado')

) then raise exception 'admin_comercios contiene roles fuera de owner, admin, operador o empleado.';

end if;

for v_constraint in

select

  distinct c.conname

from

  pg_constraint c

  join pg_attribute a on a.attrelid = c.conrelid

  and a.attnum = any(c.conkey)

where

  c.conrelid = 'public.admin_comercios' :: regclass

  and c.contype = 'c'

  and a.attname = 'rol' loop execute format(

    'alter table public.admin_comercios drop constraint %I',

    v_constraint.conname

  );

end loop;

end $$;

alter table

  public.admin_comercios

alter column

  rol

set

  not null;

alter table

  public.admin_comercios

add

  constraint admin_comercios_rol_check check (

    rol in ('owner', 'admin', 'operador', 'empleado')

  );

-- La outbox existente conserva el rol solicitado sin exponer secretos.

alter table

  public.auditoria_invitaciones_admin

add

  column if not exists rol text not null default 'admin';

do $$ declare v_constraint record;

begin for v_constraint in

select

  distinct c.conname

from

  pg_constraint c

  join pg_attribute a on a.attrelid = c.conrelid

  and a.attnum = any(c.conkey)

where

  c.conrelid = 'public.auditoria_invitaciones_admin' :: regclass

  and c.contype = 'c'

  and a.attname = 'rol' loop execute format(

    'alter table public.auditoria_invitaciones_admin drop constraint %I',

    v_constraint.conname

  );

end loop;

end $$;

alter table

  public.auditoria_invitaciones_admin

add

  constraint auditoria_invitaciones_admin_rol_check check (rol in ('admin', 'empleado'));

-- 2. Helpers separados por capacidad.

create

or replace function public.es_admin_de_comercio(p_comercio_id uuid) returns boolean language sql stable security definer

set

  search_path = pg_catalog,

  public,

  auth as $$

select

  auth.uid() is not null

  and exists (

    select

      1

    from

      public.admin_comercios

    where

      user_id = auth.uid()

      and comercio_id = p_comercio_id

      and rol in ('owner', 'admin')

      and activo = true

  );

$$;

create

or replace function public.es_empleado_de_comercio(p_comercio_id uuid) returns boolean language sql stable security definer

set

  search_path = pg_catalog,

  public,

  auth as $$

select

  auth.uid() is not null

  and exists (

    select

      1

    from

      public.admin_comercios

    where

      user_id = auth.uid()

      and comercio_id = p_comercio_id

      and rol = 'empleado'

      and activo = true

  );

$$;

create

or replace function public.es_personal_de_comercio(p_comercio_id uuid) returns boolean language sql stable security definer

set

  search_path = pg_catalog,

  public,

  auth as $$

select

  public.es_super_admin_activo()

  or public.es_admin_de_comercio(p_comercio_id)

  or public.es_empleado_de_comercio(p_comercio_id);

$$;

-- IMPORTANTE: auditoria_actor_autorizado NO se redefine.

-- auditoria_finalizar_operacion -> auditoria_registrar_evento_interno

-- la invoca al escribir cada evento. Si excluyera a los Empleados, un

-- Empleado podría iniciar la operación del pedido y fallar al registrarla,

-- dejando la modificación sin auditoría o abortando la transacción.

-- La restricción por rol se aplica una sola vez, al iniciar la operación.

-- Los pedidos son la única entidad auditada habilitada para Empleados.

-- Las demás entidades exigen Admin del comercio o Super Admin, de modo que

-- las RPC de catálogo, disponibilidad y permisos quedan cerradas al Empleado

-- aunque se invoquen directamente desde el cliente de sesión.

create

or replace function public.auditoria_iniciar_operacion(

  p_operacion_id uuid,

  p_comercio_id uuid,

  p_entidad text,

  p_registro_id uuid

) returns boolean language plpgsql security definer

set

  search_path = pg_catalog,

  public,

  auth as $$ declare v_actor uuid := auth.uid();

v_existente record;

v_autorizado boolean;

begin if p_operacion_id is null

or p_comercio_id is null

or p_registro_id is null

or p_entidad not in (

  'categoria',

  'producto',

  'variante',

  'pedido',

  'admin_comercio'

) then raise exception 'Datos inválidos para iniciar la operación.' using errcode = '22023';

end if;

v_autorizado := case

  when p_entidad = 'pedido' then public.es_personal_de_comercio(p_comercio_id)

  else public.es_super_admin_activo()

  or public.es_admin_de_comercio(p_comercio_id)

end;

if not coalesce(v_autorizado, false) then raise exception 'El actor no está autorizado para esta operación.' using errcode = '42501';

end if;

-- El actor también debe poder escribir el evento más adelante.

-- Se valida acá para no abortar a mitad de la operación.

if not public.auditoria_actor_autorizado(p_comercio_id) then raise exception 'El actor no está autorizado para el comercio.' using errcode = '42501';

end if;

perform pg_advisory_xact_lock(

  hashtextextended(p_operacion_id :: text, 0)

);

-- Idempotencia por operación completa: una operacion_id reutilizada debe

-- corresponder al mismo actor, comercio, entidad y registro. De lo

-- contrario un reintento podría devolver "ya aplicada" para otra

-- operación distinta y omitir su auditoría.

select

  min(actor_user_id :: text) as actor,

  count(distinct actor_user_id) as actores,

  min(comercio_id :: text) as comercio,

  count(distinct comercio_id) as comercios,

  min(entidad) as entidad,

  count(distinct entidad) as entidades,

  min(registro_id :: text) as registro,

  count(distinct registro_id) as registros into v_existente

from

  public.auditoria_eventos

where

  operacion_id = p_operacion_id;

if v_existente.actor is not null then if v_existente.actores > 1

or v_existente.actor is distinct

from

  v_actor :: text then raise exception 'La operación pertenece a otro actor.' using errcode = '42501';

end if;

if v_existente.comercios > 1

or v_existente.comercio is distinct

from

  p_comercio_id :: text

  or v_existente.entidades > 1

  or v_existente.entidad is distinct

from

  p_entidad then raise exception 'La operación ya se registró con otros parámetros.' using errcode = '22023';

end if;

-- Una misma operación puede abarcar varios registros de la misma

-- entidad (por ejemplo, los productos arrastrados al eliminar una

-- categoría). Sólo se exige coincidencia cuando hubo un único registro.

if v_existente.registros = 1

and v_existente.registro is distinct

from

  p_registro_id :: text then raise exception 'La operación ya se registró con otros parámetros.' using errcode = '22023';

end if;

return false;

end if;

return true;

end;

$$;

-- 3. RLS de pedidos: sólo lectura para personal del mismo comercio.

-- Los cambios de estado continúan exclusivamente por la RPC auditada.

-- El checkout público inserta pedidos con service_role, que no pasa por RLS,

-- por lo que quitar las políticas de anon/authenticated no lo afecta.

alter table

  public.pedidos enable row level security;

grant

select

  on table public.pedidos to authenticated;

revoke

insert

,

update

,

  delete on table public.pedidos

from

  anon,

  authenticated;

-- PRECONDICION: no borrar políticas desconocidas del sistema de pedidos.

-- Si se agregaron políticas desde la revisión, abortar toda la transacción.

do $$ declare v_inesperadas text;

begin

select

  string_agg(

    policyname,

    ', '

    order by

      policyname

  ) into v_inesperadas

from

  pg_policies

where

  schemaname = 'public'

  and tablename = 'pedidos'

  and policyname <> 'Admins leen pedidos de su comercio';

if v_inesperadas is not null then raise exception 'Políticas RLS inesperadas en pedidos: %. Revisar antes de migrar.',

v_inesperadas;

end if;

end $$;

drop policy if exists "Admins leen pedidos de su comercio" on public.pedidos;

create policy "Personal del comercio lee pedidos" on public.pedidos for

select

  to authenticated using (public.es_personal_de_comercio(comercio_id));

-- 4. Asignación atómica y auditada de un Empleado que ya existe en Auth.

-- La puede ejecutar un Admin de ese comercio o un Super Admin.

create

or replace function public.admin_asignar_empleado_auditado(

  p_operacion_id uuid,

  p_comercio_id uuid,

  p_user_id uuid

) returns boolean language plpgsql security definer

set

  search_path = pg_catalog,

  public,

  auth as $$ declare v_anterior jsonb;

begin if not (

  public.es_super_admin_activo()

  or public.es_admin_de_comercio(p_comercio_id)

) then raise exception 'No tenés permisos para asignar empleados.' using errcode = '42501';

end if;

if p_user_id = auth.uid() then raise exception 'Un Admin no puede modificar su propio rol.' using errcode = '42501';

end if;

if not exists (

  select

    1

  from

    auth.users

  where

    id = p_user_id

) then raise exception 'El usuario objetivo no existe.' using errcode = 'P0002';

end if;

if not exists (

  select

    1

  from

    public.comercios

  where

    id = p_comercio_id

    and activo = true

) then raise exception 'El comercio no existe o está inactivo.' using errcode = 'P0002';

end if;

if not public.auditoria_iniciar_operacion(

  p_operacion_id,

  p_comercio_id,

  'admin_comercio',

  p_user_id

) then return true;

end if;

select

  jsonb_build_object(

    'user_id',

    user_id,

    'comercio_id',

    comercio_id,

    'rol',

    rol,

    'activo',

    activo

  ) into v_anterior

from

  public.admin_comercios

where

  user_id = p_user_id

  and comercio_id = p_comercio_id for

update

;

if v_anterior is not null then raise exception 'El usuario ya está asignado al comercio.' using errcode = '23505';

end if;

insert into

  public.admin_comercios (

    user_id,

    comercio_id,

    rol,

    activo

  )

values

  (

    p_user_id,

    p_comercio_id,

    'empleado',

    true

  );

perform public.auditoria_finalizar_operacion(

  p_operacion_id,

  1,

  p_comercio_id,

  'asignar',

  'admin_comercio',

  p_user_id,

  null,

  jsonb_build_object(

    'user_id',

    p_user_id,

    'comercio_id',

    p_comercio_id,

    'rol',

    'empleado',

    'activo',

    true

  )

);

return true;

end;

$$;

create

or replace function public.admin_cambiar_estado_empleado_auditado(

  p_operacion_id uuid,

  p_comercio_id uuid,

  p_user_id uuid,

  p_activo boolean

) returns boolean language plpgsql security definer

set

  search_path = pg_catalog,

  public,

  auth as $$ declare v_anterior jsonb;

begin if not (

  public.es_super_admin_activo()

  or public.es_admin_de_comercio(p_comercio_id)

) then raise exception 'No tenés permisos para administrar empleados.' using errcode = '42501';

end if;

if p_user_id = auth.uid() then raise exception 'Un Admin no puede cambiar su propio acceso.' using errcode = '42501';

end if;

if not public.auditoria_iniciar_operacion(

  p_operacion_id,

  p_comercio_id,

  'admin_comercio',

  p_user_id

) then return true;

end if;

select

  jsonb_build_object(

    'user_id',

    user_id,

    'comercio_id',

    comercio_id,

    'rol',

    rol,

    'activo',

    activo

  ) into v_anterior

from

  public.admin_comercios

where

  user_id = p_user_id

  and comercio_id = p_comercio_id

  and rol = 'empleado' for

update

;

if v_anterior is null then raise exception 'El Empleado no existe en este comercio.' using errcode = 'P0002';

end if;

update

  public.admin_comercios

set

  activo = p_activo

where

  user_id = p_user_id

  and comercio_id = p_comercio_id

  and rol = 'empleado';

perform public.auditoria_finalizar_operacion(

  p_operacion_id,

  1,

  p_comercio_id,

  'cambiar_estado',

  'admin_comercio',

  p_user_id,

  v_anterior,

  jsonb_build_object(

    'user_id',

    p_user_id,

    'comercio_id',

    p_comercio_id,

    'rol',

    'empleado',

    'activo',

    p_activo

  )

);

return true;

end;

$$;

-- 5. Invitación de Empleados mediante la outbox existente.

-- Auth Admin API continúa ejecutándose sólo desde el servidor.

create

or replace function public.admin_iniciar_invitacion_empleado_auditada(

  p_operacion_id uuid,

  p_comercio_id uuid,

  p_email text

) returns uuid language plpgsql security definer

set

  search_path = pg_catalog,

  public,

  auth as $$ declare v_actor uuid := auth.uid();

v_email text := lower(trim(p_email));

v_invitacion public.auditoria_invitaciones_admin % rowtype;

begin if not (

  public.es_super_admin_activo()

  or public.es_admin_de_comercio(p_comercio_id)

) then raise exception 'No tenés permisos para invitar empleados.' using errcode = '42501';

end if;

if p_operacion_id is null

or p_comercio_id is null

or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'

or length(v_email) > 320 then raise exception 'Los datos de la invitación no son válidos.' using errcode = '22023';

end if;

if not exists (

  select

    1

  from

    public.comercios

  where

    id = p_comercio_id

    and activo = true

) then raise exception 'El comercio no existe o está inactivo.' using errcode = 'P0002';

end if;

perform pg_advisory_xact_lock(

  hashtextextended(p_operacion_id :: text, 0)

);

select

  * into v_invitacion

from

  public.auditoria_invitaciones_admin

where

  operacion_id = p_operacion_id for

update

;

if v_invitacion.id is not null then if v_invitacion.actor_user_id <> v_actor

or v_invitacion.comercio_id <> p_comercio_id

or v_invitacion.email_normalizado <> v_email

or v_invitacion.rol <> 'empleado' then raise exception 'La operación pertenece a otra invitación.' using errcode = '42501';

end if;

if v_invitacion.estado <> 'iniciada' then raise exception 'La invitación ya fue finalizada.' using errcode = '40001';

end if;

return v_invitacion.id;

end if;

insert into

  public.auditoria_invitaciones_admin (

    operacion_id,

    comercio_id,

    actor_user_id,

    email_normalizado,

    rol

  )

values

  (

    p_operacion_id,

    p_comercio_id,

    v_actor,

    v_email,

    'empleado'

  ) returning * into v_invitacion;

perform public.auditoria_registrar_evento_interno(

  p_operacion_id,

  1 :: smallint,

  p_comercio_id,

  'invitacion_iniciada',

  'admin_invitacion',

  p_operacion_id,

  null,

  jsonb_build_object(

    'email',

    v_email,

    'rol',

    'empleado',

    'estado',

    'iniciada'

  )

);

return v_invitacion.id;

end;

$$;

create

or replace function public.admin_completar_invitacion_empleado_auditada(

  p_operacion_id uuid,

  p_user_id uuid

) returns boolean language plpgsql security definer

set

  search_path = pg_catalog,

  public,

  auth as $$ declare v_invitacion public.auditoria_invitaciones_admin % rowtype;

begin

select

  * into v_invitacion

from

  public.auditoria_invitaciones_admin

where

  operacion_id = p_operacion_id for

update

;

if v_invitacion.id is null

or v_invitacion.actor_user_id <> auth.uid()

or v_invitacion.rol <> 'empleado' then raise exception 'La invitación no existe o no pertenece al actor.' using errcode = '42501';

end if;

if not (

  public.es_super_admin_activo()

  or public.es_admin_de_comercio(v_invitacion.comercio_id)

) then raise exception 'No tenés permisos para completar la invitación.' using errcode = '42501';

end if;

if v_invitacion.estado = 'completada' then return true;

end if;

if v_invitacion.estado <> 'iniciada'

or p_user_id is null then raise exception 'La invitación no puede completarse.' using errcode = '40001';

end if;

if not exists (

  select

    1

  from

    auth.users

  where

    id = p_user_id

) then raise exception 'El usuario de Auth no existe.' using errcode = 'P0002';

end if;

-- El usuario de Auth debe ser exactamente el correo invitado. Sin esta

-- comprobación, un p_user_id equivocado asignaría el rol a otra persona

-- reutilizando una invitación legítima.

if not exists (

  select

    1

  from

    auth.users u

  where

    u.id = p_user_id

    and lower(trim(u.email)) = v_invitacion.email_normalizado

) then raise exception 'El usuario de Auth no corresponde al correo invitado.' using errcode = '42501';

end if;

if p_user_id = auth.uid() then raise exception 'Un Admin no puede modificar su propio rol.' using errcode = '42501';

end if;

insert into

  public.admin_comercios (

    user_id,

    comercio_id,

    rol,

    activo

  )

values

  (

    p_user_id,

    v_invitacion.comercio_id,

    'empleado',

    true

  );

update

  public.auditoria_invitaciones_admin

set

  usuario_auth_id = p_user_id,

  estado = 'completada',

  actualizada_en = now()

where

  id = v_invitacion.id;

perform public.auditoria_registrar_evento_interno(

  p_operacion_id,

  2 :: smallint,

  v_invitacion.comercio_id,

  'asignar',

  'admin_comercio',

  p_user_id,

  null,

  jsonb_build_object(

    'user_id',

    p_user_id,

    'comercio_id',

    v_invitacion.comercio_id,

    'rol',

    'empleado',

    'activo',

    true

  )

);

return true;

end;

$$;

create

or replace function public.admin_marcar_invitacion_empleado_fallida(

  p_operacion_id uuid,

  p_motivo text,

  p_user_id uuid default null

) returns boolean language plpgsql security definer

set

  search_path = pg_catalog,

  public,

  auth as $$ declare v_invitacion public.auditoria_invitaciones_admin % rowtype;

v_motivo text := coalesce(nullif(trim(p_motivo), ''), 'error_externo');

begin

select

  * into v_invitacion

from

  public.auditoria_invitaciones_admin

where

  operacion_id = p_operacion_id for

update

;

if v_invitacion.id is null

or v_invitacion.actor_user_id <> auth.uid()

or v_invitacion.rol <> 'empleado' then raise exception 'La invitación no existe o no pertenece al actor.' using errcode = '42501';

end if;

if not (

  public.es_super_admin_activo()

  or public.es_admin_de_comercio(v_invitacion.comercio_id)

) then raise exception 'No tenés permisos para cerrar la invitación.' using errcode = '42501';

end if;

if v_motivo not in (

  'error_externo',

  'usuario_ya_existia',

  'asignacion_fallida',

  'correo_invalido',

  'reintento_manual'

) then raise exception 'Motivo de fallo no permitido.' using errcode = '22023';

end if;

if v_invitacion.estado = 'fallida' then return true;

end if;

if v_invitacion.estado <> 'iniciada' then raise exception 'La invitación ya fue completada.' using errcode = '40001';

end if;

update

  public.auditoria_invitaciones_admin

set

  estado = 'fallida',

  usuario_auth_id = p_user_id,

  motivo_fallo = v_motivo,

  actualizada_en = now()

where

  id = v_invitacion.id;

perform public.auditoria_registrar_evento_interno(

  p_operacion_id,

  2 :: smallint,

  v_invitacion.comercio_id,

  'invitacion_fallida',

  'admin_invitacion',

  p_operacion_id,

  jsonb_build_object(

    'rol',

    'empleado',

    'estado',

    'iniciada'

  ),

  jsonb_strip_nulls(

    jsonb_build_object(

      'rol',

      'empleado',

      'estado',

      'fallida',

      'motivo',

      v_motivo,

      'usuario_auth_id',

      p_user_id

    )

  )

);

return true;

end;

$$;

-- 6. Estados de pedido: el Empleado avanza el flujo operativo pero no

-- cancela. Admin y Super Admin conservan exactamente las transiciones

-- vigentes. La redefinición respeta la firma y el comportamiento previos.

create

or replace function public.admin_actualizar_estado_pedido_auditado(

  p_operacion_id uuid,

  p_comercio_id uuid,

  p_pedido_id uuid,

  p_estado_esperado text,

  p_nuevo_estado text

) returns boolean language plpgsql security definer

set

  search_path = pg_catalog,

  public,

  auth as $$ declare v_anterior jsonb;

v_continuar boolean;

v_es_empleado boolean;

begin if p_estado_esperado is null

or p_nuevo_estado is null

or p_estado_esperado not in (

  'pendiente',

  'confirmado',

  'en_preparacion',

  'listo',

  'entregado',

  'cancelado'

)

or p_nuevo_estado not in (

  'pendiente',

  'confirmado',

  'en_preparacion',

  'listo',

  'entregado',

  'cancelado'

) then raise exception 'Estado de pedido inválido.' using errcode = '22023';

end if;

if not (

  (

    p_estado_esperado = 'pendiente'

    and p_nuevo_estado in ('en_preparacion', 'cancelado')

  )

  or (

    p_estado_esperado = 'confirmado'

    and p_nuevo_estado in ('listo', 'cancelado')

  )

  or (

    p_estado_esperado = 'en_preparacion'

    and p_nuevo_estado = 'listo'

  )

  or (

    p_estado_esperado = 'listo'

    and p_nuevo_estado = 'entregado'

  )

) then raise exception 'La transición de estado no está permitida.' using errcode = '40001';

end if;

-- Un Empleado puro (sin Super Admin ni rol admin en el comercio) sólo

-- avanza el flujo: recibir, preparar, marcar listo y entregar.

v_es_empleado := public.es_empleado_de_comercio(p_comercio_id)

and not public.es_super_admin_activo()

and not public.es_admin_de_comercio(p_comercio_id);

if v_es_empleado

and p_nuevo_estado = 'cancelado' then raise exception 'Un Empleado no puede cancelar pedidos.' using errcode = '42501';

end if;

v_continuar := public.auditoria_iniciar_operacion(

  p_operacion_id,

  p_comercio_id,

  'pedido',

  p_pedido_id

);

if not v_continuar then return true;

end if;

select

  jsonb_build_object('estado', estado) into v_anterior

from

  public.pedidos

where

  id = p_pedido_id

  and comercio_id = p_comercio_id

  and estado = p_estado_esperado for

update

;

if v_anterior is null then raise exception 'El pedido no existe o cambió de estado.' using errcode = '40001';

end if;

update

  public.pedidos

set

  estado = p_nuevo_estado,

  actualizado_en = now()

where

  id = p_pedido_id

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

  jsonb_build_object('estado', p_nuevo_estado)

);

return true;

end;

$$;

-- 7. Super Admin mantiene su gestión global. La función existente de

-- asignación acepta ambos roles; un Admin común usa las RPC específicas

-- de Empleados definidas arriba.

create

or replace function public.super_admin_asignar_administrador_auditado(

  p_operacion_id uuid,

  p_comercio_id uuid,

  p_user_id uuid,

  p_rol text default 'admin'

) returns boolean language plpgsql security definer

set

  search_path = pg_catalog,

  public,

  auth as $$ declare v_anterior jsonb;

begin if not public.es_super_admin_activo() then raise exception 'Solo un Super Admin activo puede administrar permisos.' using errcode = '42501';

end if;

if p_rol is null

or p_rol not in ('owner', 'admin', 'operador', 'empleado') then raise exception 'El rol solicitado no es válido.' using errcode = '22023';

end if;

if not exists (

  select

    1

  from

    auth.users

  where

    id = p_user_id

) then raise exception 'El usuario objetivo no existe.' using errcode = 'P0002';

end if;

if not exists (

  select

    1

  from

    public.comercios

  where

    id = p_comercio_id

    and activo = true

) then raise exception 'El comercio no existe o está inactivo.' using errcode = 'P0002';

end if;

if not public.auditoria_iniciar_operacion(

  p_operacion_id,

  p_comercio_id,

  'admin_comercio',

  p_user_id

) then return true;

end if;

select

  jsonb_build_object(

    'user_id',

    user_id,

    'comercio_id',

    comercio_id,

    'rol',

    rol,

    'activo',

    activo

  ) into v_anterior

from

  public.admin_comercios

where

  user_id = p_user_id

  and comercio_id = p_comercio_id for

update

;

if v_anterior is not null then raise exception 'El usuario ya está asignado al comercio.' using errcode = '23505';

end if;

insert into

  public.admin_comercios (

    user_id,

    comercio_id,

    rol,

    activo

  )

values

  (

    p_user_id,

    p_comercio_id,

    p_rol,

    true

  );

perform public.auditoria_finalizar_operacion(

  p_operacion_id,

  1,

  p_comercio_id,

  'asignar',

  'admin_comercio',

  p_user_id,

  null,

  jsonb_build_object(

    'user_id',

    p_user_id,

    'comercio_id',

    p_comercio_id,

    'rol',

    p_rol,

    'activo',

    true

  )

);

return true;

end;

$$;

create

or replace function public.super_admin_cambiar_estado_administrador_auditado(

  p_operacion_id uuid,

  p_comercio_id uuid,

  p_user_id uuid,

  p_activo boolean

) returns boolean language plpgsql security definer

set

  search_path = pg_catalog,

  public,

  auth as $$ declare v_anterior jsonb;

v_rol text;

begin if not public.es_super_admin_activo() then raise exception 'Solo un Super Admin activo puede administrar permisos.' using errcode = '42501';

end if;

if not public.auditoria_iniciar_operacion(

  p_operacion_id,

  p_comercio_id,

  'admin_comercio',

  p_user_id

) then return true;

end if;

select

  jsonb_build_object(

    'user_id',

    user_id,

    'comercio_id',

    comercio_id,

    'rol',

    rol,

    'activo',

    activo

  ),

  rol into v_anterior,

  v_rol

from

  public.admin_comercios

where

  user_id = p_user_id

  and comercio_id = p_comercio_id for

update

;

if v_anterior is null then raise exception 'La asignación administrativa no existe.' using errcode = 'P0002';

end if;

update

  public.admin_comercios

set

  activo = p_activo

where

  user_id = p_user_id

  and comercio_id = p_comercio_id;

perform public.auditoria_finalizar_operacion(

  p_operacion_id,

  1,

  p_comercio_id,

  'cambiar_estado',

  'admin_comercio',

  p_user_id,

  v_anterior,

  jsonb_build_object(

    'user_id',

    p_user_id,

    'comercio_id',

    p_comercio_id,

    'rol',

    v_rol,

    'activo',

    p_activo

  )

);

return true;

end;

$$;

-- La invitación global del Super Admin tenía el mismo hueco que la de

-- Empleados: aceptaba cualquier p_user_id existente en Auth, de modo que un

-- UUID equivocado asignaba el rol a otra persona reutilizando una invitación

-- legítima. Se redefine conservando firma y comportamiento, sumando la

-- verificación de correspondencia con el correo invitado y respetando el rol

-- registrado en la outbox.

create

or replace function public.super_admin_completar_invitacion_auditada(

  p_operacion_id uuid,

  p_user_id uuid

) returns boolean language plpgsql security definer

set

  search_path = pg_catalog,

  public,

  auth as $$ declare v_invitacion public.auditoria_invitaciones_admin % rowtype;

v_rol text;

begin if not exists (

  select

    1

  from

    public.super_admins

  where

    user_id = auth.uid()

    and activo = true

) then raise exception 'Solo un Super Admin activo puede completar invitaciones.' using errcode = '42501';

end if;

select

  * into v_invitacion

from

  public.auditoria_invitaciones_admin

where

  operacion_id = p_operacion_id for

update

;

if v_invitacion.id is null

or v_invitacion.actor_user_id <> auth.uid() then raise exception 'La invitación no existe o no pertenece al actor.' using errcode = '42501';

end if;

if v_invitacion.estado = 'completada' then return true;

end if;

if v_invitacion.estado <> 'iniciada'

or p_user_id is null then raise exception 'La invitación no puede completarse.' using errcode = '40001';

end if;

if not exists (

  select

    1

  from

    auth.users

  where

    id = p_user_id

) then raise exception 'El usuario de Auth no existe.' using errcode = 'P0002';

end if;

-- El usuario de Auth debe ser exactamente el correo invitado.

if not exists (

  select

    1

  from

    auth.users u

  where

    u.id = p_user_id

    and lower(trim(u.email)) = v_invitacion.email_normalizado

) then raise exception 'El usuario de Auth no corresponde al correo invitado.' using errcode = '42501';

end if;

-- La outbox ya guarda el rol (default 'admin' para filas anteriores). El

-- coalesce es defensivo: si la columna faltara, se preserva el

-- comportamiento original de esta RPC.

v_rol := coalesce(v_invitacion.rol, 'admin');

insert into

  public.admin_comercios (user_id, comercio_id, rol, activo)

values

  (p_user_id, v_invitacion.comercio_id, v_rol, true);

update

  public.auditoria_invitaciones_admin

set

  usuario_auth_id = p_user_id,

  estado = 'completada',

  actualizada_en = now()

where

  id = v_invitacion.id;

perform public.auditoria_registrar_evento_interno(

  p_operacion_id,

  2 :: smallint,

  v_invitacion.comercio_id,

  'asignar',

  'admin_comercio',

  p_user_id,

  null,

  jsonb_build_object(

    'user_id',

    p_user_id,

    'comercio_id',

    v_invitacion.comercio_id,

    'rol',

    v_rol,

    'activo',

    true

  )

);

return true;

end;

$$;

-- 8. Permisos explícitos. Los helpers internos no quedan invocables

-- directamente por clientes, salvo los tres predicados de autorización.

revoke all on function public.es_admin_de_comercio(uuid)

from

  public,

  anon,

  service_role;

revoke all on function public.es_empleado_de_comercio(uuid)

from

  public,

  anon,

  service_role;

revoke all on function public.es_personal_de_comercio(uuid)

from

  public,

  anon,

  service_role;

-- La RPC de estado de pedidos conserva sus permisos actuales: la invoca el

-- cliente de sesión de Admin, Super Admin y ahora también de Empleado.

grant execute on function public.admin_actualizar_estado_pedido_auditado(uuid, uuid, uuid, text, text) to authenticated;

revoke all on function public.admin_actualizar_estado_pedido_auditado(uuid, uuid, uuid, text, text)

from

  public,

  anon,

  service_role;

grant execute on function public.es_admin_de_comercio(uuid) to authenticated;

grant execute on function public.es_empleado_de_comercio(uuid) to authenticated;

grant execute on function public.es_personal_de_comercio(uuid) to authenticated;

-- Reafirma el aislamiento de los helpers de auditoría (ya revocados en la

-- etapa 1). Sólo las funciones SECURITY DEFINER propietarias los invocan.

revoke all on function public.auditoria_actor_autorizado(uuid)

from

  public,

  anon,

  authenticated,

  service_role;

revoke all on function public.auditoria_iniciar_operacion(uuid, uuid, text, uuid)

from

  public,

  anon,

  authenticated,

  service_role;

grant execute on function public.admin_asignar_empleado_auditado(uuid, uuid, uuid) to authenticated;

grant execute on function public.admin_cambiar_estado_empleado_auditado(uuid, uuid, uuid, boolean) to authenticated;

grant execute on function public.admin_iniciar_invitacion_empleado_auditada(uuid, uuid, text) to authenticated;

grant execute on function public.admin_completar_invitacion_empleado_auditada(uuid, uuid) to authenticated;

grant execute on function public.admin_marcar_invitacion_empleado_fallida(uuid, text, uuid) to authenticated;

revoke all on function public.admin_asignar_empleado_auditado(uuid, uuid, uuid)

from

  public,

  anon,

  service_role;

revoke all on function public.admin_cambiar_estado_empleado_auditado(uuid, uuid, uuid, boolean)

from

  public,

  anon,

  service_role;

revoke all on function public.admin_iniciar_invitacion_empleado_auditada(uuid, uuid, text)

from

  public,

  anon,

  service_role;

revoke all on function public.admin_completar_invitacion_empleado_auditada(uuid, uuid)

from

  public,

  anon,

  service_role;

revoke all on function public.admin_marcar_invitacion_empleado_fallida(uuid, text, uuid)

from

  public,

  anon,

  service_role;

grant execute on function public.super_admin_asignar_administrador_auditado(uuid, uuid, uuid, text) to authenticated;

grant execute on function public.super_admin_cambiar_estado_administrador_auditado(uuid, uuid, uuid, boolean) to authenticated;

revoke all on function public.super_admin_asignar_administrador_auditado(uuid, uuid, uuid, text)

from

  public,

  anon,

  service_role;

revoke all on function public.super_admin_cambiar_estado_administrador_auditado(uuid, uuid, uuid, boolean)

from

  public,

  anon,

  service_role;

grant execute on function public.super_admin_completar_invitacion_auditada(uuid, uuid) to authenticated;

revoke all on function public.super_admin_completar_invitacion_auditada(uuid, uuid)

from

  public,

  anon,

  service_role;

-- 9. Verificación de sobrecargas. CREATE OR REPLACE no puede cambiar tipos

-- de parámetros: si existiera una versión anterior con otra firma quedaría

-- una sobrecarga y PostgREST elegiría una función impredecible.

do $$ declare v_duplicadas text;

begin

select

  string_agg(

    format('%s (%s sobrecargas)', nombre, total),

    ', '

  ) into v_duplicadas

from

  (

    select

      p.proname as nombre,

      count(*) as total

    from

      pg_proc p

      join pg_namespace n on n.oid = p.pronamespace

    where

      n.nspname = 'public'

      and p.proname in (

        'es_admin_de_comercio',

        'es_empleado_de_comercio',

        'es_personal_de_comercio',

        'auditoria_iniciar_operacion',

        'admin_actualizar_estado_pedido_auditado',

        'admin_asignar_empleado_auditado',

        'admin_cambiar_estado_empleado_auditado',

        'admin_iniciar_invitacion_empleado_auditada',

        'admin_completar_invitacion_empleado_auditada',

        'admin_marcar_invitacion_empleado_fallida',

        'super_admin_asignar_administrador_auditado',

        'super_admin_cambiar_estado_administrador_auditado',

        'super_admin_completar_invitacion_auditada'

      )

    group by

      p.proname

    having

      count(*) > 1

  ) duplicadas;

if v_duplicadas is not null then raise exception 'Quedaron sobrecargas de funciones auditadas: %. Eliminá la firma antigua con DROP FUNCTION antes de reejecutar.',

v_duplicadas;

end if;

-- La política de pedidos debe ser exactamente una.

if (

  select

    count(*)

  from

    pg_policies

  where

    schemaname = 'public'

    and tablename = 'pedidos'

) <> 1 then raise exception 'La tabla pedidos no quedó con una única política RLS.';

end if;

end $$;

commit;

-- Verificación posterior sugerida:

-- 1) Revisar roles:

--    select rol, count(*) from public.admin_comercios group by rol;

-- 2) Revisar que exista una única política de lectura:

--    select policyname, cmd, roles, qual

--    from pg_policies

--    where schemaname = 'public' and tablename = 'pedidos';

-- 3) Revisar que no haya sobrecargas de las RPC auditadas:

--    select p.proname, count(*)

--    from pg_proc p

--    join pg_namespace n on n.oid = p.pronamespace

--    where n.nspname = 'public' and p.proname like '%auditad%'

--    group by p.proname having count(*) > 1;

-- 4) Confirmar que las escrituras de pedidos de authenticated quedaron

--    revocadas:

--    select privilege_type

--    from information_schema.role_table_grants

--    where table_name = 'pedidos' and grantee = 'authenticated';

-- 5) No ejecutar RPC de escritura con service_role: deben recibir auth.uid().
