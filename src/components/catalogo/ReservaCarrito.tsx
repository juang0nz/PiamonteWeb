"use client";

import { useCarrito } from "@/lib/carrito/almacen";
import { ContenidoCarrito, type PausaCarrito } from "./ContenidoCarrito";
import type { EstadoDescuentoWeb } from "@/lib/comercio/descuento-web";

// Panel lateral del carrito (solo escritorio ancho).
export function ReservaCarrito({ pausa, descuentoWeb }: { pausa?: PausaCarrito; descuentoWeb?: EstadoDescuentoWeb }) {
  const { cantidadTotal } = useCarrito();

  return (
    <aside
      aria-label="Carrito"
      className="sticky top-0 hidden h-screen w-[21rem] shrink-0 overflow-y-auto border-l border-negro/10 bg-white px-4 py-5 lg:block"
    >
      <h2 className="mb-3 font-titulos text-3xl uppercase tracking-wide">
        Tu pedido {cantidadTotal > 0 ? `(${cantidadTotal})` : ""}
      </h2>
      <ContenidoCarrito pausa={pausa} descuentoWeb={descuentoWeb} />
    </aside>
  );
}
