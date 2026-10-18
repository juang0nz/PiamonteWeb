// Tiempos estimados y configuración operativa del comercio (PIA-2).
// Funciones puras, sin acceso a datos: las usan el servidor, el panel y los tests.

export type NivelDemanda = "normal" | "alta";

// Fila de public.comercio_configuracion (sin comercio_id ni actualizado_en).
export type ConfiguracionOperativa = {
  demanda: NivelDemanda;
  retiro_normal_min: number;
  retiro_normal_max: number;
  envio_normal_min: number;
  envio_normal_max: number;
  retiro_alta_min: number;
  retiro_alta_max: number;
  envio_alta_min: number;
  envio_alta_max: number;
  pedidos_pausados: boolean;
  mensaje_pausa: string;
};

export type RangoMinutos = { min: number; max: number; texto: string };

export type TiemposVigentes = {
  demanda: NivelDemanda;
  retiro: RangoMinutos;
  envio: RangoMinutos;
};

export const MINUTOS_MAXIMOS = 240;

// Mismos valores iniciales que la migración 20261018123209_demanda_tiempos_pausa.sql.
// Solo se usan si el comercio todavía no tiene fila de configuración.
export const CONFIGURACION_INICIAL: ConfiguracionOperativa = {
  demanda: "normal",
  retiro_normal_min: 15,
  retiro_normal_max: 30,
  envio_normal_min: 30,
  envio_normal_max: 45,
  retiro_alta_min: 30,
  retiro_alta_max: 45,
  envio_alta_min: 45,
  envio_alta_max: 60,
  pedidos_pausados: false,
  mensaje_pausa: "Estamos con mucha demanda. En un rato volvemos a tomar pedidos.",
};

export const CLAVES_RANGOS = [
  "retiro_normal_min",
  "retiro_normal_max",
  "envio_normal_min",
  "envio_normal_max",
  "retiro_alta_min",
  "retiro_alta_max",
  "envio_alta_min",
  "envio_alta_max",
] as const;

export type ClaveRango = (typeof CLAVES_RANGOS)[number];

// Claves que la RPC admin_actualizar_configuracion_comercio acepta en p_cambios.
export const CLAVES_CONFIGURACION = [
  "demanda",
  ...CLAVES_RANGOS,
  "pedidos_pausados",
  "mensaje_pausa",
] as const;

export type ClaveConfiguracion = (typeof CLAVES_CONFIGURACION)[number];

// "15-30 min"; si el rango es un único valor, "30 min".
export function formatearRango(min: number, max: number): string {
  if (min === max) return `${min} min`;
  return `${min}-${max} min`;
}

// Rango vigente por modalidad según el nivel de demanda configurado.
export function tiemposPorDemanda(
  configuracion: ConfiguracionOperativa,
  demanda: NivelDemanda = configuracion.demanda,
): TiemposVigentes {
  const sufijo = demanda === "alta" ? "alta" : "normal";
  const retiroMin = configuracion[`retiro_${sufijo}_min`];
  const retiroMax = configuracion[`retiro_${sufijo}_max`];
  const envioMin = configuracion[`envio_${sufijo}_min`];
  const envioMax = configuracion[`envio_${sufijo}_max`];
  return {
    demanda,
    retiro: { min: retiroMin, max: retiroMax, texto: formatearRango(retiroMin, retiroMax) },
    envio: { min: envioMin, max: envioMax, texto: formatearRango(envioMin, envioMax) },
  };
}

// Traduce la modalidad guardada en pedidos ("delivery"/"retiro") a la clave de tiempos.
export function rangoPorModalidad(
  tiempos: TiemposVigentes,
  modalidad: "delivery" | "retiro",
): RangoMinutos {
  return modalidad === "retiro" ? tiempos.retiro : tiempos.envio;
}

// Validación local de los ocho rangos (misma regla que el check de la tabla).
// Devuelve un mensaje por clave inválida; vacío si todo es correcto.
export function validarRangos(
  valores: Record<ClaveRango, number>,
): Partial<Record<ClaveRango, string>> {
  const errores: Partial<Record<ClaveRango, string>> = {};
  const pares: Array<[ClaveRango, ClaveRango]> = [
    ["retiro_normal_min", "retiro_normal_max"],
    ["envio_normal_min", "envio_normal_max"],
    ["retiro_alta_min", "retiro_alta_max"],
    ["envio_alta_min", "envio_alta_max"],
  ];
  for (const [claveMin, claveMax] of pares) {
    const min = valores[claveMin];
    const max = valores[claveMax];
    if (!Number.isInteger(min) || min < 0) {
      errores[claveMin] = "Ingresá minutos enteros, 0 o más.";
    }
    if (!Number.isInteger(max) || max > MINUTOS_MAXIMOS) {
      errores[claveMax] = `Ingresá minutos enteros, hasta ${MINUTOS_MAXIMOS}.`;
    } else if (Number.isInteger(min) && max < min) {
      errores[claveMax] = "El máximo debe ser mayor o igual al mínimo.";
    }
  }
  return errores;
}
