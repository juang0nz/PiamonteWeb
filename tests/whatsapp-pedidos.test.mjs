import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

function cargar(archivo, modulos = {}, globales = {}) {
  const codigo = ts.transpileModule(
    readFileSync(new URL(`../${archivo}`, import.meta.url), "utf8"),
    { compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      jsx: ts.JsxEmit.ReactJSX,
    } },
  ).outputText;
  const modulo = { exports: {} };
  vm.runInNewContext(codigo, {
    module: modulo, exports: modulo.exports,
    require(nombre) {
      if (!(nombre in modulos)) throw new Error(`Módulo no simulado: ${nombre}`);
      return modulos[nombre];
    },
    console: { warn() {} },
    ...globales,
  });
  return modulo.exports;
}

const celular = cargar("src/lib/checkout/celular.ts");
const comercio = cargar("src/lib/comercio.ts");
const tiempos = cargar("src/lib/comercio/tiempos.ts");
const MENSAJE = "🍕 ¡Hola! Tu pedido de Piamonte ya está en preparación. 👨‍🍳 ¡Gracias por elegirnos!";
const MENSAJE_CON_TIEMPO =
  "🍕 ¡Hola! Tu pedido de Piamonte ya está en preparación. Tiempo estimado: 30-45 min. 👨‍🍳 ¡Gracias por elegirnos!";
const esperar = () => new Promise(resolve => setImmediate(resolve));

function escenario({ telefono = "099 806 731", estado = "pendiente", fallo = false,
  falloRed = false, bloquear = false, confirmar = true, demorar = false, tiempoEstimado = null } = {}) {
  const pedido = {
    id: "pedido-prueba", numero: 42, creadoEn: "2026-10-14T12:00:00Z",
    clienteNombre: "Cliente de prueba", clienteTelefono: telefono, estado,
    modalidad: "retiro", direccion: {}, metodoPago: "efectivo", total: 100, items: [],
  };
  const estados = ["pendiente", false, null, null, [pedido], null, null, null];
  let indice = 0;
  const aperturas = [];
  const solicitudes = [];
  let resolver;
  const esperaAceptacion = new Promise(resolve => { resolver = resolve; });
  const jsx = (type, props) => ({ type, props });
  const { PanelPedidosAdmin } = cargar("src/components/admin/PanelPedidosAdmin.tsx", {
    react: {
      useState: () => {
        const posicion = indice++;
        return [estados[posicion], valor => {
          estados[posicion] = typeof valor === "function" ? valor(estados[posicion]) : valor;
        }];
      },
      useCallback: funcion => funcion,
      useMemo: funcion => funcion(),
      useEffect() {},
    },
    "react/jsx-runtime": { jsx, jsxs: jsx },
    "@/lib/admin/notificacionesPedidos": { EVENTO_PEDIDOS_NUEVOS: "prueba" },
    "@/lib/checkout/celular": celular,
    "@/lib/comercio": comercio,
    "@/lib/comercio/tiempos": tiempos,
    "@/lib/admin/pagos": cargar("src/lib/admin/pagos.ts"),
    "@/lib/catalogo/formato": cargar("src/lib/catalogo/formato.ts"),
  }, {
    window: {
      confirm: () => confirmar,
      open: (...argumentos) => {
        aperturas.push(argumentos);
        if (bloquear) throw new Error("Apertura bloqueada");
        return null;
      },
    },
    crypto: { randomUUID: () => "operacion-prueba" },
    fetch: async (url, opciones = {}) => {
      solicitudes.push({ url, opciones });
      if (opciones.method === "PATCH") {
        if (demorar) await esperaAceptacion;
        if (falloRed) throw new Error("Falló la conexión");
        return { ok: !fallo, json: async () => fallo
          ? { error: "La aceptación falló" }
          : { mensaje: "Estado actualizado correctamente.", tiempoEstimado } };
      }
      return { ok: true, json: async () => ({ pedidos: [{ ...pedido, estado: "en_preparacion" }] }) };
    },
  });
  function renderizar() {
    indice = 0;
    return PanelPedidosAdmin({});
  }
  function elementos(nodo, predicado) {
    if (!nodo || typeof nodo !== "object") return [];
    if (Array.isArray(nodo)) return nodo.flatMap(hijo => elementos(hijo, predicado));
    return [
      ...(predicado(nodo) ? [nodo] : []),
      ...elementos(nodo.props?.children, predicado),
    ];
  }
  function buscar(texto) {
    return elementos(renderizar(), nodo => nodo.props?.children === texto)[0];
  }
  return {
    estados, aperturas, solicitudes, resolver, buscar,
    async pulsar(texto = "Aceptar pedido") {
      const boton = buscar(texto);
      assert.ok(boton, `Existe el botón ${texto}`);
      boton.props.onClick();
      await esperar();
    },
  };
}

test("Aceptar espera éxito antes de abrir WhatsApp y conserva PATCH y recarga", async () => {
  const prueba = escenario({ demorar: true });
  await prueba.pulsar();
  assert.equal(prueba.aperturas.length, 0);
  prueba.resolver();
  await esperar();
  assert.equal(prueba.aperturas.length, 1);
  const [destino, ventana, opciones] = prueba.aperturas[0];
  const url = new URL(destino);
  assert.equal(url.origin, "https://wa.me");
  assert.equal(url.pathname, "/59899806731");
  assert.equal(url.searchParams.get("text"), MENSAJE);
  assert.equal(ventana, "_blank");
  assert.equal(opciones, "noopener,noreferrer");
  const payload = JSON.parse(prueba.solicitudes[0].opciones.body);
  assert.equal(payload.pedidoId, "pedido-prueba");
  assert.equal(payload.estadoActualEsperado, "pendiente");
  assert.equal(payload.nuevoEstado, "en_preparacion");
  assert.equal(prueba.solicitudes[1].url, "/api/admin/pedidos");
  assert.ok(prueba.buscar("Avisar por WhatsApp"));
  assert.equal(prueba.buscar("Avisar por WhatsApp").props.href, destino);
});

test("Con rango congelado por la base, el mensaje de WhatsApp incluye el tiempo estimado", async () => {
  const prueba = escenario({ tiempoEstimado: { min: 30, max: 45 } });
  await prueba.pulsar();
  assert.equal(prueba.aperturas.length, 1);
  assert.equal(new URL(prueba.aperturas[0][0]).searchParams.get("text"), MENSAJE_CON_TIEMPO);
  assert.equal(comercio.mensajePedidoAceptadoWhatsApp(null), MENSAJE);
  assert.equal(comercio.mensajePedidoAceptadoWhatsApp("30-45 min"), MENSAJE_CON_TIEMPO);
});

test("Normaliza formatos uruguayos sin duplicar 598 y conserva exactamente el mensaje", async () => {
  for (const telefono of ["099806731", "99806731", "+598 99 806 731", "59899806731", "(099) 806-731"]) {
    const prueba = escenario({ telefono });
    await prueba.pulsar();
    assert.equal(new URL(prueba.aperturas[0][0]).pathname, "/59899806731");
    assert.equal(new URL(prueba.aperturas[0][0]).searchParams.get("text"), MENSAJE);
  }
});

test("Si falla la aceptación no abre WhatsApp ni presenta el aviso de éxito", async () => {
  for (const opciones of [{ fallo: true }, { falloRed: true }]) {
    const prueba = escenario(opciones);
    await prueba.pulsar();
    assert.equal(prueba.aperturas.length, 0);
    assert.equal(prueba.estados[7], null);
    assert.equal(prueba.estados[3], null);
    assert.ok(prueba.estados[2]);
    assert.equal(prueba.solicitudes.length, 1);
  }
});

test("Teléfono faltante o inválido conserva aceptación y muestra alternativa deshabilitada", async () => {
  for (const telefono of ["", null, "24001234", "incorrecto", "+54999806731"]) {
    const prueba = escenario({ telefono });
    await prueba.pulsar();
    assert.equal(prueba.aperturas.length, 0);
    assert.equal(prueba.estados[2], null);
    assert.equal(prueba.solicitudes.length, 2);
    assert.equal(prueba.buscar("Avisar por WhatsApp").props.disabled, true);
  }
});

test("Apertura bloqueada o sin referencia de ventana deja enlace manual y no revierte aceptación", async () => {
  for (const bloquear of [true, false]) {
    const prueba = escenario({ bloquear });
    await prueba.pulsar();
    assert.equal(prueba.estados[2], null);
    assert.equal(prueba.solicitudes.length, 2);
    const alternativa = prueba.buscar("Avisar por WhatsApp");
    assert.equal(alternativa.type, "a");
    assert.equal(alternativa.props.target, "_blank");
    assert.equal(alternativa.props.rel, "noopener noreferrer");
  }
});

test("Otras transiciones y cancelar el diálogo conservan su flujo y no abren WhatsApp", async () => {
  for (const [estado, texto] of [
    ["en_preparacion", "Marcar como listo"],
    ["confirmado", "Marcar como listo"],
    ["listo", "Marcar como entregado"],
    ["pendiente", "Cancelar pedido"],
  ]) {
    const prueba = escenario({ estado });
    prueba.estados[0] = estado === "confirmado" ? "en_preparacion" : estado;
    await prueba.pulsar(texto);
    assert.equal(prueba.aperturas.length, 0);
    assert.equal(prueba.solicitudes.length, 2);
  }
  const prueba = escenario({ confirmar: false });
  await prueba.pulsar("Cancelar pedido");
  assert.equal(prueba.solicitudes.length, 0);
  assert.equal(prueba.aperturas.length, 0);
});
