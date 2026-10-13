-- RPC recomendado para registrar pedidos de forma atómica.
-- Ejecutar únicamente después de revisar nombres reales de columnas/tablas en tu proyecto.
-- Este script NO se ejecuta automáticamente desde la app.

create or replace function public.registrar_pedido_desde_checkout(
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
returns table(pedido_id uuid)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_pedido_id uuid;
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

  return query select v_pedido_id;
end;
$$;

revoke all on function public.registrar_pedido_desde_checkout(
  uuid, text, text, text, text, text, text, text, text, numeric, jsonb
) from public;

grant execute on function public.registrar_pedido_desde_checkout(
  uuid, text, text, text, text, text, text, text, text, numeric, jsonb
) to authenticated;

-- Si necesitás permitir pedido anónimo (sin login), evaluar habilitar también anon.
-- grant execute on function public.registrar_pedido_desde_checkout(
--   uuid, text, text, text, text, text, text, text, text, numeric, jsonb
-- ) to anon;

