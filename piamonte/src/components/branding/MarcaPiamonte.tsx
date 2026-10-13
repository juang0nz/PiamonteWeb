import Link from "next/link";

type TamanoMarca = "sm" | "md" | "lg";

const clasesPorTamano: Record<TamanoMarca, string> = {
  sm: "h-9",
  md: "h-11",
  lg: "h-14",
};

// Marca reutilizable con fallback de texto para mantener identidad aun sin archivo gráfico.
export function MarcaPiamonte({
  href = "/",
  tamano = "md",
  mostrarSubtitulo = false,
  mostrarNombre = false,
  subtitulo = "Gestión de pedidos",
  colorTexto = "claro",
}: {
  href?: string;
  tamano?: TamanoMarca;
  mostrarSubtitulo?: boolean;
  mostrarNombre?: boolean;
  subtitulo?: string;
  colorTexto?: "claro" | "oscuro";
}) {
  const colorPrincipal = colorTexto === "claro" ? "text-crema" : "text-negro";
  const colorSecundario =
    colorTexto === "claro" ? "text-crema/70" : "text-negro/70";

  return (
    <Link href={href} className="inline-flex min-w-0 items-center gap-3">
      <div className={`relative aspect-[3/1] ${clasesPorTamano[tamano]}`}>
        <img
          src="/brand/logo-piamonte.png"
          alt="Piamonte"
          className="h-full w-auto object-contain"
        />
      </div>
      <span className="sr-only">Piamonte</span>
      <div className="min-w-0">
        {mostrarNombre && (
          <p
            className={`font-titulos text-xl uppercase tracking-[0.22em] ${colorPrincipal}`}
          >
            Piamonte
          </p>
        )}
        {mostrarSubtitulo && (
          <p className={`text-xs uppercase tracking-[0.2em] ${colorSecundario}`}>
            {subtitulo}
          </p>
        )}
      </div>
    </Link>
  );
}
