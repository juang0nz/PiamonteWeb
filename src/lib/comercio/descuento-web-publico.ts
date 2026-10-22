import "server-only";

import { createClient } from "@/lib/supabase/server";
import { esPorcentajeDescuentoWeb, type EstadoDescuentoWeb } from "./descuento-web";

export async function obtenerDescuentoWeb(comercioId: string): Promise<EstadoDescuentoWeb> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("obtener_descuento_web", { p_comercio_id: comercioId });
  if (error) throw new Error(error.message);
  if (!Array.isArray(data) || data.length > 1) {
    throw new Error("La configuración pública del descuento web no es válida.");
  }
  if (data.length === 0) return { estado: "conocido", promocion: null };
  const fila: unknown = data[0];
  if (typeof fila !== "object" || fila === null || !("nombre" in fila) ||
    typeof fila.nombre !== "string" || !fila.nombre.trim() || fila.nombre.length > 120 ||
    !("valor" in fila) || !esPorcentajeDescuentoWeb(fila.valor)) {
    throw new Error("La configuración pública del descuento web no es válida.");
  }
  return { estado: "conocido", promocion: { nombre: fila.nombre, porcentaje: fila.valor } };
}
