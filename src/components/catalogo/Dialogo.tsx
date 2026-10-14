"use client";

import { useEffect, useId, useRef } from "react";

// Diálogo accesible: modal centrado en escritorio y panel inferior (bottom sheet) en celular.
export function Dialogo({
  titulo,
  onCerrar,
  children,
}: {
  titulo: string;
  onCerrar: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const idTitulo = useId();

  useEffect(() => {
    const dialogo = ref.current;
    if (dialogo && !dialogo.open) dialogo.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  return (
    <dialog
      ref={ref}
      aria-labelledby={idTitulo}
      onClose={onCerrar}
      onClick={(e) => {
        // Un clic sobre el fondo oscuro tiene como destino el propio <dialog>.
        if (e.target === e.currentTarget) ref.current?.close();
      }}
      className="m-0 mt-auto max-h-[92dvh] w-full max-w-none overflow-hidden rounded-t-3xl bg-fondo p-0 text-negro open:flex open:flex-col backdrop:bg-black/60 sm:m-auto sm:max-w-lg sm:rounded-3xl"
    >
      <div className="flex shrink-0 items-center justify-between gap-4 bg-negro px-5 py-4 text-crema">
        <h2
          id={idTitulo}
          className="font-titulos text-2xl uppercase leading-tight tracking-wide"
        >
          {titulo}
        </h2>
        <button
          type="button"
          onClick={() => ref.current?.close()}
          aria-label="Cerrar"
          className="rounded-full bg-crema/10 px-3 py-1 text-lg leading-none hover:bg-rojo"
        >
          ×
        </button>
      </div>
      {children}
    </dialog>
  );
}
