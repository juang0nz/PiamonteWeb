import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { obtenerEstadoAccesoAdmin } from "@/lib/admin/auth";
import {
  CLAVES_CONFIGURACION,
  CLAVES_RANGOS,
  validarCostoEnvio,
  type ClaveConfiguracion,
  type ConfiguracionOperativa,
} from "@/lib/comercio/tiempos";
import { createClient } from "@/lib/supabase/server";

const UUID_VALIDO =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const COLUMNAS =
  "demanda, retiro_normal_min, retiro_normal_max, envio_normal_min, envio_normal_max, retiro_alta_min, retiro_alta_max, envio_alta_min, envio_alta_max, pedidos_pausados, mensaje_pausa, costo_envio, actualizado_en";

type FilaConfiguracion = ConfiguracionOperativa & { actualizado_en: string };

// Solo owner/admin (o super admin) administran la operación. El middleware ya devuelve 403
// al rol empleado fuera de /api/admin/pedidos; acá se repite por defensa en profundidad.
async function verificarAcceso() {
  const acceso = await obtenerEstadoAccesoAdmin();
  if (!acceso.autenticado) {
    return {
      respuesta: NextResponse.json(
        { error: "No autenticado para administrar la operación." },
        { status: 401 },
      ),
    };
  }
  if (!acceso.autorizado || acceso.rol === "empleado") {
    return {
      respuesta: NextResponse.json(
        { error: "No autorizado para administrar la operación de este comercio." },
        { status: 403 },
      ),
    };
  }
  return { acceso };
}

function respuestaConfiguracion(fila: FilaConfiguracion, status = 200) {
  return NextResponse.json({ configuracion: fila }, { status });
}

// Configuración operativa vigente del comercio autorizado.
export async function GET() {
  const verificacion = await verificarAcceso();
  if ("respuesta" in verificacion) return verificacion.respuesta;
  const { acceso } = verificacion;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("comercio_configuracion")
    .select(COLUMNAS)
    .eq("comercio_id", acceso.comercioId)
    .maybeSingle();

  if (error) {
    if (error.code === "42703" || error.code === "PGRST204") {
      return errorConfiguracion(error);
    }
    console.error("Error al consultar la configuración operativa:", {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
    return NextResponse.json(
      { error: "No pudimos consultar la configuración del comercio." },
      { status: 500 },
    );
  }
  if (!data) {
    return NextResponse.json(
      { error: "El comercio todavía no tiene configuración operativa. Guardá un cambio para crearla." },
      { status: 404 },
    );
  }
  return respuestaConfiguracion(data as FilaConfiguracion);
}

// Aplica cambios parciales mediante la RPC auditada, con el cliente de sesión para que
// auth.uid() llegue a la auditoría. Solo se envían las claves permitidas.
export async function PATCH(request: Request) {
  const verificacion = await verificarAcceso();
  if ("respuesta" in verificacion) return verificacion.respuesta;
  const { acceso } = verificacion;

  let cuerpo: { cambios?: unknown; operacionId?: unknown };
  try {
    cuerpo = (await request.json()) as typeof cuerpo;
  } catch {
    return NextResponse.json({ error: "El cuerpo debe ser JSON válido." }, { status: 400 });
  }

  const operacionId = typeof cuerpo.operacionId === "string" ? cuerpo.operacionId : "";
  if (!UUID_VALIDO.test(operacionId)) {
    return NextResponse.json(
      { error: "Falta el identificador de operación." },
      { status: 400 },
    );
  }

  const cambios = normalizarCambios(cuerpo.cambios);
  if ("error" in cambios) {
    return NextResponse.json({ error: cambios.error }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_actualizar_configuracion_comercio", {
    p_operacion_id: operacionId,
    p_comercio_id: acceso.comercioId,
    p_cambios: cambios.valores,
  });

  if (error) {
    return errorConfiguracion(error);
  }

  // La carta y el checkout leen la configuración en cada request; se invalida igual por
  // si alguna ruta llega a cachearse.
  revalidatePath("/");
  revalidatePath("/checkout");
  return respuestaConfiguracion(data as FilaConfiguracion);
}

// Deja solo claves permitidas con tipos coherentes. La validación de rangos la hace la base.
function normalizarCambios(
  entrada: unknown,
): { valores: Partial<Record<ClaveConfiguracion, string | number | boolean>> } | { error: string } {
  if (!entrada || typeof entrada !== "object" || Array.isArray(entrada)) {
    return { error: "No se recibieron cambios de configuración." };
  }
  const valores: Partial<Record<ClaveConfiguracion, string | number | boolean>> = {};
  for (const [clave, valor] of Object.entries(entrada as Record<string, unknown>)) {
    if (!(CLAVES_CONFIGURACION as readonly string[]).includes(clave)) {
      return { error: `La clave "${clave}" no es configurable.` };
    }
    if (clave === "demanda") {
      if (valor !== "normal" && valor !== "alta") {
        return { error: "El nivel de demanda debe ser normal o alta." };
      }
      valores.demanda = valor;
    } else if (clave === "pedidos_pausados") {
      if (typeof valor !== "boolean") {
        return { error: "El estado de pausa debe ser verdadero o falso." };
      }
      valores.pedidos_pausados = valor;
    } else if (clave === "mensaje_pausa") {
      const texto = typeof valor === "string" ? valor.trim() : "";
      if (texto.length === 0 || texto.length > 280) {
        return { error: "El mensaje de pausa debe tener entre 1 y 280 caracteres." };
      }
      valores.mensaje_pausa = texto;
    } else if (clave === "costo_envio") {
      const error = validarCostoEnvio(valor);
      if (error) return { error };
      if (typeof valor === "number") valores.costo_envio = valor;
    } else if ((CLAVES_RANGOS as readonly string[]).includes(clave)) {
      if (typeof valor !== "number" || !Number.isInteger(valor)) {
        return { error: "Los minutos deben ser números enteros." };
      }
      valores[clave as ClaveConfiguracion] = valor;
    }
  }
  if (Object.keys(valores).length === 0) {
    return { error: "No se recibieron cambios de configuración." };
  }
  return { valores };
}

function errorConfiguracion(error: {
  code: string;
  message: string;
  details: string | null;
  hint: string | null;
}) {
  console.error("Error al actualizar la configuración operativa:", {
    code: error.code,
    message: error.message,
    details: error.details,
    hint: error.hint,
  });
  if (error.code === "22023") {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  if (error.code === "42501") {
    return NextResponse.json(
      { error: "No autorizado para modificar la configuración del comercio." },
      { status: 403 },
    );
  }
  if (error.code === "P0002") {
    return NextResponse.json({ error: "El comercio no existe." }, { status: 404 });
  }
  if (error.code === "42703" || error.code === "PGRST204") {
    return NextResponse.json(
      { error: "La tarifa de delivery todavía no está disponible: falta aplicar la migración de PIA-3 en Supabase." },
      { status: 503 },
    );
  }
  if (error.code === "PGRST202") {
    return NextResponse.json(
      { error: "Falta aplicar la migración de configuración operativa en Supabase." },
      { status: 503 },
    );
  }
  return NextResponse.json(
    { error: "No pudimos guardar la configuración del comercio." },
    { status: 500 },
  );
}
