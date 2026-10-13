"use client";

import type {
  DatosCheckout,
  ErroresCheckout,
} from "@/lib/checkout/tipos";
import { CampoTexto } from "./CampoTexto";
import { SelectorEntrega } from "./SelectorEntrega";
import { SelectorMetodoPago } from "./SelectorMetodoPago";

// Formulario de datos del cliente: tipo de entrega, contacto y dirección (solo delivery).
export function FormularioCheckout({
  id,
  datos,
  errores,
  onCambio,
  onEnviar,
}: {
  id: string;
  datos: DatosCheckout;
  errores: ErroresCheckout;
  onCambio: (cambios: Partial<DatosCheckout>) => void;
  onEnviar: () => void;
}) {
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
      </Seccion>

      <Seccion titulo="¿Cómo lo pagás?">
        <SelectorMetodoPago
          valor={datos.metodoPago}
          onCambio={(metodoPago) => onCambio({ metodoPago })}
          error={errores.metodoPago}
        />
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
