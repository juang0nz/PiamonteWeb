#!/usr/bin/env bash
# Verifica que los workflows de GitHub Actions no usen referencias móviles:
# - cada `uses:` debe fijar un SHA de commit de 40 caracteres (con comentario # vX.Y.Z);
# - cada imagen de contenedor (`docker run ...` o `image:`) debe fijarse por digest @sha256:...;
# - no deben quedar marcadores <<SHA>> ni <<DIGEST>> sin completar.
# Uso: bash scripts/verificar-pines.sh [directorio-de-workflows]
set -euo pipefail

directorio="${1:-.github/workflows}"
fallos=0

informar() {
  echo "::error file=$1,line=$2::$3"
  fallos=$((fallos + 1))
}

shopt -s nullglob
archivos=("$directorio"/*.yml "$directorio"/*.yaml)
if [ "${#archivos[@]}" -eq 0 ]; then
  echo "No se encontraron workflows en $directorio."
  exit 0
fi

for archivo in "${archivos[@]}"; do
  mapfile -t lineas < "$archivo"
  numero=0
  for linea in "${lineas[@]}"; do
    numero=$((numero + 1))

    if [[ "$linea" == *"<<SHA>>"* || "$linea" == *"<<DIGEST>>"* ]]; then
      informar "$archivo" "$numero" "Marcador sin completar: ${linea## }"
      continue
    fi

    # Acciones: `uses: propietario/repo@SHA # vX.Y.Z` (se admiten acciones locales ./...).
    if [[ "$linea" =~ ^[[:space:]]*-?[[:space:]]*uses:[[:space:]]*([^[:space:]#]+) ]]; then
      referencia="${BASH_REMATCH[1]}"
      if [[ "$referencia" == ./* ]]; then
        continue
      fi
      if [[ ! "$referencia" =~ @[0-9a-f]{40}$ ]]; then
        informar "$archivo" "$numero" "Acción sin SHA de commit de 40 caracteres: $referencia"
      elif [[ ! "$linea" =~ \#[[:space:]]*v?[0-9]+(\.[0-9]+)* ]]; then
        informar "$archivo" "$numero" "Falta el comentario con la versión (# vX.Y.Z) junto al SHA: $referencia"
      fi
      continue
    fi

    # Imágenes de contenedor: `image:` o referencias en `docker run`.
    if [[ "$linea" =~ ^[[:space:]]*image:[[:space:]]*([^[:space:]#]+) ]]; then
      imagen="${BASH_REMATCH[1]}"
      if [[ ! "$imagen" =~ @sha256:[0-9a-f]{64}$ ]]; then
        informar "$archivo" "$numero" "Imagen sin digest @sha256: $imagen"
      fi
      continue
    fi
    if [[ "$linea" == *"docker run"* || "$linea" == *"docker pull"* ]]; then
      # La referencia de la imagen puede ir en la misma línea o en la siguiente (continuación con \).
      if [[ "$linea" =~ ([a-z0-9./_-]+/[a-z0-9./_-]+)(:[A-Za-z0-9._-]+)?[[:space:]] && "$linea" != *"@sha256:"* ]]; then
        informar "$archivo" "$numero" "docker run con imagen sin digest @sha256: ${linea## }"
      fi
      continue
    fi
    # Línea que contiene una referencia de imagen conocida por tag mutable (continuación de docker run).
    if [[ "$linea" =~ ^[[:space:]]*(ghcr\.io/|docker\.io/)?[a-z0-9._-]+/[a-z0-9._-]+:[A-Za-z0-9._-]+[[:space:]]*\\?[[:space:]]*$ ]]; then
      informar "$archivo" "$numero" "Imagen referenciada por tag mutable en lugar de digest: ${linea## }"
    fi
  done
done

if [ "$fallos" -gt 0 ]; then
  echo "Se encontraron $fallos referencia(s) sin fijar. Ver docs/VERSIONES.md y docs/PIPELINE.md."
  exit 1
fi
echo "Todas las acciones e imágenes están fijadas por SHA o digest."
