# Environment Variable Setup Guide

## Auth0

This project uses Auth0 for authentication. Both the client (SPA) and server (API) need
Auth0 credentials.

### Create an Auth0 tenant

1. Go to [auth0.com](https://auth0.com) and sign up or log in.
2. In the Auth0 Dashboard, click **Create Tenant** or use the default one.
3. Copy your **Domain** (e.g. `dev-abc123.us.auth0.com`) — you'll use this in env files.

### Register a Single Page Application

1. In Auth0 Dashboard → **Applications** → **Create Application**.
2. Choose **Single Page Web Application**.
3. Name it (e.g. "Task Dashboard Client").

### Configure callback URLs

In the application settings, scroll to **Application URIs** and set:

| Field | Development value | Production value |
|-------|-------------------|------------------|
| Allowed Callback URLs | `http://localhost:4200` | `https://your-app.vercel.app` |
| Allowed Logout URLs | `http://localhost:4200` | `https://your-app.vercel.app` |
| Allowed Web Origins | `http://localhost:4200` | `https://your-app.vercel.app` |

### Register an API

1. Auth0 Dashboard → **Applications** → **APIs** → **Create API**.
2. **Identifier**: `https://task-dashboard-api` (must match `AUTH0_AUDIENCE`).
3. **Signing Algorithm**: `RS256`.

### Copy values to env files

| Env var | Where to find it | Set in |
|---------|-----------------|--------|
| `AUTH0_DOMAIN` | Application → Domain | `client/.env`, `server/.env` |
| `AUTH0_CLIENT_ID` | Application → Client ID | `client/.env` |
| `AUTH0_AUDIENCE` | API → Identifier (`https://task-dashboard-api`) | `client/.env`, `server/.env` |

---

## PostgreSQL

The API requires a PostgreSQL database. Three options:

### Option A: Local PostgreSQL

```bash
# macOS (Homebrew)
brew install postgresql@16
brew services start postgresql@16
createdb task_dashboard

# Linux (apt)
sudo apt install postgresql
sudo systemctl start postgresql
sudo -u postgres createdb task_dashboard

# Windows (Chocolatey)
choco install postgresql16
# Use pgAdmin or psql to create a database named task_dashboard
```

**DATABASE_URL** format:
```text
DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/task_dashboard
```

### Option B: Supabase (free tier)

1. Go to [supabase.com](https://supabase.com) → **Start your project**.
2. Create a new project (takes ~2 minutes).
3. In Project Settings → **Database** → **Connection string** → **URI**.
4. Copy the URI with password placeholder; replace `[YOUR-PASSWORD]`.

```text
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@db.xxxxx.supabase.co:5432/postgres
```

Enable SSL:
```text
DATABASE_SSL=auto
```

### Option C: Neon (free tier)

1. Go to [neon.tech](https://neon.tech) → **Create a project**.
2. Copy the connection string from the dashboard.

```text
DATABASE_URL=postgresql://user:password@ep-xxxx.us-east-2.aws.neon.tech/neondb?sslmode=require
```

---

## Vercel Blob (optional — avatar uploads)

1. Go to [vercel.com](https://vercel.com) → **Storage** → **Create Blob Database**.
2. Copy the **Read & Write Token**.
3. Set in `server/.env`:
```text
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_xxxxx
```

Blob is only needed if you want avatar upload functionality. The app works without it.

---

## Client environment (`client/.env`)

```text
GRAPHQL_HTTP_URI=http://localhost:4000/graphql
GRAPHQL_WS_URI=ws://localhost:4000/graphql
AUTH0_DOMAIN=your-tenant.us.auth0.com
AUTH0_CLIENT_ID=your-client-id
AUTH0_AUDIENCE=https://task-dashboard-api
DEV_AUTH_BYPASS=false
```

For production, use `https://` and `wss://` pointing to the deployed API.

---

## Server environment (`server/.env`)

```text
NODE_ENV=development
PORT=4000
HOST=0.0.0.0
DATABASE_URL=postgresql://user:pass@localhost:5432/task_dashboard
DATABASE_SSL=auto
DATABASE_POOL_MAX=5
CORS_ORIGINS=http://localhost:4200
AUTH0_DOMAIN=your-tenant.us.auth0.com
AUTH0_AUDIENCE=https://task-dashboard-api
BLOB_READ_WRITE_TOKEN=
```
