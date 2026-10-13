const ZONA_HORARIA = "America/Montevideo";
const MINUTOS_DIA = 24 * 60;
const HORARIOS_SEMANA = [
  { apertura: 20 * 60, cierre: MINUTOS_DIA },
  { apertura: 20 * 60, cierre: MINUTOS_DIA },
  { apertura: 20 * 60, cierre: MINUTOS_DIA },
  { apertura: 20 * 60, cierre: MINUTOS_DIA },
  { apertura: 20 * 60, cierre: MINUTOS_DIA },
  { apertura: 19 * 60 + 30, cierre: MINUTOS_DIA + 30 },
  { apertura: 19 * 60 + 30, cierre: MINUTOS_DIA + 30 },
];

const HORARIO_TEXTO =
  "Domingo a jueves: 20:00 a 00:00 · Viernes y sábado: 19:30 a 00:30";

function dosDigitos(valor: number): string {
  return valor.toString().padStart(2, "0");
}

function obtenerFechaLocal(fecha: Date) {
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: ZONA_HORARIA,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(fecha);

  const dia = partes.find((parte) => parte.type === "weekday")?.value;
  const hora = Number(partes.find((parte) => parte.type === "hour")?.value ?? "0");
  const minuto = Number(partes.find((parte) => parte.type === "minute")?.value ?? "0");
  const indiceDia = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(
    dia ?? "",
  );

  return { dia: indiceDia, minutos: hora * 60 + minuto };
}

function formatearHora(minutos: number): string {
  const minutosNormalizados = minutos % MINUTOS_DIA;
  return `${dosDigitos(Math.floor(minutosNormalizados / 60))}:${dosDigitos(
    minutosNormalizados % 60,
  )}`;
}

export type EstadoApertura = {
  abierto: boolean;
  mensaje: string;
  horaApertura: string;
  horaCierre: string;
  horario: string;
};

export function obtenerEstadoApertura(fecha = new Date()): EstadoApertura {
  const { dia, minutos } = obtenerFechaLocal(fecha);
  const horarioHoy = HORARIOS_SEMANA[dia];
  const horarioAyer = HORARIOS_SEMANA[(dia + 6) % 7];

  const abiertoHoy =
    minutos >= horarioHoy.apertura &&
    minutos < Math.min(horarioHoy.cierre, MINUTOS_DIA);
  const abiertoDespuesDeMedianoche =
    minutos < horarioAyer.cierre - MINUTOS_DIA &&
    horarioAyer.cierre > MINUTOS_DIA;
  const abierto = abiertoHoy || abiertoDespuesDeMedianoche;

  const minutosCierre = abiertoDespuesDeMedianoche
    ? horarioAyer.cierre - MINUTOS_DIA
    : horarioHoy.cierre - MINUTOS_DIA;
  const minutosApertura = abiertoDespuesDeMedianoche
    ? horarioAyer.apertura
    : horarioHoy.apertura;
  const proximaApertura =
    minutos < horarioHoy.apertura
      ? horarioHoy.apertura
      : HORARIOS_SEMANA[(dia + 1) % 7].apertura;
  const horaApertura = formatearHora(abierto ? minutosApertura : proximaApertura);
  const horaCierre = formatearHora(minutosCierre);

  return {
    abierto,
    mensaje: abierto
      ? `Abierto · hasta ${horaCierre}`
      : `Cerrado · abre ${horaApertura}`,
    horaApertura,
    horaCierre,
    horario: HORARIO_TEXTO,
  };
}
