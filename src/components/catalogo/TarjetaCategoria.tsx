import Link from "next/link";
import type { Categoria } from "@/lib/catalogo/tipos";

// La foto del catálogo reemplaza la imagen provisoria sin cambiar la tarjeta.
export function TarjetaCategoria({
  categoria,
  imagenProvisoria,
  destacada = false,
}: {
  categoria: Categoria;
  imagenProvisoria?: { url: string; posicion?: string };
  destacada?: boolean;
}) {
  const cantidad = categoria.productos.length;
  const imagen = categoria.imagen_url || imagenProvisoria?.url;
  const posicion = categoria.imagen_url ? "center" : imagenProvisoria?.posicion ?? "center";

  return (
    <Link
      href={`/?categoria=${categoria.slug}`}
      className={`group relative flex min-w-0 flex-col justify-end overflow-hidden rounded-xl border bg-negro p-2.5 text-crema shadow-[0_10px_22px_rgba(0,0,0,0.32)] transition-transform hover:-translate-y-0.5 ${
        destacada
          ? "col-span-2 aspect-[2.25/1] border-rojo/70 lg:col-span-2 lg:row-span-2 lg:aspect-auto"
          : "aspect-[16/10] min-h-28 border-crema/10"
      }`}
    >
      {imagen ? (
        <div
          aria-hidden
          className="absolute inset-0 bg-cover bg-center transition-transform duration-300 group-hover:scale-105"
          style={{ backgroundImage: `url("${imagen}")`, backgroundPosition: posicion }}
        />
      ) : (
        <div aria-hidden className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-rojo" />
      )}
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-t from-negro via-negro/25 to-transparent"
      />
      <div className="relative pr-7">
        <h3 className="font-titulos text-xl uppercase leading-[1.1] tracking-wide sm:text-2xl lg:text-xl">
          {categoria.nombre}
        </h3>
        <p className="mt-0.5 text-[11px] text-crema/75">
          {cantidad} {cantidad === 1 ? "producto" : "productos"}
        </p>
      </div>
      <span aria-hidden className="absolute bottom-2.5 right-2 flex h-6 w-6 items-center justify-center rounded-full border border-crema/40 text-crema transition-colors group-hover:border-rojo group-hover:bg-rojo">
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12h14m-5-5 5 5-5 5" />
        </svg>
      </span>

      {destacada && (
        <span className="absolute right-2 top-2 rounded-full bg-rojo px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-crema">
          Destacado
        </span>
      )}
    </Link>
  );
}
