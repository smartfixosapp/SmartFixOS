#!/bin/zsh
set -e

BASE_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="$BASE_DIR/apps/Smart"

if [ ! -d "$APP_DIR" ]; then
  echo "No se encontró la app en: $APP_DIR"
  read -k 1 "?Presiona cualquier tecla para cerrar..."
  echo
  exit 1
fi

if ! command -v pnpm >/dev/null 2>&1; then
  echo "pnpm no está instalado. Instálalo con: npm install -g pnpm"
  read -k 1 "?Presiona cualquier tecla para cerrar..."
  echo
  exit 1
fi

cd "$APP_DIR"

# Abrir el navegador automáticamente cuando el servidor arranque
(
  sleep 3
  open "http://localhost:5173/"
) &

echo "Iniciando SmartFixOS..."
echo "URL: http://localhost:5173/"
echo "Para detenerlo: Ctrl + C"

pnpm run dev -- --host 0.0.0.0 --port 5173
