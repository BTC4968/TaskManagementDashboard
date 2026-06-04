# Development guide

## First-time setup

```bash
# 1. Install Node.js 20+ (see .nvmrc)
nvm use    # or manually install Node 20+

# 2. Clone and install dependencies
git clone <repo-url>
cd task-dashboard
npm install && npm run install:all

# 3. Configure environment variables
cp server/.env.example server/.env
cp client/.env.example client/.env
# Fill in values — see docs/env-guide.md for step-by-step help

# 4. Run database migrations
cd server && npm run migrate && cd ..

# 5. Start development servers
npm run dev
```

After starting, verify:

| Service | URL | Check |
|---------|-----|-------|
| Angular UI | `http://localhost:4200` | Should show login prompt |
| GraphQL HTTP | `http://localhost:4000/graphql` | Should return 400 (not 404) |
| WebSocket | `ws://localhost:4000/graphql` | Should accept connection |
| Health | `http://localhost:4000/health` | Should return `{ "status": "ok" }` |

Complete env var reference: [env-guide.md](env-guide.md).

---

## Prerequisites

- **Node.js** 20+ (see `.nvmrc`) and npm 10+
- **Auth0** tenant (SPA + API audience)
- **PostgreSQL** (local, Supabase, or Neon)
- Optional: **Vercel Blob** token for profile avatar uploads

## Install

```bash
npm install              # root: concurrently
npm run install:all      # client + server
```

## Environment variables

Env files are copied during first-time setup (see above). Reference tables for each variable:

### Client (`client/.env`)

Angular reads these at **build/serve time** via `scripts/generate-environment.mjs` (not at runtime in the browser).

| Variable | Description |
|----------|-------------|
| `GRAPHQL_HTTP_URI` | GraphQL HTTP endpoint |
| `GRAPHQL_WS_URI` | WebSocket endpoint |
| `AUTH0_DOMAIN` | Auth0 tenant domain |
| `AUTH0_CLIENT_ID` | Auth0 SPA client ID |
| `AUTH0_AUDIENCE` | Auth0 API identifier |
| `DEV_AUTH_BYPASS` | Must be `false` in production |

Do not edit `client/src/environments/environment.config.ts` by hand — run `npm run env --prefix client` or use `prestart` / `prebuild`.

### Server (`server/.env`)

| Variable | Default | Description |
|----------|---------|-------------|
| `NODE_ENV` | `development` | `production` when deployed |
| `PORT` | `4000` | HTTP + WebSocket port |
| `HOST` | `0.0.0.0` | Bind address |
| `DATABASE_URL` | _(required)_ | PostgreSQL URL |
| `DATABASE_SSL` | `auto` | SSL for remote DBs |
| `DATABASE_POOL_MAX` | `5` | Connection pool size |
| `CORS_ORIGINS` | _(all)_ | Comma-separated SPA origins |
| `AUTH0_DOMAIN` | _(required)_ | Auth0 tenant |
| `AUTH0_AUDIENCE` | _(required)_ | API audience (match client) |
| `BLOB_READ_WRITE_TOKEN` | _(optional)_ | Vercel Blob for avatars |

Never commit `.env` files. See [api.md](api.md) for the GraphQL contract.

## GraphQL codegen

```bash
npm run codegen --prefix client
```

Input: `server/src/schema.graphql` and `client/src/app/graphql/operations/*.graphql`.  
Output: `client/src/app/graphql/generated/graphql.ts`.

## Project layout

```
├── client/                 # Angular 19 SPA
│   ├── src/app/core/       # Auth, Apollo, theme, toasts
│   ├── src/app/features/   # auth, board, profile
│   └── src/app/graphql/    # operations + generated types
├── server/                 # GraphQL Yoga API
│   ├── src/domain/         # Repository + tests
│   ├── src/db/migrations/  # SQL migrations
│   └── src/schema.graphql
├── docs/                   # Documentation (this folder)
├── .github/workflows/      # CI
├── vercel.json             # Frontend deploy (repo root)
└── render.yaml             # API deploy blueprint
```

## Scripts

| Location | Command | Purpose |
|----------|---------|---------|
| root | `npm run dev` | API + Angular dev servers |
| root | `npm run ci` | Server tests + client production build |
| root | `npm run codegen` | GraphQL TypeScript codegen |
| `server/` | `npm run migrate` | Apply SQL migrations |
| `server/` | `npm test` | Build + run tests |
| `client/` | `npm start` | Dev server |
| `client/` | `npm run build` | Production bundle |

## Troubleshooting

See [troubleshooting.md](troubleshooting.md) for:

- "Maximum call stack size exceeded" on image upload
- ~2 second delay in cross-tab real-time sync
- WebSocket subscription silently disconnects
- Stale board data when navigating back
- GraphQL schema changes not reflected in client
- Auth0 token errors (401)
- Migration fails
- CORS errors in browser console
