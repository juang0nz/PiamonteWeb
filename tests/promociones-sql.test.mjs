import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

// Contrato estático: no ejecuta SQL ni consulta Supabase.
const leer = nombre => fs.readFileSync(new URL(`../supabase/migrations/${nombre}`, import.meta.url), "utf8");
const normalizar = texto => texto.replace(/--[^\n]*/g, "").replace(/\s+/g, " ").trim();
const sql = leer("20261020180500_promociones_automaticas.sql");
const compacto = normalizar(sql);
const anterior = leer("20261018123209_demanda_tiempos_pausa.sql");
const base = leer("20261017134905_remote_schema.sql");

function funcion(texto, nombre) {
  const resultado = texto.match(new RegExp(
    `create (?:or replace )?function public\\.${nombre}\\s*\\([\\s\\S]*?\\$function\\$;`, "i",
  ));
  assert.ok(resultado, `Debe existir la función ${nombre}`);
  return resultado[0];
}

const lectura = normalizar(funcion(sql, "obtener_descuento_web"));
const consulta = normalizar(funcion(sql, "admin_obtener_descuento_web"));
const actualizar = normalizar(funcion(sql, "admin_actualizar_descuento_web"));
const inicializar = normalizar(funcion(sql, "inicializar_descuento_web_comercio"));

test("PIA-4: modelo mínimo por comercio, sin estructuras avanzadas ni cambios de pedidos", () => {
  assert.match(compacto, /^begin;/);
  assert.match(compacto, /commit;$/);
  assert.match(compacto, /comercio_id uuid not null references public\.comercios\(id\) on delete restrict/);
  assert.match(compacto, /unique \(comercio_id, clave\)/);
  for (const [columna, valor] of Object.entries({
    clave: "descuento_web", tipo_descuento: "porcentaje",
    aplicacion: "automatica", alcance: "tienda", canal: "web",
  })) {
    assert.ok(compacto.includes(`${columna} = '${valor}'`));
  }
  assert.match(compacto, /codigo is null/);
  assert.match(compacto, /nombre text not null/);
  assert.match(compacto, /length\(btrim\(nombre\)\) between 1 and 120/);
  assert.doesNotMatch(compacto, /\b(?:cascade|delete from|truncate|drop function|drop table)\b/i);
  assert.doesNotMatch(compacto, /(?:alter table|insert into|update) public\.(?:pedidos|pedido_items|productos|variantes_producto)\b/);
  assert.doesNotMatch(compacto, /registrar_pedido_desde_checkout|vigencia|prioridad|limite_usos/);
});

test("PIA-4: porcentaje sin escala para rechazar fracciones en lugar de redondearlas", () => {
  assert.match(compacto, /valor numeric not null default 0/);
  assert.doesNotMatch(compacto, /valor (?:integer|smallint|numeric\s*\()/);
  assert.match(compacto, /check \( valor between 0 and 100 and valor = trunc\(valor\) \)/);
  assert.match(actualizar, /jsonb_typeof\(p_cambios->'valor'\) <> 'number'/);
  assert.match(actualizar, /if \(p_cambios->>'valor'\)::numeric not between 0 and 100 or \(p_cambios->>'valor'\)::numeric <> trunc\(\(p_cambios->>'valor'\)::numeric\) then raise exception/);
  assert.doesNotMatch(actualizar, /round\(|::(?:integer|smallint)/);
});

test("PIA-4: inicialización desactivada y cero para comercios existentes y futuros, sin duplicados", () => {
  assert.match(compacto, /activa boolean not null default false/);
  assert.match(compacto, /valor numeric not null default 0/);
  assert.match(compacto, /insert into public\.promociones \(comercio_id\) select id from public\.comercios on conflict \(comercio_id, clave\) do nothing/);
  assert.match(inicializar, /insert into public\.promociones \(comercio_id\) values \(new\.id\) on conflict \(comercio_id, clave\) do nothing/);
  assert.match(compacto, /after insert on public\.comercios for each row execute function public\.inicializar_descuento_web_comercio\(\)/);
  assert.ok(compacto.indexOf("create trigger comercios_inicializar_descuento_web") < compacto.indexOf("select id from public.comercios"));
});

test("PIA-4: lectura pública solo proyecta nombre y porcentaje aplicables del comercio activo", () => {
  assert.match(lectura, /returns table \(nombre text, valor numeric\)/);
  assert.match(lectura, /select p\.nombre, p\.valor from public\.promociones p join public\.comercios c on c\.id = p\.comercio_id/);
  assert.match(lectura, /p\.comercio_id = p_comercio_id and c\.activo = true/);
  for (const condicion of [
    "p.clave = 'descuento_web'", "p.activa = true", "p.tipo_descuento = 'porcentaje'",
    "p.aplicacion = 'automatica'", "p.alcance = 'tienda'", "p.canal = 'web'", "p.codigo is null",
  ]) assert.ok(lectura.includes(condicion));
  assert.doesNotMatch(lectura, /select \*|insert into|update |creado_en|actualizado_en/);
});

test("PIA-4: RLS cerrada y sin permisos directos de tabla para roles de API", () => {
  assert.match(compacto, /alter table public\.promociones enable row level security/);
  assert.match(compacto, /revoke all on table public\.promociones from public, anon, authenticated, service_role/);
  assert.doesNotMatch(compacto, /grant (?:all|select|insert|update|delete|truncate)[^;]*on (?:table )?public\.promociones/);
  assert.doesNotMatch(compacto, /create policy/);
});

test("PIA-4: RPC con dueño explícito, search_path fijo y permisos mínimos", () => {
  for (const [nombre, firma, roles] of [
    ["obtener_descuento_web", "uuid", "anon, authenticated, service_role"],
    ["admin_obtener_descuento_web", "uuid", "authenticated"],
    ["admin_actualizar_descuento_web", "uuid, uuid, jsonb", "authenticated"],
  ]) {
    assert.match(normalizar(funcion(sql, nombre)), /security definer set search_path to 'pg_catalog', 'public'/);
    assert.ok(compacto.includes(`alter function public.${nombre}(${firma}) owner to postgres;`));
    assert.ok(compacto.includes(`revoke all on function public.${nombre}(${firma}) from public, anon, authenticated, service_role;`));
    assert.ok(compacto.includes(`grant execute on function public.${nombre}(${firma}) to ${roles};`));
  }
  assert.match(compacto, /revoke all on function public\.inicializar_descuento_web_comercio\(\) from public, anon, authenticated, service_role/);
  assert.doesNotMatch(compacto, /grant execute on function public\.inicializar_descuento_web_comercio/);
});

test("PIA-4: consulta y escritura exigen sesión y owner/admin o super admin del comercio solicitado", () => {
  for (const cuerpo of [consulta, actualizar]) {
    assert.match(cuerpo, /if auth\.uid\(\) is null or not coalesce\( public\.es_super_admin_activo\(\) or public\.es_admin_de_comercio\(p_comercio_id\), false \) then raise exception/);
    assert.match(cuerpo, /using errcode = '42501'/);
    assert.match(cuerpo, /where comercio_id = p_comercio_id and clave = 'descuento_web'/);
    assert.match(cuerpo, /if not found then raise exception .* using errcode = 'P0002'/);
    assert.doesNotMatch(cuerpo, /es_personal_de_comercio|es_empleado_de_comercio/);
    assert.ok(cuerpo.indexOf("if auth.uid()") < cuerpo.indexOf("select * into"));
  }
  const admin = normalizar(funcion(base, "es_admin_de_comercio"));
  assert.match(admin, /user_id = auth\.uid\(\) and comercio_id = p_comercio_id and rol in \('owner', 'admin'\) and activo = true/);
});

test("PIA-4: actualización parcial estricta, sin cambiar identidad ni otros campos", () => {
  assert.match(actualizar, /p_cambios is null or jsonb_typeof\(p_cambios\) <> 'object' or p_cambios = '\{\}'::jsonb/);
  assert.match(actualizar, /if v_clave not in \('activa', 'valor'\) then raise exception/);
  assert.match(actualizar, /p_cambios \? 'activa' and jsonb_typeof\(p_cambios->'activa'\) <> 'boolean'/);
  assert.match(actualizar, /activa = case when p_cambios \? 'activa' then \(p_cambios->>'activa'\)::boolean else activa end/);
  assert.match(actualizar, /valor = case when p_cambios \? 'valor' then \(p_cambios->>'valor'\)::numeric else valor end/);
  assert.match(actualizar, /where comercio_id = p_comercio_id and clave = 'descuento_web' and id = v_fila\.id/);
});

test("PIA-4: conserva íntegra auditoria_iniciar_operacion excepto la entidad nueva", () => {
  const nuevo = funcion(sql, "auditoria_iniciar_operacion");
  const previo = funcion(anterior, "auditoria_iniciar_operacion");
  assert.equal(
    normalizar(nuevo).replace("'comercio_configuracion', 'promocion'", "'comercio_configuracion'"),
    normalizar(previo),
  );
  const entidades = texto => {
    const check = texto.match(/add constraint auditoria_eventos_entidad_check check \(([\s\S]*?)\);/);
    assert.ok(check);
    return [...check[1].matchAll(/'([^']+)'/g)].map(m => m[1]);
  };
  assert.deepEqual(entidades(sql), [...entidades(anterior), "promocion"]);
  assert.match(compacto, /revoke all on function public\.auditoria_iniciar_operacion\(uuid, uuid, text, uuid\) from public, anon, authenticated, service_role/);
});

test("PIA-4: bloqueo y auditoría antes/después dentro de la misma transacción", () => {
  assert.match(actualizar, /public\.auditoria_iniciar_operacion\( p_operacion_id, p_comercio_id, 'promocion', v_fila\.id \)/);
  assert.match(actualizar, /where comercio_id = p_comercio_id and clave = 'descuento_web' for update/);
  const inicio = actualizar.indexOf("public.auditoria_iniciar_operacion");
  const bloqueo = actualizar.indexOf("for update");
  const antes = actualizar.indexOf("v_anterior := to_jsonb(v_fila)");
  const escritura = actualizar.indexOf("update public.promociones set");
  const despues = actualizar.indexOf("v_nuevo := to_jsonb(v_fila)");
  assert.ok(inicio < bloqueo && bloqueo < antes && antes < escritura && escritura < despues);
  assert.match(actualizar, /public\.auditoria_finalizar_operacion\( p_operacion_id, 1, p_comercio_id, 'actualizar', 'promocion', v_fila\.id, v_anterior, v_nuevo \)/);
  assert.doesNotMatch(actualizar, /\bexception when\b/);
  assert.match(compacto, /before update on public\.promociones for each row execute function public\.clientes_actualizar_actualizado_en\(\)/);
});

test("PIA-4: reintento devuelve estado vigente sin otro cambio ni evento y rechaza otros valores", () => {
  const reintento = actualizar.slice(actualizar.indexOf("if not v_continuar then"), actualizar.indexOf("v_anterior :="));
  assert.match(reintento, /operacion_id = p_operacion_id and comercio_id = p_comercio_id and entidad = 'promocion' and registro_id = v_fila\.id and valores_nuevos @> p_cambios/);
  assert.match(reintento, /raise exception .* using errcode = '22023'/);
  assert.match(reintento, /return v_fila; end if;/);
  assert.doesNotMatch(reintento, /update public|auditoria_finalizar_operacion/);
  const auditoria = normalizar(funcion(sql, "auditoria_iniciar_operacion"));
  assert.match(auditoria, /pg_advisory_xact_lock\(hashtextextended\(p_operacion_id::text, 0\)\)/);
  for (const campo of ["actor", "comercio", "entidad", "registro"]) {
    assert.ok(auditoria.includes(`v_existente.${campo} is distinct from`));
  }
});
