import Image from "next/image";
import Link from "next/link";

export function MarcoCuentaCliente({
  nombreComercio,
  titulo,
  descripcion,
  children,
}: {
  nombreComercio: string;
  titulo: string;
  descripcion: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-gradient-to-b from-[#fff3ee] via-[#fff8f2] to-[#fffdf8] text-negro">
      <header className="border-b border-crema/10 bg-negro text-crema">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-4 sm:px-8">
          <Link href="/" className="flex items-center gap-3">
            <Image
              src="/brand/logo-piamonte.png"
              alt={`Logo de ${nombreComercio}`}
              width={1024}
              height={1536}
              sizes="40px"
              className="h-14 w-10 object-contain"
            />
            <span className="font-titulos text-xl uppercase tracking-wide">
              {nombreComercio}
            </span>
          </Link>
          <Link
            href="/"
            className="rounded-full border border-crema/25 px-4 py-2 text-sm font-semibold hover:bg-crema hover:text-negro"
          >
            Volver al menú
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-8 sm:py-12">
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-rojo">
            Cuenta de cliente
          </p>
          <h1 className="mt-1 font-titulos text-3xl uppercase tracking-wide sm:text-4xl">
            {titulo}
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-negro/65">{descripcion}</p>
        </div>
        {children}
      </main>
    </div>
  );
}
