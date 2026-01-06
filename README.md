# Vite FastAPI Supabase Monorepo

This is a monorepo containing a full-stack application with Vite/React frontend and FastAPI backend.

## Project Structure

- `apps/my-app/` - **Frontend** (Vite + React) - Deployable to Cloudflare Pages
- `backend/` - **Backend** (FastAPI + Python) - Deploy separately (Cloudflare Workers or external server)
- `lib/` - Shared custom SDKs that provide Base44-compatible API using Supabase
- `supabase/` - Local Supabase instance for development

## Important Notes

### Base44 SDK
⚠️ **TODO**: This project includes `@base44/sdk` in `package.json` but it's NOT used directly in the codebase.
- The project uses custom SDK wrappers in `lib/` that emulate the Base44 API
- These custom SDKs use Supabase as the backend
- The `@base44/sdk` dependency can be removed if not needed

### Environment Configuration
Before deploying to production (Cloudflare Pages), you MUST configure the following environment variables:

**Required for Frontend:**
- `VITE_SUPABASE_URL` - Your Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Your Supabase anonymous key
- `VITE_SUPABASE_SERVICE_ROLE_KEY` - Your Supabase service role key (keep secret!)
- `VITE_API_URL` - URL of your backend API
- `VITE_FUNCTION_URL` - URL of your functions server
- `VITE_MIXPANEL_KEY` - (Optional) Your Mixpanel analytics key
- `VITE_APP_NAME` - Your application name
- `VITE_APP_LOGO` - URL to your application logo

**Required for Backend:**
- `OPENAI_API_KEY` - Your OpenAI API key for AI/OCR features

See `.env.example` files in each directory for templates.

## Development Setup

1. Copy `.env.example` to `.env.local` in each directory and fill in your values
2. Install dependencies:
   ```bash
   pnpm install
   ```

3. Start Supabase (local development):
   ```bash
   cd supabase
   docker-compose up
   ```

4. Start the frontend:
   ```bash
   cd apps/my-app
   pnpm dev
   ```

5. Start the backend:
   ```bash
   cd backend
   pip install -r requirements.txt
   python main.py
   ```

## Building for Production

### Frontend (Cloudflare Pages)
```bash
cd apps/my-app
pnpm install
pnpm build
```

The `dist/` directory will contain the static assets ready for Cloudflare Pages deployment.

### Backend
The FastAPI backend is NOT compatible with Cloudflare Pages. Deploy it separately:
- **Option 1**: Convert to Cloudflare Workers (requires rewriting Python to JavaScript/TypeScript)
- **Option 2**: Deploy to a traditional server (Fly.io, Railway, etc.)
- **Option 3**: Keep running on your own infrastructure

## Security

- ✅ All `.env` files are gitignored
- ✅ No secrets are committed to the repository
- ✅ Environment variables must be configured in your deployment platform
- ⚠️ Never commit `.env.local` files

## Architecture Notes

The custom SDKs in `lib/` provide a compatibility layer that:
- Mimics the Base44 SDK API surface
- Uses Supabase as the actual backend
- Handles both browser and Deno environments
- Provides automatic field mapping and RLS handling

This architecture allows the frontend to remain agnostic to the backend implementation while using a familiar Base44-like API.
