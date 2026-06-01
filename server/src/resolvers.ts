import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { GraphQLError } from 'graphql';
import { requireUser } from './auth/auth.js';
import type { DbClient } from './db/pool.js';
import { pool } from './db/pool.js';
import type { GraphQLContext } from './graphql/context.js';
import {
  publishBoardEvent as publishPgBoardEvent,
  publishTaskEvent as publishPgTaskEvent,
  taskEventStream,
} from './subscriptions/task-events.js';
import {
  addComment,
  createBoard,
  createChecklistItem,
  createLabel,
  createList,
  createTask,
  deleteTask,
  getBoard,
  getBoardView,
  getDefaultBoard,
  getTask,
  listBoards,
  listTasks,
  moveTask,
  setTaskLabels,
  updateBoard,
  updateChecklistItem,
  updateList,
  updateTask,
  type BoardEvent,
  type TaskEvent,
} from './tasks/repository.js';
import {
  BoardEventType,
  CreateBoardInput,
  CreateListInput,
  CreateTaskInput,
  TaskEventType,
  TaskFilterInput,
  TaskSortInput,
  UpdateBoardInput,
  UpdateListInput,
  UpdateTaskInput,
  type MoveTaskInput,
} from './types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const schemaPath = existsSync(join(__dirname, 'schema.graphql'))
  ? join(__dirname, 'schema.graphql')
  : resolve(__dirname, '..', 'src', 'schema.graphql');
const typeDefs = readFileSync(schemaPath, 'utf-8');

let simulateFailure = false;

interface ResolverDeps {
  db: DbClient;
  publishTaskEvent: (event: TaskEvent) => Promise<void>;
  publishBoardEvent: (event: BoardEvent) => Promise<void>;
  taskEvents: {
    subscribeTasks: () => AsyncIterable<{ taskChanged: TaskEvent }>;
    subscribeBoard: (boardId: string) => AsyncIterable<{ boardChanged: BoardEvent }>;
  };
}

const defaultDeps: ResolverDeps = {
  db: pool,
  publishTaskEvent: (event) => publishPgTaskEvent(pool, event),
  publishBoardEvent: (event) => publishPgBoardEvent(pool, event),
  taskEvents: taskEventStream,
};

function networkFailure(): GraphQLError {
  return new GraphQLError('Simulated network failure', {
    extensions: { code: 'SIMULATED_NETWORK_FAILURE' },
  });
}

function ensureMutationAllowed(): void {
  if (simulateFailure) {
    throw networkFailure();
  }
}

function taskEventType(boardType: BoardEventType): TaskEventType {
  if (boardType === BoardEventType.CARD_CREATED) return TaskEventType.CREATED;
  if (boardType === BoardEventType.CARD_DELETED || boardType === BoardEventType.CARD_ARCHIVED) return TaskEventType.DELETED;
  return TaskEventType.UPDATED;
}

function boardEventSource(user: ReturnType<typeof requireUser>, clientMutationId?: string | null) {
  return {
    clientMutationId: clientMutationId ?? null,
    actorId: user.id,
    actorName: user.name ?? user.email ?? 'User',
  };
}

async function publishCardEvents(
  deps: ResolverDeps,
  type: BoardEventType,
  task: NonNullable<BoardEvent['task']>,
  source?: ReturnType<typeof boardEventSource>,
  activity?: BoardEvent['activity'],
): Promise<void> {
  await deps.publishBoardEvent({ type, boardId: task.boardId, task, activity, ...source });
  await deps.publishTaskEvent({ type: taskEventType(type), task });
}

export function createExecutableTaskSchema(deps: ResolverDeps = defaultDeps) {
  const resolvers = {
    Query: {
      health: () => 'ok',
      boards: (_: unknown, __: unknown, context: GraphQLContext) => {
        requireUser(context);
        return listBoards(deps.db);
      },
      board: (_: unknown, { id }: { id: string }, context: GraphQLContext) => {
        requireUser(context);
        return getBoard(deps.db, id);
      },
      defaultBoard: (_: unknown, __: unknown, context: GraphQLContext) => {
        requireUser(context);
        return getDefaultBoard(deps.db);
      },
      boardView: (_: unknown, { boardId }: { boardId: string }, context: GraphQLContext) => {
        requireUser(context);
        return getBoardView(deps.db, boardId);
      },
      task: (_: unknown, { id }: { id: string }, context: GraphQLContext) => {
        requireUser(context);
        return getTask(deps.db, id);
      },
      tasks: async (
        _: unknown,
        args: {
          page: number;
          pageSize: number;
          filter?: TaskFilterInput | null;
          sort?: TaskSortInput[] | null;
        },
        context: GraphQLContext,
      ) => {
        requireUser(context);
        const page = Math.max(1, args.page);
        const pageSize = Math.min(100, Math.max(1, args.pageSize));
        const { nodes, totalCount } = await listTasks(deps.db, page, pageSize, args.filter, args.sort);
        const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
        return {
          nodes,
          totalCount,
          pageInfo: {
            page,
            pageSize,
            hasNextPage: page < totalPages,
            hasPreviousPage: page > 1,
          },
        };
      },
    },
    Mutation: {
      simulateNetworkFailure: (_: unknown, __: unknown, context: GraphQLContext) => {
        requireUser(context);
        simulateFailure = true;
        setTimeout(() => {
          simulateFailure = false;
        }, 5000);
        return true;
      },
      createBoard: async (_: unknown, { input }: { input: CreateBoardInput }, context: GraphQLContext) => {
        const user = requireUser(context);
        ensureMutationAllowed();
        return createBoard(deps.db, input, user);
      },
      updateBoard: async (
        _: unknown,
        { id, input, expectedVersion }: { id: string; input: UpdateBoardInput; expectedVersion?: number | null },
        context: GraphQLContext,
      ) => {
        const user = requireUser(context);
        ensureMutationAllowed();
        const result = await updateBoard(deps.db, id, input, expectedVersion, user);
        if (result.board && !result.conflict) {
          await deps.publishBoardEvent({ type: BoardEventType.BOARD_UPDATED, boardId: result.board.id });
        }
        return { success: Boolean(result.board && !result.conflict), conflict: result.conflict, board: result.board };
      },
      createList: async (_: unknown, { input }: { input: CreateListInput }, context: GraphQLContext) => {
        const user = requireUser(context);
        ensureMutationAllowed();
        const list = await createList(deps.db, input, user);
        await deps.publishBoardEvent({ type: BoardEventType.LIST_CREATED, boardId: list.boardId, list });
        return list;
      },
      updateList: async (
        _: unknown,
        { id, input, expectedVersion }: { id: string; input: UpdateListInput; expectedVersion?: number | null },
        context: GraphQLContext,
      ) => {
        const user = requireUser(context);
        ensureMutationAllowed();
        const result = await updateList(deps.db, id, input, expectedVersion, user);
        if (result.list && !result.conflict) {
          await deps.publishBoardEvent({
            type: result.list.archived ? BoardEventType.LIST_ARCHIVED : BoardEventType.LIST_UPDATED,
            boardId: result.list.boardId,
            list: result.list,
            ...boardEventSource(user, input.clientMutationId),
          });
        }
        return { success: Boolean(result.list && !result.conflict), conflict: result.conflict, list: result.list };
      },
      createTask: async (_: unknown, { input }: { input: CreateTaskInput }, context: GraphQLContext) => {
        const user = requireUser(context);
        ensureMutationAllowed();
        const task = await createTask(deps.db, input, user);
        await publishCardEvents(deps, BoardEventType.CARD_CREATED, task);
        return task;
      },
      updateTask: async (
        _: unknown,
        { id, input, expectedVersion }: { id: string; input: UpdateTaskInput; expectedVersion?: number | null },
        context: GraphQLContext,
      ) => {
        const user = requireUser(context);
        ensureMutationAllowed();
        const result = await updateTask(deps.db, id, input, expectedVersion, user);
        if (result.conflict) {
          return { success: false, conflict: true, task: result.task };
        }
        if (result.task) {
          await publishCardEvents(
            deps,
            result.task.archived ? BoardEventType.CARD_ARCHIVED : BoardEventType.CARD_UPDATED,
            result.task,
            boardEventSource(user, input.clientMutationId),
          );
        }
        return { success: Boolean(result.task), conflict: false, task: result.task };
      },
      moveTask: async (_: unknown, { input }: { input: MoveTaskInput }, context: GraphQLContext) => {
        const user = requireUser(context);
        ensureMutationAllowed();
        const result = await moveTask(deps.db, input, user);
        if (result.conflict) {
          return { success: false, conflict: true, task: result.task };
        }
        if (result.task) {
          await publishCardEvents(deps, BoardEventType.CARD_MOVED, result.task, boardEventSource(user, input.clientMutationId));
        }
        return { success: Boolean(result.task), conflict: false, task: result.task };
      },
      deleteTask: async (
        _: unknown,
        { id, expectedVersion }: { id: string; expectedVersion?: number | null },
        context: GraphQLContext,
      ) => {
        requireUser(context);
        ensureMutationAllowed();
        const result = await deleteTask(deps.db, id, expectedVersion);
        if (result.conflict) {
          return { success: false, conflict: true, task: result.task };
        }
        if (result.task) {
          await publishCardEvents(deps, BoardEventType.CARD_ARCHIVED, result.task);
        }
        return { success: Boolean(result.task), conflict: false, task: result.task };
      },
      createLabel: async (_: unknown, { boardId, name, color }: { boardId: string; name?: string | null; color: string }, context: GraphQLContext) => {
        const user = requireUser(context);
        ensureMutationAllowed();
        const label = await createLabel(deps.db, boardId, name, color, user);
        await deps.publishBoardEvent({ type: BoardEventType.LABEL_UPDATED, boardId, label });
        return label;
      },
      setTaskLabels: async (_: unknown, { taskId, labelIds }: { taskId: string; labelIds: string[] }, context: GraphQLContext) => {
        const user = requireUser(context);
        ensureMutationAllowed();
        const task = await setTaskLabels(deps.db, taskId, labelIds, user);
        if (task) {
          await publishCardEvents(deps, BoardEventType.LABEL_UPDATED, task);
        }
        return task;
      },
      createChecklistItem: async (_: unknown, { taskId, text }: { taskId: string; text: string }, context: GraphQLContext) => {
        const user = requireUser(context);
        ensureMutationAllowed();
        const item = await createChecklistItem(deps.db, taskId, text, user);
        const task = await getTask(deps.db, taskId);
        if (task) await publishCardEvents(deps, BoardEventType.CHECKLIST_UPDATED, task);
        return item;
      },
      updateChecklistItem: async (_: unknown, { id, text, checked }: { id: string; text?: string | null; checked?: boolean | null }, context: GraphQLContext) => {
        const user = requireUser(context);
        ensureMutationAllowed();
        return updateChecklistItem(deps.db, id, text, checked, user);
      },
      addComment: async (_: unknown, { taskId, body }: { taskId: string; body: string }, context: GraphQLContext) => {
        const user = requireUser(context);
        ensureMutationAllowed();
        const comment = await addComment(deps.db, taskId, body, user);
        const task = await getTask(deps.db, taskId);
        if (task) {
          await deps.publishBoardEvent({ type: BoardEventType.COMMENT_CREATED, boardId: task.boardId, task, comment });
        }
        return comment;
      },
    },
    Subscription: {
      taskChanged: {
        subscribe: (_: unknown, __: unknown, context: GraphQLContext) => {
          requireUser(context);
          return deps.taskEvents.subscribeTasks();
        },
      },
      boardChanged: {
        subscribe: (_: unknown, { boardId }: { boardId: string }, context: GraphQLContext) => {
          requireUser(context);
          return deps.taskEvents.subscribeBoard(boardId);
        },
      },
    },
  };

  return makeExecutableSchema({ typeDefs, resolvers });
}

export const schema = createExecutableTaskSchema();
