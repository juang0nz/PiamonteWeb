import { NextResponse } from "next/server";
import {
  MercadoPagoError,
  obtenerConfiguracionMercadoPago,
} from "@/lib/pagos/mercadoPago";
import { obtenerOCrearPreferencia } from "@/lib/pagos/servicioMercadoPago";

export const runtime = "nodejs";

// Inicia Checkout Pro únicamente para un intento ya creado por el backend.
// El cliente nunca envía montos ni estados; ambos se leen desde Supabase.
export async function POST(request: Request) {
  if (!obtenerConfiguracionMercadoPago().habilitado) {
    return NextResponse.json(
      { error: "Mercado Pago todavía no está habilitado." },
      { status: 503 },
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
  const pagoId =
    typeof (body as { pagoId?: unknown })?.pagoId === "string"
      ? (body as { pagoId: string }).pagoId
      : "";
  if (!pagoId) {
    return NextResponse.json(
      { error: "Falta el identificador del intento de pago." },
      { status: 400 },
    );
  }

  try {
    const preferencia = await obtenerOCrearPreferencia(pagoId);
    return NextResponse.json(preferencia, { status: 200 });
  } catch (error) {
    if (error instanceof MercadoPagoError) {
      return NextResponse.json(
        { error: error.message, code: error.codigo },
        { status: error.status },
      );
    }
    console.error("Error no controlado al crear preferencia:", error);
    return NextResponse.json(
      { error: "No pudimos iniciar el pago." },
      { status: 500 },
    );
  }
}
