import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { MarcaPiamonte } from "@/components/branding/MarcaPiamonte";
import {
  iniciarSesionAdmin,
  leerErrorLogin,
  obtenerEstadoAccesoAdmin,
} from "@/lib/admin/auth";

export const metadata: Metadata = {
  title: "Piamonte | Ingreso administración",
};

export default async function PaginaLoginAdmin({
  searchParams,
}: {
  searchParams: Promise<{ [clave: string]: string | string[] | undefined }>;
}) {
  const estado = await obtenerEstadoAccesoAdmin();
  const params = await searchParams;
  const errorParam =
    typeof params.error === "string" ? params.error : undefined;
  const mensajeError = leerErrorLogin(errorParam);

  if (estado.autenticado && estado.autorizado) {
    redirect("/admin");
  }

  return (
    <div className="min-h-full bg-gradient-to-b from-[#fff3ee] via-[#fff8f2] to-[#fffdf8] px-4 py-10 sm:px-8">
      <div className="mx-auto max-w-md overflow-hidden rounded-3xl border border-negro/10 bg-white shadow-[0_24px_55px_rgba(0,0,0,0.12)]">
        <div className="bg-negro px-6 py-5 text-crema">
          <MarcaPiamonte tamano="md" mostrarSubtitulo subtitulo="Ingreso administración" />
          <p className="mt-2 text-sm text-crema/75">Gestión de pedidos</p>
        </div>

        <div className="p-6">
          <p className="mb-4 rounded-xl bg-rojo/10 px-3 py-2 text-xs text-rojo">
            Acceso solo para personal autorizado del comercio.
          </p>

          {estado.autenticado && (
            <p className="mb-4 rounded-xl bg-negro/5 px-3 py-2 text-xs text-negro/70">
              Ya existe una sesión iniciada. Si tu usuario tiene permisos, al
              enviar este formulario accederás al panel.
            </p>
          )}

          {mensajeError && (
            <p className="mb-4 rounded-xl bg-rojo/10 px-3 py-2 text-sm text-rojo">
              {mensajeError}
            </p>
          )}

          <form action={iniciarSesionAdmin} className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="mb-1.5 block text-sm font-semibold text-negro"
              >
                Correo electrónico
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="w-full rounded-xl border border-negro/20 bg-white px-4 py-3 text-sm text-[#171717] placeholder:text-neutral-500 outline-none focus:border-rojo focus-visible:ring-2 focus-visible:ring-rojo/30"
                placeholder="admin@piamonte.com"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-1.5 block text-sm font-semibold text-negro"
              >
                Contraseña
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="w-full rounded-xl border border-negro/20 bg-white px-4 py-3 text-sm text-[#171717] placeholder:text-neutral-500 outline-none focus:border-rojo focus-visible:ring-2 focus-visible:ring-rojo/30"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              className="w-full rounded-full bg-rojo px-5 py-3 font-semibold text-white hover:bg-negro"
            >
              Ingresar
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
