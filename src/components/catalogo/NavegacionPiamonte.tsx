"use client";

import Link from "next/link";
import { useState } from "react";
import { createPortal } from "react-dom";
import type { EstadoApertura } from "@/lib/comercio/horarios";
import { SLUG_CATEGORIA_PROMOCIONES, URL_PROMOCIONES } from "@/lib/comercio/promociones";
import { Dialogo } from "./Dialogo";

type SeccionInformativa = "ubicacion" | "horarios" | "delivery" | "contacto";

const URL_MAPA_INSERTADO =
  "https://maps.google.com/maps?q=Piamonte%2C%20Parque%20Posadas%2C%20Montevideo%2C%20Uruguay&z=15&output=embed";
const URL_MAPA_DELIVERY =
  "https://www.openstreetmap.org/export/embed.html?bbox=-56.27471%2C-34.88985%2C-56.11431%2C-34.81985&layer=mapnik";
const URL_WHATSAPP =
  "https://wa.me/59899806731?text=Hola%2C%20quisiera%20hacer%20una%20consulta.";
const URL_INSTAGRAM =
  "https://www.instagram.com/piamonte.parqueposadas/";

const detalles: Record<SeccionInformativa, { titulo: string; icono: string }> = {
  ubicacion: { titulo: "¿Dónde estamos?", icono: "ubicacion" },
  horarios: { titulo: "Horarios", icono: "reloj" },
  delivery: { titulo: "Zonas de delivery", icono: "delivery" },
  contacto: { titulo: "Contacto", icono: "mensaje" },
};

export function NavegacionPiamonte({
  categoriaActiva,
  estadoApertura,
  onNavegar,
}: {
  categoriaActiva?: string;
  estadoApertura: EstadoApertura;
  onNavegar?: () => void;
}) {
  const [seccionAbierta, setSeccionAbierta] =
    useState<SeccionInformativa | null>(null);

  function abrirInformacion(seccion: SeccionInformativa) {
    setSeccionAbierta(seccion);
    onNavegar?.();
  }

  return (
    <>
      <nav aria-label="Navegación de Piamonte" className="flex min-h-0 flex-1 flex-col">
        <p className="mb-2 mt-5 px-2 font-titulos text-xs uppercase tracking-[0.18em] text-crema/40">
          Explorar
        </p>
        <ul className="space-y-1">
          <li>
            <EnlaceNavegacion href="/" icono="inicio" activo={!categoriaActiva} onClick={onNavegar}>
              Inicio
            </EnlaceNavegacion>
          </li>
          <li>
            <EnlaceNavegacion
              href={URL_PROMOCIONES}
              icono="promociones"
              activo={categoriaActiva === SLUG_CATEGORIA_PROMOCIONES}
              onClick={onNavegar}
            >
              Promociones
            </EnlaceNavegacion>
          </li>
        </ul>

        <div className="my-4 border-t border-crema/10" />
        <p className="mb-2 px-2 font-titulos text-xs uppercase tracking-[0.18em] text-crema/40">
          Información
        </p>
        <ul className="space-y-1">
          {(Object.keys(detalles) as SeccionInformativa[]).map((seccion) => (
            <li key={seccion}>
              <button
                type="button"
                onClick={() => abrirInformacion(seccion)}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-crema/75 transition-colors hover:bg-crema/[0.06] hover:text-crema"
              >
                <Icono tipo={detalles[seccion].icono} />
                {detalles[seccion].titulo}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {/* Se renderiza en el body para que no herede el estado oculto/inerte del menú móvil al cerrarse. */}
      {seccionAbierta && createPortal(
        <Dialogo
          titulo={detalles[seccionAbierta].titulo}
          onCerrar={() => setSeccionAbierta(null)}
        >
          <div className="space-y-3 p-5 text-sm leading-relaxed text-negro/75">
            {seccionAbierta === "ubicacion" && (
              <div className="space-y-3">
                <p className="font-medium text-negro">
                  Parque Posadas, Montevideo
                </p>
                <iframe
                  title="Mapa de ubicación de Piamonte en Parque Posadas"
                  src={URL_MAPA_INSERTADO}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  className="h-72 w-full rounded-xl border-0"
                />
              </div>
            )}
            {seccionAbierta === "horarios" && (
              <>
                <p>{estadoApertura.horario}</p>
                <p className="font-medium text-negro">{estadoApertura.mensaje}</p>
              </>
            )}
            {seccionAbierta === "delivery" && (
              <div className="space-y-3">
                <p>
                  Hacemos delivery en un radio de <strong>3 km</strong> desde
                  Parque Posadas.
                </p>
                <div
                  role="img"
                  aria-label="Mapa aproximado de la zona de delivery: un radio de 3 kilómetros desde Parque Posadas"
                  className="relative aspect-[15/8] w-full overflow-hidden rounded-xl"
                >
                  <iframe
                    title="Mapa de la zona de delivery de Piamonte"
                    src={URL_MAPA_DELIVERY}
                    loading="lazy"
                    aria-hidden="true"
                    tabIndex={-1}
                    className="pointer-events-none absolute inset-0 h-full w-full border-0"
                  />
                  <svg
                    viewBox="0 0 600 320"
                    preserveAspectRatio="none"
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 h-full w-full"
                  >
                    <circle
                      cx="300"
                      cy="160"
                      r="123"
                      fill="#d4141c"
                      fillOpacity="0.16"
                      stroke="#d4141c"
                      strokeWidth="3"
                    />
                    <circle
                      cx="300"
                      cy="160"
                      r="7"
                      fill="#d4141c"
                      stroke="white"
                      strokeWidth="3"
                    />
                  </svg>
                </div>
                <p className="text-xs text-negro/55">
                  El centro del radio es aproximado al centro de Parque Posadas.
                  © OpenStreetMap
                </p>
              </div>
            )}
            {seccionAbierta === "contacto" && (
              <div className="space-y-3">
                <a
                  href={URL_WHATSAPP}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-center gap-2 rounded-lg bg-[#25D366] px-4 py-3 font-semibold text-[#075E54] transition-colors hover:bg-[#20bd5a]"
                >
                  <Icono tipo="mensaje" />
                  Escribir por WhatsApp
                </a>
                <a
                  href={URL_INSTAGRAM}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-[#833AB4] via-[#E1306C] to-[#F77737] px-4 py-3 font-semibold text-white transition-opacity hover:opacity-90"
                >
                  <Icono tipo="instagram" />
                  Instagram · @piamonte.parqueposadas
                </a>
              </div>
            )}
          </div>
        </Dialogo>,
        document.body,
      )}
    </>
  );
}

function EnlaceNavegacion({
  href,
  icono,
  activo,
  onClick,
  children,
}: {
  href: string;
  icono: string;
  activo: boolean;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      aria-current={activo ? "page" : undefined}
      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
        activo
          ? "bg-rojo text-crema"
          : "text-crema/75 hover:bg-crema/[0.06] hover:text-crema"
      }`}
    >
      <Icono tipo={icono} />
      {children}
    </Link>
  );
}

function Icono({ tipo }: { tipo: string }) {
  const atributos = {
    viewBox: "0 0 24 24",
    "aria-hidden": true as const,
    className: "h-[18px] w-[18px] shrink-0",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  switch (tipo) {
    case "inicio":
      return <svg {...atributos}><path d="m3 10 9-7 9 7" /><path d="M5 9v12h14V9M9 21v-7h6v7" /></svg>;
    case "carta":
      return <svg {...atributos}><path d="M4 4h16v16H4zM8 8h8M8 12h8M8 16h5" /></svg>;
    case "promociones":
      return <svg {...atributos}><path d="m20 13-7 7L3 10V3h7z" /><circle cx="7.5" cy="7.5" r="1" /></svg>;
    case "ubicacion":
      return <svg {...atributos}><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></svg>;
    case "reloj":
      return <svg {...atributos}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>;
    case "delivery":
      return <svg {...atributos}><path d="M3 7h11v10H3zM14 10h4l3 3v4h-7" /><circle cx="7.5" cy="18" r="1.5" /><circle cx="18" cy="18" r="1.5" /></svg>;
    case "instagram":
      return <svg {...atributos}><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><path d="M17.5 6.5h.01" /></svg>;
    default:
      return <svg {...atributos}><path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5Z" /></svg>;
  }
}
