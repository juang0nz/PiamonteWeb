import Link from "next/link";
import { MarcaPiamonte } from "@/components/branding/MarcaPiamonte";
import { cerrarSesionAdmin } from "@/lib/admin/auth";
import type { RolAccesoAdmin } from "@/lib/admin/auth";

export function EncabezadoAdmin({
  seccion,
  rol,
  esSuperAdmin = false,
}: {
  seccion:
    | "pedidos"
    | "clientes"
    | "disponibilidad"
    | "catalogo"
    | "empleados";
  rol: RolAccesoAdmin | null;
  esSuperAdmin?: boolean;
}) {
  const puedeAdministrarComercio =
    rol === "owner" || rol === "admin" || rol === "super_admin";
  const subtitulo =
    seccion === "pedidos"
      ? "Gestión de pedidos"
      : seccion === "clientes"
        ? "Clientes"
        : seccion === "catalogo"
          ? "Catálogo"
          : seccion === "empleados"
            ? "Empleados"
            : "Disponibilidad";
  return (
    <header className="border-b border-crema/10 bg-negro text-crema">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-4 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <div>
          <MarcaPiamonte tamano="md" mostrarSubtitulo subtitulo={subtitulo} />
          {rol && <p className="mt-1 text-xs uppercase tracking-wider text-crema/70">Rol: {rol}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <nav aria-label="Secciones administrativas" className="flex flex-wrap gap-2 text-sm">
            <Link href="/admin" aria-current={seccion === "pedidos" ? "page" : undefined}
              className={`rounded-full px-4 py-2 ${seccion === "pedidos" ? "bg-crema text-negro" : "border border-crema/25 hover:bg-crema/10"}`}>Pedidos</Link>
            {puedeAdministrarComercio && (
              <>
                <Link href="/admin/catalogo" aria-current={seccion === "catalogo" ? "page" : undefined}
                  className={`rounded-full px-4 py-2 ${seccion === "catalogo" ? "bg-crema text-negro" : "border border-crema/25 hover:bg-crema/10"}`}>Catálogo</Link>
                <Link href="/admin/disponibilidad" aria-current={seccion === "disponibilidad" ? "page" : undefined}
                  className={`rounded-full px-4 py-2 ${seccion === "disponibilidad" ? "bg-crema text-negro" : "border border-crema/25 hover:bg-crema/10"}`}>Disponibilidad</Link>
                <Link href="/admin/clientes" aria-current={seccion === "clientes" ? "page" : undefined}
                  className={`rounded-full px-4 py-2 ${seccion === "clientes" ? "bg-crema text-negro" : "border border-crema/25 hover:bg-crema/10"}`}>Clientes</Link>
                <Link href="/admin/empleados" aria-current={seccion === "empleados" ? "page" : undefined}
                  className={`rounded-full px-4 py-2 ${seccion === "empleados" ? "bg-crema text-negro" : "border border-crema/25 hover:bg-crema/10"}`}>Empleados</Link>
              </>
            )}
          </nav>
          {esSuperAdmin && (
            <Link
              href="/super-admin"
              className="rounded-full border border-crema/25 bg-crema/10 px-4 py-2 text-sm font-semibold text-crema hover:bg-crema hover:text-negro"
            >
              Volver a Super Admin
            </Link>
          )}
          <form action={cerrarSesionAdmin}>
            <button type="submit" className="rounded-full bg-rojo px-4 py-2 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(197,40,40,0.35)] hover:bg-crema hover:text-negro">Cerrar sesión</button>
          </form>
        </div>
      </div>
    </header>
  );
}
