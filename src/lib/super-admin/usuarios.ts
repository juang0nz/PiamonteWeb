import "server-only";

import type { User } from "@supabase/supabase-js";
import { createPrivateClient } from "@/lib/supabase/private";

export async function listarUsuariosAuth(
  supabase: ReturnType<typeof createPrivateClient>,
): Promise<User[]> {
  const usuarios: User[] = [];
  const porPagina = 200;

  for (let pagina = 1; pagina <= 100; pagina += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page: pagina,
      perPage: porPagina,
    });
    if (error) {
      throw new Error(`No se pudieron consultar los usuarios: ${error.message}`);
    }

    usuarios.push(...data.users);
    if (usuarios.length >= data.total || data.users.length < porPagina) {
      return usuarios;
    }
  }

  throw new Error("La cantidad de usuarios supera el límite de consulta.");
}
