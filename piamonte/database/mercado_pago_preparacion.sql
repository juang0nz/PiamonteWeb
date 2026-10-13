-- Preparación de Mercado Pago Checkout Pro.
-- REVISAR antes de ejecutar en Supabase → SQL Editor.
-- No contiene credenciales, no habilita el checkout y no aprueba pagos por sí sola.

begin;

-- El proyecto ya posee public.pagos. La migración falla explícitamente si no existe,
-- porque crear otra tabla ocultaría una diferencia de esquema que debe revisarse.
do $$
begin
  if to_regclass('public.pagos') is null then
    raise exception 'Falta la tabla public.pagos existente.';
  end if;
end
$$;

-- Estados de pago permitidos en el pedido y en cada intento.
alter table public.pedidos
  add column if not exists estado_pago text not null default 'pendiente';

alter table public.pedidos
  drop constraint if exists pedidos_estado_pago_check;
alter table public.pedidos
  add constraint pedidos_estado_pago_check
  check (estado_pago in ('pendiente', 'aprobado', 'rechazado'));

alter table public.pagos
  drop constraint if exists pagos_estado_check;
alter table public.pagos
  add constraint pagos_estado_check
  check (estado in ('pendiente', 'aprobado', 'rechazado'));

-- Datos mínimos devueltos por Checkout Pro. El intento ya se identifica con pagos.id;
-- ese UUID se usa además como external_reference y clave de idempotencia.
alter table public.pagos
  add column if not exists preferencia_id text,
  add column if not exists url_checkout text,
  add column if not exists preferencia_reservada_en timestamptz,
  add column if not exists pago_externo_id text;

create unique index if not exists pagos_proveedor_referencia_uidx
  on public.pagos (proveedor, referencia_externa)
  where referencia_externa is not null;

create unique index if not exists pagos_proveedor_pago_externo_uidx
  on public.pagos (proveedor, pago_externo_id)
  where pago_externo_id is not null;

create unique index if not exists pagos_preferencia_uidx
  on public.pagos (preferencia_id)
  where preferencia_id is not null;

-- Registro de eventos ya procesados. La unicidad evita procesar dos veces el mismo
-- webhook incluso si Mercado Pago lo reintenta o llegan solicitudes concurrentes.
create table if not exists public.pagos_notificaciones (
  id uuid primary key default gen_random_uuid(),
  pago_id uuid not null references public.pagos(id) on delete cascade,
  proveedor text not null,
  evento_id text not null,
  pago_externo_id text not null,
  recibido_en timestamptz not null default now(),
  constraint pagos_notificaciones_evento_unique
    unique (proveedor, evento_id)
);

-- Ningún navegador puede crear intentos ni modificar estados de pago.
-- Los endpoints usan exclusivamente la clave privada del servidor.
alter table public.pagos enable row level security;
alter table public.pagos_notificaciones enable row level security;

revoke all on table public.pagos from anon, authenticated;
revoke all on table public.pagos_notificaciones from anon, authenticated;
revoke update on table public.pedidos from anon, authenticated;

grant select, insert, update on table public.pagos to service_role;
grant select, insert on table public.pagos_notificaciones to service_role;
grant select, update on table public.pedidos to service_role;

-- El pedido y el intento de Mercado Pago se crean en la misma transacción.
-- Para efectivo, pago_id se devuelve en null y no se inserta ningún intento remoto.
drop function if exists public.registrar_pedido_desde_checkout(
  uuid, text, text, text, text, text, text, text, text, numeric, jsonb
);

create function public.registrar_pedido_desde_checkout(
  p_comercio_id uuid,
  p_modalidad_entrega text,
  p_cliente_nombre text,
  p_cliente_telefono text,
  p_direccion_calle text,
  p_direccion_numero text,
  p_direccion_apartamento text,
  p_direccion_referencias text,
  p_metodo_pago text,
  p_subtotal numeric,
  p_items jsonb
)
returns table(pedido_id uuid, pago_id uuid)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_pedido_id uuid;
  v_pago_id uuid;
  v_item jsonb;
  v_opcion jsonb;
  v_item_id uuid;
begin
  if p_modalidad_entrega not in ('delivery', 'retiro') then
    raise exception 'Modalidad de entrega inválida';
  end if;
  if p_metodo_pago not in ('efectivo', 'mercado_pago') then
    raise exception 'Método de pago inválido';
  end if;
  if p_subtotal <= 0 then
    raise exception 'El subtotal debe ser mayor a cero';
  end if;

  insert into public.pedidos (
    comercio_id,
    estado,
    estado_pago,
    modalidad,
    cliente_nombre,
    cliente_telefono,
    direccion_calle,
    direccion_numero,
    direccion_apartamento,
    direccion_referencias,
    metodo_pago,
    subtotal,
    total
  ) values (
    p_comercio_id,
    'pendiente',
    'pendiente',
    p_modalidad_entrega,
    p_cliente_nombre,
    p_cliente_telefono,
    p_direccion_calle,
    p_direccion_numero,
    p_direccion_apartamento,
    p_direccion_referencias,
    p_metodo_pago,
    p_subtotal,
    p_subtotal
  )
  returning id into v_pedido_id;

  if p_metodo_pago = 'mercado_pago' then
    v_pago_id := gen_random_uuid();
    insert into public.pagos (
      id,
      pedido_id,
      proveedor,
      estado,
      monto,
      moneda,
      referencia_externa
    ) values (
      v_pago_id,
      v_pedido_id,
      'mercado_pago',
      'pendiente',
      p_subtotal,
      'UYU',
      v_pago_id::text
    );
  end if;

  for v_item in
    select *
    from jsonb_array_elements(coalesce(p_items, '[]'::jsonb))
  loop
    insert into public.pedido_items (
      pedido_id,
      producto_id,
      variante_id,
      nombre_producto,
      nombre_variante,
      cantidad,
      aclaraciones,
      precio_unitario,
      total
    ) values (
      v_pedido_id,
      (v_item->>'producto_id')::uuid,
      nullif(v_item->>'variante_id', '')::uuid,
      v_item->>'producto_nombre',
      v_item->>'variante_nombre',
      (v_item->>'cantidad')::int,
      v_item->>'aclaraciones',
      (v_item->>'precio_unitario')::numeric,
      (v_item->>'subtotal')::numeric
    )
    returning id into v_item_id;

    for v_opcion in
      select *
      from jsonb_array_elements(coalesce(v_item->'opciones', '[]'::jsonb))
    loop
      insert into public.pedido_item_opciones (
        pedido_item_id,
        opcion_id,
        nombre_opcion,
        precio_adicional
      ) values (
        v_item_id,
        (v_opcion->>'opcion_id')::uuid,
        v_opcion->>'opcion_nombre',
        (v_opcion->>'precio_adicional')::numeric
      );
    end loop;
  end loop;

  return query select v_pedido_id, v_pago_id;
end;
$$;

revoke all on function public.registrar_pedido_desde_checkout(
  uuid, text, text, text, text, text, text, text, text, numeric, jsonb
) from public, anon, authenticated;

grant execute on function public.registrar_pedido_desde_checkout(
  uuid, text, text, text, text, text, text, text, text, numeric, jsonb
) to service_role;

-- Checkout Pro no documenta idempotencia para POST /checkout/preferences.
-- Esta reserva atómica evita que dos solicitudes concurrentes creen dos preferencias.
create or replace function public.reservar_preferencia_mercado_pago(
  p_pago_id uuid
)
returns table(
  reservada boolean,
  preferencia_id text,
  url_checkout text
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_preferencia_id text;
  v_url_checkout text;
  v_reservada_en timestamptz;
begin
  select p.preferencia_id, p.url_checkout, p.preferencia_reservada_en
  into v_preferencia_id, v_url_checkout, v_reservada_en
  from public.pagos p
  where p.id = p_pago_id
    and p.proveedor = 'mercado_pago'
    and p.estado = 'pendiente'
    and p.referencia_externa = p.id::text
  for update;

  if not found then
    raise exception 'No existe un intento pendiente de Mercado Pago';
  end if;

  if v_preferencia_id is not null and v_url_checkout is not null then
    return query select false, v_preferencia_id, v_url_checkout;
    return;
  end if;

  if v_reservada_en is not null
     and v_reservada_en > now() - interval '2 minutes' then
    return query select false, null::text, null::text;
    return;
  end if;

  update public.pagos
  set preferencia_reservada_en = now(),
      actualizado_en = now()
  where id = p_pago_id;

  return query select true, null::text, null::text;
end;
$$;

revoke all on function public.reservar_preferencia_mercado_pago(uuid)
from public, anon, authenticated;

grant execute on function public.reservar_preferencia_mercado_pago(uuid)
to service_role;

-- Única puerta para confirmar un pago. Recibe datos ya consultados en la API de
-- Mercado Pago, valida importe/moneda, deduplica el evento y actualiza intento/pedido.
create or replace function public.confirmar_pago_mercado_pago(
  p_evento_id text,
  p_pago_id uuid,
  p_pago_externo_id text,
  p_estado text,
  p_monto numeric,
  p_moneda text
)
returns table(procesado boolean, duplicado boolean)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_pedido_id uuid;
  v_monto numeric;
  v_moneda text;
  v_estado_actual text;
  v_pago_externo_actual text;
  v_notificacion_id uuid;
begin
  if p_evento_id is null or btrim(p_evento_id) = '' then
    raise exception 'El evento de pago es obligatorio';
  end if;
  if p_pago_externo_id is null or btrim(p_pago_externo_id) = '' then
    raise exception 'El identificador externo del pago es obligatorio';
  end if;
  if p_estado not in ('pendiente', 'aprobado', 'rechazado') then
    raise exception 'Estado de pago inválido';
  end if;

  select pedido_id, monto, moneda, estado, pago_externo_id
  into v_pedido_id, v_monto, v_moneda, v_estado_actual, v_pago_externo_actual
  from public.pagos
  where id = p_pago_id
    and proveedor = 'mercado_pago'
    and referencia_externa = p_pago_id::text
  for update;

  if not found then
    raise exception 'No existe el intento de pago asociado';
  end if;
  if v_monto <> p_monto or v_moneda <> p_moneda then
    raise exception 'El importe o la moneda no coinciden con el intento';
  end if;
  if v_pago_externo_actual is not null
     and v_pago_externo_actual <> p_pago_externo_id then
    raise exception 'El intento ya está asociado a otro pago externo';
  end if;

  insert into public.pagos_notificaciones (
    pago_id,
    proveedor,
    evento_id,
    pago_externo_id
  ) values (
    p_pago_id,
    'mercado_pago',
    p_evento_id,
    p_pago_externo_id
  )
  on conflict (proveedor, evento_id) do nothing
  returning id into v_notificacion_id;

  if v_notificacion_id is null then
    return query select false, true;
    return;
  end if;

  update public.pagos
  set pago_externo_id = p_pago_externo_id,
      -- Un evento posterior nunca puede degradar un pago ya aprobado.
      estado = case
        when v_estado_actual = 'aprobado' then 'aprobado'
        else p_estado
      end,
      actualizado_en = now()
  where id = p_pago_id;

  update public.pedidos
  set estado_pago = case
        when exists (
          select 1 from public.pagos
          where pedido_id = v_pedido_id and estado = 'aprobado'
        ) then 'aprobado'
        when exists (
          select 1 from public.pagos
          where pedido_id = v_pedido_id and estado = 'pendiente'
        ) then 'pendiente'
        else 'rechazado'
      end,
      actualizado_en = now()
  where id = v_pedido_id;

  return query select true, false;
end;
$$;

revoke all on function public.confirmar_pago_mercado_pago(
  text, uuid, text, text, numeric, text
) from public, anon, authenticated;

grant execute on function public.confirmar_pago_mercado_pago(
  text, uuid, text, text, numeric, text
) to service_role;

commit;
