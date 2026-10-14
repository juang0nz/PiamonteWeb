import type { Metadata } from "next";
import { PanelAuditoriaSuperAdmin } from "@/components/super-admin/PanelAuditoriaSuperAdmin";
import { EncabezadoSuperAdmin } from "@/components/super-admin/EncabezadoSuperAdmin";

export const metadata: Metadata = {
  title: "Plataforma | Auditoría",
};

export default function PaginaAuditoriaSuperAdmin() {
  return (
    <div className="min-h-full bg-gradient-to-b from-[#fff3ee] via-[#fff8f2] to-[#fffdf8]">
      <EncabezadoSuperAdmin seccion="auditoria" />
      <main className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 sm:px-8 lg:py-8">
        <section>
          <p className="text-xs font-semibold uppercase tracking-wider text-rojo">
            Plataforma gastronómica
          </p>
          <h1 className="mt-1 font-titulos text-3xl uppercase tracking-wide text-negro sm:text-4xl">
            Auditoría
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-negro/65">
            Historial inmutable de operaciones administrativas de todos los
            comercios.
          </p>
        </section>
        <PanelAuditoriaSuperAdmin />
      </main>
    </div>
  );
}
