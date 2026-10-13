"use client";

import { useEffect, useId, useState } from "react";
import { obtenerConfiguracionProducto } from "@/lib/catalogo/configuracion";
import {
  calcularPrecioUnitario,
  limitesGrupo,
  textoLimites,
  validarSeleccion,
} from "@/lib/catalogo/configurador";
import { formatearPrecio } from "@/lib/catalogo/formato";
import type { ConfiguracionProducto, Producto } from "@/lib/catalogo/tipos";
import { agregarItem } from "@/lib/carrito/almacen";
import { construirClaveItem, type OpcionCarrito } from "@/lib/carrito/tipos";
import { Dialogo } from "./Dialogo";

type Estado =
  | { tipo: "cargando" }
  | { tipo: "error"; detalle: string }
  | { tipo: "listo"; config: ConfiguracionProducto };

// Ventana de personalización: modal en escritorio y bottom sheet en celular.
export function ModalProducto({
  producto,
  onCerrar,
}: {
  producto: Producto;
  onCerrar: () => void;
}) {
  const [estado, setEstado] = useState<Estado>({ tipo: "cargando" });

  useEffect(() => {
    let activo = true;
    obtenerConfiguracionProducto(producto.id)
      .then((config) => activo && setEstado({ tipo: "listo", config }))
      .catch((error: unknown) => {
        if (!activo) return;
        console.error("No se pudo cargar la configuración del producto:", error);
        setEstado({
          tipo: "error",
          detalle: error instanceof Error ? error.message : String(error),
        });
      });
    return () => {
      activo = false;
    };
  }, [producto.id]);

  return (
    <Dialogo titulo={producto.nombre} onCerrar={onCerrar}>
      {estado.tipo === "listo" ? (
        <Configurador
          producto={producto}
          config={estado.config}
          onCerrar={onCerrar}
        />
      ) : estado.tipo === "cargando" ? (
        <p className="p-8 text-center text-sm text-negro/60">Cargando opciones…</p>
      ) : (
        <div className="p-8 text-center text-sm text-negro/60">
          <p>No pudimos cargar las opciones del producto. Intentá nuevamente.</p>
          <p className="mt-2 break-words font-mono text-xs text-rojo">
            {estado.detalle}
          </p>
        </div>
      )}
    </Dialogo>
  );
}

function Configurador({
  producto,
  config,
  onCerrar,
}: {
  producto: Producto;
  config: ConfiguracionProducto;
  onCerrar: () => void;
}) {
  const { grupos, reglas } = config;
  // Las variantes del catálogo las resuelve el servidor e incluyen las agotadas,
  // que deben verse pero no poder elegirse. La consulta del navegador sólo
  // devuelve las disponibles, así que se usa como respaldo.
  const variantes =
    producto.variantes.length > 0 ? producto.variantes : config.variantes;
  const hayVariantes = variantes.length > 0;
  const variantesDisponibles = variantes.filter((variante) => variante.disponible);

  const [varianteElegida, setVarianteElegida] = useState<string | null>(null);
  const [elegidas, setElegidas] = useState<Record<string, string[]>>({});
  const [aclaraciones, setAclaraciones] = useState("");
  const [cantidad, setCantidad] = useState(1);

  // Con una única variante disponible no hace falta que el cliente la elija.
  const varianteId =
    varianteElegida ??
    (variantesDisponibles.length === 1 ? variantesDisponibles[0].id : null);
  const variante = variantes.find((v) => v.id === varianteId) ?? null;

  const mostrarGrupos = !hayVariantes || varianteId !== null;
  const gruposVisibles = mostrarGrupos
    ? grupos.filter((g) => limitesGrupo(g, varianteId, reglas).maximo > 0)
    : [];

  const precioBase = hayVariantes ? (variante?.precio ?? null) : producto.precio_base;

  const opcionesElegidas: OpcionCarrito[] = gruposVisibles.flatMap((g) =>
    g.opciones
      .filter((o) => (elegidas[g.id] ?? []).includes(o.id))
      .map((o) => ({
        id: o.id,
        grupoId: g.id,
        grupoNombre: g.nombre,
        nombre: o.nombre,
        precioAdicional: o.precio_adicional,
      })),
  );

  const validacion = validarSeleccion({
    hayVariantes,
    varianteId,
    grupos: gruposVisibles,
    reglas,
    elegidas,
  });
  const sinPrecio = precioBase === null;
  const puedeAgregar =
    producto.disponible &&
    validacion.valido &&
    !sinPrecio &&
    (!variante || variante.disponible);

  const precioUnitario =
    precioBase === null
      ? 0
      : calcularPrecioUnitario(
          precioBase,
          opcionesElegidas.map((o) => ({ precio_adicional: o.precioAdicional })),
        );

  // Al cambiar de variante cambian los límites: se recortan las selecciones que los exceden.
  function elegirVariante(id: string) {
    setVarianteElegida(id);
    setElegidas((actual) => {
      const nuevo: Record<string, string[]> = {};
      for (const g of grupos) {
        const { maximo } = limitesGrupo(g, id, reglas);
        const ids = (actual[g.id] ?? []).slice(0, maximo);
        if (ids.length > 0) nuevo[g.id] = ids;
      }
      return nuevo;
    });
  }

  function alternarOpcion(grupoId: string, opcionId: string, maximo: number, minimo: number) {
    setElegidas((actual) => {
      const ids = actual[grupoId] ?? [];
      const yaElegida = ids.includes(opcionId);
      let siguiente: string[];
      if (maximo === 1) {
        // Selección única: un segundo clic la quita solo si el grupo es opcional.
        siguiente = yaElegida ? (minimo === 0 ? [] : ids) : [opcionId];
      } else if (yaElegida) {
        siguiente = ids.filter((id) => id !== opcionId);
      } else {
        siguiente = ids.length < maximo ? [...ids, opcionId] : ids;
      }
      return { ...actual, [grupoId]: siguiente };
    });
  }

  function agregarAlCarrito() {
    if (!puedeAgregar || precioBase === null) return;
    const notas = aclaraciones.trim().replace(/\s+/g, " ");
    agregarItem({
      clave: construirClaveItem(
        producto.id,
        varianteId,
        opcionesElegidas.map((o) => o.id),
        notas,
      ),
      productoId: producto.id,
      nombreProducto: producto.nombre,
      imagenProducto: producto.imagen_url,
      varianteId,
      varianteNombre: variante?.nombre ?? null,
      opciones: opcionesElegidas,
      aclaraciones: notas,
      precioUnitario,
      cantidad,
    });
    onCerrar();
  }

  const idAclaraciones = useId();

  return (
    <>
      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-5">
        {producto.imagen_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={producto.imagen_url}
            alt={producto.nombre}
            className="h-48 w-full rounded-2xl object-cover sm:h-56"
          />
        )}
        {producto.descripcion && (
          <p className="text-sm text-negro/70">{producto.descripcion}</p>
        )}

        {hayVariantes && (
          <fieldset>
            <legend className="font-titulos text-lg uppercase tracking-wide">
              Variante <span className="text-xs text-rojo">Obligatorio</span>
            </legend>
            <div className="mt-2 space-y-2">
              {variantes.map((v) => (
                <EtiquetaOpcion
                  key={v.id}
                  tipo="radio"
                  nombre={`variante-${producto.id}`}
                  marcada={varianteId === v.id}
                  deshabilitada={!v.disponible}
                  onCambio={() => elegirVariante(v.id)}
                  texto={v.disponible ? v.nombre : `${v.nombre} · Agotada`}
                  precio={formatearPrecio(v.precio)}
                />
              ))}
            </div>
            {validacion.mensajeVariante && (
              <p className="mt-2 text-xs text-rojo">{validacion.mensajeVariante}</p>
            )}
          </fieldset>
        )}

        {gruposVisibles.map((grupo) => {
          const limites = limitesGrupo(grupo, varianteId, reglas);
          const ids = elegidas[grupo.id] ?? [];
          const error = validacion.erroresGrupos[grupo.id];
          return (
            <fieldset key={grupo.id}>
              <legend className="font-titulos text-lg uppercase tracking-wide">
                {grupo.nombre}{" "}
                <span className="text-xs normal-case text-negro/60">
                  {limites.minimo > 0 && (
                    <span className="mr-1 font-semibold uppercase text-rojo">
                      Obligatorio ·
                    </span>
                  )}
                  {textoLimites(limites)}
                </span>
              </legend>
              <div className="mt-2 space-y-2">
                {grupo.opciones.map((opcion) => {
                  const marcada = ids.includes(opcion.id);
                  const bloqueada =
                    limites.maximo > 1 && !marcada && ids.length >= limites.maximo;
                  return (
                    <EtiquetaOpcion
                      key={opcion.id}
                      tipo={limites.maximo === 1 ? "radio" : "checkbox"}
                      nombre={`grupo-${grupo.id}`}
                      marcada={marcada}
                      deshabilitada={bloqueada}
                      onCambio={() =>
                        alternarOpcion(grupo.id, opcion.id, limites.maximo, limites.minimo)
                      }
                      texto={opcion.nombre}
                      precio={
                        opcion.precio_adicional !== 0
                          ? `${opcion.precio_adicional > 0 ? "+ " : ""}${formatearPrecio(opcion.precio_adicional)}`
                          : undefined
                      }
                    />
                  );
                })}
                {grupo.opciones.length === 0 && (
                  <p className="text-sm text-negro/50">Sin opciones disponibles.</p>
                )}
              </div>
              {error && <p className="mt-2 text-xs text-rojo">{error}</p>}
            </fieldset>
          );
        })}

        <div>
          <label
            htmlFor={idAclaraciones}
            className="font-titulos text-lg uppercase tracking-wide"
          >
            Aclaraciones
          </label>
          <textarea
            id={idAclaraciones}
            value={aclaraciones}
            onChange={(e) => setAclaraciones(e.target.value)}
            maxLength={200}
            rows={2}
            placeholder="Ej.: sin cebolla"
            className="mt-2 w-full resize-none rounded-xl border border-negro/15 bg-white p-3 text-sm outline-none focus:border-rojo"
          />
        </div>

        {sinPrecio && !hayVariantes && (
          <p className="text-sm text-rojo">
            Este producto no tiene un precio disponible por el momento.
          </p>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-3 border-t border-negro/10 bg-white px-5 py-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Disminuir cantidad"
            disabled={cantidad <= 1}
            onClick={() => setCantidad((c) => Math.max(1, c - 1))}
            className="h-9 w-9 rounded-full bg-negro text-crema hover:bg-rojo disabled:opacity-30"
          >
            −
          </button>
          <span className="w-6 text-center font-semibold">{cantidad}</span>
          <button
            type="button"
            aria-label="Aumentar cantidad"
            onClick={() => setCantidad((c) => Math.min(99, c + 1))}
            className="h-9 w-9 rounded-full bg-negro text-crema hover:bg-rojo"
          >
            +
          </button>
        </div>
        <button
          type="button"
          disabled={!puedeAgregar}
          onClick={agregarAlCarrito}
          className="flex flex-1 items-center justify-between rounded-full bg-rojo px-5 py-3 font-semibold text-crema transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
        >
          <span>Agregar</span>
          <span>{puedeAgregar ? formatearPrecio(precioUnitario * cantidad) : "—"}</span>
        </button>
      </div>
    </>
  );
}

// Fila seleccionable (radio o casilla) con nombre y precio opcional.
function EtiquetaOpcion({
  tipo,
  nombre,
  marcada,
  deshabilitada,
  onCambio,
  texto,
  precio,
}: {
  tipo: "radio" | "checkbox";
  nombre: string;
  marcada: boolean;
  deshabilitada?: boolean;
  onCambio: () => void;
  texto: string;
  precio?: string;
}) {
  return (
    <label
      className={`flex cursor-pointer items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm transition-colors ${
        marcada ? "border-rojo bg-rojo/5" : "border-negro/15 bg-white"
      } ${deshabilitada ? "cursor-not-allowed opacity-40" : ""}`}
    >
      <span className="flex items-center gap-3">
        <input
          type={tipo}
          name={nombre}
          checked={marcada}
          disabled={deshabilitada}
          // En radios, un segundo clic no dispara onChange; onClick cubre la deselección.
          onChange={tipo === "checkbox" ? onCambio : () => {}}
          onClick={tipo === "radio" ? onCambio : undefined}
          className="h-4 w-4 accent-rojo"
        />
        {texto}
      </span>
      {precio && <span className="font-semibold">{precio}</span>}
    </label>
  );
}
