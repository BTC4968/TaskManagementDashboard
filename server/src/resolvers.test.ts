import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import test from 'node:test';
import { graphql, parse, subscribe } from 'graphql';
import type { Pool } from 'pg';
import { DataType, newDb } from 'pg-mem';
import type { AuthUser } from './auth/auth.js';
import type { BoardEvent, TaskEvent } from './domain/repository.js';
import { TaskEventType } from './types.js';

process.env.NODE_ENV = 'test';
process.env.PORT = '4000';
process.env.HOST = '127.0.0.1';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.DATABASE_SSL = 'false';
process.env.AUTH0_DOMAIN = 'example.auth0.com';
process.env.AUTH0_AUDIENCE = 'https://task-dashboard-api';

const { authenticateHeader, setJwtVerifierForTests } = await import('./auth/auth.js');
const { createExecutableTaskSchema } = await import('./resolvers.js');

const user: AuthUser = {
  id: 'auth0|integration-user',
  name: 'Integration User',
  email: 'integration@example.com',
};

async function createTestPool(): Promise<Pool> {
  const db = newDb();
  db.public.registerFunction({
    name: 'gen_random_uuid',
    returns: DataType.uuid,
    impure: true,
    implementation: randomUUID,
  });
  const adapter = db.adapters.createPg();
  const pool = new adapter.Pool() as unknown as Pool;
  await pool.query(`
    CREATE TABLE boards (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      title text NOT NULL,
      description text,
      background text NOT NULL DEFAULT 'linear-gradient(135deg, #0c66e4 0%, #5e4db2 100%)',
      version integer NOT NULL DEFAULT 1,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      updated_by text NOT NULL DEFAULT 'system'
    );
    CREATE TABLE task_lists (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      board_id uuid NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
      title text NOT NULL,
      status text CHECK (status IN ('TODO', 'IN_PROGRESS', 'DONE')),
      position numeric NOT NULL DEFAULT 0,
      archived boolean NOT NULL DEFAULT false,
      version integer NOT NULL DEFAULT 1,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      updated_by text NOT NULL DEFAULT 'system'
    );
    CREATE TABLE tasks (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      board_id uuid NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
      list_id uuid NOT NULL REFERENCES task_lists(id) ON DELETE SET NULL,
      title text NOT NULL,
      description text,
      status text NOT NULL CHECK (status IN ('TODO', 'IN_PROGRESS', 'DONE')),
      priority integer NOT NULL CHECK (priority BETWEEN 1 AND 5),
      assignee text,
      position numeric NOT NULL DEFAULT 0,
      due_date date,
      cover_color text,
      archived boolean NOT NULL DEFAULT false,
      version integer NOT NULL DEFAULT 1 CHECK (version > 0),
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      updated_by text NOT NULL
    );
    CREATE TABLE labels (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      board_id uuid NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
      name text NOT NULL DEFAULT '',
      color text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE task_labels (
      task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      label_id uuid NOT NULL REFERENCES labels(id) ON DELETE CASCADE,
      PRIMARY KEY (task_id, label_id)
    );
    CREATE TABLE checklist_items (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      text text NOT NULL,
      checked boolean NOT NULL DEFAULT false,
      position numeric NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE task_comments (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      body text NOT NULL,
      author text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE task_activity (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      board_id uuid NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
      task_id uuid REFERENCES tasks(id) ON DELETE CASCADE,
      type text NOT NULL,
      message text NOT NULL,
      actor text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    INSERT INTO boards (id, title, updated_by) VALUES ('00000000-0000-4000-8000-000000000001', 'Test Board', 'system');
    INSERT INTO task_lists (id, board_id, title, status, position, updated_by)
    VALUES
      ('00000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000000001', 'To Do', 'TODO', 1024, 'system'),
      ('00000000-0000-4000-8000-000000000102', '00000000-0000-4000-8000-000000000001', 'In Progress', 'IN_PROGRESS', 2048, 'system'),
      ('00000000-0000-4000-8000-000000000103', '00000000-0000-4000-8000-000000000001', 'Done', 'DONE', 3072, 'system');
  `);
  return pool;
}

function emptyStreams() {
  return {
    subscribeTasks: async function* (): AsyncIterable<{ taskChanged: TaskEvent }> {},
    subscribeBoard: async function* (): AsyncIterable<{ boardChanged: BoardEvent }> {},
  };
}

test('authenticateHeader accepts a valid mocked Auth0 JWT payload', async () => {
  setJwtVerifierForTests(async (token) => {
    assert.equal(token, 'valid-token');
    return {
      sub: user.id,
      name: user.name,
      email: user.email,
      aud: 'https://task-dashboard-api',
      iss: 'https://example.auth0.com/',
    };
  });

  const authenticated = await authenticateHeader('Bearer valid-token');
  assert.deepEqual(authenticated, user);
  setJwtVerifierForTests(null);
});

test('task queries reject unauthenticated GraphQL context', async () => {
  const pool = await createTestPool();
  const schema = createExecutableTaskSchema({
    db: pool,
    publishTaskEvent: async () => undefined,
    publishBoardEvent: async () => undefined,
    taskEvents: emptyStreams(),
  });

  const result = await graphql({
    schema,
    source: '{ tasks { totalCount } }',
    contextValue: { user: null },
  });

  assert.equal(result.errors?.[0]?.extensions?.code, 'UNAUTHENTICATED');
  await pool.end();
});

test('authenticated CRUD mutations return conflict-aware GraphQL shapes', async () => {
  const pool = await createTestPool();
  const events: TaskEvent[] = [];
  const schema = createExecutableTaskSchema({
    db: pool,
    publishTaskEvent: async (event) => {
      events.push(event);
    },
    publishBoardEvent: async () => undefined,
    taskEvents: emptyStreams(),
  });

  const created = await graphql({
    schema,
    source: 'mutation { createTask(input: { title: "GraphQL task", priority: 2 }) { id title version } }',
    contextValue: { user },
  });
  assert.ifError(created.errors?.[0]);

  const createdTask = (created.data as { createTask: { id: string; version: number } }).createTask;
  const updated = await graphql({
    schema,
    source:
      'mutation($id: ID!, $version: Int!) { updateTask(id: $id, expectedVersion: $version, input: { title: "Updated" }) { success conflict task { title version } } }',
    variableValues: { id: createdTask.id, version: createdTask.version },
    contextValue: { user },
  });
  assert.ifError(updated.errors?.[0]);
  const updateResult = (updated.data as { updateTask: { success: boolean; conflict: boolean } }).updateTask;
  assert.equal(updateResult.success, true);
  assert.equal(updateResult.conflict, false);

  const staleDelete = await graphql({
    schema,
    source:
      'mutation($id: ID!, $version: Int!) { deleteTask(id: $id, expectedVersion: $version) { success conflict task { id version } } }',
    variableValues: { id: createdTask.id, version: createdTask.version },
    contextValue: { user },
  });
  assert.ifError(staleDelete.errors?.[0]);
  assert.equal((staleDelete.data as { deleteTask: { conflict: boolean } }).deleteTask.conflict, true);
  assert.deepEqual(
    events.map((event) => event.type),
    [TaskEventType.CREATED, TaskEventType.UPDATED],
  );

  await pool.end();
});

test('simulateNetworkFailure returns rollback-friendly GraphQL errors', async () => {
  const pool = await createTestPool();
  const schema = createExecutableTaskSchema({
    db: pool,
    publishTaskEvent: async () => undefined,
    publishBoardEvent: async () => undefined,
    taskEvents: emptyStreams(),
  });

  await graphql({
    schema,
    source: 'mutation { simulateNetworkFailure }',
    contextValue: { user },
  });
  const failed = await graphql({
    schema,
    source: 'mutation { createTask(input: { title: "Will fail" }) { id } }',
    contextValue: { user },
  });

  assert.equal(failed.errors?.[0]?.extensions?.code, 'SIMULATED_NETWORK_FAILURE');
  await pool.end();
});

test('taskChanged subscriptions reject missing auth and yield events when authenticated', async () => {
  const pool = await createTestPool();
  const task = await import('./domain/repository.js').then((repo) => repo.createTask(pool, { title: 'Event task' }, user));
  const event: TaskEvent = { type: TaskEventType.CREATED, task };
  const schema = createExecutableTaskSchema({
    db: pool,
    publishTaskEvent: async () => undefined,
    publishBoardEvent: async () => undefined,
    taskEvents: {
      subscribeTasks: async function* () {
        yield { taskChanged: event };
      },
      subscribeBoard: async function* () {},
    },
  });
  const document = parse('subscription { taskChanged { type task { id title } } }');

  const rejected = await subscribe({
    schema,
    document,
    contextValue: { user: null },
  });
  assert.equal(Symbol.asyncIterator in rejected, false);
  if (!('next' in rejected)) {
    assert.equal(rejected.errors?.[0]?.extensions?.code, 'UNAUTHENTICATED');
  }

  const accepted = await subscribe({
    schema,
    document,
    contextValue: { user },
  });
  assert.equal(Symbol.asyncIterator in accepted, true);
  if (Symbol.asyncIterator in accepted) {
    const next = await accepted[Symbol.asyncIterator]().next();
    assert.equal(next.done, false);
    const value = next.value as { data?: { taskChanged: { type: TaskEventType; task: { title: string } } } };
    assert.equal(value.data?.taskChanged.type, TaskEventType.CREATED);
    assert.equal(value.data?.taskChanged.task.title, 'Event task');
  }

  await pool.end();
});
