# Troubleshooting

## "Maximum call stack size exceeded" on image upload

**Cause**: `String.fromCharCode(...spread)` on a `Uint8Array` passes every byte as a separate
function argument. JavaScript engines cap arguments at ~65536; a 2.5 MB image has millions.

**Fix**: Use `FileReader.readAsDataURL()` — the standard browser API streams base64 encoding
without argument spreading.

```typescript
// Before (broken):
const data = await file.arrayBuffer();
const base64 = btoa(String.fromCharCode(...new Uint8Array(data)));

// After (fixed):
function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read image file.'));
    reader.readAsDataURL(file);
  });
}
```

Affected: `client/src/app/features/board/pages/create-board-page/create-board-page.component.ts`.

---

## ~2 second delay in cross-tab real-time sync

**Cause**: `pool.query('SELECT pg_notify(...)')` competes for connections from the shared
application pool (max 5). When both browser tabs load board data concurrently, all pool
connections are busy and `pg_notify` waits up to 2 seconds for a free connection.

**Diagnosis** (with instrumentation markers enabled):
```
publish:abc123:board: 2.010s     ← slow
notify:xyz789:received: 0.39ms   ← fast
```

The 2s is entirely in `pool.query()` — Postgres delivery and subscriber push are
sub-millisecond.

**Fix**: Added a dedicated `publisher` Client connection in `TaskEventStream` so
`pg_notify` never contends with the app pool.

Affected: `server/src/subscriptions/task-events.ts` (added `publisher`, `connectPublisher()`).

---

## WebSocket subscription silently disconnects

**Cause**: `graphql-ws` client has `lazy: true` but no `keepAlive`. Intermediate proxies
and routers may drop idle WebSocket connections after a period of inactivity.

**Fix**: Add `keepAlive: 10_000` to the `createClient()` call to send ping frames every
10 seconds:

```typescript
wsClient = createClient({
  url: environment.graphqlWsUri,
  connectionParams: async () => { ... },
  keepAlive: 10_000,
  lazy: true,
  retryAttempts: 5,
  shouldRetry: () => true,
});
```

Affected: `client/src/app/core/apollo/create-apollo.ts`.

---

## Stale board data when navigating back

**Cause**: Apollo InMemoryCache returns cached board data from a previous visit when the
user navigates back to `/board/:id`, even if the data is stale.

**Fix**: Use `fetchPolicy: 'network-only'` for board queries. Already the default in
`BoardFacade.loadBoard()`, `loadMembers()`, and `loadProjectUsers()`.

If a component still shows stale data, verify its query uses `network-only`.

---

## GraphQL schema changes not reflected in client

**Cause**: The generated `graphql.ts` is out of sync with `schema.graphql` or the `.graphql`
operation files.

**Fix**: Regenerate types (see [development.md](development.md#graphql-codegen) for details).

If CI fails the **GraphQL — codegen in sync** check, regenerate and commit the updated file.

---

## Auth0 token errors (401)

**Cause**: Token expired, audience mismatch, or missing callback URLs.

**Checklist**:

1. **Audience**: `AUTH0_AUDIENCE` in both `client/.env` and `server/.env` must match the
   Auth0 API identifier exactly (e.g. `https://task-dashboard-api`).
2. **Callback URLs**: Configure in Auth0 Dashboard — see [env-guide.md](env-guide.md#register-a-single-page-application).
3. **DEV_AUTH_BYPASS**: Must be `false` in production.
4. **Token refresh**: `TokenService` refreshes with a 60s buffer before expiry. If the
   server returns 401, check the Auth0 access token TTL.

---

## Migration fails

**Cause**: PostgreSQL URL is wrong, database doesn't exist, or user lacks `CREATE` permissions.

**Verify connection**:
```bash
psql "$DATABASE_URL" -c "SELECT 1"
```

Run migrations from the `server/` directory:
```bash
cd server && npm run migrate
```

If using Supabase or Neon, ensure the connection string uses `?sslmode=require` or enable
`DATABASE_SSL=true`.

---

## CORS errors in browser console

**Cause**: The server's `CORS_ORIGINS` doesn't include the SPA origin.

**Fix**: Add the SPA URL to `CORS_ORIGINS` in `server/.env`. See [env-guide.md](env-guide.md#server-environment-serverenv)
for the expected format.

Both HTTP and WebSocket use the same origin — no separate WS CORS config needed.
