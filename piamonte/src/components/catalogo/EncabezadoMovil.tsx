"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { useCarrito } from "@/lib/carrito/almacen";
import { ContenidoCarrito } from "./ContenidoCarrito";
import { Dialogo } from "./Dialogo";
import { NavegacionPiamonte } from "./NavegacionPiamonte";
import type { EstadoApertura } from "@/lib/comercio/horarios";

// Encabezado móvil con menú lateral y acceso al carrito.
export function EncabezadoMovil({
  nombreComercio,
  categoriaActiva,
  abrirCarritoInicio = false,
  estadoApertura,
}: {
  nombreComercio: string;
  categoriaActiva?: string;
  abrirCarritoInicio?: boolean;
  estadoApertura: EstadoApertura;
}) {
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [carritoAbierto, setCarritoAbierto] = useState(abrirCarritoInicio);
  const { cantidadTotal } = useCarrito();

  return (
    <>
      <header className="sticky top-0 z-20 border-b border-crema/15 bg-negro lg:hidden">
        <div className="flex items-center justify-between px-3 py-2.5">
          <button
            type="button"
            aria-label="Abrir menú"
            aria-expanded={menuAbierto}
            onClick={() => setMenuAbierto(true)}
            className="rounded-lg p-2 text-crema active:bg-crema/10"
          >
            <span className="block h-0.5 w-4 rounded-full bg-current" />
            <span className="mt-1 block h-0.5 w-4 rounded-full bg-current" />
            <span className="mt-1 block h-0.5 w-4 rounded-full bg-current" />
          </button>
          <LinkMarcaMovil nombreComercio={nombreComercio} />
          <button
            type="button"
            aria-label="Abrir carrito"
            onClick={() => setCarritoAbierto(true)}
            className="relative rounded-lg p-2 text-crema active:bg-crema/10"
          >
            <svg
              viewBox="0 0 24 24"
              aria-hidden
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="9" cy="20" r="1" />
              <circle cx="18" cy="20" r="1" />
              <path d="M3 4h2l3 12h11l2-8H7" />
            </svg>
            {cantidadTotal > 0 && (
              <span className="absolute -right-1 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rojo px-1 text-[10px] font-bold text-crema">
                {cantidadTotal}
              </span>
            )}
          </button>
        </div>
        <div className="flex items-center justify-between gap-2 px-3 pb-2.5">
          <p
            className={`inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-[11px] ${
              estadoApertura.abierto
                ? "bg-[#122a13] text-[#7af086]"
                : "bg-[#381012] text-[#ff9898]"
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                estadoApertura.abierto ? "bg-[#57e26f]" : "bg-[#ff6868]"
              }`}
            />
            {estadoApertura.mensaje}
          </p>
        </div>
      </header>

      <div
        className={`fixed inset-0 z-40 bg-black/65 transition-opacity duration-200 lg:hidden ${
          menuAbierto ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={() => setMenuAbierto(false)}
        role="presentation"
      >
        <aside
          id="menu-movil-piamonte"
          inert={!menuAbierto}
          className={`flex h-full w-[84%] max-w-[19rem] flex-col overflow-y-auto bg-[#0b0a0a] px-4 py-5 transition-transform duration-200 ${
            menuAbierto ? "translate-x-0" : "-translate-x-full"
          }`}
          onClick={(evento) => evento.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b border-crema/10 pb-4">
            <LinkMarcaMovil nombreComercio={nombreComercio} grande />
            <button
              type="button"
              onClick={() => setMenuAbierto(false)}
              aria-label="Cerrar menú"
              className="rounded-md p-2 text-crema/65 transition-colors hover:bg-crema/10 hover:text-crema"
            >
              <svg viewBox="0 0 24 24" aria-hidden className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="m6 6 12 12M18 6 6 18" />
              </svg>
            </button>
          </div>
          <NavegacionPiamonte
            categoriaActiva={categoriaActiva}
            estadoApertura={estadoApertura}
            onNavegar={() => setMenuAbierto(false)}
          />
        </aside>
      </div>

      {carritoAbierto && (
        <Dialogo titulo="TU PEDIDO" onCerrar={() => setCarritoAbierto(false)}>
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            <ContenidoCarrito />
          </div>
        </Dialogo>
      )}
    </>
  );
}

function LinkMarcaMovil({
  nombreComercio,
  grande = false,
}: {
  nombreComercio: string;
  grande?: boolean;
}) {
  return (
    <Link
      href="/"
      className={`flex min-w-0 items-center gap-2.5 ${grande ? "gap-3" : ""}`}
    >
      <Image
        src="/brand/logo-piamonte.png"
        alt="Logo de Piamonte"
        width={1024}
        height={1536}
        sizes={grande ? "48px" : "36px"}
        className={`shrink-0 object-contain ${grande ? "h-[4.5rem] w-12" : "h-14 w-9"}`}
      />
      <span className="min-w-0">
        <span className={`block font-titulos uppercase leading-none tracking-wide text-crema ${grande ? "text-xl" : "text-lg"}`}>
          {nombreComercio}
        </span>
        <span className="mt-1 block text-[11px] text-crema/55">Parque Posadas</span>
      </span>
    </Link>
  );
}
