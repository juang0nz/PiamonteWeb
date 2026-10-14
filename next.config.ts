import type { NextConfig } from "next";

// Política de seguridad de contenido. Empieza en modo "Report-Only": el navegador
// informa las violaciones en la consola pero no bloquea nada. Incluye Supabase
// (API REST, Auth, Storage y Realtime por WebSocket) y las imágenes externas que usa
// el catálogo (Unsplash y Wikimedia Commons). Sin Mercado Pago no hacen falta
// frame-src ni script-src externos.
// TODO: tras validar en Preview que la consola no registra violaciones legítimas,
// renombrar la cabecera a "Content-Security-Policy" (modo bloqueante).
const POLITICA_CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  // Next.js inyecta scripts y estilos en línea para hidratación y Tailwind.
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.supabase.co https://images.unsplash.com https://upload.wikimedia.org",
  "font-src 'self' data:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
  "upgrade-insecure-requests",
].join("; ");

const CABECERAS_SEGURIDAD = [
  // Dos años, incluye subdominios. Vercel sirve siempre por HTTPS.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Content-Security-Policy-Report-Only", value: POLITICA_CSP },
];

const nextConfig: NextConfig = {
  // No anunciar la tecnología del servidor en las respuestas.
  poweredByHeader: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: CABECERAS_SEGURIDAD,
      },
    ];
  },
};

export default nextConfig;
