"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const ESPERA_AGRUPACION_MS = 400;
const INTERVALO_RESPALDO_MS = 30_000;

// Realtime actúa como señal y router.refresh vuelve a consultar el catálogo
// en el servidor sin perder el estado de los componentes cliente.
export function ActualizadorCatalogo({ comercioId }: { comercioId: string }) {
  const router = useRouter();

  useEffect(() => {
    let temporizador: number | null = null;

    function actualizar() {
      if (temporizador) window.clearTimeout(temporizador);
      temporizador = window.setTimeout(() => {
        temporizador = null;
        router.refresh();
      }, ESPERA_AGRUPACION_MS);
    }

    const supabase = createClient();
    const canal = supabase
      .channel(`catalogo-disponibilidad-${comercioId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "productos",
          filter: `comercio_id=eq.${comercioId}`,
        },
        actualizar,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "variantes_producto",
        },
        actualizar,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "categorias",
          filter: `comercio_id=eq.${comercioId}`,
        },
        actualizar,
      )
      .subscribe();

    const intervalo = window.setInterval(actualizar, INTERVALO_RESPALDO_MS);
    const actualizarAlVolver = () => {
      if (document.visibilityState === "visible") actualizar();
    };
    document.addEventListener("visibilitychange", actualizarAlVolver);

    return () => {
      if (temporizador) window.clearTimeout(temporizador);
      window.clearInterval(intervalo);
      document.removeEventListener("visibilitychange", actualizarAlVolver);
      void supabase.removeChannel(canal);
    };
  }, [comercioId, router]);

  return null;
}
