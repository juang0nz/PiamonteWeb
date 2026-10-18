import { NextResponse } from "next/server";
import { obtenerEstadoAccesoAdmin } from "@/lib/admin/auth";
import { createPrivateClient } from "@/lib/supabase/private";
import { createClient } from "@/lib/supabase/server";

const UUID_VALIDO =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type EstadoPedido =
  | "pendiente"
  | "confirmado"
  | "en_preparacion"
  | "listo"
  | "entregado"
  | "cancelado";

const TRANSICIONES_PERMITIDAS: Record<EstadoPedido, EstadoPedido[]> = {
  pendiente: ["en_preparacion", "cancelado"],
  // Compatibilidad con pedidos antiguos que todavía estén en estado confirmado.
  confirmado: ["listo", "cancelado"],
  en_preparacion: ["listo"],
  listo: ["entregado"],
  entregado: [],
  cancelado: [],
};

function esEstadoPedido(valor: string): valor is EstadoPedido {
  return (
    valor === "pendiente" ||
    valor === "confirmado" ||
    valor === "en_preparacion" ||
    valor === "listo" ||
    valor === "entregado" ||
    valor === "cancelado"
  );
}

// Actualiza estado de un pedido de forma atómica, validando autorización y transición.
export async function PATCH(request: Request) {
  const acceso = await obtenerEstadoAccesoAdmin();
  if (!acceso.autenticado) {
    return NextResponse.json(
      { error: "No autenticado para modificar pedidos." },
      { status: 401 },
    );
  }
  if (!acceso.autorizado) {
    return NextResponse.json(
      { error: "No autorizado para modificar pedidos de este comercio." },
      { status: 403 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "El cuerpo de la solicitud no es JSON válido." },
      { status: 400 },
    );
  }

  const payload = body as {
    pedidoId?: unknown;
    estadoActualEsperado?: unknown;
    nuevoEstado?: unknown;
    operacionId?: unknown;
  };
  const pedidoId = typeof payload.pedidoId === "string" ? payload.pedidoId : "";
  const estadoActualEsperado =
    typeof payload.estadoActualEsperado === "string"
      ? payload.estadoActualEsperado
      : "";
  const nuevoEstado =
    typeof payload.nuevoEstado === "string" ? payload.nuevoEstado : "";
  const operacionId =
    typeof payload.operacionId === "string" ? payload.operacionId.trim() : "";

  if (
    !UUID_VALIDO.test(pedidoId) ||
    !UUID_VALIDO.test(operacionId) ||
    !estadoActualEsperado ||
    !nuevoEstado
  ) {
    return NextResponse.json(
      { error: "Faltan datos para actualizar el estado del pedido." },
      { status: 400 },
    );
  }
  if (!esEstadoPedido(estadoActualEsperado) || !esEstadoPedido(nuevoEstado)) {
    return NextResponse.json(
      { error: "Estado de pedido inválido." },
      { status: 400 },
    );
  }
  if (!TRANSICIONES_PERMITIDAS[estadoActualEsperado].includes(nuevoEstado)) {
    return NextResponse.json(
      { error: "La transición de estado solicitada no está permitida." },
      { status: 409 },
    );
  }
  if (acceso.rol === "empleado" && nuevoEstado === "cancelado") {
    return NextResponse.json(
      { error: "El rol Empleado no puede cancelar pedidos." },
      { status: 403 },
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc(
    "admin_actualizar_estado_pedido_auditado",
    {
      p_operacion_id: operacionId,
      p_comercio_id: acceso.comercioId,
      p_pedido_id: pedidoId,
      p_estado_esperado: estadoActualEsperado,
      p_nuevo_estado: nuevoEstado,
    },
  );

  if (error) {
    if (error.code === "40001") {
      const supabasePrivado = createPrivateClient();
      const { data: estadoActual, error: consultaEstadoError } =
        await supabasePrivado
          .from("pedidos")
          .select("estado")
          .eq("id", pedidoId)
          .eq("comercio_id", acceso.comercioId)
          .maybeSingle();

      if (consultaEstadoError) {
        console.error("Error al verificar estado actual tras conflicto:", {
          code: consultaEstadoError.code,
          message: consultaEstadoError.message,
          details: consultaEstadoError.details,
          hint: consultaEstadoError.hint,
        });
        return NextResponse.json(
          { error: "No pudimos verificar el estado actual del pedido." },
          { status: 500 },
        );
      }

      if (!estadoActual) {
        return NextResponse.json(
          {
            error:
              "El pedido no existe o no pertenece al comercio autorizado.",
          },
          { status: 404 },
        );
      }

      return NextResponse.json(
        {
          error:
            "El pedido cambió de estado recientemente. Actualizá la lista y reintentá.",
          estadoActual: estadoActual.estado,
        },
        { status: 409 },
      );
    }
    if (error.code === "42501") {
      return NextResponse.json(
        { error: "No autorizado para modificar pedidos de este comercio." },
        { status: 403 },
      );
    }
    console.error("Error al actualizar estado de pedido:", {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
    return NextResponse.json(
      { error: "No pudimos actualizar el estado del pedido." },
      { status: 500 },
    );
  }

  // Al aceptar, la RPC congela el rango estimado vigente; se devuelve para que el panel
  // lo incluya en el aviso de WhatsApp sin otra recarga. Si la lectura falla, el estado ya
  // cambió y la respuesta sigue siendo exitosa, solo sin el rango.
  const tiempoEstimado =
    nuevoEstado === "en_preparacion"
      ? await leerTiempoEstimado(supabase, pedidoId, acceso.comercioId)
      : null;

  return NextResponse.json(
    {
      ok: true,
      pedidoId,
      estado: nuevoEstado,
      tiempoEstimado,
      mensaje: "Estado actualizado correctamente.",
    },
    { status: 200 },
  );
}

async function leerTiempoEstimado(
  supabase: Awaited<ReturnType<typeof createClient>>,
  pedidoId: string,
  comercioId: string,
): Promise<{ min: number; max: number } | null> {
  try {
    // El cliente de sesión puede leer el pedido por la política "Personal del comercio lee pedidos".
    const { data, error } = await supabase
      .from("pedidos")
      .select("tiempo_estimado_min, tiempo_estimado_max")
      .eq("id", pedidoId)
      .eq("comercio_id", comercioId)
      .maybeSingle();
    if (error || !data) return null;
    const fila = data as { tiempo_estimado_min: number | null; tiempo_estimado_max: number | null };
    if (fila.tiempo_estimado_min === null || fila.tiempo_estimado_max === null) return null;
    return { min: fila.tiempo_estimado_min, max: fila.tiempo_estimado_max };
  } catch (errorLectura) {
    console.warn("No se pudo leer el tiempo estimado del pedido aceptado:", errorLectura);
    return null;
  }
}
