import type { Metadata } from "next";
import { MensajeEstado } from "@/components/catalogo/MensajeEstado";
import { EncabezadoCheckout } from "@/components/checkout/EncabezadoCheckout";
import { PantallaCheckout } from "@/components/checkout/PantallaCheckout";
import { obtenerComercio } from "@/lib/catalogo/consultas";
import type { Comercio } from "@/lib/catalogo/tipos";
import { SLUG_COMERCIO } from "@/lib/comercio";

export const metadata: Metadata = {
  title: "Finalizar pedido",
};

// Ruta del carrito a la que se vuelve desde el checkout (abre el carrito en móvil).
const HREF_CARRITO = "/?carrito=abierto";

export default async function PaginaCheckout() {
  let comercio: Comercio | null;

  try {
    comercio = await obtenerComercio(SLUG_COMERCIO);
  } catch {
    return (
      <MensajeEstado
        titulo="No pudimos cargar el pedido"
        descripcion="Ocurrió un problema al consultar el comercio. Intentá nuevamente en unos minutos."
      />
    );
  }

  if (!comercio) {
    return (
      <MensajeEstado
        titulo="Comercio no disponible"
        descripcion="No encontramos este comercio o no está activo en este momento."
      />
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      <EncabezadoCheckout nombreComercio={comercio.nombre} />
      <main className="flex-1 bg-gradient-to-b from-[#fff3ee] via-[#fff8f2] to-[#fffdf8] px-4 py-6 text-[#171717] sm:px-8 lg:py-10">
        <PantallaCheckout hrefCarrito={HREF_CARRITO} />
      </main>
    </div>
  );
}
