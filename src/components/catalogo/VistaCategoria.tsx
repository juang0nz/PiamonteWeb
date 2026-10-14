import Link from "next/link";
import type { Categoria } from "@/lib/catalogo/tipos";
import { TarjetaProducto } from "./TarjetaProducto";

// Vista de una categoría seleccionada: encabezado, enlace para volver y lista de productos.
export function VistaCategoria({ categoria }: { categoria: Categoria }) {
  return (
    <section aria-labelledby="titulo-categoria">
      <Link
        href="/"
        className="text-sm font-medium text-rojo hover:underline"
      >
        ← Todas las categorías
      </Link>
      <h1
        id="titulo-categoria"
        className="mt-2 font-titulos text-4xl uppercase tracking-wide text-crema sm:text-5xl"
      >
        {categoria.nombre}
      </h1>
      <div className="mt-2 h-1 w-12 bg-rojo" />
      {categoria.descripcion && (
        <p className="mt-3 text-sm text-crema/70">{categoria.descripcion}</p>
      )}
      <ul className="mt-4 flex flex-col gap-3">
        {categoria.productos.map((producto) => (
          <TarjetaProducto key={producto.id} producto={producto} />
        ))}
      </ul>
    </section>
  );
}
