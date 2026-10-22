import { NextResponse } from "next/server";
import { obtenerEstadoAccesoAdmin } from "@/lib/admin/auth";
import { createPrivateClient } from "@/lib/supabase/private";

type PedidoRow = {
  id: string;
  numero: number;
  creado_en: string;
  cliente_nombre: string;
  cliente_telefono: string;
  modalidad: string;
  direccion_calle: string | null;
  direccion_numero: string | null;
  direccion_apartamento: string | null;
  direccion_referencias: string | null;
  estado: string;
  metodo_pago: string;
  subtotal: number | string;
  descuento: number | string;
  promocion_id: string | null;
  promocion_nombre: string | null;
  promocion_porcentaje: number | string | null;
  costo_envio: number | string;
  total: number | string;
  tiempo_estimado_min: number | null;
  tiempo_estimado_max: number | null;
};

type PedidoItemRow = {
  id: string;
  pedido_id: string;
  nombre_producto: string;
  nombre_variante: string | null;
  cantidad: number;
  aclaraciones: string | null;
  total: number | string;
};

type OpcionRow = {
  pedido_item_id: string;
  nombre_opcion: string;
};

// Endpoint administrativo protegido para listar pedidos del comercio autorizado.
export async function GET() {
  const estadoAcceso = await obtenerEstadoAccesoAdmin();
  if (!estadoAcceso.autenticado) {
    return NextResponse.json(
      { error: "No autenticado para consultar pedidos administrativos." },
      { status: 401 },
    );
  }
  if (!estadoAcceso.autorizado) {
    return NextResponse.json(
      { error: "No autorizado para consultar pedidos de este comercio." },
      { status: 403 },
    );
  }

  const supabase = createPrivateClient();

  const { data: pedidosRows, error: pedidosError } = await supabase
    .from("pedidos")
    .select(
      "id, numero, creado_en, cliente_nombre, cliente_telefono, modalidad, direccion_calle, direccion_numero, direccion_apartamento, direccion_referencias, estado, metodo_pago, subtotal, descuento, promocion_id, promocion_nombre, promocion_porcentaje, costo_envio, total, tiempo_estimado_min, tiempo_estimado_max",
    )
    .eq("comercio_id", estadoAcceso.comercioId)
    .order("creado_en", { ascending: false })
    .order("numero", { ascending: false })
    .limit(200);

  if (pedidosError) {
    console.error("Error al consultar pedidos admin:", {
      code: pedidosError.code,
      message: pedidosError.message,
      details: pedidosError.details,
      hint: pedidosError.hint,
    });
    if (["42703", "PGRST204"].includes(pedidosError.code)) {
      return NextResponse.json(
        { error: "No pudimos consultar los pedidos: verificá las migraciones de PIA-4 pendientes en este entorno." },
        { status: 503 },
      );
    }
    return NextResponse.json(
      { error: "No pudimos consultar los pedidos en este momento." },
      { status: 500 },
    );
  }

  const pedidos = (pedidosRows ?? []) as PedidoRow[];
  const pedidoIds = pedidos.map((p) => p.id);
  if (pedidoIds.length === 0) {
    return NextResponse.json({ pedidos: [] }, { status: 200 });
  }

  const { data: itemsRows, error: itemsError } = await supabase
    .from("pedido_items")
    .select("id, pedido_id, nombre_producto, nombre_variante, cantidad, aclaraciones, total")
    .in("pedido_id", pedidoIds);

  if (itemsError) {
    console.error("Error al consultar items de pedidos admin:", {
      code: itemsError.code,
      message: itemsError.message,
      details: itemsError.details,
      hint: itemsError.hint,
    });
    return NextResponse.json(
      { error: "No pudimos consultar el detalle de los pedidos." },
      { status: 500 },
    );
  }

  const items = (itemsRows ?? []) as PedidoItemRow[];
  const itemIds = items.map((i) => i.id);

  let opciones: OpcionRow[] = [];
  if (itemIds.length > 0) {
    const { data: opcionesRows, error: opcionesError } = await supabase
      .from("pedido_item_opciones")
      .select("pedido_item_id, nombre_opcion")
      .in("pedido_item_id", itemIds);

    if (opcionesError) {
      console.error("Error al consultar opciones de items admin:", {
        code: opcionesError.code,
        message: opcionesError.message,
        details: opcionesError.details,
        hint: opcionesError.hint,
      });
      return NextResponse.json(
        { error: "No pudimos consultar las opciones de los pedidos." },
        { status: 500 },
      );
    }
    opciones = (opcionesRows ?? []) as OpcionRow[];
  }

  const opcionesPorItem = new Map<string, string[]>();
  for (const opcion of opciones) {
    const lista = opcionesPorItem.get(opcion.pedido_item_id) ?? [];
    lista.push(opcion.nombre_opcion);
    opcionesPorItem.set(opcion.pedido_item_id, lista);
  }

  const itemsPorPedido = new Map<string, Array<{
    nombreProducto: string;
    nombreVariante: string | null;
    cantidad: number;
    aclaraciones: string | null;
    total: number;
    opciones: string[];
  }>>();

  for (const item of items) {
    const lista = itemsPorPedido.get(item.pedido_id) ?? [];
    lista.push({
      nombreProducto: item.nombre_producto,
      nombreVariante: item.nombre_variante,
      cantidad: item.cantidad,
      aclaraciones: item.aclaraciones,
      total: Number(item.total),
      opciones: opcionesPorItem.get(item.id) ?? [],
    });
    itemsPorPedido.set(item.pedido_id, lista);
  }

  return NextResponse.json(
    {
      pedidos: pedidos.map((pedido) => ({
        id: pedido.id,
        numero: pedido.numero,
        creadoEn: pedido.creado_en,
        clienteNombre: pedido.cliente_nombre,
        clienteTelefono: pedido.cliente_telefono,
        modalidad: pedido.modalidad,
        direccion: {
          calle: pedido.direccion_calle,
          numero: pedido.direccion_numero,
          apartamento: pedido.direccion_apartamento,
          referencias: pedido.direccion_referencias,
        },
        estado: pedido.estado,
        metodoPago: pedido.metodo_pago,
        subtotal: Number(pedido.subtotal),
        descuento: Number(pedido.descuento),
        promocion: pedido.promocion_id === null ? null : {
          id: pedido.promocion_id,
          nombre: pedido.promocion_nombre,
          porcentaje: Number(pedido.promocion_porcentaje),
        },
        costoEnvio: Number(pedido.costo_envio),
        total: Number(pedido.total),
        // Rango congelado al aceptar el pedido; null en pedidos previos o pendientes.
        tiempoEstimadoMin: pedido.tiempo_estimado_min ?? null,
        tiempoEstimadoMax: pedido.tiempo_estimado_max ?? null,
        items: itemsPorPedido.get(pedido.id) ?? [],
      })),
    },
    { status: 200 },
  );
}
