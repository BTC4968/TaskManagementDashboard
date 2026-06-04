# GraphQL API contract

GraphQL Yoga backend for the Real-Time Collaborative Task Management Dashboard.  
PostgreSQL source of truth, Auth0 JWTs required, WebSocket subscriptions backed by `LISTEN/NOTIFY`.

For setup instructions (endpoints, env vars, migrations), see [development.md](development.md).  
For env var values step-by-step, see [env-guide.md](env-guide.md).

## Auth Contract

All task queries, mutations, and subscriptions require an Auth0 access token.

HTTP:

```http
Authorization: Bearer <Auth0 access token>
```

WebSocket `connectionParams`:

```json
{
  "authorization": "Bearer <Auth0 access token>"
}
```

Unauthenticated task operations return a GraphQL error with:

```json
{
  "extensions": {
    "code": "UNAUTHENTICATED"
  }
}
```

## Board Schema Overview

The Trello-style frontend uses `boardView` and `boardChanged` as its primary contract:

```graphql
query DefaultBoard {
  defaultBoard { id title background version }
}

query BoardView($boardId: ID!) {
  boardView(boardId: $boardId) {
    board { id title description background logoUrl version createdAt updatedAt }
    lists {
      id
      boardId
      title
      position
      version
      createdAt
      updatedAt
      cards {
        id
        boardId
        listId
        title
        description
        priority
        assignees
        position
        dueDate
        coverColor
        archived
        version
        updatedAt
        labels { id name color }
        checklist { id taskId text checked position }
        comments { id taskId body author createdAt }
      }
    }
    labels { id boardId name color }
    activity { id taskId type message actor createdAt }
  }
}

mutation CreateList($input: CreateListInput!) {
  createList(input: $input) { id boardId title position version }
}

mutation CreateTask($input: CreateTaskInput!) {
  createTask(input: $input) { id boardId listId title position version }
}

mutation MoveTask($input: MoveTaskInput!) {
  moveTask(input: $input) {
    success
    conflict
    task { id listId position version }
  }
}

subscription BoardChanged($boardId: ID!) {
  boardChanged(boardId: $boardId) {
    type
    boardId
    clientMutationId
    actorId
    actorName
    task {
      id boardId listId title description priority assignees
      position dueDate coverColor archived version updatedAt
    }
    list {
      id boardId title position archived version createdAt updatedAt
    }
    label { id boardId name color }
    comment { id taskId body author createdAt }
    checklistItem { id taskId text checked position }
    activity { id taskId type message actor createdAt }
  }
}
```

Legacy `tasks`, `task`, and `taskChanged` remain available for compatibility. New frontend code should use board operations.

Tasks have an `archived` boolean and an integer `priority` (1–5). Positions are floating-point ordering keys; clients can place a card between neighbors by sending the midpoint.

## Query Variables

Pagination, filtering, and sorting example:

```json
{
  "page": 1,
  "pageSize": 20,
  "filter": {
    "search": "release"
  },
  "sort": [
    { "field": "priority", "direction": "ASC" },
    { "field": "updatedAt", "direction": "DESC" }
  ]
}
```

Supported sort fields: `title`, `priority`, `updatedAt`. Unknown fields fall back to `updatedAt`.

## Conflict Handling

Tasks include a monotonic `version`. Frontend updates should pass the version seen by the user as `expectedVersion`.

Stale update/delete response:

```json
{
  "success": false,
  "conflict": true,
  "task": {
    "id": "task-id",
    "version": 3
  }
}
```

Use the returned `task` as the current server version for conflict UI. Successful updates/deletes return `success: true`, `conflict: false`, and the affected task.

## Rollback Errors

`simulateNetworkFailure` enables a five-second failure window for subsequent mutations. During that window, mutation errors use:

```json
{
  "extensions": {
    "code": "SIMULATED_NETWORK_FAILURE"
  }
}
```

Frontend optimistic updates should restore the exact previous Apollo cache state and show a non-blocking toast.

Validation errors use `BAD_USER_INPUT`, for example empty titles or priority values outside `1..5`.

## Subscription Events

`boardChanged` publishes:

```json
{
  "type": "CARD_CREATED | CARD_UPDATED | CARD_MOVED | CARD_ARCHIVED | LIST_CREATED | LIST_UPDATED | COMMENT_CREATED",
  "boardId": "board-id",
  "clientMutationId": "optional-client-generated-id",
  "actorId": "auth0-user-sub",
  "actorName": "Display Name",
  "task": {
    "id": "task-id",
    "version": 2
  }
}
```

Frontend cache guidance:

- Apply `boardChanged` events incrementally in local state — do **not** refetch `boardView` on every event.
- `CARD_CREATED`: insert the card into the target list using `task` fields.
- `CARD_MOVED`: move the card between lists by `listId` and `position`.
- `CARD_UPDATED`: merge scalar card fields; if the open modal has an older `version`, show conflict UI.
- `CARD_ARCHIVED`: remove the card from visible lists.
- `COMMENT_CREATED`: append `comment` to the card; prepend `activity` when present.
- `CHECKLIST_UPDATED`: upsert `checklistItem` on the affected card.
- `LABEL_UPDATED`: merge `label` into board labels; bump card version when `task` is present.

For optimistic writes, send a unique `clientMutationId` on `UpdateTaskInput`, `MoveTaskInput`, and `UpdateListInput`. The backend echoes it on `boardChanged`; clients should ignore conflict UI for events with their own pending mutation id and use foreign newer versions for conflict banners.
