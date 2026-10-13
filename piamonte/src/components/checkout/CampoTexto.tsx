"use client";

import { useId } from "react";

// Campo de formulario con etiqueta, indicador de opcional y mensaje de error.
export function CampoTexto({
  etiqueta,
  valor,
  onCambio,
  error,
  opcional = false,
  multilinea = false,
  tipo = "text",
  autoComplete,
  inputMode,
  placeholder,
  maxLength = 120,
  nombre,
}: {
  etiqueta: string;
  valor: string;
  onCambio: (valor: string) => void;
  error?: string;
  opcional?: boolean;
  multilinea?: boolean;
  tipo?: "text" | "tel";
  autoComplete?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  placeholder?: string;
  maxLength?: number;
  nombre: string;
}) {
  const id = useId();
  const idError = `${id}-error`;
  const clases = `w-full rounded-xl border bg-white px-4 py-3 text-sm text-[#171717] placeholder:text-neutral-500 caret-[#171717] outline-none transition-colors focus:border-rojo focus-visible:ring-2 focus-visible:ring-rojo/30 disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-500 [&:-webkit-autofill]:shadow-[inset_0_0_0px_1000px_white] [&:-webkit-autofill]:[-webkit-text-fill-color:#171717] ${
    error ? "border-rojo" : "border-negro/15"
  }`;
  const comunes = {
    id,
    name: nombre,
    value: valor,
    placeholder,
    maxLength,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": error ? idError : undefined,
    "aria-required": opcional ? undefined : true,
    className: clases,
  };

  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold text-[#171717]">
        {etiqueta}
        {opcional && (
          <span className="ml-1 font-normal text-negro/50">(opcional)</span>
        )}
      </label>
      {multilinea ? (
        <textarea
          {...comunes}
          rows={2}
          onChange={(e) => onCambio(e.target.value)}
          className={`${clases} resize-none`}
        />
      ) : (
        <input
          {...comunes}
          type={tipo}
          autoComplete={autoComplete}
          inputMode={inputMode}
          onChange={(e) => onCambio(e.target.value)}
        />
      )}
      {error && (
        <p id={idError} className="mt-1 text-xs text-rojo">
          {error}
        </p>
      )}
    </div>
  );
}
