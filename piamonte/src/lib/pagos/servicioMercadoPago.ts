import "server-only";

import { createPrivateClient } from "@/lib/supabase/private";
import {
  consultarPagoMercadoPago,
  crearPreferenciaMercadoPago,
  MercadoPagoError,
} from "./mercadoPago";

type PagoFila = {
  id: string;
  pedido_id: string;
  proveedor: string;
  estado: string;
  monto: number | string;
  moneda: string;
  referencia_externa: string | null;
  preferencia_id: string | null;
  url_checkout: string | null;
};

type PedidoFila = {
  id: string;
  numero: number | null;
  metodo_pago: string;
};

type ResultadoConfirmacion = {
  procesado: boolean;
  duplicado: boolean;
};

type ResultadoReserva = {
  reservada: boolean;
  preferencia_id: string | null;
  url_checkout: string | null;
};

function esUuid(valor: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    valor,
  );
}

// Crea o recupera la preferencia de un intento ya persistido.
// El UUID del intento también es la clave de idempotencia enviada al proveedor.
export async function obtenerOCrearPreferencia(
  pagoId: string,
): Promise<{ pagoId: string; urlCheckout: string }> {
  if (!esUuid(pagoId)) {
    throw new MercadoPagoError(
      "El intento de pago no es válido.",
      400,
      "RESPUESTA_INVALIDA",
    );
  }

  const supabase = createPrivateClient();
  const { data: pagoData, error: pagoError } = await supabase
    .from("pagos")
    .select(
      "id, pedido_id, proveedor, estado, monto, moneda, referencia_externa, preferencia_id, url_checkout",
    )
    .eq("id", pagoId)
    .maybeSingle();
  if (pagoError) {
    console.error("No se pudo consultar el intento de pago:", pagoError);
    throw new MercadoPagoError(
      "No pudimos consultar el intento de pago.",
      500,
      "CONFIGURACION",
    );
  }

  const pago = pagoData as PagoFila | null;
  if (
    !pago ||
    pago.proveedor !== "mercado_pago" ||
    pago.referencia_externa !== pago.id
  ) {
    throw new MercadoPagoError(
      "El intento de pago no existe.",
      404,
      "RESPUESTA_INVALIDA",
    );
  }
  if (pago.estado !== "pendiente") {
    throw new MercadoPagoError(
      "El intento de pago ya no está pendiente.",
      409,
      "RESPUESTA_INVALIDA",
    );
  }
  if (pago.preferencia_id && pago.url_checkout) {
    return { pagoId: pago.id, urlCheckout: pago.url_checkout };
  }

  const monto = Number(pago.monto);
  if (!Number.isFinite(monto) || monto <= 0 || pago.moneda !== "UYU") {
    throw new MercadoPagoError(
      "El intento de pago tiene un monto o moneda inválidos.",
      409,
      "RESPUESTA_INVALIDA",
    );
  }

  const { data: pedidoData, error: pedidoError } = await supabase
    .from("pedidos")
    .select("id, numero, metodo_pago")
    .eq("id", pago.pedido_id)
    .maybeSingle();
  if (pedidoError) {
    console.error("No se pudo consultar el pedido del pago:", pedidoError);
    throw new MercadoPagoError(
      "No pudimos consultar el pedido asociado.",
      500,
      "CONFIGURACION",
    );
  }
  const pedido = pedidoData as PedidoFila | null;
  if (!pedido || pedido.metodo_pago !== "mercado_pago") {
    throw new MercadoPagoError(
      "El intento no corresponde a un pedido de Mercado Pago.",
      409,
      "RESPUESTA_INVALIDA",
    );
  }

  const { data: reservaData, error: reservaError } = await supabase.rpc(
    "reservar_preferencia_mercado_pago",
    { p_pago_id: pago.id },
  );
  if (reservaError) {
    console.error("No se pudo reservar la creación de preferencia:", reservaError);
    throw new MercadoPagoError(
      "No pudimos reservar la creación de la preferencia.",
      500,
      "CONFIGURACION",
    );
  }
  const reserva = Array.isArray(reservaData)
    ? (reservaData[0] as ResultadoReserva | undefined)
    : undefined;
  if (!reserva) {
    throw new MercadoPagoError(
      "La base de datos no confirmó la reserva de la preferencia.",
      500,
      "RESPUESTA_INVALIDA",
    );
  }
  if (!reserva.reservada) {
    if (reserva.preferencia_id && reserva.url_checkout) {
      return { pagoId: pago.id, urlCheckout: reserva.url_checkout };
    }
    throw new MercadoPagoError(
      "La preferencia de pago se está creando. Reintentá en unos segundos.",
      409,
      "RESPUESTA_INVALIDA",
    );
  }

  let preferencia: Awaited<ReturnType<typeof crearPreferenciaMercadoPago>>;
  try {
    preferencia = await crearPreferenciaMercadoPago({
      pagoId: pago.id,
      pedidoId: pedido.id,
      numeroPedido: pedido.numero,
      monto,
      moneda: pago.moneda,
    });
  } catch (error) {
    const { error: liberacionError } = await supabase
      .from("pagos")
      .update({
        preferencia_reservada_en: null,
        actualizado_en: new Date().toISOString(),
      })
      .eq("id", pago.id)
      .is("preferencia_id", null);
    if (liberacionError) {
      console.error("No se pudo liberar la reserva de preferencia:", liberacionError);
    }
    throw error;
  }

  const { data: actualizada, error: actualizacionError } = await supabase
    .from("pagos")
    .update({
      preferencia_id: preferencia.preferenciaId,
      url_checkout: preferencia.urlCheckout,
      preferencia_reservada_en: null,
      actualizado_en: new Date().toISOString(),
    })
    .eq("id", pago.id)
    .eq("estado", "pendiente")
    .select("id")
    .maybeSingle();
  if (actualizacionError || !actualizada) {
    console.error("No se pudo guardar la preferencia de pago:", actualizacionError);
    throw new MercadoPagoError(
      "No pudimos guardar la preferencia de pago.",
      500,
      "CONFIGURACION",
    );
  }

  return { pagoId: pago.id, urlCheckout: preferencia.urlCheckout };
}

// Nunca confía en el estado recibido en el webhook: vuelve a consultar el pago
// a Mercado Pago y delega la actualización atómica/idempotente al RPC.
export async function procesarNotificacionPago(params: {
  eventoId: string;
  paymentId: string;
}): Promise<ResultadoConfirmacion> {
  const pagoVerificado = await consultarPagoMercadoPago(params.paymentId);
  if (!esUuid(pagoVerificado.referenciaExterna)) {
    throw new MercadoPagoError(
      "La referencia externa del pago no corresponde a un intento válido.",
      400,
      "RESPUESTA_INVALIDA",
    );
  }

  const supabase = createPrivateClient();
  const { data, error } = await supabase.rpc(
    "confirmar_pago_mercado_pago",
    {
      p_evento_id: params.eventoId,
      p_pago_id: pagoVerificado.referenciaExterna,
      p_pago_externo_id: pagoVerificado.id,
      p_estado: pagoVerificado.estado,
      p_monto: pagoVerificado.monto,
      p_moneda: pagoVerificado.moneda,
    },
  );
  if (error) {
    console.error("No se pudo confirmar el pago verificado:", {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
    throw new MercadoPagoError(
      "No pudimos registrar la confirmación del pago.",
      500,
      "CONFIGURACION",
    );
  }

  const fila = Array.isArray(data)
    ? (data[0] as ResultadoConfirmacion | undefined)
    : undefined;
  if (!fila) {
    throw new MercadoPagoError(
      "La base de datos no confirmó el procesamiento del pago.",
      500,
      "RESPUESTA_INVALIDA",
    );
  }
  return fila;
}
