"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { EVENTO_PEDIDOS_NUEVOS } from "@/lib/admin/notificacionesPedidos";
import { normalizarCelularUruguayo } from "@/lib/checkout/celular";
import { mensajePedidoAceptadoWhatsApp } from "@/lib/comercio";
import { formatearRango } from "@/lib/comercio/tiempos";

type EstadoPedido =
  | "pendiente"
  | "confirmado"
  | "en_preparacion"
  | "listo"
  | "entregado"
  | "cancelado";

type EstadoFiltro =
  | "pendiente"
  | "en_preparacion"
  | "listo"
  | "entregado"
  | "cancelado";

type PedidoAdmin = {
  id: string;
  numero: number;
  creadoEn: string;
  clienteNombre: string;
  clienteTelefono: string;
  modalidad: string;
  direccion: {
    calle: string | null;
    numero: string | null;
    apartamento: string | null;
    referencias: string | null;
  };
  estado: string;
  metodoPago: string;
  total: number;
  // Rango congelado al aceptar el pedido (PIA-2); null en pedidos previos o pendientes.
  tiempoEstimadoMin?: number | null;
  tiempoEstimadoMax?: number | null;
  items: Array<{
    nombreProducto: string;
    nombreVariante: string | null;
    cantidad: number;
    aclaraciones: string | null;
    total: number;
    opciones: string[];
  }>;
};

const ETIQUETAS_ESTADO: Record<EstadoFiltro, string> = {
  pendiente: "Nuevos",
  en_preparacion: "En preparación",
  listo: "Listos",
  entregado: "Entregados",
  cancelado: "Cancelados",
};

function normalizarEstado(estado: string): EstadoPedido | null {
  const valor = estado
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
  if (valor === "pendiente" || valor === "nuevo" || valor === "nuevos") {
    return "pendiente";
  }
  if (valor === "confirmado" || valor === "confirmados") return "confirmado";
  if (valor === "en_preparacion" || valor === "preparacion") {
    return "en_preparacion";
  }
  if (valor === "listo" || valor === "listos") return "listo";
  if (valor === "entregado" || valor === "entregados") return "entregado";
  if (valor === "cancelado" || valor === "cancelados") return "cancelado";
  return null;
}

function formatearMoneda(valor: number): string {
  return new Intl.NumberFormat("es-UY", {
    style: "currency",
    currency: "UYU",
    maximumFractionDigits: 0,
  }).format(valor);
}

function fechaHoraDesdeIso(iso: string): { fecha: string; hora: string } {
  const date = new Date(iso);
  return {
    fecha: new Intl.DateTimeFormat("es-UY", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(date),
    hora: new Intl.DateTimeFormat("es-UY", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(date),
  };
}

function accionesPorEstado(estado: EstadoPedido): Array<{
  nuevoEstado: EstadoPedido;
  texto: string;
  requiereConfirmacion?: boolean;
}> {
  if (estado === "pendiente") {
    return [
      { nuevoEstado: "en_preparacion", texto: "Aceptar pedido" },
      {
        nuevoEstado: "cancelado",
        texto: "Cancelar pedido",
        requiereConfirmacion: true,
      },
    ];
  }
  if (estado === "confirmado") {
    return [
      { nuevoEstado: "listo", texto: "Marcar como listo" },
      {
        nuevoEstado: "cancelado",
        texto: "Cancelar pedido",
        requiereConfirmacion: true,
      },
    ];
  }
  if (estado === "en_preparacion") {
    return [{ nuevoEstado: "listo", texto: "Marcar como listo" }];
  }
  if (estado === "listo") {
    return [{ nuevoEstado: "entregado", texto: "Marcar como entregado" }];
  }
  return [];
}

// Panel administrativo con pedidos reales y transiciones seguras de estado.
export function PanelPedidosAdmin({
  puedeCancelar = true,
}: {
  puedeCancelar?: boolean;
}) {
  const [estadoFiltro, setEstadoFiltro] = useState<EstadoFiltro>("pendiente");
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mensajeOk, setMensajeOk] = useState<string | null>(null);
  const [pedidos, setPedidos] = useState<PedidoAdmin[]>([]);
  const [pedidoSeleccionadoId, setPedidoSeleccionadoId] = useState<string | null>(
    null,
  );
  const [actualizandoId, setActualizandoId] = useState<string | null>(null);
  const [avisoWhatsApp, setAvisoWhatsApp] = useState<{
    numeroPedido: number;
    url: string | null;
  } | null>(null);

  const cargarPedidos = useCallback(async (mostrarCarga = true) => {
    if (mostrarCarga) setCargando(true);
    setError(null);
    try {
      const respuesta = await fetch("/api/admin/pedidos", {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store",
      });
      const cuerpo = (await respuesta.json().catch(() => null)) as
        | { pedidos?: PedidoAdmin[]; error?: string }
        | null;
      if (!respuesta.ok) {
        throw new Error(cuerpo?.error ?? "No pudimos cargar los pedidos.");
      }
      setPedidos(cuerpo?.pedidos ?? []);
    } catch (errorDesconocido) {
      setError(
        errorDesconocido instanceof Error
          ? errorDesconocido.message
          : "No pudimos cargar los pedidos.",
      );
    } finally {
      if (mostrarCarga) setCargando(false);
    }
  }, []);

  useEffect(() => {
    const temporizador = window.setTimeout(() => {
      void cargarPedidos();
    }, 0);
    const actualizarPorPedidoNuevo = () => {
      void cargarPedidos(false);
    };
    window.addEventListener(EVENTO_PEDIDOS_NUEVOS, actualizarPorPedidoNuevo);
    return () => {
      window.clearTimeout(temporizador);
      window.removeEventListener(
        EVENTO_PEDIDOS_NUEVOS,
        actualizarPorPedidoNuevo,
      );
    };
  }, [cargarPedidos]);

  const pedidosFiltrados = useMemo(
    () =>
      pedidos.filter((pedido) => {
        const estado = normalizarEstado(pedido.estado);
        if (!estado) return false;
        if (estadoFiltro === "en_preparacion") {
          return estado === "en_preparacion" || estado === "confirmado";
        }
        return estado === estadoFiltro;
      }),
    [pedidos, estadoFiltro],
  );

  const pedidoSeleccionado =
    pedidosFiltrados.find((pedido) => pedido.id === pedidoSeleccionadoId) ??
    pedidosFiltrados[0] ??
    null;

  async function cambiarEstadoPedido(
    pedido: PedidoAdmin,
    nuevoEstado: EstadoPedido,
    requiereConfirmacion = false,
  ) {
    const estadoActual = normalizarEstado(pedido.estado);
    if (!estadoActual || actualizandoId) return;

    if (requiereConfirmacion) {
      const confirmar = window.confirm(
        "¿Confirmás que querés cancelar este pedido?",
      );
      if (!confirmar) return;
    }

    setMensajeOk(null);
    setError(null);
    setActualizandoId(pedido.id);
    try {
      const respuesta = await fetch("/api/admin/pedidos/estado", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pedidoId: pedido.id,
          estadoActualEsperado: estadoActual,
          nuevoEstado,
          operacionId: crypto.randomUUID(),
        }),
      });
      const cuerpo = (await respuesta.json().catch(() => null)) as
        | {
            mensaje?: string;
            error?: string;
            estadoActual?: string;
            tiempoEstimado?: { min: number; max: number } | null;
          }
        | null;
      if (!respuesta.ok) {
        throw new Error(
          cuerpo?.error ??
            "No pudimos actualizar el estado del pedido en este momento.",
        );
      }
      setMensajeOk(cuerpo?.mensaje ?? "Estado actualizado correctamente.");
      if (estadoActual === "pendiente" && nuevoEstado === "en_preparacion") {
        const telefono = typeof pedido.clienteTelefono === "string"
          ? normalizarCelularUruguayo(pedido.clienteTelefono) : null;
        // El rango congelado por la base al aceptar; sin él, el mensaje base.
        const rango = cuerpo?.tiempoEstimado
          ? formatearRango(cuerpo.tiempoEstimado.min, cuerpo.tiempoEstimado.max)
          : null;
        const url = telefono
          ? `https://wa.me/${telefono.slice(1)}?text=${encodeURIComponent(mensajePedidoAceptadoWhatsApp(rango))}`
          : null;
        setAvisoWhatsApp({ numeroPedido: pedido.numero, url });
        if (url) {
          try {
            window.open(url, "_blank", "noopener,noreferrer");
          } catch {
            console.warn("No se pudo abrir WhatsApp. El aviso manual sigue disponible en el panel.");
          }
        }
      }
      await cargarPedidos();
    } catch (errorDesconocido) {
      setError(
        errorDesconocido instanceof Error
          ? errorDesconocido.message
          : "No pudimos actualizar el estado del pedido.",
      );
    } finally {
      setActualizandoId(null);
    }
  }

  if (cargando) {
    return (
      <div className="rounded-3xl border border-negro/10 bg-white p-8 shadow-[0_20px_45px_rgba(0,0,0,0.08)]">
        <p className="font-titulos text-2xl uppercase tracking-wide text-negro">
          Cargando pedidos…
        </p>
        <p className="mt-2 text-sm text-negro/60">
          Consultando pedidos reales del comercio.
        </p>
        <div className="mt-6 grid gap-3">
          <div className="h-16 animate-pulse rounded-2xl bg-negro/10" />
          <div className="h-16 animate-pulse rounded-2xl bg-negro/10" />
          <div className="h-16 animate-pulse rounded-2xl bg-negro/10" />
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <section className="space-y-4">
        <div className="rounded-3xl border border-negro/10 bg-white p-5 shadow-[0_20px_45px_rgba(0,0,0,0.08)]">
          <p className="text-xs font-semibold uppercase tracking-wider text-rojo">
            Pedidos reales
          </p>
          <h2 className="mt-1 font-titulos text-2xl uppercase tracking-wide text-negro">
            Gestión de pedidos
          </h2>
          <p className="mt-1 text-sm text-negro/60">
            Vista en tiempo real del comercio autorizado.
          </p>
        </div>

        {mensajeOk && (
          <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {mensajeOk}
          </p>
        )}
        {error && (
          <p className="rounded-xl bg-rojo/10 px-4 py-3 text-sm text-rojo">
            {error}
          </p>
        )}
        {avisoWhatsApp && (
          <div role="status" className="rounded-2xl border border-negro/10 bg-white p-4 text-sm text-negro/80">
            <p className="font-semibold text-negro">
              Aviso del pedido #{avisoWhatsApp.numeroPedido}
            </p>
            <p className="mt-1">
              {avisoWhatsApp.url
                ? "El pedido fue aceptado. Confirmá manualmente el envío en WhatsApp. Si no se abrió, usá el botón."
                : "El pedido fue aceptado, pero no tiene un celular uruguayo válido registrado. No se pudo abrir WhatsApp."}
            </p>
            {avisoWhatsApp.url ? (
              <a href={avisoWhatsApp.url} target="_blank" rel="noopener noreferrer"
                className="mt-3 inline-block rounded-full bg-rojo px-4 py-2 text-sm font-semibold text-white hover:bg-negro">
                Avisar por WhatsApp
              </a>
            ) : (
              <button type="button" disabled
                className="mt-3 rounded-full bg-rojo px-4 py-2 text-sm font-semibold text-white opacity-45">
                Avisar por WhatsApp
              </button>
            )}
          </div>
        )}

        <nav
          aria-label="Filtros de estado de pedidos"
          className="rounded-3xl border border-negro/10 bg-white p-3 shadow-[0_18px_40px_rgba(0,0,0,0.06)]"
        >
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
            {(
              [
                "pendiente",
                "en_preparacion",
                "listo",
                "entregado",
                "cancelado",
              ] as EstadoFiltro[]
            ).map((estado) => {
              const activo = estadoFiltro === estado;
              return (
                <li key={estado}>
                  <button
                    type="button"
                    onClick={() => setEstadoFiltro(estado)}
                    className={`w-full rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
                      activo
                        ? "bg-rojo text-white shadow-[0_8px_20px_rgba(197,40,40,0.35)]"
                        : "bg-fondo text-negro hover:bg-negro/10"
                    }`}
                  >
                    {ETIQUETAS_ESTADO[estado]}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        {pedidosFiltrados.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-negro/20 bg-white p-8 text-center shadow-[0_18px_40px_rgba(0,0,0,0.06)]">
            <p className="font-titulos text-2xl uppercase text-negro">
              Sin pedidos en {ETIQUETAS_ESTADO[estadoFiltro]}
            </p>
            <p className="mt-2 text-sm text-negro/60">
              No hay pedidos en este estado actualmente.
            </p>
          </div>
        ) : (
          <ul className="space-y-4">
            {pedidosFiltrados.map((pedido) => {
              const { fecha, hora } = fechaHoraDesdeIso(pedido.creadoEn);
              const estadoActual = normalizarEstado(pedido.estado) ?? "pendiente";
              const acciones = accionesPorEstado(estadoActual).filter(
                (accion) =>
                  puedeCancelar || accion.nuevoEstado !== "cancelado",
              );
              const etiquetaEstado =
                estadoActual === "confirmado"
                  ? ETIQUETAS_ESTADO.en_preparacion
                  : ETIQUETAS_ESTADO[estadoActual as EstadoFiltro];
              return (
                <li key={pedido.id}>
                  <article className="rounded-3xl border border-negro/10 bg-white p-5 shadow-[0_18px_40px_rgba(0,0,0,0.06)]">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-titulos text-2xl uppercase tracking-wide text-negro">
                          Pedido #{pedido.numero}
                        </p>
                        <p className="text-sm text-negro/60">
                          {fecha} {hora} · {pedido.clienteNombre} · {pedido.modalidad}
                        </p>
                      </div>
                      <span className="rounded-full bg-negro px-3 py-1 text-xs font-semibold uppercase tracking-wider text-crema">
                        {etiquetaEstado}
                      </span>
                    </div>

                    <ul className="mt-4 space-y-2 text-sm text-negro/80">
                      {pedido.items.map((item, index) => (
                        <li key={`${pedido.id}-${index}`}>
                          <span className="font-semibold text-negro">
                            {item.cantidad}×
                          </span>{" "}
                          {item.nombreProducto}
                          {item.nombreVariante && (
                            <span className="text-negro/60"> · {item.nombreVariante}</span>
                          )}
                          {item.opciones.length > 0 && (
                            <span className="text-negro/60">
                              {" "}
                              · {item.opciones.join(", ")}
                            </span>
                          )}
                          {item.aclaraciones && (
                            <span className="text-negro/60"> · {item.aclaraciones}</span>
                          )}
                        </li>
                      ))}
                    </ul>

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-negro/10 pt-4">
                      <p className="text-sm text-negro/70">
                        Pago:{" "}
                        <span className="font-semibold text-negro">{pedido.metodoPago}</span>
                        {typeof pedido.tiempoEstimadoMin === "number" &&
                          typeof pedido.tiempoEstimadoMax === "number" && (
                            <span>
                              {" · "}Estimado:{" "}
                              <span className="font-semibold text-negro">
                                {formatearRango(pedido.tiempoEstimadoMin, pedido.tiempoEstimadoMax)}
                              </span>
                            </span>
                          )}
                      </p>
                      <p className="text-lg font-bold text-negro">
                        {formatearMoneda(pedido.total)}
                      </p>
                    </div>

                    {acciones.length > 0 && (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {acciones.map((accion) => (
                          <button
                            key={`${pedido.id}-${accion.nuevoEstado}`}
                            type="button"
                            onClick={() =>
                              void cambiarEstadoPedido(
                                pedido,
                                accion.nuevoEstado,
                                accion.requiereConfirmacion,
                              )
                            }
                            disabled={actualizandoId !== null}
                            className="rounded-full bg-rojo px-4 py-2 text-sm font-semibold text-white shadow-[0_8px_18px_rgba(197,40,40,0.35)] hover:bg-negro disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {actualizandoId === pedido.id
                              ? "Actualizando…"
                              : accion.texto}
                          </button>
                        ))}
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => setPedidoSeleccionadoId(pedido.id)}
                      className="mt-4 text-sm font-semibold text-rojo hover:underline"
                    >
                      Ver detalle
                    </button>
                  </article>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <aside className="rounded-3xl border border-negro/10 bg-white p-5 shadow-[0_20px_45px_rgba(0,0,0,0.08)] lg:sticky lg:top-6 lg:h-fit">
        <h3 className="font-titulos text-2xl uppercase tracking-wide text-negro">
          Detalle del pedido
        </h3>
        <p className="mt-1 text-xs uppercase tracking-wider text-rojo">
          Solo administradores autorizados
        </p>

        {!pedidoSeleccionado ? (
          <p className="mt-4 text-sm text-negro/60">
            Seleccioná un pedido para ver sus datos.
          </p>
        ) : (
          <div className="mt-4 space-y-3 text-sm text-negro/80">
            <p>
              <span className="font-semibold text-negro">Pedido:</span> #
              {pedidoSeleccionado.numero}
            </p>
            <p>
              <span className="font-semibold text-negro">Cliente:</span>{" "}
              {pedidoSeleccionado.clienteNombre}
            </p>
            <p>
              <span className="font-semibold text-negro">Teléfono:</span>{" "}
              {pedidoSeleccionado.clienteTelefono}
            </p>
            <p>
              <span className="font-semibold text-negro">Modalidad:</span>{" "}
              {pedidoSeleccionado.modalidad}
            </p>
            {pedidoSeleccionado.modalidad.toLowerCase() === "delivery" && (
              <div className="space-y-1">
                <p>
                  <span className="font-semibold text-negro">Dirección:</span>{" "}
                  {[pedidoSeleccionado.direccion.calle, pedidoSeleccionado.direccion.numero]
                    .filter(Boolean)
                    .join(" ")}
                </p>
                {pedidoSeleccionado.direccion.apartamento && (
                  <p>
                    <span className="font-semibold text-negro">Apartamento:</span>{" "}
                    {pedidoSeleccionado.direccion.apartamento}
                  </p>
                )}
                {pedidoSeleccionado.direccion.referencias && (
                  <p>
                    <span className="font-semibold text-negro">Referencias:</span>{" "}
                    {pedidoSeleccionado.direccion.referencias}
                  </p>
                )}
              </div>
            )}
            <p>
              <span className="font-semibold text-negro">Método de pago:</span>{" "}
              {pedidoSeleccionado.metodoPago}
            </p>
          </div>
        )}
      </aside>
    </div>
  );
}
