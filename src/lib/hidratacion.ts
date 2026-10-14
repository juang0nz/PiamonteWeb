"use client";

import { useSyncExternalStore } from "react";

const sinSuscripcion = () => () => {};

// Indica si el componente ya se hidrató en el navegador. Evita mostrar estados
// del servidor (por ejemplo "carrito vacío") antes de leer el almacenamiento local.
export function useHidratado(): boolean {
  return useSyncExternalStore(
    sinSuscripcion,
    () => true,
    () => false,
  );
}
