import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { obtenerEstadoAccesoAdmin } from "@/lib/admin/auth";
import { createClient } from "@/lib/supabase/server";
import { esConfiguracionDescuentoWeb } from "@/lib/comercio/descuento-web";

const UUID_VALIDO = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function verificarAcceso() {
  const acceso = await obtenerEstadoAccesoAdmin();
  if (!acceso.autenticado) {
    return { respuesta: NextResponse.json({ error: "Iniciá sesión para administrar el descuento web." }, { status: 401 }) };
  }
  if (!acceso.autorizado || !["owner", "admin", "super_admin"].includes(acceso.rol)) {
    return { respuesta: NextResponse.json({ error: "No tenés permisos para administrar el descuento web." }, { status: 403 }) };
  }
  return { acceso };
}

function respuestaRpc(data: unknown, error: { code: string; message: string } | null, comercioId: string) {
  if (error) {
    console.error("[descuento-web] Error de RPC administrativa:", error);
    if (["PGRST202", "PGRST204", "42703", "42P01"].includes(error.code)) {
      return NextResponse.json({ error: "Descuento web no disponible: falta aplicar la migración de promociones de PIA-4." }, { status: 503 });
    }
    if (error.code === "42501") {
      return NextResponse.json({ error: "No tenés permisos para administrar el descuento web." }, { status: 403 });
    }
    if (error.code === "22023") {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error.code === "P0002") {
      return NextResponse.json({ error: "El comercio no tiene configurado el descuento web." }, { status: 404 });
    }
    return NextResponse.json({ error: "No pudimos consultar o guardar el descuento web." }, { status: 500 });
  }
  if (!esConfiguracionDescuentoWeb(data) || !("comercio_id" in data) ||
    data.comercio_id !== comercioId || !("clave" in data) || data.clave !== "descuento_web") {
    console.error("[descuento-web] Respuesta administrativa inválida");
    return NextResponse.json({ error: "No pudimos confirmar la configuración del descuento web. Recargá para consultar su estado." }, { status: 502 });
  }
  return NextResponse.json({ descuentoWeb: { activa: data.activa, valor: data.valor } }, {
    headers: { "Cache-Control": "private, no-store" },
  });
}

export async function GET() {
  const verificacion = await verificarAcceso();
  if ("respuesta" in verificacion) return verificacion.respuesta;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_obtener_descuento_web", {
    p_comercio_id: verificacion.acceso.comercioId,
  });
  return respuestaRpc(data, error, verificacion.acceso.comercioId);
}

export async function PATCH(request: Request) {
  const verificacion = await verificarAcceso();
  if ("respuesta" in verificacion) return verificacion.respuesta;
  let cuerpo: unknown;
  try {
    cuerpo = await request.json();
  } catch {
    return NextResponse.json({ error: "El cuerpo debe ser JSON válido." }, { status: 400 });
  }
  if (typeof cuerpo !== "object" || cuerpo === null || !("operacionId" in cuerpo) ||
    typeof cuerpo.operacionId !== "string" || !UUID_VALIDO.test(cuerpo.operacionId)) {
    return NextResponse.json({ error: "Falta un identificador de operación válido." }, { status: 400 });
  }
  if (!("cambios" in cuerpo) || !esConfiguracionDescuentoWeb(cuerpo.cambios) ||
    Object.keys(cuerpo.cambios).some(clave => !["activa", "valor"].includes(clave))) {
    return NextResponse.json({ error: "Indicá el estado activo y un porcentaje entero entre 0 y 100, sin otros cambios." }, { status: 400 });
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_actualizar_descuento_web", {
    p_operacion_id: cuerpo.operacionId,
    p_comercio_id: verificacion.acceso.comercioId,
    p_cambios: { activa: cuerpo.cambios.activa, valor: cuerpo.cambios.valor },
  });
  if (!error) {
    revalidatePath("/");
    revalidatePath("/checkout");
  }
  return respuestaRpc(data, error, verificacion.acceso.comercioId);
}
