import { NextResponse } from "next/server";
import { obtenerEstadoAccesoAdmin } from "@/lib/admin/auth";
import { createPrivateClient } from "@/lib/supabase/private";

// Marca como vista la notificación de un pedido.
// Sólo escribe "revisado_en": el estado comercial del pedido queda intacto.
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

  const payload = body as { pedidoId?: unknown };
  const pedidoId = typeof payload.pedidoId === "string" ? payload.pedidoId : "";
  if (!pedidoId) {
    return NextResponse.json(
      { error: "Falta el identificador del pedido a marcar como visto." },
      { status: 400 },
    );
  }

  const supabase = createPrivateClient();

  // "revisado_en is null" hace la operación idempotente: si otra sesión ya lo marcó,
  // no se pisa la marca original y la respuesta sigue siendo correcta.
  const { error } = await supabase
    .from("pedidos")
    .update({ revisado_en: new Date().toISOString() })
    .eq("id", pedidoId)
    .eq("comercio_id", acceso.comercioId)
    .is("revisado_en", null);

  if (error) {
    console.error("Error al marcar pedido como revisado:", {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
    // 42703: la columna todavía no existe porque falta aplicar la migración.
    if (error.code === "42703") {
      return NextResponse.json(
        {
          error:
            "Falta aplicar en Supabase la migración de notificaciones de pedidos.",
        },
        { status: 503 },
      );
    }
    return NextResponse.json(
      { error: "No pudimos marcar el pedido como visto." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, pedidoId }, { status: 200 });
}
