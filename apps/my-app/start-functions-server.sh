#!/bin/bash
# Generic functions server startup script
# This script is used by start.sh and Dockerfile

# Get the app directory (where this script is located)
APP_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_NAME="$(basename "${APP_DIR}")"

# Load .env if exists (for standalone use)
if [ -f "${APP_DIR}/.env" ]; then
    source "${APP_DIR}/.env"
fi

PORT="${FUNCTIONS_PORT:-8686}"
PIDFILE="/tmp/deno_${APP_NAME}_server_${PORT}.pid"

echo "🦕 Starting ${APP_NAME} Functions Server..."
echo "🌐 Server will run on http://localhost:${PORT}"

cd "${APP_DIR}/src/Functions"

# Kill any existing Deno server for this app
if [ -f "${PIDFILE}" ]; then
  kill "$(cat "${PIDFILE}" 2>/dev/null)" 2>/dev/null || true
  rm -f "${PIDFILE}" || true
fi
pkill -f "deno serve.*--port[= ]${PORT}.*server.js" 2>/dev/null || true
pkill -f "port: ${PORT}" 2>/dev/null || true

echo "🚀 Starting functions server..."

# Start the server
deno serve --env --port="${PORT}" --allow-net --allow-env --allow-read ./server.js &

# Store the process ID
echo $! > "${PIDFILE}"

echo ""
echo "✅ ${APP_NAME} Functions Server started!"
echo "🌐 Server URL: http://localhost:${PORT}"
echo ""

# If running standalone (not from start.sh), keep monitoring
if [ -z "${RUNNING_FROM_START_SH}" ]; then
    echo "⏹️  To stop the server, run: ./stop-functions-server.sh"
    echo ""
    echo "👀 Monitoring ${APP_NAME} functions server... (Press Ctrl+C to stop)"
    trap 'echo "🛑 Stopping ${APP_NAME} functions server..."; kill $(cat "${PIDFILE}" 2>/dev/null) 2>/dev/null; rm -f "${PIDFILE}"; exit 0' INT
    wait
fi
