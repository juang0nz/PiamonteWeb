import { NextResponse } from "next/server";
import { esSuperAdminActivo } from "@/lib/admin/auth";
import { createPrivateClient } from "@/lib/supabase/private";
import { createClient } from "@/lib/supabase/server";
import { listarUsuariosAuth } from "@/lib/super-admin/usuarios";

const UUID_VALIDO =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ACCION_VALIDA = /^[a-z][a-z0-9_]{1,63}$/;
const POR_PAGINA = 20;

function fechaValida(valor: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(valor) &&
    !Number.isNaN(Date.parse(`${valor}T00:00:00.000Z`));
}

export async function GET(request: Request) {
  if (!(await esSuperAdminActivo())) {
    return NextResponse.json(
      { error: "No autorizado para consultar la auditoría." },
      { status: 403 },
    );
  }

  const parametros = new URL(request.url).searchParams;
  const pagina = Number(parametros.get("pagina") ?? "1");
  const comercioId = parametros.get("comercioId")?.trim() ?? "";
  const actorId = parametros.get("actorId")?.trim() ?? "";
  const accion = parametros.get("accion")?.trim() ?? "";
  const desde = parametros.get("desde")?.trim() ?? "";
  const hasta = parametros.get("hasta")?.trim() ?? "";

  if (!Number.isInteger(pagina) || pagina < 1 || pagina > 100_000) {
    return NextResponse.json({ error: "La página no es válida." }, { status: 400 });
  }
  if (
    (comercioId && !UUID_VALIDO.test(comercioId)) ||
    (actorId && !UUID_VALIDO.test(actorId)) ||
    (accion && !ACCION_VALIDA.test(accion)) ||
    (desde && !fechaValida(desde)) ||
    (hasta && !fechaValida(hasta))
  ) {
    return NextResponse.json(
      { error: "Los filtros de auditoría no son válidos." },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  let consulta = supabase
    .from("auditoria_eventos")
    .select(
      "id, operacion_id, secuencia, creado_en, actor_user_id, comercio_id, accion, entidad, registro_id, valores_anteriores, valores_nuevos",
      { count: "exact" },
    );
  if (comercioId) consulta = consulta.eq("comercio_id", comercioId);
  if (actorId) consulta = consulta.eq("actor_user_id", actorId);
  if (accion) consulta = consulta.eq("accion", accion);
  if (desde) consulta = consulta.gte("creado_en", `${desde}T00:00:00.000Z`);
  if (hasta) consulta = consulta.lte("creado_en", `${hasta}T23:59:59.999Z`);

  const desdeFila = (pagina - 1) * POR_PAGINA;
  const { data, error, count } = await consulta
    .order("creado_en", { ascending: false })
    .order("secuencia", { ascending: false })
    .range(desdeFila, desdeFila + POR_PAGINA - 1);

  if (error) {
    console.error("Error al consultar auditoría:", {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
    const faltaConfiguracion =
      error.code === "42P01" || error.code === "42501";
    return NextResponse.json(
      {
        error: faltaConfiguracion
          ? "Falta completar la configuración de auditoría en Supabase."
          : "No pudimos consultar los movimientos de auditoría.",
      },
      { status: faltaConfiguracion ? 503 : 500 },
    );
  }

  const privado = createPrivateClient();
  const respuestaComercios = await privado
    .from("comercios")
    .select("id, nombre")
    .order("nombre");
  if (respuestaComercios.error) {
    console.error(
      "Error al consultar comercios para auditoría:",
      respuestaComercios.error,
    );
    return NextResponse.json(
      { error: "No pudimos resolver los comercios de la auditoría." },
      { status: 500 },
    );
  }
  let usuarios: Awaited<ReturnType<typeof listarUsuariosAuth>>;
  try {
    usuarios = await listarUsuariosAuth(privado);
  } catch (errorUsuarios) {
    console.error(
      "Error al consultar usuarios para auditoría:",
      errorUsuarios,
    );
    return NextResponse.json(
      { error: "No pudimos resolver los usuarios de la auditoría." },
      { status: 500 },
    );
  }

  const comercios = respuestaComercios.data ?? [];
  const nombresComercio = new Map(
    comercios.map((comercio) => [comercio.id, comercio.nombre]),
  );
  const correosUsuario = new Map(
    usuarios.map((usuario) => [usuario.id, usuario.email ?? null]),
  );

  return NextResponse.json(
    {
      eventos: (data ?? []).map((evento) => ({
        ...evento,
        comercioNombre:
          nombresComercio.get(evento.comercio_id) ?? "Comercio no disponible",
        actorEmail:
          correosUsuario.get(evento.actor_user_id) ?? "Correo no disponible",
      })),
      comercios,
      usuarios: usuarios
        .filter((usuario) => usuario.email)
        .map((usuario) => ({ id: usuario.id, email: usuario.email! }))
        .sort((a, b) => a.email.localeCompare(b.email, "es")),
      pagina,
      porPagina: POR_PAGINA,
      total: count ?? 0,
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
