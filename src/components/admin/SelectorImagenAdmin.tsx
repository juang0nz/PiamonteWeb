"use client";

import { useState, type ChangeEvent } from "react";

const TAMANO_MAXIMO = 5 * 1024 * 1024;
const TIPOS_PERMITIDOS = new Set(["image/jpeg", "image/png", "image/webp"]);

export function SelectorImagenAdmin({
  value,
  onChange,
  onUploadingChange,
  disabled = false,
  label = "Imagen",
  placeholder = "URL o ruta de imagen",
  altText = "Vista previa de la imagen",
  destino = "productos",
}: {
  value: string;
  onChange: (value: string) => void;
  onUploadingChange?: (uploading: boolean) => void;
  disabled?: boolean;
  label?: string;
  placeholder?: string;
  altText?: string;
  destino?: "productos" | "categorias";
}) {
  const [vistaPreviaLocal, setVistaPreviaLocal] = useState<string | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function seleccionar(evento: ChangeEvent<HTMLInputElement>) {
    const archivo = evento.target.files?.[0];
    evento.target.value = "";
    if (!archivo) return;

    if (!TIPOS_PERMITIDOS.has(archivo.type)) {
      setError("Solo se permiten imágenes JPG, PNG o WebP.");
      return;
    }
    if (archivo.size > TAMANO_MAXIMO) {
      setError("La imagen debe pesar como máximo 5 MB.");
      return;
    }

    const previaLocal = URL.createObjectURL(archivo);
    setVistaPreviaLocal(previaLocal);
    setSubiendo(true);
    onUploadingChange?.(true);
    setError(null);
    try {
      const datos = new FormData();
      datos.append("imagen", archivo);
      datos.append("destino", destino);
      const respuesta = await fetch("/api/admin/catalogo/imagen", {
        method: "POST",
        credentials: "same-origin",
        body: datos,
      });
      const cuerpo = (await respuesta.json().catch(() => null)) as
        | { url?: string; error?: string }
        | null;
      if (!respuesta.ok || !cuerpo?.url) {
        throw new Error(cuerpo?.error ?? "No pudimos subir la imagen.");
      }
      onChange(cuerpo.url);
      setVistaPreviaLocal(null);
    } catch (errorDesconocido) {
      setVistaPreviaLocal(null);
      setError(
        errorDesconocido instanceof Error
          ? errorDesconocido.message
          : "No pudimos subir la imagen.",
      );
    } finally {
      URL.revokeObjectURL(previaLocal);
      setSubiendo(false);
      onUploadingChange?.(false);
    }
  }

  return (
    <div className="mt-3 rounded-xl border border-negro/10 bg-white p-3">
      <label className="block text-sm font-semibold text-negro">
        {label}
        <input
          type="text"
          value={value}
          onChange={(evento) => {
            onChange(evento.target.value);
            setVistaPreviaLocal(null);
          }}
          placeholder={placeholder}
          disabled={disabled || subiendo}
          className="mt-1.5 w-full rounded-xl border border-negro/15 bg-white px-3 py-2 text-sm text-negro focus:border-rojo focus:outline-none focus:ring-2 focus:ring-rojo/20"
        />
      </label>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <label className="inline-flex cursor-pointer items-center rounded-full bg-rojo px-4 py-2 text-sm font-semibold text-white hover:bg-negro has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-45">
          {subiendo ? "Subiendo…" : "Subir imagen"}
          <input
            type="file"
            accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
            onChange={seleccionar}
            disabled={disabled || subiendo}
            className="sr-only"
          />
        </label>
        <span className="text-xs text-negro/55">JPG, PNG o WebP · máximo 5 MB</span>
      </div>
      {(vistaPreviaLocal || value) && (
        // La vista previa admite URLs externas y rutas públicas ya existentes.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={vistaPreviaLocal || value}
          alt={altText}
          className="mt-3 h-28 w-28 rounded-xl border border-negro/10 object-cover"
        />
      )}
      {error && <p className="mt-2 text-xs text-rojo">{error}</p>}
    </div>
  );
}
