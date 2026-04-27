# SmartFixOS — App principal

ERP/POS para talleres de reparación de electrónicos.

## Stack

- **Frontend**: React 18 + Vite 6 + TailwindCSS + shadcn/ui + React Query + React Router v7
- **Backend funciones**: Deno (servidor unificado en `src/Functions/server.js`)
- **Base de datos**: Supabase Cloud (PostgreSQL + Auth + Storage)
- **Móvil**: Capacitor (iOS/Android)
- **Hosting**: Vercel (frontend) + Render (Deno functions)

## Servicios locales

| Servicio | Puerto | Cómo arrancar |
|----------|--------|---------------|
| Frontend (Vite) | 5173 | `pnpm dev` (desde `apps/Smart/`) |
| Functions (Deno) | 8686 | `bash start-functions-server.sh` |

`start.sh` arranca ambos en paralelo. Para abrir el navegador automáticamente, usar `SmartFixOS.command` desde la raíz del repo.

## Variables de entorno

Tomadas de `.env` en la raíz del monorepo. Las clave principales:

- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` — cliente Supabase
- `SUPABASE_SERVICE_ROLE_KEY` — solo para Deno functions (nunca al bundle)
- `FUNCTIONS_PORT=8686`
- `VITE_PORT=5173` (dev) / `6504` (prod)
- `RESEND_API_KEY`, `FROM_EMAIL` — envío de correos

## Estructura

```
apps/Smart/src/
  pages/        # Vistas (Dashboard, POS, Orders, etc.)
  components/   # UI components (shadcn/ui base + custom)
  Entities/     # Schemas JSON de las 67 entidades (Customer, Order, …)
  Functions/    # Funciones Deno (server.js es el entry point)
  api/          # base44Client, entities.js, functions.js (capa SDK)
  hooks/, lib/, utils/
db/seeds/       # Migraciones SQL (001 → 009)
```

## Móvil (Capacitor)

```bash
pnpm ios       # build + sync + open Xcode
pnpm android   # build + sync + open Android Studio
pnpm mobile    # build + sync sin abrir
```
