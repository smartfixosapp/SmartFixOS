#!/bin/bash
# Appwrite migration runner - delegates to repo when available, else runs in-app script (production)
# Usage: ./run-appwrite-migrations.sh

set -e
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export APP_DIR

# Prefer repo root runner (development)
REPO_ROOT="$(cd "$APP_DIR/../.." 2>/dev/null && pwd)"
SCRIPT="$REPO_ROOT/run-appwrite-migrations.sh"
[ ! -f "$SCRIPT" ] && SCRIPT="$APP_DIR/../../run-appwrite-migrations.sh"

if [ -f "$SCRIPT" ]; then
  exec "$SCRIPT"
fi

# Production: no repo root — run in-app copy of run_appwrite_migrations.js
IN_APP_JS="$APP_DIR/db/appwrite/run_appwrite_migrations.js"
if [ ! -f "$IN_APP_JS" ]; then
  echo "❌ Appwrite migrations not found. Set APP_DIR or run from repo root: ./run-appwrite-migrations.sh"
  echo "   Expected: $IN_APP_JS (generated when db_type=appwrite)"
  exit 1
fi

# Load .env from app dir, then appwrite/.env (from run_setup.sh)
load_env() {
  local f="$1"
  if [ -f "$f" ]; then
    set -a
    # shellcheck source=/dev/null
    . "$f"
    set +a
  fi
}
load_env "$APP_DIR/.env"
REPO_APPWRITE_ENV="$APP_DIR/../../appwrite/.env"
[ -f "$REPO_APPWRITE_ENV" ] && load_env "$REPO_APPWRITE_ENV"

if [ -z "${APPWRITE_ENDPOINT}" ] || [ -z "${APPWRITE_PROJECT_ID}" ] || [ -z "${APPWRITE_API_KEY}" ]; then
  echo "❌ Missing Appwrite config in .env: APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID, APPWRITE_API_KEY"
  exit 1
fi

# When running migrations on the host, host.docker.internal doesn't resolve (it's for containers).
# Use localhost so the same .env works for app in Docker and migrations on host.
case "${APPWRITE_ENDPOINT}" in
  *host.docker.internal*) export APPWRITE_ENDPOINT="${APPWRITE_ENDPOINT//host.docker.internal/localhost}" ;;
  *) export APPWRITE_ENDPOINT="${APPWRITE_ENDPOINT}" ;;
esac

export APPWRITE_DATABASE_ID="${APPWRITE_DATABASE_ID:-${VITE_APPWRITE_DATABASE_ID:-main}}"
export RUN_APPWRITE_MIGRATIONS="${RUN_APPWRITE_MIGRATIONS:-true}"

# Ensure node-appwrite is installed (migration script dependency)
if [ ! -d "$APP_DIR/node_modules/node-appwrite" ]; then
  echo "📦 Installing dependencies (node-appwrite)..."
  (cd "$APP_DIR" && npm install --no-audit --no-fund 2>/dev/null) || (cd "$APP_DIR" && pnpm install 2>/dev/null) || true
fi

echo "🗄️  Running Appwrite migrations (production)"
echo "   App dir: $APP_DIR"
echo "   Database: $APPWRITE_DATABASE_ID"
node "$IN_APP_JS"
echo "✅ Appwrite migrations completed"
