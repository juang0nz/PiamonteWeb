"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  esConfiguracionDescuentoWeb,
  esPorcentajeDescuentoWeb,
  type ConfiguracionDescuentoWeb,
} from "@/lib/comercio/descuento-web";

const URL_DESCUENTO = "/api/admin/operacion/descuento-web";

async function leerRespuesta(respuesta: Response): Promise<ConfiguracionDescuentoWeb> {
  const cuerpo: unknown = await respuesta.json();
  if (!respuesta.ok) {
    throw new Error(typeof cuerpo === "object" && cuerpo !== null &&
      "error" in cuerpo && typeof cuerpo.error === "string"
      ? cuerpo.error : "No pudimos consultar o guardar el descuento web.");
  }
  if (typeof cuerpo !== "object" || cuerpo === null || !("descuentoWeb" in cuerpo) ||
    !esConfiguracionDescuentoWeb(cuerpo.descuentoWeb)) {
    throw new Error("La respuesta del descuento web no es válida. Recargá para consultar su estado.");
  }
  return cuerpo.descuentoWeb;
}

export function ConfiguracionDescuentoWeb() {
  const [configuracion, setConfiguracion] = useState<ConfiguracionDescuentoWeb | null>(null);
  const [porcentaje, setPorcentaje] = useState("");
  const [activa, setActiva] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const operacion = useRef<{ id: string; activa: boolean; valor: number } | null>(null);
  const enCurso = useRef(false);

  const aplicar = useCallback((datos: ConfiguracionDescuentoWeb) => {
    setConfiguracion(datos);
    setActiva(datos.activa);
    setPorcentaje(String(datos.valor));
  }, []);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    setMensaje(null);
    try {
      aplicar(await leerRespuesta(await fetch(URL_DESCUENTO, { credentials: "same-origin", cache: "no-store" })));
    } catch (fallo) {
      console.error("[descuento-web] Error al cargar:", fallo);
      setError(fallo instanceof Error ? fallo.message : "No pudimos cargar el descuento web.");
    } finally {
      setCargando(false);
    }
  }, [aplicar]);

  useEffect(() => {
    const temporizador = window.setTimeout(() => { void cargar(); }, 0);
    return () => window.clearTimeout(temporizador);
  }, [cargar]);

  async function guardar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (enCurso.current || !configuracion) return;
    setMensaje(null);
    const texto = porcentaje.trim();
    const valor = Number(texto);
    if (!/^\d+$/.test(texto) || !esPorcentajeDescuentoWeb(valor)) {
      setError("Ingresá un porcentaje entero entre 0 y 100.");
      return;
    }
    setError(null);
    enCurso.current = true;
    setGuardando(true);
    try {
      // Conservar el identificador permite reintentar el mismo cambio sin duplicar auditoría.
      if (!operacion.current || operacion.current.activa !== activa || operacion.current.valor !== valor) {
        operacion.current = { id: crypto.randomUUID(), activa, valor };
      }
      const datos = await leerRespuesta(await fetch(URL_DESCUENTO, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operacionId: operacion.current.id, cambios: { activa, valor } }),
      }));
      aplicar(datos);
      operacion.current = null;
      setMensaje(`Descuento web guardado: ${datos.activa ? "activo" : "desactivado"}, ${datos.valor} %.`);
    } catch (fallo) {
      console.error("[descuento-web] Error al guardar:", fallo);
      setError(fallo instanceof Error ? fallo.message : "No pudimos guardar el descuento web.");
    } finally {
      enCurso.current = false;
      setGuardando(false);
    }
  }

  const pendiente = configuracion && (configuracion.activa !== activa || String(configuracion.valor) !== porcentaje);
  return (
    <section aria-labelledby="titulo-descuento-web" className="space-y-4 rounded-3xl border border-negro/10 bg-white p-5 shadow-[0_20px_45px_rgba(0,0,0,0.08)]">
      <div>
        <h3 id="titulo-descuento-web" className="font-titulos text-xl uppercase tracking-wide text-negro">Descuento web</h3>
        <p className="mt-1 text-sm text-negro/60">Para todos los productos, variantes y adicionales, en delivery y retiro. No descuenta el envío.</p>
      </div>
      {cargando && <p role="status" className="text-sm text-negro/60">Cargando descuento web…</p>}
      {error && <p role="alert" id="error-descuento-web" className="rounded-xl bg-rojo/10 px-4 py-3 text-sm text-rojo">{error}</p>}
      {mensaje && <p role="status" className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{mensaje}</p>}
      {!cargando && !configuracion && (
        <button type="button" onClick={() => void cargar()} className="rounded-full border border-negro/20 px-4 py-2 text-sm font-semibold">Reintentar descuento web</button>
      )}
      {configuracion && (
        <form onSubmit={guardar} noValidate className="space-y-4">
          <p className="text-sm font-semibold text-negro">Configuración guardada: {configuracion.activa ? "Activo" : "Desactivado"} · {configuracion.valor} %</p>
          <label className="block text-sm font-semibold text-negro">
            Porcentaje de descuento (%)
            <input
              type="text" inputMode="numeric" value={porcentaje}
              disabled={guardando || cargando}
              aria-invalid={Boolean(error && (!/^\d+$/.test(porcentaje.trim()) || !esPorcentajeDescuentoWeb(Number(porcentaje))))}
              aria-describedby={error ? "error-descuento-web ayuda-descuento-web" : "ayuda-descuento-web"}
              onChange={evento => { setPorcentaje(evento.target.value); setMensaje(null); setError(null); }}
              className="mt-1.5 w-full rounded-2xl border border-negro/15 bg-fondo px-4 py-2.5 text-sm focus:border-rojo focus:outline-none focus:ring-2 focus:ring-rojo/20"
            />
          </label>
          <p id="ayuda-descuento-web" className="text-xs text-negro/60">Enteros entre 0 y 100. El 100 % deja los productos sin costo; el envío se cobra completo.</p>
          <label className="flex items-center gap-3 rounded-xl bg-fondo p-3 text-sm font-semibold text-negro">
            <input type="checkbox" checked={activa} disabled={guardando || cargando}
              onChange={evento => { setActiva(evento.target.checked); setMensaje(null); setError(null); }}
              className="size-5 accent-rojo" />
            Activar descuento web
          </label>
          {pendiente && <p className="text-xs text-negro/60">Cambios sin guardar.</p>}
          <button type="submit" disabled={guardando || cargando}
            className="w-full rounded-full bg-rojo px-5 py-3 text-sm font-semibold text-white hover:bg-negro disabled:cursor-not-allowed disabled:opacity-45">
            {guardando ? "Guardando…" : "Guardar descuento web"}
          </button>
        </form>
      )}
    </section>
  );
}
