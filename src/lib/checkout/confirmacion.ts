import { calcularDescuentoPorcentual } from "@/lib/comercio/descuentos";
import { esPorcentajeDescuentoWeb } from "@/lib/comercio/descuento-web";
import type { ResultadoRegistroPedidoConfirmado } from "@/lib/pedidos/tipos";
import type { TipoEntrega } from "./tipos";

export function validarConfirmacionPedido(
  cuerpo: Record<string, unknown>,
  tipoEntrega: TipoEntrega,
): ResultadoRegistroPedidoConfirmado | null {
  if (typeof cuerpo.pedidoId !== "string" || !cuerpo.pedidoId.trim() ||
    !(cuerpo.numeroPedido === null || (typeof cuerpo.numeroPedido === "number" &&
      Number.isSafeInteger(cuerpo.numeroPedido) && cuerpo.numeroPedido > 0)) ||
    typeof cuerpo.subtotal !== "number" || cuerpo.subtotal <= 0 ||
    typeof cuerpo.descuento !== "number" ||
    typeof cuerpo.costoEnvio !== "number" || typeof cuerpo.total !== "number" ||
    (tipoEntrega === "retiro" && cuerpo.costoEnvio !== 0)) return null;

  let promocion: ResultadoRegistroPedidoConfirmado["promocion"] = null;
  if (cuerpo.promocion !== null) {
    const dato = cuerpo.promocion;
    if (typeof dato !== "object" || dato === null ||
      !("id" in dato) || typeof dato.id !== "string" || !dato.id.trim() ||
      !("nombre" in dato) || typeof dato.nombre !== "string" || !dato.nombre.trim() || dato.nombre.length > 120 ||
      !("porcentaje" in dato) || !esPorcentajeDescuentoWeb(dato.porcentaje)) return null;
    promocion = { id: dato.id, nombre: dato.nombre, porcentaje: dato.porcentaje };
  }
  try {
    // Validar la instantánea confirmada, sin compararla con la estimación del navegador.
    const calculo = calcularDescuentoPorcentual({
      subtotal: cuerpo.subtotal, costoEnvio: cuerpo.costoEnvio, porcentaje: promocion?.porcentaje ?? 0,
    });
    if (calculo.descuento !== cuerpo.descuento || calculo.total !== cuerpo.total) return null;
  } catch (error) {
    if (!(error instanceof RangeError)) throw error;
    return null;
  }
  return {
    pedidoId: cuerpo.pedidoId, numeroPedido: cuerpo.numeroPedido,
    subtotal: cuerpo.subtotal, descuento: cuerpo.descuento, costoEnvio: cuerpo.costoEnvio,
    total: cuerpo.total, promocion,
  };
}
