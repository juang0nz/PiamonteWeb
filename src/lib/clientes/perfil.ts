import "server-only";

import type { User } from "@supabase/supabase-js";
import { obtenerComercioActual } from "@/lib/comercio/contexto";
import { createClient } from "@/lib/supabase/server";

type ClienteSupabase = Awaited<ReturnType<typeof createClient>>;

function valorMetadata(user: User, clave: "nombre" | "telefono"): string | null {
  const valor = user.user_metadata?.[clave];
  if (typeof valor !== "string") return null;
  const limpio = valor.trim();
  const maximo = clave === "nombre" ? 120 : 30;
  return limpio.length > 0 && limpio.length <= maximo ? limpio : null;
}

export async function asegurarPerfilCliente(
  supabase: ClienteSupabase,
  user: User,
) {
  const comercio = await obtenerComercioActual();
  if (!comercio) {
    return { error: "comercio_no_disponible" as const };
  }

  const { data: perfil, error: consultaError } = await supabase
    .from("clientes_perfiles")
    .select("user_id")
    .eq("user_id", user.id)
    .eq("comercio_id", comercio.id)
    .maybeSingle();

  if (consultaError) {
    console.error("Error al consultar perfil del cliente:", {
      code: consultaError.code,
      message: consultaError.message,
      details: consultaError.details,
      hint: consultaError.hint,
    });
    return { error: "perfil_no_disponible" as const };
  }
  if (perfil) return { comercio, creado: false };

  const { error: insercionError } = await supabase
    .from("clientes_perfiles")
    .insert({
      user_id: user.id,
      comercio_id: comercio.id,
      nombre: valorMetadata(user, "nombre"),
      telefono: valorMetadata(user, "telefono"),
    });

  if (insercionError && insercionError.code !== "23505") {
    console.error("Error al crear perfil del cliente:", {
      code: insercionError.code,
      message: insercionError.message,
      details: insercionError.details,
      hint: insercionError.hint,
    });
    return { error: "perfil_no_disponible" as const };
  }

  return { comercio, creado: true };
}
