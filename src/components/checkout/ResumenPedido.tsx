import { formatearImporteUYU } from "@/lib/catalogo/formato";
import type { ItemCarrito, OpcionCarrito } from "@/lib/carrito/tipos";
import type { EstadoDescuentoWeb } from "@/lib/comercio/descuento-web";
import { ResumenImportes } from "@/components/catalogo/ResumenImportes";

// Agrupa las opciones elegidas por nombre de grupo (por ejemplo, "Gustos: A, B").
function agruparOpciones(opciones: OpcionCarrito[]) {
  const grupos = new Map<string, string[]>();
  for (const opcion of opciones) {
    const lista = grupos.get(opcion.grupoNombre) ?? [];
    lista.push(opcion.nombre);
    grupos.set(opcion.grupoNombre, lista);
  }
  return [...grupos.entries()];
}

// Resumen de solo lectura de los productos del pedido, con subtotal.
export function ResumenPedido({
  items,
  subtotal,
  costoEnvio,
  descuentoWeb = { estado: "desconocido" },
  children,
}: {
  items: ItemCarrito[];
  subtotal: number;
  costoEnvio: number | null;
  descuentoWeb?: EstadoDescuentoWeb;
  children?: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-negro/5">
      <h2 className="bg-negro px-5 py-4 font-titulos text-2xl uppercase tracking-wide text-crema">
        Tu pedido
      </h2>
      <ul className="divide-y divide-negro/10 px-5">
        {items.map((item) => (
          <li key={item.clave} className="flex items-start gap-3 py-4 text-[#171717]">
            <span className="mt-0.5 flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full bg-rojo px-1.5 text-xs font-bold text-crema">
              {item.cantidad}
            </span>
            <div className="min-w-0 flex-1 text-sm">
              <p className="font-semibold text-[#171717]">{item.nombreProducto}</p>
              {item.varianteNombre && (
                <p className="text-neutral-700">{item.varianteNombre}</p>
              )}
              {agruparOpciones(item.opciones).map(([grupo, nombres]) => (
                <p key={grupo} className="text-neutral-700">
                  <span className="font-medium text-neutral-800">{grupo}:</span>{" "}
                  {nombres.join(", ")}
                </p>
              ))}
              {item.aclaraciones && (
                <p className="italic text-neutral-700">«{item.aclaraciones}»</p>
              )}
              {item.cantidad > 1 && (
                <p className="mt-0.5 text-xs text-neutral-600">
                  {formatearImporteUYU(item.precioUnitario)} c/u
                </p>
              )}
            </div>
            <p className="shrink-0 text-sm font-bold text-[#171717]">
              {formatearImporteUYU(item.precioUnitario * item.cantidad)}
            </p>
          </li>
        ))}
      </ul>
      <div className="border-t border-negro/10 px-5 py-4">
        <ResumenImportes subtotal={subtotal} costoEnvio={costoEnvio} descuentoWeb={descuentoWeb} />
        {children && <div className="mt-4">{children}</div>}
      </div>
    </section>
  );
}
