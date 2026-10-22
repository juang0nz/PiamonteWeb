import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

function cargar(archivo, modulos = {}, globales = {}) {
  const codigo = ts.transpileModule(
    fs.readFileSync(new URL(`../${archivo}`, import.meta.url), "utf8"),
    { compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX,
    } },
  ).outputText;
  const modulo = { exports: {} };
  vm.runInNewContext(codigo, {
    exports: modulo.exports, module: modulo,
    require: nombre => {
      assert.ok(nombre in modulos, `Módulo no simulado: ${nombre}`);
      return modulos[nombre];
    },
    console: { info() {}, error() {} }, ...globales,
  });
  return modulo.exports;
}
const pagos = cargar("src/lib/admin/pagos.ts");
const formato = cargar("src/lib/catalogo/formato.ts");
const jsx = (type, props) => ({ type, props });
const runtime = { jsx, jsxs: jsx };
const NextResponse = { json: (body, opciones = {}) => ({ body, status: opciones.status ?? 200 }) };
const esperar = () => new Promise(resolve => setImmediate(resolve));
function nodos(nodo, predicado) {
  if (!nodo || typeof nodo !== "object") return [];
  if (Array.isArray(nodo)) return nodo.flatMap(hijo => nodos(hijo, predicado));
  return [...(predicado(nodo) ? [nodo] : []), ...nodos(nodo.props?.children, predicado)];
}
function texto(nodo) {
  if (nodo === null || nodo === undefined || typeof nodo === "boolean") return "";
  if (Array.isArray(nodo)) return nodo.map(texto).join(" ");
  return typeof nodo === "object" ? texto(nodo.props?.children) : String(nodo);
}
const fila = {
  id: "pedido", numero: 42, creado_en: "2026-10-20T12:00:00Z",
  modalidad: "delivery", metodo_pago: "tarjeta_pos",
  subtotal: "100.25", costo_envio: "20.50", total: "120.75",
  descuento: "0", promocion_id: null, promocion_nombre: null, promocion_porcentaje: null,
  cliente_nombre: "Ana", cliente_telefono: "+59899806731", estado: "pendiente",
};
const rutas = ["src/app/api/admin/pedidos/route.ts", "src/app/api/admin/pedidos/sin-revisar/route.ts"];
function ruta(archivo, acceso, error = null, pedidos = [fila]) {
  const consultas = [];
  const modulo = cargar(archivo, {
    "next/server": { NextResponse },
    "@/lib/admin/auth": { obtenerEstadoAccesoAdmin: async () => acceso },
    "@/lib/supabase/private": { createPrivateClient: () => ({
      from: tabla => {
        assert.ok(acceso.autenticado && acceso.autorizado, "No usar cliente privado sin autorización");
        const consulta = {
          select: columnas => { consultas.push([tabla, "select", columnas]); return consulta; },
          eq: (columna, valor) => { consultas.push([tabla, columna, valor]); return consulta; },
          is: (columna, valor) => { consultas.push([tabla, columna, valor]); return consulta; },
          in: () => consulta, order: () => consulta, limit: () => consulta,
          then: resolver => Promise.resolve({
            data: error ? null : tabla === "pedidos" ? pedidos : [], error,
          }).then(resolver),
        };
        return consulta;
      },
    }) },
  });
  return { ...modulo, consultas };
}

test("API de pedidos y avisos conserva permisos y filtros para owner, admin, empleado y super admin", async () => {
  for (const archivo of rutas) {
    for (const rol of ["owner", "admin", "empleado", "super_admin"]) {
      const endpoint = ruta(archivo, { autenticado: true, autorizado: true, rol, comercioId: "comercio" });
      const respuesta = await endpoint.GET();
      assert.equal(respuesta.status, 200);
      assert.ok(endpoint.consultas.some(([tabla, clave, valor]) =>
        tabla === "pedidos" && clave === "comercio_id" && valor === "comercio"));
      const pedido = respuesta.body.pedidos[0];
      assert.equal(pedido.metodoPago, "tarjeta_pos");
      assert.equal(pedido.modalidad, "delivery");
      const columnas = endpoint.consultas.find(([, clave]) => clave === "select")[2];
      assert.ok(columnas.includes("metodo_pago"));
      if (archivo === rutas[0]) {
        for (const columna of ["subtotal", "descuento", "promocion_id", "promocion_nombre", "promocion_porcentaje", "costo_envio", "total"]) assert.ok(columnas.includes(columna));
        assert.equal(pedido.subtotal, 100.25);
        assert.equal(pedido.descuento, 0);
        assert.equal(pedido.promocion, null);
        assert.equal(pedido.costoEnvio, 20.5);
        assert.equal(pedido.total, 120.75);
      } else {
        assert.ok(endpoint.consultas.some(([, clave, valor]) => clave === "revisado_en" && valor === null));
      }
    }
    for (const [acceso, status] of [
      [{ autenticado: false }, 401],
      [{ autenticado: true, autorizado: false }, 403],
    ]) {
      const endpoint = ruta(archivo, acceso);
      assert.equal((await endpoint.GET()).status, status);
      assert.equal(endpoint.consultas.length, 0);
    }
    const fallo = ruta(archivo, { autenticado: true, autorizado: true, comercioId: "comercio" }, { code: "XX000", message: "Fallo" });
    assert.equal((await fallo.GET()).status, 500);
  }
});

test("Etiquetas claras y Llevar POS solo para delivery con tarjeta_pos, sin reinterpretar históricos", () => {
  assert.equal(pagos.etiquetaMetodoPago("efectivo"), "Efectivo");
  assert.equal(pagos.etiquetaMetodoPago("tarjeta_pos"), "Tarjeta (POS)");
  assert.equal(pagos.etiquetaMetodoPago("pago_en_local"), "Pago en el local");
  assert.equal(pagos.etiquetaMetodoPago("mercado_pago"), "Método histórico: mercado_pago");
  for (const modalidad of ["delivery", "retiro"]) {
    for (const metodo of ["efectivo", "tarjeta_pos", "pago_en_local", "mercado_pago"]) {
      assert.equal(pagos.requierePos(modalidad, metodo), modalidad === "delivery" && metodo === "tarjeta_pos");
    }
  }
});

function panel(pedido, puedeCancelar = true) {
  const estados = ["pendiente", false, null, null, pedido ? [pedido] : [], null, null, null];
  let indice = 0;
  const modulo = cargar("src/components/admin/PanelPedidosAdmin.tsx", {
    react: {
      useState: () => { const i = indice++; return [estados[i], valor => { estados[i] = valor; }]; },
      useCallback: valor => valor, useMemo: callback => callback(), useEffect() {},
    },
    "react/jsx-runtime": runtime,
    "@/lib/admin/notificacionesPedidos": { EVENTO_PEDIDOS_NUEVOS: "prueba" },
    "@/lib/admin/pagos": pagos, "@/lib/catalogo/formato": formato,
    "@/lib/checkout/celular": { normalizarCelularUruguayo: () => null },
    "@/lib/comercio": { mensajePedidoAceptadoWhatsApp: () => "" },
    "@/lib/comercio/tiempos": { formatearRango: () => "" },
  });
  return modulo.PanelPedidosAdmin({ puedeCancelar });
}

test("Tarjeta y detalle muestran pago y aviso POS, con desglose UYU y permisos de empleado intactos", () => {
  for (const [modalidad, metodoPago, etiqueta, cantidadAvisos] of [
    ["delivery", "tarjeta_pos", "Tarjeta (POS)", 2],
    ["delivery", "efectivo", "Efectivo", 0],
    ["retiro", "pago_en_local", "Pago en el local", 0],
    ["retiro", "tarjeta_pos", "Tarjeta (POS)", 0],
    ["delivery", "mercado_pago", "Método histórico: mercado_pago", 0],
  ]) {
    const resultado = panel({
      id: "pedido", numero: 42, creadoEn: fila.creado_en, estado: "pendiente",
      clienteNombre: "Ana", clienteTelefono: "", modalidad, metodoPago,
      subtotal: 100.25, costoEnvio: 20.5, total: 120.75, direccion: {}, items: [],
      descuento: 0, promocion: null,
    }, false);
    assert.equal(nodos(resultado, nodo => nodo.type === "p" && nodo.props.children === "Llevar POS").length, cantidadAvisos);
    const tarjeta = nodos(resultado, nodo => nodo.type === "article")[0];
    const detalle = nodos(resultado, nodo => nodo.type === "aside")[0];
    assert.ok(texto(tarjeta).includes(etiqueta));
    assert.ok(texto(detalle).includes(etiqueta));
    for (const concepto of ["Subtotal", "Envío", "Total"]) assert.ok(texto(detalle).includes(concepto));
    for (const monto of [100.25, 20.5, 120.75]) assert.ok(texto(detalle).includes(formato.formatearImporteUYU(monto)));
    assert.ok(!texto(resultado).includes("Cancelar pedido"));
    assert.ok(texto(resultado).includes("Aceptar pedido"));
  }
  assert.ok(texto(panel(null)).includes("Seleccioná un pedido"));
});

test("API administrativa expone la instantánea del pedido sin consultar la promoción ni tarifa vigentes", async () => {
  const registros = [
    { ...fila, id: "historico" },
    ...[0, 10, 100].flatMap(porcentaje => ["delivery", "retiro"].map(modalidad => ({
      ...fila, id: `${modalidad}-${porcentaje}`, modalidad,
      metodo_pago: modalidad === "delivery" ? "tarjeta_pos" : "pago_en_local",
      descuento: String(porcentaje),
      costo_envio: modalidad === "retiro" ? "0" : "20.50",
      subtotal: "100", total: String(100 - porcentaje + (modalidad === "retiro" ? 0 : 20.5)),
      promocion_id: "promo-guardada", promocion_nombre: "Nombre original del pedido",
      promocion_porcentaje: String(porcentaje),
    }))),
  ];
  for (const rol of ["owner", "admin", "empleado", "super_admin"]) {
    const endpoint = ruta(rutas[0], { autenticado: true, autorizado: true, rol, comercioId: "comercio" }, null, registros);
    const resultado = await endpoint.GET();
    assert.equal(resultado.status, 200);
    const historico = resultado.body.pedidos[0];
    assert.equal(historico.subtotal, 100.25);
    assert.equal(historico.descuento, 0);
    assert.equal(historico.promocion, null);
    assert.equal(historico.total, 120.75);
    for (const [indice, registro] of registros.entries()) {
      const pedido = resultado.body.pedidos[indice];
      assert.equal(pedido.descuento, Number(registro.descuento));
      assert.equal(pedido.costoEnvio, Number(registro.costo_envio));
      assert.equal(pedido.total, Number(registro.total));
      assert.equal(pedido.modalidad, registro.modalidad);
      assert.equal(pedido.metodoPago, registro.metodo_pago);
      if (registro.promocion_id !== null) {
        assert.deepEqual({ ...pedido.promocion }, {
          id: registro.promocion_id, nombre: registro.promocion_nombre,
          porcentaje: Number(registro.promocion_porcentaje),
        });
      }
    }
    assert.ok(endpoint.consultas.every(([tabla]) =>
      ["pedidos", "pedido_items", "pedido_item_opciones"].includes(tabla)));
  }
});

test("Detalle conserva históricos, instantánea activa al 0 %, envío íntegro y retiro al 100 % con total cero", () => {
  for (const porcentaje of [null, 0, 10, 100]) {
    for (const modalidad of ["delivery", "retiro"]) {
      const descuento = porcentaje ?? 0;
      const costoEnvio = modalidad === "delivery" ? 20.5 : 0;
      const total = 100 - descuento + costoEnvio;
      const pedido = {
        id: "pedido", numero: 42, creadoEn: fila.creado_en, estado: "pendiente",
        clienteNombre: "Ana", clienteTelefono: "", modalidad,
        metodoPago: modalidad === "delivery" ? "tarjeta_pos" : "pago_en_local",
        subtotal: 100, descuento, costoEnvio, total, direccion: {}, items: [],
        promocion: porcentaje === null ? null : {
          id: "promo-guardada", nombre: "Promoción original <sin interpretar HTML>", porcentaje,
        },
      };
      const resultado = panel(pedido, false);
      const detalle = nodos(resultado, nodo => nodo.type === "aside")[0];
      const tarjeta = nodos(resultado, nodo => nodo.type === "article")[0];
      const vista = texto(detalle);
      for (const concepto of ["Subtotal bruto de productos", "Descuento aplicado", "Envío", "Total confirmado"]) {
        assert.ok(vista.includes(concepto));
      }
      for (const monto of [100, descuento, costoEnvio, total]) {
        assert.ok(vista.includes(formato.formatearImporteUYU(monto)));
      }
      assert.ok(texto(tarjeta).includes(formato.formatearImporteUYU(total)));
      const renglones = nodos(detalle, nodo => nodo.type === "div");
      const renglón = etiqueta => renglones.find(nodo => nodos(nodo, hijo => hijo.type === "dt" && texto(hijo) === etiqueta).length);
      assert.ok(texto(renglón("Total confirmado")).includes(formato.formatearImporteUYU(total)));
      assert.ok(texto(renglón("Envío")).includes(formato.formatearImporteUYU(costoEnvio)));
      if (porcentaje === null) {
        assert.match(vista, /Sin promoción aplicada/);
        assert.doesNotMatch(vista, /Condiciones guardadas/);
      } else {
        assert.ok(vista.includes(pedido.promocion.nombre));
        assert.match(vista, new RegExp(`${porcentaje}\\s+%`));
        assert.match(vista, /Condiciones guardadas al registrar/);
        assert.doesNotMatch(vista, /Sin promoción aplicada/);
      }
      assert.ok(!texto(resultado).includes("Cancelar pedido"));
      assert.ok(texto(resultado).includes("Aceptar pedido"));
      assert.equal(nodos(resultado, nodo => nodo.type === "p" && nodo.props.children === "Llevar POS").length,
        modalidad === "delivery" ? 2 : 0);
    }
  }
});

test("API informa migración pendiente sin inventar descuentos para el esquema anterior", async () => {
  for (const code of ["42703", "PGRST204"]) {
    const endpoint = ruta(rutas[0], { autenticado: true, autorizado: true, comercioId: "comercio" },
      { code, message: "No existe la columna descuento" });
    const resultado = await endpoint.GET();
    assert.equal(resultado.status, 503);
    assert.match(resultado.body.error, /migraciones de PIA-4/);
    assert.equal(resultado.body.pedidos, undefined);
    assert.equal(endpoint.consultas.filter(([, accion]) => accion === "select").length, 1);
  }
});

test("Notificación visual conserva Sin revisar, Visto y sonido y muestra Llevar POS solo cuando corresponde", async () => {
  for (const [modalidad, metodoPago, aviso] of [
    ["delivery", "tarjeta_pos", true], ["delivery", "efectivo", false],
    ["retiro", "pago_en_local", false], ["retiro", "tarjeta_pos", false],
  ]) {
    let visto;
    let pruebasSonido = 0;
    const modulo = cargar("src/components/admin/NotificacionesPedidos.tsx", {
      react: { useState: inicial => [inicial, () => {}] },
      "react/jsx-runtime": runtime,
      "@/lib/admin/pagos": pagos,
      "@/lib/admin/notificacionesPedidos": { useNotificacionesPedidos: () => ({
        notificaciones: [{ id: "pedido", numero: 42, modalidad, metodoPago, creadoEn: fila.creado_en }],
        error: null, marcandoId: null, marcarVisto: id => { visto = id; },
      }) },
      "@/lib/admin/sonidoAlerta": { probarSonido: async () => { pruebasSonido++; return true; } },
    });
    const resultado = modulo.NotificacionesPedidos({ comercioId: "comercio" });
    assert.equal(texto(resultado).includes("Llevar POS"), aviso);
    assert.match(texto(resultado), /Sin revisar/);
    const botones = nodos(resultado, nodo => nodo.type === "button");
    botones.find(boton => boton.props.children === "Visto").props.onClick();
    assert.equal(visto, "pedido");
    botones.find(boton => boton.props.children === "Activar sonido").props.onClick();
    await esperar();
    assert.equal(pruebasSonido, 1);
  }
});

test("Realtime mantiene sincronización, sonido único por pedido nuevo y marca Visto sin cambiar estados", async () => {
  const estados = [];
  let indice = 0;
  const referencias = [];
  let indiceRef = 0;
  let efecto;
  const eventos = [];
  let sonidos = 0;
  let pedidos = [{ id: "existente", numero: 1, modalidad: "retiro", metodoPago: "pago_en_local", creadoEn: fila.creado_en }];
  const escuchas = [];
  const temporizadores = [];
  const solicitudes = [];
  const canal = { on: (_tipo, filtro, callback) => { escuchas.push({ filtro, callback }); return canal; }, subscribe() {} };
  const modulo = cargar("src/lib/admin/notificacionesPedidos.ts", {
    react: {
      useState: inicial => {
        const i = indice++;
        if (!(i in estados)) estados[i] = inicial;
        return [estados[i], valor => { estados[i] = typeof valor === "function" ? valor(estados[i]) : valor; }];
      },
      useRef: inicial => {
        const i = indiceRef++;
        referencias[i] ??= { current: inicial };
        return referencias[i];
      },
      useCallback: valor => valor, useEffect: callback => { efecto = callback; },
    },
    "@/lib/supabase/client": { createClient: () => ({
      channel: () => canal, realtime: { setAuth: async () => {} }, removeChannel() {},
    }) },
    "./sonidoAlerta": { reproducirAlerta: async () => { sonidos++; } },
  }, {
    Event: class { constructor(type) { this.type = type; } },
    AbortController, DOMException,
    setTimeout: callback => { temporizadores.push(callback); return temporizadores.length; },
    clearTimeout() {},
    window: {
      setTimeout: () => 1, clearTimeout() {}, setInterval: () => 1, clearInterval() {},
      dispatchEvent: evento => eventos.push(evento.type),
    },
    fetch: async (url, opciones) => {
      solicitudes.push({ url, opciones });
      return { ok: true, json: async () => opciones.method === "PATCH" ? {} : { pedidos } };
    },
  });
  const render = () => { indice = 0; indiceRef = 0; return modulo.useNotificacionesPedidos("comercio"); };
  render();
  const limpiar = efecto();
  temporizadores.pop()();
  await esperar();
  assert.equal(sonidos, 0, "No suena en la carga inicial");
  assert.ok(escuchas.every(({ filtro }) => filtro.filter === "comercio_id=eq.comercio"));
  pedidos = [...pedidos, { id: "pos", numero: 42, modalidad: "delivery", metodoPago: "tarjeta_pos", creadoEn: fila.creado_en }];
  escuchas.find(({ filtro }) => filtro.event === "INSERT").callback();
  temporizadores.pop()();
  await esperar();
  assert.equal(sonidos, 1);
  assert.deepEqual(eventos, [modulo.EVENTO_PEDIDOS_NUEVOS]);
  assert.equal(render().notificaciones[1].metodoPago, "tarjeta_pos");
  escuchas.find(({ filtro }) => filtro.event === "UPDATE").callback();
  temporizadores.pop()();
  await esperar();
  assert.equal(sonidos, 1, "La resincronización no duplica el sonido");
  await render().marcarVisto("pos");
  assert.equal(render().notificaciones.length, 1);
  const patch = solicitudes.find(({ opciones }) => opciones.method === "PATCH");
  assert.equal(patch.url, "/api/admin/pedidos/revisar");
  assert.deepEqual(JSON.parse(patch.opciones.body), { pedidoId: "pos" });
  limpiar();
});
