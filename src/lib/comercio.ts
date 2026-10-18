// Configuración del comercio que se muestra. Más adelante podrá resolverse por dominio o ruta.
export const SLUG_COMERCIO = "piamonte";

// Mensaje de WhatsApp al aceptar un pedido. Recibe el rango estimado ya formateado
// ("30-45 min") y lo incluye; sin rango (pedidos previos a PIA-2) usa el texto base.
// PIA-8 reutiliza esta función para el resto de los avisos.
export function mensajePedidoAceptadoWhatsApp(rangoEstimado: string | null): string {
  const tiempo = rangoEstimado ? ` Tiempo estimado: ${rangoEstimado}.` : "";
  return `🍕 ¡Hola! Tu pedido de Piamonte ya está en preparación.${tiempo} 👨‍🍳 ¡Gracias por elegirnos!`;
}

// Texto informativo del checkout: el pago no es una elección del cliente, se realiza en el local.
export const MENSAJE_PAGO =
  "Pagás al retirar o al recibir tu pedido, en efectivo o con tarjeta.";
