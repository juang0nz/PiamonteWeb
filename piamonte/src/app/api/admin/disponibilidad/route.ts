import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { obtenerEstadoAccesoAdmin } from "@/lib/admin/auth";
import { createPrivateClient } from "@/lib/supabase/private";
import { createClient } from "@/lib/supabase/server";

const UUID_VALIDO =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type CategoriaFila = {
  id: string;
  nombre: string;
  orden: number;
};

type VarianteFila = {
  id: string;
  nombre: string;
  disponible: boolean;
  orden: number;
};

type ProductoFila = {
  id: string;
  categoria_id: string;
  nombre: string;
  disponible: boolean;
  orden: number;
  variantes_producto: VarianteFila[];
};

async function verificarAcceso() {
  const acceso = await obtenerEstadoAccesoAdmin();
  if (!acceso.autenticado) {
    return {
      respuesta: NextResponse.json(
        { error: "No autenticado para administrar la disponibilidad." },
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

export async function GET() {
  const verificacion = await verificarAcceso();
  if ("respuesta" in verificacion) return verificacion.respuesta;

  const { acceso } = verificacion;
  const supabase = createPrivateClient();
  const [respuestaCategorias, respuestaProductos] = await Promise.all([
    supabase
      .from("categorias")
      .select("id, nombre, orden")
      .eq("comercio_id", acceso.comercioId)
      .order("orden", { ascending: true }),
    supabase
      .from("productos")
      .select(
        "id, categoria_id, nombre, disponible, orden, variantes_producto(id, nombre, disponible, orden)",
      )
      .eq("comercio_id", acceso.comercioId)
      .order("orden", { ascending: true })
      .order("orden", {
        ascending: true,
        referencedTable: "variantes_producto",
      }),
  ]);

  if (respuestaCategorias.error || respuestaProductos.error) {
    const error = respuestaCategorias.error ?? respuestaProductos.error;
    console.error("Error al consultar disponibilidad del catálogo:", {
      code: error?.code,
      message: error?.message,
      details: error?.details,
      hint: error?.hint,
    });
    return NextResponse.json(
      { error: "No pudimos consultar la disponibilidad del catálogo." },
      { status: 500 },
    );
  }

  const categorias = (respuestaCategorias.data ?? []) as CategoriaFila[];
  const productos = (respuestaProductos.data ?? []) as ProductoFila[];
  const productosPorCategoria = new Map<string, ProductoFila[]>();

  for (const producto of productos) {
    const lista = productosPorCategoria.get(producto.categoria_id) ?? [];
    lista.push(producto);
    productosPorCategoria.set(producto.categoria_id, lista);
  }

  return NextResponse.json(
    {
      categorias: categorias.map((categoria) => ({
        id: categoria.id,
        nombre: categoria.nombre,
        productos: (productosPorCategoria.get(categoria.id) ?? []).map(
          (producto) => ({
            id: producto.id,
            nombre: producto.nombre,
            disponible: producto.disponible,
            variantes: producto.variantes_producto.map((variante) => ({
              id: variante.id,
              nombre: variante.nombre,
              disponible: variante.disponible,
            })),
          }),
        ),
      })),
    },
    { status: 200 },
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

  const payload = body as {
    tipo?: unknown;
    id?: unknown;
    disponible?: unknown;
    operacionId?: unknown;
  };
  const tipo =
    payload.tipo === "producto" || payload.tipo === "variante"
      ? payload.tipo
      : null;
  const id = typeof payload.id === "string" ? payload.id.trim() : "";
  const disponible =
    typeof payload.disponible === "boolean" ? payload.disponible : null;
  const operacionId =
    typeof payload.operacionId === "string" ? payload.operacionId.trim() : "";

  if (
    !tipo ||
    !UUID_VALIDO.test(id) ||
    disponible === null ||
    !UUID_VALIDO.test(operacionId)
  ) {
    return NextResponse.json(
      { error: "Los datos de disponibilidad no son válidos." },
      { status: 400 },
    );
  }

  const { acceso } = verificacion;
  const supabase = await createClient();
  const funcion =
    tipo === "producto"
      ? "admin_cambiar_disponibilidad_producto_auditada"
      : "admin_cambiar_disponibilidad_variante_auditada";
  const identificador =
    tipo === "producto"
      ? { p_producto_id: id }
      : { p_variante_id: id };
  const { error } = await supabase.rpc(funcion, {
    p_operacion_id: operacionId,
    p_comercio_id: acceso.comercioId,
    ...identificador,
    p_disponible: disponible,
  });

  if (error) {
    return errorDisponibilidad(error, tipo);
  }

  revalidatePath("/");
  return NextResponse.json({ ok: true, tipo, id, disponible }, { status: 200 });
}

function errorDisponibilidad(
  error: {
    code: string;
    message: string;
    details: string | null;
    hint: string | null;
  },
  recurso: string,
) {
  console.error(`Error al actualizar disponibilidad de ${recurso}:`, {
    code: error.code,
    message: error.message,
    details: error.details,
    hint: error.hint,
  });
  if (error.code === "P0002") {
    return NextResponse.json(
      { error: `El registro de ${recurso} no pertenece al comercio autorizado.` },
      { status: 404 },
    );
  }
  if (error.code === "42501") {
    return NextResponse.json(
      { error: "No autorizado para modificar la disponibilidad." },
      { status: 403 },
    );
  }
  if (error.code === "PGRST202") {
    return NextResponse.json(
      { error: "Falta completar la instalación de auditoría en Supabase." },
      { status: 503 },
    );
  }
  return NextResponse.json(
    { error: `No pudimos actualizar la disponibilidad de ${recurso}.` },
    { status: 500 },
  );
}
