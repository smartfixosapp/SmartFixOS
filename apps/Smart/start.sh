#!/bin/bash

# Unified start script for running all services locally
# Usage: ./start.sh
# This script automatically uses the .env file in the same directory

set -e

# Get the script directory (app directory)
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Load environment variables from .env file in app directory
# Function to safely load .env file even with spaces in path
load_env_file() {
    local env_file="$1"
    if [ -f "${env_file}" ]; then
        set -a
        # Read file line by line, handling paths with spaces correctly
        # Use process substitution to avoid issues with spaces in file path
        while IFS= read -r line <&3 || [ -n "$line" ]; do
            # Skip empty lines and comments
            case "$line" in
                ''|\#*) continue ;;
            esac
            # Remove leading/trailing whitespace
            line=$(echo "$line" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
            # Export the variable (handles KEY=VALUE format, including quoted values)
            case "$line" in
                *"="*)
                    # Extract key and value
                    key="${line%%=*}"
                    value="${line#*=}"
                    # Remove quotes if present
                    value=$(echo "$value" | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//")
                    # Export with proper quoting
                    eval "export ${key}=\"${value}\""
                    ;;
            esac
        done 3< "${env_file}"
        set +a
    fi
}

if [ -f "${APP_DIR}/.env" ]; then
    echo "📝 Loading environment from ${APP_DIR}/.env"
    load_env_file "${APP_DIR}/.env"
fi

# Set defaults
FUNCTIONS_PORT="${FUNCTIONS_PORT:-8686}"
VITE_PORT="${VITE_PORT:-5173}"

# Create PID file directory
PID_DIR="/tmp/$(basename ${APP_DIR})_pids"
mkdir -p "$PID_DIR"

# Cleanup function
cleanup() {
    echo ""
    echo "🛑 Stopping all services..."
    
    # Kill fn-trigger cron loop (started by start-functions-server.sh)
    CRON_PIDFILE="/tmp/deno_$(basename ${APP_DIR})_cron_${FUNCTIONS_PORT}.pid"
    if [ -f "${CRON_PIDFILE}" ]; then
        kill "$(cat "${CRON_PIDFILE}")" 2>/dev/null || true
        rm -f "${CRON_PIDFILE}"
    fi
    
    # Kill all child processes
    if [ -f "${PID_DIR}/pnpm.pid" ]; then
        kill "$(cat "${PID_DIR}/pnpm.pid")" 2>/dev/null || true
        rm -f "${PID_DIR}/pnpm.pid"
    fi
    
    if [ -f "${PID_DIR}/functions.pid" ]; then
        kill "$(cat "${PID_DIR}/functions.pid")" 2>/dev/null || true
        rm -f "${PID_DIR}/functions.pid"
    fi
    
    # Kill any remaining processes
    pkill -f "vite.*$(basename ${APP_DIR})" 2>/dev/null || true
    pkill -f "deno serve.*${FUNCTIONS_PORT}" 2>/dev/null || true
    
    rm -rf "$PID_DIR"
    echo "✅ All services stopped"
    exit 0
}

# Set trap for cleanup
trap cleanup INT TERM EXIT

echo "🚀 Starting all services for app: $(basename ${APP_DIR})"
echo "============================================================"

# Run migrations on first start
# Note: init.sql and schema.sql always run; data.sql only runs if RUN_MIGRATIONS=true
if [ -f "${APP_DIR}/run-migrations.sh" ]; then
    echo ""
    echo "🗄️  Running database migrations..."
    echo "   (Init and schema always run; data migrations depend on RUN_MIGRATIONS setting)"
    cd "${APP_DIR}"
    chmod +x run-migrations.sh
    if ./run-migrations.sh > "${PID_DIR}/migration.log" 2>&1; then
        echo "   ✅ Migrations completed successfully"
    else
        echo "   ⚠️  Some migrations had errors. Check ${PID_DIR}/migration.log"
        echo "   You can run migrations manually: ./run-migrations.sh"
        echo "   (Only unexecuted migrations will run)"
    fi
    echo ""
fi

# 1. Start Functions Server
echo "🦕 Starting Functions Server (port ${FUNCTIONS_PORT})..."
cd "$APP_DIR"

# Check if Deno is installed
if ! command -v deno &> /dev/null; then
    echo "❌ Error: Deno is not installed. Please install it from https://deno.land"
    exit 1
fi

# Use the start-functions-server.sh script
if [ -f "${APP_DIR}/start-functions-server.sh" ]; then
    chmod +x "${APP_DIR}/start-functions-server.sh"
    RUNNING_FROM_START_SH=1 "${APP_DIR}/start-functions-server.sh" > "${PID_DIR}/functions.log" 2>&1 &
    FUNCTIONS_PID=$!
    echo $FUNCTIONS_PID > "${PID_DIR}/functions.pid"
    echo "✅ Functions Server started (PID: $FUNCTIONS_PID)"
else
    echo "❌ Error: start-functions-server.sh not found in ${APP_DIR}"
    exit 1
fi

# 2. Start Frontend (pnpm dev)
echo ""
echo "⚛️  Starting Frontend (port ${VITE_PORT})..."
cd "$APP_DIR"

# Check if pnpm is installed
if ! command -v pnpm &> /dev/null; then
    echo "❌ Error: pnpm is not installed. Please install it: npm install -g pnpm"
    exit 1
fi

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing frontend dependencies..."
    pnpm install
fi

# Start frontend in background
pnpm run dev > "${PID_DIR}/frontend.log" 2>&1 &
PNPM_PID=$!
echo $PNPM_PID > "${PID_DIR}/pnpm.pid"
echo "✅ Frontend started (PID: $PNPM_PID)"

# Wait a bit for services to start
sleep 3

echo ""
echo "============================================================"
echo "✅ All services started successfully!"
echo ""
echo "📋 Service URLs:"
echo "  🌐 Frontend:      http://localhost:${VITE_PORT}"
echo "  🔧 Functions:     http://localhost:${FUNCTIONS_PORT}"
echo ""
echo "📝 Logs:"
echo "  Frontend:   tail -f ${PID_DIR}/frontend.log"
echo "  Functions: tail -f ${PID_DIR}/functions.log"
echo ""
echo "⏹️  Press Ctrl+C to stop all services"
echo "============================================================"

# Wait for all background processes
wait
