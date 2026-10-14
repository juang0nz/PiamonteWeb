import { NextResponse } from "next/server";
import { esSuperAdminActivo } from "@/lib/admin/auth";
import { createPrivateClient } from "@/lib/supabase/private";
import { createClient } from "@/lib/supabase/server";
import { listarUsuariosAuth } from "@/lib/super-admin/usuarios";

const ROL_ADMIN = "admin";
const EMAIL_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_VALIDO =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type VinculoFila = {
  user_id: string;
  comercio_id: string;
  rol: string;
  activo: boolean;
};

type ComercioFila = {
  id: string;
  nombre: string;
  activo: boolean;
};

async function verificarSuperAdmin() {
  if (!(await esSuperAdminActivo())) {
    return NextResponse.json(
      { error: "No autorizado para administrar usuarios." },
      { status: 403 },
    );
  }
  return null;
}

function esErrorPermisos(codigo?: string) {
  return codigo === "42501";
}

function errorRpcAdministradores(
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
      { error: "No autorizado para administrar usuarios." },
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
      { error: "El usuario o comercio indicado no existe." },
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
      { error: "Falta completar la instalación de auditoría en Supabase." },
      { status: 503 },
    );
  }
  return NextResponse.json(
    { error: `No pudimos ${operacion}.` },
    { status: 500 },
  );
}

export async function GET() {
  const denegado = await verificarSuperAdmin();
  if (denegado) return denegado;

  const supabase = createPrivateClient();
  const [respuestaVinculos, respuestaComercios] = await Promise.all([
    supabase
      .from("admin_comercios")
      .select("user_id, comercio_id, rol, activo"),
    supabase
      .from("comercios")
      .select("id, nombre, activo")
      .order("nombre", { ascending: true }),
  ]);

  if (respuestaVinculos.error) {
    if (esErrorPermisos(respuestaVinculos.error.code)) {
      return NextResponse.json(
        {
          error:
            "Falta habilitar los permisos de servidor para administrar accesos.",
        },
        { status: 503 },
      );
    }
    console.error("Error al consultar administradores:", respuestaVinculos.error);
    return NextResponse.json(
      { error: "No pudimos consultar los administradores." },
      { status: 500 },
    );
  }
  if (respuestaComercios.error) {
    console.error("Error al consultar comercios:", respuestaComercios.error);
    return NextResponse.json(
      { error: "No pudimos consultar los comercios." },
      { status: 500 },
    );
  }

  let usuarios: Awaited<ReturnType<typeof listarUsuariosAuth>>;
  try {
    usuarios = await listarUsuariosAuth(supabase);
  } catch (error) {
    console.error("Error de Auth Admin al listar usuarios:", error);
    return NextResponse.json(
      { error: "No pudimos consultar los correos de los administradores." },
      { status: 500 },
    );
  }

  const correosPorUsuario = new Map(
    usuarios.map((usuario) => [usuario.id, usuario.email ?? null]),
  );
  const comercios = (respuestaComercios.data ?? []) as ComercioFila[];
  const comerciosPorId = new Map(
    comercios.map((comercio) => [comercio.id, comercio]),
  );

  return NextResponse.json(
    {
      comercios,
      administradores: (
        (respuestaVinculos.data ?? []) as VinculoFila[]
      ).map((vinculo) => ({
        userId: vinculo.user_id,
        comercioId: vinculo.comercio_id,
        comercioNombre:
          comerciosPorId.get(vinculo.comercio_id)?.nombre ??
          "Comercio no disponible",
        email: correosPorUsuario.get(vinculo.user_id) ?? "Correo no disponible",
        rol: vinculo.rol,
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
  const denegado = await verificarSuperAdmin();
  if (denegado) return denegado;

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
    email?: unknown;
    comercioId?: unknown;
    operacionId?: unknown;
  };
  const email =
    typeof payload.email === "string"
      ? payload.email.trim().toLowerCase()
      : "";
  const comercioId =
    typeof payload.comercioId === "string" ? payload.comercioId.trim() : "";
  const operacionId =
    typeof payload.operacionId === "string" ? payload.operacionId.trim() : "";

  if (!EMAIL_VALIDO.test(email) || email.length > 254) {
    return NextResponse.json(
      { error: "Ingresá un correo electrónico válido." },
      { status: 400 },
    );
  }
  if (!UUID_VALIDO.test(comercioId) || !UUID_VALIDO.test(operacionId)) {
    return NextResponse.json(
      { error: "El comercio seleccionado no es válido." },
      { status: 400 },
    );
  }

  const supabase = createPrivateClient();
  const supabaseSesion = await createClient();

  const { data: comercio, error: comercioError } = await supabase
    .from("comercios")
    .select("id, nombre")
    .eq("id", comercioId)
    .maybeSingle();
  if (comercioError) {
    console.error("Error al validar comercio para invitación:", comercioError);
    return NextResponse.json(
      { error: "No pudimos validar el comercio seleccionado." },
      { status: 500 },
    );
  }
  if (!comercio) {
    return NextResponse.json(
      { error: "El comercio seleccionado no existe." },
      { status: 404 },
    );
  }

  const preflight = await supabase
    .from("admin_comercios")
    .select("user_id")
    .limit(1);
  if (preflight.error) {
    if (esErrorPermisos(preflight.error.code)) {
      return NextResponse.json(
        {
          error:
            "Falta habilitar los permisos de servidor antes de enviar invitaciones.",
        },
        { status: 503 },
      );
    }
    console.error("Error al verificar permisos de administradores:", preflight.error);
    return NextResponse.json(
      { error: "No pudimos verificar las asignaciones existentes." },
      { status: 500 },
    );
  }

  let usuarios: Awaited<ReturnType<typeof listarUsuariosAuth>>;
  try {
    usuarios = await listarUsuariosAuth(supabase);
  } catch (error) {
    console.error("Error de Auth Admin al buscar usuario:", error);
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
    const { data: existente, error: existenteError } = await supabase
      .from("admin_comercios")
      .select("activo")
      .eq("user_id", usuario.id)
      .eq("comercio_id", comercioId)
      .maybeSingle();
    if (existenteError) {
      console.error("Error al verificar asignación duplicada:", existenteError);
      return NextResponse.json(
        { error: "No pudimos verificar la asignación existente." },
        { status: 500 },
      );
    }
    if (existente) {
      return NextResponse.json(
        {
          error: existente.activo
            ? "Ese usuario ya administra el comercio seleccionado."
            : "Ese usuario ya tiene una asignación inactiva. Reactivala desde el listado.",
        },
        { status: 409 },
      );
    }

    const { error: asignacionError } = await supabaseSesion.rpc(
      "super_admin_asignar_administrador_auditado",
      {
        p_operacion_id: operacionId,
        p_comercio_id: comercioId,
        p_user_id: usuario.id,
        p_rol: ROL_ADMIN,
      },
    );
    if (asignacionError) {
      return errorRpcAdministradores(
        asignacionError,
        "asignar el administrador al comercio",
      );
    }
  } else {
    const { error: inicioError } = await supabaseSesion.rpc(
      "super_admin_iniciar_invitacion_auditada",
      {
        p_operacion_id: operacionId,
        p_comercio_id: comercioId,
        p_email: email,
      },
    );
    if (inicioError) {
      return errorRpcAdministradores(
        inicioError,
        "iniciar la invitación auditada",
      );
    }

    const { data, error } =
      await supabase.auth.admin.inviteUserByEmail(email);
    if (error || !data.user) {
      console.error("Error de Auth Admin al invitar usuario:", {
        status: error?.status,
        code: error?.code,
        message: error?.message,
      });
      const { error: cierreError } = await supabaseSesion.rpc(
        "super_admin_marcar_invitacion_fallida",
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

    const { error: asignacionError } = await supabaseSesion.rpc(
      "super_admin_completar_invitacion_auditada",
      {
        p_operacion_id: operacionId,
        p_user_id: usuario.id,
      },
    );
    if (asignacionError) {
      const { error: cierreError } = await supabaseSesion.rpc(
        "super_admin_marcar_invitacion_fallida",
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
      return errorRpcAdministradores(
        asignacionError,
        "asignar el comercio después de enviar la invitación",
      );
    }
  }

  return NextResponse.json(
    {
      ok: true,
      mensaje: invitacionEnviada
        ? `Invitación enviada y acceso asignado a ${comercio.nombre}.`
        : `El usuario existente fue asignado a ${comercio.nombre}.`,
    },
    { status: 201 },
  );
}

export async function PATCH(request: Request) {
  const denegado = await verificarSuperAdmin();
  if (denegado) return denegado;

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
    comercioId?: unknown;
    activo?: unknown;
    operacionId?: unknown;
  };
  const userId =
    typeof payload.userId === "string" ? payload.userId.trim() : "";
  const comercioId =
    typeof payload.comercioId === "string" ? payload.comercioId.trim() : "";
  const activo = typeof payload.activo === "boolean" ? payload.activo : null;
  const operacionId =
    typeof payload.operacionId === "string" ? payload.operacionId.trim() : "";

  if (
    !UUID_VALIDO.test(userId) ||
    !UUID_VALIDO.test(comercioId) ||
    !UUID_VALIDO.test(operacionId) ||
    activo === null
  ) {
    return NextResponse.json(
      { error: "Los datos de la asignación no son válidos." },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc(
    "super_admin_cambiar_estado_administrador_auditado",
    {
      p_operacion_id: operacionId,
      p_comercio_id: comercioId,
      p_user_id: userId,
      p_activo: activo,
    },
  );

  if (error) {
    return errorRpcAdministradores(
      error,
      "actualizar el acceso administrativo",
    );
  }

  return NextResponse.json({ ok: true, activo }, { status: 200 });
}
