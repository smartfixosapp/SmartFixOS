# App Template

This template is used to generate new apps. When an app is generated, all files from this template are copied to the app directory.

## Files Included

- **start.sh** - Unified script to start all services locally (Frontend, Functions, Backend)
- **Dockerfile** - Single Dockerfile to run all services in a container
- **run-migrations.sh** - Database migration script (uses .env from app directory)
- **start-functions-server.sh** - Functions server startup script
- **stop-functions-server.sh** - Functions server stop script

## Usage

### Local Development

```bash
cd apps/your-app-name
./start.sh
```

This will:
- Load environment from `.env` file
- Run database migrations on first start
- Start Python Backend (port 9080)
- Start Functions Server (port 8686)
- Start Frontend (port 5173)

### Docker

Build from repo root:
```bash
docker build -f apps/your-app-name/Dockerfile --build-arg APP_NAME=your-app-name -t your-app-name .
```

Run:
```bash
docker run -it --rm \
  -p 5173:5173 \
  -p 8686:8686 \
  -p 9080:9080 \
  --env-file apps/your-app-name/.env \
  your-app-name
```

### Manual Migrations

```bash
cd apps/your-app-name
./run-migrations.sh
```

## Environment Variables

All scripts automatically use the `.env` file in the app directory. Required variables:

- `FUNCTIONS_PORT` - Functions server port (default: 8686)
- `VITE_PORT` - Frontend dev server port (default: 5173)
- `BACKEND_PORT` - Backend API port (default: 9080)
- `DATABASE_URL` or Supabase connection variables for migrations
