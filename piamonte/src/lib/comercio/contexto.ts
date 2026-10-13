import "server-only";

import { obtenerComercio } from "@/lib/catalogo/consultas";
import { SLUG_COMERCIO } from "@/lib/comercio";

export async function obtenerComercioActual() {
  return obtenerComercio(SLUG_COMERCIO);
}
