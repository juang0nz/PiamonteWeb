import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

function cargar(archivo, modulos = {}) {
  const codigo = ts.transpileModule(
    fs.readFileSync(new URL(`../${archivo}`, import.meta.url), "utf8"),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } },
  ).outputText;
  const modulo = { exports: {} };
  vm.runInNewContext(codigo, {
    exports: modulo.exports, module: modulo,
    require: nombre => {
      assert.ok(nombre in modulos, `Módulo no simulado: ${nombre}`);
      return modulos[nombre];
    },
    console: { error() {}, info() {} },
    TextEncoder,
  });
  return modulo.exports;
}

const celular = cargar("src/lib/checkout/celular.ts");
const checkout = cargar("src/lib/checkout/tipos.ts", { "./celular": celular });
const tiempos = cargar("src/lib/comercio/tiempos.ts");
const descuentos = cargar("src/lib/comercio/descuentos.ts");
const inputBase = {
  comercioSlug: "piamonte",
  metodoPago: "efectivo",
  checkout: {
    ...checkout.DATOS_INICIALES, tipoEntrega: "delivery",
    nombre: "Ana", telefono: "099806731", calle: "Calle", numero: "123",
  },
  items: [{ productoId: "producto", varianteId: null, cantidad: 3, aclaraciones: "", opciones: [{ opcionId: "opcion" }] }],
};

function preparar({
  costo = 25.15, configuracionAusente = false, costoAusente = false, errorConfiguracion = null,
  errorRpc = null, pausado = false, disponible = true,
  categoriaActiva = true, precio = 0.1, adicional = 0.2,
  abierto = true, comercioActivo = true, varianteDisponible = true,
  porcentaje = null, respuestaRpc, numeroPedido = 42,
} = {}) {
  const llamadas = [];
  const consultas = [];
  const tablas = {
    comercios: comercioActivo ? [{ id: "comercio", slug: "piamonte", activo: true }] : [],
    comercio_configuracion: configuracionAusente ? [] : [{
      pedidos_pausados: pausado, mensaje_pausa: "En pausa.", ...(costoAusente ? {} : { costo_envio: costo }),
    }],
    productos: [{ id: "producto", categoria_id: "categoria", comercio_id: "comercio", nombre: "Producto", precio_base: precio, disponible }],
    categorias: [{ id: "categoria", comercio_id: "comercio", activa: categoriaActiva }],
    variantes_producto: [{ id: "variante", producto_id: "producto", nombre: "Variante", precio: 0.29, disponible: varianteDisponible }],
    grupos_opciones: [{ id: "grupo", producto_id: "producto", nombre: "Extras", minimo: 0, maximo: 1, activo: true }],
    reglas_opciones_variante: [],
    opciones: [{ id: "opcion", grupo_id: "grupo", nombre: "Extra", precio_adicional: adicional, disponible: true }],
  };
  const sesion = {
    from: tabla => {
      const consulta = {
        select: columnas => { consultas.push({ tabla, columnas }); return consulta; },
        eq: (columna, valor) => {
          if (tabla === "comercio_configuracion") {
            assert.equal(columna, "comercio_id");
            assert.equal(valor, "comercio");
          }
          return consulta;
        },
        in: () => consulta,
        maybeSingle: async () => ({
          data: tablas[tabla][0] ?? null,
          error: tabla === "comercio_configuracion" ? errorConfiguracion : null,
        }),
        then: resolver => Promise.resolve({ data: tablas[tabla], error: null }).then(resolver),
      };
      return consulta;
    },
  };
  const privado = {
    rpc: async (nombre, args) => {
      assert.equal(nombre, "registrar_pedido_desde_checkout");
      llamadas.push(args);
      const importes = descuentos.calcularDescuentoPorcentual({
        subtotal: args.p_subtotal, costoEnvio: args.p_costo_envio, porcentaje: porcentaje ?? 0,
      });
      return { data: errorRpc ? null : respuestaRpc ?? [{
        pedido_id: "pedido", numero_pedido: numeroPedido, subtotal: importes.subtotal,
        descuento: importes.descuento, costo_envio: importes.costoEnvio, total: importes.total,
        promocion_id: porcentaje === null ? null : "promocion",
        promocion_nombre: porcentaje === null ? null : "Descuento web",
        promocion_porcentaje: porcentaje,
      }], error: errorRpc };
    },
    from: tabla => {
      assert.equal(tabla, "pedidos");
      const consulta = {
        select: columnas => { assert.equal(columnas, "numero"); return consulta; },
        eq: () => consulta,
        maybeSingle: async () => ({ data: { numero: 42 }, error: null }),
      };
      return consulta;
    },
  };
  const registrar = cargar("src/lib/pedidos/registrar.ts", {
    "@/lib/catalogo/configurador": { limitesGrupo: () => ({ minimo: 0, maximo: 1 }) },
    "@/lib/comercio/horarios": { obtenerEstadoApertura: () => ({ abierto, horaApertura: "19:00" }) },
    "@/lib/comercio/tiempos": tiempos,
    "@/lib/comercio/descuentos": descuentos,
    "@/lib/checkout/tipos": checkout,
    "@/lib/checkout/celular": celular,
    "@/lib/supabase/server": { createClient: async () => sesion },
    "@/lib/supabase/private": { createPrivateClient: () => privado },
  });
  return { registrar: registrar.validarYRegistrarPedido, llamadas, consultas };
}

test("Delivery efectivo y POS: recalcula productos, opciones, tarifa y total sin confiar en importes del cliente", async () => {
  for (const metodoPago of ["efectivo", "tarjeta_pos"]) {
    const { registrar, llamadas, consultas } = preparar();
    const resultado = await registrar({
      ...inputBase, metodoPago, subtotal: 1, costoEnvio: 0, total: 1,
    });
    assert.equal(resultado.subtotal, 0.9);
    assert.equal(resultado.costoEnvio, 25.15);
    assert.equal(resultado.total, 26.05);
    assert.equal(resultado.numeroPedido, 42);
    assert.equal(resultado.pedidoId, "pedido");
    assert.equal(llamadas.length, 1);
    assert.equal(llamadas[0].p_metodo_pago, metodoPago);
    assert.equal(llamadas[0].p_subtotal, 0.9);
    assert.equal(llamadas[0].p_costo_envio, 25.15);
    assert.equal(llamadas[0].p_items[0].precio_unitario, 0.3);
    assert.equal(llamadas[0].p_items[0].subtotal, 0.9);
    assert.equal(Object.keys(llamadas[0]).length, 12);
    assert.ok(consultas.some(({ tabla, columnas }) =>
      tabla === "comercio_configuracion" && columnas.includes("costo_envio")));
  }
});

test("Delivery permite tarifa cero y toma el valor vigente en cada registro", async () => {
  for (const costo of [0, 0.01, "50.25"]) {
    const { registrar, llamadas } = preparar({ costo });
    const resultado = await registrar(inputBase);
    assert.equal(resultado.costoEnvio, Number(costo));
    assert.equal(llamadas[0].p_costo_envio, Number(costo));
  }
});

test("Suma varios ítems con variantes y opciones en centésimos", async () => {
  const { registrar, llamadas } = preparar({ costo: 0.01 });
  const resultado = await registrar({
    ...inputBase,
    items: [
      inputBase.items[0],
      { ...inputBase.items[0], varianteId: "variante", cantidad: 2 },
    ],
  });
  assert.equal(llamadas[0].p_items[1].precio_unitario, 0.49);
  assert.equal(llamadas[0].p_items[1].subtotal, 0.98);
  assert.equal(resultado.subtotal, 1.88);
  assert.equal(resultado.costoEnvio, 0.01);
  assert.equal(resultado.total, 1.89);

  const agotada = preparar({ varianteDisponible: false });
  await assert.rejects(agotada.registrar({
    ...inputBase, items: [{ ...inputBase.items[0], varianteId: "variante" }],
  }), /variante/);
  assert.equal(agotada.llamadas.length, 0);
});

test("Retiro usa exclusivamente pago_en_local y envío cero aunque haya tarifa de delivery", async () => {
  for (const metodoPago of [undefined, "pago_en_local"]) {
    const { registrar, llamadas } = preparar({ costo: 150 });
    const resultado = await registrar({
      ...inputBase, metodoPago,
      checkout: { ...inputBase.checkout, tipoEntrega: "retiro" },
    });
    assert.equal(llamadas[0].p_metodo_pago, "pago_en_local");
    assert.equal(llamadas[0].p_costo_envio, 0);
    assert.equal(resultado.costoEnvio, 0);
    assert.equal(resultado.total, resultado.subtotal);
    assert.equal(llamadas[0].p_direccion_calle, null);
  }
});

test("Rechaza ausencia o métodos inválidos en delivery y combinaciones inválidas en retiro antes de consultar datos", async () => {
  for (const [tipoEntrega, metodos] of [
    ["delivery", [undefined, null, "", "pago_en_local", "mercado_pago", "EFECTIVO", {}, 1]],
    ["retiro", [null, "", "efectivo", "tarjeta_pos", "mercado_pago", {}, 1]],
  ]) {
    for (const metodoPago of metodos) {
      const { registrar, consultas, llamadas } = preparar();
      await assert.rejects(registrar({
        ...inputBase, metodoPago, checkout: { ...inputBase.checkout, tipoEntrega },
      }), error => error.status === 400 && error.code === "VALIDACION");
      assert.equal(consultas.length, 0);
      assert.equal(llamadas.length, 0);
    }
  }
});

test("Rechaza modalidades inválidas y no asume delivery", async () => {
  for (const tipoEntrega of ["otro", null, undefined]) {
    const { registrar, llamadas } = preparar();
    await assert.rejects(registrar({
      ...inputBase, checkout: { ...inputBase.checkout, tipoEntrega },
    }), /modalidad/);
    assert.equal(llamadas.length, 0);
  }
});

test("Delivery no inventa una tarifa ante configuración ausente o inválida", async () => {
  for (const opciones of [
    { configuracionAusente: true },
    { costoAusente: true },
    ...[null, "", -1, NaN, Infinity, "NaN", 1.001, 10000000000].map(costo => ({ costo })),
  ]) {
    const { registrar, llamadas } = preparar(opciones);
    await assert.rejects(registrar(inputBase), error => error.code === "CONFLICTO_DATOS");
    assert.equal(llamadas.length, 0);
  }
});

test("Errores de configuración y RPC pendiente son explícitos, sin reintentos al contrato antiguo", async () => {
  const error = { code: "42703", message: "Falta costo_envio", details: null, hint: null };
  const configuracion = preparar({ errorConfiguracion: error });
  await assert.rejects(configuracion.registrar(inputBase), fallo =>
    fallo.code === "BASE_DATOS" && fallo.diagnosticoSupabase.code === "42703");
  assert.equal(configuracion.llamadas.length, 0);

  const rpc = preparar({ errorRpc: { ...error, code: "PGRST202", message: "Firma no encontrada" } });
  await assert.rejects(rpc.registrar(inputBase), fallo =>
    fallo.code === "REQUIERE_RPC" && /PIA-4/.test(fallo.message));
  assert.equal(rpc.llamadas.length, 1);
});

test("Conserva pausa, comercio activo, horarios, categorías y productos disponibles", async () => {
  for (const opciones of [
    { pausado: true }, { disponible: false }, { categoriaActiva: false },
    { abierto: false }, { comercioActivo: false },
  ]) {
    const { registrar, llamadas } = preparar(opciones);
    await assert.rejects(registrar(inputBase), error => error.status >= 400);
    assert.equal(llamadas.length, 0);
  }
});

test("Conserva el conflicto atómico de disponibilidad que devuelve la RPC", async () => {
  const { registrar } = preparar({
    errorRpc: { code: "P0001", message: "El producto ya no está disponible", details: null, hint: null },
  });
  await assert.rejects(registrar(inputBase), error =>
    error.status === 409 && error.code === "CONFLICTO_DATOS");
});

test("Rechaza importes de catálogo inválidos y subtotales fuera del rango antes de la RPC", async () => {
  for (const opciones of [
    { precio: Infinity }, { precio: -1 }, { adicional: NaN }, { adicional: -1 },
    { precio: 9999999999.99 },
  ]) {
    const { registrar, llamadas } = preparar(opciones);
    await assert.rejects(registrar(inputBase), error => error.status >= 400);
    assert.equal(llamadas.length, 0);
  }
});

test("Descuentos confirmados por SQL en efectivo, POS y retiro, sin aceptar descuentos del navegador", async () => {
  for (const [tipoEntrega, metodoPago] of [["delivery", "efectivo"], ["delivery", "tarjeta_pos"], ["retiro", "pago_en_local"]]) {
    for (const porcentaje of [null, 0, 10, 100]) {
      const { registrar, llamadas } = preparar({ porcentaje });
      const resultado = await registrar({
        ...inputBase, metodoPago, descuento: 999, porcentaje: 100, promocionId: "ajena",
        checkout: { ...inputBase.checkout, tipoEntrega },
      });
      const esperado = descuentos.calcularDescuentoPorcentual({
        subtotal: 0.9, costoEnvio: tipoEntrega === "retiro" ? 0 : 25.15, porcentaje: porcentaje ?? 0,
      });
      assert.equal(resultado.descuento, esperado.descuento);
      assert.equal(resultado.total, esperado.total);
      assert.equal(resultado.promocion?.porcentaje ?? null, porcentaje);
      assert.equal(Object.keys(llamadas[0]).length, 12);
      assert.equal(llamadas[0].p_descuento, undefined);
    }
  }
});

test("Usa importes de la RPC, admite numeric como texto y redondeo de mitades", async () => {
  const respuesta = [{
    pedido_id: "pedido", numero_pedido: "42", subtotal: "0.15", descuento: "0.02",
    costo_envio: "25.15", total: "25.28", promocion_id: "promocion",
    promocion_nombre: "Descuento web", promocion_porcentaje: "10",
  }];
  const { registrar } = preparar({ precio: 0.05, adicional: 0, respuestaRpc: respuesta });
  const resultado = await registrar(inputBase);
  assert.equal(resultado.total, 25.28);
  assert.equal(resultado.descuento, 0.02);
  assert.equal(resultado.numeroPedido, 42);
});

test("No rechaza la suma bruta antes de SQL si el descuento deja un total válido", async () => {
  const { registrar, llamadas } = preparar({ porcentaje: 100, costo: 9999999999.99 });
  const resultado = await registrar(inputBase);
  assert.equal(llamadas.length, 1);
  assert.equal(resultado.total, 9999999999.99);
});

test("Respuesta inválida de un pedido creado conserva ID, no inventa importes ni reintenta", async () => {
  const fila = {
    pedido_id: "pedido", numero_pedido: 42, subtotal: 0.9, descuento: 0.09,
    costo_envio: 25.15, total: 25.96,
    promocion_id: "promocion", promocion_nombre: "Descuento web", promocion_porcentaje: 10,
  };
  for (const cambio of [
    { subtotal: null }, { descuento: NaN }, { descuento: -1 }, { descuento: 0.091 },
    { costo_envio: Infinity }, { total: "NaN" }, { total: 26.05 }, { total: null },
    { descuento: 0.1, total: 25.95 }, { subtotal: true }, { total: "" },
    { promocion_porcentaje: 10.5 }, { promocion_id: null }, { promocion_nombre: "" },
    { promocion_porcentaje: 101 }, { subtotal: 1 }, { costo_envio: 0 },
  ]) {
    const { registrar, llamadas } = preparar({ respuestaRpc: [{ ...fila, ...cambio }] });
    const resultado = await registrar(inputBase);
    assert.equal(resultado.pedidoId, "pedido");
    assert.equal(resultado.code, "IMPORTES_NO_CONFIRMADOS");
    for (const clave of ["subtotal", "descuento", "costoEnvio", "total"]) assert.equal(resultado[clave], null);
    assert.match(resultado.advertencia, /registrado/);
    assert.equal(llamadas.length, 1);
  }
  for (const respuestaRpc of [[{ pedido_id: "pedido" }], [fila, fila]]) {
    const { registrar } = preparar({ respuestaRpc });
    assert.equal((await registrar(inputBase)).code, "IMPORTES_NO_CONFIRMADOS");
  }
});

test("RPC sin identificador falla explícitamente, sin inventar éxito", async () => {
  for (const respuestaRpc of [[], [{}], [{ pedido_id: "" }], [{ pedido_id: 1 }]]) {
    const { registrar } = preparar({ respuestaRpc });
    await assert.rejects(registrar(inputBase), error => error.code === "BASE_DATOS" && /Consultá al local/.test(error.message));
  }
});

test("Errores transaccionales de importes o promoción no se reintentan", async () => {
  for (const code of ["22023", "P0002"]) {
    const { registrar, llamadas } = preparar({
      errorRpc: { code, message: "Error SQL", details: null, hint: null },
    });

    test("Endpoint devuelve 201 con los importes confirmados, incluso total cero o advertencia explícita", async () => {
      for (const respuestaRpc of [undefined, [{ pedido_id: "pedido", numero_pedido: 42 }]]) {
        const { registrar } = preparar({ porcentaje: 100, respuestaRpc });
        const ruta = cargar("src/app/api/pedidos/registrar/route.ts", {
          "next/server": { NextResponse: { json: (body, opciones) => ({ body, status: opciones.status }) } },
          "@/lib/pedidos/registrar": {
            PedidoError: class extends Error {},
            validarYRegistrarPedido: registrar,
          },
        });
        const resultado = await ruta.POST({
          method: "POST",
          headers: { get: clave => clave === "content-type" ? "application/json" : null },
          text: async () => JSON.stringify({
            ...inputBase, metodoPago: "pago_en_local",
            checkout: { ...inputBase.checkout, tipoEntrega: "retiro" },
          }),
        });
        assert.equal(resultado.status, 201);
        assert.equal(resultado.body.pedidoId, "pedido");
        if (respuestaRpc) {
          assert.equal(resultado.body.total, null);
          assert.equal(resultado.body.code, "IMPORTES_NO_CONFIRMADOS");
          assert.match(resultado.body.advertencia, /registrado/);
        } else {
          assert.equal(resultado.body.total, 0);
          assert.equal(resultado.body.descuento, 0.9);
        }
      }
    });
    await assert.rejects(registrar(inputBase), error => error.code === "CONFLICTO_DATOS" && error.status === 409);
    assert.equal(llamadas.length, 1);
  }
});
