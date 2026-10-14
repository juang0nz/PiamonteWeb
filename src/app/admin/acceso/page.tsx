import type { Metadata } from "next";
import { MarcaPiamonte } from "@/components/branding/MarcaPiamonte";
import { FormularioAccesoEmpleado } from "@/components/admin/FormularioAccesoEmpleado";

export const metadata: Metadata = {
  title: "Piamonte | Establecer contraseña",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function PaginaAccesoEmpleado() {
  return (
    <div className="min-h-full bg-fondo px-4 py-10 sm:px-8">
      <div className="mx-auto max-w-md overflow-hidden rounded-3xl border border-negro/10 bg-white shadow-xl">
        <div className="bg-negro px-6 py-5 text-crema">
          <MarcaPiamonte tamano="md" mostrarSubtitulo subtitulo="Acceso de empleados" />
        </div>
        <div className="p-6">
          <h1 className="font-titulos text-2xl uppercase text-negro">Establecer contraseña</h1>
          <p className="mt-2 text-sm text-negro/65">
            Elegí tu contraseña personal. El administrador no podrá verla.
          </p>
          <FormularioAccesoEmpleado />
        </div>
      </div>
    </div>
  );
}
