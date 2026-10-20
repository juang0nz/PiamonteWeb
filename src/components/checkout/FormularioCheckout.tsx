"use client";

import type {
  DatosCheckout,
  ErroresCheckout,
} from "@/lib/checkout/tipos";
import { rangoPorModalidad, type TiemposVigentes } from "@/lib/comercio/tiempos";
import { CampoTexto } from "./CampoTexto";
import { SelectorEntrega } from "./SelectorEntrega";

// Formulario de datos del cliente: tipo de entrega, contacto y dirección (solo delivery).
export function FormularioCheckout({
  id,
  datos,
  errores,
  tiempos,
  onCambio,
  onEnviar,
}: {
  id: string;
  datos: DatosCheckout;
  errores: ErroresCheckout;
  tiempos?: TiemposVigentes;
  onCambio: (cambios: Partial<DatosCheckout>) => void;
  onEnviar: () => void;
}) {
  // Tiempo estimado vigente para la modalidad elegida (PIA-2); se oculta hasta elegir una.
  const rangoEstimado =
    tiempos && datos.tipoEntrega ? rangoPorModalidad(tiempos, datos.tipoEntrega) : null;

  return (
    <form
      id={id}
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        onEnviar();
      }}
      className="space-y-8 text-[#171717]"
    >
      <Seccion titulo="¿Cómo lo recibís?">
        <SelectorEntrega
          valor={datos.tipoEntrega}
          onCambio={(tipoEntrega) => onCambio({ tipoEntrega })}
          error={errores.tipoEntrega}
        />
        {rangoEstimado && (
          <p role="status" className="mt-3 text-sm text-negro/70">
            Tiempo estimado{datos.tipoEntrega === "retiro" ? " de retiro" : " de entrega"}:{" "}
            <strong className="font-semibold text-negro">{rangoEstimado.texto}</strong>
          </p>
        )}
      </Seccion>

      <Seccion titulo="¿Cómo lo pagás?">
        {datos.tipoEntrega === "delivery" ? (
          <fieldset aria-describedby={errores.metodoPago ? "error-metodo-pago" : undefined}>
            <legend className="sr-only">Medio de pago para delivery</legend>
            <div
              role="radiogroup"
              aria-label="Medio de pago para delivery"
              aria-invalid={errores.metodoPago ? true : undefined}
              aria-describedby={errores.metodoPago ? "error-metodo-pago" : undefined}
              tabIndex={-1}
              className="grid gap-3 sm:grid-cols-2"
            >
              {(["efectivo", "tarjeta_pos"] as const).map((metodo) => (
                <label key={metodo} className={`flex cursor-pointer items-center gap-3 rounded-2xl border-2 bg-white p-4 text-sm font-semibold ${
                  datos.metodoPago === metodo ? "border-rojo" : "border-negro/10"
                }`}>
                  <input
                    type="radio"
                    name="metodoPago"
                    value={metodo}
                    checked={datos.metodoPago === metodo}
                    onChange={() => onCambio({ metodoPago: metodo })}
                    className="accent-rojo"
                  />
                  {metodo === "efectivo" ? "Efectivo" : "Tarjeta (POS)"}
                </label>
              ))}
            </div>
            {errores.metodoPago && (
              <p id="error-metodo-pago" role="alert" className="mt-2 text-sm text-rojo">{errores.metodoPago}</p>
            )}
          </fieldset>
        ) : (
          <p className="rounded-2xl border-2 border-negro/10 bg-white p-4 text-sm text-negro/75">
            {datos.tipoEntrega === "retiro" ? "Pagás en el local" : "Elegí cómo recibir tu pedido para ver los medios de pago."}
          </p>
        )}
      </Seccion>

      <Seccion titulo="Tus datos">
        <p className="mb-4 text-sm text-negro/65">Solo necesitamos tu nombre y celular. No hace falta una cuenta.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <CampoTexto
            nombre="nombre"
            etiqueta="Nombre"
            valor={datos.nombre}
            onCambio={(nombre) => onCambio({ nombre })}
            error={errores.nombre}
            autoComplete="name"
          />
          <CampoTexto
            nombre="telefono"
            etiqueta="Celular"
            placeholder="099 806 731 o +598 99 806 731"
            tipo="tel"
            inputMode="tel"
            valor={datos.telefono}
            onCambio={(telefono) => onCambio({ telefono })}
            error={errores.telefono}
            autoComplete="tel"
            maxLength={25}
          />
        </div>
      </Seccion>

      {datos.tipoEntrega === "delivery" && (
        <Seccion titulo="Dirección de entrega">
          <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
            <CampoTexto
              nombre="calle"
              etiqueta="Calle"
              valor={datos.calle}
              onCambio={(calle) => onCambio({ calle })}
              error={errores.calle}
              autoComplete="address-line1"
            />
            <CampoTexto
              nombre="numero"
              etiqueta="Número"
              valor={datos.numero}
              onCambio={(numero) => onCambio({ numero })}
              error={errores.numero}
              maxLength={10}
            />
          </div>
          <div className="mt-4 grid gap-4">
            <CampoTexto
              nombre="apartamento"
              etiqueta="Apartamento"
              opcional
              valor={datos.apartamento}
              onCambio={(apartamento) => onCambio({ apartamento })}
              autoComplete="address-line2"
              maxLength={20}
            />
            <CampoTexto
              nombre="referencias"
              etiqueta="Referencias"
              opcional
              multilinea
              placeholder="Ej.: esquina, color de la puerta, timbre"
              valor={datos.referencias}
              onCambio={(referencias) => onCambio({ referencias })}
              maxLength={200}
            />
          </div>
        </Seccion>
      )}
    </form>
  );
}

function Seccion({
  titulo,
  children,
}: {
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="mb-3 font-titulos text-2xl uppercase tracking-wide text-[#171717]">
        {titulo}
      </h2>
      {children}
    </section>
  );
}
