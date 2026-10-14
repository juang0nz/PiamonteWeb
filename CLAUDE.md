@AGENTS.md

# Convenciones del repositorio para Claude Code

Las reglas de `AGENTS.md` (idioma español, arquitectura genérica, no refactorizar
fuera de alcance) aplican íntegramente. Además:

## Ramas y commits

- Flujo GitFlow documentado en [docs/FLUJO-GIT.md](docs/FLUJO-GIT.md).
- `main` es producción: nunca recibe commits directos ni push directo.
- `develop` es integración: solo recibe merges por Pull Request.
- Toda tarea se hace en una rama `feature/PIA-<n>-<slug>` o `fix/PIA-<n>-<slug>`
  creada desde `develop`, con el ticket de Jira en el nombre.
- Mensaje de commit: `PIA-<n>: descripción en español, en imperativo`.
- Título de PR con el mismo formato; el cuerpo sigue `.github/PULL_REQUEST_TEMPLATE.md`.
- Si todavía no existe ticket, usar `PIA-0` y avisar para crearlo y renombrar.

## Verificación antes de entregar

- Ejecutar `npm run verificar` (lint, typecheck, tests y build) y reportar el
  resultado real, incluidas advertencias.
- No ejecutar SQL contra Supabase ni la CLI de Vercel con credenciales.
- No agregar secretos a workflows ni a archivos versionados; las variables van en
  `.env.local` (ignorado) y su inventario en `.env.example`.

## Pipeline y base de datos

- El pipeline de integración y seguridad está descrito en [docs/PIPELINE.md](docs/PIPELINE.md).
- Las migraciones de base de datos viven en `supabase/migrations/` y son inmutables
  una vez mergeadas en `develop`: ver [docs/BASE-DE-DATOS.md](docs/BASE-DE-DATOS.md).
