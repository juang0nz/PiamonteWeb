# Versiones fijadas del pipeline

Inventario de las acciones de GitHub (fijadas por SHA de commit) y de las imágenes de
contenedor (fijadas por digest) que usan los workflows. `scripts/verificar-pines.sh`
falla en CI si aparece una referencia móvil. Cómo actualizar un pin: ver
[PIPELINE.md](PIPELINE.md).

## Acciones de GitHub

| Acción | Versión | SHA de commit | Verificado |
| --- | --- | --- | --- |
| `actions/checkout` | v7.0.1 | `3d3c42e5aac5ba805825da76410c181273ba90b1` | 2026-10-14 |
| `actions/setup-node` | v7.1.0 | `949feb2413d6458794dcd2491c4babbbce0c15c1` | 2026-10-14 |
| `actions/cache` | v6.1.0 | `55cc8345863c7cc4c66a329aec7e433d2d1c52a9` | 2026-10-14 |
| `actions/upload-artifact` | v7.0.2 | `cf430e030ddbb5b0abf93d22962f4752f3646cd9` | 2026-10-14 |
| `actions/download-artifact` | v8.0.2 | `9000827ccba6bdab643e8b6fd33ac0654aef8333` | 2026-10-14 |
| `github/codeql-action/upload-sarif` | v4.38.3 | `24c54180a607b1449ed407dd24f251e4e9147c8d` | 2026-10-14 |

Los SHA se obtuvieron con `gh api repos/<repo>/git/ref/tags/<tag>` y, para tags
anotados, desreferenciando con `gh api repos/<repo>/git/tags/<sha>`.

## Imágenes de contenedor

| Herramienta | Imagen y tag | Digest (índice multiarquitectura) | Verificado |
| --- | --- | --- | --- |
| ShellCheck | `koalaman/shellcheck:v0.11.0` | `sha256:61862eba1fcf09a484ebcc6feea46f1782532571a34ed51fedf90dd25f925a8d` | 2026-10-14 |
| Gitleaks | `ghcr.io/gitleaks/gitleaks:v8.30.1` | `sha256:c00b6bd0aeb3071cbcb79009cb16a60dd9e0a7c60e2be9ab65d25e6bc8abbb7f` | 2026-10-14 |
| Semgrep | `semgrep/semgrep:1.181.0` | `sha256:81474464c1f07483ba0682a44787fd93c91397419762a04abe2bafaae396304b` | 2026-10-14 |
| Trivy | `aquasec/trivy:0.76.0` | `sha256:2416d1f74045b57274df1a340eee6b510cacd73c66a6ccb8da092b117eb7d222` | 2026-10-14 |
| Syft | `anchore/syft:v1.54.1` | `sha256:3eb5379ba7b409c3f4069b686110527af0c47df993fa5c10d13e7cf34f49b1aa` | 2026-10-14 |
| Grype | `anchore/grype:v0.120.1` | `sha256:e4a44ef45d285b829ce6efe2642980329661bd2d18eab5fc539138d4adaebbbe` | 2026-10-14 |

Los digests se obtuvieron con `docker buildx imagetools inspect <imagen>:<tag>` (campo
`Digest`, que corresponde al índice del manifiesto y vale para cualquier arquitectura).

## Otras versiones fijadas

| Qué | Dónde | Valor |
| --- | --- | --- |
| Node | `.nvmrc`, `package.json#engines` | 24 (`>=24 <25`) |
| Supabase CLI | `package.json#devDependencies.supabase` | 2.121.0 (exacta) |
| Reglas de Semgrep | `seguridad.yml` | `p/ci`, `p/typescript`, `p/javascript`, `p/owasp-top-ten` (`p/nextjs` existe pero estaba vacío) |
