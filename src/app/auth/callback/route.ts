import { NextResponse } from "next/server";
import { asegurarPerfilCliente } from "@/lib/clientes/perfil";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  if (!code) {
    return NextResponse.redirect(new URL("/auth/login?error=callback", url));
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) {
    return NextResponse.redirect(new URL("/auth/login?error=callback", url));
  }

  const perfil = await asegurarPerfilCliente(supabase, data.user);
  if ("error" in perfil) {
    return NextResponse.redirect(
      new URL(`/mi-cuenta?error=${perfil.error}`, url),
    );
  }

  return NextResponse.redirect(new URL("/mi-cuenta?mensaje=cuenta_creada", url));
}
