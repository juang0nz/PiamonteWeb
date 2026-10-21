"use client";

import { useMemo, useSyncExternalStore } from "react";
import type { ItemCarrito } from "./tipos";

// Almacén del carrito persistido en localStorage y compartido entre componentes.

const CLAVE_ALMACENAMIENTO = "plataforma:carrito:v1";
const VACIO: ItemCarrito[] = [];

let items: ItemCarrito[] = VACIO;
let cargado = false;
const oyentes = new Set<() => void>();

function esItemValido(x: unknown): x is ItemCarrito {
  const i = x as ItemCarrito;
  return (
    !!i &&
    typeof i.clave === "string" &&
    typeof i.productoId === "string" &&
    typeof i.nombreProducto === "string" &&
    typeof i.precioUnitario === "number" &&
    typeof i.cantidad === "number" &&
    i.cantidad > 0 &&
    Array.isArray(i.opciones)
  );
}

function leerAlmacenamiento(): ItemCarrito[] {
  try {
    const crudo = window.localStorage.getItem(CLAVE_ALMACENAMIENTO);
    const datos: unknown = crudo ? JSON.parse(crudo) : [];
    return Array.isArray(datos) ? datos.filter(esItemValido) : VACIO;
  } catch {
    return VACIO;
  }
}

function avisar() {
  oyentes.forEach((oyente) => oyente());
}

function asegurarCarga() {
  if (cargado || typeof window === "undefined") return;
  cargado = true;
  items = leerAlmacenamiento();
  // Mantiene sincronizadas las pestañas abiertas.
  window.addEventListener("storage", (evento) => {
    if (evento.key === CLAVE_ALMACENAMIENTO) {
      items = leerAlmacenamiento();
      avisar();
    }
  });
}

function guardar(nuevos: ItemCarrito[]) {
  items = nuevos;
  try {
    window.localStorage.setItem(CLAVE_ALMACENAMIENTO, JSON.stringify(nuevos));
  } catch {
    // Si el almacenamiento no está disponible, el carrito sigue funcionando en memoria.
  }
  avisar();
}

function suscribir(oyente: () => void) {
  asegurarCarga();
  oyentes.add(oyente);
  return () => {
    oyentes.delete(oyente);
  };
}

function obtenerSnapshot() {
  asegurarCarga();
  return items;
}

// Agrega un ítem; si ya existe uno con la misma configuración, suma la cantidad.
export function agregarItem(nuevo: ItemCarrito) {
  asegurarCarga();
  const existente = items.find((i) => i.clave === nuevo.clave);
  guardar(
    existente
      ? items.map((i) =>
          i.clave === nuevo.clave
            ? { ...i, cantidad: i.cantidad + nuevo.cantidad }
            : i,
        )
      : [...items, nuevo],
  );
}

// Cambia la cantidad de un ítem; si llega a 0 se elimina.
export function cambiarCantidad(clave: string, cantidad: number) {
  asegurarCarga();
  guardar(
    cantidad <= 0
      ? items.filter((i) => i.clave !== clave)
      : items.map((i) => (i.clave === clave ? { ...i, cantidad } : i)),
  );
}

export function quitarItem(clave: string) {
  asegurarCarga();
  guardar(items.filter((i) => i.clave !== clave));
}

export function vaciarCarrito() {
  asegurarCarga();
  guardar([]);
}

export function useCarrito() {
  const lista = useSyncExternalStore(suscribir, obtenerSnapshot, () => VACIO);
  return useMemo(
    () => ({
      items: lista,
      cantidadTotal: lista.reduce((s, i) => s + i.cantidad, 0),
      total: lista.reduce((s, i) => s + Math.round(i.precioUnitario * 100) * i.cantidad, 0) / 100,
    }),
    [lista],
  );
}
