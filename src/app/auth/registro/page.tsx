import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { MarcoCuentaCliente } from "@/components/clientes/MarcoCuentaCliente";
import { registrarCliente } from "@/lib/clientes/cuenta";
import { obtenerComercioActual } from "@/lib/comercio/contexto";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Crear cuenta" };

const ERRORES: Record<string, string> = {
  nombre_invalido: "Ingresá un nombre válido.",
  telefono_invalido: "Ingresá un teléfono válido.",
  email_invalido: "Ingresá un correo electrónico válido.",
  password_invalida: "La contraseña debe tener entre 8 y 72 caracteres.",
  passwords_distintas: "Las contraseñas no coinciden.",
  comercio_no_disponible: "El comercio no está disponible.",
  configuracion: "No pudimos preparar el registro en este momento.",
  registro_fallido:
    "No pudimos crear la cuenta. Verificá los datos o iniciá sesión si ya estás registrado.",
};

export default async function PaginaRegistroCliente({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const supabase = await createClient();
  const [{ data }, comercio, parametros] = await Promise.all([
    supabase.auth.getUser(),
    obtenerComercioActual(),
    searchParams,
  ]);
  if (data.user) redirect("/mi-cuenta");
  if (!comercio) redirect("/");

  const error =
    typeof parametros.error === "string" ? ERRORES[parametros.error] : null;
  const revisarCorreo = parametros.mensaje === "revisar_correo";

  return (
    <MarcoCuentaCliente
      nombreComercio={comercio.nombre}
      titulo="Crear cuenta"
      descripcion="Guardá tus datos y direcciones para futuras compras. También podés seguir comprando como invitado."
    >
      <div className="mx-auto max-w-lg rounded-3xl border border-negro/10 bg-white p-6 shadow-[0_20px_45px_rgba(0,0,0,0.08)]">
        {revisarCorreo && (
          <p className="mb-5 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            Revisá tu correo para confirmar la cuenta y luego iniciá sesión.
          </p>
        )}
        {error && (
          <p className="mb-5 rounded-xl bg-rojo/10 px-4 py-3 text-sm text-rojo">
            {error}
          </p>
        )}
        <form action={registrarCliente} className="space-y-4">
          <CampoCuenta nombre="nombre" etiqueta="Nombre" autoComplete="name" />
          <CampoCuenta
            nombre="telefono"
            etiqueta="Teléfono"
            tipo="tel"
            autoComplete="tel"
          />
          <CampoCuenta
            nombre="email"
            etiqueta="Correo electrónico"
            tipo="email"
            autoComplete="email"
          />
          <CampoCuenta
            nombre="password"
            etiqueta="Contraseña"
            tipo="password"
            autoComplete="new-password"
          />
          <CampoCuenta
            nombre="confirmarPassword"
            etiqueta="Repetir contraseña"
            tipo="password"
            autoComplete="new-password"
          />
          <button
            type="submit"
            className="w-full rounded-full bg-rojo px-5 py-3 font-semibold text-white hover:bg-negro"
          >
            Crear cuenta
          </button>
        </form>
        <p className="mt-5 text-center text-sm text-negro/65">
          ¿Ya tenés una cuenta?{" "}
          <Link href="/auth/login" className="font-semibold text-rojo">
            Iniciá sesión
          </Link>
        </p>
      </div>
    </MarcoCuentaCliente>
  );
}

function CampoCuenta({
  nombre,
  etiqueta,
  tipo = "text",
  autoComplete,
}: {
  nombre: string;
  etiqueta: string;
  tipo?: string;
  autoComplete: string;
}) {
  return (
    <label className="block">
      <span className="text-sm font-semibold">{etiqueta}</span>
      <input
        name={nombre}
        type={tipo}
        autoComplete={autoComplete}
        required
        maxLength={tipo === "password" ? 72 : nombre === "nombre" ? 120 : 254}
        className="mt-1.5 w-full rounded-2xl border border-negro/15 bg-fondo px-4 py-3 text-sm outline-none focus:border-rojo focus:ring-2 focus:ring-rojo/20"
      />
    </label>
  );
}
