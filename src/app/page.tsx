import { BannerPromociones } from "@/components/catalogo/BannerPromociones";
import { ActualizadorCatalogo } from "@/components/catalogo/ActualizadorCatalogo";
import { BarraLateral } from "@/components/catalogo/BarraLateral";
import { EncabezadoMovil } from "@/components/catalogo/EncabezadoMovil";
import { GrillaCategorias } from "@/components/catalogo/GrillaCategorias";
import { MensajeEstado } from "@/components/catalogo/MensajeEstado";
import { ReservaCarrito } from "@/components/catalogo/ReservaCarrito";
import { VistaCategoria } from "@/components/catalogo/VistaCategoria";
import { obtenerCatalogo } from "@/lib/catalogo/consultas";
import type { Catalogo } from "@/lib/catalogo/tipos";
import { SLUG_COMERCIO } from "@/lib/comercio";
import { obtenerEstadoApertura } from "@/lib/comercio/horarios";
import { tiemposEntrega } from "@/lib/comercio/tiemposEntrega";

function normalizarBusqueda(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

export default async function PaginaCatalogo({
  searchParams,
}: {
  searchParams: Promise<{ [clave: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const { categoria: parametroCategoria, carrito } = params;
  const textoBusquedaParam = typeof params.q === "string" ? params.q.trim() : "";
  const slugSeleccionado =
    typeof parametroCategoria === "string" ? parametroCategoria : undefined;
  const abrirCarritoInicio = carrito === "abierto";

  let catalogo: Catalogo | null;

  try {
    catalogo = await obtenerCatalogo(SLUG_COMERCIO);
  } catch {
    return (
      <MensajeEstado
        titulo="No pudimos cargar el menú"
        descripcion="Ocurrió un problema al consultar el catálogo. Intentá nuevamente en unos minutos."
      />
    );
  }

  if (!catalogo) {
    return (
      <MensajeEstado
        titulo="Comercio no disponible"
        descripcion="No encontramos este comercio o no está activo en este momento."
      />
    );
  }

  const terminoBusqueda = normalizarBusqueda(textoBusquedaParam);
  // Las categorías sin productos disponibles no se muestran.
  const categoriasBase = catalogo.categorias.filter(
    (categoria) => categoria.productos.length > 0 && categoria.slug !== "nuevos",
  );
  const categorias = terminoBusqueda
    ? categoriasBase
        .map((categoria) => {
          const nombreCategoria = normalizarBusqueda(categoria.nombre);
          if (nombreCategoria.includes(terminoBusqueda)) {
            return categoria;
          }
          const productosFiltrados = categoria.productos.filter((producto) => {
            const nombreProducto = normalizarBusqueda(producto.nombre);
            const descripcionProducto = normalizarBusqueda(producto.descripcion ?? "");
            return (
              nombreProducto.includes(terminoBusqueda) ||
              descripcionProducto.includes(terminoBusqueda)
            );
          });
          return { ...categoria, productos: productosFiltrados };
        })
        .filter((categoria) => categoria.productos.length > 0)
    : categoriasBase;
  const seleccionada = categorias.find((c) => c.slug === slugSeleccionado);
  const nombre = catalogo.comercio.nombre;
  const estadoApertura = obtenerEstadoApertura();

  return (
    <div className="flex flex-1 flex-col bg-negro lg:flex-row">
      <ActualizadorCatalogo comercioId={catalogo.comercio.id} />
      <BarraLateral
        nombreComercio={nombre}
        categorias={categorias}
        categoriaActiva={seleccionada?.slug}
        estadoApertura={estadoApertura}
      />
      <EncabezadoMovil
        nombreComercio={nombre}
        categoriaActiva={seleccionada?.slug}
        abrirCarritoInicio={abrirCarritoInicio}
        estadoApertura={estadoApertura}
      />

      <main className="min-w-0 flex-1 space-y-5 px-3 pb-8 pt-4 sm:px-4 lg:space-y-6 lg:px-5 lg:pb-6 lg:pt-5 xl:px-7">
        <div className="hidden items-center gap-4 rounded-2xl border border-negro/10 bg-white px-4 py-3 lg:flex">
          <div className="flex shrink-0 items-center gap-3 text-xs text-negro/60">
            <span className="flex items-center gap-1">
              <svg viewBox="0 0 24 24" aria-hidden className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 18h18M5 18a7 7 0 0 1 14 0M12 11V9M10 9h4" />
              </svg>
              Retiro
              <strong className="font-semibold text-negro">{tiemposEntrega.retiro}</strong>
            </span>
            <span className="flex items-center gap-1">
              <svg viewBox="0 0 24 24" aria-hidden className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="5.5" cy="17" r="3" />
                <circle cx="18.5" cy="17" r="3" />
                <path d="M5.5 17 9 10h6l3.5 7M9 10 7.5 7H5.5M15 10l-2-4h2.5M12 17l3-7" />
              </svg>
              Envío
              <strong className="font-semibold text-negro">{tiemposEntrega.envio}</strong>
            </span>
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-3">
            <p
              className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${
                estadoApertura.abierto
                  ? "bg-[#e9faee] text-[#1f8f3a]"
                  : "bg-[#fbeaea] text-rojo"
              }`}
            >
              {estadoApertura.mensaje}
            </p>
            <form action="/" method="get" className="w-64">
              {slugSeleccionado && (
                <input type="hidden" name="categoria" value={slugSeleccionado} />
              )}
              <input
                type="search"
                name="q"
                defaultValue={textoBusquedaParam}
                placeholder="Buscar producto..."
                className="w-full rounded-full border border-negro/15 bg-[#faf8f4] px-4 py-2 text-sm text-negro outline-none focus:border-rojo"
              />
            </form>
          </div>
        </div>
        {categorias.length === 0 ? (
          <MensajeEstado
            oscuro
            titulo={terminoBusqueda ? "Sin resultados" : "Menú en preparación"}
            descripcion={
              terminoBusqueda
                ? `No encontramos productos para "${textoBusquedaParam}".`
                : "Todavía no hay productos disponibles. Volvé a visitarnos pronto."
            }
          />
        ) : seleccionada ? (
          <VistaCategoria categoria={seleccionada} />
        ) : slugSeleccionado ? (
          <MensajeEstado
            oscuro
            titulo="Sin resultados en la categoría"
            descripcion={
              terminoBusqueda
                ? `No encontramos productos en esta categoría para "${textoBusquedaParam}".`
                : "La categoría solicitada no está disponible en este momento."
            }
          />
        ) : (
          <>
            <BannerPromociones
              titulo="LO BUENO EMPIEZA ACÁ."
              descripcion="Elegí lo que más te gusta. Nosotros nos encargamos del resto."
            />
            <GrillaCategorias categorias={categorias} />
          </>
        )}
      </main>

      <ReservaCarrito />
    </div>
  );
}
