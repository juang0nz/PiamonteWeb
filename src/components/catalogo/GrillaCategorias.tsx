import type { Categoria } from "@/lib/catalogo/tipos";
import { imagenesCategorias } from "@/lib/comercio/imagenesCategorias";
import { TarjetaCategoria } from "./TarjetaCategoria";

// En escritorio, la cantidad de columnas depende del espacio entre sidebar y carrito.
export function GrillaCategorias({ categorias }: { categorias: Categoria[] }) {
  const categoriasOrdenadas = [...categorias].sort((a, b) => {
    if (a.slug === "nuevos") return -1;
    if (b.slug === "nuevos") return 1;
    return 0;
  });

  return (
    <section id="carta" aria-labelledby="titulo-categorias" className="scroll-mt-24">
      <h2
        id="titulo-categorias"
        className="font-titulos text-4xl uppercase tracking-wide text-crema lg:hidden"
      >
        ¿Qué vas a pedir hoy?
      </h2>
      <h2 className="hidden font-titulos text-5xl uppercase tracking-wide text-crema lg:block">
        ¿Qué vas a pedir hoy?
      </h2>
      <div className="mt-4 grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-[repeat(auto-fit,minmax(150px,1fr))] lg:gap-3">
        {categoriasOrdenadas.map((categoria, indice) => (
          <TarjetaCategoria
            key={categoria.id}
            categoria={categoria}
            imagenProvisoria={imagenesCategorias[categoria.slug]}
            destacada={indice === 0 && categoria.slug === "nuevos"}
          />
        ))}
      </div>
    </section>
  );
}
