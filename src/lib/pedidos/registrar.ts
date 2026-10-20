import { limitesGrupo } from "@/lib/catalogo/configurador";
import { obtenerEstadoApertura } from "@/lib/comercio/horarios";
import { validarCostoEnvio } from "@/lib/comercio/tiempos";
import { validarDatosCheckout } from "@/lib/checkout/tipos";
import { createClient } from "@/lib/supabase/server";
import { createPrivateClient } from "@/lib/supabase/private";
import { normalizarCelularUruguayo } from "@/lib/checkout/celular";
import type { PostgrestError } from "@supabase/supabase-js";
import type {
  ItemPedidoCalculado,
  ItemPedidoInput,
  PedidoCalculado,
  PedidoCheckoutInput,
  ResultadoRegistroPedido,
  MetodoPagoPedido,
} from "./tipos";

type ComercioFila = { id: string; slug: string; activo: boolean };
type ProductoFila = {
  id: string;
  comercio_id: string;
  categoria_id: string;
  nombre: string;
  precio_base: number | string | null;
  disponible: boolean;
};
type CategoriaFila = {
  id: string;
  comercio_id: string;
  activa: boolean;
  // Ausente mientras la columna de baja lógica no esté instalada.
  eliminada?: boolean;
};
type VarianteFila = {
  id: string;
  producto_id: string;
  nombre: string;
  precio: number | string;
  disponible: boolean;
};
type GrupoFila = {
  id: string;
  producto_id: string;
  nombre: string;
  minimo: number;
  maximo: number;
  obligatorio: boolean;
  activo: boolean;
};
type OpcionFila = {
  id: string;
  grupo_id: string;
  nombre: string;
  precio_adicional: number | string;
  disponible: boolean;
};
type ReglaFila = {
  variante_id: string;
  grupo_id: string;
  minimo: number;
  maximo: number;
  activo: boolean;
};

type RpcResultado = { pedido_id: string; pago_id?: string | null };

type ConfiguracionPedidoFila = {
  pedidos_pausados: boolean;
  mensaje_pausa: string;
  costo_envio: number | string;
};

type DiagnosticoSupabase = {
  etapa: string;
  origen: string;
  code: string | null;
  message: string;
  details: string | null;
  hint: string | null;
};

export class PedidoError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code:
      | "VALIDACION"
      | "REQUIERE_RPC"
      | "BASE_DATOS"
      | "CONFLICTO_DATOS"
      | "PEDIDOS_PAUSADOS" = "VALIDACION",
    readonly diagnosticoSupabase?: DiagnosticoSupabase,
  ) {
    super(message);
    this.name = "PedidoError";
  }
}

function fallar(message: string, status = 400, code: PedidoError["code"] = "VALIDACION"): never {
  throw new PedidoError(message, status, code);
}

function asegurarExito<T>(
  etapa: string,
  tabla: string,
  resultado: { data: T | null; error: PostgrestError | null },
): T {
  if (resultado.error) {
    const { message, code, details, hint } = resultado.error;
    console.error(`Error de Supabase en etapa "${etapa}" (${tabla}):`, {
      message,
      code,
      details,
      hint,
    });
    throw new PedidoError(
      `No pudimos validar el pedido por un error de base de datos (${tabla}).`,
      500,
      "BASE_DATOS",
      {
        etapa,
        origen: tabla,
        code,
        message,
        details,
        hint,
      },
    );
  }
  return resultado.data as T;
}

function normalizarTexto(valor: string, maxLen: number): string {
  return valor.trim().replace(/\s+/g, " ").slice(0, maxLen);
}

function importeEnCentimos(valor: number | string | null, concepto: string): number {
  const importe = valor === null || valor === "" ? NaN : Number(valor);
  if (validarCostoEnvio(importe)) {
    fallar(`El importe de ${concepto} no es válido.`, 409, "CONFLICTO_DATOS");
  }
  return Math.round(importe * 100);
}

function resolverMetodoPago(input: PedidoCheckoutInput): MetodoPagoPedido {
  if (input.checkout.tipoEntrega === "retiro") {
    if (input.metodoPago !== undefined && input.metodoPago !== "pago_en_local") {
      fallar("Para retiro el método de pago debe ser pago_en_local.");
    }
    return "pago_en_local";
  }
  if (input.metodoPago !== "efectivo" && input.metodoPago !== "tarjeta_pos") {
    fallar("Para delivery elegí efectivo o tarjeta POS.");
  }
  return input.metodoPago;
}

function validarInputBasico(input: PedidoCheckoutInput) {
  if (!input || typeof input !== "object") {
    fallar("La solicitud del pedido no es válida.");
  }
  if (!input.comercioSlug || typeof input.comercioSlug !== "string") {
    fallar("El comercio es obligatorio.");
  }
  if (!input.checkout || typeof input.checkout !== "object") {
    fallar("Los datos del checkout no son válidos.");
  }
  if (input.checkout.tipoEntrega !== "delivery" && input.checkout.tipoEntrega !== "retiro") {
    fallar("La modalidad de entrega debe ser delivery o retiro.");
  }
  if (!Array.isArray(input.items) || input.items.length === 0) {
    fallar("No podés confirmar un pedido sin productos.");
  }
  if (input.items.length > 40) {
    fallar("El pedido supera la cantidad máxima de ítems permitida.");
  }
  const errores = validarDatosCheckout(input.checkout);
  if (Object.keys(errores).length > 0) {
    fallar("Los datos del checkout están incompletos o son inválidos.");
  }

  input.items.forEach((item, index) => {
    if (!item.productoId) fallar(`Falta el producto en el ítem ${index + 1}.`);
    if (!Number.isInteger(item.cantidad) || item.cantidad <= 0 || item.cantidad > 99) {
      fallar(`La cantidad del ítem ${index + 1} no es válida.`);
    }
    if (typeof item.aclaraciones !== "string") {
      fallar(`Las aclaraciones del ítem ${index + 1} no son válidas.`);
    }
    if (!Array.isArray(item.opciones)) {
      fallar(`Las opciones del ítem ${index + 1} no son válidas.`);
    }
    if (item.opciones.length > 40) {
      fallar(`El ítem ${index + 1} supera la cantidad máxima de opciones permitida.`);
    }
    if (item.aclaraciones.length > 1000) {
      fallar(`Las aclaraciones del ítem ${index + 1} son demasiado extensas.`);
    }
  });
}

function validarYCalcularItem(params: {
  item: ItemPedidoInput;
  productosPorId: Map<string, ProductoFila>;
  variantesPorId: Map<string, VarianteFila>;
  gruposPorProducto: Map<string, GrupoFila[]>;
  reglasPorVarianteGrupo: Map<string, ReglaFila>;
  opcionesPorId: Map<string, OpcionFila>;
}): ItemPedidoCalculado {
  const {
    item,
    productosPorId,
    variantesPorId,
    gruposPorProducto,
    reglasPorVarianteGrupo,
    opcionesPorId,
  } = params;

  const producto = productosPorId.get(item.productoId);
  if (!producto || !producto.disponible) {
    fallar("Uno de los productos no está disponible.");
  }

  let precioBase: number | null = null;
  let varianteNombre: string | null = null;

  if (item.varianteId) {
    const variante = variantesPorId.get(item.varianteId);
    if (!variante || !variante.disponible || variante.producto_id !== item.productoId) {
      fallar(`La variante seleccionada para "${producto.nombre}" no es válida.`);
    }
    precioBase = Number(variante.precio);
    varianteNombre = variante.nombre;
  } else {
    precioBase = producto.precio_base === null ? null : Number(producto.precio_base);
  }

  if (precioBase === null || Number.isNaN(precioBase)) {
    fallar(`El producto "${producto.nombre}" no tiene precio disponible.`);
  }

  const grupos = gruposPorProducto.get(item.productoId) ?? [];
  const gruposPorId = new Map(grupos.map((g) => [g.id, g]));
  const conteoGrupo = new Map<string, number>();
  const opcionesCalculadas: ItemPedidoCalculado["opciones"] = [];
  const idsUnicos = new Set<string>();

  for (const opcionSeleccionada of item.opciones) {
    if (idsUnicos.has(opcionSeleccionada.opcionId)) {
      fallar(`Hay opciones repetidas en "${producto.nombre}".`);
    }
    idsUnicos.add(opcionSeleccionada.opcionId);

    const opcion = opcionesPorId.get(opcionSeleccionada.opcionId);
    if (!opcion || !opcion.disponible) {
      fallar(`Una opción seleccionada en "${producto.nombre}" ya no está disponible.`);
    }
    const grupo = gruposPorId.get(opcion.grupo_id);
    if (!grupo) {
      fallar(`Una opción seleccionada no pertenece al producto "${producto.nombre}".`);
    }

    conteoGrupo.set(opcion.grupo_id, (conteoGrupo.get(opcion.grupo_id) ?? 0) + 1);
    opcionesCalculadas.push({
      opcionId: opcion.id,
      grupoId: grupo.id,
      grupoNombre: grupo.nombre,
      nombre: opcion.nombre,
      precioAdicional: Number(opcion.precio_adicional),
    });
  }

  for (const grupo of grupos) {
    if (!grupo.activo) continue;
    const regla = item.varianteId
      ? reglasPorVarianteGrupo.get(`${item.varianteId}:${grupo.id}`)
      : undefined;
    const limites = limitesGrupo(
      {
        ...grupo,
        opciones: [],
      },
      item.varianteId,
      regla ? [regla] : [],
    );
    if (limites.maximo === 0) continue;
    const elegidas = conteoGrupo.get(grupo.id) ?? 0;
    if (elegidas < limites.minimo) {
      fallar(`El grupo "${grupo.nombre}" de "${producto.nombre}" no cumple el mínimo.`);
    }
    if (elegidas > limites.maximo) {
      fallar(`El grupo "${grupo.nombre}" de "${producto.nombre}" supera el máximo.`);
    }
  }

  // Se suman centésimos enteros para no enviar fracciones espurias a numeric(12,2).
  const precioUnitarioCentimos = opcionesCalculadas.reduce(
    (acum, opcion) => acum + importeEnCentimos(opcion.precioAdicional, "la opción"),
    importeEnCentimos(precioBase, "el producto"),
  );
  const precioUnitario = precioUnitarioCentimos / 100;
  const subtotal = precioUnitarioCentimos * item.cantidad / 100;

  return {
    productoId: producto.id,
    productoNombre: producto.nombre,
    varianteId: item.varianteId,
    varianteNombre,
    cantidad: item.cantidad,
    aclaraciones: normalizarTexto(item.aclaraciones, 250),
    precioUnitario,
    subtotal,
    opciones: opcionesCalculadas,
  };
}

export async function validarYRegistrarPedido(
  input: PedidoCheckoutInput,
): Promise<ResultadoRegistroPedido> {
  let etapa = "inicio";
  console.info("[pedidos] etapa inicio");
  validarInputBasico(input);
  const metodoPago = resolverMetodoPago(input);
  const celular = normalizarCelularUruguayo(input.checkout.telefono);
  if (!celular) fallar("Ingresá un celular uruguayo válido.");
  const estadoApertura = obtenerEstadoApertura();
  const programarParaApertura = Boolean(input.programarParaApertura);
  if (!estadoApertura.abierto && !programarParaApertura) {
    fallar(
      `El local está cerrado. Podés programar tu pedido para cuando abra (${estadoApertura.horaApertura}).`,
      409,
      "VALIDACION",
    );
  }
  etapa = "crear-cliente-servidor";
  console.info("[pedidos] etapa crear-cliente-servidor");
  const supabase = await createClient();

  etapa = "buscar-comercio";
  console.info("[pedidos] etapa buscar-comercio");
  const { data: comercio, error: comercioError } = await supabase
    .from("comercios")
    .select("id, slug, activo")
    .eq("slug", input.comercioSlug)
    .eq("activo", true)
    .maybeSingle();
  asegurarExito<ComercioFila | null>(etapa, "comercios", {
    data: comercio,
    error: comercioError,
  });
  if (!comercio) {
    fallar("El comercio no existe o no está activo.", 404);
  }

  // Pausa y tarifa se leen en la misma consulta con los permisos públicos existentes.
  etapa = "verificar-pausa";
  console.info("[pedidos] etapa verificar-pausa");
  const { data: configuracion, error: configuracionError } = await supabase
    .from("comercio_configuracion")
    .select("pedidos_pausados, mensaje_pausa, costo_envio")
    .eq("comercio_id", comercio.id)
    .maybeSingle();
  asegurarExito<ConfiguracionPedidoFila | null>(etapa, "comercio_configuracion", {
    data: configuracion,
    error: configuracionError,
  });
  if (configuracion?.pedidos_pausados) {
    fallar(
      configuracion.mensaje_pausa || "El local no está tomando pedidos en este momento.",
      409,
      "PEDIDOS_PAUSADOS",
    );
  }

  let costoEnvioCentimos = 0;
  if (input.checkout.tipoEntrega === "delivery") {
    if (!configuracion) {
      fallar("El comercio no tiene configurada la tarifa de delivery.", 409, "CONFLICTO_DATOS");
    }
    costoEnvioCentimos = importeEnCentimos(configuracion.costo_envio, "la tarifa de delivery");
  }

  const productoIds = [...new Set(input.items.map((i) => i.productoId))];
  const varianteIds = [
    ...new Set(input.items.map((i) => i.varianteId).filter((id): id is string => !!id)),
  ];
  const opcionIds = [
    ...new Set(
      input.items.flatMap((i) => i.opciones.map((opcion) => opcion.opcionId)),
    ),
  ];

  etapa = "consultar-datos-productos-variantes-opciones";
  console.info("[pedidos] etapa consultar-datos-productos-variantes-opciones", {
    productos: productoIds.length,
    variantes: varianteIds.length,
    opciones: opcionIds.length,
  });
  const consultarProductos = (filtrarActivos: boolean) => {
    let consulta = supabase
      .from("productos")
      .select("id, comercio_id, categoria_id, nombre, precio_base, disponible")
      .in("id", productoIds);
    if (filtrarActivos) {
      consulta = consulta.eq("activo", true);
    }
    return consulta;
  };
  const resultadosConsulta = await Promise.all([
    consultarProductos(true),
    varianteIds.length > 0
      ? supabase
          .from("variantes_producto")
          .select("id, producto_id, nombre, precio, disponible")
          .in("id", varianteIds)
      : Promise.resolve({ data: [] as VarianteFila[], error: null }),
    supabase
      .from("grupos_opciones")
      .select("id, producto_id, nombre, minimo, maximo, obligatorio, activo")
      .in("producto_id", productoIds)
      .eq("activo", true),
    supabase
      .from("reglas_opciones_variante")
      .select("variante_id, grupo_id, minimo, maximo, activo")
      .in("producto_id", productoIds)
      .eq("activo", true),
    opcionIds.length > 0
      ? supabase
          .from("opciones")
          .select("id, grupo_id, nombre, precio_adicional, disponible")
          .in("id", opcionIds)
      : Promise.resolve({ data: [] as OpcionFila[], error: null }),
  ]);
  let resProductos = resultadosConsulta[0];
  const [, resVariantes, resGrupos, resReglas, resOpciones] =
    resultadosConsulta;
  if (
    resProductos.error?.code === "42703" ||
    resProductos.error?.code === "PGRST204"
  ) {
    resProductos = await consultarProductos(false);
  }

  const productos = asegurarExito<ProductoFila[]>(etapa, "productos", resProductos);
  const variantes = asegurarExito<VarianteFila[]>(
    etapa,
    "variantes_producto",
    resVariantes,
  );
  const grupos = asegurarExito<GrupoFila[]>(etapa, "grupos_opciones", resGrupos);
  const reglas = asegurarExito<ReglaFila[]>(
    etapa,
    "reglas_opciones_variante",
    resReglas,
  );
  const opciones = asegurarExito<OpcionFila[]>(etapa, "opciones", resOpciones);

  const categoriaIds = [...new Set(productos.map((producto) => producto.categoria_id))];
  // Se consulta "eliminada" para rechazar categorías dadas de baja aunque
  // hubieran quedado marcadas como activas. El reintento mantiene la
  // compatibilidad mientras la columna no esté instalada.
  type RespuestaCategorias = {
    data: CategoriaFila[] | null;
    error: PostgrestError | null;
  };
  let resCategorias = (await supabase
    .from("categorias")
    .select("id, comercio_id, activa, eliminada")
    .in("id", categoriaIds)) as unknown as RespuestaCategorias;
  if (
    resCategorias.error?.code === "42703" ||
    resCategorias.error?.code === "PGRST204"
  ) {
    resCategorias = (await supabase
      .from("categorias")
      .select("id, comercio_id, activa")
      .in("id", categoriaIds)) as unknown as RespuestaCategorias;
  }
  const categorias = asegurarExito<CategoriaFila[]>(
    etapa,
    "categorias",
    resCategorias,
  );

  if (productos.length !== productoIds.length) {
    fallar("Hay productos inexistentes en el carrito.", 409, "CONFLICTO_DATOS");
  }
  if (
    productos.some(
      (producto) => producto.comercio_id !== comercio.id || !producto.disponible,
    )
  ) {
    fallar("Hay productos que ya no pertenecen al comercio o no están disponibles.", 409, "CONFLICTO_DATOS");
  }
  if (
    categorias.length !== categoriaIds.length ||
    categorias.some(
      (categoria) =>
        categoria.comercio_id !== comercio.id ||
        !categoria.activa ||
        categoria.eliminada === true,
    )
  ) {
    fallar(
      "Hay productos cuya categoría ya no está disponible.",
      409,
      "CONFLICTO_DATOS",
    );
  }
  if (variantes.length !== varianteIds.length) {
    fallar("Hay variantes inexistentes en el carrito.", 409, "CONFLICTO_DATOS");
  }
  if (opciones.length !== opcionIds.length) {
    fallar("Hay opciones inexistentes en el carrito.", 409, "CONFLICTO_DATOS");
  }

  const productosPorId = new Map(productos.map((p) => [p.id, p]));
  const variantesPorId = new Map(variantes.map((v) => [v.id, v]));
  const gruposPorProducto = new Map<string, GrupoFila[]>();
  for (const grupo of grupos) {
    const lista = gruposPorProducto.get(grupo.producto_id) ?? [];
    lista.push(grupo);
    gruposPorProducto.set(grupo.producto_id, lista);
  }
  const reglasPorVarianteGrupo = new Map(
    reglas.map((r) => [`${r.variante_id}:${r.grupo_id}`, r]),
  );
  const opcionesPorId = new Map(opciones.map((o) => [o.id, o]));

  etapa = "validar-y-recalcular-items";
  console.info("[pedidos] etapa validar-y-recalcular-items");
  const itemsCalculados = input.items.map((item) =>
    validarYCalcularItem({
      item,
      productosPorId,
      variantesPorId,
      gruposPorProducto,
      reglasPorVarianteGrupo,
      opcionesPorId,
    }),
  );
  const subtotalCentimos = itemsCalculados.reduce(
    (acum, item) => acum + importeEnCentimos(item.subtotal, "los productos"),
    0,
  );
  const subtotal = subtotalCentimos / 100;
  const costoEnvio = costoEnvioCentimos / 100;
  const total = (subtotalCentimos + costoEnvioCentimos) / 100;
  if (subtotal <= 0 || validarCostoEnvio(subtotal) || validarCostoEnvio(total)) {
    fallar("Los importes del pedido superan el rango permitido o el subtotal no es positivo.", 409, "CONFLICTO_DATOS");
  }

  const pedidoCalculado: PedidoCalculado = {
    comercioId: comercio.id,
    subtotal,
    costoEnvio,
    total,
    items: itemsCalculados,
  };
  const referenciasProgramacion = normalizarTexto(input.checkout.referencias, 220);
  const referenciasFinales =
    !estadoApertura.abierto && programarParaApertura
      ? normalizarTexto(
          [referenciasProgramacion, `Programado para apertura ${estadoApertura.horaApertura}`]
            .filter(Boolean)
            .join(" · "),
          250,
        ) || null
      : referenciasProgramacion || null;

  // Registro atómico: se ejecuta TODO dentro de un RPC con transacción.
  etapa = "ejecutar-rpc-registrar-pedido";
  console.info("[pedidos] etapa ejecutar-rpc-registrar-pedido");
  const supabasePrivado = createPrivateClient();
  const { data: rpcData, error: rpcError } = await supabasePrivado.rpc(
    "registrar_pedido_desde_checkout",
    {
      p_comercio_id: pedidoCalculado.comercioId,
      p_modalidad_entrega: input.checkout.tipoEntrega,
      p_cliente_nombre: normalizarTexto(input.checkout.nombre, 120),
      p_cliente_telefono: celular,
      p_direccion_calle:
        input.checkout.tipoEntrega === "delivery"
          ? normalizarTexto(input.checkout.calle, 120)
          : null,
      p_direccion_numero:
        input.checkout.tipoEntrega === "delivery"
          ? normalizarTexto(input.checkout.numero, 20)
          : null,
      p_direccion_apartamento: normalizarTexto(input.checkout.apartamento, 20) || null,
      p_direccion_referencias: referenciasFinales,
      p_metodo_pago: metodoPago,
      p_subtotal: subtotal,
      p_costo_envio: pedidoCalculado.costoEnvio,
      p_items: pedidoCalculado.items.map((item) => ({
        producto_id: item.productoId,
        producto_nombre: item.productoNombre,
        variante_id: item.varianteId,
        variante_nombre: item.varianteNombre,
        cantidad: item.cantidad,
        aclaraciones: item.aclaraciones || null,
        precio_unitario: item.precioUnitario,
        subtotal: item.subtotal,
        opciones: item.opciones.map((opcion) => ({
          opcion_id: opcion.opcionId,
          grupo_id: opcion.grupoId,
          grupo_nombre: opcion.grupoNombre,
          opcion_nombre: opcion.nombre,
          precio_adicional: opcion.precioAdicional,
        })),
      })),
    },
  );

  if (rpcError) {
    const { message, code, details, hint } = rpcError;
    console.error("Error al ejecutar registrar_pedido_desde_checkout:", {
      message,
      code,
      details,
      hint,
    });
    if (
      message.includes("El producto ya no está disponible") ||
      message.includes("La variante ya no está disponible")
    ) {
      throw new PedidoError(
        "Un producto o variante del carrito se agotó. Revisá el pedido antes de confirmar.",
        409,
        "CONFLICTO_DATOS",
      );
    }
    if (code === "PGRST202") {
      throw new PedidoError(
        "Falta aplicar la migración de PIA-3 para registrar pedidos con medios de pago y costo de envío.",
        501,
        "REQUIERE_RPC",
        {
          etapa,
          origen: "rpc:registrar_pedido_desde_checkout",
          code,
          message,
          details,
          hint,
        },
      );
    }
    throw new PedidoError(
      "No pudimos registrar el pedido por un error del servidor.",
      500,
      "BASE_DATOS",
      {
        etapa,
        origen: "rpc:registrar_pedido_desde_checkout",
        code,
        message,
        details,
        hint,
      },
    );
  }

  const fila = Array.isArray(rpcData) ? (rpcData[0] as RpcResultado | undefined) : undefined;
  if (!fila?.pedido_id) {
    console.error("[pedidos] rpc sin pedido_id en respuesta", {
      tipoData: Array.isArray(rpcData) ? "array" : typeof rpcData,
      largoArray: Array.isArray(rpcData) ? rpcData.length : null,
    });
    throw new PedidoError(
      "El servidor no devolvió el identificador del pedido creado.",
      500,
      "BASE_DATOS",
    );
  }
  console.info("[pedidos] pedido_id devuelto por rpc", { pedidoId: fila.pedido_id });
  // Número correlativo visible en el panel del local; es el que se le muestra al cliente.
  // Si la consulta falla, el pedido ya quedó registrado, así que no se interrumpe el flujo.
  const { data: pedidoCreado, error: errorNumero } = await supabasePrivado
    .from("pedidos")
    .select("numero")
    .eq("id", fila.pedido_id)
    .maybeSingle();
  if (errorNumero) {
    console.error("[pedidos] no se pudo obtener el número del pedido", {
      code: errorNumero.code,
      message: errorNumero.message,
    });
  }

  return {
    pedidoId: fila.pedido_id,
    numeroPedido:
      typeof pedidoCreado?.numero === "number" ? pedidoCreado.numero : null,
    subtotal,
    costoEnvio,
    total,
  };
}
