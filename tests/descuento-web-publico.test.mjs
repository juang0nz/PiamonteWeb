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
    module: modulo, exports: modulo.exports, Error, RangeError,
    require: nombre => {
      assert.ok(nombre in modulos, `Módulo no simulado: ${nombre}`);
      return modulos[nombre];
    },
    console: { error() {} }, ...globales,
  });
  return modulo.exports;
}
const contrato = cargar("src/lib/comercio/descuento-web.ts");
const calculo = cargar("src/lib/comercio/descuentos.ts");
const formato = cargar("src/lib/catalogo/formato.ts");
const conocido = porcentaje => ({
  estado: "conocido", promocion: porcentaje === null ? null : { nombre: "Descuento web", porcentaje },
});
const jsx = (type, props) => typeof type === "function" ? type(props) : ({ type, props });
const runtime = { jsx, jsxs: jsx };
const resumen = cargar("src/components/catalogo/ResumenImportes.tsx", {
  "react/jsx-runtime": runtime,
  "@/lib/catalogo/formato": formato,
  "@/lib/comercio/descuentos": calculo,
});
function texto(nodo) {
  if (nodo == null || typeof nodo === "boolean") return "";
  if (Array.isArray(nodo)) return nodo.map(texto).join(" ");
  return typeof nodo === "object" ? texto(nodo.props?.children) : String(nodo);
}
function nodos(nodo, condicion) {
  if (!nodo || typeof nodo !== "object") return [];
  if (Array.isArray(nodo)) return nodo.flatMap(hijo => nodos(hijo, condicion));
  return [...(condicion(nodo) ? [nodo] : []), ...nodos(nodo.props?.children, condicion)];
}

test("Lectura pública usa únicamente la RPC segura y distingue activa 0/10/100 de desactivada", async () => {
  for (const porcentaje of [null, 0, 10, 100]) {
    const llamadas = [];
    const { obtenerDescuentoWeb } = cargar("src/lib/comercio/descuento-web-publico.ts", {
      "server-only": {},
      "./descuento-web": contrato,
      "@/lib/supabase/server": { createClient: async () => ({
        rpc: async (nombre, parametros) => {
          llamadas.push({ nombre, parametros });
          return { data: porcentaje === null ? [] : [{ nombre: "Descuento web", valor: porcentaje }], error: null };
        },
      }) },
    });
    const resultado = await obtenerDescuentoWeb("comercio");
    assert.equal(resultado.estado, "conocido");
    assert.equal(resultado.promocion?.porcentaje ?? null, porcentaje);
    assert.equal(llamadas.length, 1);
    assert.equal(llamadas[0].nombre, "obtener_descuento_web");
    assert.equal(llamadas[0].parametros.p_comercio_id, "comercio");
  }
});

test("Errores de migración y respuestas públicas inválidas no producen un falso descuento cero", async () => {
  for (const [data, error] of [
    [null, { message: "Falta migración", code: "PGRST202" }],
    [null, null], [{}, null], [[{}, {}], null], [[{}], null],
    [[{ nombre: "Web", valor: -1 }], null],
    [[{ nombre: "Web", valor: 10.5 }], null],
    [[{ nombre: "Web", valor: "10" }], null],
    [[{ nombre: "Web", valor: 101 }], null],
    [[{ nombre: "", valor: 10 }], null],
  ]) {
    const lectura = cargar("src/lib/comercio/descuento-web-publico.ts", {
      "server-only": {}, "./descuento-web": contrato,
      "@/lib/supabase/server": { createClient: async () => ({ rpc: async () => ({ data, error }) }) },
    });
    await assert.rejects(lectura.obtenerDescuentoWeb("comercio"));
  }
});

function carrito() {
  const guardado = new Map();
  const store = cargar("src/lib/carrito/almacen.ts", {
    react: { useMemo: callback => callback(), useSyncExternalStore: (_suscribir, obtener) => obtener() },
  }, {
    window: { addEventListener() {}, localStorage: {
      getItem: clave => guardado.get(clave) ?? null,
      setItem: (clave, valor) => guardado.set(clave, valor),
    } },
  });
  const contenido = cargar("src/components/catalogo/ContenidoCarrito.tsx", {
    "react/jsx-runtime": runtime,
    "next/link": { default: "a" },
    "@/lib/catalogo/formato": formato,
    "@/lib/carrito/almacen": store,
    "./ResumenImportes": resumen,
  });
  return { store, contenido, guardado };
}
const item = {
  clave: "producto", productoId: "producto", nombreProducto: "Producto",
  precioUnitario: 0.05, cantidad: 1, opciones: [], varianteId: null,
};

test("Carrito recalcula al cambiar cantidades, redondea una vez y no persiste porcentajes ni descuentos", () => {
  const { store, contenido, guardado } = carrito();
  store.agregarItem(item);
  const render = () => contenido.ContenidoCarrito({ descuentoWeb: conocido(10) });
  let vista = render();
  assert.ok(texto(vista).includes(formato.formatearImporteUYU(0.01)));
  const aumentar = () => nodos(vista, nodo => nodo.props?.["aria-label"] === "Aumentar cantidad")[0].props.onClick();
  aumentar();
  vista = render();
  aumentar();
  vista = render();
  assert.equal(store.useCarrito().total, 0.15);
  assert.ok(texto(vista).includes(`−${formato.formatearImporteUYU(0.02)}`));
  assert.ok(texto(vista).includes(formato.formatearImporteUYU(0.13)));
  assert.match(texto(vista), /Envío Por confirmar/);
  assert.match(texto(vista), /Total estimado Por confirmar/);
  assert.doesNotMatch([...guardado.values()].join(""), /descuento|porcentaje|promocion/);
  store.quitarItem(item.clave);
  assert.match(texto(render()), /Todavía no agregaste productos/);
});

test("Subtotal visual acumula centésimos exactos e incluye variantes y adicionales sin excluir categorías", () => {
  const { store, contenido } = carrito();
  store.agregarItem({ ...item, precioUnitario: 0.1, varianteNombre: "Variante", opciones: [{ nombre: "Adicional" }] });
  store.agregarItem({ ...item, clave: "promo", nombreProducto: "Promo", precioUnitario: 0.2 });
  assert.equal(store.useCarrito().total, 0.3);
  const vista = texto(contenido.ContenidoCarrito({ descuentoWeb: conocido(10) }));
  assert.ok(vista.includes(`−${formato.formatearImporteUYU(0.03)}`));
  assert.ok(vista.includes(formato.formatearImporteUYU(0.27)));
});

test("Carrito distingue desactivado, activo al 0 % y lectura desconocida sin simular envío gratis", () => {
  const { store, contenido } = carrito();
  store.agregarItem({ ...item, precioUnitario: 100 });
  for (const porcentaje of [null, 0, 10, 100]) {
    const vista = texto(contenido.ContenidoCarrito({ descuentoWeb: conocido(porcentaje) }));
    assert.match(vista, /Subtotal de productos/);
    assert.match(vista, /Subtotal con descuento/);
    assert.match(vista, /Envío Por confirmar/);
    if (porcentaje === null) assert.match(vista, /Descuento web desactivado/);
    else assert.match(vista, new RegExp(`Descuento web\\s+\\(${porcentaje} %\\)`));
  }
  const desconocida = texto(contenido.ContenidoCarrito({ descuentoWeb: { estado: "desconocido" } }));
  assert.match(desconocida, /No pudimos consultar el descuento web/);
  assert.doesNotMatch(desconocida, /Descuento web desactivado/);
  assert.doesNotMatch(desconocida, /−\$/);
});

test("Importes visuales inválidos muestran error en lugar de un total estimado falso", () => {
  const vista = resumen.ResumenImportes({ subtotal: -1, costoEnvio: 10, descuentoWeb: conocido(10) });
  assert.match(texto(vista), /No pudimos estimar los importes/);
  assert.match(texto(vista), /Total estimado Por confirmar/);
});

test("Panel de escritorio, encabezado móvil y barra móvil reciben el mismo descuento", () => {
  const { store, contenido } = carrito();
  store.agregarItem({ ...item, precioUnitario: 100 });
  const modulos = {
    "react/jsx-runtime": runtime,
    react: { useState: inicial => [typeof inicial === "function" ? inicial() : inicial, () => {}] },
    "next/link": { default: "a" }, "next/image": { default: "img" },
    "@/lib/carrito/almacen": store,
    "./ContenidoCarrito": contenido,
    "./Dialogo": { Dialogo: props => ({ type: "dialog", props }) },
    "./NavegacionPiamonte": { NavegacionPiamonte: () => null },
  };
  const props = { descuentoWeb: conocido(10) };
  const escritorio = cargar("src/components/catalogo/ReservaCarrito.tsx", modulos).ReservaCarrito(props);
  const movil = cargar("src/components/catalogo/EncabezadoMovil.tsx", modulos).EncabezadoMovil({
    ...props, nombreComercio: "Comercio", abrirCarritoInicio: true, estadoApertura: { abierto: true },
  });
  const barra = cargar("src/components/catalogo/BarraCarritoMovil.tsx", modulos, {
    window: { matchMedia: () => ({ matches: false }) },
  }).BarraCarritoMovil({ ...props, abrirAlInicio: true });
  for (const vista of [escritorio, movil, barra]) {
    assert.match(texto(vista), /Descuento web\s+\(10 %\)/);
    assert.ok(texto(vista).includes(formato.formatearImporteUYU(90)));
    assert.match(texto(vista), /Envío Por confirmar/);
  }
});

test("Catálogo y checkout propagan configuración pública o estado desconocido sin ocultar fallos", async () => {
  const tiempos = cargar("src/lib/comercio/tiempos.ts");
  for (const falla of [false, true]) {
    const componente = nombre => props => ({ type: nombre, props });
    const modulos = {
      "react/jsx-runtime": runtime,
      "@/lib/comercio": { SLUG_COMERCIO: "comercio" },
      "@/lib/comercio/tiempos": tiempos,
      "@/lib/comercio/configuracion": {
        obtenerEstadoOperativo: async () => ({ tiempos: tiempos.tiemposPorDemanda(tiempos.CONFIGURACION_INICIAL), pausa: { pausado: false } }),
        obtenerCostoEnvio: async () => 10,
      },
      "@/lib/comercio/horarios": { obtenerEstadoApertura: () => ({ abierto: true }) },
      "@/lib/comercio/descuento-web-publico": { obtenerDescuentoWeb: async id => {
        assert.equal(id, "comercio-id");
        if (falla) throw new Error("Falta migración");
        return conocido(10);
      } },
      "@/lib/catalogo/consultas": {
        obtenerComercio: async () => ({ id: "comercio-id", nombre: "Comercio" }),
        obtenerCatalogo: async () => ({ comercio: { id: "comercio-id", nombre: "Comercio" }, categorias: [] }),
      },
    };
    for (const nombre of ["BannerPromociones", "ActualizadorCatalogo", "BarraLateral", "EncabezadoMovil", "GrillaCategorias", "MensajeEstado", "ReservaCarrito", "VistaCategoria"]) {
      modulos[`@/components/catalogo/${nombre}`] = { [nombre]: componente(nombre) };
    }
    for (const nombre of ["EncabezadoCheckout", "PantallaCheckout"]) {
      modulos[`@/components/checkout/${nombre}`] = { [nombre]: componente(nombre) };
    }
    const catalogo = await cargar("src/app/page.tsx", modulos).default({ searchParams: Promise.resolve({}) });
    const checkout = await cargar("src/app/checkout/page.tsx", modulos).default();
    for (const [arbol, nombre] of [[catalogo, "ReservaCarrito"], [catalogo, "EncabezadoMovil"], [checkout, "PantallaCheckout"]]) {
      const estado = nodos(arbol, nodo => nodo.type === nombre)[0].props.descuentoWeb;
      assert.equal(estado.estado, falla ? "desconocido" : "conocido");
      if (!falla) assert.equal(estado.promocion.porcentaje, 10);
    }
  }
});
