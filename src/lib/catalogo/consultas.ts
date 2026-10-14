import "server-only";

import { createClient } from "@/lib/supabase/server";
import { createPrivateClient } from "@/lib/supabase/private";
import type {
  Catalogo,
  Categoria,
  Comercio,
  Producto,
  VarianteProducto,
} from "./tipos";

type FilaProducto = Omit<Producto, "variantes" | "precio_base"> & {
  precio_base: number | string | null;
  variantes_producto: {
    id: string;
    nombre: string;
    precio: number | string;
    disponible: boolean;
  }[];
};

// Obtiene un comercio activo por su slug. Devuelve null si no existe o no está activo.
export async function obtenerComercio(slug: string): Promise<Comercio | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("comercios")
    .select("id, nombre, slug")
    .eq("slug", slug)
    .eq("activo", true)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
}

// Obtiene el catálogo activo de un comercio a partir de su slug.
// Devuelve null si el comercio no existe o no está activo; lanza un error si falla una consulta.
export async function obtenerCatalogo(slug: string): Promise<Catalogo | null> {
  const supabase = await createClient();

  const comercio = await obtenerComercio(slug);
  if (!comercio) return null;

  // Los productos se leen con el cliente privilegiado del servidor porque la
  // política pública sólo expone los registros disponibles y el catálogo debe
  // mostrar también los agotados. La consulta queda acotada al comercio activo
  // y sólo pide columnas públicas del menú, que ya son visibles para cualquiera.
  const supabasePrivado = createPrivateClient();
  const consultarProductos = (filtrarActivos: boolean) => {
    let consulta = supabasePrivado
      .from("productos")
      .select(
        "id, categoria_id, nombre, descripcion, imagen_url, tipo, precio_base, destacado, disponible, variantes_producto(id, nombre, precio, disponible)",
      )
      .eq("comercio_id", comercio.id);
    if (filtrarActivos) {
      consulta = consulta.eq("activo", true);
    }
    return consulta
      .order("orden", { ascending: true })
      .order("orden", {
        ascending: true,
        referencedTable: "variantes_producto",
      });
  };

  // Las categorías eliminadas se excluyen aunque hayan quedado marcadas como
  // activas: "eliminada" es una baja lógica independiente de la visibilidad.
  const consultarCategorias = (filtrarEliminadas: boolean) => {
    const consulta = supabase
      .from("categorias")
      .select("id, nombre, slug, descripcion, imagen_url")
      .eq("comercio_id", comercio.id)
      .eq("activa", true);
    return (
      filtrarEliminadas ? consulta.eq("eliminada", false) : consulta
    ).order("orden", { ascending: true });
  };

  const [primeraRespuestaCategorias, primeraRespuestaProductos] =
    await Promise.all([consultarCategorias(true), consultarProductos(true)]);
  const columnaFaltante = (codigo: string | undefined) =>
    codigo === "42703" || codigo === "PGRST204";
  const respuestaCategorias = columnaFaltante(
    primeraRespuestaCategorias.error?.code,
  )
    ? await consultarCategorias(false)
    : primeraRespuestaCategorias;
  const respuestaProductos = columnaFaltante(
    primeraRespuestaProductos.error?.code,
  )
    ? await consultarProductos(false)
    : primeraRespuestaProductos;

  if (respuestaCategorias.error) throw new Error(respuestaCategorias.error.message);
  if (respuestaProductos.error) throw new Error(respuestaProductos.error.message);

  const productosPorCategoria = new Map<string, Producto[]>();
  for (const fila of (respuestaProductos.data ?? []) as unknown as FilaProducto[]) {
    const { variantes_producto, precio_base, ...resto } = fila;
    const variantes: VarianteProducto[] = variantes_producto.map((v) => ({
      id: v.id,
      nombre: v.nombre,
      precio: Number(v.precio),
      disponible: v.disponible,
    }));
    const producto: Producto = {
      ...resto,
      precio_base: precio_base === null ? null : Number(precio_base),
      variantes,
    };
    const lista = productosPorCategoria.get(producto.categoria_id) ?? [];
    lista.push(producto);
    productosPorCategoria.set(producto.categoria_id, lista);
  }

  const categorias: Categoria[] = (respuestaCategorias.data ?? []).map((c) => ({
    ...c,
    productos: productosPorCategoria.get(c.id) ?? [],
  }));

  return { comercio, categorias };
}
