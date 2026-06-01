# Real-Time Collaborative Task Management Dashboard

Enterprise Angular reference architecture for GraphQL, WebSocket subscriptions, Auth0 SSO, optimistic mutations, and Vercel deployment — built per the Internal R&D assignment specification.

## Live deployment

| Environment | URL |
|-------------|-----|
| **Vercel (frontend)** | _Set after deploy — see [Deploy to Vercel](#deploy-to-vercel)_ |
| **GraphQL API** | _Host `server/` on Render/Railway/Fly — see [API hosting](#api-hosting)_ |

## Prerequisites

- **Node.js** 20+ and npm 10+
- **Auth0** tenant (free tier) — required locally and in production
- **Vercel** account for frontend CI/CD

## Environment variables

Angular does **not** read `.env` in the browser at runtime. Values are loaded at **build/serve time** from `client/.env` and baked into the bundle.

### Client (`client/.env`)

```bash
cd client
cp .env.example .env
# Edit .env — then start the app (prestart regenerates config automatically)
npm start
```

| Variable | Description |
|----------|-------------|
| `GRAPHQL_HTTP_URI` | GraphQL HTTP endpoint (queries/mutations) |
| `GRAPHQL_WS_URI` | WebSocket endpoint (subscriptions) |
| `AUTH0_DOMAIN` | Auth0 tenant domain |
| `AUTH0_CLIENT_ID` | Auth0 SPA client ID |
| `AUTH0_AUDIENCE` | Auth0 API identifier |
| `DEV_AUTH_BYPASS` | Must be `false`; backend requires real Auth0 JWTs |

Generated file: `src/environments/environment.config.ts` (do not edit by hand; run `npm run env`).

### Server (`server/.env`)

```bash
cd server
cp .env.example .env
```

| Variable | Default | Description |
|----------|---------|-------------|
| `NODE_ENV` | `development` | Runtime mode |
| `PORT` | `4000` | HTTP + WebSocket port |
| `HOST` | `0.0.0.0` | Bind address |
| `DATABASE_URL` | _(required)_ | PostgreSQL/Supabase connection string |
| `DATABASE_SSL` | `auto` | SSL mode for PostgreSQL |
| `CORS_ORIGINS` | _(all)_ | Comma-separated origins, e.g. `http://localhost:4200` |
| `AUTH0_DOMAIN` | _(required)_ | Auth0 tenant domain |
| `AUTH0_AUDIENCE` | _(required)_ | Auth0 API audience |

See `server/README.md` for the frontend-facing API contract.

### Vercel (production frontend)

Set these in the Vercel project **Environment Variables** (Production):

- `GRAPHQL_HTTP_URI` / `GRAPHQL_WS_URI` — your deployed API URLs
- `AUTH0_DOMAIN`, `AUTH0_CLIENT_ID`, `AUTH0_AUDIENCE`
- `DEV_AUTH_BYPASS` = `false`

`npm run build` runs `prebuild`, which regenerates `environment.config.ts` from these values.

## Quick start

### 1. GraphQL API

```bash
cd server
cp .env.example .env
npm install
npm run migrate
npm run dev
```

API: `http://localhost:4000/graphql`  
WebSocket: `ws://localhost:4000/graphql`

### 2. Run both API + UI (recommended)

From the **repository root** (keep this terminal open):

```bash
npm install          # installs concurrently at root (first time only)
npm run install:all  # if you haven't installed client/server deps yet
npm run dev          # starts API :4000 and Angular :4200
```

The dev server listens on **0.0.0.0:4200** (all interfaces). Use **http://localhost:4200/** on this machine, or **http://YOUR_LAN_IP:4200/** from another device on the same network.

If you use a LAN IP for the UI, also point `client/.env` at your machine’s API address (not `localhost`), for example:

```env
GRAPHQL_HTTP_URI=http://192.168.1.10:4000/graphql
GRAPHQL_WS_URI=ws://192.168.1.10:4000/graphql
```

And allow that origin in `server/.env`:

```env
CORS_ORIGINS=http://localhost:4200,http://192.168.1.10:4200
```

### 2b. Or run in two terminals

```bash
# Terminal 1
npm run server

# Terminal 2 (leave Terminal 1 running)
npm run client
```

Do **not** press `Y` to terminate the batch job while the dev server is running — that stops the app and the browser will show nothing.

Open **http://localhost:4200/** manually if the browser did not open. Sign in with Auth0 before using the board.

### 3. Auth0 (production)

1. Create a **Single Page Application** in Auth0.
2. Allowed callback URLs: `http://localhost:4200/callback`, `https://YOUR_VERCEL_DOMAIN/callback`
3. Allowed logout URLs: `http://localhost:4200`, `https://YOUR_VERCEL_DOMAIN`
4. Create an API with identifier `https://task-dashboard-api` (audience).
5. Set Auth0 values in `client/.env` and keep `DEV_AUTH_BYPASS=false`.
6. Add the same variables in Vercel (see [Environment variables](#environment-variables)).

### 4. GraphQL Codegen

```bash
cd client
npm run codegen
```

Generates `src/app/graphql/generated/graphql.ts` with **no `any`** — operations live in `src/app/graphql/operations/`.

## Project structure

```
├── client/                 # Angular 19 (standalone, signals, OnPush)
│   ├── src/app/core/       # Auth, Apollo split link, HTTP interceptor, toasts
│   ├── src/app/features/   # Dashboard, login (lazy-loaded routes)
│   └── codegen.ts
├── server/                 # GraphQL Yoga + graphql-ws subscriptions
│   └── src/schema.graphql
└── vercel.json             # SPA deploy from client build
```

## Architectural decision records (ADR)

### State management: Signals + Apollo Cache (not NgRx)

| Choice | Rationale |
|--------|-----------|
| **Signals** | Local UI state (pagination, filters, drawer, conflicts) with minimal boilerplate and excellent OnPush integration. |
| **Apollo InMemoryCache** | Server truth for tasks; optimistic responses and `update` functions keep CRUD instantaneous without duplicating a global store. |
| **No NgRx** | Assignment scope is a single dashboard feature; NgRx would add ceremony without proportional benefit. |

`TaskFacade` coordinates Apollo operations; presentation components remain dumb and OnPush.

### HTTP vs WebSocket (protocol switching)

- **Queries & mutations** → `HttpLink` with `setContext` auth link (JWT injection + refresh via `TokenService`).
- **Subscriptions** → `GraphQLWsLink` via `split()` on operation type.
- **Single WS client** in `create-apollo.ts`; `disposeApolloWs()` on app destroy prevents duplicate connections and leaks.
- `takeUntilDestroyed()` on all subscription streams in `TaskFacade`.

### Authentication

- **Apollo link** attaches `Authorization: Bearer` to HTTP and `connectionParams` for WebSocket.
- **`authInterceptor`** mirrors token injection for any future REST calls.
- **`authGuard`** protects `/dashboard`; Auth0 is always configured for HTTP and WebSocket token injection.
- Tokens refreshed through Auth0 `getAccessTokenSilently` with in-memory cache and 60s skew buffer.

### Optimistic UI & rollback

1. Each mutation defines `optimisticResponse` and cache `update`.
2. On **error**, facade calls `refetch()` and/or restores prior entity in cache; **toast** notifies non-blockingly via `ToastService` (signal-driven stack).
3. **Simulate network drop** triggers server-side failure window for demo/testing.

### Real-time sync & conflict resolution

- `taskChanged` subscription updates cache and refetches list.
- If user is **editing** a task (`editingTaskId`) and an external **UPDATE** arrives with a higher `version`, a **conflict** is registered:
  - Row highlight + badge in grid
  - Banner in drawer with **Use server version** / **Keep editing**
- Mutations send `expectedVersion` for optimistic concurrency; server returns `conflict: true` on version mismatch.

### Performance

- `ChangeDetectionStrategy.OnPush` on all presentation components.
- Lazy-loaded routes: `login`, `callback`, `dashboard`.
- Production budgets in `angular.json`; tree-shaking via Angular CLI production build.

## API hosting

The GraphQL API is a Node.js service backed by PostgreSQL. For production:

1. Deploy `server/` to **Render**, **Railway**, or **Fly.io** (`npm run build && npm start`).
2. Set `DATABASE_URL`, Auth0, `PORT`, and `CORS_ORIGINS` in the API host environment.
3. Run `npm run migrate --prefix server` during setup or release.
4. Point `GRAPHQL_HTTP_URI` / `GRAPHQL_WS_URI` to the deployed API host (`wss://` for WS).

## Deploy to Vercel

```bash
# From repository root
vercel

# Or link GitHub repo; Vercel reads vercel.json
```

Set production API URLs in `client/src/environments/environment.prod.ts` before deploying.

## Evaluation mapping

| Criteria | Implementation |
|----------|----------------|
| Angular architecture | Standalone components, signals, OnPush, lazy routes, folder-by-feature |
| GraphQL | Split link, subscriptions, optimistic mutations, cache policies |
| RxJS / leaks | `takeUntilDestroyed`, single WS client, dispose on destroy |
| Security | Auth guard, JWT on HTTP + WS, Auth0 SSO |
| DevOps | `vercel.json`, codegen, production file replacements |

## Scripts reference

| Location | Command | Purpose |
|----------|---------|---------|
| `server/` | `npm run dev` | API + WebSocket |
| `client/` | `npm start` | Dev server |
| `client/` | `npm run build` | Production bundle |
| `client/` | `npm run codegen` | GraphQL TypeScript types |

## License

Internal R&D assignment — company use.
