import Link from "next/link";

// Banner superior rojo y negro. El contenido es genérico: no incluye promociones inventadas.
export function BannerPromociones({
  titulo,
  descripcion,
}: {
  titulo: string;
  descripcion: string;
}) {
  return (
    <section
      id="promociones"
      className="relative overflow-hidden rounded-xl border border-crema/20 bg-negro text-crema shadow-[0_22px_44px_rgba(0,0,0,0.45)] lg:rounded-lg"
    >
      <div className="relative z-10 px-4 py-5 sm:flex sm:min-h-80 sm:w-[55%] sm:flex-col sm:justify-center sm:px-6 sm:py-7 lg:px-7 lg:py-6">
        <h1 className="max-w-md font-titulos text-5xl uppercase leading-[1.1] tracking-wide sm:text-6xl lg:text-6xl">
          {titulo}
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-crema sm:text-base">
          {descripcion}
        </p>
        <Link
          href="#carta"
          className="mt-4 inline-flex items-center gap-2 self-start rounded-full bg-rojo px-4 py-2 text-sm font-bold uppercase tracking-wide text-crema shadow-[0_8px_18px_rgba(197,40,40,0.35)] transition-colors hover:bg-[#b11118]"
        >
          Ver la carta <span aria-hidden>→</span>
        </Link>
      </div>
      <div
        aria-hidden
        className="relative aspect-[16/9] bg-cover bg-[position:center_45%] sm:absolute sm:inset-y-0 sm:right-0 sm:aspect-auto sm:w-[60%]"
        style={{ backgroundImage: "url('/brand/foto1.jpeg')" }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-negro via-transparent to-transparent sm:bg-gradient-to-r sm:from-negro sm:via-negro/10 sm:to-transparent" />
      </div>
    </section>
  );
}
