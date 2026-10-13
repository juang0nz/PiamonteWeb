import type { Metadata } from "next";
import Link from "next/link";
import { EncabezadoSuperAdmin } from "@/components/super-admin/EncabezadoSuperAdmin";
import { obtenerComerciosSuperAdmin } from "@/lib/super-admin/comercios";

export const metadata: Metadata = {
  title: "Piamonte | Super Admin",
};

export default async function PaginaSuperAdmin() {
  const comercios = await obtenerComerciosSuperAdmin();
  const activos = comercios.filter((comercio) => comercio.activo).length;
  const inactivos = comercios.length - activos;

  return (
    <div className="min-h-full bg-gradient-to-b from-[#fff3ee] via-[#fff8f2] to-[#fffdf8]">
      <EncabezadoSuperAdmin seccion="comercios" />

      <main className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 sm:px-8 lg:py-8">
        <section>
          <p className="text-xs font-semibold uppercase tracking-wider text-rojo">
            Plataforma gastronómica
          </p>
          <h1 className="mt-1 font-titulos text-3xl uppercase tracking-wide text-negro sm:text-4xl">
            Comercios
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-negro/65">
            Resumen de los comercios registrados y acceso a sus paneles de
            administración.
          </p>
        </section>

        <section
          aria-label="Resumen de comercios"
          className="grid gap-3 sm:grid-cols-3"
        >
          <Resumen titulo="Registrados" cantidad={comercios.length} />
          <Resumen titulo="Activos" cantidad={activos} destacado />
          <Resumen titulo="Inactivos" cantidad={inactivos} />
        </section>

        <section className="rounded-3xl border border-negro/10 bg-white p-5 shadow-[0_20px_45px_rgba(0,0,0,0.08)]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-rojo">
              Directorio
            </p>
            <h2 className="mt-1 font-titulos text-2xl uppercase tracking-wide text-negro">
              Comercios registrados
            </h2>
          </div>

          {comercios.length === 0 ? (
            <p className="mt-5 rounded-2xl bg-fondo p-4 text-sm text-negro/60">
              No hay comercios registrados.
            </p>
          ) : (
            <ul className="mt-5 divide-y divide-negro/10 overflow-hidden rounded-2xl border border-negro/10">
              {comercios.map((comercio) => {
                const esPiamonte = comercio.slug === "piamonte";
                return (
                  <li
                    key={comercio.id}
                    className="flex flex-col gap-4 bg-white p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate font-semibold text-negro">
                          {comercio.nombre}
                        </h3>
                        <span
                          className={`rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${
                            comercio.activo
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-negro/10 text-negro/55"
                          }`}
                        >
                          {comercio.activo ? "Activo" : "Inactivo"}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-negro/50">
                        Identificador: {comercio.slug}
                      </p>
                    </div>

                    {esPiamonte && comercio.activo ? (
                      <Link
                        href="/admin"
                        className="inline-flex shrink-0 items-center justify-center rounded-full bg-rojo px-4 py-2 text-sm font-semibold text-white hover:bg-negro"
                      >
                        Administrar Piamonte
                      </Link>
                    ) : (
                      <span className="shrink-0 text-xs font-semibold uppercase tracking-wide text-negro/40">
                        Administración no disponible
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}

function Resumen({
  titulo,
  cantidad,
  destacado = false,
}: {
  titulo: string;
  cantidad: number;
  destacado?: boolean;
}) {
  return (
    <article
      className={`rounded-2xl border p-4 ${
        destacado
          ? "border-emerald-200 bg-emerald-50"
          : "border-negro/10 bg-white"
      }`}
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-negro/55">
        {titulo}
      </p>
      <p className="mt-1 font-titulos text-3xl text-negro">{cantidad}</p>
    </article>
  );
}
