"use client";

import {
  esMetodoPagoHabilitado,
  type MetodoPagoCheckout,
} from "@/lib/checkout/tipos";

const habilitadoMercadoPago = esMetodoPagoHabilitado("mercado_pago");

const OPCIONES: {
  valor: MetodoPagoCheckout;
  titulo: string;
  descripcion: string;
  deshabilitado?: boolean;
}[] = [
  {
    valor: "efectivo",
    titulo: "Efectivo",
    descripcion: "Pagás al recibir o retirar el pedido",
  },
  {
    valor: "mercado_pago",
    titulo: "Mercado Pago",
    descripcion: habilitadoMercadoPago
      ? "Pago con Mercado Pago"
      : "Próximamente: se habilitará cuando esté la cuenta y las pruebas reales.",
    deshabilitado: !habilitadoMercadoPago,
  },
];

// Selector del método de pago. Solo define la intención de pago por ahora.
export function SelectorMetodoPago({
  valor,
  onCambio,
  error,
}: {
  valor: MetodoPagoCheckout | null;
  onCambio: (valor: MetodoPagoCheckout) => void;
  error?: string;
}) {
  return (
    <fieldset>
      <legend className="sr-only">Método de pago</legend>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {OPCIONES.map((opcion) => {
          const activa = valor === opcion.valor;
          const deshabilitada = Boolean(opcion.deshabilitado);
          return (
            <label
              key={opcion.valor}
              className={`rounded-2xl border-2 p-4 transition-colors ${
                deshabilitada
                  ? "cursor-not-allowed border-neutral-300 bg-neutral-100 text-neutral-500"
                  : activa
                    ? "cursor-pointer border-rojo bg-negro text-crema"
                    : "cursor-pointer border-negro/10 bg-white text-[#171717] hover:border-negro/30"
              } focus-within:ring-2 focus-within:ring-rojo/30`}
            >
              <input
                type="radio"
                name="metodoPago"
                value={opcion.valor}
                checked={activa}
                onChange={() => !deshabilitada && onCambio(opcion.valor)}
                className="sr-only"
                disabled={deshabilitada}
                aria-disabled={deshabilitada}
              />
              <span
                className={`block font-titulos text-lg uppercase tracking-wide ${
                  deshabilitada ? "text-neutral-500" : activa ? "text-crema" : "text-[#171717]"
                }`}
              >
                {opcion.titulo}
              </span>
              <span
                className={`mt-1 block text-xs ${
                  deshabilitada ? "text-neutral-500" : activa ? "text-crema/80" : "text-neutral-600"
                }`}
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
