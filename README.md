# Buzzer Board

Real-time collaborative task board — Angular 19 + GraphQL reference architecture (Auth0, WebSocket subscriptions, optimistic UI, Vercel + Render deployment).

## Live deployment

| Environment | URL |
|-------------|-----|
| **Frontend (Vercel)** | _Your production URL_ |
| **GraphQL API (Render)** | _Your Render service URL_ |

---

## Prerequisites

| Requirement | Notes |
|-------------|--------|
| **Node.js 20+** | Use `.nvmrc` (`nvm use`) |
| **npm 10+** | Root installs `concurrently`; run `npm run install:all` for client + server |
| **PostgreSQL** | Local, Supabase, or Neon — set `DATABASE_URL` in `server/.env` |
| **Auth0 tenant** | SPA application + API audience matching client and server env |
| **Vercel Blob** _(optional)_ | Profile avatar uploads (`BLOB_READ_WRITE_TOKEN`) |

---

## Run locally

```bash
npm install && npm run install:all
cp server/.env.example server/.env    # configure DATABASE_URL, Auth0
cp client/.env.example client/.env    # configure GraphQL + Auth0 URLs
cd server && npm run migrate && cd ..
npm run dev
```

| Service | URL |
|---------|-----|
| GraphQL HTTP | `http://localhost:4000/graphql` |
| GraphQL WebSocket | `ws://localhost:4000/graphql` |
| Angular UI | `http://localhost:4200/` |

Run API and UI separately: `npm run server` and `npm run client`.

Other useful commands:

```bash
npm run codegen          # Regenerate client GraphQL types
npm run ci               # Server tests + client production build
npm test --prefix server # API tests only
```

Full env tables and layout: **[docs/development.md](docs/development.md)**

---

## Architectural decisions (ADR)

### State management: Signals + facades, not NgRx

**Decision:** Use Angular **Signals** and **computed** values inside feature **facades** (`BoardFacade`, `ProfileService`) instead of NgRx store/effects.

**Why:**

- The board is a single cohesive domain graph (lists, cards, checklist, comments) updated by mutations, subscriptions, and drag-and-drop. A normalized NgRx entity store would duplicate the server shape and add boilerplate (actions, reducers, selectors, effects) without simplifying sync logic.
- **Signals** give fine-grained reactivity with `OnPush` components: the facade holds one `view` signal; components read `computed()` slices (`lists`, `selectedCard`, `filteredLists`) and re-render only when those derivations change.
- **Apollo** owns the network/cache layer for GraphQL documents; the facade applies optimistic patches to an in-memory `BoardViewModel` and reconciles with mutation responses and subscription events via pure functions in `board-sync.ts`.
- Local UI state (modal open card id, filter sidebar, pending flags, edit buffers) stays in component or facade signals — no global store needed.

NgRx would be justified for cross-feature shared state or time-travel debugging at scale; this app’s scope fits a facade + sync-helper pattern with less ceremony.

### WebSocket subscriptions: leak prevention

**Decision:** One lazy WebSocket client per app session, torn down on logout/destroy; subscriptions scoped to the active board and cancelled with the facade lifecycle.

**How:**

1. **Protocol split** — Apollo `split` link routes subscriptions to `GraphQLWsLink` and queries/mutations to HTTP (`create-apollo.ts`).
2. **Single WS client** — `createClient` from `graphql-ws` is created once with `lazy: true` (connects only when a subscription runs). Recreating Apollo options disposes any previous client first.
3. **Explicit disposal** — `disposeApolloWs()` closes the client on app destroy and logout (`AppComponent.ngOnDestroy`, `AuthSessionService.logout`).
4. **Subscription lifecycle** — `BoardFacade.startSubscription(boardId)` uses `takeUntilDestroyed(this.destroyRef)` so the `boardChanged` stream unsubscribes when the facade is destroyed. Only one subscription is started per board id (`subscriptionStartedFor` guard).
5. **Auth on WS** — `connectionParams` injects the same JWT as HTTP via `TokenService`, keeping HTTP and WS auth consistent.

### Optimistic UI and error rollback

**Decision:** Snapshot optimistic state before each mutation; revert on failure and notify via non-blocking toasts.

**Pattern:**

1. Capture `const snapshot = this.view()` (or a targeted patch) before applying an optimistic update to the `view` signal.
2. Apply the change immediately (create/move/update card, checklist toggle/rename/delete, comments, etc.) using helpers in `board-sync.ts`.
3. On mutation **success**, reconcile with the server payload (replace temp ids, apply version/conflict handling).
4. On mutation **error**, call `rollback(snapshot, message)` which restores the snapshot, optionally `refetchBoard()` for safety, and shows a deduplicated toast (`ToastService`).
5. **Checklist toggles** revert only the affected item (not the whole board) to avoid clobbering concurrent edits; card updates use **version conflicts** — if the server reports a newer version while the user is editing, a conflict banner appears in the card modal (`CardConflict` + `registerConflict`).
6. **Subscription deduplication** — events from the user’s own mutations are skipped via `clientMutationId` / `pendingMutationIds` and actor checks so optimistic state is not overwritten by echoed live events.

---

## Documentation

| Topic | Link |
|-------|------|
| All docs | [docs/README.md](docs/README.md) |
| Local development | [docs/development.md](docs/development.md) |
| Architecture | [docs/architecture.md](docs/architecture.md) |
| GraphQL API contract | [docs/api.md](docs/api.md) |
| Deploy (Vercel + Render) | _see `vercel.json` and `render.yaml`_ |
| CI / CD | _see `.github/workflows/`_ |

## Repository layout

```
├── client/          # Angular 19 SPA
├── server/          # GraphQL Yoga API + PostgreSQL
├── docs/            # Project documentation
├── .github/         # CI workflow
├── vercel.json      # Frontend deploy
└── render.yaml      # API deploy blueprint
```

## CI

```bash
npm run ci
```

GitHub Actions runs server tests, client build, and GraphQL codegen drift checks on every PR and push to `main`. See `.github/workflows/` for workflow definitions.

## License

Internal R&D assignment — company use.