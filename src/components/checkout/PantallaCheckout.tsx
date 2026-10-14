"use client";

import Link from "next/link";
import { useState } from "react";
import { useCarrito, vaciarCarrito } from "@/lib/carrito/almacen";
import {
  actualizarDatosCheckout,
  useDatosCheckout,
} from "@/lib/checkout/almacen";
import {
  validarDatosCheckout,
  type DatosCheckout,
} from "@/lib/checkout/tipos";
import { useHidratado } from "@/lib/hidratacion";
import { SLUG_COMERCIO } from "@/lib/comercio";
import { obtenerEstadoApertura } from "@/lib/comercio/horarios";
import { FormularioCheckout } from "./FormularioCheckout";
import { ResumenPedido } from "./ResumenPedido";

const ID_FORMULARIO = "formulario-checkout";

export function PantallaCheckout({ hrefCarrito }: { hrefCarrito: string }) {
  const hidratado = useHidratado();
  const { items, total } = useCarrito();
  const datos = useDatosCheckout();
  const [intentoEnviar, setIntentoEnviar] = useState(false);
  const [estadoEnvio, setEstadoEnvio] = useState<"idle" | "enviando" | "ok">("idle");
  const [pedidoId, setPedidoId] = useState<string | null>(null);
  const [numeroPedido, setNumeroPedido] = useState<number | null>(null);
  const [errorServidor, setErrorServidor] = useState<string | null>(null);
  const estadoApertura = obtenerEstadoApertura();

  // Los errores se muestran recién después del primer intento de continuar.
  const errores = intentoEnviar ? validarDatosCheckout(datos) : {};

  function cambiar(cambios: Partial<DatosCheckout>) {
    actualizarDatosCheckout(cambios);
    if (estadoEnvio === "ok") {
      setEstadoEnvio("idle");
      setPedidoId(null);
      setNumeroPedido(null);
    }
    setErrorServidor(null);
  }

  async function confirmarPedido() {
    if (estadoEnvio === "enviando") return;
    console.info("[checkout] click confirmar", {
      items: items.length,
      cantidadTotal: items.reduce((acum, item) => acum + item.cantidad, 0),
      tipoEntrega: datos.tipoEntrega,
    });
    setIntentoEnviar(true);
    setErrorServidor(null);
    const hayErrores = Object.keys(validarDatosCheckout(datos)).length > 0;
    if (hayErrores || items.length === 0) {
      console.info("[checkout] validación local bloquea envío", {
        hayErrores,
        items: items.length,
      });
      setEstadoEnvio("idle");
      // Lleva el foco al primer campo con error para facilitar la corrección.
      requestAnimationFrame(() => {
        document
          .querySelector<HTMLElement>(
            `#${ID_FORMULARIO} [aria-invalid="true"], #${ID_FORMULARIO} input[name="tipoEntrega"]`,
          )
          ?.focus();
      });
      return;
    }
    if (!estadoApertura.abierto && !datos.programarParaApertura) {
      setEstadoEnvio("idle");
      setErrorServidor(
        `El local está cerrado. Marcá la opción para programar el pedido para ${estadoApertura.horaApertura}.`,
      );
      return;
    }

    setEstadoEnvio("enviando");
    try {
      console.info("[checkout] enviando POST /api/pedidos/registrar");
      const respuesta = await fetch("/api/pedidos/registrar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          comercioSlug: SLUG_COMERCIO,
          checkout: datos,
          programarParaApertura: datos.programarParaApertura,
          items: items.map((item) => ({
            productoId: item.productoId,
            varianteId: item.varianteId,
            cantidad: item.cantidad,
            aclaraciones: item.aclaraciones,
            opciones: item.opciones.map((opcion) => ({
              opcionId: opcion.id,
            })),
          })),
        }),
      });

      const cuerpo = (await respuesta.json().catch(() => null)) as
        | { pedidoId?: string; numeroPedido?: number | null; error?: string; code?: string }
        | null;
      console.info("[checkout] respuesta registro", {
        status: respuesta.status,
        ok: respuesta.ok,
        code: cuerpo?.code ?? null,
        tienePedidoId: Boolean(cuerpo?.pedidoId),
        tieneError: Boolean(cuerpo?.error),
      });
      if (!respuesta.ok || !cuerpo?.pedidoId) {
        const mensaje = cuerpo?.error ?? "No pudimos registrar el pedido.";
        throw new Error(mensaje);
      }

      setPedidoId(cuerpo.pedidoId);
      setNumeroPedido(typeof cuerpo.numeroPedido === "number" ? cuerpo.numeroPedido : null);
      setEstadoEnvio("ok");
      // Solo se vacía el carrito después de confirmar que el servidor registró el pedido.
      vaciarCarrito();
    } catch (error) {
      console.error("[checkout] fallo registro pedido", error);
      setEstadoEnvio("idle");
      setErrorServidor(error instanceof Error ? error.message : "No pudimos registrar el pedido.");
    }
  }

  if (!hidratado) {
    return <p className="py-24 text-center text-sm text-negro/60">Cargando tu pedido…</p>;
  }

  if (items.length === 0) {
    if (estadoEnvio === "ok" && pedidoId) {
      return (
        <div className="mx-auto max-w-xl py-24 text-center">
          <h1 className="font-titulos text-4xl uppercase">¡Pedido confirmado!</h1>
          {numeroPedido !== null && (
            <p className="mt-3 text-sm text-negro/70">
              Número de pedido:{" "}
              <span className="font-semibold text-negro">#{numeroPedido}</span>
            </p>
          )}
          <p className="mt-2 text-sm text-negro/70">
            Estado del pedido: <span className="font-semibold text-negro">Pendiente</span>
          </p>
          <p className="mt-1 text-sm text-negro/70">
            Estado de pago: <span className="font-semibold text-negro">Pago pendiente</span>
          </p>
          <Link
            href="/"
            className="mt-6 inline-block rounded-full bg-rojo px-6 py-3 font-semibold text-white hover:bg-negro"
          >
            Volver al menú
          </Link>
        </div>
      );
    }

    return (
      <div className="mx-auto max-w-md py-24 text-center">
        <h1 className="font-titulos text-3xl uppercase">Tu pedido está vacío</h1>
        <p className="mt-2 text-sm text-negro/60">
          Agregá productos desde el menú para continuar.
        </p>
        <Link
          href="/"
          className="mt-6 inline-block rounded-full bg-rojo px-6 py-3 font-semibold text-white hover:bg-negro"
        >
          Ver el menú
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl text-[#171717]">
      <Link
        href={hrefCarrito}
        className="inline-flex items-center gap-1 text-sm font-semibold text-negro/70 hover:text-rojo"
      >
        <span aria-hidden>←</span> Volver al carrito
      </Link>
      <h1 className="mt-2 font-titulos text-4xl uppercase tracking-wide sm:text-5xl">
        Finalizar pedido
        <span className="mt-2 block h-1 w-12 bg-rojo" />
      </h1>

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
        <FormularioCheckout
          id={ID_FORMULARIO}
          datos={datos}
          errores={errores}
          onCambio={cambiar}
          onEnviar={() => {
            void confirmarPedido();
          }}
        />

        <div className="lg:sticky lg:top-8">
          <ResumenPedido items={items} subtotal={total}>
            {!estadoApertura.abierto && (
              <label className="mb-3 block rounded-xl border border-rojo/30 bg-rojo/10 p-3 text-sm text-rojo">
                <span className="mb-1 block font-semibold">Local cerrado en este momento</span>
                <span className="block text-xs text-rojo/90">
                  Podés dejarlo programado para cuando abra ({estadoApertura.horaApertura}).
                </span>
                <span className="mt-2 inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={datos.programarParaApertura}
                    onChange={(evento) =>
                      cambiar({ programarParaApertura: evento.target.checked })
                    }
                  />
                  Programar pedido para la próxima apertura
                </span>
              </label>
            )}
            <button
              type="submit"
              form={ID_FORMULARIO}
              disabled={
                estadoEnvio === "enviando" ||
                (!estadoApertura.abierto && !datos.programarParaApertura)
              }
              className="w-full rounded-full bg-rojo px-6 py-3.5 font-semibold text-white transition-colors hover:bg-negro disabled:cursor-not-allowed disabled:opacity-60"
            >
              {estadoEnvio === "enviando" ? "Confirmando pedido…" : "Confirmar pedido"}
            </button>
            {intentoEnviar && Object.keys(errores).length > 0 && (
              <p role="alert" className="mt-3 text-center text-xs text-rojo">
                Revisá los campos marcados para continuar.
              </p>
            )}
            {errorServidor && (
              <p role="alert" className="mt-3 rounded-xl bg-rojo/10 p-3 text-center text-xs text-rojo">
                {errorServidor}
              </p>
            )}
          </ResumenPedido>
        </div>
      </div>
    </div>
  );
}
