"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CLAVES_RANGOS,
  MINUTOS_MAXIMOS,
  COSTO_ENVIO_MAXIMO,
  formatearRango,
  tiemposPorDemanda,
  validarRangos,
  validarCostoEnvio,
  type ClaveConfiguracion,
  type ClaveRango,
  type ConfiguracionOperativa,
  type NivelDemanda,
} from "@/lib/comercio/tiempos";

type Configuracion = ConfiguracionOperativa & { actualizado_en: string };

type Cambios = Partial<Record<ClaveConfiguracion, string | number | boolean>>;

type Seccion = "demanda" | "pausa" | "tiempos" | "delivery";

const ETIQUETAS_NIVEL: Record<NivelDemanda, string> = {
  normal: "Normal",
  alta: "Alta",
};

// Panel "Operación": demanda, pausa, tiempos estimados y tarifa de delivery.
// Cada sección guarda solo sus claves mediante PATCH /api/admin/operacion (RPC auditada).
export function PanelOperacionAdmin() {
  const [configuracion, setConfiguracion] = useState<Configuracion | null>(null);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState<Seccion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [costoEnvioBorrador, setCostoEnvioBorrador] = useState("");
  const [errorCostoEnvio, setErrorCostoEnvio] = useState<string | null>(null);

  // Borradores de las secciones con botón Guardar.
  const [pausaBorrador, setPausaBorrador] = useState<{ activa: boolean; mensaje: string }>({
    activa: false,
    mensaje: "",
  });
  const [rangosBorrador, setRangosBorrador] = useState<Record<ClaveRango, string>>(
    () => Object.fromEntries(CLAVES_RANGOS.map((clave) => [clave, ""])) as Record<ClaveRango, string>,
  );
  const [erroresRangos, setErroresRangos] = useState<Partial<Record<ClaveRango, string>>>({});

  const aplicarConfiguracion = useCallback((fila: Configuracion) => {
    setConfiguracion(fila);
    setPausaBorrador({ activa: fila.pedidos_pausados, mensaje: fila.mensaje_pausa });
    setRangosBorrador(
      Object.fromEntries(CLAVES_RANGOS.map((clave) => [clave, String(fila[clave])])) as Record<
        ClaveRango,
        string
      >,
    );
    setErroresRangos({});
    setCostoEnvioBorrador(String(fila.costo_envio));
    setErrorCostoEnvio(null);
  }, []);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const respuesta = await fetch("/api/admin/operacion", {
        credentials: "same-origin",
        cache: "no-store",
      });
      const cuerpo = (await respuesta.json().catch(() => null)) as
        | { configuracion?: Configuracion; error?: string }
        | null;
      if (!respuesta.ok || !cuerpo?.configuracion) {
        throw new Error(cuerpo?.error ?? "No pudimos cargar la configuración operativa.");
      }
      aplicarConfiguracion(cuerpo.configuracion);
    } catch (errorDesconocido) {
      setError(
        errorDesconocido instanceof Error
          ? errorDesconocido.message
          : "No pudimos cargar la configuración operativa.",
      );
    } finally {
      setCargando(false);
    }
  }, [aplicarConfiguracion]);

  useEffect(() => {
    const temporizador = window.setTimeout(() => {
      void cargar();
    }, 0);
    return () => window.clearTimeout(temporizador);
  }, [cargar]);

  async function guardar(seccion: Seccion, cambios: Cambios, mensajeOk: string) {
    if (guardando) return;
    setGuardando(seccion);
    setError(null);
    setMensaje(null);
    try {
      const respuesta = await fetch("/api/admin/operacion", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ cambios, operacionId: crypto.randomUUID() }),
      });
      const cuerpo = (await respuesta.json().catch(() => null)) as
        | { configuracion?: Configuracion; error?: string }
        | null;
      if (!respuesta.ok || !cuerpo?.configuracion) {
        throw new Error(cuerpo?.error ?? "No pudimos guardar la configuración.");
      }
      aplicarConfiguracion(cuerpo.configuracion);
      setMensaje(mensajeOk);
    } catch (errorDesconocido) {
      setError(
        errorDesconocido instanceof Error
          ? errorDesconocido.message
          : "No pudimos guardar la configuración.",
      );
    } finally {
      setGuardando(null);
    }
  }

  function cambiarDemanda(demanda: NivelDemanda) {
    if (!configuracion || configuracion.demanda === demanda) return;
    void guardar(
      "demanda",
      { demanda },
      `Demanda ${ETIQUETAS_NIVEL[demanda].toLowerCase()} activada. La carta ya muestra los nuevos tiempos.`,
    );
  }

  function guardarPausa() {
    const mensajeLimpio = pausaBorrador.mensaje.trim();
    if (mensajeLimpio.length === 0 || mensajeLimpio.length > 280) {
      setError("El mensaje de pausa debe tener entre 1 y 280 caracteres.");
      return;
    }
    void guardar(
      "pausa",
      { pedidos_pausados: pausaBorrador.activa, mensaje_pausa: mensajeLimpio },
      pausaBorrador.activa
        ? "Pedidos en pausa. La carta y el checkout ya muestran el mensaje."
        : "Pedidos habilitados nuevamente.",
    );
  }

  function guardarTiempos() {
    const valores = Object.fromEntries(
      CLAVES_RANGOS.map((clave) => [clave, Number(rangosBorrador[clave])]),
    ) as Record<ClaveRango, number>;
    const errores = validarRangos(valores);
    setErroresRangos(errores);
    if (Object.keys(errores).length > 0) {
      setError("Revisá los minutos marcados antes de guardar.");
      return;
    }
    void guardar("tiempos", valores, "Tiempos estimados guardados.");
  }

  function guardarDelivery() {
    const texto = costoEnvioBorrador.trim().replace(",", ".");
    const costo = Number(texto);
    const errorImporte = validarCostoEnvio(costo);
    const error = errorImporte ?? (
      /^\d+(?:\.\d{1,2})?$/.test(texto)
        ? null
        : "Ingresá un importe en UYU con hasta dos decimales."
    );
    setErrorCostoEnvio(error);
    setMensaje(null);
    if (error) return;
    void guardar("delivery", { costo_envio: costo }, "Costo de envío guardado correctamente.");
  }

  if (cargando) {
    return (
      <div className="rounded-3xl border border-negro/10 bg-white p-8 shadow-[0_20px_45px_rgba(0,0,0,0.08)]">
        <p className="font-titulos text-2xl uppercase tracking-wide text-negro">Cargando operación…</p>
        <div className="mt-6 grid gap-3">
          <div className="h-16 animate-pulse rounded-2xl bg-negro/10" />
          <div className="h-16 animate-pulse rounded-2xl bg-negro/10" />
        </div>
      </div>
    );
  }

  if (!configuracion) {
    return (
      <div className="space-y-4 rounded-3xl border border-negro/10 bg-white p-8 shadow-[0_20px_45px_rgba(0,0,0,0.08)]">
        <p role="alert" className="rounded-xl bg-rojo/10 px-4 py-3 text-sm text-rojo">
          {error ?? "No pudimos cargar la configuración operativa."}
        </p>
        <button
          type="button"
          onClick={() => void cargar()}
          className="rounded-full border border-negro/20 px-4 py-2 text-xs font-semibold text-negro hover:bg-white"
        >
          Reintentar
        </button>
      </div>
    );
  }

  const tiemposVigentes = tiemposPorDemanda(configuracion);
  const bloqueado = guardando !== null;

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-negro/10 bg-white p-5 shadow-[0_20px_45px_rgba(0,0,0,0.08)]">
        <p className="text-xs font-semibold uppercase tracking-wider text-rojo">Operación</p>
        <h2 className="mt-1 font-titulos text-2xl uppercase tracking-wide text-negro">
          Demanda, tiempos, pausa y delivery
        </h2>
        <p className="mt-1 text-sm text-negro/60">
          Los cambios de demanda, tiempos y pausa se ven en la carta y el checkout en menos de
          un minuto. Los pedidos ya aceptados conservan el tiempo que se les informó.
        </p>
      </div>

      {mensaje && (
        <p role="status" className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {mensaje}
        </p>
      )}
      {error && (
        <p role="alert" className="rounded-xl bg-rojo/10 px-4 py-3 text-sm text-rojo">
          {error}
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Demanda */}
        <section className="space-y-4 rounded-3xl border border-negro/10 bg-white p-5 shadow-[0_20px_45px_rgba(0,0,0,0.08)]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-rojo">Demanda</p>
            <h3 className="mt-1 font-titulos text-xl uppercase tracking-wide text-negro">
              Nivel vigente
            </h3>
            <p className="mt-1 text-sm text-negro/60">
              Cambia de inmediato los tiempos que ven los clientes.
            </p>
          </div>
          <div role="radiogroup" aria-label="Nivel de demanda" className="grid grid-cols-2 gap-3">
            {(["normal", "alta"] as NivelDemanda[]).map((nivel) => {
              const activo = configuracion.demanda === nivel;
              const tiempos = tiemposPorDemanda(configuracion, nivel);
              return (
                <button
                  key={nivel}
                  type="button"
                  role="radio"
                  aria-checked={activo}
                  disabled={bloqueado}
                  onClick={() => cambiarDemanda(nivel)}
                  className={`rounded-2xl border-2 p-4 text-left transition-colors disabled:cursor-wait disabled:opacity-60 ${
                    activo
                      ? "border-rojo bg-rojo/5"
                      : "border-negro/10 bg-fondo hover:border-negro/30"
                  }`}
                >
                  <span className="block font-titulos text-lg uppercase tracking-wide text-negro">
                    {ETIQUETAS_NIVEL[nivel]}
                  </span>
                  <span className="mt-1 block text-xs text-negro/65">
                    Retiro {tiempos.retiro.texto} · Envío {tiempos.envio.texto}
                  </span>
                  {activo && (
                    <span className="mt-2 inline-block rounded-full bg-rojo px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-white">
                      {guardando === "demanda" ? "Guardando…" : "Vigente"}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <p className="text-xs text-negro/60">
            Hoy la carta muestra retiro {tiemposVigentes.retiro.texto} y envío{" "}
            {tiemposVigentes.envio.texto}.
          </p>
        </section>

        {/* Pausa */}
        <section className="space-y-4 rounded-3xl border border-negro/10 bg-white p-5 shadow-[0_20px_45px_rgba(0,0,0,0.08)]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-rojo">Pausa</p>
            <h3 className="mt-1 font-titulos text-xl uppercase tracking-wide text-negro">
              Recepción de pedidos
            </h3>
            <p className="mt-1 text-sm text-negro/60">
              Con la pausa activa el checkout no permite confirmar y la carta muestra el mensaje.
            </p>
          </div>
          <div className="flex items-center justify-between gap-4 rounded-xl bg-fondo p-3">
            <div>
              <p className="font-semibold text-negro">Pedidos pausados</p>
              <p
                className={`text-xs font-semibold uppercase tracking-wide ${
                  pausaBorrador.activa ? "text-rojo" : "text-emerald-700"
                }`}
              >
                {pausaBorrador.activa ? "Sin tomar pedidos" : "Tomando pedidos"}
                {pausaBorrador.activa !== configuracion.pedidos_pausados ? " (sin guardar)" : ""}
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={pausaBorrador.activa}
              aria-label={pausaBorrador.activa ? "Volver a tomar pedidos" : "Pausar pedidos"}
              disabled={bloqueado}
              onClick={() =>
                setPausaBorrador((actual) => ({ ...actual, activa: !actual.activa }))
              }
              className={`relative h-7 w-12 shrink-0 rounded-full border border-negro/30 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rojo disabled:cursor-wait disabled:opacity-50 ${
                pausaBorrador.activa ? "bg-rojo/70" : "bg-emerald-600"
              }`}
            >
              <span
                aria-hidden="true"
                className={`absolute left-0 top-1/2 size-5 -translate-y-1/2 rounded-full border border-negro/40 bg-white shadow transition-transform ${
                  pausaBorrador.activa ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>
          <label className="block">
            <span className="text-sm font-semibold text-negro">Mensaje para los clientes</span>
            <textarea
              value={pausaBorrador.mensaje}
              onChange={(evento) =>
                setPausaBorrador((actual) => ({ ...actual, mensaje: evento.target.value }))
              }
              maxLength={280}
              rows={3}
              disabled={bloqueado}
              className="mt-1.5 w-full rounded-2xl border border-negro/15 bg-fondo px-4 py-2.5 text-sm text-negro focus:border-rojo focus:outline-none focus:ring-2 focus:ring-rojo/20"
            />
            <span className="mt-1 block text-right text-xs text-negro/50">
              {pausaBorrador.mensaje.trim().length}/280
            </span>
          </label>
          <button
            type="button"
            onClick={guardarPausa}
            disabled={bloqueado}
            className="w-full rounded-full bg-rojo px-5 py-3 text-sm font-semibold text-white hover:bg-negro disabled:cursor-not-allowed disabled:opacity-45"
          >
            {guardando === "pausa" ? "Guardando…" : "Guardar pausa"}
          </button>
        </section>
      </div>

      <section aria-labelledby="delivery-titulo" className="space-y-4 rounded-3xl border border-negro/10 bg-white p-5 shadow-[0_20px_45px_rgba(0,0,0,0.08)]">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-rojo">Delivery</p>
          <h3 id="delivery-titulo" className="mt-1 font-titulos text-xl uppercase tracking-wide text-negro">
            Costo de envío
          </h3>
          <p className="mt-1 text-sm text-negro/60">
            Tarifa configurada: {new Intl.NumberFormat("es-UY", {
              style: "currency", currency: "UYU", minimumFractionDigits: 2,
            }).format(configuracion.costo_envio)} UYU. El retiro no tiene costo de envío.
          </p>
          <p className="mt-1 text-sm text-negro/60">
            Esta etapa guarda la tarifa. Su aplicación en el checkout se incorporará más adelante.
          </p>
        </div>
        <form
          noValidate
          onSubmit={(evento) => { evento.preventDefault(); guardarDelivery(); }}
          className="grid items-start gap-4 sm:grid-cols-2"
        >
          <label className="block">
            <span className="text-sm font-semibold text-negro">Costo de envío (UYU)</span>
            <input
              type="text"
              inputMode="decimal"
              value={costoEnvioBorrador}
              disabled={bloqueado}
              aria-invalid={errorCostoEnvio ? true : undefined}
              aria-describedby="delivery-ayuda"
              onChange={(evento) => {
                setCostoEnvioBorrador(evento.target.value);
                setErrorCostoEnvio(null);
                setMensaje(null);
              }}
              className={`mt-1.5 w-full min-w-0 rounded-2xl border bg-fondo px-4 py-2.5 text-sm text-negro focus:border-rojo focus:outline-none focus:ring-2 focus:ring-rojo/20 ${
                errorCostoEnvio ? "border-rojo" : "border-negro/15"
              }`}
            />
            <span id="delivery-ayuda" className={`mt-1 block text-xs ${errorCostoEnvio ? "text-rojo" : "text-negro/60"}`} role={errorCostoEnvio ? "alert" : undefined}>
              {errorCostoEnvio ?? `Desde 0 hasta ${COSTO_ENVIO_MAXIMO.toLocaleString("es-UY")} UYU, con hasta dos decimales. Podés usar coma o punto.`}
            </span>
          </label>
          <button
            type="submit"
            disabled={bloqueado}
            className="w-full rounded-full bg-rojo px-5 py-3 text-sm font-semibold text-white hover:bg-negro disabled:cursor-not-allowed disabled:opacity-45 sm:mt-6"
          >
            {guardando === "delivery" ? "Guardando…" : "Guardar delivery"}
          </button>
        </form>
      </section>

      {/* Tiempos estimados */}
      <details className="group rounded-3xl border border-negro/10 bg-white shadow-[0_20px_45px_rgba(0,0,0,0.08)]">
        <summary className="cursor-pointer list-none p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-rojo">Tiempos estimados</p>
          <h3 className="mt-1 font-titulos text-xl uppercase tracking-wide text-negro">
            Minutos por modalidad y nivel
            <span className="ml-2 text-sm font-normal normal-case tracking-normal text-negro/50 group-open:hidden">
              (tocá para editar)
            </span>
          </h3>
          <p className="mt-1 text-sm text-negro/60">
            Rango en minutos, de 0 a {MINUTOS_MAXIMOS}. El máximo debe ser mayor o igual al mínimo.
          </p>
        </summary>
        <div className="space-y-5 border-t border-negro/10 p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            {(
              [
                ["Retiro · demanda normal", "retiro_normal_min", "retiro_normal_max"],
                ["Envío · demanda normal", "envio_normal_min", "envio_normal_max"],
                ["Retiro · demanda alta", "retiro_alta_min", "retiro_alta_max"],
                ["Envío · demanda alta", "envio_alta_min", "envio_alta_max"],
              ] as Array<[string, ClaveRango, ClaveRango]>
            ).map(([titulo, claveMin, claveMax]) => (
              <fieldset key={claveMin} className="rounded-2xl border border-negro/10 bg-fondo/35 p-4">
                <legend className="px-1 text-sm font-semibold text-negro">{titulo}</legend>
                <div className="grid grid-cols-2 gap-3">
                  {([claveMin, claveMax] as ClaveRango[]).map((clave, indice) => (
                    <label key={clave} className="block">
                      <span className="text-xs font-semibold uppercase tracking-wide text-negro/60">
                        {indice === 0 ? "Mínimo" : "Máximo"}
                      </span>
                      <input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        max={MINUTOS_MAXIMOS}
                        step={1}
                        value={rangosBorrador[clave]}
                        disabled={bloqueado}
                        aria-invalid={erroresRangos[clave] ? true : undefined}
                        onChange={(evento) =>
                          setRangosBorrador((actual) => ({ ...actual, [clave]: evento.target.value }))
                        }
                        className={`mt-1 w-full rounded-2xl border bg-white px-4 py-2.5 text-sm text-negro focus:border-rojo focus:outline-none focus:ring-2 focus:ring-rojo/20 ${
                          erroresRangos[clave] ? "border-rojo" : "border-negro/15"
                        }`}
                      />
                      {erroresRangos[clave] && (
                        <span className="mt-1 block text-xs text-rojo">{erroresRangos[clave]}</span>
                      )}
                    </label>
                  ))}
                </div>
                <p className="mt-2 text-xs text-negro/60">
                  Se muestra como{" "}
                  <span className="font-semibold text-negro">
                    {formatearRango(
                      Number(rangosBorrador[claveMin]) || 0,
                      Number(rangosBorrador[claveMax]) || 0,
                    )}
                  </span>
                </p>
              </fieldset>
            ))}
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={guardarTiempos}
              disabled={bloqueado}
              className="rounded-full bg-rojo px-5 py-3 text-sm font-semibold text-white hover:bg-negro disabled:cursor-not-allowed disabled:opacity-45"
            >
              {guardando === "tiempos" ? "Guardando…" : "Guardar tiempos"}
            </button>
            <button
              type="button"
              onClick={() => aplicarConfiguracion(configuracion)}
              disabled={bloqueado}
              className="rounded-full border border-negro/20 px-4 py-2 text-xs font-semibold text-negro hover:bg-white disabled:opacity-40"
            >
              Descartar cambios
            </button>
          </div>
        </div>
      </details>
    </div>
  );
}
