import Link from "next/link";
import { esSuperAdminActivo } from "@/lib/admin/auth";

export default async function LayoutSuperAdminProtegido({
  children,
}: {
  children: React.ReactNode;
}) {
  const autorizado = await esSuperAdminActivo();

  if (!autorizado) {
    return (
      <div className="min-h-full bg-fondo px-4 py-10 sm:px-8">
        <div className="mx-auto max-w-xl rounded-3xl border border-negro/10 bg-white p-6 text-center shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-rojo">
            Acceso restringido
          </p>
          <h1 className="mt-2 font-titulos text-3xl uppercase tracking-wide text-negro">
            Solo para Super Admin
          </h1>
          <p className="mt-3 text-sm text-negro/70">
            Tu sesión no tiene permisos globales activos para administrar la
            plataforma.
          </p>
          <Link
            href="/admin/login"
            className="mt-6 inline-flex rounded-full bg-rojo px-5 py-2.5 text-sm font-semibold text-white hover:bg-negro"
          >
            Iniciar otra sesión
          </Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
