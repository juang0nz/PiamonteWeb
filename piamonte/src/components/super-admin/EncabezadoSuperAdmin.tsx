import Link from "next/link";
import { cerrarSesionAdmin } from "@/lib/admin/auth";

export function EncabezadoSuperAdmin({
  seccion = "comercios",
}: {
  seccion?: "comercios" | "administradores" | "auditoria";
}) {
  return (
    <header className="border-b border-crema/10 bg-negro text-crema">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-5 sm:px-8 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <Link
            href="/super-admin"
            className="inline-flex min-w-0 flex-col"
          >
            <span className="font-titulos text-xl uppercase tracking-[0.18em] text-crema">
              Plataforma gastronómica
            </span>
            <span className="text-xs uppercase tracking-[0.2em] text-crema/70">
              Administración global
            </span>
          </Link>
          <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-rojo">
            Super Admin
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <nav
            aria-label="Secciones de Super Admin"
            className="flex flex-wrap gap-2 text-sm"
          >
            <Link
              href="/super-admin"
              aria-current={seccion === "comercios" ? "page" : undefined}
              className={`rounded-full px-4 py-2 ${
                seccion === "comercios"
                  ? "bg-crema font-semibold text-negro"
                  : "border border-crema/25 hover:bg-crema/10"
              }`}
            >
              Comercios
            </Link>
            <Link
              href="/super-admin/administradores"
              aria-current={
                seccion === "administradores" ? "page" : undefined
              }
              className={`rounded-full px-4 py-2 ${
                seccion === "administradores"
                  ? "bg-crema font-semibold text-negro"
                  : "border border-crema/25 hover:bg-crema/10"
              }`}
            >
              Administradores
            </Link>
            <Link
              href="/super-admin/auditoria"
              aria-current={seccion === "auditoria" ? "page" : undefined}
              className={`rounded-full px-4 py-2 ${
                seccion === "auditoria"
                  ? "bg-crema font-semibold text-negro"
                  : "border border-crema/25 hover:bg-crema/10"
              }`}
            >
              Auditoría
            </Link>
          </nav>

          <form action={cerrarSesionAdmin}>
            <button
              type="submit"
              className="rounded-full bg-rojo px-4 py-2 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(197,40,40,0.35)] hover:bg-crema hover:text-negro"
            >
              Cerrar sesión
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
