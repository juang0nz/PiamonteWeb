import type {
  GrupoOpciones,
  Opcion,
  ReglaOpcionVariante,
} from "./tipos";

export type LimitesGrupo = { minimo: number; maximo: number };

// Límites efectivos de un grupo: la regla activa de la variante elegida tiene prioridad;
// si no existe, se usan los del grupo (y un grupo obligatorio exige al menos una opción).
export function limitesGrupo(
  grupo: GrupoOpciones,
  varianteId: string | null,
  reglas: ReglaOpcionVariante[],
): LimitesGrupo {
  const regla = varianteId
    ? reglas.find((r) => r.variante_id === varianteId && r.grupo_id === grupo.id)
    : undefined;
  if (regla) return { minimo: regla.minimo, maximo: regla.maximo };
  return {
    minimo: grupo.obligatorio ? Math.max(grupo.minimo, 1) : grupo.minimo,
    maximo: grupo.maximo,
  };
}

// Texto descriptivo de los límites para mostrar en cada grupo.
export function textoLimites({ minimo, maximo }: LimitesGrupo): string {
  if (minimo === maximo) return minimo === 1 ? "Elegí 1" : `Elegí ${minimo}`;
  if (minimo === 0) return `Opcional · hasta ${maximo}`;
  return `Elegí entre ${minimo} y ${maximo}`;
}

export type ResultadoValidacion = {
  valido: boolean;
  mensajeVariante: string | null;
  erroresGrupos: Record<string, string>;
};

// Valida variante y cantidad de opciones elegidas por grupo según los límites efectivos.
export function validarSeleccion(params: {
  hayVariantes: boolean;
  varianteId: string | null;
  grupos: GrupoOpciones[];
  reglas: ReglaOpcionVariante[];
  elegidas: Record<string, string[]>;
}): ResultadoValidacion {
  const { hayVariantes, varianteId, grupos, reglas, elegidas } = params;
  const mensajeVariante =
    hayVariantes && !varianteId ? "Elegí una variante para continuar." : null;
  const erroresGrupos: Record<string, string> = {};

  if (!mensajeVariante) {
    for (const grupo of grupos) {
      const limites = limitesGrupo(grupo, varianteId, reglas);
      if (limites.maximo === 0) continue;
      const cantidad = (elegidas[grupo.id] ?? []).length;
      if (grupo.opciones.length < limites.minimo) {
        erroresGrupos[grupo.id] = "No hay suficientes opciones disponibles.";
      } else if (cantidad < limites.minimo) {
        erroresGrupos[grupo.id] =
          limites.minimo === 1
            ? "Elegí al menos 1 opción."
            : `Elegí al menos ${limites.minimo} opciones.`;
      } else if (cantidad > limites.maximo) {
        erroresGrupos[grupo.id] = `Elegí como máximo ${limites.maximo}.`;
      }
    }
  }

  return {
    valido: !mensajeVariante && Object.keys(erroresGrupos).length === 0,
    mensajeVariante,
    erroresGrupos,
  };
}

// Suma el precio de la variante (o base) y los adicionales de las opciones elegidas.
export function calcularPrecioUnitario(
  precioBase: number,
  opciones: Pick<Opcion, "precio_adicional">[],
): number {
  return opciones.reduce((total, o) => total + o.precio_adicional, precioBase);
}
