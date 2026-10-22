import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

function cargar(archivo, modulos = {}, globales = {}) {
  const codigo = ts.transpileModule(
    fs.readFileSync(new URL(`../${archivo}`, import.meta.url), "utf8"),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX } },
  ).outputText;
  const modulo = { exports: {} };
  vm.runInNewContext(codigo, {
    exports: modulo.exports, module: modulo,
    require: nombre => {
      assert.ok(nombre in modulos, `Módulo no simulado: ${nombre}`);
      return modulos[nombre];
    },
    console: { error() {} }, Error, ...globales,
  });
  return modulo.exports;
}

const contrato = cargar("src/lib/comercio/descuento-web.ts");
const OPERACION = "00000000-0000-4000-8000-000000000001";
const fila = { comercio_id: "comercio", clave: "descuento_web", activa: false, valor: 0 };
function ruta({ acceso = { autenticado: true, autorizado: true, rol: "admin", comercioId: "comercio" }, error = null, data = fila } = {}) {
  const llamadas = [];
  const invalidaciones = [];
  const modulo = cargar("src/app/api/admin/operacion/descuento-web/route.ts", {
    "next/server": { NextResponse: { json: (body, opciones = {}) => ({ body, status: opciones.status ?? 200, headers: opciones.headers }) } },
    "next/cache": { revalidatePath: path => invalidaciones.push(path) },
    "@/lib/admin/auth": { obtenerEstadoAccesoAdmin: async () => acceso },
    "@/lib/comercio/descuento-web": contrato,
    "@/lib/supabase/server": { createClient: async () => ({
      rpc: async (nombre, parametros) => { llamadas.push({ nombre, parametros }); return { data, error }; },
    }) },
  });
  return { ...modulo, llamadas, invalidaciones };
}
const solicitud = (cambios = { activa: true, valor: 10 }, extra = {}) => ({
  json: async () => ({ operacionId: OPERACION, cambios, ...extra }),
});

test("Descuento web admite solo porcentaje entero 0–100 y estado booleano", () => {
  for (const valor of [0, 10, 100]) assert.equal(contrato.esConfiguracionDescuentoWeb({ activa: false, valor }), true);
  for (const valor of [-1, 101, 0.5, NaN, Infinity, "10", null, undefined, true]) {
    assert.equal(contrato.esConfiguracionDescuentoWeb({ activa: false, valor }), false);
  }
  for (const activa of [null, undefined, "true", 0]) {
    assert.equal(contrato.esConfiguracionDescuentoWeb({ activa, valor: 10 }), false);
  }
});

test("GET/PATCH usan sesión, RPC auditada y comercio autorizado para owner/admin/super admin", async () => {
  for (const rol of ["owner", "admin", "super_admin"]) {
    const escenario = ruta({ acceso: { autenticado: true, autorizado: true, rol, comercioId: "comercio" } });
    const lectura = await escenario.GET();
    assert.equal(lectura.status, 200);
    assert.deepEqual({ ...lectura.body.descuentoWeb }, { activa: false, valor: 0 });
    assert.equal(lectura.body.descuentoWeb.comercio_id, undefined);
    assert.equal(lectura.headers["Cache-Control"], "private, no-store");
    for (const valor of [0, 10, 100]) {
      const escritura = await escenario.PATCH(solicitud({ activa: true, valor }, { comercioId: "ajeno" }));
      assert.equal(escritura.status, 200);
      const llamada = escenario.llamadas.at(-1);
      assert.equal(llamada.nombre, "admin_actualizar_descuento_web");
      assert.equal(llamada.parametros.p_comercio_id, "comercio");
      assert.equal(llamada.parametros.p_operacion_id, OPERACION);
      assert.deepEqual({ ...llamada.parametros.p_cambios }, { activa: true, valor });
    }
    assert.equal(escenario.llamadas[0].nombre, "admin_obtener_descuento_web");
    assert.deepEqual(escenario.invalidaciones, ["/", "/checkout", "/", "/checkout", "/", "/checkout"]);
  }
});

test("Sesión ausente, empleado y acceso ajeno no ejecutan consultas ni cambios", async () => {
  for (const [acceso, status] of [
    [{ autenticado: false }, 401],
    [{ autenticado: true, autorizado: false }, 403],
    [{ autenticado: true, autorizado: true, rol: "empleado", comercioId: "comercio" }, 403],
  ]) {
    const escenario = ruta({ acceso });
    assert.equal((await escenario.GET()).status, status);
    assert.equal((await escenario.PATCH(solicitud())).status, status);
    assert.equal(escenario.llamadas.length, 0);
  }
});

test("API rechaza cuerpos, tipos, porcentajes, claves e identificadores inválidos antes de la RPC", async () => {
  const escenario = ruta();
  for (const valor of [-1, 101, 10.5, null, "10", NaN, Infinity, true]) {
    assert.equal((await escenario.PATCH(solicitud({ activa: true, valor }))).status, 400);
  }
  for (const cambios of [null, [], {}, { valor: 10 }, { activa: true }, { activa: "true", valor: 10 }, { activa: true, valor: 10, nombre: "Otro" }]) {
    assert.equal((await escenario.PATCH(solicitud(cambios))).status, 400);
  }
  for (const cuerpo of [null, [], 1, { operacionId: "no-uuid" }, { operacionId: null }]) {
    assert.equal((await escenario.PATCH({ json: async () => cuerpo })).status, 400);
  }
  assert.equal((await escenario.PATCH({ json: async () => { throw new SyntaxError(); } })).status, 400);
  assert.equal(escenario.llamadas.length, 0);
});

test("API informa falta de migración, errores SQL y respuestas inválidas, sin configuración inventada", async () => {
  for (const [code, status] of [
    ["PGRST202", 503], ["42P01", 503], ["42703", 503], ["PGRST204", 503],
    ["42501", 403], ["22023", 400], ["P0002", 404], ["XX000", 500],
  ]) {
    const escenario = ruta({ error: { code, message: "Error SQL" }, data: null });
    for (const respuesta of [await escenario.GET(), await escenario.PATCH(solicitud())]) {
      assert.equal(respuesta.status, status);
      assert.ok(respuesta.body.error);
      assert.equal(respuesta.body.descuentoWeb, undefined);
    }
    assert.equal(escenario.invalidaciones.length, 0);
  }
  for (const data of [null, [], {}, { ...fila, comercio_id: "ajeno" }, { ...fila, clave: "otra" }, { ...fila, valor: 1.5 }]) {
    const escenario = ruta({ data });
    assert.equal((await escenario.GET()).status, 502);
    assert.equal((await escenario.PATCH(solicitud())).status, 502);
  }
});

function nodos(nodo, predicado) {
  if (!nodo || typeof nodo !== "object") return [];
  if (Array.isArray(nodo)) return nodo.flatMap(hijo => nodos(hijo, predicado));
  return [...(predicado(nodo) ? [nodo] : []), ...nodos(nodo.props?.children, predicado)];
}
const tick = () => new Promise(resolve => setImmediate(resolve));
async function panel({ leer = () => ({ ok: true, json: async () => ({ descuentoWeb: { activa: false, valor: 0 } }) }), guardar } = {}) {
  const estados = [];
  const refs = [];
  let indice = 0;
  let indiceRef = 0;
  let efecto;
  let ids = 0;
  const llamadas = [];
  const jsx = (type, props) => ({ type, props });
  const modulo = cargar("src/components/admin/ConfiguracionDescuentoWeb.tsx", {
    react: {
      useState: inicial => {
        const posicion = indice++;
        if (!(posicion in estados)) estados[posicion] = typeof inicial === "function" ? inicial() : inicial;
        return [estados[posicion], valor => { estados[posicion] = typeof valor === "function" ? valor(estados[posicion]) : valor; }];
      },
      useRef: inicial => { const posicion = indiceRef++; refs[posicion] ??= { current: inicial }; return refs[posicion]; },
      useCallback: callback => callback,
      useEffect: callback => { efecto ??= callback; },
    },
    "react/jsx-runtime": { jsx, jsxs: jsx },
    "@/lib/comercio/descuento-web": contrato,
  }, {
    crypto: { randomUUID: () => `operacion-${++ids}` },
    window: { setTimeout: callback => { callback(); return 1; }, clearTimeout() {} },
    fetch: async (url, opciones) => {
      assert.equal(url, "/api/admin/operacion/descuento-web");
      if (opciones.method !== "PATCH") return leer();
      assert.equal(opciones.credentials, "same-origin");
      const cuerpo = JSON.parse(opciones.body);
      llamadas.push(cuerpo);
      return guardar ? guardar(cuerpo) : { ok: true, json: async () => ({ descuentoWeb: cuerpo.cambios }) };
    },
  });
  const render = () => { indice = 0; indiceRef = 0; return modulo.ConfiguracionDescuentoWeb(); };
  const buscar = predicado => nodos(render(), predicado);
  render(); efecto(); await tick();
  const editar = valor => buscar(n => n.type === "input" && n.props.type === "text")[0].props.onChange({ target: { value: valor } });
  const activar = checked => buscar(n => n.type === "input" && n.props.type === "checkbox")[0].props.onChange({ target: { checked } });
  const enviar = () => buscar(n => n.type === "form")[0].props.onSubmit({ preventDefault() {} });
  return { buscar, editar, activar, enviar, llamadas };
}

test("Interfaz carga desactivado al 0%, guarda 0/10/100 y permite desactivar sin perder porcentaje", async () => {
  const vista = await panel();
  assert.equal(vista.buscar(n => typeof n.props?.children === "string" && n.props.children.includes("PIA-4 en integración")).length, 0);
  assert.equal(vista.buscar(n => n.type === "input" && n.props.type === "text")[0].props.value, "0");
  assert.equal(vista.buscar(n => n.type === "input" && n.props.type === "checkbox")[0].props.checked, false);
  for (const valor of [0, 10, 100]) {
    vista.editar(String(valor)); vista.activar(true); await vista.enviar();
    assert.deepEqual(vista.llamadas.at(-1).cambios, { activa: true, valor });
    assert.match(vista.buscar(n => n.props?.role === "status")[0].props.children, /guardado: activo/);
  }
  vista.activar(false); await vista.enviar();
  assert.deepEqual(vista.llamadas.at(-1).cambios, { activa: false, valor: 100 });
  assert.match(vista.buscar(n => n.props?.role === "status")[0].props.children, /desactivado, 100 %/);
});

test("Interfaz rechaza vacíos, decimales, exponentes, negativos y porcentajes fuera de rango", async () => {
  const vista = await panel();
  for (const valor of ["", " ", "-1", "101", "1.5", "1,5", "10.0", "1e2", "Infinity"]) {
    vista.editar(valor); await vista.enviar();
    assert.equal(vista.llamadas.length, 0);
    assert.ok(vista.buscar(n => n.props?.role === "alert").length);
    assert.equal(vista.buscar(n => n.type === "input" && n.props.type === "text")[0].props["aria-invalid"], true);
  }
});

test("Interfaz bloquea guardado duplicado y controles hasta confirmar resultado", async () => {
  let completar;
  const vista = await panel({ guardar: cuerpo => new Promise(resolve => {
    completar = () => resolve({ ok: true, json: async () => ({ descuentoWeb: cuerpo.cambios }) });
  }) });
  vista.editar("25"); vista.activar(true);
  const pendiente = vista.enviar();
  await vista.enviar();
  assert.equal(vista.llamadas.length, 1);
  assert.ok(vista.buscar(n => n.type === "input").every(n => n.props.disabled));
  assert.equal(vista.buscar(n => n.type === "button" && n.props.type === "submit")[0].props.disabled, true);
  completar(); await pendiente;
  assert.ok(vista.buscar(n => n.type === "input").every(n => !n.props.disabled));
});

test("Interfaz conserva borrador y operación al reintentar un fallo, sin mostrar éxito", async () => {
  let falla = true;
  const vista = await panel({ guardar: cuerpo => {
    if (falla) throw new Error("Sin conexión");
    return { ok: true, json: async () => ({ descuentoWeb: cuerpo.cambios }) };
  } });
  vista.editar("20"); vista.activar(true); await vista.enviar();
  assert.equal(vista.buscar(n => n.props?.role === "status").length, 0);
  assert.equal(vista.buscar(n => n.type === "input" && n.props.type === "text")[0].props.value, "20");
  assert.match(vista.buscar(n => n.props?.role === "alert")[0].props.children, /Sin conexión/);
  falla = false; await vista.enviar();
  assert.equal(vista.llamadas[0].operacionId, vista.llamadas[1].operacionId);
  vista.editar("21"); await vista.enviar();
  assert.notEqual(vista.llamadas[1].operacionId, vista.llamadas[2].operacionId);
});

test("Interfaz informa errores de migración o respuesta, sin simular configuración inicial", async () => {
  for (const leer of [
    () => ({ ok: false, json: async () => ({ error: "Falta aplicar la migración de PIA-4." }) }),
    () => ({ ok: true, json: async () => ({}) }),
  ]) {
    const vista = await panel({ leer });
    assert.equal(vista.buscar(n => n.type === "form").length, 0);
    assert.ok(vista.buscar(n => n.props?.role === "alert").length);
    assert.equal(vista.buscar(n => n.type === "button")[0].props.children, "Reintentar descuento web");
  }
});

test("Interfaz no confirma guardado ante respuesta inválida o error de permisos", async () => {
  for (const respuesta of [
    { ok: true, json: async () => ({ descuentoWeb: { activa: true, valor: 1.5 } }) },
    { ok: false, json: async () => ({ error: "No tenés permisos." }) },
    { ok: true, json: async () => { throw new SyntaxError("JSON inválido"); } },
  ]) {
    const vista = await panel({ guardar: () => respuesta });
    vista.editar("10"); await vista.enviar();
    assert.equal(vista.buscar(n => n.props?.role === "status").length, 0);
    assert.equal(vista.buscar(n => n.type === "input" && n.props.type === "text")[0].props.value, "10");
    assert.ok(vista.buscar(n => n.props?.role === "alert").length);
  }
});
