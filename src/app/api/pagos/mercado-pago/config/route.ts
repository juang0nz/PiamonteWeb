import { NextResponse } from "next/server";
import { obtenerConfiguracionMercadoPago } from "@/lib/pagos/mercadoPago";

export async function GET() {
  return NextResponse.json(obtenerConfiguracionMercadoPago(), { status: 200 });
}
