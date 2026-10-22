-- PIA-4, etapa 3. Requiere promociones_automaticas; preparada, sin aplicar.
begin;

alter table public.promociones
  add constraint promociones_comercio_id_key unique (comercio_id, id);

alter table public.pedidos
  add column descuento numeric(12,2) not null default 0,
  add column promocion_id uuid,
  add column promocion_nombre text,
  add column promocion_porcentaje numeric,
  add constraint pedidos_promocion_fkey foreign key (comercio_id, promocion_id)
    references public.promociones(comercio_id, id) on delete restrict,
  add constraint pedidos_descuento_check check (
    descuento >= 0 and descuento <= subtotal and descuento <> 'NaN'::numeric
  ),
  add constraint pedidos_promocion_check check (
    (promocion_id is null and promocion_nombre is null
      and promocion_porcentaje is null and descuento = 0)
    or
    (promocion_id is not null and promocion_nombre is not null
      and length(btrim(promocion_nombre)) between 1 and 120
      and promocion_porcentaje is not null
      and promocion_porcentaje between 0 and 100
      and promocion_porcentaje = trunc(promocion_porcentaje)
      and descuento = round(subtotal * promocion_porcentaje / 100, 2))
  );

alter table public.pedidos drop constraint pedidos_check1;
alter table public.pedidos add constraint pedidos_check1 check (
  total = subtotal - descuento + costo_envio
  and subtotal <> 'NaN'::numeric and costo_envio <> 'NaN'::numeric
  and total <> 'NaN'::numeric
);

comment on column public.pedidos.descuento is
  'Descuento sobre el subtotal bruto de productos, sin envío. Cero en pedidos anteriores.';
comment on column public.pedidos.promocion_nombre is
  'Instantánea al registrar; no cambia al editar la promoción.';
comment on column public.pedidos.promocion_porcentaje is
  'Porcentaje entero aplicado al registrar, incluido 0 o 100; NULL sin promoción.';

-- Mismos 12 argumentos; el resultado cambia y exige recrear, sin eliminar dependencias.
drop function public.registrar_pedido_desde_checkout(uuid, text, text, text, text, text, text, text, text, numeric, jsonb, numeric) restrict;

create function public.registrar_pedido_desde_checkout (
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
  p_items                 jsonb,
  p_costo_envio           numeric
)
  returns table (
    pedido_id uuid,
    pago_id uuid,
    numero_pedido bigint,
    subtotal numeric,
    descuento numeric,
    costo_envio numeric,
    total numeric,
    promocion_id uuid,
    promocion_nombre text,
    promocion_porcentaje numeric
  )
  language plpgsql
  security definer
  set search_path to 'pg_catalog', 'public'
  as $function$
declare
  v_pedido public.pedidos;
  v_promocion public.promociones;
  v_descuento numeric := 0;
  v_total numeric;
  v_promocion_id uuid;
  v_promocion_nombre text;
  v_porcentaje numeric;
  v_item jsonb;
  v_opcion jsonb;
  v_item_id uuid;
begin
  if p_modalidad_entrega is null or p_modalidad_entrega not in ('delivery', 'retiro') then
    raise exception 'Modalidad de entrega inválida' using errcode = '22023';
  end if;
  if p_metodo_pago is null
    or (p_modalidad_entrega = 'delivery' and p_metodo_pago not in ('efectivo', 'tarjeta_pos'))
    or (p_modalidad_entrega = 'retiro' and p_metodo_pago <> 'pago_en_local') then
    raise exception 'Método de pago inválido para la modalidad de entrega' using errcode = '22023';
  end if;
  if p_subtotal is null or p_subtotal <= 0 or p_subtotal > 9999999999.99
    or p_subtotal::text in ('NaN', 'Infinity', '-Infinity')
    or p_subtotal <> round(p_subtotal, 2) then
    raise exception 'El subtotal debe ser positivo, finito y tener hasta dos decimales dentro del rango monetario' using errcode = '22023';
  end if;
  if p_costo_envio is null or p_costo_envio < 0 or p_costo_envio > 9999999999.99
    or p_costo_envio::text in ('NaN', 'Infinity', '-Infinity')
    or p_costo_envio <> round(p_costo_envio, 2) then
    raise exception 'El costo de envío debe ser no negativo, finito y tener hasta dos decimales' using errcode = '22023';
  end if;
  if p_modalidad_entrega = 'retiro' and p_costo_envio <> 0 then
    raise exception 'El retiro debe tener costo de envío cero' using errcode = '22023';
  end if;

  -- Se bloquea también la fila inactiva: la edición administrativa espera al registro.
  select p.* into v_promocion
  from public.promociones p
  join public.comercios c on c.id = p.comercio_id and c.activo = true
  where p.comercio_id = p_comercio_id and p.clave = 'descuento_web'
  for share of p;
  if not found then
    raise exception 'No se pudo obtener la configuración del descuento web del comercio activo' using errcode = 'P0002';
  end if;
  if v_promocion.activa then
    if v_promocion.tipo_descuento <> 'porcentaje' or v_promocion.aplicacion <> 'automatica'
      or v_promocion.alcance <> 'tienda' or v_promocion.canal <> 'web'
      or v_promocion.codigo is not null
      or v_promocion.valor is null or v_promocion.valor not between 0 and 100
      or v_promocion.valor <> trunc(v_promocion.valor) then
      raise exception 'La promoción web no tiene una configuración válida' using errcode = '22023';
    end if;
    v_promocion_id := v_promocion.id;
    v_promocion_nombre := v_promocion.nombre;
    v_porcentaje := v_promocion.valor;
    -- Numeric exacto: redondeo único del subtotal completo, mitades hacia arriba.
    v_descuento := round(p_subtotal * v_porcentaje / 100, 2);
  end if;
  v_total := p_subtotal - v_descuento + p_costo_envio;
  if v_total < 0 or v_total > 9999999999.99 then
    raise exception 'El total está fuera del rango monetario permitido' using errcode = '22023';
  end if;

  insert into public.pedidos (
    comercio_id, estado, estado_pago, modalidad,
    cliente_nombre, cliente_telefono,
    direccion_calle, direccion_numero, direccion_apartamento, direccion_referencias,
    metodo_pago, subtotal, costo_envio, total,
    descuento, promocion_id, promocion_nombre, promocion_porcentaje
  ) values (
    p_comercio_id, 'pendiente', 'pendiente', p_modalidad_entrega,
    p_cliente_nombre, p_cliente_telefono,
    p_direccion_calle, p_direccion_numero, p_direccion_apartamento, p_direccion_referencias,
    p_metodo_pago, p_subtotal, p_costo_envio, v_total,
    v_descuento, v_promocion_id, v_promocion_nombre, v_porcentaje
  )
  returning * into v_pedido;

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
      v_pedido.id,
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

  return query select v_pedido.id, null::uuid, v_pedido.numero,
    v_pedido.subtotal, v_pedido.descuento, v_pedido.costo_envio, v_pedido.total,
    v_pedido.promocion_id, v_pedido.promocion_nombre, v_pedido.promocion_porcentaje;
end;
$function$;

alter function public.registrar_pedido_desde_checkout(uuid, text, text, text, text, text, text, text, text, numeric, jsonb, numeric)
  owner to postgres;
revoke all on function public.registrar_pedido_desde_checkout(uuid, text, text, text, text, text, text, text, text, numeric, jsonb, numeric)
  from public, anon, authenticated, service_role;
grant execute on function public.registrar_pedido_desde_checkout(uuid, text, text, text, text, text, text, text, text, numeric, jsonb, numeric)
  to postgres, service_role;

commit;
