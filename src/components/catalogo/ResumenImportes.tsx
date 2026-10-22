import { formatearImporteUYU } from "@/lib/catalogo/formato";
import { calcularDescuentoPorcentual } from "@/lib/comercio/descuentos";
import type { EstadoDescuentoWeb } from "@/lib/comercio/descuento-web";

export function ResumenImportes({
  subtotal,
  costoEnvio,
  descuentoWeb,
}: {
  subtotal: number;
  costoEnvio: number | null;
  descuentoWeb: EstadoDescuentoWeb;
}) {
  let productos: ReturnType<typeof calcularDescuentoPorcentual> | null = null;
  let error: string | null = null;
  try {
    // Sin tarifa conocida solo se estiman productos, nunca un envío gratuito.
    if (descuentoWeb.estado === "conocido") {
      productos = calcularDescuentoPorcentual({
        subtotal, costoEnvio: costoEnvio ?? 0, porcentaje: descuentoWeb.promocion?.porcentaje ?? 0,
      });
    }
  } catch (fallo) {
    if (!(fallo instanceof RangeError)) throw fallo;
    error = "No pudimos estimar los importes del carrito. Revisá los productos antes de continuar.";
  }
  const porcentaje = descuentoWeb.estado === "conocido" ? descuentoWeb.promocion?.porcentaje : undefined;
  return (
    <div className="space-y-2 text-sm text-negro">
      <p className="flex justify-between gap-3"><span>Subtotal de productos</span><span>{formatearImporteUYU(subtotal)}</span></p>
      {(descuentoWeb.estado === "desconocido" || (porcentaje !== undefined && porcentaje > 0)) && (
        <p className="flex justify-between gap-3">
          <span>Descuento web{porcentaje !== undefined ? ` (${porcentaje} %)` : ""}</span>
          <span>{productos ? `−${formatearImporteUYU(productos.descuento)}` : "Por confirmar"}</span>
        </p>
      )}
      {descuentoWeb.estado === "conocido" && !descuentoWeb.promocion && (
        <p className="text-xs text-negro/60">Descuento web desactivado.</p>
      )}
      <p className="flex justify-between gap-3 font-semibold">
        <span>Subtotal con descuento</span>
        <span>{productos ? formatearImporteUYU((Math.round(productos.subtotal * 100) - Math.round(productos.descuento * 100)) / 100) : "Por confirmar"}</span>
      </p>
      <p className="flex justify-between gap-3"><span>Envío</span><span>{costoEnvio === null ? "Por confirmar" : formatearImporteUYU(costoEnvio)}</span></p>
      <p className="flex justify-between gap-3 border-t border-negro/10 pt-2 font-semibold">
        <span>Total estimado</span><span>{productos && costoEnvio !== null ? formatearImporteUYU(productos.total) : "Por confirmar"}</span>
      </p>
      {descuentoWeb.estado === "desconocido" && (
        <p role="alert" className="text-sm text-rojo">No pudimos consultar el descuento web. Recargá la página para reintentar; los importes están por confirmar.</p>
      )}
      {error && <p role="alert" className="text-sm text-rojo">{error}</p>}
      <p className="text-xs text-negro/60">Estimación en UYU. La configuración vigente y los importes se confirman al registrar el pedido.</p>
    </div>
  );
}
