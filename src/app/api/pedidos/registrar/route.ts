import { NextResponse } from "next/server";
import { PedidoError, validarYRegistrarPedido } from "@/lib/pedidos/registrar";
import type { PedidoCheckoutInput } from "@/lib/pedidos/tipos";

const MAX_BODY_BYTES = 64 * 1024; // 64 KB

export async function POST(request: Request) {
  console.info("[api/pedidos/registrar] request recibida", {
    method: request.method,
    hasContentLength: Boolean(request.headers.get("content-length")),
  });
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    console.info("[api/pedidos/registrar] rechazo por content-type", { contentType });
    return NextResponse.json(
      { error: "El contenido debe enviarse como JSON." },
      { status: 415 },
    );
  }

  const contentLength = request.headers.get("content-length");
  if (contentLength) {
    const largo = Number(contentLength);
    if (!Number.isFinite(largo) || largo < 0) {
      console.info("[api/pedidos/registrar] rechazo content-length inválido");
      return NextResponse.json(
        { error: "El encabezado Content-Length no es válido." },
        { status: 400 },
      );
    }
    if (largo > MAX_BODY_BYTES) {
      console.info("[api/pedidos/registrar] rechazo por body demasiado grande (header)");
      return NextResponse.json(
        { error: "La solicitud es demasiado grande." },
        { status: 413 },
      );
    }
  }

  let body: unknown;
  try {
    const raw = await request.text();
    const bytes = new TextEncoder().encode(raw).length;
    if (bytes > MAX_BODY_BYTES) {
      console.info("[api/pedidos/registrar] rechazo por body demasiado grande (real)", {
        bytes,
      });
      return NextResponse.json(
        { error: "La solicitud es demasiado grande." },
        { status: 413 },
      );
    }
    body = JSON.parse(raw);
    const payload = body as {
      comercioSlug?: unknown;
      checkout?: { tipoEntrega?: unknown; metodoPago?: unknown } | null;
      programarParaApertura?: unknown;
      items?: unknown[];
    };
    console.info("[api/pedidos/registrar] body parseado", {
      comercioSlug: payload?.comercioSlug ?? null,
      tipoEntrega: payload?.checkout?.tipoEntrega ?? null,
      metodoPago: payload?.checkout?.metodoPago ?? null,
      programarParaApertura: payload?.programarParaApertura ?? null,
      items: Array.isArray(payload?.items) ? payload.items.length : null,
    });
  } catch {
    console.info("[api/pedidos/registrar] rechazo por JSON inválido");
    return NextResponse.json(
      { error: "El cuerpo de la solicitud no es JSON válido." },
      { status: 400 },
    );
  }

  try {
    console.info("[api/pedidos/registrar] iniciando validarYRegistrarPedido");
    const resultado = await validarYRegistrarPedido(body as PedidoCheckoutInput);
    console.info("[api/pedidos/registrar] pedido registrado", {
      pedidoId: resultado.pedidoId,
    });
    return NextResponse.json(resultado, { status: 201 });
  } catch (error) {
    if (error instanceof PedidoError) {
      console.error("[api/pedidos/registrar] PedidoError", {
        status: error.status,
        code: error.code,
        message: error.message,
      });
      // Diagnóstico temporal: deja en logs del servidor el error original de Supabase.
      if (error.diagnosticoSupabase) {
        console.error("Diagnóstico Supabase (temporal):", {
          etapa: error.diagnosticoSupabase.etapa,
          code: error.diagnosticoSupabase.code,
          message: error.diagnosticoSupabase.message,
          details: error.diagnosticoSupabase.details,
          hint: error.diagnosticoSupabase.hint,
          origen: error.diagnosticoSupabase.origen,
        });
      }
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status },
      );
    }
    console.error("Error no controlado al registrar pedido:", error);
    return NextResponse.json(
      { error: "No pudimos registrar el pedido.", code: "DESCONOCIDO" },
      { status: 500 },
    );
  }
}
