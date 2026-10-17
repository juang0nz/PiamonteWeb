# Plataforma de pedidos gastronómicos

Plataforma de pedidos online para comercios gastronómicos: carta pública, carrito,
checkout sin registro (delivery o retiro, pago en el local) y panel administrativo
con pedidos, clientes, catálogo, disponibilidad y empleados. **Piamonte** es el
primer comercio; la lógica es genérica y la identidad de cada comercio se resuelve
por configuración (ver [AGENTS.md](AGENTS.md)).

## Stack

| Capa | Tecnología |
| --- | --- |
| Framework | Next.js 16 (App Router, Turbopack) + React 19 + TypeScript |
| Estilos | Tailwind CSS 4 |
| Datos y autenticación | Supabase (Postgres, RLS, Auth, Storage, Realtime) |
| Despliegue | Vercel (`main` → Production, `develop` → Preview) |
| Runtime | Node 24 (ver `.nvmrc`) y npm |

## Levantar el proyecto en local

```bash
nvm use                      # o instalar la versión indicada en .nvmrc
npm ci                       # instala exactamente lo que fija package-lock.json
cp .env.example .env.local   # completar con los valores del proyecto de Supabase
npm run dev                  # http://localhost:3000
```

Los valores de `.env.local` son los del proyecto de Supabase de **desarrollo**
(`piamonte-dev`); el esquema y los datos de catálogo de ese proyecto salen de
`supabase/migrations/` y `supabase/seed.sql`, ver [docs/BASE-DE-DATOS.md](docs/BASE-DE-DATOS.md).
Para entrar al panel (`/admin`) hace falta un usuario en *Authentication → Users* y una
fila en `admin_comercios` **del proyecto que se esté usando**; el seed no incluye ninguno.

Scripts disponibles:

| Script | Qué hace |
| --- | --- |
| `npm run dev` | Servidor de desarrollo |
| `npm run build` / `npm run start` | Compilación y servidor de producción |
| `npm run lint` | ESLint sobre todo el repositorio |
| `npm run typecheck` | `next typegen` (tipos de rutas en `.next/types`) + `tsc --noEmit` |
| `npm test` | Pruebas con el runner nativo de Node (`tests/**/*.test.mjs`) |
| `npm run verificar` | lint + typecheck + test + build; es lo mismo que corre la CI |

Las pruebas automatizadas usan dobles de Supabase: no envían correos ni generan
pedidos reales.

## Variables de entorno

El inventario completo, con una línea de comentario por variable, está en
[`.env.example`](.env.example). Nunca se versionan valores.

| Variable | Alcance |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Pública (navegador) |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Pública (navegador) |
| `NEXT_PUBLIC_SITE_URL` | Pública (navegador) |
| `SUPABASE_SERVICE_ROLE_KEY` | Solo servidor; nunca exponer ni registrar en logs |

## Flujo de ramas

GitFlow con referencia obligatoria al ticket de Jira (`PIA-<n>`) en ramas,
commits y títulos de PR. `main` solo recibe `release/*` y `hotfix/*`; `develop`
recibe `feature/*` y `fix/*` por Pull Request. Detalle y reglas de protección en
[docs/FLUJO-GIT.md](docs/FLUJO-GIT.md).

## Pipeline

Cada PR ejecuta integración continua (lint, typecheck, tests, build), análisis de
seguridad (secretos, SAST, dependencias, cabeceras HTTP) y validación de
convenciones. Qué corre en cada evento, qué bloquea y cómo leer un fallo:
[docs/PIPELINE.md](docs/PIPELINE.md).

## Documentación

- [docs/OPERACION.md](docs/OPERACION.md): comportamiento del checkout, panel,
  acceso de empleados y pruebas manuales.
- [docs/BASE-DE-DATOS.md](docs/BASE-DE-DATOS.md): migraciones de Supabase y
  procedimiento de reconciliación.
- [docs/CREDITOS-IMAGENES.md](docs/CREDITOS-IMAGENES.md): fotos de categorías y
  licencias.
- [docs/VERSIONES.md](docs/VERSIONES.md): versiones fijadas de acciones e
  imágenes usadas por el pipeline.
