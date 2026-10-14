import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { comprobarCuentaEmpleado } from "@/lib/admin/accesoEmpleados";
import { createPrivateClient } from "@/lib/supabase/private";
import { SLUG_COMERCIO } from "@/lib/comercio";

function respuesta(error: string, status: number) {
  return NextResponse.json({ error }, {
    status,
    headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" },
  });
}

export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) {
    return respuesta("Origen de la solicitud no autorizado.", 403);
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return respuesta("La solicitud no es JSON válido.", 400);
  }
  if (!body || typeof body !== "object") return respuesta("Solicitud inválida.", 400);
  const { password, confirmacion, tokenHash, tipo, accessToken, refreshToken } = body as Record<string, unknown>;
  if (typeof password !== "string" || password.length < 8 || password.length > 72 ||
      password !== confirmacion) {
    return respuesta("Usá entre 8 y 72 caracteres y repetí la misma contraseña.", 400);
  }
  const hash = typeof tokenHash === "string" && tokenHash.length <= 2048 ? tokenHash : "";
  const tokens = typeof accessToken === "string" && accessToken.length > 0 && accessToken.length <= 16384 &&
    typeof refreshToken === "string" && refreshToken.length > 0 && refreshToken.length <= 2048
    ? { access_token: accessToken, refresh_token: refreshToken } : null;
  if ((!hash && !tokens) || (tipo !== "invite" && tipo !== "recovery")) {
    return respuesta("El enlace no es válido. Pedí uno nuevo al administrador.", 400);
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const clave = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !clave) return respuesta("El acceso por correo no está configurado.", 503);

  // Sesión aislada: no usa service_role para cambiar la contraseña ni reemplaza las cookies del navegador.
  const supabase = createClient(url, clave, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const autenticacion = tokens
    ? await supabase.auth.setSession(tokens)
    : await supabase.auth.verifyOtp({ token_hash: hash, type: tipo });
  if (autenticacion.error || !autenticacion.data.user) {
    console.error("Enlace de acceso rechazado:", { code: autenticacion.error?.code });
    return respuesta("El enlace venció, ya fue utilizado o no es válido. Pedí uno nuevo.", 401);
  }
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return respuesta("No pudimos verificar la identidad del enlace.", 401);

  const privado = createPrivateClient();
  const { data: comercio, error: comercioError } = await privado.from("comercios")
    .select("id").eq("slug", SLUG_COMERCIO).eq("activo", true).maybeSingle();
  if (comercioError) {
    console.error("No se pudo verificar el comercio del enlace:", { code: comercioError.code });
    return respuesta("No pudimos verificar el comercio.", 503);
  }
  if (!comercio) return respuesta("El comercio no está disponible.", 403);
  try {
    if (!await comprobarCuentaEmpleado(privado, data.user.id, comercio.id)) {
      return respuesta("La cuenta no tiene acceso de empleado habilitado para este comercio.", 403);
    }
  } catch {
    return respuesta("No pudimos verificar los permisos de la cuenta.", 503);
  }
  const { error: passwordError } = await supabase.auth.updateUser({ password });
  if (passwordError) {
    console.error("No se pudo establecer la contraseña de empleado:", { code: passwordError.code });
    return respuesta(
      "No se pudo guardar la contraseña. Usá una distinta que cumpla la política de seguridad de Supabase. Si el enlace ya se consumió, solicitá otro.",
      400,
    );
  }
  const { error: salidaError } = await supabase.auth.signOut({ scope: "local" });
  if (salidaError) {
    console.error("No se pudo cerrar la sesión del enlace:", { code: salidaError.code });
    return respuesta("La contraseña se actualizó, pero no se pudo cerrar la sesión del enlace. Contactá al administrador.", 502);
  }
  return NextResponse.json({
    mensaje: "Contraseña guardada. Ya podés ingresar con tu correo y tu nueva contraseña.",
  }, { headers: { "Cache-Control": "no-store" } });
}
