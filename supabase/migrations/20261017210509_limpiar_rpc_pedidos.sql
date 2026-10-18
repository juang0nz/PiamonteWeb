-- PIA-20: limpiar la RPC de pedidos y retirar los objetos de Mercado Pago.
--
-- Qué resuelve (hallazgos de la reconciliación de PIA-1 sobre la foto base
-- 20261017134905_remote_schema.sql):
--
--   1. Retira los objetos huérfanos de Mercado Pago: las tablas public.pagos y
--      public.pagos_notificaciones y las funciones confirmar_pago_mercado_pago y
--      reservar_preferencia_mercado_pago. El código de la aplicación se retiró en PIA-0.
--   2. Cambia el contrato de metodo_pago a ('efectivo', 'tarjeta_pos'), tanto en la RPC
--      registrar_pedido_desde_checkout como en el check de la tabla pedidos. La UI del POS
--      la agrega PIA-3; acá solo se corrige el contrato. pedidos.estado_pago y su check se
--      conservan para PIA-3 (estado del pedido y estado del pago por separado).
--   3. Aplica la validación de disponibilidad que el script histórico
--      supabase/historial/20261014100004_disponibilidad_productos.sql definía y nunca llegó
--      a producción: función validar_disponibilidad_item_pedido() y trigger BEFORE INSERT OR
--      UPDATE sobre pedido_items. Hasta ahora nada impedía en la base registrar un ítem de un
--      producto o variante marcados como no disponibles; solo lo validaba el código.
--
-- Requiere: la foto base aplicada (cadena de PIA-1).
-- Idempotente: sí (drop ... if exists, create or replace, drop trigger if exists).
--
-- ADVERTENCIA para producción: esta migración elimina las filas que existan en
-- public.pagos y public.pagos_notificaciones. El checkout con Mercado Pago nunca se habilitó
-- (MERCADO_PAGO_DISPONIBLE_EN_CHECKOUT era false), así que cualquier fila es de pruebas
-- internas y se pierde a propósito. Antes de aplicar en producción, ejecutar:
--   select count(*) from public.pagos;
--   select count(*) from public.pedidos where metodo_pago = 'mercado_pago';
-- El nuevo check de pedidos.metodo_pago se crea NOT VALID para que filas históricas con
-- 'mercado_pago' no bloqueen la migración; las filas nuevas sí quedan validadas.

begin;

-- 1. Funciones de Mercado Pago (primero, porque leen y escriben public.pagos).
drop function if exists public.confirmar_pago_mercado_pago(text, uuid, text, text, numeric, text);
drop function if exists public.reservar_preferencia_mercado_pago(uuid);

-- 2. Tablas de Mercado Pago. pagos_notificaciones referencia a pagos (FK
--    pagos_notificaciones_pago_id_fkey), por eso va primero. Índices y FKs caen con ellas.
drop table if exists public.pagos_notificaciones;
drop table if exists public.pagos;

-- 3. Check de la tabla pedidos: efectivo o tarjeta POS. NOT VALID: no revisa filas existentes.
alter table public.pedidos drop constraint if exists pedidos_metodo_pago_check;
alter table public.pedidos
  add constraint pedidos_metodo_pago_check
  check (metodo_pago in ('efectivo', 'tarjeta_pos')) not valid;

-- 4. RPC de registro de pedidos. Misma firma y mismo cuerpo que la foto base, con dos
--    cambios: el check de p_metodo_pago admite ('efectivo', 'tarjeta_pos') y desaparece el
--    bloque que insertaba en public.pagos cuando el método era 'mercado_pago'. Se conserva
--    la columna pago_id en el resultado para no romper la firma; ahora es siempre null.
create or replace function public.registrar_pedido_desde_checkout (
  p_comercio_id           uuid,
  p_modalidad_entrega     text,
  p_cliente_nombre        text,
  p_cliente_telefono      text,
  p_direccion_calle       text,
  p_direccion_numero      text,
  p_direccion_apartamento text,
  p_direccion_referencias text,
  p_metodo_pago           text,
  p_subtotal              numeric,
  p_items                 jsonb
)
  returns table (
    pedido_id uuid,
    pago_id   uuid
  )
  language plpgsql
  security definer
  set search_path to 'pg_catalog', 'public'
  as $function$
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
  if p_metodo_pago not in ('efectivo', 'tarjeta_pos') then
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
$function$;

-- Mismos permisos que declara la foto base: solo postgres y service_role la ejecutan.
revoke all on function public.registrar_pedido_desde_checkout(uuid, text, text, text, text, text, text, text, text, numeric, jsonb)
  from public, anon, authenticated;
grant execute on function public.registrar_pedido_desde_checkout(uuid, text, text, text, text, text, text, text, text, numeric, jsonb)
  to postgres, service_role;

-- 5. Validación atómica de disponibilidad al registrar ítems (copiada del script histórico
--    04). La validación de Next.js ofrece mensajes tempranos; este trigger es la garantía
--    frente a un producto marcado como agotado mientras se confirma el pedido. Los mensajes
--    de error son los que src/lib/pedidos/registrar.ts traduce a un 409 para el cliente.
create or replace function public.validar_disponibilidad_item_pedido()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_producto_disponible boolean;
  v_variante_disponible boolean;
begin
  select p.disponible
  into v_producto_disponible
  from public.productos p
  where p.id = new.producto_id
  for share;

  if not found or v_producto_disponible is not true then
    raise exception 'El producto ya no está disponible';
  end if;

  if new.variante_id is not null then
    select v.disponible
    into v_variante_disponible
    from public.variantes_producto v
    where v.id = new.variante_id
      and v.producto_id = new.producto_id
    for share;

    if not found or v_variante_disponible is not true then
      raise exception 'La variante ya no está disponible';
    end if;
  end if;

  return new;
end;
$$;

-- Función de trigger: nadie la invoca directamente.
revoke all on function public.validar_disponibilidad_item_pedido() from public, anon, authenticated;

drop trigger if exists validar_disponibilidad_item_pedido on public.pedido_items;
create trigger validar_disponibilidad_item_pedido
before insert or update of producto_id, variante_id
on public.pedido_items
for each row
execute function public.validar_disponibilidad_item_pedido();

commit;
