import "server-only";

import { esSuperAdminActivo } from "@/lib/admin/auth";
import { createPrivateClient } from "@/lib/supabase/private";

export type ComercioSuperAdmin = {
  id: string;
  nombre: string;
  slug: string;
  activo: boolean;
};

export async function obtenerComerciosSuperAdmin(): Promise<
  ComercioSuperAdmin[]
> {
  if (!(await esSuperAdminActivo())) {
    throw new Error("Acceso no autorizado para consultar los comercios.");
  }

  const supabase = createPrivateClient();
  const { data, error } = await supabase
    .from("comercios")
    .select("id, nombre, slug, activo")
    .order("nombre", { ascending: true });

  if (error) {
    console.error("Error al consultar comercios para Super Admin:", {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
    throw new Error("No pudimos consultar los comercios registrados.");
  }

  return data ?? [];
}
