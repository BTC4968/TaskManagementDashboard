# Agent guide — Task Management Dashboard

Monorepo: **Angular 19 client** + **GraphQL Yoga server** + **PostgreSQL**.

## Layout

| Path | Purpose |
|------|---------|
| `client/src/app/core/` | Cross-cutting: Auth0, Apollo split link, HTTP interceptor, theme, toasts |
| `client/src/app/features/board/` | Active product UI — Trello-style board at `/dashboard` |
| `client/src/app/features/auth/pages/` | Login and Auth0 callback (lazy routes) |
| `client/src/app/graphql/operations/` | Hand-written GraphQL operations (codegen input) |
| `client/src/styles/` | Global design tokens imported by `src/styles.scss` |
| `server/src/domain/` | Board/task persistence (repository + tests) |
| `server/src/db/migrations/` | SQL migration files |
| `server/src/schema.graphql` | GraphQL schema (source of truth for codegen) |

## Conventions

- **Feature folders:** `pages/` (routed shells), `components/` (presentational), `data-access/` (facades/services), `models/` (view types).
- **State:** Signals for local UI; Apollo cache for server data. Facade pattern — no NgRx.
- **Components:** Standalone, `ChangeDetectionStrategy.OnPush`.
- **GraphQL:** Add operations in `client/src/app/graphql/operations/`, then run `npm run codegen --prefix client`.
- **Auth:** Real Auth0 JWTs required — no dev bypass. Guard protects `/dashboard`.
- **Real-time:** `boardChanged` subscription; optimistic concurrency via `expectedVersion`.

## Common commands

```bash
npm run dev                    # both client and server
npm run codegen --prefix client
npm test --prefix server
npm run build --prefix client
```

## Do not

- Edit `client/src/environments/environment.config.ts` by hand (generated from `.env`).
- Commit `.env` files or secrets.
- Reintroduce the removed legacy `features/tasks/` grid/kanban code unless explicitly requested.
