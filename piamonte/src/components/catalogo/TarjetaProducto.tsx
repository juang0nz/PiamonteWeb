"use client";

import { useState } from "react";
import { textoPrecioProducto } from "@/lib/catalogo/formato";
import type { Producto } from "@/lib/catalogo/tipos";
import { ModalProducto } from "./ModalProducto";

// La imagen es opcional; al seleccionar la tarjeta se abre la personalización.
export function TarjetaProducto({ producto }: { producto: Producto }) {
  const [abierto, setAbierto] = useState(false);
  const precio = textoPrecioProducto(producto);
  const agotado =
    !producto.disponible ||
    (producto.variantes.length > 0 &&
      producto.variantes.every((variante) => !variante.disponible));

  return (
    <li>
      <button
        type="button"
        onClick={() => !agotado && setAbierto(true)}
        aria-label={
          agotado
            ? `${producto.nombre}, agotado`
            : `Personalizar ${producto.nombre}`
        }
        disabled={agotado}
        className={`group flex w-full flex-col rounded-2xl border p-3 text-left shadow-[0_8px_24px_rgba(0,0,0,0.08)] transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rojo ${
          agotado
            ? "cursor-not-allowed border-rojo/30 bg-[#fdf3f3]"
            : "border-negro/5 bg-white hover:border-negro/15 hover:shadow-[0_12px_28px_rgba(0,0,0,0.12)]"
        }`}
      >
        <span className="flex min-w-0 items-start gap-3">
          {producto.imagen_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={producto.imagen_url}
              alt=""
              className={`size-20 shrink-0 rounded-xl object-cover ${
                agotado ? "opacity-55 grayscale" : ""
              }`}
            />
          )}
          <span className="min-w-0 flex-1">
            <span
              className={`block text-base font-semibold leading-snug ${
                agotado ? "text-negro/55" : "text-negro"
              }`}
            >
              {producto.nombre}
            </span>
            {producto.descripcion && (
              <span
                className={`mt-1 block text-sm leading-snug ${
                  agotado ? "text-negro/40" : "text-negro/65"
                }`}
              >
                {producto.descripcion}
              </span>
            )}
          </span>
        </span>
        <span className="mt-2 flex w-full items-center justify-between gap-3">
          {agotado ? (
            <>
              {precio && (
                <span className="text-sm font-semibold text-negro/40 line-through">
                  {precio}
                </span>
              )}
              <span className="ml-auto shrink-0 rounded-full bg-rojo px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-crema">
                Agotado
              </span>
            </>
          ) : (
            <>
              <span className="text-sm font-semibold text-negro">{precio}</span>
              <span
                aria-hidden="true"
                className="flex size-8 shrink-0 items-center justify-center rounded-full bg-negro text-lg font-light leading-none text-white transition-transform group-hover:scale-105"
              >
                +
              </span>
            </>
          )}
        </span>
      </button>
      {abierto && (
        <ModalProducto producto={producto} onCerrar={() => setAbierto(false)} />
      )}
    </li>
  );
}
