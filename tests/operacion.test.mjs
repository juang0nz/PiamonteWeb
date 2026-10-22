// PIA-2: tiempos estimados configurables, pausa de pedidos y ruta de operación.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const raiz = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
function cargar(archivo, modulos = {}, globales = {}) {
  const codigo = ts.transpileModule(fs.readFileSync(path.join(raiz, archivo), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const modulo = { exports: {} };
  vm.runInNewContext(codigo, {
    exports: modulo.exports, module: modulo,
    require: nombre => {
      if (!(nombre in modulos)) throw new Error(`Módulo no simulado: ${nombre}`);
      return modulos[nombre];
    },
    URL, TextEncoder, console: { error() {}, info() {}, warn() {} },
    process: { env: {} }, ...globales,
  });
  return modulo.exports;
}

const NextResponse = {
  json: (body, opciones = {}) => ({ body, status: opciones.status ?? 200 }),
};

const tiempos = cargar("src/lib/comercio/tiempos.ts");
const celular = cargar("src/lib/checkout/celular.ts", {});
const checkout = cargar("src/lib/checkout/tipos.ts", { "./celular": celular });

test("formatearRango produce el texto que ve el cliente", () => {
  assert.equal(tiempos.formatearRango(15, 30), "15-30 min");
  assert.equal(tiempos.formatearRango(45, 60), "45-60 min");
  assert.equal(tiempos.formatearRango(30, 30), "30 min");
});

test("tiemposPorDemanda elige el rango del nivel vigente por modalidad", () => {
  const configuracion = {
    ...tiempos.CONFIGURACION_INICIAL,
    retiro_normal_min: 10, retiro_normal_max: 20,
    envio_normal_min: 30, envio_normal_max: 40,
    retiro_alta_min: 25, retiro_alta_max: 35,
    envio_alta_min: 50, envio_alta_max: 70,
  };
  const normal = tiempos.tiemposPorDemanda({ ...configuracion, demanda: "normal" });
  assert.equal(JSON.stringify(normal.retiro), JSON.stringify({ min: 10, max: 20, texto: "10-20 min" }));
  assert.equal(JSON.stringify(normal.envio), JSON.stringify({ min: 30, max: 40, texto: "30-40 min" }));
  const alta = tiempos.tiemposPorDemanda({ ...configuracion, demanda: "alta" });
  assert.equal(JSON.stringify(alta.retiro), JSON.stringify({ min: 25, max: 35, texto: "25-35 min" }));
  assert.equal(JSON.stringify(alta.envio), JSON.stringify({ min: 50, max: 70, texto: "50-70 min" }));
  // El nivel puede forzarse (lo usa el panel para previsualizar el otro nivel).
  assert.equal(tiempos.tiemposPorDemanda(configuracion, "alta").envio.texto, "50-70 min");
  // La modalidad de la base ("delivery") corresponde a los tiempos de envío.
  assert.equal(tiempos.rangoPorModalidad(alta, "delivery").texto, "50-70 min");
  assert.equal(tiempos.rangoPorModalidad(alta, "retiro").texto, "25-35 min");
});

test("validarRangos aplica la misma regla que el check de la tabla", () => {
  const base = Object.fromEntries(tiempos.CLAVES_RANGOS.map(clave => [clave, tiempos.CONFIGURACION_INICIAL[clave]]));
  assert.equal(Object.keys(tiempos.validarRangos(base)).length, 0);
  assert.ok(tiempos.validarRangos({ ...base, retiro_normal_min: -1 }).retiro_normal_min);
  assert.ok(tiempos.validarRangos({ ...base, envio_alta_max: 241 }).envio_alta_max);
  assert.ok(tiempos.validarRangos({ ...base, retiro_alta_min: 50, retiro_alta_max: 40 }).retiro_alta_max);
  assert.ok(tiempos.validarRangos({ ...base, envio_normal_min: 1.5 }).envio_normal_min);
});

function supabaseConPausa(pausado, alRpc) {
  const tablas = {
    comercios: [{ id: "comercio", slug: "piamonte", activo: true }],
    comercio_configuracion: [{ pedidos_pausados: pausado, mensaje_pausa: "Volvemos en un rato." }],
    categorias: [{ id: "categoria", comercio_id: "comercio", activa: true }],
    productos: [{ id: "producto", comercio_id: "comercio", categoria_id: "categoria", nombre: "Producto", precio_base: 100, disponible: true }],
    grupos_opciones: [], reglas_opciones_variante: [],
  };
  return {
    from: tabla => {
      const consulta = {
        select: () => consulta, eq: () => consulta, in: () => consulta,
        maybeSingle: async () => ({ data: tabla === "pedidos" ? { numero: 7 } : tablas[tabla][0], error: null }),
        then: resolver => Promise.resolve({ data: tablas[tabla], error: null }).then(resolver),
      };
      return consulta;
    },
    rpc: async (nombre, args) => {
      alRpc(nombre, args);
      return { data: [{
        pedido_id: "pedido-prueba", numero_pedido: 7, subtotal: args.p_subtotal,
        descuento: 0, costo_envio: args.p_costo_envio,
        total: args.p_subtotal + args.p_costo_envio,
        promocion_id: null, promocion_nombre: null, promocion_porcentaje: null,
      }], error: null };
    },
  };
}

function cargarRegistrar(supabase) {
  return cargar("src/lib/pedidos/registrar.ts", {
    "@/lib/catalogo/configurador": { limitesGrupo() { throw new Error("No hay grupos"); } },
    "@/lib/comercio/horarios": { obtenerEstadoApertura: () => ({ abierto: true }) },
    "@/lib/comercio/tiempos": tiempos,
    "@/lib/comercio/descuentos": cargar("src/lib/comercio/descuentos.ts"),
    "@/lib/supabase/server": { createClient: async () => supabase },
    "@/lib/supabase/private": { createPrivateClient: () => supabase },
    "@/lib/checkout/tipos": checkout, "@/lib/checkout/celular": celular,
  });
}

const inputPedido = {
  comercioSlug: "piamonte",
  checkout: { ...checkout.DATOS_INICIALES, tipoEntrega: "retiro", nombre: "Ana", telefono: "099 806 731" },
  items: [{ productoId: "producto", varianteId: null, cantidad: 1, aclaraciones: "", opciones: [] }],
};

test("Con pedidos pausados el servidor rechaza con 409 PEDIDOS_PAUSADOS sin llamar al RPC", async () => {
  let llamadas = 0;
  const registrar = cargarRegistrar(supabaseConPausa(true, () => { llamadas += 1; }));
  await assert.rejects(registrar.validarYRegistrarPedido(inputPedido), error => {
    assert.equal(error.name, "PedidoError");
    assert.equal(error.status, 409);
    assert.equal(error.code, "PEDIDOS_PAUSADOS");
    assert.equal(error.message, "Volvemos en un rato.");
    return true;
  });
  assert.equal(llamadas, 0);
});

test("Sin pausa el registro sigue su curso hasta el RPC", async () => {
  let nombreRpc = null;
  const registrar = cargarRegistrar(supabaseConPausa(false, nombre => { nombreRpc = nombre; }));
  const resultado = await registrar.validarYRegistrarPedido(inputPedido);
  assert.equal(nombreRpc, "registrar_pedido_desde_checkout");
  assert.equal(resultado.pedidoId, "pedido-prueba");
});

function cargarRutaOperacion({ rol, rpc, select, acceso, alSelect = () => {}, alFiltrar = () => {} }) {
  return cargar("src/app/api/admin/operacion/route.ts", {
    "next/cache": { revalidatePath() {} },
    "next/server": { NextResponse },
    "@/lib/admin/auth": {
      obtenerEstadoAccesoAdmin: async () => acceso ?? ({
        autenticado: true, autorizado: true, rol, comercioId: "comercio-autorizado",
      }),
    },
    "@/lib/comercio/tiempos": tiempos,
    "@/lib/supabase/server": {
      createClient: async () => ({
        rpc,
        from: () => {
          const consulta = {
            select: columnas => { alSelect(columnas); return consulta; },
            eq: (columna, valor) => { alFiltrar(columna, valor); return consulta; },
            maybeSingle: select,
          };
          return consulta;
        },
      }),
    },
  });
}

const OPERACION_ID = "33333333-3333-4333-8333-333333333333";

test("PATCH /api/admin/operacion llama la RPC auditada con el cliente de sesión y solo claves permitidas", async () => {
  let llamada = null;
  const fila = { ...tiempos.CONFIGURACION_INICIAL, demanda: "alta", actualizado_en: "2026-10-18T00:00:00Z" };
  const ruta = cargarRutaOperacion({
    rol: "owner",
    rpc: async (nombre, parametros) => { llamada = { nombre, parametros }; return { data: fila, error: null }; },
    select: async () => ({ data: fila, error: null }),
  });
  const respuesta = await ruta.PATCH({ json: async () => ({ cambios: { demanda: "alta" }, operacionId: OPERACION_ID }) });
  assert.equal(respuesta.status, 200);
  assert.equal(respuesta.body.configuracion.demanda, "alta");
  assert.equal(llamada.nombre, "admin_actualizar_configuracion_comercio");
  assert.equal(llamada.parametros.p_comercio_id, "comercio-autorizado");
  assert.equal(llamada.parametros.p_operacion_id, OPERACION_ID);
  assert.equal(JSON.stringify(llamada.parametros.p_cambios), JSON.stringify({ demanda: "alta" }));

  const invalida = await ruta.PATCH({ json: async () => ({ cambios: { clave_desconocida: 100 }, operacionId: OPERACION_ID }) });
  assert.equal(invalida.status, 400);
  const sinOperacion = await ruta.PATCH({ json: async () => ({ cambios: { demanda: "alta" } }) });
  assert.equal(sinOperacion.status, 400);
  const demandaInvalida = await ruta.PATCH({ json: async () => ({ cambios: { demanda: "media" }, operacionId: OPERACION_ID }) });
  assert.equal(demandaInvalida.status, 400);
});

test("PATCH /api/admin/operacion rechaza al rol empleado con 403 y traduce los errores de la RPC", async () => {
  let llamadas = 0;
  const empleado = cargarRutaOperacion({
    rol: "empleado",
    rpc: async () => { llamadas += 1; return { data: null, error: null }; },
    select: async () => ({ data: null, error: null }),
  });
  const respuesta = await empleado.PATCH({ json: async () => ({ cambios: { demanda: "alta" }, operacionId: OPERACION_ID }) });
  assert.equal(respuesta.status, 403);
  assert.equal((await empleado.GET()).status, 403);
  assert.equal(llamadas, 0);

  for (const [code, status] of [["22023", 400], ["42501", 403], ["P0002", 404], ["PGRST202", 503], ["XX000", 500]]) {
    const ruta = cargarRutaOperacion({
      rol: "admin",
      rpc: async () => ({ data: null, error: { code, message: "detalle", details: null, hint: null } }),
      select: async () => ({ data: null, error: null }),
    });
    const resultado = await ruta.PATCH({ json: async () => ({ cambios: { pedidos_pausados: true }, operacionId: OPERACION_ID }) });
    assert.equal(resultado.status, status, `código ${code}`);
  }
});

test("GET /api/admin/operacion devuelve la fila del comercio autorizado", async () => {
  const fila = { ...tiempos.CONFIGURACION_INICIAL, actualizado_en: "2026-10-18T00:00:00Z" };
  const ruta = cargarRutaOperacion({
    rol: "admin",
    rpc: async () => ({ data: null, error: null }),
    select: async () => ({ data: fila, error: null }),
  });
  const respuesta = await ruta.GET();
  assert.equal(respuesta.status, 200);
  assert.equal(respuesta.body.configuracion.pedidos_pausados, false);
});

test("Delivery valida importes sin errores binarios en centésimos y respeta numeric(12,2)", () => {
  for (const costo of [0, 0.01, 0.29, 1.1, 19.99, 9999999999.99]) {
    assert.equal(tiempos.validarCostoEnvio(costo), null, String(costo));
  }
  for (const costo of [-0.01, 0.001, 1.234, 10000000000, NaN, Infinity, -Infinity, null, "", "10", true]) {
    assert.ok(tiempos.validarCostoEnvio(costo), String(costo));
  }
});

test("Delivery usa la RPC auditada de sesión para owner, admin y super admin", async () => {
  for (const rol of ["owner", "admin", "super_admin"]) {
    let parametros;
    const fila = { ...tiempos.CONFIGURACION_INICIAL, costo_envio: 123.45 };
    const ruta = cargarRutaOperacion({
      rol,
      rpc: async (nombre, args) => {
        assert.equal(nombre, "admin_actualizar_configuracion_comercio");
        parametros = args;
        return { data: fila, error: null };
      },
      select: async () => ({ data: fila, error: null }),
    });
    const respuesta = await ruta.PATCH({ json: async () => ({
      cambios: { costo_envio: 123.45 }, operacionId: OPERACION_ID, comercioId: "otro",
    }) });
    assert.equal(respuesta.status, 200);
    assert.equal(respuesta.body.configuracion.costo_envio, 123.45);
    assert.equal(parametros.p_comercio_id, "comercio-autorizado");
    assert.equal(parametros.p_operacion_id, OPERACION_ID);
    assert.equal(JSON.stringify(parametros.p_cambios), '{"costo_envio":123.45}');
  }
});

test("Delivery rechaza importes inválidos y accesos sin permiso antes de llamar a la RPC", async () => {
  const rpc = async () => { assert.fail("No debe ejecutar la RPC"); };
  const ruta = cargarRutaOperacion({ rol: "admin", rpc });
  for (const costo of [-1, 0.001, 10000000000, NaN, Infinity, null, "", "10.25", true, {}]) {
    const respuesta = await ruta.PATCH({ json: async () => ({
      cambios: { costo_envio: costo }, operacionId: OPERACION_ID,
    }) });
    assert.equal(respuesta.status, 400, String(costo));
    assert.match(respuesta.body.error, /UYU/);
  }
  for (const [acceso, status] of [
    [{ autenticado: false }, 401],
    [{ autenticado: true, autorizado: false }, 403],
    [{ autenticado: true, autorizado: true, rol: "empleado" }, 403],
  ]) {
    const sinAcceso = cargarRutaOperacion({ acceso, rpc });
    assert.equal((await sinAcceso.GET()).status, status);
    assert.equal((await sinAcceso.PATCH({ json: async () => ({
      cambios: { costo_envio: 10 }, operacionId: OPERACION_ID,
    }) })).status, status);
  }
});

test("GET incluye la tarifa real y filtra por comercio; migración pendiente produce error explícito", async () => {
  const fila = { ...tiempos.CONFIGURACION_INICIAL, costo_envio: 75.5 };
  const ruta = cargarRutaOperacion({
    rol: "admin",
    alSelect: columnas => assert.ok(columnas.split(", ").includes("costo_envio")),
    alFiltrar: (columna, valor) => {
      assert.equal(columna, "comercio_id");
      assert.equal(valor, "comercio-autorizado");
    },
    select: async () => ({ data: fila, error: null }),
  });
  assert.equal((await ruta.GET()).body.configuracion.costo_envio, 75.5);
  for (const code of ["42703", "PGRST204"]) {
    const error = { code, message: "columna no disponible", details: null, hint: null };
    const pendiente = cargarRutaOperacion({
      rol: "admin",
      select: async () => ({ data: null, error }),
      rpc: async () => ({ data: null, error }),
    });
    const respuestas = [
      await pendiente.GET(),
      await pendiente.PATCH({ json: async () => ({
        cambios: { costo_envio: 0 }, operacionId: OPERACION_ID,
      }) }),
    ];
    for (const respuesta of respuestas) {
      assert.equal(respuesta.status, 503);
      assert.match(respuesta.body.error, /migración de PIA-3/);
      assert.equal(respuesta.body.configuracion, undefined);
    }
  }
});

// Doble mínimo de hooks y JSX para ejercitar eventos sin navegador ni conexiones reales.
async function cargarPanelDelivery(responderGuardado) {
  const estados = [];
  let indice = 0;
  let efecto;
  const solicitudes = [];
  const jsx = (type, props) => ({ type, props });
  const fila = { ...tiempos.CONFIGURACION_INICIAL, costo_envio: 25.5 };
  const panel = cargar("src/components/admin/PanelOperacionAdmin.tsx", {
    "./ConfiguracionDescuentoWeb": { ConfiguracionDescuentoWeb: () => null },
    react: {
      useState: inicial => {
        const posicion = indice++;
        if (!(posicion in estados)) estados[posicion] = typeof inicial === "function" ? inicial() : inicial;
        return [estados[posicion], valor => {
          estados[posicion] = typeof valor === "function" ? valor(estados[posicion]) : valor;
        }];
      },
      useCallback: callback => callback,
      useEffect: callback => { efecto ??= callback; },
    },
    "react/jsx-runtime": { jsx, jsxs: jsx },
    "@/lib/comercio/tiempos": tiempos,
  }, {
    crypto: { randomUUID: () => OPERACION_ID },
    window: { setTimeout: callback => { callback(); return 1; }, clearTimeout() {} },
    fetch: async (_url, opciones) => {
      if (opciones.method !== "PATCH") return { ok: true, json: async () => ({ configuracion: fila }) };
      solicitudes.push(JSON.parse(opciones.body));
      return responderGuardado(solicitudes.at(-1), fila);
    },
  });
  const render = () => { indice = 0; return panel.PanelOperacionAdmin(); };
  render();
  efecto();
  await new Promise(resolve => setImmediate(resolve));
  function nodos(nodo, predicado) {
    if (!nodo || typeof nodo !== "object") return [];
    if (Array.isArray(nodo)) return nodo.flatMap(hijo => nodos(hijo, predicado));
    return [...(predicado(nodo) ? [nodo] : []), ...nodos(nodo.props?.children, predicado)];
  }
  const buscar = predicado => nodos(render(), predicado);
  const formulario = () => buscar(nodo => nodo.type === "form")[0];
  const editar = valor => {
    const campo = nodos(formulario(), nodo => nodo.type === "input")[0];
    campo.props.onChange({ target: { value: valor } });
  };
  const guardar = () => formulario().props.onSubmit({ preventDefault() {} });
  return { buscar, editar, guardar, solicitudes };
}

test("Panel Delivery carga UYU, acepta coma y guarda solo tarifa con confirmación", async () => {
  let completar;
  const panel = await cargarPanelDelivery(async (cuerpo, fila) => {
    await new Promise(resolve => { completar = resolve; });
    return { ok: true, json: async () => ({ configuracion: { ...fila, ...cuerpo.cambios } }) };
  });
  assert.ok(panel.buscar(nodo => nodo.type === "span" && nodo.props.children === "Costo de envío (UYU)").length);
  panel.editar("123,45");
  panel.guardar();
  assert.deepEqual(panel.solicitudes, [{ cambios: { costo_envio: 123.45 }, operacionId: OPERACION_ID }]);
  assert.ok(panel.buscar(nodo => nodo.type === "input" && nodo.props.inputMode === "decimal")[0].props.disabled);
  completar();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(panel.buscar(nodo => nodo.props?.role === "status")[0].props.children, "Costo de envío guardado correctamente.");
  assert.equal(panel.buscar(nodo => nodo.type === "input" && nodo.props.inputMode === "decimal")[0].props.value, "123.45");
});

test("Panel Delivery rechaza campos vacíos, negativos, exponentes y más de dos decimales", async () => {
  const panel = await cargarPanelDelivery(() => { assert.fail("No debe guardar"); });
  for (const valor of ["", " ", "-1", "1.234", "1e2", "Infinity", "10000000000"]) {
    panel.editar(valor);
    panel.guardar();
    assert.equal(panel.solicitudes.length, 0);
    assert.ok(panel.buscar(nodo => nodo.props?.role === "alert").length);
    assert.equal(panel.buscar(nodo => nodo.type === "input" && nodo.props.inputMode === "decimal")[0].props["aria-invalid"], true);
  }
});

test("Panel Delivery muestra fallos de guardado sin éxito ni pérdida del borrador", async () => {
  const panel = await cargarPanelDelivery(async () => ({
    ok: false, json: async () => ({ error: "Falta aplicar la migración de PIA-3." }),
  }));
  panel.editar("0");
  panel.guardar();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(panel.buscar(nodo => nodo.props?.role === "status").length, 0);
  assert.equal(panel.buscar(nodo => nodo.props?.role === "alert")[0].props.children, "Falta aplicar la migración de PIA-3.");
  assert.equal(panel.buscar(nodo => nodo.type === "input" && nodo.props.inputMode === "decimal")[0].props.value, "0");
});
