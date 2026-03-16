#!/bin/zsh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  osascript -e 'display alert "Push SmartFixOS" message "Esta carpeta no es un repositorio git." as critical'
  exit 1
fi

BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if [[ "$BRANCH" == "HEAD" ]]; then
  osascript -e 'display alert "Push SmartFixOS" message "Estás en detached HEAD. Cambia a una rama y vuelve a intentar." as critical'
  exit 1
fi

if [[ -z "$(git status --porcelain)" ]]; then
  osascript -e 'display notification "No hay cambios para subir." with title "Push SmartFixOS"'
  exit 0
fi

git add -A
git commit -m "chore: auto push $(date '+%Y-%m-%d %H:%M:%S')" >/dev/null 2>&1 || true
git push origin "$BRANCH"

osascript -e "display notification \"Push completado en rama $BRANCH\" with title \"Push SmartFixOS\""
exit 0
