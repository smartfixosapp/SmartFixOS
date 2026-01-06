#!/bin/bash
# Generic functions server stop script

# Get the app directory (where this script is located)
APP_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_NAME="$(basename "${APP_DIR}")"

# Load .env if exists
if [ -f "${APP_DIR}/.env" ]; then
    source "${APP_DIR}/.env"
fi

PORT="${FUNCTIONS_PORT:-8686}"
PIDFILE="/tmp/deno_${APP_NAME}_server_${PORT}.pid"

echo "🛑 Stopping ${APP_NAME} Functions Server..."

# Kill the server process
if [ -f "${PIDFILE}" ]; then
    kill "$(cat "${PIDFILE}")" 2>/dev/null
    rm -f "${PIDFILE}"
fi

# Fallback: kill any deno processes on this port
pkill -f "deno serve.*--port[= ]${PORT}.*server.js" 2>/dev/null || true
pkill -f "port: ${PORT}" 2>/dev/null || true

echo "✅ ${APP_NAME} functions server stopped!"
echo "🧹 Cleanup completed."
