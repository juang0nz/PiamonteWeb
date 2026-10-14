"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";

type Empleado = {
  userId: string;
  email: string;
  activo: boolean;
  acceso: {
    cuentaExiste: boolean;
    correoConfirmado: boolean;
    invitacionEnviadaEn: string | null;
    recuperacionEnviadaEn: string | null;
    ultimoIngresoEn: string | null;
    bloqueado: boolean;
  };
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

  function fecha(valor: string) {
    return new Date(valor).toLocaleString("es-UY", { timeZone: "America/Montevideo" });
  }

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

  async function gestionarAcceso(empleado: Empleado, tipo: "invitacion" | "recuperacion") {
    if (actualizando) return;
    if (!window.confirm(
      `¿Enviar ${tipo === "invitacion" ? "una invitación" : "un enlace para restablecer la contraseña"} a ${empleado.email}?`,
    )) return;
    setActualizando(empleado.userId);
    setError(null);
    setMensaje(null);
    try {
      const respuesta = await fetch("/api/admin/empleados/acceso", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ userId: empleado.userId, tipo, operacionId: crypto.randomUUID() }),
      });
      const cuerpo: { error?: string; mensaje?: string } = await respuesta.json();
      if (!respuesta.ok || !cuerpo.mensaje) {
        throw new Error(cuerpo.error ?? "No pudimos procesar el correo de acceso.");
      }
      setMensaje(cuerpo.mensaje);
      await cargar();
    } catch (errorDesconocido) {
      setError(errorDesconocido instanceof Error
        ? errorDesconocido.message : "No pudimos procesar el correo de acceso.");
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
        <p className="mt-2 text-sm text-negro/60">
          El vínculo habilita los permisos del comercio. La confirmación del correo
          y los ingresos se verifican por separado. Un envío no prueba recepción
          ni aceptación. Las cuentas compartidas o con otros privilegios no admiten estas acciones.
        </p>

        {mensaje && (
          <p role="status" className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            {mensaje}
          </p>
        )}
        {error && (
          <p role="alert" className="mt-4 rounded-xl bg-rojo/10 px-4 py-3 text-sm text-rojo">
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
                className="space-y-4 p-4"
              >
                <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-negro">
                    {empleado.email}
                  </p>
                  <p
                    className={`mt-1 text-xs font-bold uppercase tracking-wide ${
                      empleado.activo ? "text-emerald-700" : "text-rojo"
                    }`}
                  >
                    {empleado.activo ? "Vínculo habilitado" : "Vínculo deshabilitado"}
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
                </div>
                <section aria-label={`Acceso de ${empleado.email}`} className="rounded-xl bg-fondo p-3">
                  <h3 className="text-sm font-bold text-negro">Acceso</h3>
                  <div className="mt-2 space-y-1 text-xs text-negro/70">
                    <p>{!empleado.acceso.cuentaExiste ? "Cuenta de Auth no disponible."
                      : empleado.acceso.bloqueado ? "Cuenta bloqueada en Supabase Auth."
                      : empleado.acceso.correoConfirmado ? "Correo confirmado."
                      : "Correo pendiente de confirmación."}</p>
                    {empleado.acceso.invitacionEnviadaEn && (
                      <p>Invitación registrada en Auth: {fecha(empleado.acceso.invitacionEnviadaEn)}.</p>
                    )}
                    {empleado.acceso.recuperacionEnviadaEn && (
                      <p>Recuperación registrada en Auth: {fecha(empleado.acceso.recuperacionEnviadaEn)}.</p>
                    )}
                    <p>{empleado.acceso.ultimoIngresoEn
                      ? `Último ingreso a la cuenta: ${fecha(empleado.acceso.ultimoIngresoEn)}.`
                      : "Sin ingresos registrados en Auth."}</p>
                    <p>La confirmación del correo no garantiza que ya haya una contraseña configurada.</p>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button"
                      disabled={actualizando !== null || !empleado.activo || !empleado.acceso.cuentaExiste ||
                        empleado.acceso.bloqueado || empleado.acceso.correoConfirmado}
                      onClick={() => void gestionarAcceso(empleado, "invitacion")}
                      className="rounded-full border border-negro/20 px-4 py-2 text-xs font-semibold text-negro hover:bg-white disabled:opacity-40">
                      {empleado.acceso.invitacionEnviadaEn ? "Reenviar invitación" : "Enviar invitación"}
                    </button>
                    <button type="button"
                      disabled={actualizando !== null || !empleado.activo ||
                        !empleado.acceso.cuentaExiste || empleado.acceso.bloqueado}
                      onClick={() => void gestionarAcceso(empleado, "recuperacion")}
                      className="rounded-full bg-rojo px-4 py-2 text-xs font-semibold text-white hover:bg-negro disabled:opacity-40">
                      Restablecer contraseña
                    </button>
                  </div>
                  {actualizando === empleado.userId && <p role="status" className="mt-2 text-xs text-negro/60">Procesando…</p>}
                </section>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
