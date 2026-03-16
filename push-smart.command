#!/bin/zsh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo "== SmartFixOS Push =="
echo "Repo: $SCRIPT_DIR"

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "Error: esta carpeta no es un repositorio git."
  read -r "?Presiona Enter para cerrar..."
  exit 1
fi

BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if [[ "$BRANCH" == "HEAD" ]]; then
  echo "Error: estás en detached HEAD. Cambia a una rama antes de hacer push."
  read -r "?Presiona Enter para cerrar..."
  exit 1
fi

if [[ -z "$(git status --porcelain)" ]]; then
  echo "No hay cambios para subir."
  read -r "?Presiona Enter para cerrar..."
  exit 0
fi

echo ""
echo "Cambios detectados:"
git status --short
echo ""

read -r "?Mensaje de commit (deja vacío para automático): " COMMIT_MSG
if [[ -z "${COMMIT_MSG// }" ]]; then
  COMMIT_MSG="chore: update $(date '+%Y-%m-%d %H:%M')"
fi

echo ""
echo "Haciendo commit en rama: $BRANCH"
git add -A
git commit -m "$COMMIT_MSG" || {
  echo "No se creó commit (posible: no hay cambios stageables)."
}

echo ""
echo "Haciendo push..."
git push origin "$BRANCH"

echo ""
echo "Listo. Push completado en $BRANCH."
read -r "?Presiona Enter para cerrar..."
