"use client";

import Link from "next/link";
import { formatearPrecio } from "@/lib/catalogo/formato";
import { cambiarCantidad, quitarItem, useCarrito } from "@/lib/carrito/almacen";

// Contenido del carrito: lista de ítems con su configuración, cantidades y total.
// Todavía no incluye checkout ni pagos.
export function ContenidoCarrito() {
  const { items, total } = useCarrito();
  const envio = 0;
  const totalFinal = total + envio;

  if (items.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-negro/20 p-4 text-center text-sm text-negro/50">
        Todavía no agregaste productos.
      </p>
    );
  }

  return (
    <div>
      <ul className="divide-y divide-negro/10">
        {items.map((item) => (
          <li key={item.clave} className="py-3">
            <div className="flex items-start gap-2.5">
              <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-negro/10 bg-[#f5efe4]">
                {item.imagenProducto ? (
                  // Miniatura opcional: si el producto no tiene imagen, se muestra inicial.
                  <img
                    src={item.imagenProducto}
                    alt={item.nombreProducto}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <span className="flex h-full w-full items-center justify-center font-titulos text-xl uppercase text-negro/60">
                    {item.nombreProducto.slice(0, 1)}
                  </span>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold leading-tight">{item.nombreProducto}</p>
                {item.varianteNombre && (
                  <p className="text-xs text-negro/70">{item.varianteNombre}</p>
                )}
                {item.opciones.length > 0 && (
                  <p className="text-xs text-negro/60">
                    {item.opciones.map((o) => o.nombre).join(", ")}
                  </p>
                )}
                {item.aclaraciones && (
                  <p className="text-xs italic text-negro/60">
                    «{item.aclaraciones}»
                  </p>
                )}
              </div>
            </div>

            <div className="mt-2 flex items-center justify-between pl-[3.6rem]">
              <div className="flex items-center gap-2">
                <BotonCantidad
                  etiqueta="Disminuir cantidad"
                  onClick={() => cambiarCantidad(item.clave, item.cantidad - 1)}
                >
                  −
                </BotonCantidad>
                <span className="w-6 text-center text-sm font-semibold">
                  {item.cantidad}
                </span>
                <BotonCantidad
                  etiqueta="Aumentar cantidad"
                  onClick={() => cambiarCantidad(item.clave, item.cantidad + 1)}
                >
                  +
                </BotonCantidad>
                <button
                  type="button"
                  onClick={() => quitarItem(item.clave)}
                  className="text-xs font-medium text-rojo hover:underline"
                >
                  ✕
                </button>
              </div>
              <p className="shrink-0 text-sm font-bold">
                {formatearPrecio(item.precioUnitario * item.cantidad)}
              </p>
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-3 space-y-1.5 border-t border-negro/10 pt-3 text-sm">
        <p className="flex items-center justify-between text-negro/75">
          <span>Subtotal</span>
          <span>{formatearPrecio(total)}</span>
        </p>
        <p className="flex items-center justify-between text-negro/75">
          <span>Envío</span>
          <span>{formatearPrecio(envio)}</span>
        </p>
        <p className="flex items-center justify-between border-t border-negro/10 pt-2 font-semibold">
          <span>Total</span>
          <span className="text-2xl">{formatearPrecio(totalFinal)}</span>
        </p>
      </div>

      <Link
        href="/checkout"
        className="mt-4 block w-full rounded-xl bg-rojo px-5 py-3 text-center text-sm font-bold uppercase tracking-wide text-crema transition-colors hover:bg-[#b11118]"
      >
        Finalizar pedido
      </Link>
    </div>
  );
}

function BotonCantidad({
  etiqueta,
  onClick,
  children,
}: {
  etiqueta: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={etiqueta}
      onClick={onClick}
      className="h-7 w-7 rounded-full border border-negro/15 bg-white text-negro hover:bg-rojo hover:text-crema"
    >
      {children}
    </button>
  );
}
