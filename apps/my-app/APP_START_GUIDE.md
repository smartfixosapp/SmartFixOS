# App Startup Guide

This guide explains how to set up and run your application. The application consists of three services that work together:

1. **Frontend** (Vite/React) - Port 5173 (default)
2. **Functions Server** (Deno) - Port 8686 (default)  
3. **Backend API** (Python FastAPI) - Port 9080 (default)

## Prerequisites

Before starting, ensure you have the following installed:

- **Node.js** (v20 or higher) - [Download](https://nodejs.org/)
- **pnpm** (v9.7.0 or higher) - Install with: `npm install -g pnpm@9.7.0`
- **Deno** - Install with: `curl -fsSL https://deno.land/install.sh | sh`
- **Python 3.11+** - [Download](https://www.python.org/downloads/)
- **PostgreSQL Client** (for migrations) - Install `psql` command-line tool
- **Docker** (optional, for containerized deployment)

## Project Structure

Your application comes in one of two formats:

### npm Format
```
your-app/
├── apps/
│   └── your-app-name/     # Your app code
├── lib/                    # Shared libraries
├── backend/              # Python backend
├── db/                     # Database migrations
├── package.json            # Root package.json with dependencies
├── .env                    # Environment variables
├── db/
│   └── seeds/              # Database migration files
│       ├── 001_init.sql    # Initial setup
│       ├── 002_schema.sql  # Database schema
│       └── 003_data.sql    # Database seed data
├── start.sh                # Unified startup script
├── Dockerfile              # Docker configuration
└── run-migrations.sh       # Database migration script
```

### pnpm Format (Monorepo)
```
your-app/
├── apps/
│   └── your-app-name/     # Your app code
├── backend/              # Python backend
├── db/                     # Database migrations
├── lib/                    # Shared libraries
├── pnpm-workspace.yaml     # pnpm workspace config
├── package.json            # Root package.json
├── .env                    # Environment variables
├── db/
│   └── seeds/              # Database migration files (in app folder)
│       ├── 001_init.sql    # Initial setup
│       ├── 002_schema.sql  # Database schema
│       └── 003_data.sql    # Database seed data
├── start.sh                # Unified startup script (in app folder)
├── Dockerfile              # Docker configuration (in app folder)
└── run-migrations.sh       # Database migration script (in app folder)
```

## Quick Start

### Step 1: Extract and Navigate

Extract your zip file and navigate to the app directory:

```bash
# For npm format
cd your-app/apps/your-app-name

# For pnpm format  
cd your-app/apps/your-app-name
```

### Step 2: Configure Environment Variables

Create or edit the `.env` file in the app directory with your configuration:

```env
# Application Ports
FUNCTIONS_PORT=8686
VITE_PORT=5173
BACKEND_PORT=9080

# Frontend URLs
VITE_APP_URL=http://localhost:5173
VITE_FUNCTION_URL=http://localhost:8686
VITE_API_URL=http://localhost:9080

# Database Connection (choose one method)
# Method 1: Full connection string
DATABASE_URL=postgres://user:password@host:port/database

# Method 2: Individual variables
SUPABASE_DB_HOST=localhost
SUPABASE_DB_PORT=5432
SUPABASE_DB_NAME=postgres
SUPABASE_DB_USER=postgres
SUPABASE_DB_PASSWORD=your_password

# Supabase Configuration
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key
VITE_SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# OpenAI (for backend)
OPENAI_API_KEY=your_openai_key

# Other Configuration
VITE_APP_NAME=Your App Name
VITE_APP_LOGO=https://your-logo-url.com/logo.png
VITE_MIXPANEL_KEY=your_mixpanel_key
```

### Step 3: Install Dependencies

#### For npm format:
```bash
# From repo root
npm install

# Then install app dependencies
cd apps/your-app-name
npm install
```

#### For pnpm format:
```bash
# From repo root
pnpm install
```

### Step 4: Run Database Migrations

On first setup, run database migrations:

```bash
cd apps/your-app-name
chmod +x run-migrations.sh
./run-migrations.sh
```

This will:
- Run all SQL files in `db/seeds/` folder sequentially (in alphabetical order)
- Create a `_migrations` table to track executed files
- Only run files that haven't been executed yet
- Show summary of successful, skipped, and failed migrations

**Note:** 
- Make sure your database is running and accessible with the credentials in your `.env` file
- Migration files are executed in alphabetical order (e.g., `001_init.sql`, `002_schema.sql`, `003_data.sql`)
- Each file is tracked individually, so you can add new migration files later and only those will run

### Step 5: Start All Services

#### Option A: Using the Unified Script (Recommended)

```bash
cd apps/your-app-name
chmod +x start.sh
./start.sh
```

This single command will:
- Start the Python Backend (port 9080)
- Start the Functions Server (port 8686)
- Start the Frontend (port 5173)
- Run migrations automatically on first start

Press `Ctrl+C` to stop all services.

#### Option B: Using Docker

Build the Docker image (from repo root):

```bash
docker build -f apps/your-app-name/Dockerfile --build-arg APP_NAME=your-app-name -t your-app-name .
```

Run the container:

```bash
docker run -it --rm \
  -p 5173:5173 \
  -p 8686:8686 \
  -p 9080:9080 \
  --env-file apps/your-app-name/.env \
  your-app-name
```

## Manual Service Startup (For Debugging)

If you need to start services individually:

### 1. Start Python Backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
python main.py
```

### 2. Start Functions Server

```bash
cd apps/your-app-name
chmod +x start-functions-server.sh
./start-functions-server.sh
```

Or manually:
```bash
cd apps/your-app-name/src/Functions
source ../.env
deno serve --env --port="${FUNCTIONS_PORT:-8686}" --allow-net --allow-env --allow-read ./server.js
```

### 3. Start Frontend

```bash
cd apps/your-app-name
pnpm install  # or npm install for npm format
pnpm run dev  # or npm run dev
```

## Service URLs

Once all services are running, access them at:

- **Frontend**: http://localhost:5173
- **Functions Server**: http://localhost:8686
- **Backend API**: http://localhost:9080
- **Backend API Docs**: http://localhost:9080/docs (Swagger UI)

## Troubleshooting

### Port Already in Use

If you get a "port already in use" error:

1. Find the process: `lsof -i :5173` (or the port number)
2. Kill it: `kill -9 <PID>`
3. Or change the port in your `.env` file

### Database Connection Failed

Check your `.env` file:
- Verify `DATABASE_URL` or individual database variables are correct
- Ensure PostgreSQL is running
- Test connection: `psql -h localhost -U postgres -d postgres`

### Python Virtual Environment Issues

```bash
cd backend
rm -rf venv
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### Deno Not Found

Install Deno:
```bash
curl -fsSL https://deno.land/install.sh | sh
export PATH="$HOME/.deno/bin:$PATH"
```

Add to your `~/.bashrc` or `~/.zshrc` for persistence.

### pnpm Not Found

Install pnpm:
```bash
npm install -g pnpm@9.7.0
```

### Dependencies Installation Fails

**For npm format:**
```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm cache clean --force
npm install
```

**For pnpm format:**
```bash
# Clear cache and reinstall
rm -rf node_modules pnpm-lock.yaml
pnpm store prune
pnpm install
```

### Migrations Fail

1. Check database connection in `.env`
2. Ensure PostgreSQL client (`psql`) is installed
3. Verify database exists and user has permissions
4. Check migration logs for specific errors

### Functions Server Won't Start

1. Verify Deno is installed: `deno --version`
2. Check `.env` file has `FUNCTIONS_PORT` set
3. Ensure port 8686 (or your custom port) is available
4. Check `src/Functions/server.js` exists

## File Structure Reference

### Key Files

- **`start.sh`** - Main startup script (runs all 3 services)
- **`start-functions-server.sh`** - Functions server only
- **`stop-functions-server.sh`** - Stop functions server
- **`run-migrations.sh`** - Database migration script
- **`Dockerfile`** - Docker configuration
- **`.env`** - Environment variables (create this if missing)
- **`db/seeds/`** - Database migration files (run sequentially)
  - Files are executed in alphabetical order
  - Each file is tracked in `_migrations` table
  - Only unexecuted files are run

### Environment Variables Reference

| Variable | Description | Default |
|----------|-------------|---------|
| `FUNCTIONS_PORT` | Functions server port | 8686 |
| `VITE_PORT` | Frontend dev server port | 5173 |
| `BACKEND_PORT` | Backend API port | 9080 |
| `DATABASE_URL` | Full PostgreSQL connection string | - |
| `VITE_SUPABASE_URL` | Supabase project URL | - |
| `VITE_SUPABASE_ANON_KEY` | Supabase anonymous key | - |
| `OPENAI_API_KEY` | OpenAI API key for backend | - |

## Next Steps

After successfully starting all services:

1. Open http://localhost:5173 in your browser
2. Check the browser console for any errors
3. Verify API endpoints at http://localhost:9080/docs
4. Test functions at http://localhost:8686

## Support

If you encounter issues:

1. Check all logs for error messages
2. Verify all prerequisites are installed
3. Ensure all environment variables are set correctly
4. Review the troubleshooting section above

For additional help, refer to the application documentation or contact support.
