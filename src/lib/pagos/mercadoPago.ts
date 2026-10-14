import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { MERCADO_PAGO_DISPONIBLE_EN_CHECKOUT } from "./configuracion";

export type EstadoPagoPedido = "pendiente" | "aprobado" | "rechazado";

type ConfiguracionPrivadaMercadoPago = {
  accessToken: string;
  webhookSecret: string;
  baseUrlPublica: string;
};

type PreferenciaMercadoPago = {
  id: string;
  init_point: string;
};

export type PagoVerificadoMercadoPago = {
  id: string;
  estado: EstadoPagoPedido;
  referenciaExterna: string;
  monto: number;
  moneda: string;
};

export class MercadoPagoError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly codigo:
      | "DESHABILITADO"
      | "CONFIGURACION"
      | "PROVEEDOR"
      | "RESPUESTA_INVALIDA",
  ) {
    super(message);
    this.name = "MercadoPagoError";
  }
}

const API_MERCADO_PAGO = "https://api.mercadopago.com";
const ESTADOS_RECHAZADOS = new Set([
  "rejected",
  "cancelled",
  "refunded",
  "charged_back",
]);

function leerVariable(nombre: string): string | null {
  const valor = process.env[nombre]?.trim();
  return valor ? valor : null;
}

function configuracionPrivada(): ConfiguracionPrivadaMercadoPago {
  if (
    !MERCADO_PAGO_DISPONIBLE_EN_CHECKOUT ||
    process.env.MERCADO_PAGO_ENABLED !== "true"
  ) {
    throw new MercadoPagoError(
      "Mercado Pago todavía no está habilitado.",
      503,
      "DESHABILITADO",
    );
  }

  const accessToken = leerVariable("MERCADO_PAGO_ACCESS_TOKEN");
  const webhookSecret = leerVariable("MERCADO_PAGO_WEBHOOK_SECRET");
  const baseUrlPublica = leerVariable("MERCADO_PAGO_PUBLIC_BASE_URL");
  if (!accessToken || !webhookSecret || !baseUrlPublica) {
    throw new MercadoPagoError(
      "La configuración privada de Mercado Pago está incompleta.",
      503,
      "CONFIGURACION",
    );
  }

  let url: URL;
  try {
    url = new URL(baseUrlPublica);
  } catch {
    throw new MercadoPagoError(
      "MERCADO_PAGO_PUBLIC_BASE_URL no es una URL válida.",
      503,
      "CONFIGURACION",
    );
  }
  if (url.protocol !== "https:") {
    throw new MercadoPagoError(
      "MERCADO_PAGO_PUBLIC_BASE_URL debe utilizar HTTPS.",
      503,
      "CONFIGURACION",
    );
  }

  return {
    accessToken,
    webhookSecret,
    baseUrlPublica: url.origin,
  };
}

export function obtenerConfiguracionMercadoPago() {
  const variablesPresentes = Boolean(
    leerVariable("MERCADO_PAGO_ACCESS_TOKEN") &&
      leerVariable("MERCADO_PAGO_WEBHOOK_SECRET") &&
      leerVariable("MERCADO_PAGO_PUBLIC_BASE_URL"),
  );
  const habilitado =
    MERCADO_PAGO_DISPONIBLE_EN_CHECKOUT &&
    process.env.MERCADO_PAGO_ENABLED === "true" &&
    variablesPresentes;

  return {
    habilitado,
    checkoutDisponible: MERCADO_PAGO_DISPONIBLE_EN_CHECKOUT,
    credencialesConfiguradas: variablesPresentes,
    mensaje: habilitado
      ? "El backend está configurado; el checkout continúa bloqueado hasta completar las pruebas reales."
      : "Mercado Pago permanece deshabilitado hasta configurar credenciales privadas y completar las pruebas.",
  };
}

export function validarMetodoPagoParaPedido(metodoPago: string) {
  if (metodoPago === "efectivo") return { valido: true } as const;
  if (metodoPago !== "mercado_pago") {
    return { valido: false, error: "El método de pago no es válido." } as const;
  }

  try {
    configuracionPrivada();
  } catch (error) {
    return {
      valido: false,
      error:
        error instanceof MercadoPagoError
          ? error.message
          : "Mercado Pago todavía no está habilitado.",
    } as const;
  }
  return { valido: true } as const;
}

async function solicitarMercadoPago<T>(
  ruta: string,
  init: RequestInit,
  fetchImpl: typeof fetch,
): Promise<T> {
  const { accessToken } = configuracionPrivada();
  let respuesta: Response;
  try {
    respuesta = await fetchImpl(`${API_MERCADO_PAGO}${ruta}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        ...init.headers,
      },
      cache: "no-store",
    });
  } catch (error) {
    console.error("No se pudo conectar con Mercado Pago:", error);
    throw new MercadoPagoError(
      "No pudimos comunicarnos con Mercado Pago.",
      502,
      "PROVEEDOR",
    );
  }

  const cuerpo = (await respuesta.json().catch(() => null)) as T | null;
  if (!respuesta.ok || !cuerpo) {
    console.error("Mercado Pago respondió con un error:", {
      status: respuesta.status,
      cuerpo,
    });
    throw new MercadoPagoError(
      "Mercado Pago rechazó la operación.",
      502,
      "PROVEEDOR",
    );
  }
  return cuerpo;
}

export async function crearPreferenciaMercadoPago(
  params: {
    pagoId: string;
    pedidoId: string;
    numeroPedido: number | null;
    monto: number;
    moneda: string;
  },
  fetchImpl: typeof fetch = fetch,
): Promise<{ preferenciaId: string; urlCheckout: string }> {
  const config = configuracionPrivada();
  const preferencia = await solicitarMercadoPago<PreferenciaMercadoPago>(
    "/checkout/preferences",
    {
      method: "POST",
      body: JSON.stringify({
        items: [
          {
            id: params.pedidoId,
            title:
              params.numeroPedido === null
                ? "Pedido Piamonte"
                : `Pedido Piamonte #${params.numeroPedido}`,
            quantity: 1,
            currency_id: params.moneda,
            unit_price: params.monto,
          },
        ],
        external_reference: params.pagoId,
        notification_url: `${config.baseUrlPublica}/api/pagos/mercado-pago/webhook`,
        metadata: {
          pago_id: params.pagoId,
          pedido_id: params.pedidoId,
        },
      }),
    },
    fetchImpl,
  );

  if (!preferencia.id || !preferencia.init_point) {
    throw new MercadoPagoError(
      "Mercado Pago devolvió una preferencia incompleta.",
      502,
      "RESPUESTA_INVALIDA",
    );
  }
  return {
    preferenciaId: preferencia.id,
    urlCheckout: preferencia.init_point,
  };
}

function mapearEstadoMercadoPago(estado: string): EstadoPagoPedido {
  if (estado === "approved") return "aprobado";
  if (ESTADOS_RECHAZADOS.has(estado)) return "rechazado";
  return "pendiente";
}

export async function consultarPagoMercadoPago(
  paymentId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<PagoVerificadoMercadoPago> {
  const pago = await solicitarMercadoPago<{
    id?: number | string;
    status?: string;
    external_reference?: string;
    transaction_amount?: number;
    currency_id?: string;
  }>(
    `/v1/payments/${encodeURIComponent(paymentId)}`,
    { method: "GET" },
    fetchImpl,
  );

  if (
    pago.id === undefined ||
    typeof pago.status !== "string" ||
    typeof pago.external_reference !== "string" ||
    typeof pago.transaction_amount !== "number" ||
    typeof pago.currency_id !== "string"
  ) {
    throw new MercadoPagoError(
      "Mercado Pago devolvió datos incompletos para el pago.",
      502,
      "RESPUESTA_INVALIDA",
    );
  }

  return {
    id: String(pago.id),
    estado: mapearEstadoMercadoPago(pago.status),
    referenciaExterna: pago.external_reference,
    monto: pago.transaction_amount,
    moneda: pago.currency_id,
  };
}

function firmaHexValida(recibida: string, esperada: string): boolean {
  if (!/^[a-fA-F0-9]+$/.test(recibida) || recibida.length !== esperada.length) {
    return false;
  }
  return timingSafeEqual(
    Buffer.from(recibida.toLowerCase(), "hex"),
    Buffer.from(esperada, "hex"),
  );
}

export function verificarFirmaWebhookMercadoPago(params: {
  dataId: string;
  requestId: string;
  signature: string;
}): boolean {
  const { webhookSecret } = configuracionPrivada();
  const partes = Object.fromEntries(
    params.signature
      .split(",")
      .map((parte) => parte.trim().split("=", 2))
      .filter(
        (parte): parte is [string, string] =>
          parte.length === 2 && Boolean(parte[0]) && Boolean(parte[1]),
      ),
  );
  const timestamp = partes.ts;
  const firma = partes.v1;
  if (!timestamp || !firma) return false;

  const manifiesto = `id:${params.dataId.toLowerCase()};request-id:${params.requestId};ts:${timestamp};`;
  const esperada = createHmac("sha256", webhookSecret)
    .update(manifiesto)
    .digest("hex");
  return firmaHexValida(firma, esperada);
}
