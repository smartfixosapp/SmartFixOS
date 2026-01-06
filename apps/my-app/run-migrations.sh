#!/bin/bash

# Database migration runner script for this app
# Usage: ./run-migrations.sh
# This script automatically uses the .env file in the same directory
# Runs all SQL files in db/seeds/ folder sequentially
# Tracks which files have been run using a database table

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
else
    echo "⚠️  Warning: .env file not found in ${APP_DIR}"
    echo "   Some environment variables may not be set"
fi

# Database connection settings from .env
# Priority: DATABASE_URL > individual DB_* vars > Supabase URL parsing

if [ -n "${DATABASE_URL}" ]; then
    # Parse DATABASE_URL: postgres://user:password@host:port/dbname
    if [[ "${DATABASE_URL}" =~ postgres://([^:]+):([^@]+)@([^:]+):([0-9]+)/(.+) ]]; then
        SUPABASE_DB_USER="${BASH_REMATCH[1]}"
        SUPABASE_DB_PASSWORD="${BASH_REMATCH[2]}"
        SUPABASE_DB_HOST="${BASH_REMATCH[3]}"
        SUPABASE_DB_PORT="${BASH_REMATCH[4]}"
        SUPABASE_DB_NAME="${BASH_REMATCH[5]}"
    fi
else
    # Try to extract from Supabase URL if available
    if [ -n "${VITE_SUPABASE_URL}" ] && [[ "${VITE_SUPABASE_URL}" =~ postgres:// ]]; then
        if [[ "${VITE_SUPABASE_URL}" =~ postgres://([^:]+):([^@]+)@([^:]+):([0-9]+)/(.+) ]]; then
            SUPABASE_DB_USER="${BASH_REMATCH[1]}"
            SUPABASE_DB_PASSWORD="${BASH_REMATCH[2]}"
            SUPABASE_DB_HOST="${BASH_REMATCH[3]}"
            SUPABASE_DB_PORT="${BASH_REMATCH[4]}"
            SUPABASE_DB_NAME="${BASH_REMATCH[5]}"
        fi
    else
        # Use individual environment variables
        SUPABASE_DB_HOST="${SUPABASE_DB_HOST:-${DB_HOST:-localhost}}"
        SUPABASE_DB_PORT="${SUPABASE_DB_PORT:-${DB_PORT:-5432}}"
        SUPABASE_DB_NAME="${SUPABASE_DB_NAME:-${DB_NAME:-${POSTGRES_DB:-postgres}}}"
        SUPABASE_DB_USER="${SUPABASE_DB_USER:-${DB_USER:-${POSTGRES_USER:-postgres}}}"
        SUPABASE_DB_PASSWORD="${SUPABASE_DB_PASSWORD:-${DB_PASSWORD:-${POSTGRES_PASSWORD}}}"
        
        # If we have Supabase URL but not a direct connection, try to construct from service role key
        if [ -n "${VITE_SUPABASE_URL}" ] && [ -n "${VITE_SUPABASE_SERVICE_ROLE_KEY}" ]; then
            # Extract host from Supabase URL (remove https:// and path)
            SUPABASE_HOST="${VITE_SUPABASE_URL#*://}"
            SUPABASE_HOST="${SUPABASE_HOST%%/*}"
            SUPABASE_HOST="${SUPABASE_HOST%%:*}"
            
            # Default Supabase connection uses postgres user
            if [ -z "${SUPABASE_DB_HOST}" ] || [ "${SUPABASE_DB_HOST}" == "localhost" ]; then
                SUPABASE_DB_HOST="${SUPABASE_HOST}"
            fi
            SUPABASE_DB_USER="${SUPABASE_DB_USER:-postgres}"
            SUPABASE_DB_NAME="${SUPABASE_DB_NAME:-postgres}"
        fi
    fi
fi

SEEDS_DIR="${APP_DIR}/db/seeds"

if [ ! -d "$SEEDS_DIR" ]; then
    echo "❌ Error: db/seeds directory not found at $SEEDS_DIR"
    exit 1
fi

if ! command -v psql &> /dev/null; then
    echo "❌ Error: psql not found. Please install PostgreSQL client."
    exit 1
fi

# Check if we have database connection info
if [ -z "${SUPABASE_DB_HOST}" ] || [ -z "${SUPABASE_DB_PASSWORD}" ]; then
    echo "❌ Error: Database connection information not found"
    echo ""
    echo "Please set one of the following in your .env file:"
    echo "  - DATABASE_URL=postgres://user:password@host:port/dbname"
    echo "  - Or individual variables: SUPABASE_DB_HOST, SUPABASE_DB_PORT, SUPABASE_DB_NAME, SUPABASE_DB_USER, SUPABASE_DB_PASSWORD"
    exit 1
fi

export PGPASSWORD="${SUPABASE_DB_PASSWORD}"

echo "🗄️  Running database migrations"
echo "   App directory: ${APP_DIR}"
echo "   Database: ${SUPABASE_DB_HOST}:${SUPABASE_DB_PORT}/${SUPABASE_DB_NAME}"
echo "   Seeds directory: ${SEEDS_DIR}"
echo ""

# Test connection
if ! psql -h "${SUPABASE_DB_HOST}" -p "${SUPABASE_DB_PORT}" -U "${SUPABASE_DB_USER}" -d "${SUPABASE_DB_NAME}" -c "SELECT 1;" > /dev/null 2>&1; then
    echo "❌ Error: Cannot connect to database"
    echo "   Check your database connection settings in .env"
    unset PGPASSWORD
    exit 1
fi

# Create migrations tracking table if it doesn't exist
echo "📋 Setting up migrations tracking..."
psql -h "${SUPABASE_DB_HOST}" -p "${SUPABASE_DB_PORT}" -U "${SUPABASE_DB_USER}" -d "${SUPABASE_DB_NAME}" <<EOF > /dev/null 2>&1
CREATE TABLE IF NOT EXISTS _migrations (
    id SERIAL PRIMARY KEY,
    filename VARCHAR(255) UNIQUE NOT NULL,
    executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    checksum VARCHAR(64)
);
EOF

# Get list of SQL files in seeds directory, sorted by filename
SQL_FILES=$(find "${SEEDS_DIR}" -name "*.sql" -type f | sort)

if [ -z "$SQL_FILES" ]; then
    echo "⚠️  No SQL files found in ${SEEDS_DIR}"
    unset PGPASSWORD
    exit 0
fi

echo "📋 Found $(echo "$SQL_FILES" | wc -l | tr -d ' ') migration file(s)"
echo ""

# Track success/failure
SUCCESS_COUNT=0
SKIPPED_COUNT=0
FAILED_COUNT=0

# Check RUN_MIGRATIONS setting (default: true)
RUN_MIGRATIONS="${RUN_MIGRATIONS:-true}"

# Process each SQL file
while IFS= read -r sql_file; do
    filename=$(basename "$sql_file")
    
    # Check if this is a data migration file (003_data.sql or any file with "data" in name)
    is_data_file=false
    if [[ "$filename" =~ ^003_data\.sql$ ]] || [[ "$filename" =~ data\.sql$ ]]; then
        is_data_file=true
    fi
    
    # Skip data files if RUN_MIGRATIONS is false
    if [ "$is_data_file" = true ] && [ "${RUN_MIGRATIONS}" != "true" ] && [ "${RUN_MIGRATIONS}" != "1" ]; then
        echo "⏭️  Skipping ${filename} (RUN_MIGRATIONS=${RUN_MIGRATIONS})"
        SKIPPED_COUNT=$((SKIPPED_COUNT + 1))
        continue
    fi
    
    # Escape single quotes in filename for SQL safety
    filename_escaped=$(echo "$filename" | sed "s/'/''/g")
    
    # Check if this file has already been run
    already_run=$(psql -h "${SUPABASE_DB_HOST}" -p "${SUPABASE_DB_PORT}" -U "${SUPABASE_DB_USER}" -d "${SUPABASE_DB_NAME}" -t -A -c "SELECT COUNT(*) FROM _migrations WHERE filename = '${filename_escaped}';" 2>/dev/null | tr -d ' ')
    
    if [ "$already_run" -gt 0 ]; then
        echo "⏭️  Skipping ${filename} (already executed)"
        SKIPPED_COUNT=$((SKIPPED_COUNT + 1))
        continue
    fi
    
    echo "🔄 Running ${filename}..."
    
    # Run the migration file
    if psql -h "${SUPABASE_DB_HOST}" -p "${SUPABASE_DB_PORT}" -U "${SUPABASE_DB_USER}" -d "${SUPABASE_DB_NAME}" -f "$sql_file" > /dev/null 2>&1; then
        # Record successful migration (escape filename for SQL)
        psql -h "${SUPABASE_DB_HOST}" -p "${SUPABASE_DB_PORT}" -U "${SUPABASE_DB_USER}" -d "${SUPABASE_DB_NAME}" -c "INSERT INTO _migrations (filename) VALUES ('${filename_escaped}') ON CONFLICT (filename) DO NOTHING;" > /dev/null 2>&1
        echo "   ✅ ${filename} completed successfully"
        SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
    else
        echo "   ❌ ${filename} failed"
        FAILED_COUNT=$((FAILED_COUNT + 1))
        # Show error output
        echo "   Error details:"
        psql -h "${SUPABASE_DB_HOST}" -p "${SUPABASE_DB_PORT}" -U "${SUPABASE_DB_USER}" -d "${SUPABASE_DB_NAME}" -f "$sql_file" 2>&1 | head -10 | sed 's/^/      /'
        # Continue with other files
    fi
done <<< "$SQL_FILES"

unset PGPASSWORD

echo ""
echo "============================================================"
echo "✅ Migrations completed!"
echo "   Successful: ${SUCCESS_COUNT}"
echo "   Skipped: ${SKIPPED_COUNT}"
echo "   Failed: ${FAILED_COUNT}"
echo "============================================================"

if [ $FAILED_COUNT -gt 0 ]; then
    exit 1
fi
