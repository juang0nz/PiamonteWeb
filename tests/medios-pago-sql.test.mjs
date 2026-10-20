import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

// Contrato estático: no ejecuta SQL ni se conecta a Supabase.
const leer = nombre => fs.readFileSync(new URL(`../supabase/migrations/${nombre}`, import.meta.url), "utf8");
const sql = leer("20261020145041_medios_pago_costo_envio.sql").replace(/--[^\n]*/g, "");
const anterior = leer("20261017210509_limpiar_rpc_pedidos.sql");
const operacion = leer("20261018123209_demanda_tiempos_pausa.sql");
const base = leer("20261017134905_remote_schema.sql");
const normalizar = texto => texto.replace(/--[^\n]*/g, "").replace(/\s+/g, " ").trim();

function funcion(texto, nombre) {
  const coincidencia = texto.match(new RegExp(
    `create (?:or replace )?function public\\.${nombre}\\s*\\([\\s\\S]*?\\$function\\$;`, "i",
  ));
  assert.ok(coincidencia, `Debe existir la función ${nombre}`);
  return coincidencia[0];
}

function tramo(texto, inicio, fin) {
  const desde = texto.indexOf(inicio);
  const hasta = texto.indexOf(fin, desde + inicio.length);
  assert.ok(desde >= 0 && hasta > desde, `Debe existir el tramo ${inicio}`);
  return normalizar(texto.slice(desde, hasta));
}

const registrar = funcion(sql, "registrar_pedido_desde_checkout");
const administrar = funcion(sql, "admin_actualizar_configuracion_comercio");
const administrarAnterior = funcion(operacion, "admin_actualizar_configuracion_comercio");
const firmaAnterior = "uuid, text, text, text, text, text, text, text, text, numeric, jsonb";
const firmaNueva = `${firmaAnterior}, numeric`;
const compacto = normalizar(sql);

test("PIA-3: la tarifa inicial es numeric(12,2), obligatoria, cero y no negativa", () => {
  assert.match(compacto, /alter table public\.comercio_configuracion add column costo_envio numeric\(12,2\) not null default 0 constraint comercio_configuracion_costo_envio_check check \(costo_envio >= 0 and costo_envio <> 'NaN'::numeric\)/);
  assert.match(sql, /^\s*begin;/);
  assert.match(sql, /commit;\s*$/);
});

test("PIA-3: revisa históricos antes del check y no altera ni elimina pedidos", () => {
  const conteo = sql.indexOf("select count(*) into v_incompatibles");
  const reemplazo = sql.indexOf("drop constraint pedidos_metodo_pago_check");
  assert.ok(conteo > 0 && reemplazo > conteo);
  assert.match(compacto, /lock table public\.pedidos in access exclusive mode; select count\(\*\) into v_incompatibles from public\.pedidos where metodo_pago not in \('efectivo', 'tarjeta_pos', 'pago_en_local'\)/);
  assert.match(compacto, /add constraint pedidos_metodo_pago_check check \(metodo_pago in \('efectivo', 'tarjeta_pos', 'pago_en_local'\)\) not valid/);
  assert.match(compacto, /if v_incompatibles = 0 then alter table public\.pedidos validate constraint pedidos_metodo_pago_check; else raise warning/);
  assert.doesNotMatch(sql, /\b(?:delete\s+from|truncate|drop\s+table|cascade)\b/i);
  assert.doesNotMatch(sql, /\bupdate\s+public\.pedidos\b/i);
});

test("PIA-3: retira solo la firma antigua con RESTRICT y exige costo explícito", () => {
  assert.ok(compacto.includes(`drop function public.registrar_pedido_desde_checkout(${firmaAnterior}) restrict;`));
  assert.equal((sql.match(/create (?:or replace )?function public\.registrar_pedido_desde_checkout/g) ?? []).length, 1);
  assert.match(normalizar(registrar), /p_subtotal numeric, p_items jsonb, p_costo_envio numeric \) returns table \( pedido_id uuid, pago_id uuid \)/);
  assert.doesNotMatch(registrar, /\bdefault\b/i);
});

test("PIA-3: conserva el dueño, SECURITY DEFINER, search_path y permisos mínimos", () => {
  assert.match(registrar, /security definer\s+set search_path to 'pg_catalog', 'public'/);
  assert.ok(compacto.includes(`alter function public.registrar_pedido_desde_checkout(${firmaNueva}) owner to postgres;`));
  assert.ok(compacto.includes(`revoke all on function public.registrar_pedido_desde_checkout(${firmaNueva}) from public, anon, authenticated;`));
  assert.ok(compacto.includes(`grant execute on function public.registrar_pedido_desde_checkout(${firmaNueva}) to postgres, service_role;`));
  assert.ok(compacto.includes("revoke all on function public.admin_actualizar_configuracion_comercio(uuid, uuid, jsonb) from public, anon, service_role;"));
  assert.ok(compacto.includes("grant execute on function public.admin_actualizar_configuracion_comercio(uuid, uuid, jsonb) to authenticated;"));
  assert.doesNotMatch(sql, /\bgrant\s+(?:all|insert|update|delete)\b/i);
});

test("PIA-3: modalidad y pago se validan juntos, incluidos los NULL", () => {
  const validaciones = normalizar(registrar.slice(0, registrar.indexOf("insert into public.pedidos")));
  assert.match(validaciones, /if p_modalidad_entrega is null or p_modalidad_entrega not in \('delivery', 'retiro'\) then raise exception/);
  assert.match(validaciones, /if p_metodo_pago is null or \(p_modalidad_entrega = 'delivery' and p_metodo_pago not in \('efectivo', 'tarjeta_pos'\)\) or \(p_modalidad_entrega = 'retiro' and p_metodo_pago <> 'pago_en_local'\) then raise exception/);
  assert.match(validaciones, /if p_modalidad_entrega = 'retiro' and p_costo_envio <> 0 then raise exception/);
});

test("PIA-3: rechaza importes nulos, negativos, no finitos y fracciones de centésimo", () => {
  const validaciones = normalizar(registrar.slice(0, registrar.indexOf("insert into public.pedidos")));
  assert.match(validaciones, /if p_subtotal is null or p_subtotal <= 0 or p_subtotal::text in \('NaN', 'Infinity', '-Infinity'\) or p_subtotal <> round\(p_subtotal, 2\) then raise exception/);
  assert.match(validaciones, /if p_costo_envio is null or p_costo_envio < 0 or p_costo_envio::text in \('NaN', 'Infinity', '-Infinity'\) or p_costo_envio <> round\(p_costo_envio, 2\) then raise exception/);
});

test("PIA-3: guarda subtotal, envío y su suma sin modificar el número ni estado de pago", () => {
  const insercion = registrar.match(/insert into public\.pedidos \(([\s\S]*?)\) values \(([\s\S]*?)\)\s+returning id into v_pedido_id;/);
  assert.ok(insercion);
  const columnas = insercion[1].split(",").map(valor => valor.trim());
  const valores = insercion[2].split(",").map(valor => valor.trim());
  assert.equal(columnas.length, valores.length);
  const registro = Object.fromEntries(columnas.map((columna, indice) => [columna, valores[indice]]));
  assert.equal(registro.subtotal, "p_subtotal");
  assert.equal(registro.costo_envio, "p_costo_envio");
  assert.equal(registro.total, "p_subtotal + p_costo_envio");
  assert.equal(registro.estado, "'pendiente'");
  assert.equal(registro.estado_pago, "'pendiente'");
  assert.ok(!("numero" in registro));
  assert.match(base, /"numero"\s+bigint\s+GENERATED BY DEFAULT AS IDENTITY NOT NULL/);
  assert.match(base, /CHECK \(\(total = \(subtotal \+ costo_envio\)\)\)/);
  assert.doesNotMatch(sql, /(?:alter|drop)\s+(?:sequence|trigger)|restart\s+with/i);
});

test("PIA-3: conserva íntegro el registro de ítems y opciones y la disponibilidad por trigger", () => {
  const registrarAnterior = funcion(anterior, "registrar_pedido_desde_checkout");
  assert.equal(
    tramo(registrar, "for v_item in", "$function$;"),
    tramo(registrarAnterior, "for v_item in", "$function$;"),
  );
  assert.match(anterior, /create trigger validar_disponibilidad_item_pedido\s+before insert or update of producto_id, variante_id/);
  assert.doesNotMatch(sql, /(?:drop|disable|replace)[^;]*validar_disponibilidad_item_pedido/i);
});

test("PIA-3: permite costo_envio sin ampliar otras claves ni cambiar autorización y auditoría", () => {
  const claves = texto => {
    const lista = texto.match(/if v_clave not in \(([\s\S]*?)\) then/);
    assert.ok(lista);
    return [...lista[1].matchAll(/'([^']+)'/g)].map(coincidencia => coincidencia[1]);
  };
  assert.deepEqual(claves(administrar), [...claves(administrarAnterior), "costo_envio"]);
  assert.equal(
    tramo(administrar, "if not (public.es_super_admin_activo()", "if p_cambios ? 'costo_envio'"),
    tramo(administrarAnterior, "if not (public.es_super_admin_activo()", "v_continuar :="),
  );
  for (const [inicio, fin] of [
    ["v_continuar := public.auditoria_iniciar_operacion(", "v_anterior :="],
    ["v_nuevo := to_jsonb", "$function$;"],
  ]) {
    assert.equal(tramo(administrar, inicio, fin), tramo(administrarAnterior, inicio, fin));
  }
  assert.match(administrar, /security definer\s+set search_path to 'pg_catalog', 'public', 'auth'/);
  assert.doesNotMatch(sql, /create or replace function public\.(?:auditoria_|admin_actualizar_estado_pedido)/);
});

test("PIA-3: edición auditada exige tarifa numérica representable, sin convertir NULL en cero", () => {
  const texto = normalizar(administrar);
  assert.match(texto, /if jsonb_typeof\(p_cambios->'costo_envio'\) <> 'number' then raise exception/);
  assert.match(texto, /\(p_cambios->>'costo_envio'\)::numeric < 0 or \(p_cambios->>'costo_envio'\)::numeric > 9999999999\.99 or \(p_cambios->>'costo_envio'\)::numeric <> round\(\(p_cambios->>'costo_envio'\)::numeric, 2\) then raise exception/);
  assert.match(texto, /costo_envio = case when p_cambios \? 'costo_envio' then \(p_cambios->>'costo_envio'\)::numeric else costo_envio end/);
  assert.match(administrar, /v_anterior := to_jsonb\(v_fila\) - 'actualizado_en' - 'comercio_id'/);
  assert.match(administrar, /v_nuevo := to_jsonb\(v_fila\) - 'actualizado_en' - 'comercio_id'/);
});
