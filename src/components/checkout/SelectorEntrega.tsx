"use client";

import type { TipoEntrega } from "@/lib/checkout/tipos";

const OPCIONES: { valor: TipoEntrega; titulo: string; descripcion: string }[] = [
  { valor: "delivery", titulo: "Delivery", descripcion: "Te lo llevamos a tu dirección" },
  { valor: "retiro", titulo: "Retiro en el local", descripcion: "Lo pasás a buscar" },
];

// Selector del tipo de entrega con dos tarjetas seleccionables.
export function SelectorEntrega({
  valor,
  onCambio,
  error,
}: {
  valor: TipoEntrega | null;
  onCambio: (valor: TipoEntrega) => void;
  error?: string;
}) {
  return (
    <fieldset>
      <legend className="sr-only">Tipo de entrega</legend>
      <div className="grid grid-cols-2 gap-3">
        {OPCIONES.map((opcion) => {
          const activa = valor === opcion.valor;
          return (
            <label
              key={opcion.valor}
              className={`cursor-pointer rounded-2xl border-2 p-4 transition-colors focus-within:ring-2 focus-within:ring-rojo/30 ${
                activa
                  ? "border-rojo bg-negro text-crema"
                  : "border-negro/10 bg-white text-[#171717] hover:border-negro/30"
              }`}
            >
              <input
                type="radio"
                name="tipoEntrega"
                value={opcion.valor}
                checked={activa}
                onChange={() => onCambio(opcion.valor)}
                className="sr-only"
              />
              <span
                className={`block font-titulos text-lg uppercase tracking-wide ${activa ? "text-crema" : "text-[#171717]"}`}
              >
                {opcion.titulo}
              </span>
              <span
                className={`mt-1 block text-xs ${activa ? "text-crema/80" : "text-neutral-600"}`}
              >
                {opcion.descripcion}
              </span>
            </label>
          );
        })}
      </div>
      {error && <p className="mt-2 text-xs text-rojo">{error}</p>}
    </fieldset>
  );
}
