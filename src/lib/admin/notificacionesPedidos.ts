"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { reproducirAlerta } from "./sonidoAlerta";

export type NotificacionPedido = {
  id: string;
  numero: number;
  modalidad: string;
  metodoPago: string;
  creadoEn: string;
};

// Los eventos de una misma tanda se agrupan para consultar y sonar una sola vez.
const ESPERA_AGRUPACION_MS = 400;
// Respaldo ante cortes del WebSocket o configuraciones de red que bloqueen Realtime.
const INTERVALO_RESPALDO_MS = 15_000;

export const EVENTO_PEDIDOS_NUEVOS = "piamonte:pedidos-nuevos";

// Escucha pedidos nuevos con Supabase Realtime y mantiene la lista de avisos sin revisar.
// Realtime se usa sólo como señal: los datos siempre vienen del endpoint administrativo,
// que es la única fuente de verdad y evita duplicados al reconectar o recargar.
export function useNotificacionesPedidos(comercioId: string) {
  const [notificaciones, setNotificaciones] = useState<NotificacionPedido[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [marcandoId, setMarcandoId] = useState<string | null>(null);

  // Mientras vale null no hubo una primera sincronización: así no suena al abrir ni al recargar.
  const idsAvisados = useRef<Set<string> | null>(null);
  const montado = useRef(true);

  const sincronizar = useCallback(async () => {
    try {
      const respuesta = await fetch("/api/admin/pedidos/sin-revisar", {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store",
      });
      const cuerpo = (await respuesta.json().catch(() => null)) as
        | { pedidos?: NotificacionPedido[]; error?: string }
        | null;
      if (!respuesta.ok) {
        throw new Error(
          cuerpo?.error ?? "No pudimos consultar los pedidos sin revisar.",
        );
      }
      if (!montado.current) return;

      const pedidos = cuerpo?.pedidos ?? [];
      const avisados = idsAvisados.current;
      // Sólo suena si aparecieron pedidos que todavía no se habían anunciado.
      const hayNuevos =
        avisados !== null && pedidos.some((pedido) => !avisados.has(pedido.id));

      idsAvisados.current = new Set(pedidos.map((pedido) => pedido.id));
      setNotificaciones(pedidos);
      setError(null);

      if (hayNuevos) {
        void reproducirAlerta();
        window.dispatchEvent(new Event(EVENTO_PEDIDOS_NUEVOS));
      }
    } catch (errorDesconocido) {
      if (!montado.current) return;
      setError(
        errorDesconocido instanceof Error
          ? errorDesconocido.message
          : "No pudimos consultar los pedidos sin revisar.",
      );
    }
  }, []);

  useEffect(() => {
    montado.current = true;
    let temporizador: ReturnType<typeof setTimeout> | null = null;

    function programarSincronizacion() {
      if (temporizador) clearTimeout(temporizador);
      temporizador = setTimeout(() => {
        temporizador = null;
        void sincronizar();
      }, ESPERA_AGRUPACION_MS);
    }

    const supabase = createClient();
    const canal = supabase.channel(`pedidos-sin-revisar-${comercioId}`);

    canal
      // INSERT avisa de pedidos nuevos; UPDATE propaga los "Visto" de otras sesiones.
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "pedidos",
          filter: `comercio_id=eq.${comercioId}`,
        },
        programarSincronizacion,
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "pedidos",
          filter: `comercio_id=eq.${comercioId}`,
        },
        programarSincronizacion,
      );

    // Realtime entrega los eventos con los permisos de la sesión administrativa.
    void supabase.realtime
      .setAuth()
      .then(() => {
        canal.subscribe((estadoCanal) => {
          // Al suscribirse y al reconectar se recuperan los pedidos sin revisar.
          if (estadoCanal === "SUBSCRIBED") programarSincronizacion();
        });
      })
      .catch((errorRealtime: unknown) => {
        // Sin Realtime el panel sigue mostrando los avisos ya cargados.
        console.error(
          "No se pudo autorizar la conexión de tiempo real:",
          errorRealtime,
        );
      });

    // Carga inicial independiente de Realtime: el panel muestra avisos aunque falle la conexión.
    programarSincronizacion();
    const intervaloRespaldo = window.setInterval(
      programarSincronizacion,
      INTERVALO_RESPALDO_MS,
    );

    return () => {
      montado.current = false;
      if (temporizador) clearTimeout(temporizador);
      window.clearInterval(intervaloRespaldo);
      void supabase.removeChannel(canal);
    };
  }, [comercioId, sincronizar]);

  const marcarVisto = useCallback(async (pedidoId: string) => {
    setMarcandoId(pedidoId);
    const controlador = new AbortController();
    const temporizador = window.setTimeout(() => controlador.abort(), 10_000);
    try {
      const respuesta = await fetch("/api/admin/pedidos/revisar", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ pedidoId }),
        signal: controlador.signal,
      });
      const cuerpo = (await respuesta.json().catch(() => null)) as
        | { error?: string }
        | null;
      if (!respuesta.ok) {
        throw new Error(
          cuerpo?.error ?? "No pudimos marcar el pedido como visto.",
        );
      }
      if (!montado.current) return;

      idsAvisados.current?.delete(pedidoId);
      setNotificaciones((actuales) =>
        actuales.filter((notificacion) => notificacion.id !== pedidoId),
      );
      setError(null);
    } catch (errorDesconocido) {
      if (!montado.current) return;
      setError(
        errorDesconocido instanceof DOMException &&
        errorDesconocido.name === "AbortError"
          ? "La operación tardó demasiado. Verificá la conexión e intentá nuevamente."
          : errorDesconocido instanceof Error
          ? errorDesconocido.message
          : "No pudimos marcar el pedido como visto.",
      );
    } finally {
      window.clearTimeout(temporizador);
      if (montado.current) setMarcandoId(null);
    }
  }, []);

  return { notificaciones, error, marcarVisto, marcandoId };
}
