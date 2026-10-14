import { NextResponse } from "next/server";
import {
  MercadoPagoError,
  obtenerConfiguracionMercadoPago,
  verificarFirmaWebhookMercadoPago,
} from "@/lib/pagos/mercadoPago";
import { procesarNotificacionPago } from "@/lib/pagos/servicioMercadoPago";

export const runtime = "nodejs";

const MAX_BODY_BYTES = 32 * 1024;

type NotificacionMercadoPago = {
  id?: string | number;
  type?: string;
  topic?: string;
  data?: { id?: string | number };
};

export async function POST(request: Request) {
  if (!obtenerConfiguracionMercadoPago().habilitado) {
    return NextResponse.json(
      { error: "Mercado Pago todavía no está habilitado." },
      { status: 503 },
    );
  }

  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return NextResponse.json(
      { error: "La notificación es demasiado grande." },
      { status: 413 },
    );
  }

  let notificacion: NotificacionMercadoPago;
  try {
    const texto = await request.text();
    if (new TextEncoder().encode(texto).length > MAX_BODY_BYTES) {
      return NextResponse.json(
        { error: "La notificación es demasiado grande." },
        { status: 413 },
      );
    }
    notificacion = JSON.parse(texto) as NotificacionMercadoPago;
  } catch {
    return NextResponse.json(
      { error: "La notificación no contiene JSON válido." },
      { status: 400 },
    );
  }

  const tipo = notificacion.type ?? notificacion.topic;
  if (tipo !== "payment") {
    return NextResponse.json({ ok: true, ignorada: true }, { status: 200 });
  }

  const url = new URL(request.url);
  const dataIdUrl = url.searchParams.get("data.id");
  const dataIdBody =
    notificacion.data?.id === undefined
      ? null
      : String(notificacion.data.id);
  const paymentId = dataIdUrl;
  const eventoId =
    notificacion.id === undefined ? null : String(notificacion.id);
  const signature = request.headers.get("x-signature");
  const requestId = request.headers.get("x-request-id");

  if (!paymentId || !eventoId || !signature || !requestId) {
    return NextResponse.json(
      { error: "La notificación no tiene los identificadores o firma requeridos." },
      { status: 400 },
    );
  }
  if (dataIdUrl && dataIdBody && dataIdUrl !== dataIdBody) {
    return NextResponse.json(
      { error: "El identificador del pago no coincide." },
      { status: 400 },
    );
  }

  try {
    if (
      !verificarFirmaWebhookMercadoPago({
        dataId: paymentId,
        requestId,
        signature,
      })
    ) {
      return NextResponse.json(
        { error: "La firma de la notificación no es válida." },
        { status: 401 },
      );
    }

    const resultado = await procesarNotificacionPago({
      eventoId,
      paymentId,
    });
    return NextResponse.json(
      {
        ok: true,
        procesado: resultado.procesado,
        duplicado: resultado.duplicado,
      },
      { status: 200 },
    );
  } catch (error) {
    if (error instanceof MercadoPagoError) {
      console.error("No se pudo procesar el webhook de Mercado Pago:", {
        codigo: error.codigo,
        message: error.message,
      });
      return NextResponse.json(
        { error: error.message, code: error.codigo },
        { status: error.status },
      );
    }
    console.error("Error no controlado en webhook de Mercado Pago:", error);
    return NextResponse.json(
      { error: "No pudimos procesar la notificación." },
      { status: 500 },
    );
  }
}
