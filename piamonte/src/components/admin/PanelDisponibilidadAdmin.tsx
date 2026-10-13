"use client";

import { useCallback, useEffect, useState } from "react";

type VarianteAdmin = {
  id: string;
  nombre: string;
  disponible: boolean;
};

type ProductoAdmin = {
  id: string;
  nombre: string;
  disponible: boolean;
  variantes: VarianteAdmin[];
};

type CategoriaAdmin = {
  id: string;
  nombre: string;
  productos: ProductoAdmin[];
};

type TipoRecurso = "producto" | "variante";

export function PanelDisponibilidadAdmin() {
  const [categorias, setCategorias] = useState<CategoriaAdmin[]>([]);
  const [cargando, setCargando] = useState(true);
  const [actualizandoId, setActualizandoId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");

  const cargar = useCallback(async () => {
    setError(null);
    try {
      const respuesta = await fetch("/api/admin/disponibilidad", {
        credentials: "same-origin",
        cache: "no-store",
      });
      const cuerpo = (await respuesta.json().catch(() => null)) as
        | { categorias?: CategoriaAdmin[]; error?: string }
        | null;
      if (!respuesta.ok) {
        throw new Error(
          cuerpo?.error ?? "No pudimos cargar la disponibilidad del catálogo.",
        );
      }
      setCategorias(cuerpo?.categorias ?? []);
    } catch (errorDesconocido) {
      setError(
        errorDesconocido instanceof Error
          ? errorDesconocido.message
          : "No pudimos cargar la disponibilidad del catálogo.",
      );
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    const temporizador = window.setTimeout(() => {
      void cargar();
    }, 0);
    return () => window.clearTimeout(temporizador);
  }, [cargar]);

  async function cambiarDisponibilidad(
    tipo: TipoRecurso,
    id: string,
    disponible: boolean,
    nombre: string,
  ) {
    if (actualizandoId) return;
    setActualizandoId(id);
    setError(null);
    setMensaje(null);
    try {
      const respuesta = await fetch("/api/admin/disponibilidad", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          tipo,
          id,
          disponible,
          operacionId: crypto.randomUUID(),
        }),
      });
      const cuerpo = (await respuesta.json().catch(() => null)) as
        | { error?: string }
        | null;
      if (!respuesta.ok) {
        throw new Error(
          cuerpo?.error ?? "No pudimos actualizar la disponibilidad.",
        );
      }

      setCategorias((actuales) =>
        actuales.map((categoria) => ({
          ...categoria,
          productos: categoria.productos.map((producto) => {
            if (tipo === "producto" && producto.id === id) {
              return { ...producto, disponible };
            }
            return {
              ...producto,
              variantes: producto.variantes.map((variante) =>
                tipo === "variante" && variante.id === id
                  ? { ...variante, disponible }
                  : variante,
              ),
            };
          }),
        })),
      );
      setMensaje(
        `${nombre} quedó ${disponible ? "disponible" : "marcado como agotado"}.`,
      );
    } catch (errorDesconocido) {
      setError(
        errorDesconocido instanceof Error
          ? errorDesconocido.message
          : "No pudimos actualizar la disponibilidad.",
      );
    } finally {
      setActualizandoId(null);
    }
  }

  const categoriasVisibles = categorias
    .map((categoria) => {
      const productosFiltrados = categoria.productos.filter((producto) => {
        const textoProducto = producto.nombre.toLowerCase();
        const hayCoincidenciaProducto = textoProducto.includes(busqueda.toLowerCase());
        const hayCoincidenciaVariante = producto.variantes.some((variante) =>
          variante.nombre.toLowerCase().includes(busqueda.toLowerCase()),
        );
        return hayCoincidenciaProducto || hayCoincidenciaVariante;
      });

      return {
        ...categoria,
        productos: productosFiltrados,
      };
    })
    .filter((categoria) => {
      if (!busqueda.trim()) return true;
      const nombreCategoria = categoria.nombre.toLowerCase();
      const coincideCategoria = nombreCategoria.includes(busqueda.toLowerCase());
      return coincideCategoria || categoria.productos.length > 0;
    });

  return (
    <section
      id="disponibilidad"
      className="space-y-4 rounded-3xl border border-negro/10 bg-white p-5 shadow-[0_20px_45px_rgba(0,0,0,0.08)]"
    >
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-rojo">
          Catálogo
        </p>
        <h2 className="mt-1 font-titulos text-2xl uppercase tracking-wide text-negro">
          Disponibilidad de productos
        </h2>
        <p className="mt-1 text-sm text-negro/60">
          Marcá productos o variantes como disponibles o agotados.
        </p>
      </div>

      <label className="block">
        <span className="sr-only">Buscar productos</span>
        <input
          type="search"
          value={busqueda}
          onChange={(evento) => setBusqueda(evento.target.value)}
          placeholder="Buscar por producto o variante"
          className="w-full rounded-2xl border border-negro/15 bg-fondo px-4 py-2.5 text-sm text-negro placeholder:text-negro/45 focus:border-rojo focus:outline-none focus:ring-2 focus:ring-rojo/20"
        />
      </label>

      {mensaje && (
        <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {mensaje}
        </p>
      )}
      {error && (
        <p className="rounded-xl bg-rojo/10 px-4 py-3 text-sm text-rojo">
          {error}
        </p>
      )}

      {cargando ? (
        <p className="text-sm text-negro/60">Cargando catálogo…</p>
      ) : categorias.length === 0 ? (
        <p className="text-sm text-negro/60">
          No hay categorías configuradas para este comercio.
        </p>
      ) : categoriasVisibles.length === 0 ? (
        <p className="rounded-xl bg-fondo px-4 py-3 text-sm text-negro/60">
          No se encontraron productos para la búsqueda “{busqueda}”.
        </p>
      ) : (
        <div className="space-y-5">
          {categoriasVisibles.map((categoria) => (
            <details
              key={categoria.id}
              className="group rounded-2xl border border-negro/15 bg-fondo/35"
              open={busqueda.trim().length > 0 ? true : undefined}
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-3 font-titulos text-xl uppercase tracking-wide text-negro marker:hidden [&::-webkit-details-marker]:hidden">
                <span>{categoria.nombre}</span>
                <span className="flex shrink-0 items-center gap-2 font-sans text-xs font-semibold normal-case tracking-normal text-negro/60">
                  {categoria.productos.length}{" "}
                  {categoria.productos.length === 1 ? "producto" : "productos"}
                  <span
                    aria-hidden="true"
                    className="text-lg leading-none transition-transform group-open:rotate-180"
                  >
                   ⌄
                  </span>
                </span>
              </summary>
              <div className="border-t border-negro/10 px-3 pb-3">
                {categoria.productos.length === 0 ? (
                  <p className="px-1 pt-3 text-sm text-negro/50">
                    Esta categoría no tiene productos.
                  </p>
                ) : (
                  <ul className="mt-3 divide-y divide-negro/10 rounded-2xl border border-negro/10 bg-white">
                    {categoria.productos.map((producto) => (
                      <li key={producto.id} className="p-4">
                        <ControlDisponibilidad
                          nombre={producto.nombre}
                          disponible={producto.disponible}
                          deshabilitado={actualizandoId !== null}
                          actualizando={actualizandoId === producto.id}
                          onCambio={(disponible) =>
                            cambiarDisponibilidad(
                              "producto",
                              producto.id,
                              disponible,
                              producto.nombre,
                            )
                          }
                        />
                        {producto.variantes.length > 0 && (
                          <ul className="mt-3 space-y-2 border-l-2 border-negro/10 pl-4">
                            {producto.variantes.map((variante) => (
                              <li key={variante.id}>
                              <ControlDisponibilidad
                                nombre={variante.nombre}
                                disponible={variante.disponible}
                                deshabilitado={actualizandoId !== null}
                                actualizando={actualizandoId === variante.id}
                                variante
                                onCambio={(disponible) =>
                                  cambiarDisponibilidad(
                                    "variante",
                                    variante.id,
                                    disponible,
                                    `${producto.nombre} · ${variante.nombre}`,
                                  )
                                }
                              />
                              </li>
                            ))}
                          </ul>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </details>
          ))}
        </div>
      )}
    </section>
  );
}

function ControlDisponibilidad({
  nombre,
  disponible,
  deshabilitado,
  actualizando,
  variante = false,
  onCambio,
}: {
  nombre: string;
  disponible: boolean;
  deshabilitado: boolean;
  actualizando: boolean;
  variante?: boolean;
  onCambio: (disponible: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className={`${variante ? "text-sm" : "font-semibold"} truncate text-negro`}>
          {nombre}
        </p>
        <p
          className={`text-xs font-semibold uppercase tracking-wide ${
            disponible ? "text-emerald-700" : "text-rojo"
          }`}
        >
          {actualizando
            ? "Actualizando…"
            : disponible
              ? "Disponible"
              : "Agotado"}
        </p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={disponible}
        aria-label={`${disponible ? "Marcar como agotado" : "Marcar como disponible"}: ${nombre}`}
        disabled={deshabilitado}
        onClick={() => onCambio(!disponible)}
        className={`relative h-7 w-12 shrink-0 rounded-full border border-negro/30 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rojo disabled:cursor-wait disabled:opacity-50 ${
          disponible ? "bg-emerald-600" : "bg-rojo/60"
        }`}
      >
        <span
          aria-hidden="true"
          className={`absolute left-0 top-1/2 size-5 -translate-y-1/2 rounded-full border border-negro/40 bg-white shadow transition-transform ${
            disponible ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </button>
    </div>
  );
}
