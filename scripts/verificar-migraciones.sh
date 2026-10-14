#!/usr/bin/env bash
# Comprueba que una PR no modifique ni elimine migraciones ya existentes en la rama base.
# Solo se permiten archivos nuevos en supabase/migrations/. Las migraciones mergeadas
# son inmutables: un cambio se expresa con una migración nueva (docs/BASE-DE-DATOS.md).
# Uso: bash scripts/verificar-migraciones.sh <ref-base> [ref-cabecera]
set -euo pipefail

base="${1:-origin/develop}"
cabecera="${2:-HEAD}"
directorio="supabase/migrations"

if ! git rev-parse --verify --quiet "$base" > /dev/null; then
  echo "::error::No existe la referencia base '$base'. ¿Falta fetch-depth: 0?"
  exit 2
fi

# Diff respecto del ancestro común (base...cabecera): solo lo que aporta la PR.
cambios=$(git diff --name-status --diff-filter=MDRT "$base...$cabecera" -- "$directorio" || true)

if [ -z "$cambios" ]; then
  nuevos=$(git diff --name-only --diff-filter=A "$base...$cabecera" -- "$directorio" | wc -l | tr -d ' ')
  echo "Migraciones existentes intactas. Archivos nuevos: $nuevos."
  exit 0
fi

echo "::error::Se modificaron o eliminaron migraciones ya existentes en '$base':"
echo "$cambios"
echo "Las migraciones mergeadas no se editan; escribí una migración nueva (docs/BASE-DE-DATOS.md)."
exit 1
