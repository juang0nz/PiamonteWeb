"use client";

import { useState } from "react";
import { useCarrito } from "@/lib/carrito/almacen";
import type { EstadoDescuentoWeb } from "@/lib/comercio/descuento-web";
import { ContenidoCarrito } from "./ContenidoCarrito";
import { Dialogo } from "./Dialogo";

// Barra inferior para pantallas sin panel lateral: resume el pedido y abre el carrito.
// Con abrirAlInicio (por ejemplo, al volver desde el checkout) el carrito se muestra abierto,
// salvo en pantallas anchas, donde ya está visible el panel lateral.
export function BarraCarritoMovil({
  abrirAlInicio = false,
  descuentoWeb,
}: {
  abrirAlInicio?: boolean;
  descuentoWeb?: EstadoDescuentoWeb;
}) {
  const { cantidadTotal } = useCarrito();
  const [abierto, setAbierto] = useState(
    () =>
      abrirAlInicio &&
      typeof window !== "undefined" &&
      !window.matchMedia("(min-width: 80rem)").matches,
  );

  if (cantidadTotal === 0) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="fixed inset-x-4 bottom-4 z-30 flex items-center justify-between rounded-2xl bg-rojo px-5 py-3 font-semibold text-crema shadow-lg xl:hidden"
      >
        <span>
          Ver pedido · {cantidadTotal}{" "}
          {cantidadTotal === 1 ? "producto" : "productos"}
        </span>
        <span>Ver importes</span>
      </button>
      {abierto && (
        <Dialogo titulo="Tu pedido" onCerrar={() => setAbierto(false)}>
          <div className="min-h-0 flex-1 overflow-y-auto p-5">
            <ContenidoCarrito descuentoWeb={descuentoWeb} />
          </div>
        </Dialogo>
      )}
    </>
  );
}
