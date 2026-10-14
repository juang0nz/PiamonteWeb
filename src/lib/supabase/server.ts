import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Crea el cliente de Supabase para Server Components, Server Functions y Route Handlers.
// En Next.js 16 cookies() es asíncrona, por eso esta función también lo es.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Los Server Components no pueden escribir cookies. Se ignora el error
            // porque la sesión se refresca en el proxy cuando corresponda.
          }
        },
      },
    },
  );
}
