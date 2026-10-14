export function MensajeEstado({
  titulo,
  descripcion,
  oscuro = false,
}: {
  titulo: string;
  descripcion: string;
  oscuro?: boolean;
}) {
  return (
    <div className="mx-auto flex max-w-md flex-1 flex-col items-center justify-center gap-2 px-6 py-24 text-center">
      <h2 className={`font-titulos text-3xl uppercase ${oscuro ? "text-crema" : "text-negro"}`}>{titulo}</h2>
      <p className={`text-sm ${oscuro ? "text-crema/70" : "text-negro/60"}`}>{descripcion}</p>
    </div>
  );
}
