import { createBrowserClient } from "@supabase/ssr";

// Crea el cliente de Supabase para usar en componentes del navegador.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
