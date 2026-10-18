import "server-only";

import { createClient } from "@/lib/supabase/server";
import {
  CONFIGURACION_INICIAL,
  tiemposPorDemanda,
  type ConfiguracionOperativa,
  type TiemposVigentes,
} from "./tiempos";

export type EstadoPausa = { pausado: boolean; mensaje: string };

// Cliente mínimo que necesitan estas consultas; permite pasar el cliente de sesión,
// el privado o un doble en los tests.
type ClienteLectura = {
  from: (tabla: string) => {
    select: (columnas: string) => {
      eq: (
        columna: string,
        valor: string,
      ) => {
        maybeSingle: () => Promise<{
          data: Partial<ConfiguracionOperativa> | null;
          error: { message: string } | null;
        }>;
      };
    };
  };
};

const COLUMNAS =
  "demanda, retiro_normal_min, retiro_normal_max, envio_normal_min, envio_normal_max, retiro_alta_min, retiro_alta_max, envio_alta_min, envio_alta_max, pedidos_pausados, mensaje_pausa";

// Lee la configuración operativa del comercio. La fila es pública para el comercio
// activo, así que alcanza con el cliente de sesión (anónimo o autenticado). Si el
// comercio todavía no tiene fila, devuelve los valores iniciales.
export async function obtenerConfiguracion(
  comercioId: string,
  cliente?: ClienteLectura,
): Promise<ConfiguracionOperativa> {
  const supabase = cliente ?? ((await createClient()) as unknown as ClienteLectura);
  const { data, error } = await supabase
    .from("comercio_configuracion")
    .select(COLUMNAS)
    .eq("comercio_id", comercioId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return CONFIGURACION_INICIAL;
  return { ...CONFIGURACION_INICIAL, ...data };
}

// Rangos vigentes según el nivel de demanda actual (carta y checkout).
export async function obtenerTiemposVigentes(comercioId: string): Promise<TiemposVigentes> {
  return tiemposPorDemanda(await obtenerConfiguracion(comercioId));
}

// Estado de la pausa de pedidos (carta y checkout). La barrera real está en el servidor,
// en validarYRegistrarPedido.
export async function estaPausado(comercioId: string): Promise<EstadoPausa> {
  const configuracion = await obtenerConfiguracion(comercioId);
  return { pausado: configuracion.pedidos_pausados, mensaje: configuracion.mensaje_pausa };
}

// Tiempos y pausa en una sola lectura, para las páginas que necesitan ambos.
export async function obtenerEstadoOperativo(comercioId: string): Promise<{
  tiempos: TiemposVigentes;
  pausa: EstadoPausa;
}> {
  const configuracion = await obtenerConfiguracion(comercioId);
  return {
    tiempos: tiemposPorDemanda(configuracion),
    pausa: { pausado: configuracion.pedidos_pausados, mensaje: configuracion.mensaje_pausa },
  };
}
