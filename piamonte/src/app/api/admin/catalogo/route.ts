import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { obtenerEstadoAccesoAdmin } from "@/lib/admin/auth";
import { createPrivateClient } from "@/lib/supabase/private";
import { createClient } from "@/lib/supabase/server";

const UUID_VALIDO =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PRECIO_MAXIMO = 10_000_000;

type TipoRecurso = "categoria" | "producto" | "variante";

type CategoriaFila = {
  id: string;
  nombre: string;
  slug: string;
  descripcion: string | null;
  imagen_url: string | null;
  orden: number;
  activa: boolean;
};

type VarianteFila = {
  id: string;
  nombre: string;
  precio: number | string;
  disponible: boolean;
  orden: number;
};

type ProductoFila = {
  id: string;
  categoria_id: string;
  nombre: string;
  descripcion: string | null;
  imagen_url: string | null;
  tipo: string;
  precio_base: number | string | null;
  activo: boolean;
  disponible: boolean;
  destacado: boolean;
  orden: number;
  variantes_producto: VarianteFila[];
};

async function verificarAcceso() {
  const acceso = await obtenerEstadoAccesoAdmin();
  if (!acceso.autenticado) {
    return {
      respuesta: NextResponse.json(
        { error: "No autenticado para administrar el catálogo." },
        { status: 401 },
      ),
    };
  }
  if (!acceso.autorizado || acceso.rol === "empleado") {
    return {
      respuesta: NextResponse.json(
        { error: "No autorizado para administrar este comercio." },
        { status: 403 },
      ),
    };
  }
  return { acceso };
}

function texto(
  valor: unknown,
  campo: string,
  maximo: number,
  obligatorio = true,
) {
  if (typeof valor !== "string") {
    throw new Error(`${campo} no es válido.`);
  }
  const normalizado = valor.trim().replace(/\s+/g, " ");
  if (obligatorio && !normalizado) {
    throw new Error(`${campo} es obligatorio.`);
  }
  if (normalizado.length > maximo) {
    throw new Error(`${campo} supera el máximo de ${maximo} caracteres.`);
  }
  return normalizado || null;
}

function uuid(valor: unknown, campo: string) {
  if (typeof valor !== "string" || !UUID_VALIDO.test(valor)) {
    throw new Error(`${campo} no es válido.`);
  }
  return valor;
}

function operacionId(valor: unknown) {
  return uuid(valor, "La operación");
}

function booleano(valor: unknown, campo: string) {
  if (typeof valor !== "boolean") {
    throw new Error(`${campo} no es válido.`);
  }
  return valor;
}

function precio(valor: unknown, campo: string, permiteNull = false) {
  if (permiteNull && (valor === null || valor === "")) return null;
  if (typeof valor !== "number" || !Number.isFinite(valor)) {
    throw new Error(`${campo} no es válido.`);
  }
  if (valor < 0 || valor > PRECIO_MAXIMO) {
    throw new Error(`${campo} debe estar entre 0 y ${PRECIO_MAXIMO}.`);
  }
  return Math.round(valor * 100) / 100;
}

function imagen(valor: unknown) {
  const resultado = texto(valor ?? "", "La imagen", 2048, false);
  if (
    resultado &&
    !resultado.startsWith("/") &&
    !/^https?:\/\//i.test(resultado)
  ) {
    throw new Error("La imagen debe ser una URL HTTP(S) o una ruta pública.");
  }
  return resultado;
}

function slugificar(valor: string) {
  return (
    valor
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 70) || "categoria"
  );
}

function tipoRecurso(valor: unknown): TipoRecurso {
  if (
    valor === "categoria" ||
    valor === "producto" ||
    valor === "variante"
  ) {
    return valor;
  }
  throw new Error("El tipo de recurso no es válido.");
}

function errorSupabase(
  error: {
    code: string;
    message: string;
    details: string | null;
    hint: string | null;
  },
  operacion: string,
) {
  console.error(`Error de Supabase al ${operacion}:`, {
    code: error.code,
    message: error.message,
    details: error.details,
    hint: error.hint,
  });
  if (error.code === "42501") {
    return NextResponse.json(
      {
        error:
          "Falta ejecutar la configuración de permisos para gestionar el catálogo.",
      },
      { status: 503 },
    );
  }
  if (error.code === "23505") {
    return NextResponse.json(
      { error: "Ya existe un registro con esos datos." },
      { status: 409 },
    );
  }
  if (error.code === "23503") {
    return NextResponse.json(
      {
        error:
          "La categoría fue eliminada del catálogo. Elegí una categoría vigente.",
      },
      { status: 409 },
    );
  }
  if (error.code === "P0002") {
    return NextResponse.json(
      { error: "El registro no existe o no pertenece al comercio autorizado." },
      { status: 404 },
    );
  }
  if (error.code === "40001") {
    return NextResponse.json(
      { error: "El registro cambió recientemente. Actualizá y reintentá." },
      { status: 409 },
    );
  }
  return NextResponse.json(
    { error: `No pudimos ${operacion}.` },
    { status: 500 },
  );
}

async function siguienteOrden(
  supabase: ReturnType<typeof createPrivateClient>,
  tabla: "categorias" | "productos" | "variantes_producto",
  filtro?: { campo: "comercio_id" | "categoria_id" | "producto_id"; id: string },
) {
  let consulta = supabase
    .from(tabla)
    .select("orden")
    .order("orden", { ascending: false })
    .limit(1);
  if (filtro) consulta = consulta.eq(filtro.campo, filtro.id);
  const { data, error } = await consulta;
  if (error) throw error;
  return Number(data?.[0]?.orden ?? 0) + 1;
}

export async function GET() {
  const verificacion = await verificarAcceso();
  if ("respuesta" in verificacion) return verificacion.respuesta;

  const supabase = createPrivateClient();
  const { acceso } = verificacion;
  // "activo" distingue los productos eliminados de los simplemente agotados.
  const consultarProductos = (incluirActivo: boolean) => {
    const consulta = supabase
      .from("productos")
      .select(
        incluirActivo
          ? "id, categoria_id, nombre, descripcion, imagen_url, tipo, precio_base, activo, disponible, destacado, orden, variantes_producto(id, nombre, precio, disponible, orden)"
          : "id, categoria_id, nombre, descripcion, imagen_url, tipo, precio_base, disponible, destacado, orden, variantes_producto(id, nombre, precio, disponible, orden)",
      )
      .eq("comercio_id", acceso.comercioId);
    return (incluirActivo ? consulta.eq("activo", true) : consulta)
      .order("orden", { ascending: true })
      .order("orden", {
        ascending: true,
        referencedTable: "variantes_producto",
      });
  };
  // "eliminada" es un nivel distinto de "activa": las inactivas siguen en el panel.
  const consultarCategorias = (incluirEliminada: boolean) => {
    const consulta = supabase
      .from("categorias")
      .select("id, nombre, slug, descripcion, imagen_url, orden, activa")
      .eq("comercio_id", acceso.comercioId);
    return (
      incluirEliminada ? consulta.eq("eliminada", false) : consulta
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

  if (respuestaCategorias.error || respuestaProductos.error) {
    return errorSupabase(
      respuestaCategorias.error ?? respuestaProductos.error!,
      "consultar el catálogo",
    );
  }

  const filasProductos = (respuestaProductos.data ?? []) as unknown as Array<
    Omit<ProductoFila, "activo"> & { activo?: boolean }
  >;
  const productos: ProductoFila[] = filasProductos.map((producto) => ({
    ...producto,
    activo: producto.activo ?? true,
  }));
  const productosPorCategoria = new Map<string, ProductoFila[]>();
  for (const producto of productos) {
    const lista = productosPorCategoria.get(producto.categoria_id) ?? [];
    lista.push(producto);
    productosPorCategoria.set(producto.categoria_id, lista);
  }

  return NextResponse.json(
    {
      categorias: ((respuestaCategorias.data ?? []) as CategoriaFila[]).map(
        (categoria) => ({
          ...categoria,
          productos: (productosPorCategoria.get(categoria.id) ?? []).map(
            (producto) => ({
              ...producto,
              precio_base:
                producto.precio_base === null
                  ? null
                  : Number(producto.precio_base),
              variantes: producto.variantes_producto.map((variante) => ({
                id: variante.id,
                nombre: variante.nombre,
                precio: Number(variante.precio),
                disponible: variante.disponible,
                orden: variante.orden,
              })),
              variantes_producto: undefined,
            }),
          ),
        }),
      ),
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

export async function POST(request: Request) {
  const verificacion = await verificarAcceso();
  if ("respuesta" in verificacion) return verificacion.respuesta;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "El cuerpo de la solicitud no es JSON válido." },
      { status: 400 },
    );
  }

  const payload = body as Record<string, unknown>;
  let tipo: TipoRecurso;
  try {
    tipo = tipoRecurso(payload.tipo);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Datos inválidos." },
      { status: 400 },
    );
  }

  const supabase = createPrivateClient();
  const supabaseSesion = await createClient();
  const { acceso } = verificacion;
  let categoriaCreada: CategoriaFila | null = null;

  try {
    const idOperacion = operacionId(payload.operacionId);
    if (tipo === "categoria") {
      const nombre = texto(payload.nombre, "El nombre", 120)!;
      const baseSlug = slugificar(nombre);
      const { data: existentes, error: slugError } = await supabase
        .from("categorias")
        .select("slug")
        .eq("comercio_id", acceso.comercioId)
        .like("slug", `${baseSlug}%`);
      if (slugError) return errorSupabase(slugError, "validar la categoría");
      const slugs = new Set((existentes ?? []).map((fila) => fila.slug));
      let slug = baseSlug;
      for (let sufijo = 2; slugs.has(slug); sufijo += 1) {
        slug = `${baseSlug}-${sufijo}`;
      }
      const orden = await siguienteOrden(supabase, "categorias", {
        campo: "comercio_id",
        id: acceso.comercioId,
      });
      const { data: categoriaId, error } = await supabaseSesion.rpc(
        "admin_crear_categoria_auditada",
        {
          p_operacion_id: idOperacion,
          p_comercio_id: acceso.comercioId,
          p_nombre: nombre,
          p_slug: slug,
          p_descripcion: texto(
            payload.descripcion ?? "",
            "La descripción",
            1000,
            false,
          ),
          p_imagen_url: imagen(payload.imagenUrl),
          p_orden: orden,
        },
      );
      if (error) return errorSupabase(error, "crear la categoría");
      categoriaCreada = {
        id: String(categoriaId),
        nombre,
        slug,
        descripcion: texto(
          payload.descripcion ?? "",
          "La descripción",
          1000,
          false,
        ),
        imagen_url: imagen(payload.imagenUrl),
        orden,
        activa: true,
      };
    } else if (tipo === "producto") {
      const categoriaId = uuid(payload.categoriaId, "La categoría");
      const orden = await siguienteOrden(supabase, "productos", {
        campo: "categoria_id",
        id: categoriaId,
      });
      const { error } = await supabaseSesion.rpc(
        "admin_crear_producto_auditado",
        {
          p_operacion_id: idOperacion,
          p_comercio_id: acceso.comercioId,
          p_categoria_id: categoriaId,
          p_nombre: texto(payload.nombre, "El nombre", 160),
          p_descripcion: texto(
            payload.descripcion ?? "",
            "La descripción",
            2000,
            false,
          ),
          p_imagen_url: imagen(payload.imagenUrl),
          p_tipo: "simple",
          p_precio_base: precio(
            payload.precioBase,
            "El precio base",
            true,
          ),
          p_orden: orden,
        },
      );
      if (error) return errorSupabase(error, "crear el producto");
    } else {
      const productoId = uuid(payload.productoId, "El producto");
      const orden = await siguienteOrden(supabase, "variantes_producto", {
        campo: "producto_id",
        id: productoId,
      });
      const { error } = await supabaseSesion.rpc(
        "admin_crear_variante_auditada",
        {
          p_operacion_id: idOperacion,
          p_comercio_id: acceso.comercioId,
          p_producto_id: productoId,
          p_nombre: texto(payload.nombre, "El nombre", 120),
          p_precio: precio(payload.precio, "El precio"),
          p_orden: orden,
        },
      );
      if (error) return errorSupabase(error, "crear la variante");
    }
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      typeof error.code === "string"
    ) {
      return errorSupabase(
        error as {
          code: string;
          message: string;
          details: string | null;
          hint: string | null;
        },
        "crear el registro",
      );
    }
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Los datos no son válidos.",
      },
      { status: 400 },
    );
  }

  revalidatePath("/");
  return NextResponse.json(
    {
      ok: true,
      ...(categoriaCreada ? { categoria: categoriaCreada } : {}),
    },
    { status: 201 },
  );
}

export async function PATCH(request: Request) {
  const verificacion = await verificarAcceso();
  if ("respuesta" in verificacion) return verificacion.respuesta;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "El cuerpo de la solicitud no es JSON válido." },
      { status: 400 },
    );
  }

  const payload = body as Record<string, unknown>;
  let tipo: TipoRecurso;
  let id: string;
  try {
    tipo = tipoRecurso(payload.tipo);
    id = uuid(payload.id, "El registro");
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Datos inválidos." },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const { acceso } = verificacion;

  try {
    const idOperacion = operacionId(payload.operacionId);
    if (tipo === "categoria") {
      const { error } = await supabase.rpc(
        "admin_actualizar_categoria_auditada",
        {
          p_operacion_id: idOperacion,
          p_comercio_id: acceso.comercioId,
          p_categoria_id: id,
          p_nombre: texto(payload.nombre, "El nombre", 120),
          p_descripcion: texto(
            payload.descripcion ?? "",
            "La descripción",
            1000,
            false,
          ),
          p_imagen_url: imagen(payload.imagenUrl),
          p_activa: booleano(payload.activa, "El estado"),
        },
      );
      if (error) return errorSupabase(error, "actualizar la categoría");
    } else if (tipo === "producto") {
      const categoriaId = uuid(payload.categoriaId, "La categoría");
      const { error } = await supabase.rpc(
        "admin_actualizar_producto_auditado",
        {
          p_operacion_id: idOperacion,
          p_comercio_id: acceso.comercioId,
          p_producto_id: id,
          p_categoria_id: categoriaId,
          p_nombre: texto(payload.nombre, "El nombre", 160),
          p_descripcion: texto(
            payload.descripcion ?? "",
            "La descripción",
            2000,
            false,
          ),
          p_imagen_url: imagen(payload.imagenUrl),
          p_precio_base: precio(
            payload.precioBase,
            "El precio base",
            true,
          ),
          p_disponible: booleano(
            payload.disponible,
            "La disponibilidad",
          ),
          p_destacado: booleano(
            payload.destacado,
            "El estado destacado",
          ),
        },
      );
      if (error) return errorSupabase(error, "actualizar el producto");
    } else {
      const { error } = await supabase.rpc(
        "admin_actualizar_variante_auditada",
        {
          p_operacion_id: idOperacion,
          p_comercio_id: acceso.comercioId,
          p_variante_id: id,
          p_nombre: texto(payload.nombre, "El nombre", 120),
          p_precio: precio(payload.precio, "El precio"),
          p_disponible: booleano(
            payload.disponible,
            "La disponibilidad",
          ),
        },
      );
      if (error) return errorSupabase(error, "actualizar la variante");
    }
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Los datos no son válidos.",
      },
      { status: 400 },
    );
  }

  revalidatePath("/");
  return NextResponse.json({ ok: true }, { status: 200 });
}

export async function DELETE(request: Request) {
  const verificacion = await verificarAcceso();
  if ("respuesta" in verificacion) return verificacion.respuesta;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "El cuerpo de la solicitud no es JSON válido." },
      { status: 400 },
    );
  }

  const payload = body as Record<string, unknown>;
  const tipo =
    payload.tipo === "categoria" || payload.tipo === "producto"
      ? payload.tipo
      : null;
  let id: string;
  let idOperacion: string;
  try {
    id = uuid(payload.id, "El registro");
    idOperacion = operacionId(payload.operacionId);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Datos inválidos." },
      { status: 400 },
    );
  }
  if (!tipo) {
    return NextResponse.json(
      { error: "El tipo de registro no es válido." },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const funcion =
    tipo === "categoria"
      ? "super_admin_eliminar_categoria_auditada"
      : "super_admin_eliminar_producto_auditado";
  const parametro =
    tipo === "categoria"
      ? { p_categoria_id: id }
      : { p_producto_id: id };
  const { error } = await supabase.rpc(funcion, {
    p_operacion_id: idOperacion,
    p_comercio_id: verificacion.acceso.comercioId,
    ...parametro,
  });

  if (error) {
    if (error.code === "PGRST202" || error.code === "42703") {
      return NextResponse.json(
        {
          error:
            "Falta ejecutar la configuración de baja lógica en Supabase.",
        },
        { status: 503 },
      );
    }
    return errorSupabase(error, `eliminar ${tipo}`);
  }

  revalidatePath("/");
  return NextResponse.json({ ok: true, tipo, id }, { status: 200 });
}
