import type { Metadata } from "next";
import { MensajeEstado } from "@/components/catalogo/MensajeEstado";
import { EncabezadoCheckout } from "@/components/checkout/EncabezadoCheckout";
import { PantallaCheckout } from "@/components/checkout/PantallaCheckout";
import { obtenerComercio } from "@/lib/catalogo/consultas";
import type { Comercio } from "@/lib/catalogo/tipos";
import { SLUG_COMERCIO } from "@/lib/comercio";
import { obtenerCostoEnvio, obtenerEstadoOperativo } from "@/lib/comercio/configuracion";
import { obtenerDescuentoWeb } from "@/lib/comercio/descuento-web-publico";
import type { EstadoDescuentoWeb } from "@/lib/comercio/descuento-web";
import { CONFIGURACION_INICIAL, tiemposPorDemanda } from "@/lib/comercio/tiempos";

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

  // Tiempos vigentes y pausa (PIA-2). Ante un error de lectura se muestran los valores
  // iniciales y no se bloquea la UI: el servidor rechaza igual si hay pausa.
  let { tiempos, pausa } = {
    tiempos: tiemposPorDemanda(CONFIGURACION_INICIAL),
    pausa: { pausado: false, mensaje: "" },
  };
  try {
    ({ tiempos, pausa } = await obtenerEstadoOperativo(comercio.id));
  } catch (errorConfiguracion) {
    console.error("No se pudo leer la configuración operativa del comercio:", errorConfiguracion);
  }
  let costoEnvio: number | null = null;
  try {
    costoEnvio = await obtenerCostoEnvio(comercio.id);
  } catch (errorTarifa) {
    console.error("No se pudo leer la tarifa de delivery:", errorTarifa);
  }
  let descuentoWeb: EstadoDescuentoWeb = { estado: "desconocido" };
  try {
    descuentoWeb = await obtenerDescuentoWeb(comercio.id);
  } catch (errorDescuento) {
    console.error("No se pudo leer el descuento web:", errorDescuento);
  }

  return (
    <div className="flex flex-1 flex-col">
      <EncabezadoCheckout nombreComercio={comercio.nombre} />
      <main className="flex-1 bg-gradient-to-b from-[#fff3ee] via-[#fff8f2] to-[#fffdf8] px-4 py-6 text-[#171717] sm:px-8 lg:py-10">
        <PantallaCheckout hrefCarrito={HREF_CARRITO} tiempos={tiempos} pausa={pausa} costoEnvio={costoEnvio} descuentoWeb={descuentoWeb} />
      </main>
    </div>
  );
}
