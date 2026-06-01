import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeExecutableSchema } from '@graphql-tools/schema';
import {
  createTask,
  deleteTask,
  getTask,
  listTasks,
  updateTask,
} from './store.js';
import { publishTaskEvent, pubsub, TASK_CHANGED } from './pubsub.js';
import {
  CreateTaskInput,
  TaskEventType,
  TaskFilterInput,
  TaskSortInput,
  UpdateTaskInput,
} from './types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const typeDefs = readFileSync(join(__dirname, 'schema.graphql'), 'utf-8');

let simulateFailure = false;

const resolvers = {
  Query: {
    health: () => 'ok',
    task: (_: unknown, { id }: { id: string }) => getTask(id) ?? null,
    tasks: (
      _: unknown,
      args: {
        page: number;
        pageSize: number;
        filter?: TaskFilterInput | null;
        sort?: TaskSortInput[] | null;
      },
    ) => {
      const page = Math.max(1, args.page);
      const pageSize = Math.min(100, Math.max(1, args.pageSize));
      const { nodes, totalCount } = listTasks(page, pageSize, args.filter, args.sort);
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
    simulateNetworkFailure: () => {
      simulateFailure = true;
      setTimeout(() => {
        simulateFailure = false;
      }, 5000);
      return true;
    },
    createTask: async (_: unknown, { input }: { input: CreateTaskInput }) => {
      if (simulateFailure) {
        throw new Error('Simulated network failure');
      }
      const task = createTask(input);
      await publishTaskEvent(TaskEventType.CREATED, task);
      return task;
    },
    updateTask: async (
      _: unknown,
      {
        id,
        input,
        expectedVersion,
      }: { id: string; input: UpdateTaskInput; expectedVersion?: number | null },
    ) => {
      if (simulateFailure) {
        throw new Error('Simulated network failure');
      }
      const result = updateTask(id, input, expectedVersion);
      if (!result.task && !result.conflict) {
        return { success: false, conflict: false, task: null };
      }
      if (result.conflict && result.task) {
        return { success: false, conflict: true, task: result.task };
      }
      if (result.task) {
        await publishTaskEvent(TaskEventType.UPDATED, result.task);
        return { success: true, conflict: false, task: result.task };
      }
      return { success: false, conflict: false, task: null };
    },
    deleteTask: async (_: unknown, { id }: { id: string }) => {
      if (simulateFailure) {
        throw new Error('Simulated network failure');
      }
      const removed = deleteTask(id);
      if (removed) {
        await publishTaskEvent(TaskEventType.DELETED, removed);
        return true;
      }
      return false;
    },
  },
  Subscription: {
    taskChanged: {
      subscribe: () => pubsub.asyncIterableIterator(TASK_CHANGED),
    },
  },
};

export const schema = makeExecutableSchema({ typeDefs, resolvers });
