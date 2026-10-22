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
  validarPagoCheckout,
  type DatosCheckout,
} from "@/lib/checkout/tipos";
import { useHidratado } from "@/lib/hidratacion";
import { SLUG_COMERCIO } from "@/lib/comercio";
import { obtenerEstadoApertura } from "@/lib/comercio/horarios";
import type { TiemposVigentes } from "@/lib/comercio/tiempos";
import type { ResultadoRegistroPedidoConfirmado } from "@/lib/pedidos/tipos";
import type { EstadoDescuentoWeb } from "@/lib/comercio/descuento-web";
import { validarConfirmacionPedido } from "@/lib/checkout/confirmacion";
import { formatearImporteUYU } from "@/lib/catalogo/formato";
import { FormularioCheckout } from "./FormularioCheckout";
import { ResumenPedido } from "./ResumenPedido";

const ID_FORMULARIO = "formulario-checkout";

export type PausaCheckout = { pausado: boolean; mensaje: string };

export function PantallaCheckout({
  hrefCarrito,
  tiempos,
  pausa = { pausado: false, mensaje: "" },
  costoEnvio = null,
  descuentoWeb = { estado: "desconocido" },
}: {
  hrefCarrito: string;
  tiempos?: TiemposVigentes;
  pausa?: PausaCheckout;
  costoEnvio?: number | null;
  descuentoWeb?: EstadoDescuentoWeb;
}) {
  const hidratado = useHidratado();
  const { items, total } = useCarrito();
  const datos = useDatosCheckout();
  const [intentoEnviar, setIntentoEnviar] = useState(false);
  const [estadoEnvio, setEstadoEnvio] = useState<"idle" | "enviando" | "ok">("idle");
  const [pedidoId, setPedidoId] = useState<string | null>(null);
  const [numeroPedido, setNumeroPedido] = useState<number | null>(null);
  const [importesConfirmados, setImportesConfirmados] = useState<ResultadoRegistroPedidoConfirmado | null>(null);
  const [avisoImportes, setAvisoImportes] = useState<string | null>(null);
  const [errorServidor, setErrorServidor] = useState<string | null>(null);
  const estadoApertura = obtenerEstadoApertura();

  // Los errores se muestran recién después del primer intento de continuar.
  const errores = intentoEnviar ? { ...validarDatosCheckout(datos), ...validarPagoCheckout(datos) } : {};
  const envioEstimado = datos.tipoEntrega === "retiro" ? 0 : datos.tipoEntrega === "delivery" ? costoEnvio : null;

  function cambiar(cambios: Partial<DatosCheckout>) {
    actualizarDatosCheckout(cambios);
    if (estadoEnvio === "ok") {
      setEstadoEnvio("idle");
      setPedidoId(null);
      setNumeroPedido(null);
      setImportesConfirmados(null);
      setAvisoImportes(null);
    }
    setErrorServidor(null);
  }

  async function confirmarPedido() {
    if (estadoEnvio !== "idle") return;
    console.info("[checkout] click confirmar", {
      items: items.length,
      cantidadTotal: items.reduce((acum, item) => acum + item.cantidad, 0),
      tipoEntrega: datos.tipoEntrega,
    });
    setIntentoEnviar(true);
    setErrorServidor(null);
    const hayErrores = Object.keys({ ...validarDatosCheckout(datos), ...validarPagoCheckout(datos) }).length > 0;
    if (hayErrores || !datos.tipoEntrega || items.length === 0) {
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
    if (datos.tipoEntrega === "delivery" && costoEnvio === null) {
      setErrorServidor("No pudimos consultar la tarifa de delivery. Recargá la página para reintentar.");
      return;
    }
    if (descuentoWeb.estado === "desconocido") {
      setErrorServidor("No pudimos consultar el descuento web. Recargá la página antes de confirmar.");
      return;
    }
    if (!estadoApertura.abierto && !datos.programarParaApertura) {
      setEstadoEnvio("idle");
      setErrorServidor(
        `El local está cerrado. Marcá la opción para programar el pedido para ${estadoApertura.horaApertura}.`,
      );
      return;
    }
    // Pausa de pedidos (PIA-2): la UI corta antes de enviar; el servidor rechaza igual.
    if (pausa.pausado) {
      setEstadoEnvio("idle");
      setErrorServidor(pausa.mensaje || "El local no está tomando pedidos en este momento.");
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
          checkout: {
            tipoEntrega: datos.tipoEntrega, programarParaApertura: datos.programarParaApertura,
            nombre: datos.nombre, telefono: datos.telefono, calle: datos.calle,
            numero: datos.numero, apartamento: datos.apartamento, referencias: datos.referencias,
          },
          metodoPago: datos.tipoEntrega === "retiro" ? "pago_en_local" : datos.metodoPago,
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

      const json: unknown = await respuesta.json().catch(() => null);
      const cuerpo = typeof json === "object" && json !== null && !Array.isArray(json) ? json : null;
      console.info("[checkout] respuesta registro", {
        status: respuesta.status,
        ok: respuesta.ok,
        code: cuerpo && "code" in cuerpo ? cuerpo.code : null,
        tienePedidoId: Boolean(cuerpo && "pedidoId" in cuerpo && cuerpo.pedidoId),
        tieneError: Boolean(cuerpo && "error" in cuerpo && cuerpo.error),
      });
      if (!respuesta.ok || !cuerpo || !("pedidoId" in cuerpo) ||
        typeof cuerpo.pedidoId !== "string" || !cuerpo.pedidoId.trim()) {
        const mensaje = cuerpo && "error" in cuerpo && typeof cuerpo.error === "string" ? cuerpo.error : "No pudimos registrar el pedido.";
        throw new Error(mensaje);
      }

      setPedidoId(cuerpo.pedidoId);
      setNumeroPedido("numeroPedido" in cuerpo && typeof cuerpo.numeroPedido === "number" &&
        Number.isSafeInteger(cuerpo.numeroPedido) && cuerpo.numeroPedido > 0 ? cuerpo.numeroPedido : null);
      const importes = validarConfirmacionPedido(cuerpo, datos.tipoEntrega);
      if (importes) {
        setImportesConfirmados(importes);
      } else {
        // El pedido ya existe: no habilitar otro envío si la respuesta monetaria es inválida.
        console.error("[checkout] pedido registrado sin importes confirmados válidos");
        setAvisoImportes("El pedido se registró, pero no pudimos mostrar su total confirmado. Consultá al local antes de volver a pedir.");
      }
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
          {importesConfirmados && (
            <dl className="mx-auto mt-5 max-w-sm space-y-2 rounded-2xl bg-white p-4 text-sm">
              <div className="flex justify-between"><dt>Subtotal</dt><dd>{formatearImporteUYU(importesConfirmados.subtotal)}</dd></div>
              {importesConfirmados.promocion && importesConfirmados.promocion.porcentaje > 0 && (
                <div className="flex justify-between"><dt>Descuento web{` (${importesConfirmados.promocion.porcentaje} %)`}</dt><dd>−{formatearImporteUYU(importesConfirmados.descuento)}</dd></div>
              )}
              <div className="flex justify-between"><dt>Envío</dt><dd>{formatearImporteUYU(importesConfirmados.costoEnvio)}</dd></div>
              <div className="flex justify-between font-semibold"><dt>Total confirmado</dt><dd>{formatearImporteUYU(importesConfirmados.total)}</dd></div>
            </dl>
          )}
          {avisoImportes && <p role="alert" className="mt-4 text-sm text-rojo">{avisoImportes}</p>}
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
          tiempos={tiempos}
          onCambio={cambiar}
          onEnviar={() => {
            void confirmarPedido();
          }}
        />

        <div className="lg:sticky lg:top-8">
          <ResumenPedido items={items} subtotal={total} costoEnvio={envioEstimado} descuentoWeb={descuentoWeb}>
            {datos.tipoEntrega === "delivery" && costoEnvio === null && (
              <p role="alert" className="mb-3 text-sm text-rojo">
                No pudimos consultar la tarifa de delivery. Recargá la página para reintentar.
              </p>
            )}
            {pausa.pausado && (
              <p
                role="status"
                className="mb-3 block rounded-xl border border-rojo/30 bg-rojo/10 p-3 text-sm text-rojo"
              >
                <span className="mb-1 block font-semibold">Pedidos en pausa</span>
                <span className="block text-xs text-rojo/90">{pausa.mensaje}</span>
              </p>
            )}
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
                descuentoWeb.estado === "desconocido" ||
                (datos.tipoEntrega === "delivery" && costoEnvio === null) ||
                pausa.pausado ||
                (!estadoApertura.abierto && !datos.programarParaApertura)
              }
              className="w-full rounded-full bg-rojo px-6 py-3.5 font-semibold text-white transition-colors hover:bg-negro disabled:cursor-not-allowed disabled:opacity-60"
            >
              {estadoEnvio === "enviando"
                ? "Confirmando pedido…"
                : pausa.pausado
                  ? "Pedidos en pausa"
                  : "Confirmar pedido"}
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
