import type { Producto } from "./tipos";

const formateadorPesos = new Intl.NumberFormat("es-UY", {
  style: "currency",
  currency: "UYU",
  maximumFractionDigits: 0,
});

// Da formato de pesos uruguayos a un monto (ej.: "$ 1.250").
export function formatearPrecio(monto: number): string {
  return formateadorPesos.format(monto);
}

// Devuelve el texto de precio de un producto: "Desde $..." si tiene variantes,
// el precio base si no, o null cuando no hay precio disponible.
// Con variantes se prioriza el menor precio comprable; si están todas agotadas
// se usa el menor de todas para poder mostrarlo como referencia tachada.
export function textoPrecioProducto(producto: Producto): string | null {
  if (producto.variantes.length > 0) {
    const disponibles = producto.variantes.filter((v) => v.disponible);
    const consideradas = disponibles.length > 0 ? disponibles : producto.variantes;
    const menor = Math.min(...consideradas.map((v) => v.precio));
    return `Desde ${formatearPrecio(menor)}`;
  }
  if (producto.precio_base !== null) {
    return formatearPrecio(producto.precio_base);
  }
  return null;
}
