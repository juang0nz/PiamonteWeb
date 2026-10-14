import { redirect } from "next/navigation";
import {
  cerrarSesionAdmin,
  mensajeNoAutorizado,
  obtenerEstadoAccesoAdmin,
} from "@/lib/admin/auth";

export default async function LayoutAdminProtegido({
  children,
}: {
  children: React.ReactNode;
}) {
  const estado = await obtenerEstadoAccesoAdmin();

  if (!estado.autenticado) {
    redirect("/admin/login");
  }

  if (!estado.autorizado) {
    return (
      <div className="min-h-full bg-fondo px-4 py-10 sm:px-8">
        <div className="mx-auto max-w-xl rounded-3xl border border-negro/10 bg-white p-6 text-center shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-rojo">
            Acceso administrativo restringido
          </p>
          <h1 className="mt-2 font-titulos text-3xl uppercase tracking-wide text-negro">
            Sin autorización para Piamonte
          </h1>
          <p className="mt-3 text-sm text-negro/70">
            {mensajeNoAutorizado(estado.motivo)}
          </p>
          <form action={cerrarSesionAdmin} className="mt-6">
            <button
              type="submit"
              className="rounded-full bg-rojo px-5 py-2.5 text-sm font-semibold text-white hover:bg-negro"
            >
              Cerrar sesión
            </button>
          </form>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

