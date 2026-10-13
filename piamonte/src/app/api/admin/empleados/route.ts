import { NextResponse } from "next/server";
import { obtenerEstadoAccesoAdmin } from "@/lib/admin/auth";
import { createPrivateClient } from "@/lib/supabase/private";
import { createClient } from "@/lib/supabase/server";
import { listarUsuariosAuth } from "@/lib/super-admin/usuarios";

const EMAIL_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_VALIDO =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type VinculoEmpleado = {
  user_id: string;
  activo: boolean;
};

async function verificarAdministrador() {
  const acceso = await obtenerEstadoAccesoAdmin();
  if (!acceso.autenticado) {
    return {
      respuesta: NextResponse.json(
        { error: "Iniciá sesión para administrar empleados." },
        { status: 401 },
      ),
    };
  }
  if (!acceso.autorizado || acceso.rol === "empleado") {
    return {
      respuesta: NextResponse.json(
        { error: "No tenés autorización para administrar empleados." },
        { status: 403 },
      ),
    };
  }
  return { acceso };
}

function respuestaErrorRpc(
  error: {
    code: string;
    message: string;
    details: string | null;
    hint: string | null;
  },
  operacion: string,
) {
  console.error(`Error al ${operacion}:`, {
    code: error.code,
    message: error.message,
    details: error.details,
    hint: error.hint,
  });
  if (error.code === "42501") {
    return NextResponse.json(
      { error: "No tenés autorización para administrar empleados." },
      { status: 403 },
    );
  }
  if (error.code === "23505") {
    return NextResponse.json(
      { error: "Ese usuario ya está asignado al comercio." },
      { status: 409 },
    );
  }
  if (error.code === "P0002") {
    return NextResponse.json(
      { error: "El empleado o comercio indicado no existe." },
      { status: 404 },
    );
  }
  if (error.code === "40001") {
    return NextResponse.json(
      { error: "La operación ya fue finalizada o cambió recientemente." },
      { status: 409 },
    );
  }
  if (error.code === "PGRST202") {
    return NextResponse.json(
      { error: "Falta completar la instalación del rol Empleado." },
      { status: 503 },
    );
  }
  return NextResponse.json(
    { error: `No pudimos ${operacion}.` },
    { status: 500 },
  );
}

export async function GET() {
  const verificacion = await verificarAdministrador();
  if ("respuesta" in verificacion) return verificacion.respuesta;

  const privado = createPrivateClient();
  const { data, error } = await privado
    .from("admin_comercios")
    .select("user_id, activo")
    .eq("comercio_id", verificacion.acceso.comercioId)
    .eq("rol", "empleado")
    .order("user_id", { ascending: true });

  if (error) {
    console.error("Error al consultar empleados:", {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
    return NextResponse.json(
      { error: "No pudimos cargar los empleados." },
      { status: 500 },
    );
  }

  let usuarios: Awaited<ReturnType<typeof listarUsuariosAuth>>;
  try {
    usuarios = await listarUsuariosAuth(privado);
  } catch (errorDesconocido) {
    console.error("Error de Auth Admin al listar empleados:", errorDesconocido);
    return NextResponse.json(
      { error: "No pudimos consultar los correos de los empleados." },
      { status: 500 },
    );
  }

  const correos = new Map(
    usuarios.map((usuario) => [usuario.id, usuario.email ?? null]),
  );
  return NextResponse.json(
    {
      empleados: ((data ?? []) as VinculoEmpleado[]).map((vinculo) => ({
        userId: vinculo.user_id,
        email: correos.get(vinculo.user_id) ?? "Correo no disponible",
        activo: vinculo.activo,
      })),
    },
    {
      status: 200,
      headers: { "Cache-Control": "private, no-store" },
    },
  );
}

export async function POST(request: Request) {
  const verificacion = await verificarAdministrador();
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

  const payload = body as { email?: unknown; operacionId?: unknown };
  const email =
    typeof payload.email === "string"
      ? payload.email.trim().toLowerCase()
      : "";
  const operacionId =
    typeof payload.operacionId === "string" ? payload.operacionId.trim() : "";

  if (!EMAIL_VALIDO.test(email) || email.length > 254) {
    return NextResponse.json(
      { error: "Ingresá un correo electrónico válido." },
      { status: 400 },
    );
  }
  if (!UUID_VALIDO.test(operacionId)) {
    return NextResponse.json(
      { error: "La operación de invitación no es válida." },
      { status: 400 },
    );
  }

  const privado = createPrivateClient();
  const sesion = await createClient();
  let usuarios: Awaited<ReturnType<typeof listarUsuariosAuth>>;
  try {
    usuarios = await listarUsuariosAuth(privado);
  } catch (errorDesconocido) {
    console.error("Error de Auth Admin al buscar empleado:", errorDesconocido);
    return NextResponse.json(
      { error: "No pudimos verificar si el correo ya está registrado." },
      { status: 500 },
    );
  }

  let usuario = usuarios.find(
    (candidato) => candidato.email?.toLowerCase() === email,
  );
  let invitacionEnviada = false;

  if (usuario) {
    const { data: existente, error: existenteError } = await privado
      .from("admin_comercios")
      .select("rol, activo")
      .eq("user_id", usuario.id)
      .eq("comercio_id", verificacion.acceso.comercioId)
      .maybeSingle();

    if (existenteError) {
      console.error("Error al verificar empleado duplicado:", existenteError);
      return NextResponse.json(
        { error: "No pudimos verificar la asignación existente." },
        { status: 500 },
      );
    }
    if (existente) {
      const mensaje =
        existente.rol === "empleado"
          ? existente.activo
            ? "Ese correo ya corresponde a un empleado activo."
            : "Ese empleado ya existe y está inactivo. Reactivalo desde el listado."
          : "Ese usuario ya tiene otro rol en el comercio.";
      return NextResponse.json({ error: mensaje }, { status: 409 });
    }

    const { error } = await sesion.rpc("admin_asignar_empleado_auditado", {
      p_operacion_id: operacionId,
      p_comercio_id: verificacion.acceso.comercioId,
      p_user_id: usuario.id,
    });
    if (error) {
      return respuestaErrorRpc(error, "asignar el empleado");
    }
  } else {
    const { error: inicioError } = await sesion.rpc(
      "admin_iniciar_invitacion_empleado_auditada",
      {
        p_operacion_id: operacionId,
        p_comercio_id: verificacion.acceso.comercioId,
        p_email: email,
      },
    );
    if (inicioError) {
      return respuestaErrorRpc(inicioError, "iniciar la invitación");
    }

    const { data, error } =
      await privado.auth.admin.inviteUserByEmail(email);
    if (error || !data.user) {
      console.error("Error de Auth Admin al invitar empleado:", {
        status: error?.status,
        code: error?.code,
        message: error?.message,
      });
      const { error: cierreError } = await sesion.rpc(
        "admin_marcar_invitacion_empleado_fallida",
        {
          p_operacion_id: operacionId,
          p_motivo: "error_externo",
          p_user_id: null,
        },
      );
      if (cierreError) {
        console.error("No se pudo cerrar la invitación fallida:", {
          code: cierreError.code,
          message: cierreError.message,
        });
      }
      return NextResponse.json(
        { error: "No pudimos enviar la invitación al correo indicado." },
        { status: 502 },
      );
    }

    usuario = data.user;
    invitacionEnviada = true;
    const { error: completarError } = await sesion.rpc(
      "admin_completar_invitacion_empleado_auditada",
      {
        p_operacion_id: operacionId,
        p_user_id: usuario.id,
      },
    );
    if (completarError) {
      const { error: cierreError } = await sesion.rpc(
        "admin_marcar_invitacion_empleado_fallida",
        {
          p_operacion_id: operacionId,
          p_motivo: "asignacion_fallida",
          p_user_id: usuario.id,
        },
      );
      if (cierreError) {
        console.error("No se pudo compensar la asignación fallida:", {
          code: cierreError.code,
          message: cierreError.message,
        });
      }
      return respuestaErrorRpc(
        completarError,
        "completar la invitación del empleado",
      );
    }
  }

  return NextResponse.json(
    {
      ok: true,
      mensaje: invitacionEnviada
        ? "Invitación enviada y acceso de Empleado asignado."
        : "El usuario existente fue asignado como Empleado.",
    },
    { status: 201 },
  );
}

export async function PATCH(request: Request) {
  const verificacion = await verificarAdministrador();
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
    userId?: unknown;
    activo?: unknown;
    operacionId?: unknown;
  };
  const userId =
    typeof payload.userId === "string" ? payload.userId.trim() : "";
  const activo = typeof payload.activo === "boolean" ? payload.activo : null;
  const operacionId =
    typeof payload.operacionId === "string" ? payload.operacionId.trim() : "";

  if (
    !UUID_VALIDO.test(userId) ||
    !UUID_VALIDO.test(operacionId) ||
    activo === null
  ) {
    return NextResponse.json(
      { error: "Los datos para actualizar el empleado no son válidos." },
      { status: 400 },
    );
  }

  const sesion = await createClient();
  const { error } = await sesion.rpc(
    "admin_cambiar_estado_empleado_auditado",
    {
      p_operacion_id: operacionId,
      p_comercio_id: verificacion.acceso.comercioId,
      p_user_id: userId,
      p_activo: activo,
    },
  );
  if (error) {
    return respuestaErrorRpc(error, "actualizar el acceso del empleado");
  }

  return NextResponse.json(
    {
      ok: true,
      mensaje: activo
        ? "Empleado activado correctamente."
        : "Empleado desactivado correctamente.",
    },
    { status: 200 },
  );
}
