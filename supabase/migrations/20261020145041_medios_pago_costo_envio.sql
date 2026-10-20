-- PIA-3, etapa 1: medios de pago y costo de envío (UYU).
-- Requiere la cadena hasta 20261018123209_demanda_tiempos_pausa.sql.
-- No es idempotente: agrega una columna y reemplaza la firma de checkout.
-- No aplicar hasta adaptar el llamador: p_costo_envio es obligatorio y retiro
-- debe enviar pago_en_local. No se modifica ningún pedido histórico.
--
-- La firma anterior se elimina con RESTRICT, nunca CASCADE: una dependencia SQL
-- registrada aborta toda la transacción para revisarla, sin eliminarla. En la
-- cadena versionada no hay funciones, vistas ni triggers que dependan de ella.
-- Los llamadores externos (PostgREST/Next.js) deben migrarse por separado.

begin;

alter table public.comercio_configuracion
  add column costo_envio numeric(12,2) not null default 0
  constraint comercio_configuracion_costo_envio_check
    check (costo_envio >= 0 and costo_envio <> 'NaN'::numeric);

comment on column public.comercio_configuracion.costo_envio is
  'Tarifa de delivery en UYU. Inicialmente 0; editable mediante la RPC auditada. Retiro siempre cuesta 0.';

-- Revisión previa al reemplazo del check, sin leer ni transformar datos personales.
-- El bloqueo evita inserciones concurrentes entre el conteo y la validación.
do $$
declare
  v_incompatibles bigint;
begin
  lock table public.pedidos in access exclusive mode;

  select count(*) into v_incompatibles
  from public.pedidos
  where metodo_pago not in ('efectivo', 'tarjeta_pos', 'pago_en_local');

  alter table public.pedidos drop constraint pedidos_metodo_pago_check;
  alter table public.pedidos add constraint pedidos_metodo_pago_check
    check (metodo_pago in ('efectivo', 'tarjeta_pos', 'pago_en_local')) not valid;

  if v_incompatibles = 0 then
    alter table public.pedidos validate constraint pedidos_metodo_pago_check;
  else
    raise warning 'Hay % pedidos históricos con métodos de pago incompatibles. Se conservan sin cambios y pedidos_metodo_pago_check queda NOT VALID.', v_incompatibles;
  end if;
end;
$$;

-- Misma autorización, operación idempotente y auditoría completa de PIA-2.
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

  for v_clave in select jsonb_object_keys(p_cambios) loop
    if v_clave not in (
      'demanda',
      'retiro_normal_min', 'retiro_normal_max',
      'envio_normal_min', 'envio_normal_max',
      'retiro_alta_min', 'retiro_alta_max',
      'envio_alta_min', 'envio_alta_max',
      'pedidos_pausados', 'mensaje_pausa',
      'costo_envio'
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

  if p_cambios ? 'costo_envio' then
    if jsonb_typeof(p_cambios->'costo_envio') <> 'number' then
      raise exception 'El costo de envío debe ser un número no negativo en UYU.' using errcode = '22023';
    end if;
    if (p_cambios->>'costo_envio')::numeric < 0
      or (p_cambios->>'costo_envio')::numeric > 9999999999.99
      or (p_cambios->>'costo_envio')::numeric <> round((p_cambios->>'costo_envio')::numeric, 2) then
      raise exception 'El costo de envío debe estar entre 0 y 9999999999.99 UYU y tener hasta dos decimales.' using errcode = '22023';
    end if;
  end if;

  v_continuar := public.auditoria_iniciar_operacion(
    p_operacion_id,
    p_comercio_id,
    'comercio_configuracion',
    p_comercio_id
  );

  insert into public.comercio_configuracion (comercio_id)
  values (p_comercio_id)
  on conflict (comercio_id) do nothing;

  select * into v_fila
  from public.comercio_configuracion
  where comercio_id = p_comercio_id
  for update;

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
      mensaje_pausa     = coalesce(nullif(btrim(p_cambios->>'mensaje_pausa'), ''), mensaje_pausa),
      costo_envio       = case when p_cambios ? 'costo_envio'
                           then (p_cambios->>'costo_envio')::numeric else costo_envio end
    where comercio_id = p_comercio_id
    returning * into v_fila;
  exception
    when check_violation then
      raise exception 'Valores de configuración inválidos: la demanda debe ser normal o alta, los minutos van de 0 a 240 con máximo mayor o igual al mínimo, el mensaje de pausa tiene hasta 280 caracteres y el costo de envío debe ser no negativo.'
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

-- Sin sobrecarga antigua ni valor por defecto: ningún llamador puede omitir la tarifa.
drop function public.registrar_pedido_desde_checkout(uuid, text, text, text, text, text, text, text, text, numeric, jsonb) restrict;

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
  if p_modalidad_entrega is null or p_modalidad_entrega not in ('delivery', 'retiro') then
    raise exception 'Modalidad de entrega inválida' using errcode = '22023';
  end if;
  if p_metodo_pago is null
    or (p_modalidad_entrega = 'delivery' and p_metodo_pago not in ('efectivo', 'tarjeta_pos'))
    or (p_modalidad_entrega = 'retiro' and p_metodo_pago <> 'pago_en_local') then
    raise exception 'Método de pago inválido para la modalidad de entrega' using errcode = '22023';
  end if;
  if p_subtotal is null or p_subtotal <= 0
    or p_subtotal::text in ('NaN', 'Infinity', '-Infinity')
    or p_subtotal <> round(p_subtotal, 2) then
    raise exception 'El subtotal debe ser positivo, finito y tener hasta dos decimales' using errcode = '22023';
  end if;
  if p_costo_envio is null or p_costo_envio < 0
    or p_costo_envio::text in ('NaN', 'Infinity', '-Infinity')
    or p_costo_envio <> round(p_costo_envio, 2) then
    raise exception 'El costo de envío debe ser no negativo, finito y tener hasta dos decimales' using errcode = '22023';
  end if;
  if p_modalidad_entrega = 'retiro' and p_costo_envio <> 0 then
    raise exception 'El retiro debe tener costo de envío cero' using errcode = '22023';
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
    costo_envio,
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
    p_costo_envio,
    p_subtotal + p_costo_envio
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

alter function public.registrar_pedido_desde_checkout(uuid, text, text, text, text, text, text, text, text, numeric, jsonb, numeric)
  owner to postgres;
revoke all on function public.registrar_pedido_desde_checkout(uuid, text, text, text, text, text, text, text, text, numeric, jsonb, numeric)
  from public, anon, authenticated;
grant execute on function public.registrar_pedido_desde_checkout(uuid, text, text, text, text, text, text, text, text, numeric, jsonb, numeric)
  to postgres, service_role;

commit;
