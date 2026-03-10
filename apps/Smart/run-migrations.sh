#!/bin/bash

# Database migration runner script for this app
# Usage: ./run-migrations.sh
# This script automatically uses the .env file in the same directory
# Runs all SQL files in db/seeds/ folder sequentially in alphabetical order.
#
# Expected order: 001_init.sql -> 002_schema.sql -> 003_alter_schema.sql -> 004_data.sql
#   - init:     extensions, users table, user sync triggers
#   - schema:   CREATE TABLE for all entities
#   - alter_schema: ALTER TABLE (new columns, enum value updates) for existing tables
#   - data:     migration data (skipped if RUN_MIGRATIONS=false)
# Tracks which files have been run using a database table.
#
# MIGRATIONS_RESYNC_ONLY: when 1/true (e.g. during resync), run only *alter* migrations
#   (e.g. 003_alter_schema.sql). Skip init, schema, and data. No data SQL during resync.

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

# Route to correct migration script based on DATABASE_TYPE
# supabase | supabase_selfhost -> run Supabase migrations (below)
# appwrite | appwrite_selfhost -> run Appwrite migrations
DATABASE_TYPE="${DATABASE_TYPE:-supabase}"
if [ "$DATABASE_TYPE" = "appwrite" ] || [ "$DATABASE_TYPE" = "appwrite_selfhost" ]; then
    # run-appwrite-migrations.sh is in app dir (template) or repo root
    MIGRATE_SCRIPT="$APP_DIR/run-appwrite-migrations.sh"
    if [ ! -f "$MIGRATE_SCRIPT" ]; then
        ROOT_DIR="$(cd "$APP_DIR/../.." 2>/dev/null && pwd || echo "$APP_DIR")"
        MIGRATE_SCRIPT="$ROOT_DIR/run-appwrite-migrations.sh"
    fi
    if [ -f "$MIGRATE_SCRIPT" ]; then
        echo "🗄️  DATABASE_TYPE=$DATABASE_TYPE -> Running Appwrite migrations"
        export APP_DIR="$APP_DIR"
        exec "$MIGRATE_SCRIPT"
    else
        echo "❌ run-appwrite-migrations.sh not found"
        exit 1
    fi
fi

# Database connection settings from .env (Supabase)
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
LOGS_DIR="${APP_DIR}/db/logs"

if [ ! -d "$SEEDS_DIR" ]; then
    echo "❌ Error: db/seeds directory not found at $SEEDS_DIR"
    exit 1
fi

# Create logs directory if it doesn't exist
mkdir -p "$LOGS_DIR"

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
echo "   Logs directory: ${LOGS_DIR}"
echo ""

# Test connection
if ! psql -h "${SUPABASE_DB_HOST}" -p "${SUPABASE_DB_PORT}" -U "${SUPABASE_DB_USER}" -d "${SUPABASE_DB_NAME}" -c "SELECT 1;" > /dev/null 2>&1; then
    echo "❌ Error: Cannot connect to database"
    echo "   Check your database connection settings in .env"
    unset PGPASSWORD
    exit 1
fi

# Determine database schema to use
# Default: app_<APP_ID> when APP_ID set, else VITE_DB_SCHEMA, else public
if [ -n "${APP_ID}" ] && [ -z "${DB_SCHEMA}" ] && [ -z "${VITE_DB_SCHEMA}" ]; then
    DB_SCHEMA="app_${APP_ID}"
fi
DB_SCHEMA="${DB_SCHEMA:-${VITE_DB_SCHEMA:-public}}"
echo "📋 Using database schema: ${DB_SCHEMA}"

# Create the schema if it doesn't exist (only for non-public schemas)
if [ "${DB_SCHEMA}" != "public" ]; then
    echo "📋 Ensuring schema ${DB_SCHEMA} exists..."
    psql -h "${SUPABASE_DB_HOST}" -p "${SUPABASE_DB_PORT}" -U "${SUPABASE_DB_USER}" -d "${SUPABASE_DB_NAME}" <<EOF > /dev/null 2>&1
CREATE SCHEMA IF NOT EXISTS "${DB_SCHEMA}";
GRANT USAGE ON SCHEMA "${DB_SCHEMA}" TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA "${DB_SCHEMA}" GRANT ALL ON TABLES TO postgres, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA "${DB_SCHEMA}" GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA "${DB_SCHEMA}" GRANT SELECT ON TABLES TO anon;
EOF
fi

# Drop schema data and tables if DROP_SCHEMA_BEFORE_MIGRATE is set
if [ "${DROP_SCHEMA_BEFORE_MIGRATE}" = "true" ] || [ "${DROP_SCHEMA_BEFORE_MIGRATE}" = "1" ]; then
    echo "🗑️  Dropping all tables and data in schema ${DB_SCHEMA}..."
    psql -h "${SUPABASE_DB_HOST}" -p "${SUPABASE_DB_PORT}" -U "${SUPABASE_DB_USER}" -d "${SUPABASE_DB_NAME}" <<EOF
-- Set search path to app schema first, then public
SET search_path TO "${DB_SCHEMA}", public;

-- Drop all tables in the schema (CASCADE to handle foreign keys)
DO \$\$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = '${DB_SCHEMA}') LOOP
        EXECUTE 'DROP TABLE IF EXISTS "' || r.tablename || '" CASCADE';
    END LOOP;
END \$\$;

-- Drop all sequences in the schema
DO \$\$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT sequence_name FROM information_schema.sequences WHERE sequence_schema = '${DB_SCHEMA}') LOOP
        EXECUTE 'DROP SEQUENCE IF EXISTS "' || r.sequence_name || '" CASCADE';
    END LOOP;
END \$\$;

-- Drop all views in the schema
DO \$\$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT table_name FROM information_schema.views WHERE table_schema = '${DB_SCHEMA}') LOOP
        EXECUTE 'DROP VIEW IF EXISTS "' || r.table_name || '" CASCADE';
    END LOOP;
END \$\$;

-- Drop all functions in the schema
DO \$\$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT proname, oidvectortypes(proargtypes) as argtypes
        FROM pg_proc
        INNER JOIN pg_namespace ON pg_proc.pronamespace = pg_namespace.oid
        WHERE pg_namespace.nspname = '${DB_SCHEMA}'
    ) LOOP
        EXECUTE 'DROP FUNCTION IF EXISTS "' || r.proname || '"(' || r.argtypes || ') CASCADE';
    END LOOP;
END \$\$;
EOF
    echo "✅ Schema ${DB_SCHEMA} cleaned (all tables, sequences, views, and functions dropped)"
    echo ""
fi

# Set the search path to use the app's schema
# Note: users table is created in 001_init.sql (not a view). GRANT on users is in 001_init.
echo "📋 Setting up migrations tracking..."
psql -h "${SUPABASE_DB_HOST}" -p "${SUPABASE_DB_PORT}" -U "${SUPABASE_DB_USER}" -d "${SUPABASE_DB_NAME}" <<EOF > /dev/null 2>&1
-- Set search path to app schema first, then public
SET search_path TO "${DB_SCHEMA}", public;

-- Create migrations tracking table in the app's schema
CREATE TABLE IF NOT EXISTS "${DB_SCHEMA}"._migrations (
    id SERIAL PRIMARY KEY,
    app_id VARCHAR(255),
    filename VARCHAR(255) NOT NULL,
    executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    checksum VARCHAR(64),
    UNIQUE(app_id, filename)
);
-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_migrations_app_id_filename ON "${DB_SCHEMA}"._migrations(app_id, filename);
EOF

# Get list of SQL files in seeds directory, sorted by filename
# Order: 001_init.sql -> 002_schema.sql -> 003_alter_schema.sql -> 004_data.sql
SQL_FILES=$(find "${SEEDS_DIR}" -name "*.sql" -type f | sort)

if [ -z "$SQL_FILES" ]; then
    echo "⚠️  No SQL files found in ${SEEDS_DIR}"
    unset PGPASSWORD
    exit 0
fi

echo "📋 Found $(echo "$SQL_FILES" | wc -l | tr -d ' ') migration file(s) (init -> schema -> alter_schema -> data)"
echo ""

# Track success/failure
SUCCESS_COUNT=0
SKIPPED_COUNT=0
FAILED_COUNT=0

# Check RUN_MIGRATIONS setting (default: true)
RUN_MIGRATIONS="${RUN_MIGRATIONS:-true}"
# Resync-only mode: run only *alter* migrations (ALTER TABLE), skip init/schema/data
MIGRATIONS_RESYNC_ONLY="${MIGRATIONS_RESYNC_ONLY:-false}"
if [ "${MIGRATIONS_RESYNC_ONLY}" = "1" ] || [ "${MIGRATIONS_RESYNC_ONLY}" = "true" ]; then
    echo "📋 Resync mode: running only *alter* migrations (no init/schema/data)"
fi

# Process each SQL file
while IFS= read -r sql_file; do
    filename=$(basename "$sql_file")
    
    # Resync-only: run only *alter* migrations (e.g. 003_alter_schema.sql); skip rest
    if [ "${MIGRATIONS_RESYNC_ONLY}" = "1" ] || [ "${MIGRATIONS_RESYNC_ONLY}" = "true" ]; then
        if [[ ! "$filename" =~ alter ]]; then
            echo "⏭️  Skipping ${filename} (resync: alter-only, no data)"
            SKIPPED_COUNT=$((SKIPPED_COUNT + 1))
            continue
        fi
    fi
    
    # Check if this is a data migration file (004_data.sql, 003_data.sql legacy, or *data*.sql)
    is_data_file=false
    if [[ "$filename" =~ ^004_data\.sql$ ]] || [[ "$filename" =~ ^003_data\.sql$ ]] || [[ "$filename" =~ data\.sql$ ]]; then
        is_data_file=true
    fi
    
    # Skip data files if RUN_MIGRATIONS is false
    if [ "$is_data_file" = true ] && [ "${RUN_MIGRATIONS}" != "true" ] && [ "${RUN_MIGRATIONS}" != "1" ]; then
        echo "⏭️  Skipping ${filename} (RUN_MIGRATIONS=${RUN_MIGRATIONS})"
        SKIPPED_COUNT=$((SKIPPED_COUNT + 1))
        continue
    fi
    
    # Get app_id from environment variable (default to empty string for backward compatibility)
    APP_ID="${APP_ID:-}"
    
    # Escape single quotes in filename and app_id for SQL safety
    filename_escaped=$(echo "$filename" | sed "s/'/''/g")
    app_id_escaped=$(echo "$APP_ID" | sed "s/'/''/g")
    
    # Check if this file has already been run for this app_id in the app's schema
    if [ -n "$APP_ID" ]; then
        already_run=$(psql -h "${SUPABASE_DB_HOST}" -p "${SUPABASE_DB_PORT}" -U "${SUPABASE_DB_USER}" -d "${SUPABASE_DB_NAME}" -t -A -c "SELECT COUNT(*) FROM \"${DB_SCHEMA}\"._migrations WHERE app_id = '${app_id_escaped}' AND filename = '${filename_escaped}';" 2>/dev/null | tr -d ' ')
    else
        # Backward compatibility: check without app_id
        already_run=$(psql -h "${SUPABASE_DB_HOST}" -p "${SUPABASE_DB_PORT}" -U "${SUPABASE_DB_USER}" -d "${SUPABASE_DB_NAME}" -t -A -c "SELECT COUNT(*) FROM \"${DB_SCHEMA}\"._migrations WHERE (app_id IS NULL OR app_id = '') AND filename = '${filename_escaped}';" 2>/dev/null | tr -d ' ')
    fi
    
    if [ "$already_run" -gt 0 ]; then
        echo "⏭️  Skipping ${filename} (already executed for app_id: ${APP_ID:-default})"
        SKIPPED_COUNT=$((SKIPPED_COUNT + 1))
        continue
    fi
    
    echo "🔄 Running ${filename} in schema ${DB_SCHEMA}..."
    
    # Create log file path (use filename with .log extension)
    log_file="${LOGS_DIR}/${filename}.log"
    
    # Create a modified SQL file that sets the search_path and replaces 'public.' with schema name
    temp_sql_file=$(mktemp)
    {
        echo "SET search_path TO \"${DB_SCHEMA}\", public;"
        # Replace 'public.' with schema name in the SQL file
        sed "s/\"public\"\./\"${DB_SCHEMA}\"./g" "$sql_file" | sed "s/public\./\"${DB_SCHEMA}\"./g"
    } > "$temp_sql_file"
    
    # Run the modified migration file and capture all output to log file
    if psql -h "${SUPABASE_DB_HOST}" -p "${SUPABASE_DB_PORT}" -U "${SUPABASE_DB_USER}" -d "${SUPABASE_DB_NAME}" -f "$temp_sql_file" > "${log_file}" 2>&1; then
        # Record successful migration in the app's schema (include app_id)
        if [ -n "$APP_ID" ]; then
            psql -h "${SUPABASE_DB_HOST}" -p "${SUPABASE_DB_PORT}" -U "${SUPABASE_DB_USER}" -d "${SUPABASE_DB_NAME}" -c "INSERT INTO \"${DB_SCHEMA}\"._migrations (app_id, filename) VALUES ('${app_id_escaped}', '${filename_escaped}') ON CONFLICT (app_id, filename) DO NOTHING;" >> "${log_file}" 2>&1
        else
            # Backward compatibility: insert without app_id
            psql -h "${SUPABASE_DB_HOST}" -p "${SUPABASE_DB_PORT}" -U "${SUPABASE_DB_USER}" -d "${SUPABASE_DB_NAME}" -c "INSERT INTO \"${DB_SCHEMA}\"._migrations (app_id, filename) VALUES (NULL, '${filename_escaped}') ON CONFLICT (app_id, filename) DO NOTHING;" >> "${log_file}" 2>&1
        fi
        echo "   ✅ ${filename} completed successfully in schema ${DB_SCHEMA}"
        echo "   📄 Log saved to: ${log_file}"
        SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
    else
        echo "   ❌ ${filename} failed"
        echo "   📄 Log saved to: ${log_file}"
        FAILED_COUNT=$((FAILED_COUNT + 1))
        # Show error output from log file
        echo "   Error details:"
        head -10 "${log_file}" | sed 's/^/      /'
        # Continue with other files
    fi
    
    # Clean up temp file
    rm -f "$temp_sql_file"
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
