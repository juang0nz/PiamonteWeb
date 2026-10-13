// Tipos del carrito. Guardan IDs reales y también nombres/precios para mostrarlos sin consultar de nuevo.

export type OpcionCarrito = {
  id: string;
  grupoId: string;
  grupoNombre: string;
  nombre: string;
  precioAdicional: number;
};

export type ItemCarrito = {
  // Identifica una configuración concreta: mismo producto, variante, opciones y aclaraciones.
  clave: string;
  productoId: string;
  nombreProducto: string;
  imagenProducto?: string | null;
  varianteId: string | null;
  varianteNombre: string | null;
  opciones: OpcionCarrito[];
  aclaraciones: string;
  // Precio de una unidad: variante (o precio base) más adicionales de las opciones.
  precioUnitario: number;
  cantidad: number;
};

// Genera la clave de agrupación: configuraciones idénticas comparten clave.
export function construirClaveItem(
  productoId: string,
  varianteId: string | null,
  idsOpciones: string[],
  aclaraciones: string,
): string {
  return JSON.stringify([
    productoId,
    varianteId,
    [...idsOpciones].sort(),
    aclaraciones.trim().replace(/\s+/g, " "),
  ]);
}
