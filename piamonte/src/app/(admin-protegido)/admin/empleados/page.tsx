import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { EncabezadoAdmin } from "@/components/admin/EncabezadoAdmin";
import { PanelEmpleadosAdmin } from "@/components/admin/PanelEmpleadosAdmin";
import { obtenerEstadoAccesoAdmin } from "@/lib/admin/auth";

export const metadata: Metadata = { title: "Piamonte | Empleados" };

export default async function PaginaEmpleadosAdmin() {
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
        seccion="empleados"
        rol={rol}
        esSuperAdmin={esSuperAdmin}
      />
      <main className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 sm:px-8 lg:py-8">
        <section>
          <p className="text-xs font-semibold uppercase tracking-wider text-rojo">
            Administración del comercio
          </p>
          <h1 className="mt-1 font-titulos text-3xl uppercase tracking-wide text-negro sm:text-4xl">
            Empleados
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-negro/65">
            Invitaciones y accesos del equipo operativo de pedidos.
          </p>
        </section>
        <PanelEmpleadosAdmin />
      </main>
    </div>
  );
}
