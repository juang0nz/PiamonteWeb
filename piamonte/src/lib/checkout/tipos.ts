// Tipos y validación de los datos del cliente en el checkout (genéricos para cualquier comercio).
import { MERCADO_PAGO_DISPONIBLE_EN_CHECKOUT } from "@/lib/pagos/configuracion";
import { normalizarCelularUruguayo } from "./celular";

export type TipoEntrega = "delivery" | "retiro";
export type MetodoPagoCheckout = "efectivo" | "mercado_pago";

export type DatosCheckout = {
  tipoEntrega: TipoEntrega | null;
  metodoPago: MetodoPagoCheckout | null;
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

// Valida los campos obligatorios. Los de dirección solo se exigen para delivery.
export function esMetodoPagoHabilitado(metodoPago: MetodoPagoCheckout | null): boolean {
  if (metodoPago === "efectivo") {
    return true;
  }

  return (
    metodoPago === "mercado_pago" &&
    MERCADO_PAGO_DISPONIBLE_EN_CHECKOUT
  );
}

export function validarDatosCheckout(datos: DatosCheckout): ErroresCheckout {
  const errores: ErroresCheckout = {};

  if (!datos.tipoEntrega) {
    errores.tipoEntrega = "Elegí cómo querés recibir tu pedido.";
  }
  if (!datos.metodoPago) {
    errores.metodoPago = "Elegí cómo querés pagar tu pedido.";
  } else if (!esMetodoPagoHabilitado(datos.metodoPago)) {
    errores.metodoPago = "Mercado Pago todavía no está habilitado. Usá efectivo por ahora.";
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
