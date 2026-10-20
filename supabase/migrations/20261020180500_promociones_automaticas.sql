-- PIA-4, etapa 1: modelo y administración; no aplica descuentos a pedidos.
-- Requiere la cadena hasta PIA-3. Preparada para revisión, sin aplicar.
begin;

create table public.promociones (
  id uuid primary key default gen_random_uuid(),
  comercio_id uuid not null references public.comercios(id) on delete restrict,
  clave text not null default 'descuento_web',
  nombre text not null default 'Descuento web',
  activa boolean not null default false,
  tipo_descuento text not null default 'porcentaje',
  valor numeric not null default 0,
  aplicacion text not null default 'automatica',
  alcance text not null default 'tienda',
  canal text not null default 'web',
  codigo text,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  constraint promociones_comercio_clave_key unique (comercio_id, clave),
  constraint promociones_nombre_check check (length(btrim(nombre)) between 1 and 120),
  constraint promociones_valor_check check (
    valor between 0 and 100 and valor = trunc(valor)
  ),
  constraint promociones_contrato_check check (
    clave = 'descuento_web' and tipo_descuento = 'porcentaje'
    and aplicacion = 'automatica' and alcance = 'tienda'
    and canal = 'web' and codigo is null
  )
);

comment on table public.promociones is
  'Promoción automática web por comercio. PIA-4 etapa 1 no calcula ni aplica descuentos; PIA-9 ampliará los tipos y alcances mediante migraciones nuevas.';
comment on column public.promociones.valor is
  'Porcentaje entero de 0 a 100 inclusive. Numeric sin escala evita redondear fracciones antes del check.';

alter table public.promociones owner to postgres;
alter table public.promociones enable row level security;
-- Sin acceso directo, incluso a columnas administrativas: solo las RPC de abajo.
revoke all on table public.promociones from public, anon, authenticated, service_role;

create trigger promociones_actualizado_en
before update on public.promociones
for each row execute function public.clientes_actualizar_actualizado_en();

create function public.inicializar_descuento_web_comercio()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
begin
  insert into public.promociones (comercio_id)
  values (new.id)
  on conflict (comercio_id, clave) do nothing;
  return new;
end;
$function$;
alter function public.inicializar_descuento_web_comercio() owner to postgres;
revoke all on function public.inicializar_descuento_web_comercio()
  from public, anon, authenticated, service_role;

create trigger comercios_inicializar_descuento_web
after insert on public.comercios
for each row execute function public.inicializar_descuento_web_comercio();

insert into public.promociones (comercio_id)
select id from public.comercios
on conflict (comercio_id, clave) do nothing;

-- Proyección pública mínima: una fila activa o ninguna, nunca metadatos de gestión.
create function public.obtener_descuento_web(p_comercio_id uuid)
returns table (nombre text, valor numeric)
language sql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $function$
  select p.nombre, p.valor
  from public.promociones p
  join public.comercios c on c.id = p.comercio_id
  where p.comercio_id = p_comercio_id and c.activo = true
    and p.clave = 'descuento_web' and p.activa = true
    and p.tipo_descuento = 'porcentaje' and p.aplicacion = 'automatica'
    and p.alcance = 'tienda' and p.canal = 'web' and p.codigo is null;
$function$;
alter function public.obtener_descuento_web(uuid) owner to postgres;
revoke all on function public.obtener_descuento_web(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.obtener_descuento_web(uuid)
  to anon, authenticated, service_role;

-- Solo se agrega la entidad nueva; el resto del contrato de auditoría se conserva.
alter table public.auditoria_eventos drop constraint auditoria_eventos_entidad_check;
alter table public.auditoria_eventos add constraint auditoria_eventos_entidad_check check (
  entidad in ('categoria', 'producto', 'variante', 'pedido', 'admin_comercio',
              'admin_invitacion', 'horario', 'comercio_configuracion', 'promocion')
);

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
      'comercio_configuracion',
      'promocion'
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

create function public.admin_obtener_descuento_web(p_comercio_id uuid)
returns public.promociones
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'public', 'auth'
as $function$
declare
  v_fila public.promociones;
begin
  if p_comercio_id is null then
    raise exception 'Falta el comercio.' using errcode = '22023';
  end if;
  if auth.uid() is null or not coalesce(
    public.es_super_admin_activo() or public.es_admin_de_comercio(p_comercio_id), false
  ) then
    raise exception 'No tenés permisos para consultar el descuento web.' using errcode = '42501';
  end if;

  select * into v_fila from public.promociones
  where comercio_id = p_comercio_id and clave = 'descuento_web';
  if not found then
    raise exception 'El comercio no tiene configurado el descuento web.' using errcode = 'P0002';
  end if;
  return v_fila;
end;
$function$;
alter function public.admin_obtener_descuento_web(uuid) owner to postgres;
revoke all on function public.admin_obtener_descuento_web(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.admin_obtener_descuento_web(uuid) to authenticated;

create function public.admin_actualizar_descuento_web(
  p_operacion_id uuid,
  p_comercio_id uuid,
  p_cambios jsonb
)
returns public.promociones
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'auth'
as $function$
declare
  v_fila public.promociones;
  v_anterior jsonb;
  v_nuevo jsonb;
  v_continuar boolean;
  v_clave text;
begin
  if p_operacion_id is null or p_comercio_id is null then
    raise exception 'Faltan datos para actualizar el descuento web.' using errcode = '22023';
  end if;
  if auth.uid() is null or not coalesce(
    public.es_super_admin_activo() or public.es_admin_de_comercio(p_comercio_id), false
  ) then
    raise exception 'No tenés permisos para modificar el descuento web.' using errcode = '42501';
  end if;
  if p_cambios is null or jsonb_typeof(p_cambios) <> 'object' or p_cambios = '{}'::jsonb then
    raise exception 'No hay cambios de promoción para aplicar.' using errcode = '22023';
  end if;
  for v_clave in select jsonb_object_keys(p_cambios) loop
    if v_clave not in ('activa', 'valor') then
      raise exception 'Clave de promoción no permitida: %', v_clave using errcode = '22023';
    end if;
  end loop;
  if p_cambios ? 'activa' and jsonb_typeof(p_cambios->'activa') <> 'boolean' then
    raise exception 'El estado activo debe ser verdadero o falso.' using errcode = '22023';
  end if;
  if p_cambios ? 'valor' then
    if jsonb_typeof(p_cambios->'valor') <> 'number' then
      raise exception 'El porcentaje debe ser un número entero de 0 a 100.' using errcode = '22023';
    end if;
    if (p_cambios->>'valor')::numeric not between 0 and 100
      or (p_cambios->>'valor')::numeric <> trunc((p_cambios->>'valor')::numeric) then
      raise exception 'El porcentaje debe ser un número entero de 0 a 100.' using errcode = '22023';
    end if;
  end if;

  -- La identidad no se cambia desde la API. Se obtiene antes del bloqueo de operación.
  select * into v_fila from public.promociones
  where comercio_id = p_comercio_id and clave = 'descuento_web';
  if not found then
    raise exception 'El comercio no tiene configurado el descuento web.' using errcode = 'P0002';
  end if;
  v_continuar := public.auditoria_iniciar_operacion(
    p_operacion_id, p_comercio_id, 'promocion', v_fila.id
  );

  select * into strict v_fila from public.promociones
  where comercio_id = p_comercio_id and clave = 'descuento_web'
  for update;
  if not v_continuar then
    -- Un identificador repetido nunca puede aplicar un segundo cambio distinto.
    if not exists (
      select 1 from public.auditoria_eventos
      where operacion_id = p_operacion_id and comercio_id = p_comercio_id
        and entidad = 'promocion' and registro_id = v_fila.id
        and valores_nuevos @> p_cambios
    ) then
      raise exception 'La operación ya se registró con otros cambios.' using errcode = '22023';
    end if;
    return v_fila;
  end if;

  v_anterior := to_jsonb(v_fila);
  update public.promociones set
    activa = case when p_cambios ? 'activa' then (p_cambios->>'activa')::boolean else activa end,
    valor = case when p_cambios ? 'valor' then (p_cambios->>'valor')::numeric else valor end
  where comercio_id = p_comercio_id and clave = 'descuento_web' and id = v_fila.id
  returning * into v_fila;
  v_nuevo := to_jsonb(v_fila);

  perform public.auditoria_finalizar_operacion(
    p_operacion_id, 1, p_comercio_id, 'actualizar', 'promocion',
    v_fila.id, v_anterior, v_nuevo
  );
  return v_fila;
end;
$function$;
alter function public.admin_actualizar_descuento_web(uuid, uuid, jsonb) owner to postgres;
revoke all on function public.admin_actualizar_descuento_web(uuid, uuid, jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.admin_actualizar_descuento_web(uuid, uuid, jsonb)
  to authenticated;

commit;
