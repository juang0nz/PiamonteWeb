"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";

type EventoAuditoria = {
  id: string;
  creado_en: string;
  actor_user_id: string;
  actorEmail: string;
  comercio_id: string;
  comercioNombre: string;
  accion: string;
  entidad: string;
  registro_id: string;
  valores_anteriores: Record<string, unknown> | null;
  valores_nuevos: Record<string, unknown> | null;
};

type Opcion = { id: string; nombre?: string; email?: string };

type RespuestaAuditoria = {
  eventos?: EventoAuditoria[];
  comercios?: Opcion[];
  usuarios?: Opcion[];
  pagina?: number;
  porPagina?: number;
  total?: number;
  error?: string;
};

const ACCIONES = [
  "crear",
  "actualizar",
  "eliminar",
  "cambiar_disponibilidad",
  "cambiar_estado",
  "asignar",
  "invitacion_iniciada",
  "invitacion_fallida",
];

export function PanelAuditoriaSuperAdmin() {
  const [eventos, setEventos] = useState<EventoAuditoria[]>([]);
  const [comercios, setComercios] = useState<Opcion[]>([]);
  const [usuarios, setUsuarios] = useState<Opcion[]>([]);
  const [pagina, setPagina] = useState(1);
  const [total, setTotal] = useState(0);
  const [porPagina, setPorPagina] = useState(20);
  const [filtros, setFiltros] = useState({
    comercioId: "",
    actorId: "",
    accion: "",
    desde: "",
    hasta: "",
  });
  const [aplicados, setAplicados] = useState(filtros);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const parametros = new URLSearchParams({ pagina: String(pagina) });
      for (const [clave, valor] of Object.entries(aplicados)) {
        if (valor) parametros.set(clave, valor);
      }
      const respuesta = await fetch(
        `/api/super-admin/auditoria?${parametros.toString()}`,
        { credentials: "same-origin", cache: "no-store" },
      );
      const cuerpo = (await respuesta.json().catch(() => null)) as
        | RespuestaAuditoria
        | null;
      if (!respuesta.ok) {
        throw new Error(cuerpo?.error ?? "No pudimos cargar la auditoría.");
      }
      setEventos(cuerpo?.eventos ?? []);
      setComercios(cuerpo?.comercios ?? []);
      setUsuarios(cuerpo?.usuarios ?? []);
      setTotal(cuerpo?.total ?? 0);
      setPorPagina(cuerpo?.porPagina ?? 20);
    } catch (errorDesconocido) {
      setError(
        errorDesconocido instanceof Error
          ? errorDesconocido.message
          : "No pudimos cargar la auditoría.",
      );
    } finally {
      setCargando(false);
    }
  }, [aplicados, pagina]);

  useEffect(() => {
    const temporizador = window.setTimeout(() => void cargar(), 0);
    return () => window.clearTimeout(temporizador);
  }, [cargar]);

  function aplicar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setPagina(1);
    setAplicados(filtros);
  }

  const paginas = Math.max(1, Math.ceil(total / porPagina));

  return (
    <div className="space-y-5">
      <form
        onSubmit={aplicar}
        className="grid gap-3 rounded-3xl border border-negro/10 bg-white p-5 shadow-[0_20px_45px_rgba(0,0,0,0.08)] md:grid-cols-2 xl:grid-cols-5"
      >
        <FiltroSelect
          etiqueta="Comercio"
          value={filtros.comercioId}
          onChange={(value) => setFiltros((actual) => ({ ...actual, comercioId: value }))}
          opciones={comercios.map((comercio) => ({
            value: comercio.id,
            label: comercio.nombre ?? comercio.id,
          }))}
        />
        <FiltroSelect
          etiqueta="Usuario"
          value={filtros.actorId}
          onChange={(value) => setFiltros((actual) => ({ ...actual, actorId: value }))}
          opciones={usuarios.map((usuario) => ({
            value: usuario.id,
            label: usuario.email ?? usuario.id,
          }))}
        />
        <FiltroSelect
          etiqueta="Acción"
          value={filtros.accion}
          onChange={(value) => setFiltros((actual) => ({ ...actual, accion: value }))}
          opciones={ACCIONES.map((accion) => ({
            value: accion,
            label: accion.replaceAll("_", " "),
          }))}
        />
        <FiltroFecha
          etiqueta="Desde"
          value={filtros.desde}
          onChange={(value) => setFiltros((actual) => ({ ...actual, desde: value }))}
        />
        <FiltroFecha
          etiqueta="Hasta"
          value={filtros.hasta}
          onChange={(value) => setFiltros((actual) => ({ ...actual, hasta: value }))}
        />
        <div className="flex flex-wrap gap-2 md:col-span-2 xl:col-span-5">
          <button
            type="submit"
            disabled={cargando}
            className="rounded-full bg-rojo px-5 py-2 text-sm font-semibold text-white hover:bg-negro disabled:opacity-45"
          >
            Aplicar filtros
          </button>
          <button
            type="button"
            onClick={() => {
              const vacios = {
                comercioId: "",
                actorId: "",
                accion: "",
                desde: "",
                hasta: "",
              };
              setFiltros(vacios);
              setAplicados(vacios);
              setPagina(1);
            }}
            className="rounded-full border border-negro/15 px-5 py-2 text-sm font-semibold text-negro hover:bg-fondo"
          >
            Limpiar
          </button>
        </div>
      </form>

      {error && (
        <p className="rounded-2xl bg-rojo/10 px-4 py-3 text-sm text-rojo">
          {error}
        </p>
      )}

      <section className="rounded-3xl border border-negro/10 bg-white p-5 shadow-[0_20px_45px_rgba(0,0,0,0.08)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-titulos text-2xl uppercase tracking-wide text-negro">
            Movimientos
          </h2>
          <span className="text-sm text-negro/55">{total} registros</span>
        </div>

        {cargando ? (
          <p className="mt-5 text-sm text-negro/60">Cargando auditoría…</p>
        ) : eventos.length === 0 ? (
          <p className="mt-5 rounded-2xl bg-fondo p-4 text-sm text-negro/60">
            No hay movimientos para los filtros seleccionados.
          </p>
        ) : (
          <div className="mt-5 space-y-3">
            {eventos.map((evento) => (
              <article
                key={evento.id}
                className="rounded-2xl border border-negro/10 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold capitalize text-negro">
                      {evento.accion.replaceAll("_", " ")} · {evento.entidad}
                    </p>
                    <p className="mt-1 text-xs text-negro/55">
                      {evento.comercioNombre} · {evento.actorEmail}
                    </p>
                  </div>
                  <time className="text-xs text-negro/50">
                    {new Intl.DateTimeFormat("es-UY", {
                      dateStyle: "short",
                      timeStyle: "medium",
                    }).format(new Date(evento.creado_en))}
                  </time>
                </div>
                <p className="mt-2 break-all font-mono text-[11px] text-negro/45">
                  Registro: {evento.registro_id}
                </p>
                {(evento.valores_anteriores || evento.valores_nuevos) && (
                  <details className="mt-3 rounded-xl bg-fondo p-3">
                    <summary className="cursor-pointer text-sm font-semibold text-negro">
                      Ver valores
                    </summary>
                    <div className="mt-3 grid gap-3 lg:grid-cols-2">
                      <Valores titulo="Antes" valor={evento.valores_anteriores} />
                      <Valores titulo="Después" valor={evento.valores_nuevos} />
                    </div>
                  </details>
                )}
              </article>
            ))}
          </div>
        )}

        <div className="mt-5 flex items-center justify-between gap-3">
          <button
            type="button"
            disabled={pagina <= 1 || cargando}
            onClick={() => setPagina((actual) => Math.max(1, actual - 1))}
            className="rounded-full border border-negro/15 px-4 py-2 text-sm font-semibold disabled:opacity-40"
          >
            Anterior
          </button>
          <span className="text-sm text-negro/60">
            Página {pagina} de {paginas}
          </span>
          <button
            type="button"
            disabled={pagina >= paginas || cargando}
            onClick={() => setPagina((actual) => Math.min(paginas, actual + 1))}
            className="rounded-full border border-negro/15 px-4 py-2 text-sm font-semibold disabled:opacity-40"
          >
            Siguiente
          </button>
        </div>
      </section>
    </div>
  );
}

function FiltroSelect({
  etiqueta,
  value,
  onChange,
  opciones,
}: {
  etiqueta: string;
  value: string;
  onChange: (value: string) => void;
  opciones: { value: string; label: string }[];
}) {
  return (
    <label className="text-sm font-semibold text-negro">
      {etiqueta}
      <select
        value={value}
        onChange={(evento) => onChange(evento.target.value)}
        className="mt-1.5 w-full rounded-xl border border-negro/15 bg-white px-3 py-2 font-normal"
      >
        <option value="">Todos</option>
        {opciones.map((opcion) => (
          <option key={opcion.value} value={opcion.value}>
            {opcion.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function FiltroFecha({
  etiqueta,
  value,
  onChange,
}: {
  etiqueta: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="text-sm font-semibold text-negro">
      {etiqueta}
      <input
        type="date"
        value={value}
        onChange={(evento) => onChange(evento.target.value)}
        className="mt-1.5 w-full rounded-xl border border-negro/15 bg-white px-3 py-2 font-normal"
      />
    </label>
  );
}

function Valores({
  titulo,
  valor,
}: {
  titulo: string;
  valor: Record<string, unknown> | null;
}) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wide text-negro/55">
        {titulo}
      </p>
      <pre className="mt-1 overflow-x-auto whitespace-pre-wrap break-words text-xs text-negro/70">
        {valor ? JSON.stringify(valor, null, 2) : "Sin valores"}
      </pre>
    </div>
  );
}
