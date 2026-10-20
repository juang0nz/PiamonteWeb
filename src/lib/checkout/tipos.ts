// Tipos y validación de los datos del cliente en el checkout (genéricos para cualquier comercio).
import { normalizarCelularUruguayo } from "./celular";
import type { MetodoPagoPedido } from "@/lib/pedidos/tipos";

export type TipoEntrega = "delivery" | "retiro";

export type DatosCheckout = {
  tipoEntrega: TipoEntrega | null;
  metodoPago: MetodoPagoPedido | null;
  programarParaApertura: boolean;
  nombre: string;
  telefono: string;
  calle: string;
  numero: string;
  apartamento: string;
  referencias: string;
};

export type CampoCheckout = keyof DatosCheckout;

export type ErroresCheckout = Partial<Record<CampoCheckout, string>>;

export const DATOS_INICIALES: DatosCheckout = {
  tipoEntrega: null,
  metodoPago: null,
  programarParaApertura: false,
  nombre: "",
  telefono: "",
  calle: "",
  numero: "",
  apartamento: "",
  referencias: "",
};

export function normalizarMetodoPago(
  modalidad: TipoEntrega | null,
  metodo: unknown,
): MetodoPagoPedido | null {
  if (modalidad === "retiro") return "pago_en_local";
  return modalidad === "delivery" && (metodo === "efectivo" || metodo === "tarjeta_pos")
    ? metodo
    : null;
}

// Separada de los datos personales: el servidor valida el método de la raíz del pedido.
export function validarPagoCheckout(datos: DatosCheckout): ErroresCheckout {
  return datos.tipoEntrega === "delivery" &&
    datos.metodoPago !== "efectivo" && datos.metodoPago !== "tarjeta_pos"
    ? { metodoPago: "Elegí Efectivo o Tarjeta (POS) para continuar." }
    : {};
}

// Valida los campos obligatorios. Los de dirección solo se exigen para delivery.
export function validarDatosCheckout(datos: DatosCheckout): ErroresCheckout {
  const errores: ErroresCheckout = {};

  if (!datos.tipoEntrega) {
    errores.tipoEntrega = "Elegí cómo querés recibir tu pedido.";
  }

  if (datos.nombre.trim().length < 2) {
    errores.nombre = "Ingresá tu nombre.";
  } else if (datos.nombre.trim().length > 120) {
    errores.nombre = "El nombre debe tener hasta 120 caracteres.";
  }

  if (!datos.telefono.trim()) {
    errores.telefono = "Ingresá tu celular.";
  } else if (!normalizarCelularUruguayo(datos.telefono)) {
    errores.telefono = "Ingresá un celular uruguayo, por ejemplo 099 806 731 o +598 99 806 731.";
  }

  if (datos.tipoEntrega === "delivery") {
    if (!datos.calle.trim()) errores.calle = "Ingresá la calle.";
    if (!datos.numero.trim()) errores.numero = "Ingresá el número de puerta.";
  }

  return errores;
}
