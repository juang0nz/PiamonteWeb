"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";

type Empleado = {
  userId: string;
  email: string;
  activo: boolean;
};

type RespuestaListado = {
  empleados?: Empleado[];
  error?: string;
};

export function PanelEmpleadosAdmin() {
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [email, setEmail] = useState("");
  const [cargando, setCargando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [actualizando, setActualizando] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setError(null);
    try {
      const respuesta = await fetch("/api/admin/empleados", {
        credentials: "same-origin",
        cache: "no-store",
      });
      const cuerpo = (await respuesta.json().catch(() => null)) as
        | RespuestaListado
        | null;
      if (!respuesta.ok) {
        throw new Error(cuerpo?.error ?? "No pudimos cargar los empleados.");
      }
      setEmpleados(cuerpo?.empleados ?? []);
    } catch (errorDesconocido) {
      setError(
        errorDesconocido instanceof Error
          ? errorDesconocido.message
          : "No pudimos cargar los empleados.",
      );
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    const temporizador = window.setTimeout(() => void cargar(), 0);
    return () => window.clearTimeout(temporizador);
  }, [cargar]);

  async function invitar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (enviando) return;
    setEnviando(true);
    setError(null);
    setMensaje(null);
    try {
      const respuesta = await fetch("/api/admin/empleados", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          email,
          operacionId: crypto.randomUUID(),
        }),
      });
      const cuerpo = (await respuesta.json().catch(() => null)) as
        | { error?: string; mensaje?: string }
        | null;
      if (!respuesta.ok) {
        throw new Error(cuerpo?.error ?? "No pudimos invitar al empleado.");
      }
      setEmail("");
      setMensaje(cuerpo?.mensaje ?? "Invitación procesada correctamente.");
      await cargar();
    } catch (errorDesconocido) {
      setError(
        errorDesconocido instanceof Error
          ? errorDesconocido.message
          : "No pudimos invitar al empleado.",
      );
    } finally {
      setEnviando(false);
    }
  }

  async function cambiarEstado(empleado: Empleado) {
    if (actualizando) return;
    setActualizando(empleado.userId);
    setError(null);
    setMensaje(null);
    try {
      const respuesta = await fetch("/api/admin/empleados", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          userId: empleado.userId,
          activo: !empleado.activo,
          operacionId: crypto.randomUUID(),
        }),
      });
      const cuerpo = (await respuesta.json().catch(() => null)) as
        | { error?: string; mensaje?: string }
        | null;
      if (!respuesta.ok) {
        throw new Error(cuerpo?.error ?? "No pudimos actualizar al empleado.");
      }
      setEmpleados((actuales) =>
        actuales.map((item) =>
          item.userId === empleado.userId
            ? { ...item, activo: !empleado.activo }
            : item,
        ),
      );
      setMensaje(
        cuerpo?.mensaje ??
          `El empleado quedó ${empleado.activo ? "inactivo" : "activo"}.`,
      );
    } catch (errorDesconocido) {
      setError(
        errorDesconocido instanceof Error
          ? errorDesconocido.message
          : "No pudimos actualizar al empleado.",
      );
    } finally {
      setActualizando(null);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.4fr)]">
      <section className="self-start rounded-3xl border border-negro/10 bg-white p-5 shadow-[0_20px_45px_rgba(0,0,0,0.08)]">
        <p className="text-xs font-semibold uppercase tracking-wider text-rojo">
          Nuevo acceso
        </p>
        <h2 className="mt-1 font-titulos text-2xl uppercase tracking-wide text-negro">
          Invitar empleado
        </h2>
        <p className="mt-2 text-sm text-negro/60">
          El acceso quedará limitado a la gestión operativa de pedidos de este
          comercio.
        </p>

        <form onSubmit={invitar} className="mt-5 space-y-4">
          <label className="block">
            <span className="text-sm font-semibold text-negro">Correo</span>
            <input
              type="email"
              value={email}
              onChange={(evento) => setEmail(evento.target.value)}
              maxLength={254}
              required
              autoComplete="email"
              placeholder="empleado@ejemplo.com"
              className="mt-1.5 w-full rounded-2xl border border-negro/15 bg-fondo px-4 py-2.5 text-sm text-negro focus:border-rojo focus:outline-none focus:ring-2 focus:ring-rojo/20"
            />
          </label>

          <div>
            <p className="text-sm font-semibold text-negro">Rol</p>
            <p className="mt-1.5 rounded-2xl border border-negro/10 bg-negro/5 px-4 py-2.5 text-sm text-negro/65">
              Empleado
            </p>
          </div>

          <button
            type="submit"
            disabled={enviando || !email}
            className="w-full rounded-full bg-rojo px-5 py-3 text-sm font-semibold text-white hover:bg-negro disabled:cursor-not-allowed disabled:opacity-45"
          >
            {enviando ? "Enviando…" : "Enviar invitación"}
          </button>
        </form>
      </section>

      <section className="rounded-3xl border border-negro/10 bg-white p-5 shadow-[0_20px_45px_rgba(0,0,0,0.08)]">
        <p className="text-xs font-semibold uppercase tracking-wider text-rojo">
          Equipo
        </p>
        <h2 className="mt-1 font-titulos text-2xl uppercase tracking-wide text-negro">
          Empleados del comercio
        </h2>

        {mensaje && (
          <p className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            {mensaje}
          </p>
        )}
        {error && (
          <p className="mt-4 rounded-xl bg-rojo/10 px-4 py-3 text-sm text-rojo">
            {error}
          </p>
        )}

        {cargando ? (
          <p className="mt-5 text-sm text-negro/60">Cargando empleados…</p>
        ) : empleados.length === 0 ? (
          <p className="mt-5 rounded-2xl bg-fondo p-4 text-sm text-negro/60">
            No hay empleados asignados.
          </p>
        ) : (
          <ul className="mt-5 divide-y divide-negro/10 overflow-hidden rounded-2xl border border-negro/10">
            {empleados.map((empleado) => (
              <li
                key={empleado.userId}
                className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold text-negro">
                    {empleado.email}
                  </p>
                  <p
                    className={`mt-1 text-xs font-bold uppercase tracking-wide ${
                      empleado.activo ? "text-emerald-700" : "text-rojo"
                    }`}
                  >
                    {empleado.activo ? "Activo" : "Inactivo"}
                  </p>
                </div>

                <button
                  type="button"
                  role="switch"
                  aria-checked={empleado.activo}
                  aria-label={`${
                    empleado.activo ? "Desactivar" : "Activar"
                  } acceso de ${empleado.email}`}
                  disabled={actualizando !== null}
                  onClick={() => void cambiarEstado(empleado)}
                  className={`relative h-7 w-12 shrink-0 rounded-full border border-negro/30 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rojo disabled:cursor-wait disabled:opacity-50 ${
                    empleado.activo ? "bg-emerald-600" : "bg-rojo/60"
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`absolute left-0 top-1/2 size-5 -translate-y-1/2 rounded-full border border-negro/40 bg-white shadow transition-transform ${
                      empleado.activo ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
