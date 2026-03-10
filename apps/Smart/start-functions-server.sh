#!/bin/bash
# Generic functions server startup script
# This script is used by start.sh and Dockerfile

# Get the app directory (where this script is located)
APP_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_NAME="$(basename "${APP_DIR}")"

# Preserve FUNCTIONS_PORT if already set in environment (e.g., from Python caller)
# This allows dynamic port assignment when running multiple apps
PRESERVED_FUNCTIONS_PORT="${FUNCTIONS_PORT}"

# Load .env if exists (for standalone use)
if [ -f "${APP_DIR}/.env" ]; then
    source "${APP_DIR}/.env"
fi

# Use preserved port if it was set, otherwise use .env value or default
if [ -n "${PRESERVED_FUNCTIONS_PORT}" ]; then
    PORT="${PRESERVED_FUNCTIONS_PORT}"
else
    PORT="${FUNCTIONS_PORT:-8686}"
fi
PIDFILE="/tmp/deno_${APP_NAME}_server_${PORT}.pid"

echo "🦕 Starting ${APP_NAME} Functions Server..."
echo "🌐 Server will run on http://localhost:${PORT}"

cd "${APP_DIR}/src/Functions"

# Kill any existing Deno server for this app
if [ -f "${PIDFILE}" ]; then
  kill "$(cat "${PIDFILE}" 2>/dev/null)" 2>/dev/null || true
  rm -f "${PIDFILE}" || true
fi
pkill -f "deno run.*server.js" 2>/dev/null || true
pkill -f "deno serve.*server.js" 2>/dev/null || true
pkill -f "port: ${PORT}" 2>/dev/null || true

echo "🚀 Starting functions server..."

# Export the correct port so Deno's server.js uses it via Deno.env.get("FUNCTIONS_PORT")
export FUNCTIONS_PORT="${PORT}"

# Start the server with deno run (server.js uses Deno.serve() internally)
deno run --env --allow-ffi --allow-net --allow-env --allow-read ./server.js &

# Store the process ID
echo $! > "${PIDFILE}"

# Fn-trigger cron loop: periodically call runScheduledFnTriggers and processFnTriggerEvents
CRON_PIDFILE="/tmp/deno_${APP_NAME}_cron_${PORT}.pid"
FN_CRON_INTERVAL="${FN_TRIGGER_CRON_INTERVAL:-120}"
BASE_URL="http://localhost:${PORT}"
(
    sleep 10
    while true; do
        curl -sS -o /dev/null -X POST -H "x-cron-secret: ${CRON_SECRET:-}" "${BASE_URL}/runScheduledFnTriggers" || true
        curl -sS -o /dev/null -X POST -H "x-cron-secret: ${CRON_SECRET:-}" "${BASE_URL}/processFnTriggerEvents" || true
        sleep "${FN_CRON_INTERVAL}"
    done
) &
CRON_LOOP_PID=$!
echo "${CRON_LOOP_PID}" > "${CRON_PIDFILE}"
disown "${CRON_LOOP_PID}" 2>/dev/null || true

echo ""
echo "✅ ${APP_NAME} Functions Server started!"
echo "🌐 Server URL: http://localhost:${PORT}"
echo "⏰ Fn-trigger cron: every ${FN_CRON_INTERVAL}s → /runScheduledFnTriggers, /processFnTriggerEvents"
echo ""

# If running standalone (not from start.sh), keep monitoring
if [ -z "${RUNNING_FROM_START_SH}" ]; then
    echo "⏹️  To stop the server, run: ./stop-functions-server.sh"
    echo ""
    echo "👀 Monitoring ${APP_NAME} functions server... (Press Ctrl+C to stop)"
    trap 'echo "🛑 Stopping ${APP_NAME} functions server..."; kill $(cat "${PIDFILE}" 2>/dev/null) 2>/dev/null; kill $(cat "${CRON_PIDFILE}" 2>/dev/null) 2>/dev/null; rm -f "${PIDFILE}" "${CRON_PIDFILE}"; exit 0' INT
    wait
fi
