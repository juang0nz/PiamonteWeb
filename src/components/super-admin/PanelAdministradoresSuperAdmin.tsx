"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";

type Comercio = {
  id: string;
  nombre: string;
  activo: boolean;
};

type Administrador = {
  userId: string;
  comercioId: string;
  comercioNombre: string;
  email: string;
  rol: string;
  activo: boolean;
};

type RespuestaListado = {
  comercios?: Comercio[];
  administradores?: Administrador[];
  error?: string;
};

export function PanelAdministradoresSuperAdmin() {
  const [comercios, setComercios] = useState<Comercio[]>([]);
  const [administradores, setAdministradores] = useState<Administrador[]>([]);
  const [email, setEmail] = useState("");
  const [comercioId, setComercioId] = useState("");
  const [cargando, setCargando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [actualizando, setActualizando] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setError(null);
    try {
      const respuesta = await fetch("/api/super-admin/administradores", {
        credentials: "same-origin",
        cache: "no-store",
      });
      const cuerpo = (await respuesta.json().catch(() => null)) as
        | RespuestaListado
        | null;
      if (!respuesta.ok) {
        throw new Error(
          cuerpo?.error ?? "No pudimos cargar los administradores.",
        );
      }
      const siguientesComercios = cuerpo?.comercios ?? [];
      setComercios(siguientesComercios);
      setAdministradores(cuerpo?.administradores ?? []);
      setComercioId((actual) => actual || siguientesComercios[0]?.id || "");
    } catch (errorDesconocido) {
      setError(
        errorDesconocido instanceof Error
          ? errorDesconocido.message
          : "No pudimos cargar los administradores.",
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
      const respuesta = await fetch("/api/super-admin/administradores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          email,
          comercioId,
          operacionId: crypto.randomUUID(),
        }),
      });
      const cuerpo = (await respuesta.json().catch(() => null)) as
        | { error?: string; mensaje?: string }
        | null;
      if (!respuesta.ok) {
        throw new Error(cuerpo?.error ?? "No pudimos enviar la invitación.");
      }
      setEmail("");
      setMensaje(cuerpo?.mensaje ?? "La invitación fue enviada.");
      await cargar();
    } catch (errorDesconocido) {
      setError(
        errorDesconocido instanceof Error
          ? errorDesconocido.message
          : "No pudimos enviar la invitación.",
      );
    } finally {
      setEnviando(false);
    }
  }

  async function cambiarAcceso(administrador: Administrador) {
    const clave = `${administrador.userId}:${administrador.comercioId}`;
    if (actualizando) return;
    setActualizando(clave);
    setError(null);
    setMensaje(null);
    try {
      const respuesta = await fetch("/api/super-admin/administradores", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          userId: administrador.userId,
          comercioId: administrador.comercioId,
          activo: !administrador.activo,
          operacionId: crypto.randomUUID(),
        }),
      });
      const cuerpo = (await respuesta.json().catch(() => null)) as
        | { error?: string }
        | null;
      if (!respuesta.ok) {
        throw new Error(cuerpo?.error ?? "No pudimos actualizar el acceso.");
      }
      setAdministradores((actuales) =>
        actuales.map((item) =>
          item.userId === administrador.userId &&
          item.comercioId === administrador.comercioId
            ? { ...item, activo: !administrador.activo }
            : item,
        ),
      );
      setMensaje(
        `${administrador.email} quedó ${
          administrador.activo ? "sin acceso" : "activo"
        } en ${administrador.comercioNombre}.`,
      );
    } catch (errorDesconocido) {
      setError(
        errorDesconocido instanceof Error
          ? errorDesconocido.message
          : "No pudimos actualizar el acceso.",
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
          Invitar administrador
        </h2>
        <p className="mt-2 text-sm text-negro/60">
          Se enviará una invitación de Supabase y se asignará el rol de
          administrador del comercio.
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
              placeholder="administrador@ejemplo.com"
              className="mt-1.5 w-full rounded-2xl border border-negro/15 bg-fondo px-4 py-2.5 text-sm text-negro focus:border-rojo focus:outline-none focus:ring-2 focus:ring-rojo/20"
            />
          </label>

          <label className="block">
            <span className="text-sm font-semibold text-negro">Comercio</span>
            <select
              value={comercioId}
              onChange={(evento) => setComercioId(evento.target.value)}
              required
              className="mt-1.5 w-full rounded-2xl border border-negro/15 bg-fondo px-4 py-2.5 text-sm text-negro focus:border-rojo focus:outline-none focus:ring-2 focus:ring-rojo/20"
            >
              {comercios.map((comercio) => (
                <option key={comercio.id} value={comercio.id}>
                  {comercio.nombre}
                  {comercio.activo ? "" : " (inactivo)"}
                </option>
              ))}
            </select>
          </label>

          <div>
            <p className="text-sm font-semibold text-negro">Rol</p>
            <p className="mt-1.5 rounded-2xl border border-negro/10 bg-negro/5 px-4 py-2.5 text-sm text-negro/65">
              Administrador
            </p>
          </div>

          <button
            type="submit"
            disabled={enviando || !email || !comercioId}
            className="w-full rounded-full bg-rojo px-5 py-3 text-sm font-semibold text-white hover:bg-negro disabled:cursor-not-allowed disabled:opacity-45"
          >
            {enviando ? "Enviando…" : "Enviar invitación"}
          </button>
        </form>
      </section>

      <section className="rounded-3xl border border-negro/10 bg-white p-5 shadow-[0_20px_45px_rgba(0,0,0,0.08)]">
        <p className="text-xs font-semibold uppercase tracking-wider text-rojo">
          Accesos
        </p>
        <h2 className="mt-1 font-titulos text-2xl uppercase tracking-wide text-negro">
          Administradores existentes
        </h2>

        {mensaje && (
          <p className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {mensaje}
          </p>
        )}
        {error && (
          <p className="mt-4 rounded-xl bg-rojo/10 px-4 py-3 text-sm text-rojo">
            {error}
          </p>
        )}

        {cargando ? (
          <p className="mt-5 text-sm text-negro/60">
            Cargando administradores…
          </p>
        ) : administradores.length === 0 ? (
          <p className="mt-5 rounded-2xl bg-fondo p-4 text-sm text-negro/60">
            No hay administradores asignados.
          </p>
        ) : (
          <ul className="mt-5 divide-y divide-negro/10 overflow-hidden rounded-2xl border border-negro/10">
            {administradores.map((administrador) => {
              const clave = `${administrador.userId}:${administrador.comercioId}`;
              return (
                <li
                  key={clave}
                  className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-negro">
                      {administrador.email}
                    </p>
                    <p className="mt-1 text-sm text-negro/60">
                      {administrador.comercioNombre} · Rol:{" "}
                      <span className="font-semibold">{administrador.rol}</span>
                    </p>
                    <p
                      className={`mt-1 text-xs font-bold uppercase tracking-wide ${
                        administrador.activo
                          ? "text-emerald-700"
                          : "text-rojo"
                      }`}
                    >
                      {administrador.activo ? "Activo" : "Inactivo"}
                    </p>
                  </div>

                  <button
                    type="button"
                    role="switch"
                    aria-checked={administrador.activo}
                    aria-label={`${
                      administrador.activo ? "Desactivar" : "Activar"
                    } acceso de ${administrador.email} a ${administrador.comercioNombre}`}
                    disabled={actualizando !== null}
                    onClick={() => void cambiarAcceso(administrador)}
                    className={`relative h-7 w-12 shrink-0 rounded-full border border-negro/30 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rojo disabled:cursor-wait disabled:opacity-50 ${
                      administrador.activo ? "bg-emerald-600" : "bg-rojo/60"
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className={`absolute left-0 top-1/2 size-5 -translate-y-1/2 rounded-full border border-negro/40 bg-white shadow transition-transform ${
                        administrador.activo
                          ? "translate-x-6"
                          : "translate-x-1"
                      }`}
                    />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
