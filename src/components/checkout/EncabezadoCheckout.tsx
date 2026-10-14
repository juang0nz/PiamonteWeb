import Link from "next/link";
import Image from "next/image";

// Encabezado negro para las pantallas del pedido: marca del comercio que vuelve al menú.
export function EncabezadoCheckout({ nombreComercio }: { nombreComercio: string }) {
  return (
    <header className="sticky top-0 z-20 bg-negro/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-2.5 sm:px-8">
        <Link href="/" className="flex min-w-0 items-center gap-3">
          <Image
            src="/brand/logo-piamonte.png"
            alt="Logo de Piamonte"
            width={1024}
            height={1536}
            sizes="40px"
            priority
            className="h-14 w-10 shrink-0 object-contain"
          />
          <span className="min-w-0">
            <span className="block font-titulos text-xl uppercase leading-none tracking-wide text-crema">
              {nombreComercio}
            </span>
            <span className="mt-1 block text-[11px] tracking-wide text-crema/55">
              Parque Posadas
            </span>
          </span>
        </Link>
        <Link
          href="/"
          className="shrink-0 rounded-full border border-crema/20 px-4 py-1.5 text-sm font-medium text-crema/90 transition-colors hover:border-rojo hover:bg-rojo hover:text-crema"
        >
          Ver menú
        </Link>
      </div>
      <span className="block h-1 w-full bg-rojo" />
    </header>
  );
}
