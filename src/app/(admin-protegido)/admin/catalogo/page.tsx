import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { EncabezadoAdmin } from "@/components/admin/EncabezadoAdmin";
import { PanelCatalogoAdmin } from "@/components/admin/PanelCatalogoAdmin";
import { obtenerEstadoAccesoAdmin } from "@/lib/admin/auth";

export const metadata: Metadata = { title: "Piamonte | Catálogo" };

export default async function PaginaCatalogoAdmin() {
  const acceso = await obtenerEstadoAccesoAdmin();
  if (acceso.autenticado && acceso.autorizado && acceso.rol === "empleado") {
    redirect("/admin");
  }
  const rol = acceso.autenticado && acceso.autorizado ? acceso.rol : null;
  const esSuperAdmin =
    acceso.autenticado && acceso.autorizado ? acceso.esSuperAdmin : false;

  return (
    <div className="min-h-full bg-gradient-to-b from-[#fff3ee] via-[#fff8f2] to-[#fffdf8]">
      <EncabezadoAdmin
        seccion="catalogo"
        rol={rol}
        esSuperAdmin={esSuperAdmin}
      />
      <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-8 lg:py-8">
        <PanelCatalogoAdmin esSuperAdmin={esSuperAdmin} />
      </main>
    </div>
  );
}
