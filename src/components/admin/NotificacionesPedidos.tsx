"use client";

import { useState } from "react";
import { useNotificacionesPedidos } from "@/lib/admin/notificacionesPedidos";
import { probarSonido } from "@/lib/admin/sonidoAlerta";
import { etiquetaMetodoPago, requierePos } from "@/lib/admin/pagos";

function horaDesdeIso(iso: string): string {
  return new Intl.DateTimeFormat("es-UY", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function etiquetaModalidad(modalidad: string): string {
  const valor = modalidad.trim().toLowerCase();
  if (valor === "delivery") return "Delivery";
  if (valor === "retiro") return "Retiro";
  return modalidad;
}

// Avisos persistentes de pedidos nuevos. Cada aviso se mantiene hasta que
// un administrador lo marca como visto, sin alterar el estado del pedido.
export function NotificacionesPedidos({ comercioId }: { comercioId: string }) {
  const { notificaciones, error, marcarVisto, marcandoId } =
    useNotificacionesPedidos(comercioId);
  const [sonidoHabilitado, setSonidoHabilitado] = useState(false);
  const [errorSonido, setErrorSonido] = useState<string | null>(null);

  async function activarSonido() {
    const habilitado = await probarSonido();
    setSonidoHabilitado(habilitado);
    setErrorSonido(
      habilitado
        ? null
        : "El navegador bloqueó el audio. Revisá el volumen y los permisos de sonido de esta pestaña.",
    );
  }

  return (
    <section
      aria-live="polite"
      className="rounded-3xl border border-negro/10 bg-white p-5 shadow-[0_20px_45px_rgba(0,0,0,0.08)]"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-rojo">
            Pedidos nuevos
          </p>
          <h2 className="mt-1 flex items-center gap-2 font-titulos text-2xl uppercase tracking-wide text-negro">
            Sin revisar
            <span className="inline-flex min-w-8 justify-center rounded-full bg-rojo px-2 py-0.5 text-sm font-semibold text-white">
              {notificaciones.length}
            </span>
          </h2>
        </div>

        <button
          type="button"
          onClick={() => void activarSonido()}
          className="rounded-full border border-negro/15 px-4 py-2 text-sm font-semibold text-negro transition-colors hover:bg-negro/10"
        >
          {sonidoHabilitado ? "Probar sonido" : "Activar sonido"}
        </button>
      </div>

      {!sonidoHabilitado && (
        <p className="mt-2 text-sm text-negro/60">
          Activá el sonido para escuchar el aviso cuando entre un pedido nuevo.
        </p>
      )}
      {errorSonido && (
        <p className="mt-2 rounded-xl bg-rojo/10 px-4 py-3 text-sm text-rojo">
          {errorSonido}
        </p>
      )}

      {error && (
        <p className="mt-3 rounded-xl bg-rojo/10 px-4 py-3 text-sm text-rojo">
          {error}
        </p>
      )}

      {notificaciones.length === 0 ? (
        <p className="mt-3 text-sm text-negro/60">
          No hay pedidos nuevos sin revisar.
        </p>
      ) : (
        <ul className="mt-4 space-y-2">
          {notificaciones.map((notificacion) => (
            <li
              key={notificacion.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rojo/20 bg-rojo/5 px-4 py-3"
            >
              <div>
                <p className="font-titulos text-lg uppercase tracking-wide text-negro">
                  Pedido #{notificacion.numero}
                </p>
                <p className="text-sm text-negro/70">
                  {etiquetaModalidad(notificacion.modalidad)} ·{" "}
                  {horaDesdeIso(notificacion.creadoEn)}
                </p>
                <p className="text-sm text-negro/70">{etiquetaMetodoPago(notificacion.metodoPago)}</p>
                {requierePos(notificacion.modalidad, notificacion.metodoPago) && (
                  <p className="mt-2 rounded-xl border-2 border-rojo bg-rojo px-4 py-2 text-lg font-bold uppercase tracking-wide text-white">
                    Llevar POS
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => void marcarVisto(notificacion.id)}
                disabled={marcandoId === notificacion.id}
                aria-label={`Marcar como visto el pedido ${notificacion.numero}`}
                className="rounded-full bg-negro px-4 py-2 text-sm font-semibold text-crema transition-colors hover:bg-rojo disabled:cursor-not-allowed disabled:opacity-60"
              >
                {marcandoId === notificacion.id ? "Guardando…" : "Visto"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
