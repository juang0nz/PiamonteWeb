import type { DatosCheckout } from "@/lib/checkout/tipos";

export type MetodoPagoPedido = "efectivo" | "mercado_pago";
export type EstadoPagoPedido = "pendiente" | "aprobado" | "rechazado";

export type OpcionPedidoInput = {
  opcionId: string;
};

export type ItemPedidoInput = {
  productoId: string;
  varianteId: string | null;
  cantidad: number;
  aclaraciones: string;
  opciones: OpcionPedidoInput[];
};

export type PedidoCheckoutInput = {
  comercioSlug: string;
  checkout: DatosCheckout;
  metodoPago: MetodoPagoPedido;
  programarParaApertura?: boolean;
  items: ItemPedidoInput[];
};

export type OpcionPedidoCalculada = {
  opcionId: string;
  grupoId: string;
  grupoNombre: string;
  nombre: string;
  precioAdicional: number;
};

export type ItemPedidoCalculado = {
  productoId: string;
  productoNombre: string;
  varianteId: string | null;
  varianteNombre: string | null;
  cantidad: number;
  aclaraciones: string;
  precioUnitario: number;
  subtotal: number;
  opciones: OpcionPedidoCalculada[];
};

export type PedidoCalculado = {
  comercioId: string;
  subtotal: number;
  items: ItemPedidoCalculado[];
};

export type ResultadoRegistroPedido = {
  pedidoId: string;
  /** Intento pendiente creado atómicamente para Mercado Pago; null para efectivo. */
  pagoId: string | null;
  /** Número correlativo que ve el local en el panel; null si no pudo obtenerse. */
  numeroPedido: number | null;
  subtotal: number;
};
