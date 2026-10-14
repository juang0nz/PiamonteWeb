import { NextResponse } from "next/server";
import { obtenerEstadoAccesoAdmin } from "@/lib/admin/auth";
import { comprobarCuentaEmpleado, urlAccesoEmpleado } from "@/lib/admin/accesoEmpleados";
import { createPrivateClient } from "@/lib/supabase/private";
import { createClient } from "@/lib/supabase/server";

const UUID_VALIDO = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function respuesta(error: string, status: number) {
  return NextResponse.json({ error }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) {
    return respuesta("Origen de la solicitud no autorizado.", 403);
  }
  const acceso = await obtenerEstadoAccesoAdmin();
  if (!acceso.autenticado) return respuesta("Iniciá sesión para administrar empleados.", 401);
  if (!acceso.autorizado || acceso.rol === "empleado") {
    return respuesta("No tenés autorización para administrar empleados.", 403);
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return respuesta("La solicitud no es JSON válido.", 400);
  }
  if (!body || typeof body !== "object") return respuesta("Solicitud inválida.", 400);
  const { userId, tipo, operacionId } = body as Record<string, unknown>;
  if (typeof userId !== "string" || !UUID_VALIDO.test(userId) ||
      typeof operacionId !== "string" || !UUID_VALIDO.test(operacionId) ||
      (tipo !== "invitacion" && tipo !== "recuperacion")) {
    return respuesta("Los datos de la acción de acceso no son válidos.", 400);
  }

  let redirectTo: string;
  try {
    redirectTo = urlAccesoEmpleado();
  } catch {
    console.error("Falta configurar una URL pública válida para el acceso de empleados.");
    return respuesta("Falta configurar la URL pública de los correos de acceso.", 503);
  }
  const privado = createPrivateClient();
  try {
    if (!await comprobarCuentaEmpleado(privado, userId, acceso.comercioId)) {
      return respuesta("Solo podés gestionar empleados activos y exclusivos de este comercio.", 403);
    }
  } catch {
    return respuesta("No pudimos verificar los permisos de la cuenta.", 503);
  }
  const { data, error } = await privado.auth.admin.getUserById(userId);
  if (error || !data.user?.email) {
    console.error("No se pudo consultar la cuenta de acceso:", { code: error?.code });
    return respuesta("No pudimos consultar el correo registrado del empleado.", 502);
  }
  if (data.user.banned_until && Date.parse(data.user.banned_until) > Date.now()) {
    return respuesta("La cuenta está bloqueada en Supabase Auth.", 409);
  }
  if (tipo === "invitacion" && data.user.email_confirmed_at) {
    return respuesta("El correo ya está confirmado. Usá Restablecer contraseña.", 409);
  }

  const sesion = await createClient();
  const { data: iniciada, error: inicioError } = await sesion.rpc(
    "admin_iniciar_acceso_empleado_auditado",
    { p_operacion_id: operacionId, p_comercio_id: acceso.comercioId, p_user_id: userId, p_tipo: tipo },
  );
  if (inicioError) {
    console.error("No se pudo auditar la solicitud de acceso:", { code: inicioError.code });
    if (inicioError.code === "54000") return respuesta("Esperá un minuto antes de enviar otro correo.", 429);
    if (inicioError.code === "42501") return respuesta("La cuenta no admite esta gestión de acceso.", 403);
    return respuesta("No se pudo iniciar la auditoría. Revisá la instalación de acceso de empleados.", 503);
  }
  if (iniciada !== true) return respuesta("Esta operación ya fue procesada. Actualizá el listado.", 409);

  let enviado = false;
  try {
    if (tipo === "invitacion") {
      const resultado = await privado.auth.admin.inviteUserByEmail(data.user.email, { redirectTo });
      enviado = !resultado.error && resultado.data.user?.id === userId;
      if (!enviado) console.error("Supabase rechazó el reenvío de invitación:", { code: resultado.error?.code });
    } else {
      const resultado = await privado.auth.resetPasswordForEmail(data.user.email, { redirectTo });
      enviado = !resultado.error;
      if (!enviado) console.error("Supabase rechazó el correo de recuperación:", { code: resultado.error?.code });
    }
  } catch {
    console.error("Falló la comunicación con Supabase al solicitar el correo de acceso.");
  }
  const { error: cierreError } = await sesion.rpc(
    "admin_finalizar_acceso_empleado_auditado",
    { p_operacion_id: operacionId, p_enviado: enviado },
  );
  if (cierreError) {
    console.error("No se pudo finalizar la auditoría de acceso:", { code: cierreError.code });
    return respuesta(
      enviado
        ? "Supabase aceptó el envío, pero no se pudo cerrar la auditoría. No lo reintentes de inmediato."
        : "Falló el envío y no se pudo cerrar la auditoría. La solicitud inicial quedó registrada.",
      503,
    );
  }
  if (!enviado) return respuesta("No se pudo enviar el correo. Revisá SMTP y los límites de Supabase.", 502);
  return NextResponse.json({
    mensaje: tipo === "invitacion"
      ? "Supabase aceptó el envío de la invitación. Esto no confirma su recepción ni aceptación."
      : "Supabase aceptó el envío del enlace para establecer una nueva contraseña al correo registrado.",
  }, { headers: { "Cache-Control": "no-store" } });
}
