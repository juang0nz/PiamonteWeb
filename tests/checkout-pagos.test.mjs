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
    console: { info() {}, error() {} }, Error, RangeError,
    ...globales,
  });
  return modulo.exports;
}

const celular = cargar("src/lib/checkout/celular.ts");
const tipos = cargar("src/lib/checkout/tipos.ts", { "./celular": celular });
const tiempos = cargar("src/lib/comercio/tiempos.ts");
const formato = cargar("src/lib/catalogo/formato.ts");
const descuentos = cargar("src/lib/comercio/descuentos.ts");
const descuentoWeb = cargar("src/lib/comercio/descuento-web.ts");
const confirmacion = cargar("src/lib/checkout/confirmacion.ts", {
  "@/lib/comercio/descuentos": descuentos,
  "@/lib/comercio/descuento-web": descuentoWeb,
});
const SIN_DESCUENTO = { estado: "conocido", promocion: null };
const jsx = (type, props) => typeof type === "function" ? type(props) : ({ type, props });
const runtime = { jsx, jsxs: jsx };
const resumenImportes = cargar("src/components/catalogo/ResumenImportes.tsx", {
  "react/jsx-runtime": runtime,
  "@/lib/catalogo/formato": formato,
  "@/lib/comercio/descuentos": descuentos,
});
const datosBase = {
  ...tipos.DATOS_INICIALES, tipoEntrega: "delivery", metodoPago: null,
  nombre: "Ana", telefono: "099806731", calle: "Calle", numero: "12",
};
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

function almacen(guardado) {
  let persistido = guardado === undefined ? null : JSON.stringify(guardado);
  const modulo = cargar("src/lib/checkout/almacen.ts", {
    react: { useSyncExternalStore: (_suscribir, obtener) => obtener() },
    "./tipos": tipos,
  }, {
    window: { sessionStorage: {
      getItem: () => persistido,
      setItem: (_clave, valor) => { persistido = valor; },
    } },
  });
  return { ...modulo, persistido: () => JSON.parse(persistido) };
}

test("Checkout restaura sesiones anteriores e invalida métodos incompatibles o desconocidos", () => {
  for (const [guardado, esperado] of [
    [{ tipoEntrega: "delivery" }, null],
    [{ tipoEntrega: "delivery", metodoPago: "tarjeta_pos" }, "tarjeta_pos"],
    [{ tipoEntrega: "delivery", metodoPago: "pago_en_local" }, null],
    [{ tipoEntrega: "delivery", metodoPago: "mercado_pago" }, null],
    [{ tipoEntrega: "retiro", metodoPago: "efectivo" }, "pago_en_local"],
    [{ tipoEntrega: "otro", metodoPago: "efectivo" }, null],
  ]) {
    assert.equal(almacen(guardado).useDatosCheckout().metodoPago, esperado);
  }
});

test("Cambiar modalidad limpia el pago incompatible y persiste solo la elección válida", () => {
  const store = almacen({ ...datosBase, metodoPago: "tarjeta_pos" });
  store.actualizarDatosCheckout({ tipoEntrega: "retiro" });
  assert.equal(store.useDatosCheckout().metodoPago, "pago_en_local");
  store.actualizarDatosCheckout({ tipoEntrega: "delivery" });
  assert.equal(store.useDatosCheckout().metodoPago, null);
  store.actualizarDatosCheckout({ metodoPago: "efectivo" });
  assert.equal(store.persistido().metodoPago, "efectivo");
  store.actualizarDatosCheckout({ nombre: "Otra persona" });
  assert.equal(store.useDatosCheckout().metodoPago, "efectivo");
});

test("La validación de pago exige elección en delivery y no agrega selector a retiro", () => {
  assert.ok(tipos.validarPagoCheckout(datosBase).metodoPago);
  for (const metodoPago of ["efectivo", "tarjeta_pos"]) {
    assert.equal(Object.keys(tipos.validarPagoCheckout({ ...datosBase, metodoPago })).length, 0);
  }
  assert.equal(Object.keys(tipos.validarPagoCheckout({ ...datosBase, tipoEntrega: "retiro" })).length, 0);
});

test("Formulario muestra Efectivo y Tarjeta (POS), errores accesibles y retiro sin selector", () => {
  const cambios = [];
  const { FormularioCheckout } = cargar("src/components/checkout/FormularioCheckout.tsx", {
    "react/jsx-runtime": runtime,
    "@/lib/comercio/tiempos": tiempos,
    "./CampoTexto": { CampoTexto: () => null },
    "./SelectorEntrega": { SelectorEntrega: () => null },
  });
  const props = { id: "checkout", datos: datosBase, errores: { metodoPago: "Elegí un pago." }, onCambio: valor => cambios.push(valor), onEnviar() {} };
  const delivery = FormularioCheckout(props);
  const radios = nodos(delivery, nodo => nodo.type === "input" && nodo.props.name === "metodoPago");
  assert.equal(radios.length, 2);
  assert.match(texto(delivery), /Efectivo/);
  assert.match(texto(delivery), /Tarjeta \(POS\)/);
  assert.ok(nodos(delivery, nodo => nodo.props?.role === "radiogroup")[0].props["aria-invalid"]);
  radios[1].props.onChange();
  assert.equal(cambios[0].metodoPago, "tarjeta_pos");
  const retiro = FormularioCheckout({ ...props, datos: { ...datosBase, tipoEntrega: "retiro", metodoPago: "pago_en_local" } });
  assert.match(texto(retiro), /Pagás en el local/);
  assert.equal(nodos(retiro, nodo => nodo.type === "input" && nodo.props.name === "metodoPago").length, 0);
});

const { ResumenPedido } = cargar("src/components/checkout/ResumenPedido.tsx", {
  "react/jsx-runtime": runtime, "@/lib/catalogo/formato": formato,
  "@/components/catalogo/ResumenImportes": resumenImportes,
});

test("Resumen muestra UYU y centésimos, sin presentar tarifa desconocida como cero", () => {
  const conocido = texto(ResumenPedido({ items: [], subtotal: 0.1, costoEnvio: 0.2, descuentoWeb: SIN_DESCUENTO }));
  assert.match(conocido, /Subtotal/);
  assert.match(conocido, /Envío/);
  assert.match(conocido, /Total estimado/);
  assert.ok(conocido.includes(formato.formatearImporteUYU(0.3)));
  assert.ok(conocido.includes("UYU"));
  const desconocido = texto(ResumenPedido({ items: [], subtotal: 100, costoEnvio: null }));
  assert.match(desconocido, /Por confirmar/);
  assert.ok(!desconocido.includes(formato.formatearImporteUYU(0)));
});

function pantalla({ datosIniciales = datosBase, costoEnvio = 25.5, respuesta, pausado = false, abierto = true, promocion = SIN_DESCUENTO } = {}) {
  let datos = { ...datosIniciales };
  let items = [{ clave: "item", productoId: "producto", varianteId: null, cantidad: 1, aclaraciones: "", opciones: [], precioUnitario: 100, nombreProducto: "Producto" }];
  const estados = [];
  let indice = 0;
  const solicitudes = [];
  let vaciados = 0;
  const { PantallaCheckout } = cargar("src/components/checkout/PantallaCheckout.tsx", {
    react: {
      useState: inicial => {
        const posicion = indice++;
        if (!(posicion in estados)) estados[posicion] = inicial;
        return [estados[posicion], valor => { estados[posicion] = valor; }];
      },
    },
    "react/jsx-runtime": runtime,
    "next/link": { default: "a" },
    "@/lib/carrito/almacen": {
      useCarrito: () => ({ items, total: 100 }),
      vaciarCarrito: () => { items = []; vaciados++; },
    },
    "@/lib/checkout/almacen": {
      useDatosCheckout: () => datos,
      actualizarDatosCheckout: cambios => {
        datos = { ...datos, ...cambios };
        datos.metodoPago = tipos.normalizarMetodoPago(datos.tipoEntrega, datos.metodoPago);
      },
    },
    "@/lib/checkout/tipos": tipos,
    "@/lib/checkout/confirmacion": confirmacion,
    "@/lib/hidratacion": { useHidratado: () => true },
    "@/lib/comercio": { SLUG_COMERCIO: "piamonte" },
    "@/lib/comercio/horarios": { obtenerEstadoApertura: () => ({ abierto, horaApertura: "19:00" }) },
    "@/lib/catalogo/formato": formato,
    "./FormularioCheckout": { FormularioCheckout: props => ({ type: "formulario", props }) },
    "./ResumenPedido": { ResumenPedido },
  }, {
    requestAnimationFrame: callback => callback(),
    document: { querySelector: () => ({ focus() {} }) },
    fetch: async (_url, opciones) => {
      solicitudes.push(JSON.parse(opciones.body));
      return respuesta ?? { ok: true, status: 201, json: async () => ({
        pedidoId: "pedido", numeroPedido: 42, subtotal: 100.25, descuento: 0, promocion: null, costoEnvio: 30.1, total: 130.35,
      }) };
    },
  });
  const render = () => {
    indice = 0;
    return PantallaCheckout({ hrefCarrito: "/", costoEnvio, pausa: { pausado, mensaje: "En pausa." }, descuentoWeb: promocion });
  };
  const formulario = () => nodos(render(), nodo => nodo.type === "formulario")[0];
  const confirmar = async () => { formulario().props.onEnviar(); await esperar(); };
  return { render, formulario, confirmar, solicitudes, vaciados: () => vaciados };
}

test("Checkout bloquea delivery sin pago y sin tarifa, sin enviar un POST", async () => {
  for (const opciones of [{}, { datosIniciales: { ...datosBase, metodoPago: "efectivo" }, costoEnvio: null }]) {
    const ui = pantalla(opciones);
    await ui.confirmar();
    assert.equal(ui.solicitudes.length, 0);
    assert.equal(ui.vaciados(), 0);
    assert.ok(nodos(ui.render(), nodo => nodo.props?.role === "alert").length);
  }
});

test("Checkout envía solo método y datos del pedido, y confirma importes del servidor distintos de la estimación", async () => {
  for (const metodoPago of ["efectivo", "tarjeta_pos"]) {
    const ui = pantalla({ datosIniciales: { ...datosBase, metodoPago, costoEnvio: 0, total: 1 } });
    await ui.confirmar();
    assert.equal(ui.solicitudes[0].metodoPago, metodoPago);
    assert.equal(ui.solicitudes[0].costoEnvio, undefined);
    assert.equal(ui.solicitudes[0].subtotal, undefined);
    assert.equal(ui.solicitudes[0].total, undefined);
    assert.equal(ui.solicitudes[0].checkout.costoEnvio, undefined);
    assert.equal(ui.vaciados(), 1);
    const confirmacion = texto(ui.render());
    assert.match(confirmacion, /Total confirmado/);
    assert.ok(confirmacion.includes(formato.formatearImporteUYU(130.35)));
    assert.ok(!confirmacion.includes(formato.formatearImporteUYU(125.5)));
    assert.match(confirmacion, /42/);
  }
});

test("Checkout cambia delivery/retiro sin conservar un método incompatible y envía pago_en_local", async () => {
  const ui = pantalla({ datosIniciales: { ...datosBase, metodoPago: "tarjeta_pos" } });
  ui.formulario().props.onCambio({ tipoEntrega: "retiro" });
  assert.equal(ui.formulario().props.datos.metodoPago, "pago_en_local");
  ui.formulario().props.onCambio({ tipoEntrega: "delivery" });
  assert.equal(ui.formulario().props.datos.metodoPago, null);
  ui.formulario().props.onCambio({ tipoEntrega: "retiro" });
  assert.ok(texto(ui.render()).includes(formato.formatearImporteUYU(0)));
  await ui.confirmar();
  assert.equal(ui.solicitudes[0].metodoPago, "pago_en_local");
});

test("Sin migración o con fallo del servidor conserva el carrito y no muestra éxito", async () => {
  const ui = pantalla({
    datosIniciales: { ...datosBase, metodoPago: "efectivo" },
    respuesta: { ok: false, status: 501, json: async () => ({ error: "Falta aplicar la migración de PIA-3." }) },
  });
  await ui.confirmar();
  assert.equal(ui.vaciados(), 0);
  assert.match(texto(ui.render()), /Falta aplicar la migración de PIA-3/);
  assert.ok(!texto(ui.render()).includes("¡Pedido confirmado!"));
});

test("Pedido ya registrado sin total válido no reutiliza la estimación ni habilita un duplicado", async () => {
  const ui = pantalla({
    datosIniciales: { ...datosBase, metodoPago: "efectivo" },
    respuesta: { ok: true, status: 201, json: async () => ({ pedidoId: "pedido", numeroPedido: 42 }) },
  });
  await ui.confirmar();
  assert.equal(ui.vaciados(), 1);
  assert.match(texto(ui.render()), /pedido se registró, pero no pudimos mostrar su total confirmado/);
  assert.ok(!texto(ui.render()).includes("Total confirmado"));
});

test("Pausa y cierre siguen bloqueando confirmación antes del POST", async () => {
  for (const opciones of [{ pausado: true }, { abierto: false }]) {
    const ui = pantalla({ ...opciones, datosIniciales: { ...datosBase, metodoPago: "efectivo" } });
    await ui.confirmar();
    assert.equal(ui.solicitudes.length, 0);
  }
});

test("La lectura de tarifa usa la configuración del comercio y no inventa un cero ante errores", async () => {
  for (const [data, error, esperado] of [
    [{ costo_envio: 12.35 }, null, 12.35],
    [{ costo_envio: 0 }, null, 0],
    [null, null, null],
    [{}, null, null],
    [{ costo_envio: -1 }, null, null],
    [null, { message: "Falta columna costo_envio" }, null],
  ]) {
    const consulta = {
      select: columnas => { assert.equal(columnas, "costo_envio"); return consulta; },
      eq: (columna, valor) => { assert.equal(columna, "comercio_id"); assert.equal(valor, "comercio"); return consulta; },
      maybeSingle: async () => ({ data, error }),
    };
    const configuracion = cargar("src/lib/comercio/configuracion.ts", {
      "server-only": {},
      "@/lib/supabase/server": { createClient: async () => ({ from: tabla => {
        assert.equal(tabla, "comercio_configuracion"); return consulta;
      } }) },
      "./tiempos": tiempos,
    });
    if (esperado === null) await assert.rejects(configuracion.obtenerCostoEnvio("comercio"));
    else assert.equal(await configuracion.obtenerCostoEnvio("comercio"), esperado);
  }
});

test("La página entrega la tarifa al checkout y conserva el error de tarifa como desconocida", async () => {
  for (const fallaTarifa of [false, true]) {
    const pagina = cargar("src/app/checkout/page.tsx", {
      "react/jsx-runtime": runtime,
      "@/components/catalogo/MensajeEstado": { MensajeEstado: props => ({ type: "mensaje", props }) },
      "@/components/checkout/EncabezadoCheckout": { EncabezadoCheckout: () => null },
      "@/components/checkout/PantallaCheckout": { PantallaCheckout: props => ({ type: "checkout", props }) },
      "@/lib/catalogo/consultas": { obtenerComercio: async () => ({ id: "comercio", nombre: "Comercio" }) },
      "@/lib/comercio": { SLUG_COMERCIO: "piamonte" },
      "@/lib/comercio/descuento-web-publico": { obtenerDescuentoWeb: async () => SIN_DESCUENTO },
      "@/lib/comercio/tiempos": tiempos,
      "@/lib/comercio/configuracion": {
        obtenerEstadoOperativo: async () => ({
          tiempos: tiempos.tiemposPorDemanda(tiempos.CONFIGURACION_INICIAL),
          pausa: { pausado: false, mensaje: "" },
        }),
        obtenerCostoEnvio: async id => {
          assert.equal(id, "comercio");
          if (fallaTarifa) throw new Error("Migración pendiente");
          return 25.75;
        },
      },
    });
    const resultado = await pagina.default();
    assert.equal(nodos(resultado, nodo => nodo.type === "checkout")[0].props.costoEnvio, fallaTarifa ? null : 25.75);
  }
});

test("Checkout estima 0 %, 10 % y 100 % en delivery y retiro sin descontar el envío", () => {
  for (const porcentaje of [0, 10, 100]) {
    for (const tipoEntrega of ["delivery", "retiro"]) {
      const ui = pantalla({
        datosIniciales: { ...datosBase, tipoEntrega, metodoPago: tipoEntrega === "retiro" ? "pago_en_local" : "efectivo" },
        promocion: { estado: "conocido", promocion: { nombre: "Descuento web", porcentaje } },
      });
      const vista = texto(ui.render());
      assert.match(vista, new RegExp(`Descuento web\\s+\\(${porcentaje} %\\)`));
      const envio = tipoEntrega === "retiro" ? 0 : 25.5;
      assert.ok(vista.includes(formato.formatearImporteUYU(100 - porcentaje + envio)));
      assert.match(vista, /Subtotal con descuento/);
    }
  }
});

test("Descuento desconocido no equivale a desactivado y bloquea el registro", async () => {
  const ui = pantalla({
    datosIniciales: { ...datosBase, metodoPago: "efectivo" },
    promocion: { estado: "desconocido" },
  });
  assert.match(texto(ui.render()), /No pudimos consultar el descuento web/);
  assert.match(texto(ui.render()), /Por confirmar/);
  assert.doesNotMatch(texto(ui.render()), /Descuento web desactivado/);
  const boton = nodos(ui.render(), nodo => nodo.type === "button" && nodo.props.form)[0];
  assert.equal(boton.props.disabled, true);
  await ui.confirmar();
  assert.equal(ui.solicitudes.length, 0);
});

test("Confirmación usa la promoción realmente registrada aunque cambie o se desactive durante la compra", async () => {
  for (const [estimado, aplicado] of [[10, 25], [10, null], [null, 10], [10, 100], [100, 0]]) {
    for (const tipoEntrega of ["delivery", "retiro"]) {
      const costoEnvio = tipoEntrega === "retiro" ? 0 : 30.1;
      const promo = aplicado === null ? null : { id: "promo", nombre: "Descuento web", porcentaje: aplicado };
      const importes = descuentos.calcularDescuentoPorcentual({ subtotal: 100.25, costoEnvio, porcentaje: aplicado ?? 0 });
      const ui = pantalla({
        datosIniciales: { ...datosBase, tipoEntrega, metodoPago: tipoEntrega === "retiro" ? "pago_en_local" : "tarjeta_pos" },
        promocion: { estado: "conocido", promocion: estimado === null ? null : { nombre: "Web", porcentaje: estimado } },
        respuesta: { ok: true, status: 201, json: async () => ({
          pedidoId: "pedido", numeroPedido: 42, ...importes, promocion: promo,
        }) },
      });
      await ui.confirmar();
      const vista = texto(ui.render());
      assert.match(vista, /Total confirmado/);
      assert.ok(vista.includes(formato.formatearImporteUYU(importes.total)));
      assert.match(vista, /Estado del pedido:.*Pendiente/);
      assert.equal(ui.vaciados(), 1);
      assert.equal(ui.solicitudes[0].descuento, undefined);
      assert.equal(ui.solicitudes[0].promocion, undefined);
      assert.equal(ui.solicitudes[0].porcentaje, undefined);
      if (aplicado !== null) assert.match(vista, new RegExp(`Descuento web\\s+\\(${aplicado} %\\)`));
    }
  }
});

test("Retiro con 100 % confirma total cero y conserva la confirmación manual del local", async () => {
  const ui = pantalla({
    datosIniciales: { ...datosBase, tipoEntrega: "retiro", metodoPago: "pago_en_local" },
    costoEnvio: null,
    promocion: { estado: "conocido", promocion: { nombre: "Web", porcentaje: 100 } },
    respuesta: { ok: true, status: 201, json: async () => ({
      pedidoId: "pedido", numeroPedido: 42, subtotal: 100, descuento: 100, costoEnvio: 0,
      total: 0, promocion: { id: "promo", nombre: "Web", porcentaje: 100 },
    }) },
  });
  assert.equal(nodos(ui.render(), nodo => nodo.type === "button" && nodo.props.form)[0].props.disabled, false);
  await ui.confirmar();
  assert.equal(ui.solicitudes[0].metodoPago, "pago_en_local");
  assert.match(texto(ui.render()), /Total confirmado/);
  assert.match(texto(ui.render()), /Estado del pedido:.*Pendiente/);
  assert.match(texto(ui.render()), /Pago pendiente/);
});

test("Respuestas monetarias manipuladas no se muestran como confirmadas ni habilitan un segundo pedido", async () => {
  const valida = {
    pedidoId: "pedido", numeroPedido: 42, subtotal: 100, descuento: 10, costoEnvio: 25.5,
    total: 115.5, promocion: { id: "promo", nombre: "Web", porcentaje: 10 },
  };
  for (const cambios of [
    { descuento: -10 }, { descuento: 101 }, { descuento: "10" }, { descuento: 10.001 },
    { total: 125.5 }, { total: -1 }, { total: Infinity }, { total: NaN }, { total: "115.5" },
    { costoEnvio: -1 }, { costoEnvio: 0.001 }, { subtotal: 1e10 }, { subtotal: 0 },
    { promocion: null }, { promocion: {} }, { promocion: { ...valida.promocion, porcentaje: 10.5 } },
    { promocion: { ...valida.promocion, porcentaje: 101 } }, { promocion: { ...valida.promocion, nombre: "" } },
    { numeroPedido: 0 }, { numeroPedido: 42.5 }, { descuento: undefined },
  ]) {
    const ui = pantalla({
      datosIniciales: { ...datosBase, metodoPago: "efectivo" },
      respuesta: { ok: true, status: 201, json: async () => ({ ...valida, ...cambios }) },
    });
    await ui.confirmar();
    assert.equal(ui.vaciados(), 1);
    assert.doesNotMatch(texto(ui.render()), /Total confirmado/);
    assert.match(texto(ui.render()), /pedido se registró, pero no pudimos mostrar su total confirmado/);
    assert.equal(nodos(ui.render(), nodo => nodo.type === "formulario").length, 0);
  }
  assert.equal(confirmacion.validarConfirmacionPedido(valida, "retiro"), null);
});

test("La validación confirmada contrasta los 15 vectores de referencia sin usar la configuración visual", () => {
  const casos = JSON.parse(fs.readFileSync(new URL("./fixtures/descuentos-porcentuales.json", import.meta.url), "utf8"));
  for (const caso of casos) {
    const entrada = { subtotal: caso.subtotal, costoEnvio: caso.costoEnvio, porcentaje: caso.porcentaje };
    const cuerpo = {
      pedidoId: "pedido", numeroPedido: 42,
      ...descuentos.calcularDescuentoPorcentual(entrada),
      promocion: { id: "promo", nombre: "Web", porcentaje: entrada.porcentaje },
    };
    assert.equal(Boolean(confirmacion.validarConfirmacionPedido(cuerpo, "delivery")), entrada.subtotal > 0, caso.caso);
  }
});
