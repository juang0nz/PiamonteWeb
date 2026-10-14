import Link from "next/link";
import Image from "next/image";
import { NavegacionPiamonte } from "./NavegacionPiamonte";
import type { Categoria } from "@/lib/catalogo/tipos";
import type { EstadoApertura } from "@/lib/comercio/horarios";

export function BarraLateral(props: {
  nombreComercio: string;
  categorias: Categoria[];
  categoriaActiva?: string;
  estadoApertura: EstadoApertura;
}) {
  const { nombreComercio, categoriaActiva, estadoApertura } = props;

  return (
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-crema/10 bg-[#0b0a0a] px-4 py-5 lg:flex">
      <Link
        href="/"
        title={nombreComercio}
        className="flex items-center gap-3 border-b border-crema/10 pb-5"
      >
        <Image
          src="/brand/logo-piamonte.png"
          alt="Logo de Piamonte"
          width={1024}
          height={1536}
          sizes="56px"
          className="h-20 w-14 shrink-0 object-contain"
        />
        <span className="min-w-0">
          <span className="block font-titulos text-2xl uppercase leading-none tracking-wide text-crema">
            {nombreComercio}
          </span>
          <span className="mt-1.5 block text-xs tracking-wide text-crema/55">
            Parque Posadas
          </span>
        </span>
      </Link>

      <NavegacionPiamonte
        categoriaActiva={categoriaActiva}
        estadoApertura={estadoApertura}
      />
    </aside>
  );
}
