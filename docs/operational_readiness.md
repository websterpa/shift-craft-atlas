# Operational Readiness Checklist

## 1. Environment Configuration
Ensure the following environment variables are set in `.env` (local) or your deployment platform:

### Core
- `PORT`: 8080 (Default for API Server)
- `NEXT_PUBLIC_API_URL`: URL of the API server (if separated)

### Security & Auth
- `SUPABASE_URL`: Your Supabase Project URL.
- `SUPABASE_KEY`: Your Supabase Anon/Public Key.
- `ADMIN_SECRET`: Secret token for admin-only API routes.

## 2. Deployment Architecture
This is a **Hybrid Application**:
1. **Marketing & Routing**: Next.js (Port 3000)
   - Handles `/`, `/pricing`, `/features`, etc.
   - Proxies `/api/*` to Backend.
   - Serves `/app/*` statically or acts as ingress.
   
2. **Legacy App**: Vanilla JS (Served at `/app`)
   - Located in `public/app`.
   - Served conceptually as static files by Next.js (via `rewrites`) or Express.

3. **Backend**: Express API (Port 8080)
   - Handles `/api/flags`, `/api/waitlist`, logic.
   - Serves static `/app` files as fallback.

### Running in Production
You need to run BOTH processes. Recommended approaches:
- **Docker**: Container running `concurrently` (easiest migration).
- **Separate Services**: Deploy Next.js to Vercel, Express to Render/Heroku. *Note: Requires updating Next.js `rewrites` to point to full URL.*

**Startup Command:**
```bash
npm start
```
*Note: This runs `next start` only. For the hybrid monolith approach locally, verify `npm run dev` behaviour matches prod needs or use a Process Manager (PM2).*

## 3. Observability & Logging
- **Logs**: Structured logs are emitted to `stdout`. 
- **Health Check**: `GET /api/health` returns status JSON.
- **Audit**: Database-level audit logging is enabled (Supabase `whoami` and `audit_log` table).

## 4. Known Limitations
- The Vanilla JS app relies on `window` globals.
- `tests/unit` pathing is sensitive to directory structure (fixed for `public/app`).
- Authentication is handled client-side via Supabase; API is protected via RLS and simple Secrets.

## 5. Rollback Plan
1. Revert to previous Git Commit.
2. If Database Migration failed, run `down` scripts (if available) or restore backup.
