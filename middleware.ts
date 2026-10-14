import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const COMERCIO_ADMIN_SLUG = "piamonte";

function esRutaOperativaPedidos(pathname: string): boolean {
  return (
    pathname === "/api/admin/pedidos" ||
    pathname.startsWith("/api/admin/pedidos/")
  );
}

async function actualizarSesion(
  request: NextRequest,
  verificarAdmin: boolean,
) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (!verificarAdmin) {
    if (userError && userError.name !== "AuthSessionMissingError") {
      console.error("No se pudo refrescar la sesión:", userError.code);
    }
    return response;
  }
  if (userError || !userData.user) {
    return NextResponse.json(
      { error: "No autenticado para acceder a esta ruta administrativa." },
      { status: 401 },
    );
  }

  const { data: comercio, error: comercioError } = await supabase
    .from("comercios")
    .select("id")
    .eq("slug", COMERCIO_ADMIN_SLUG)
    .eq("activo", true)
    .maybeSingle();
  if (comercioError || !comercio?.id) {
    return NextResponse.json(
      { error: "No se pudo verificar el comercio administrativo." },
      { status: 403 },
    );
  }

  const { data: superAdmin, error: superAdminError } = await supabase.rpc(
    "es_super_admin_activo",
  );
  if (superAdminError) {
    console.error(
      "No se pudo verificar el permiso de Super Admin:",
      superAdminError.code,
    );
  } else if (superAdmin === true) {
    return response;
  }

  const { data: vinculo, error: vinculoError } = await supabase
    .from("admin_comercios")
    .select("rol")
    .eq("user_id", userData.user.id)
    .eq("comercio_id", comercio.id)
    .eq("activo", true)
    .maybeSingle();

  if (
    vinculoError ||
    (vinculo?.rol !== "owner" &&
      vinculo?.rol !== "admin" &&
      vinculo?.rol !== "empleado")
  ) {
    return NextResponse.json(
      { error: "Acceso no autorizado para API administrativa." },
      { status: 403 },
    );
  }

  if (
    vinculo.rol === "empleado" &&
    !esRutaOperativaPedidos(request.nextUrl.pathname)
  ) {
    return NextResponse.json(
      { error: "El rol Empleado solo puede acceder a pedidos." },
      { status: 403 },
    );
  }

  return response;
}

export async function middleware(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/api/admin/")) {
    if (request.method === "OPTIONS") return NextResponse.next({ request });
    return actualizarSesion(request, true);
  }
  return actualizarSesion(request, false);
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/super-admin/:path*",
    "/api/admin/:path*",
    "/api/super-admin/:path*",
    "/auth/:path*",
    "/mi-cuenta/:path*",
  ],
};
