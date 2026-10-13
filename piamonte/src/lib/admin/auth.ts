import "server-only";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const COMERCIO_ADMIN_SLUG = "piamonte";

export type RolAccesoAdmin =
  | "super_admin"
  | "owner"
  | "admin"
  | "empleado";

export type EstadoAccesoAdmin =
  | { autenticado: false }
  | {
      autenticado: true;
      autorizado: false;
      motivo:
        | "sin_vinculo"
        | "comercio_no_disponible"
        | "tabla_no_configurada"
        | "error_autorizacion";
      email: string | null;
    }
  | {
      autenticado: true;
      autorizado: true;
      rol: RolAccesoAdmin;
      comercioId: string;
      email: string | null;
      esSuperAdmin: boolean;
    };

function esRolComercio(
  valor: unknown,
): valor is "owner" | "admin" | "empleado" {
  return valor === "owner" || valor === "admin" || valor === "empleado";
}

function textoErrorLogin(error: string): string {
  if (error === "credenciales_invalidas") {
    return "Correo o contraseña inválidos.";
  }
  if (error === "faltan_campos") {
    return "Completá correo y contraseña para continuar.";
  }
  return "No pudimos iniciar sesión. Intentá nuevamente.";
}

// Verifica sesión y autorización explícita para administrar el comercio.
export async function obtenerEstadoAccesoAdmin(): Promise<EstadoAccesoAdmin> {
  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    return { autenticado: false };
  }

  const { data: comercio, error: comercioError } = await supabase
    .from("comercios")
    .select("id")
    .eq("slug", COMERCIO_ADMIN_SLUG)
    .eq("activo", true)
    .maybeSingle();

  if (comercioError) {
    console.error("Error al resolver comercio admin:", {
      code: comercioError.code,
      message: comercioError.message,
      details: comercioError.details,
      hint: comercioError.hint,
    });
    return {
      autenticado: true,
      autorizado: false,
      motivo: "error_autorizacion",
      email: userData.user.email ?? null,
    };
  }
  if (!comercio?.id) {
    return {
      autenticado: true,
      autorizado: false,
      motivo: "comercio_no_disponible",
      email: userData.user.email ?? null,
    };
  }

  const { data: superAdmin, error: superAdminError } = await supabase.rpc(
    "es_super_admin_activo",
  );
  if (superAdminError) {
    console.error("Error al verificar Super Admin para acceso al comercio:", {
      code: superAdminError.code,
      message: superAdminError.message,
      details: superAdminError.details,
      hint: superAdminError.hint,
    });
  } else if (superAdmin === true) {
    return {
      autenticado: true,
      autorizado: true,
      rol: "super_admin",
      comercioId: comercio.id,
      email: userData.user.email ?? null,
      esSuperAdmin: true,
    };
  }

  const { data: vinculo, error: vinculoError } = await supabase
    .from("admin_comercios")
    .select("rol")
    .eq("user_id", userData.user.id)
    .eq("comercio_id", comercio.id)
    .eq("activo", true)
    .maybeSingle();

  if (vinculoError) {
    if (vinculoError.code === "42P01") {
      return {
        autenticado: true,
        autorizado: false,
        motivo: "tabla_no_configurada",
        email: userData.user.email ?? null,
      };
    }
    console.error("Error al verificar autorización admin:", {
      code: vinculoError.code,
      message: vinculoError.message,
      details: vinculoError.details,
      hint: vinculoError.hint,
    });
    return {
      autenticado: true,
      autorizado: false,
      motivo: "error_autorizacion",
      email: userData.user.email ?? null,
    };
  }

  if (!esRolComercio(vinculo?.rol)) {
    if (vinculo?.rol) {
      console.error("Rol administrativo no reconocido:", vinculo.rol);
    }
    return {
      autenticado: true,
      autorizado: false,
      motivo: vinculo?.rol ? "error_autorizacion" : "sin_vinculo",
      email: userData.user.email ?? null,
    };
  }

  return {
    autenticado: true,
    autorizado: true,
    rol: vinculo.rol,
    comercioId: comercio.id,
    email: userData.user.email ?? null,
    esSuperAdmin: false,
  };
}

export function mensajeNoAutorizado(
  motivo:
    | "sin_vinculo"
    | "comercio_no_disponible"
    | "tabla_no_configurada"
    | "error_autorizacion",
): string {
  if (motivo === "comercio_no_disponible") {
    return "El comercio Piamonte no está disponible o no está activo.";
  }
  if (motivo === "tabla_no_configurada") {
    return "Falta configurar la tabla de autorización de administradores por comercio.";
  }
  if (motivo === "error_autorizacion") {
    return "No pudimos verificar tu autorización en este momento.";
  }
  return "Tu usuario no tiene permisos administrativos para Piamonte.";
}

export async function iniciarSesionAdmin(formData: FormData) {
  "use server";

  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) {
    redirect("/admin/login?error=faltan_campos");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    redirect("/admin/login?error=credenciales_invalidas");
  }

  redirect("/admin");
}

export async function cerrarSesionAdmin() {
  "use server";

  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/admin/login");
}

export async function esSuperAdminActivo(): Promise<boolean> {
  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    return false;
  }

  const { data, error } = await supabase.rpc("es_super_admin_activo");
  if (error) {
    if (error.code === "42704" || error.code === "PGRST202") {
      return false;
    }
    console.error("Error al verificar Super Admin:", {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
    return false;
  }

  return Boolean(data);
}

export function leerErrorLogin(parametro?: string): string | null {
  if (!parametro) return null;
  return textoErrorLogin(parametro);
}
