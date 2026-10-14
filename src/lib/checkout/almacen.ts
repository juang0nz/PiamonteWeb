"use client";

import { useSyncExternalStore } from "react";
import { DATOS_INICIALES, type DatosCheckout } from "./tipos";

// Datos del cliente en el checkout, guardados en sessionStorage para que no se pierdan
// al volver al carrito o recargar la página dentro de la misma pestaña.

const CLAVE_ALMACENAMIENTO = "plataforma:checkout:v1";

let datos: DatosCheckout = DATOS_INICIALES;
let cargado = false;
const oyentes = new Set<() => void>();

function asegurarCarga() {
  if (cargado || typeof window === "undefined") return;
  cargado = true;
  try {
    const crudo = window.sessionStorage.getItem(CLAVE_ALMACENAMIENTO);
    const guardado: unknown = crudo ? JSON.parse(crudo) : null;
    if (guardado && typeof guardado === "object") {
      const combinado = { ...DATOS_INICIALES, ...(guardado as Partial<DatosCheckout>) };
      const tipo = combinado.tipoEntrega;

      datos = {
        ...combinado,
        tipoEntrega: tipo === "delivery" || tipo === "retiro" ? tipo : null,
        programarParaApertura: Boolean(combinado.programarParaApertura),
      };
    }
  } catch {
    datos = DATOS_INICIALES;
  }
}

function suscribir(oyente: () => void) {
  asegurarCarga();
  oyentes.add(oyente);
  return () => {
    oyentes.delete(oyente);
  };
}

function obtenerSnapshot() {
  asegurarCarga();
  return datos;
}

export function actualizarDatosCheckout(cambios: Partial<DatosCheckout>) {
  asegurarCarga();
  datos = { ...datos, ...cambios };
  try {
    window.sessionStorage.setItem(CLAVE_ALMACENAMIENTO, JSON.stringify(datos));
  } catch {
    // Si el almacenamiento no está disponible, los datos se conservan en memoria.
  }

  oyentes.forEach((oyente) => oyente());
}

export function useDatosCheckout(): DatosCheckout {
  return useSyncExternalStore(suscribir, obtenerSnapshot, () => DATOS_INICIALES);
}
