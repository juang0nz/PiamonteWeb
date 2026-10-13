import type { PostgrestError } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import type {
  ConfiguracionProducto,
  GrupoOpciones,
  Opcion,
  ReglaOpcionVariante,
  VarianteProducto,
} from "./tipos";

// Error de una consulta de configuración que conserva los datos originales de Supabase.
export class ErrorConfiguracion extends Error {
  constructor(
    readonly tabla: string,
    readonly original: PostgrestError,
  ) {
    super(`[${tabla}] ${original.message} (código ${original.code})`);
    this.name = "ErrorConfiguracion";
  }
}

// Registra en consola el error real de Supabase y lo relanza sin ocultarlo.
function verificar<T>(
  tabla: string,
  resultado: { data: T | null; error: PostgrestError | null },
): T {
  if (resultado.error) {
    const { message, code, details, hint } = resultado.error;
    console.error(`Error de Supabase al consultar "${tabla}":`, {
      message,
      code,
      details,
      hint,
    });
    throw new ErrorConfiguracion(tabla, resultado.error);
  }
  return resultado.data as T;
}

type FilaGrupo = Omit<GrupoOpciones, "opciones">;
type FilaOpcion = {
  id: string;
  grupo_id: string;
  nombre: string;
  precio_adicional: number | string;
};

// Consulta (desde el navegador) variantes, grupos, opciones y reglas del producto elegido.
// Se usan consultas separadas por producto_id y grupo_id, sin embeds, para no depender
// de relaciones inferidas (reglas_opciones_variante tiene varias FKs). Los resultados
// se relacionan por ID. El catálogo cargado por el servidor aporta la lista
// autoritativa de variantes, incluidas las agotadas; las opciones agotadas
// siguen sin ser elegibles.
export async function obtenerConfiguracionProducto(
  productoId: string,
): Promise<ConfiguracionProducto> {
  const supabase = createClient();

  const [resVariantes, resGrupos, resReglas] = await Promise.all([
    supabase
      .from("variantes_producto")
      .select("id, nombre, precio, disponible")
      .eq("producto_id", productoId)
      .order("orden", { ascending: true }),
    supabase
      .from("grupos_opciones")
      .select("id, nombre, minimo, maximo, obligatorio")
      .eq("producto_id", productoId)
      .eq("activo", true)
      .order("orden", { ascending: true }),
    supabase
      .from("reglas_opciones_variante")
      .select("variante_id, grupo_id, minimo, maximo")
      .eq("producto_id", productoId)
      .eq("activo", true),
  ]);

  const variantes = verificar("variantes_producto", resVariantes) ?? [];
  const grupos = (verificar("grupos_opciones", resGrupos) ?? []) as FilaGrupo[];
  const reglas = verificar("reglas_opciones_variante", resReglas) ?? [];

  // Las opciones se consultan por los IDs de los grupos activos del producto.
  const idsGrupos = grupos.map((g) => g.id);
  let opciones: FilaOpcion[] = [];
  if (idsGrupos.length > 0) {
    const resOpciones = await supabase
      .from("opciones")
      .select("id, grupo_id, nombre, precio_adicional")
      .in("grupo_id", idsGrupos)
      .eq("disponible", true)
      .order("orden", { ascending: true });
    opciones = (verificar("opciones", resOpciones) ?? []) as FilaOpcion[];
  }

  // Las reglas solo valen si apuntan a una variante del producto y a un grupo activo.
  const idsVariantes = new Set(variantes.map((v) => v.id));
  const grupoActivo = new Set(idsGrupos);

  return {
    variantes: variantes.map(
      (v): VarianteProducto => ({
        id: v.id,
        nombre: v.nombre,
        precio: Number(v.precio),
        disponible: v.disponible,
      }),
    ),
    grupos: grupos.map(
      (g): GrupoOpciones => ({
        id: g.id,
        nombre: g.nombre,
        minimo: g.minimo,
        maximo: g.maximo,
        obligatorio: g.obligatorio,
        opciones: opciones
          .filter((o) => o.grupo_id === g.id)
          .map(
            (o): Opcion => ({
              id: o.id,
              nombre: o.nombre,
              precio_adicional: Number(o.precio_adicional),
            }),
          ),
      }),
    ),
    reglas: (reglas as ReglaOpcionVariante[]).filter(
      (r) => idsVariantes.has(r.variante_id) && grupoActivo.has(r.grupo_id),
    ),
  };
}
