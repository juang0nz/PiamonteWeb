export type ConfiguracionDescuentoWeb = {
  activa: boolean;
  valor: number;
};

export type EstadoDescuentoWeb =
  | { estado: "conocido"; promocion: { nombre: string; porcentaje: number } | null }
  | { estado: "desconocido" };

export function esPorcentajeDescuentoWeb(valor: unknown): valor is number {
  return typeof valor === "number" && Number.isInteger(valor) && valor >= 0 && valor <= 100;
}

export function esConfiguracionDescuentoWeb(valor: unknown): valor is ConfiguracionDescuentoWeb {
  return typeof valor === "object" && valor !== null &&
    "activa" in valor && typeof valor.activa === "boolean" &&
    "valor" in valor && esPorcentajeDescuentoWeb(valor.valor);
}
