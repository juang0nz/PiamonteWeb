export type EntradaDescuentoPorcentual = {
  subtotal: number;
  costoEnvio: number;
  porcentaje: number;
};

export type ImportesConDescuento = {
  subtotal: number;
  descuento: number;
  costoEnvio: number;
  total: number;
};

const MAXIMO_CENTIMOS = BigInt("999999999999");
const CIEN = BigInt(100);

function convertirACentimos(importe: number, concepto: string): bigint {
  if (
    typeof importe !== "number" ||
    !Number.isFinite(importe) ||
    importe < 0 ||
    importe > 9999999999.99 ||
    Number(importe.toFixed(2)) !== importe
  ) {
    throw new RangeError(
      `El ${concepto} debe estar entre 0 y 9999999999,99 y tener hasta dos decimales.`,
    );
  }
  // Convertir la representación decimal evita multiplicar números binarios por 100.
  const [entero, fraccion] = importe.toFixed(2).split(".");
  return BigInt(entero) * CIEN + BigInt(fraccion);
}

export function calcularDescuentoPorcentual({
  subtotal,
  costoEnvio,
  porcentaje,
}: EntradaDescuentoPorcentual): ImportesConDescuento {
  if (
    typeof porcentaje !== "number" ||
    !Number.isInteger(porcentaje) ||
    porcentaje < 0 ||
    porcentaje > 100
  ) {
    throw new RangeError("El porcentaje debe ser un entero entre 0 y 100.");
  }

  const subtotalCentimos = convertirACentimos(subtotal, "subtotal");
  const envioCentimos = convertirACentimos(costoEnvio, "costo de envío");
  // Una sola división sobre el subtotal completo; sumar 50 resuelve las mitades hacia arriba.
  const descuentoCentimos = (subtotalCentimos * BigInt(porcentaje) + BigInt(50)) / CIEN;
  const totalCentimos = subtotalCentimos - descuentoCentimos + envioCentimos;
  if (totalCentimos > MAXIMO_CENTIMOS) {
    throw new RangeError("El total supera el máximo monetario de 9999999999,99.");
  }

  return {
    subtotal: Number(subtotalCentimos) / 100,
    descuento: Number(descuentoCentimos) / 100,
    costoEnvio: Number(envioCentimos) / 100,
    total: Number(totalCentimos) / 100,
  };
}
