"use client";

import { useEffect, useState } from "react";
import { filtrarClientes, type ClienteAdmin } from "@/lib/admin/clientes";

const moneda = (total: number) => new Intl.NumberFormat("es-UY", { style: "currency", currency: "UYU" }).format(total);
const fecha = (valor: string) => new Intl.DateTimeFormat("es-UY", {
  dateStyle: "short", timeStyle: "short", timeZone: "America/Montevideo",
}).format(new Date(valor));

export function PanelClientesAdmin() {
  const [clientes, setClientes] = useState<ClienteAdmin[]>([]);
  const [sinTelefono, setSinTelefono] = useState(0);
  const [busqueda, setBusqueda] = useState("");
  const [seleccion, setSeleccion] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const controlador = new AbortController();
    async function cargar() {
      setCargando(true);
      setError(null);
      try {
        const respuesta = await fetch("/api/admin/clientes", { cache: "no-store", credentials: "same-origin", signal: controlador.signal });
        const cuerpo: { clientes?: ClienteAdmin[]; pedidosSinTelefono?: number; error?: string } = await respuesta.json();
        if (!respuesta.ok) throw new Error(cuerpo.error ?? "No pudimos cargar los clientes.");
        if (!Array.isArray(cuerpo.clientes) || typeof cuerpo.pedidosSinTelefono !== "number") {
          throw new Error("La respuesta de clientes no es válida.");
        }
        setClientes(cuerpo.clientes);
        setSinTelefono(cuerpo.pedidosSinTelefono);
      } catch (error) {
        if (!controlador.signal.aborted) {
          setClientes([]);
          setError(error instanceof Error ? error.message : "No pudimos cargar los clientes.");
        }
      } finally {
        if (!controlador.signal.aborted) setCargando(false);
      }
    }
    void cargar();
    return () => controlador.abort();
  }, [version]);
  const filtrados = filtrarClientes(clientes, busqueda);
  const cliente = filtrados.find(c => c.telefono === seleccion) ?? null;
  return (
    <div className="space-y-5 text-negro">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-titulos text-3xl uppercase">Clientes</h1>
          <p className="mt-1 text-sm text-negro/65">Contactos agrupados por celular a partir de los pedidos de este comercio. No son cuentas verificadas.</p>
        </div>
        <button type="button" onClick={() => setVersion(v => v + 1)} disabled={cargando}
          className="rounded-full bg-negro px-4 py-2 text-sm font-semibold text-crema disabled:opacity-50">Actualizar</button>
      </div>
      <label className="block max-w-lg text-sm font-semibold">Buscar por nombre o celular
        <input type="search" value={busqueda} onChange={e => setBusqueda(e.target.value)}
          className="mt-2 w-full rounded-full border border-negro/15 bg-white px-4 py-3 outline-none focus:border-rojo" />
      </label>
      <p className="text-xs text-negro/65">La cantidad incluye todos los pedidos. El importe acumulado excluye cancelados y no representa pagos cobrados.</p>
      {cargando ? <p role="status">Cargando clientes…</p> : error ? (
        <p role="alert" className="rounded-xl bg-rojo/10 p-4 text-sm text-rojo">{error}</p>
      ) : (
        <>
          {sinTelefono > 0 && <p className="text-sm text-negro/65">{sinTelefono} pedido(s) sin celular no se agrupan como clientes.</p>}
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <section aria-label="Listado de clientes" className="space-y-3">
              {filtrados.length === 0 && <p className="rounded-2xl border border-negro/10 bg-white p-5 text-sm">{clientes.length ? "No encontramos clientes con esa búsqueda." : "Todavía no hay clientes con pedidos registrados."}</p>}
              {filtrados.map(c => (
                <button type="button" key={c.telefono} aria-pressed={c.telefono === seleccion} onClick={() => setSeleccion(c.telefono)}
                  className={`w-full rounded-2xl border bg-white p-4 text-left shadow-sm ${c.telefono === seleccion ? "border-rojo" : "border-negro/10 hover:border-negro/30"}`}>
                  <p className="break-words font-semibold">{c.nombre || "Nombre no registrado"}</p>
                  <p className="mt-1 text-sm text-negro/70">{c.telefono}{!c.telefonoValido && " · Revisar formato"}</p>
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                    <span>{c.cantidadPedidos} pedido(s)</span><span>{moneda(c.importeAcumulado)} sin cancelados</span>
                  </div>
                  <p className="mt-2 text-xs text-negro/65">Último pedido: {fecha(c.ultimoPedido)}</p>
                  {c.direccion && <p className="mt-2 break-words text-sm">{c.direccion.calle} {c.direccion.numero}{c.direccion.apartamento ? `, apto. ${c.direccion.apartamento}` : ""}</p>}
                </button>
              ))}
            </section>
            <section aria-label="Historial del cliente" aria-live="polite" className="min-w-0 self-start rounded-2xl border border-negro/10 bg-white p-4 shadow-sm sm:p-5">
              {!cliente ? <p className="text-sm text-negro/65">Seleccioná un cliente para ver su historial.</p> : (
                <>
                  <h2 className="break-words font-titulos text-2xl uppercase">{cliente.nombre || "Cliente"}</h2>
                  <p className="mt-1 text-sm">{cliente.telefono}</p>
                  {cliente.direccion ? (
                    <div className="mt-3 text-sm">
                      <p className="font-semibold">Última dirección de entrega registrada</p>
                      <p>{cliente.direccion.calle} {cliente.direccion.numero}{cliente.direccion.apartamento ? `, apto. ${cliente.direccion.apartamento}` : ""}</p>
                      {cliente.direccion.referencias && <p className="mt-1 text-negro/65">{cliente.direccion.referencias}</p>}
                    </div>
                  ) : <p className="mt-3 text-sm text-negro/65">Sin dirección de entrega registrada.</p>}
                  <p className="mt-4 text-sm">{cliente.pedidosNoCancelados} pedido(s) no cancelados · {moneda(cliente.importeAcumulado)}</p>
                  <h3 className="mt-5 font-semibold">Historial de pedidos</h3>
                  <ol className="mt-3 space-y-3">
                    {cliente.pedidos.map(p => (
                      <li key={p.id} className={`rounded-xl border p-3 text-sm ${p.cancelado ? "border-rojo/20 bg-rojo/5" : "border-negro/10"}`}>
                        <div className="flex flex-wrap justify-between gap-2"><strong>Pedido #{p.numero}</strong><span>{moneda(p.total)}</span></div>
                        <p className="mt-1 text-negro/65">{fecha(p.fecha)}</p>
                        <p className={`mt-2 ${p.cancelado ? "font-semibold text-rojo" : ""}`}>{p.cancelado ? "Cancelado · No suma al importe acumulado" : `Estado: ${p.estado.replaceAll("_", " ")}`}</p>
                      </li>
                    ))}
                  </ol>
                </>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}
