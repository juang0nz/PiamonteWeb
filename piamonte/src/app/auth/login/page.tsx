import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { MarcoCuentaCliente } from "@/components/clientes/MarcoCuentaCliente";
import { iniciarSesionCliente } from "@/lib/clientes/cuenta";
import { obtenerComercioActual } from "@/lib/comercio/contexto";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Ingresar a mi cuenta" };

export default async function PaginaLoginCliente({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const supabase = await createClient();
  const [{ data }, comercio, parametros] = await Promise.all([
    supabase.auth.getUser(),
    obtenerComercioActual(),
    searchParams,
  ]);
  if (data.user) redirect("/mi-cuenta");
  if (!comercio) redirect("/");

  const error =
    parametros.error === "credenciales_invalidas"
      ? "Correo o contraseña inválidos."
      : parametros.error === "callback"
        ? "No pudimos confirmar la cuenta. Solicitá un nuevo enlace desde Supabase."
        : null;

  return (
    <MarcoCuentaCliente
      nombreComercio={comercio.nombre}
      titulo="Mi cuenta"
      descripcion="Ingresá para administrar tus datos y direcciones guardadas."
    >
      <div className="mx-auto max-w-lg rounded-3xl border border-negro/10 bg-white p-6 shadow-[0_20px_45px_rgba(0,0,0,0.08)]">
        {error && (
          <p className="mb-5 rounded-xl bg-rojo/10 px-4 py-3 text-sm text-rojo">
            {error}
          </p>
        )}
        <form action={iniciarSesionCliente} className="space-y-4">
          <label className="block">
            <span className="text-sm font-semibold">Correo electrónico</span>
            <input
              name="email"
              type="email"
              autoComplete="email"
              required
              maxLength={254}
              className="mt-1.5 w-full rounded-2xl border border-negro/15 bg-fondo px-4 py-3 text-sm outline-none focus:border-rojo focus:ring-2 focus:ring-rojo/20"
            />
          </label>
          <label className="block">
            <span className="text-sm font-semibold">Contraseña</span>
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
              maxLength={72}
              className="mt-1.5 w-full rounded-2xl border border-negro/15 bg-fondo px-4 py-3 text-sm outline-none focus:border-rojo focus:ring-2 focus:ring-rojo/20"
            />
          </label>
          <button
            type="submit"
            className="w-full rounded-full bg-rojo px-5 py-3 font-semibold text-white hover:bg-negro"
          >
            Ingresar
          </button>
        </form>
        <p className="mt-5 text-center text-sm text-negro/65">
          ¿Todavía no tenés una cuenta?{" "}
          <Link href="/auth/registro" className="font-semibold text-rojo">
            Registrate
          </Link>
        </p>
      </div>
    </MarcoCuentaCliente>
  );
}
