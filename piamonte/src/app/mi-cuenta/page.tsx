import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { MarcoCuentaCliente } from "@/components/clientes/MarcoCuentaCliente";
import {
  actualizarPerfilCliente,
  cerrarSesionCliente,
  crearDireccionCliente,
  eliminarDireccionCliente,
} from "@/lib/clientes/cuenta";
import { obtenerComercioActual } from "@/lib/comercio/contexto";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Mi cuenta" };

type Perfil = {
  nombre: string | null;
  telefono: string | null;
};

type Direccion = {
  id: string;
  etiqueta: string | null;
  calle: string;
  numero: string;
  apartamento: string | null;
  referencias: string | null;
};

const MENSAJES: Record<string, string> = {
  cuenta_creada: "Tu cuenta quedó confirmada.",
  perfil_actualizado: "Tus datos se actualizaron correctamente.",
  direccion_guardada: "La dirección quedó guardada.",
  direccion_eliminada: "La dirección fue eliminada.",
};

const ERRORES: Record<string, string> = {
  perfil_invalido: "Revisá el nombre y el teléfono.",
  perfil_no_disponible: "No pudimos preparar o actualizar tu perfil.",
  comercio_no_disponible: "El comercio no está disponible.",
  direccion_invalida: "Completá la calle y el número.",
  direccion_no_disponible: "No pudimos actualizar tus direcciones.",
  direccion_no_encontrada: "La dirección no existe o ya fue eliminada.",
  cierre_fallido: "No pudimos cerrar la sesión.",
};

export default async function PaginaMiCuenta({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const supabase = await createClient();
  const [{ data, error: usuarioError }, comercio, parametros] =
    await Promise.all([
      supabase.auth.getUser(),
      obtenerComercioActual(),
      searchParams,
    ]);

  if (usuarioError || !data.user) redirect("/auth/login");
  if (!comercio) redirect("/");

  const [respuestaPerfil, respuestaDirecciones] = await Promise.all([
    supabase
      .from("clientes_perfiles")
      .select("nombre, telefono")
      .eq("user_id", data.user.id)
      .eq("comercio_id", comercio.id)
      .maybeSingle(),
    supabase
      .from("clientes_direcciones")
      .select("id, etiqueta, calle, numero, apartamento, referencias")
      .eq("user_id", data.user.id)
      .eq("comercio_id", comercio.id)
      .order("creada_en", { ascending: false }),
  ]);

  if (respuestaPerfil.error || respuestaDirecciones.error) {
    console.error("Error al cargar cuenta del cliente:", {
      perfil: respuestaPerfil.error?.code,
      direcciones: respuestaDirecciones.error?.code,
    });
  }

  const perfil = respuestaPerfil.data as Perfil | null;
  const direcciones = (respuestaDirecciones.data ?? []) as Direccion[];
  const errorCarga =
    respuestaPerfil.error || respuestaDirecciones.error
      ? "No pudimos cargar todos los datos de tu cuenta."
      : null;
  const mensaje =
    typeof parametros.mensaje === "string"
      ? MENSAJES[parametros.mensaje]
      : null;
  const error =
    typeof parametros.error === "string" ? ERRORES[parametros.error] : null;
  const errorVisible = errorCarga ?? error;

  return (
    <MarcoCuentaCliente
      nombreComercio={comercio.nombre}
      titulo="Mi cuenta"
      descripcion={`Tus datos personales para comprar en ${comercio.nombre}. El checkout invitado continúa disponible.`}
    >
      {(mensaje || errorVisible) && (
        <p
          className={`mb-5 rounded-xl px-4 py-3 text-sm ${
            errorVisible
              ? "bg-rojo/10 text-rojo"
              : "bg-emerald-50 text-emerald-800"
          }`}
        >
          {errorVisible ?? mensaje}
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-3xl border border-negro/10 bg-white p-6 shadow-[0_20px_45px_rgba(0,0,0,0.08)]">
          <h2 className="font-titulos text-2xl uppercase tracking-wide">
            Datos personales
          </h2>
          <p className="mt-1 text-sm text-negro/60">{data.user.email}</p>
          <form action={actualizarPerfilCliente} className="mt-5 space-y-4">
            <CampoPerfil
              nombre="nombre"
              etiqueta="Nombre"
              valor={perfil?.nombre ?? ""}
              autoComplete="name"
            />
            <CampoPerfil
              nombre="telefono"
              etiqueta="Teléfono"
              valor={perfil?.telefono ?? ""}
              autoComplete="tel"
            />
            <button
              type="submit"
              className="rounded-full bg-rojo px-5 py-2.5 text-sm font-semibold text-white hover:bg-negro"
            >
              Guardar datos
            </button>
          </form>
        </section>

        <section className="rounded-3xl border border-negro/10 bg-white p-6 shadow-[0_20px_45px_rgba(0,0,0,0.08)]">
          <h2 className="font-titulos text-2xl uppercase tracking-wide">
            Nueva dirección
          </h2>
          <form action={crearDireccionCliente} className="mt-5 grid gap-4 sm:grid-cols-2">
            <CampoPerfil
              nombre="etiqueta"
              etiqueta="Etiqueta"
              placeholder="Casa, trabajo…"
              requerido={false}
            />
            <CampoPerfil
              nombre="calle"
              etiqueta="Calle"
              autoComplete="address-line1"
            />
            <CampoPerfil nombre="numero" etiqueta="Número" />
            <CampoPerfil
              nombre="apartamento"
              etiqueta="Apartamento"
              autoComplete="address-line2"
              requerido={false}
            />
            <label className="block sm:col-span-2">
              <span className="text-sm font-semibold">Referencias</span>
              <textarea
                name="referencias"
                maxLength={300}
                rows={3}
                className="mt-1.5 w-full rounded-2xl border border-negro/15 bg-fondo px-4 py-3 text-sm outline-none focus:border-rojo focus:ring-2 focus:ring-rojo/20"
              />
            </label>
            <button
              type="submit"
              className="rounded-full bg-rojo px-5 py-2.5 text-sm font-semibold text-white hover:bg-negro sm:col-span-2"
            >
              Guardar dirección
            </button>
          </form>
        </section>
      </div>

      <section className="mt-6 rounded-3xl border border-negro/10 bg-white p-6 shadow-[0_20px_45px_rgba(0,0,0,0.08)]">
        <h2 className="font-titulos text-2xl uppercase tracking-wide">
          Direcciones guardadas
        </h2>
        {direcciones.length === 0 ? (
          <p className="mt-4 text-sm text-negro/60">
            Todavía no guardaste direcciones.
          </p>
        ) : (
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {direcciones.map((direccion) => (
              <li
                key={direccion.id}
                className="rounded-2xl border border-negro/10 bg-fondo p-4"
              >
                <p className="font-semibold">
                  {direccion.etiqueta ?? "Dirección"}
                </p>
                <p className="mt-1 text-sm">
                  {direccion.calle} {direccion.numero}
                  {direccion.apartamento
                    ? `, apartamento ${direccion.apartamento}`
                    : ""}
                </p>
                {direccion.referencias && (
                  <p className="mt-1 text-sm text-negro/60">
                    {direccion.referencias}
                  </p>
                )}
                <form action={eliminarDireccionCliente} className="mt-3">
                  <input
                    type="hidden"
                    name="direccionId"
                    value={direccion.id}
                  />
                  <button
                    type="submit"
                    className="text-sm font-semibold text-rojo hover:underline"
                  >
                    Eliminar
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>

      <form action={cerrarSesionCliente} className="mt-6 text-center">
        <button
          type="submit"
          className="rounded-full border border-negro/20 bg-white px-5 py-2.5 text-sm font-semibold hover:border-rojo hover:text-rojo"
        >
          Cerrar sesión
        </button>
      </form>
    </MarcoCuentaCliente>
  );
}

function CampoPerfil({
  nombre,
  etiqueta,
  valor,
  placeholder,
  autoComplete,
  requerido = true,
}: {
  nombre: string;
  etiqueta: string;
  valor?: string;
  placeholder?: string;
  autoComplete?: string;
  requerido?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-sm font-semibold">{etiqueta}</span>
      <input
        name={nombre}
        defaultValue={valor}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required={requerido}
        maxLength={
          nombre === "nombre" || nombre === "calle"
            ? 120
            : nombre === "etiqueta"
              ? 40
              : 30
        }
        className="mt-1.5 w-full rounded-2xl border border-negro/15 bg-fondo px-4 py-3 text-sm outline-none focus:border-rojo focus:ring-2 focus:ring-rojo/20"
      />
    </label>
  );
}
