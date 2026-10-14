"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";

type CredencialEnlace = {
  tipo: string;
  tokenHash: string | null;
  accessToken: string | null;
  refreshToken: string | null;
};

export function FormularioAccesoEmpleado() {
  const credencial = useRef<CredencialEnlace | null>(null);
  const [listo, setListo] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);

  useEffect(() => {
    const parametros = new URLSearchParams(window.location.hash.slice(1));
    if (!credencial.current) {
      credencial.current = {
        tipo: parametros.get("type") ?? "",
        tokenHash: parametros.get("token_hash"),
        accessToken: parametros.get("access_token"),
        refreshToken: parametros.get("refresh_token"),
      };
    }
    // Los secretos del enlace quedan solo en memoria, nunca en el historial ni en logs del servidor.
    window.history.replaceState(null, "", window.location.pathname);
    const temporizador = window.setTimeout(() => {
      const enlace = credencial.current;
      if (!enlace || !["invite", "recovery"].includes(enlace.tipo) ||
          !(enlace.tokenHash || (enlace.accessToken && enlace.refreshToken))) {
        setError("El enlace no es válido o venció. Pedí uno nuevo al administrador.");
      } else {
        setListo(true);
      }
    }, 0);
    return () => window.clearTimeout(temporizador);
  }, []);

  async function guardar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (enviando || !credencial.current) return;
    const formulario = evento.currentTarget;
    const datos = new FormData(formulario);
    const password = String(datos.get("password") ?? "");
    const confirmacion = String(datos.get("confirmacion") ?? "");
    if (password !== confirmacion) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    setEnviando(true);
    setError(null);
    try {
      const respuesta = await fetch("/admin/acceso/confirmar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "omit",
        cache: "no-store",
        body: JSON.stringify({ ...credencial.current, password, confirmacion }),
      });
      const cuerpo: { error?: string; mensaje?: string } = await respuesta.json();
      if (!respuesta.ok || !cuerpo.mensaje) {
        throw new Error(cuerpo.error ?? "No pudimos guardar la contraseña.");
      }
      formulario.reset();
      credencial.current = null;
      setListo(false);
      setMensaje(cuerpo.mensaje);
    } catch (errorDesconocido) {
      setError(errorDesconocido instanceof Error
        ? errorDesconocido.message : "No pudimos guardar la contraseña.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="mt-5">
      {error && <p role="alert" className="mb-4 rounded-xl bg-rojo/10 p-3 text-sm text-rojo">{error}</p>}
      {mensaje && <p role="status" className="mb-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{mensaje}</p>}
      {listo && (
        <form onSubmit={guardar} className="space-y-4">
          <label className="block text-sm font-semibold text-negro">
            Nueva contraseña
            <input name="password" type="password" autoComplete="new-password" minLength={8} maxLength={72}
              required disabled={enviando}
              className="mt-1.5 w-full rounded-xl border border-negro/20 px-4 py-3 focus:border-rojo focus:outline-none" />
          </label>
          <label className="block text-sm font-semibold text-negro">
            Repetir contraseña
            <input name="confirmacion" type="password" autoComplete="new-password" minLength={8} maxLength={72}
              required disabled={enviando}
              className="mt-1.5 w-full rounded-xl border border-negro/20 px-4 py-3 focus:border-rojo focus:outline-none" />
          </label>
          <p className="text-xs text-negro/60">Usá una contraseña única de al menos 8 caracteres.</p>
          <button type="submit" disabled={enviando}
            className="w-full rounded-full bg-rojo px-5 py-3 font-semibold text-white hover:bg-negro disabled:opacity-50">
            {enviando ? "Guardando…" : "Guardar contraseña"}
          </button>
        </form>
      )}
      <Link href="/admin/login" className="mt-5 inline-block text-sm font-semibold text-rojo underline">
        Ir al ingreso administrativo
      </Link>
    </div>
  );
}
