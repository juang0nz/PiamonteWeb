import type { Metadata } from "next";
import { PanelPedidosAdmin } from "@/components/admin/PanelPedidosAdmin";
import { NotificacionesPedidos } from "@/components/admin/NotificacionesPedidos";
import { EncabezadoAdmin } from "@/components/admin/EncabezadoAdmin";
import { obtenerEstadoAccesoAdmin } from "@/lib/admin/auth";

export const metadata: Metadata = {
  title: "Piamonte | Gestión de pedidos",
};

export default async function PaginaAdmin() {
  const estado = await obtenerEstadoAccesoAdmin();
  const rol = estado.autenticado && estado.autorizado ? estado.rol : null;
  const comercioId =
    estado.autenticado && estado.autorizado ? estado.comercioId : null;
  const esSuperAdmin =
    estado.autenticado && estado.autorizado ? estado.esSuperAdmin : false;

  return (
    <div className="min-h-full bg-gradient-to-b from-[#fff3ee] via-[#fff8f2] to-[#fffdf8]">
      <EncabezadoAdmin
        seccion="pedidos"
        rol={rol}
        esSuperAdmin={esSuperAdmin}
      />

      <main className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 sm:px-8 lg:py-8">
        {comercioId && <NotificacionesPedidos comercioId={comercioId} />}
        <PanelPedidosAdmin puedeCancelar={rol !== "empleado"} />
      </main>
    </div>
  );
}
