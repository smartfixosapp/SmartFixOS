# Single Dockerfile to run all services (Frontend, Functions, Backend) for an app
FROM node:20-slim

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3.11 \
    python3.11-venv \
    python3-pip \
    poppler-utils \
    tesseract-ocr \
    libtesseract-dev \
    libgl1-mesa-glx \
    libglib2.0-0 \
    curl \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Install pnpm
RUN npm install -g pnpm@9.7.0

# Install Deno
RUN curl -fsSL https://deno.land/install.sh | sh
ENV PATH="/root/.deno/bin:${PATH}"

WORKDIR /app

# Copy root package files (for monorepo setup)
# Note: This Dockerfile should be built from repo root with:
#   docker build -f apps/APP_NAME/Dockerfile --build-arg APP_NAME=APP_NAME -t app-name .
COPY package.json pnpm-workspace.yaml ./
COPY lib ./lib

# Install root dependencies
RUN pnpm install --frozen-lockfile || pnpm install

# Copy backend
COPY backend ./backend

# Install Python dependencies
RUN cd backend && \
    python3 -m venv venv && \
    ./venv/bin/pip install --no-cache-dir -r requirements.txt

# Copy app files (will be set via build arg)
# Build with: docker build -f apps/APP_NAME/Dockerfile --build-arg APP_NAME=APP_NAME -t app-name .
ARG APP_NAME
COPY apps/${APP_NAME} ./app

# Install app dependencies
RUN cd app && pnpm install

# Create unified startup script
RUN cat > /app/start-all.sh << 'STARTSCRIPT'
#!/bin/bash
set -e

FUNCTIONS_PORT="${FUNCTIONS_PORT:-8686}"
VITE_PORT="${VITE_PORT:-5173}"
BACKEND_PORT="${BACKEND_PORT:-9080}"

APP_DIR="/app/app"
BACKEND_PY_DIR="/app/backend"

echo "🚀 Starting all services"
echo "============================================================"

# Load .env if exists
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
    load_env_file "${APP_DIR}/.env"
fi

# Function to handle cleanup
cleanup() {
    echo ""
    echo "🛑 Stopping all services..."
    kill 0
    exit 0
}

trap cleanup SIGTERM SIGINT

# Run migrations on first start
# Note: init.sql and schema.sql always run; data.sql only runs if RUN_MIGRATIONS=true
if [ -f "${APP_DIR}/run-migrations.sh" ]; then
    echo "🗄️  Running database migrations..."
    echo "   (Init and schema always run; data migrations depend on RUN_MIGRATIONS setting)"
    cd "${APP_DIR}"
    chmod +x run-migrations.sh
    ./run-migrations.sh || echo "⚠️  Some migrations had errors, continuing anyway..."
    echo ""
fi

# Start Python Backend
echo "🐍 Starting Python Backend (port ${BACKEND_PORT})..."
cd "$BACKEND_PY_DIR"
source venv/bin/activate
python main.py &
BACKEND_PID=$!
echo "✅ Python Backend started (PID: $BACKEND_PID)"

# Start Functions Server
echo "🦕 Starting Functions Server (port ${FUNCTIONS_PORT})..."
cd "$APP_DIR"
chmod +x start-functions-server.sh
RUNNING_FROM_START_SH=1 ./start-functions-server.sh &
FUNCTIONS_PID=$!
echo "✅ Functions Server started (PID: $FUNCTIONS_PID)"

# Start Frontend
echo "⚛️  Starting Frontend (port ${VITE_PORT})..."
cd "$APP_DIR"
pnpm run dev -- --host 0.0.0.0 --port "${VITE_PORT}" &
PNPM_PID=$!
echo "✅ Frontend started (PID: $PNPM_PID)"

echo ""
echo "============================================================"
echo "✅ All services started!"
echo ""
echo "📋 Service URLs:"
echo "  🌐 Frontend:      http://localhost:${VITE_PORT}"
echo "  🔧 Functions:     http://localhost:${FUNCTIONS_PORT}"
echo "  🐍 Backend API:    http://localhost:${BACKEND_PORT}"
echo "============================================================"

# Wait for all background processes
wait
STARTSCRIPT

RUN chmod +x /app/start-all.sh

# Expose ports
EXPOSE 5173 8686 9080

# Default command
CMD ["/app/start-all.sh"]
