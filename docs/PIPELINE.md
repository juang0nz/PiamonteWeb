# Pipeline de integración continua y seguridad

Todo corre en GitHub Actions. La aplicación **no se dockeriza**: Vercel la construye y
despliega. Las herramientas de seguridad corren como imágenes de contenedor fijadas por
digest con `docker run` en el runner; las acciones de GitHub se fijan por SHA de commit
(inventario en [VERSIONES.md](VERSIONES.md)).

## Qué corre en cada evento

```text
Pull Request → develop / main
├── convenciones   nombre-de-rama, titulo-de-pr               (bloquea)
├── ci             verificar                                   (bloquea)
│                  migraciones-inmutables                      (desactivado temporalmente, PIA-1)
└── seguridad      secretos, sast, dependencias, cabeceras-http (bloquea)

push a develop
├── ci             verificar                                   (bloquea)
└── Vercel         deploy Preview (alias estable de develop)   (externo)

tag v*  (creado sobre main tras mergear release/* o hotfix/*)
└── sbom           generar → publicar-en-release               (bloquea; adjunta SBOM a la Release)

push a main
├── ci             verificar                                   (bloquea)
└── Vercel         deploy Production                           (externo)

manual (workflow_dispatch)
└── sbom           generar                                     (artefacto descargable)
```

## Qué bloquea y qué no

| Check | Herramienta | Bloquea cuando |
| --- | --- | --- |
| `convenciones / nombre-de-rama` | bash | la rama origen no cumple `feature|fix|hotfix/PIA-n-slug` o `release/vX.Y.Z` |
| `convenciones / titulo-de-pr` | bash | el título no cumple `PIA-n: …` |
| `ci / verificar` | npm, ShellCheck, `verificar-pines.sh` | falla lint, tipos, tests, build, hay un pin móvil o un script con problemas |
| `ci / migraciones-inmutables` | `verificar-migraciones.sh` | la PR modifica o elimina una migración ya existente en la rama base. **Desactivado temporalmente** (`if: false`) desde PIA-1; ver abajo |
| `seguridad / secretos` | Gitleaks | cualquier hallazgo en los commits de la PR |
| `seguridad / sast` | Semgrep | al menos un hallazgo de severidad `ERROR` (los `WARNING`/`INFO` se listan y no bloquean) |
| `seguridad / dependencias` | npm audit, Trivy | vulnerabilidad alta o crítica **con corrección disponible** en dependencias de producción; secretos o configuraciones inseguras |
| `seguridad / cabeceras-http` | curl | falta HSTS, `nosniff`, `X-Frame-Options`/`frame-ancestors` o `Referrer-Policy` en `/` |
| `sbom / generar` | Syft, Grype | vulnerabilidad alta o crítica con corrección en el SBOM |
| Publicación de SARIF a Code Scanning | `upload-sarif` | **nunca** (`continue-on-error: true`); es informativa |

La CSP se envía como `Content-Security-Policy-Report-Only`: el navegador informa en la
consola y no bloquea. Pasarla a bloqueante es un ticket aparte.

## Cómo leer un fallo

### `ci / verificar`

- **lint / tipos / tests / build**: el error es el mismo que se ve en local con
  `npm run verificar`. Reproducir con las variables de relleno del workflow (ver
  `env:` en `ci.yml`); si el build necesita un secreto real, es un defecto a corregir,
  no se agregan secretos al workflow.
- **verificar-pines**: imprime `::error file=…,line=…` con la acción o imagen sin fijar.
  Completar el SHA/digest y actualizar `VERSIONES.md`.
- **ShellCheck**: muestra el código `SCxxxx`, la línea y un enlace a la wiki. Se corre
  con `--severity=style`; corregir o justificar con `# shellcheck disable=SCxxxx` y un
  comentario del motivo en la línea anterior.

### `ci / migraciones-inmutables`

**Desactivado temporalmente desde PIA-1 (2026-10-17).** Esa tarea movió las doce
migraciones previas a `supabase/historial/` y creó la foto base del esquema, un cambio
que este check marca como borrado. El job sigue definido en `ci.yml` con `if: false` y el
script `scripts/verificar-migraciones.sh` se mantiene; para reactivarlo, restaurar
`if: github.event_name == 'pull_request'`. Mientras esté desactivado, la regla de
inmutabilidad se revisa a mano en la PR.

Cuando está activo: Lista los archivos de `supabase/migrations/` con estado `M` (modificado), `D`
(eliminado) o `R` (renombrado). Revertir el cambio y escribir una migración nueva
(`npx supabase migration new descripcion`). Ver [BASE-DE-DATOS.md](BASE-DE-DATOS.md).

### `seguridad / secretos` (Gitleaks)

Cada hallazgo muestra regla, archivo, línea y commit, con el secreto **redactado**.
Si es real: rotar la credencial primero (ya está en el historial de la rama), después
quitarla del código y reescribir los commits de la rama antes de volver a subir.
Si es un falso positivo, ver "Excepciones" más abajo.

### `seguridad / sast` (Semgrep)

El paso "Veredicto" imprime `severidad  regla  archivo:línea` para todos los hallazgos
y falla solo si hay `ERROR`. El detalle completo está en `semgrep.json` del log y, si
la publicación funcionó, en la pestaña *Security → Code scanning* con categoría
`semgrep`. Corregir el código; si la regla no aplica, ver "Excepciones".

### `seguridad / dependencias`

- **npm audit** (`--omit=dev --audit-level=high`): muestra paquete, severidad, ruta y
  la versión que corrige. Actualizar con `npm update <paquete>` o esperar la PR de
  Dependabot. Las vulnerabilidades en dependencias **de desarrollo** no bloquean aquí
  pero conviene revisarlas con `npm audit` completo.
- **Trivy**: tabla por objetivo (`package-lock.json`, archivos de configuración,
  secretos). Con `--ignore-unfixed`, solo bloquea lo que tiene corrección publicada.

### `seguridad / cabeceras-http`

Imprime las cabeceras recibidas y luego `OK`/`::error::Falta …` por cada una. Las
cabeceras se definen en `next.config.ts` (`headers()`); si falta alguna, el cambio
suele estar ahí. Si el servidor no levantó, revisar `servidor.log` en el paso.

### `sbom`

Syft imprime la cantidad de componentes; Grype lista las vulnerabilidades con
severidad y versión corregida. Mismo tratamiento que `npm audit`.

## Excepciones justificadas

Toda excepción lleva **comentario con el motivo y el ticket** (`PIA-n`) en el propio
archivo, y se revisa en la PR como cualquier otro cambio.

| Herramienta | Archivo | Cómo |
| --- | --- | --- |
| Gitleaks | `.gitleaks.toml` | agregar un bloque `[[allowlists]]` con `description`, y `paths` (regex sobre la ruta) o `regexes` (sobre el contenido). Preferir el alcance más estrecho posible; nunca permitir un directorio entero de código. |
| Semgrep | `.semgrepignore` (rutas) o comentario en línea `// nosemgrep: <id-de-regla>` | el comentario en línea va **en la línea anterior** al hallazgo, con el motivo al lado. |
| Trivy | `.trivyignore` (crear si hace falta) | una línea por `CVE-…` con comentario `# PIA-n motivo`. Revisar al mes: las entradas vencen con el ticket. |
| npm audit | no hay archivo de excepciones | actualizar la dependencia o, si no hay corrección, abrir ticket y documentar en la PR. |
| ShellCheck | comentario `# shellcheck disable=SCxxxx` | en la línea anterior, con el motivo. |

## Cómo actualizar un pin

1. Buscar la versión nueva (release notes de la acción o herramienta).
2. Obtener el valor inmutable:
   - Acción: `gh api repos/<propietario>/<repo>/git/ref/tags/<tag> --jq .object`. Si
     `type` es `tag` (tag anotado), desreferenciar con
     `gh api repos/<propietario>/<repo>/git/tags/<sha> --jq .object.sha`. Usar el SHA
     de **commit** de 40 caracteres.
   - Imagen: `docker buildx imagetools inspect <imagen>:<tag>` y copiar el campo
     `Digest` (índice multiarquitectura).
3. Reemplazar en el workflow manteniendo el comentario `# vX.Y.Z` (acciones) o el tag
   en la tabla (imágenes).
4. Actualizar la fila y la fecha en [VERSIONES.md](VERSIONES.md).
5. `bash scripts/verificar-pines.sh` en local y PR normal con ticket.

Dependabot abre PRs semanales para acciones y paquetes npm hacia `develop`; en las de
acciones conserva el SHA y actualiza el comentario de versión. Revisar que
`VERSIONES.md` quede alineado antes de mergear.

## Reproducir en local

Con Docker instalado, los mismos comandos del workflow funcionan desde la raíz del
repo (en Git Bash de Windows, anteponer `MSYS_NO_PATHCONV=1` y montar con
`"$(pwd -W):/ruta"`). Ejemplos:

```bash
npm run verificar
bash scripts/verificar-pines.sh
bash scripts/verificar-migraciones.sh origin/develop HEAD
docker run --rm -v "$PWD:/repo" -w /repo ghcr.io/gitleaks/gitleaks@sha256:<digest> \
  detect --source . --config .gitleaks.toml --log-opts="origin/develop..HEAD" --redact --exit-code 1
docker run --rm -v "$PWD:/src" -w /src semgrep/semgrep@sha256:<digest> \
  semgrep scan --metrics=off --config p/ci --config p/typescript --config p/javascript --config p/owasp-top-ten .
```

Los digests están en [VERSIONES.md](VERSIONES.md).
