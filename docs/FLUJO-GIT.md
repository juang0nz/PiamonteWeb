# Flujo de ramas (GitFlow) y referencia a Jira

Este repositorio usa GitFlow simplificado. Todo trabajo se referencia a un ticket de
Jira del proyecto `PIA` en el nombre de la rama, en los commits y en el título de la PR:
Jira vincula automáticamente los commits y las ramas que contienen la clave.

## Ramas permanentes

| Rama | Significado | Recibe |
| --- | --- | --- |
| `main` | Lo que está en producción (Vercel Production). | Solo merges desde `release/*` y `hotfix/*`. Cada merge se etiqueta `vX.Y.Z` (SemVer). |
| `develop` | Integración (Vercel Preview; el alias estable se define al crear el proyecto en Vercel, ver `docs/OPERACION.md`). | Merges de `feature/*` y `fix/*` vía Pull Request. |

Nunca se hace commit ni push directo a `main` ni a `develop`.

## Ramas temporales

El nombre lleva el ticket de forma obligatoria:

| Tipo | Patrón | Sale de | Merge a |
| --- | --- | --- | --- |
| Funcionalidad | `feature/PIA-123-descripcion-corta` | `develop` | `develop` |
| Corrección | `fix/PIA-124-descripcion-corta` | `develop` | `develop` |
| Release | `release/vX.Y.Z` | `develop` | `main`, y back-merge a `develop` |
| Hotfix | `hotfix/PIA-125-descripcion-corta` | `main` | `main`, y back-merge a `develop` |

La descripción corta va en minúsculas, sin tildes, con guiones (`[a-z0-9-]`).
Si todavía no existe el ticket, usar `PIA-0` y crear el ticket antes de mergear.
Mientras no exista el proyecto en Jira, la numeración `PIA-n` se mantiene en
[`docs/BACKLOG.md`](BACKLOG.md); al crear Jira, importar esos tickets conservando los números.

Expresiones regulares exactas que valida la CI (`.github/workflows/convenciones.yml`):

```text
^(feature|fix|hotfix)/PIA-[0-9]+-[a-z0-9-]+$
^release/v[0-9]+\.[0-9]+\.[0-9]+$
```

## Commits

Formato: `PIA-123: descripción en español, en imperativo`.

```text
PIA-42: agregar filtro por estado en el panel de pedidos
```

Un commit por cambio coherente. No mezclar reformateos masivos con cambios de lógica.

## Pull Requests

- Título con el mismo formato que los commits: `PIA-123: descripción`. La CI lo valida
  con `^PIA-[0-9]+: .+`.
- El cuerpo sigue la plantilla `.github/PULL_REQUEST_TEMPLATE.md`: resumen, ticket,
  cómo probar y el checklist de seguridad (¿toca auth/RLS?, ¿agrega variables de
  entorno?, ¿requiere SQL en Supabase?, ¿expone un endpoint nuevo?).
- `.github/CODEOWNERS` asigna revisores automáticamente.
- Estrategia de merge:
  - `feature/*` y `fix/*` → `develop`: **squash** (un commit por PR en `develop`).
  - `release/*` y `hotfix/*` → `main`: **merge commit** (sin squash) para preservar la
    historia, y luego back-merge a `develop`.

## Ciclo de una release

1. Desde `develop` validada en Preview: `git checkout -b release/v1.2.0`.
2. Solo correcciones menores y ajuste de versión en `package.json`.
3. PR `release/v1.2.0` → `main` con merge commit. Etiquetar: `git tag v1.2.0 && git push origin v1.2.0`.
   El tag dispara `sbom.yml`, que adjunta el SBOM a la GitHub Release.
4. Back-merge: PR `main` → `develop` (o merge directo de la release a `develop` si la
   protección lo permite para esa rama).

## Protección de ramas (configurar en GitHub)

Estas reglas se configuran a mano en *Settings → Branches → Branch protection rules*.
**Solo pueden activarse después de que las fases de GitFlow (`convenciones.yml`) y de
pipeline (`ci.yml`, `seguridad.yml`) estén mergeadas en `develop`**: GitHub solo deja
marcar como requerido un check que ya se ejecutó al menos una vez.

### `develop`

- Require a pull request before merging (0 aprobaciones mínimas; recomendado 1 cuando
  haya más de dos personas).
- Require status checks to pass before merging, con estos checks requeridos:
  - `ci / verificar`
  - `seguridad / secretos`
  - `seguridad / sast`
  - `seguridad / dependencias`
  - `convenciones / nombre-de-rama`
- Require branches to be up to date before merging.
- Do not allow bypassing the above settings.
- Restrict pushes (prohibir push directo): sin excepciones.
- Allow squash merging (habilitado); merge commits y rebase deshabilitados para esta rama
  si GitHub lo permite por regla, o acordado por convención.

### `main`

- Todo lo anterior, más:
- Require approvals: **1**.
- Require conversation resolution before merging.
- Allow merge commits (para `release/*` y `hotfix/*`); squash deshabilitado.
- Restrict who can push to matching branches: nadie (solo vía PR).

### Tags

- Proteger el patrón `v*` (*Settings → Tags → Protected tags*) para que solo
  mantenedores puedan crearlos.
