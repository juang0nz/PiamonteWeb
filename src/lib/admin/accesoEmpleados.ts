import "server-only";

import type { User } from "@supabase/supabase-js";
import { createPrivateClient } from "@/lib/supabase/private";

export function urlAccesoEmpleado(): string {
  const configurada = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!configurada) {
    throw new Error("Falta configurar NEXT_PUBLIC_SITE_URL para los correos de acceso.");
  }
  const url = new URL(configurada);
  if (
    url.username || url.password ||
    (url.protocol !== "https:" &&
      !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname)))
  ) {
    throw new Error("NEXT_PUBLIC_SITE_URL debe usar HTTPS, salvo en desarrollo local.");
  }
  return new URL("/admin/acceso", url.origin).toString();
}

export function estadoAccesoEmpleado(usuario?: User) {
  const bloqueado = Boolean(
    usuario?.banned_until && Date.parse(usuario.banned_until) > Date.now(),
  );
  return {
    cuentaExiste: Boolean(usuario),
    correoConfirmado: Boolean(usuario?.email_confirmed_at),
    invitacionEnviadaEn: usuario?.invited_at ?? null,
    recuperacionEnviadaEn: usuario?.recovery_sent_at ?? null,
    ultimoIngresoEn: usuario?.last_sign_in_at ?? null,
    bloqueado,
  };
}

// La contraseña pertenece a la cuenta global, no al vínculo con un comercio.
export async function comprobarCuentaEmpleado(
  privado: ReturnType<typeof createPrivateClient>,
  userId: string,
  comercioId: string,
): Promise<boolean> {
  const [vinculos, superAdmin] = await Promise.all([
    privado.from("admin_comercios")
      .select("comercio_id, rol, activo")
      .eq("user_id", userId),
    privado.from("super_admins").select("user_id").eq("user_id", userId).maybeSingle(),
  ]);
  if (vinculos.error || superAdmin.error) {
    console.error("No se pudo verificar el alcance de la cuenta de empleado:", {
      code: vinculos.error?.code ?? superAdmin.error?.code,
    });
    throw new Error("No pudimos verificar los permisos de la cuenta.");
  }
  return !superAdmin.data &&
    Boolean(vinculos.data?.some(
      (vinculo) => vinculo.comercio_id === comercioId &&
        vinculo.rol === "empleado" && vinculo.activo,
    )) &&
    !vinculos.data?.some(
      (vinculo) => vinculo.comercio_id !== comercioId || vinculo.rol !== "empleado",
    );
}
