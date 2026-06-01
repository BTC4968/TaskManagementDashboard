import { Client } from 'pg';
import { env } from '../config/env.js';
import type { BoardEvent, TaskEvent } from '../tasks/repository.js';

export const TASK_EVENTS_CHANNEL = 'task_events';

type StreamValue = { taskChanged?: TaskEvent; boardChanged?: BoardEvent };

interface Subscriber<T> {
  queue: T[];
  waiters: Array<(result: IteratorResult<T>) => void>;
  active: boolean;
  filter: (event: StreamValue) => T | null;
}

export async function publishTaskEvent(
  client: { query: (sql: string, values?: unknown[]) => Promise<unknown> },
  event: TaskEvent,
): Promise<void> {
  await client.query('SELECT pg_notify($1, $2)', [TASK_EVENTS_CHANNEL, JSON.stringify({ taskChanged: event })]);
}

export async function publishBoardEvent(
  client: { query: (sql: string, values?: unknown[]) => Promise<unknown> },
  event: BoardEvent,
): Promise<void> {
  await client.query('SELECT pg_notify($1, $2)', [TASK_EVENTS_CHANNEL, JSON.stringify({ boardChanged: event })]);
}

export class TaskEventStream {
  private listener: Client | null = null;
  private subscribers = new Set<Subscriber<unknown>>();
  private connecting: Promise<void> | null = null;

  async start(): Promise<void> {
    if (this.listener) return;
    this.connecting ??= this.connect();
    await this.connecting;
    this.connecting = null;
  }

  subscribeTasks(): AsyncIterable<{ taskChanged: TaskEvent }> {
    return this.subscribe((event) => (event.taskChanged ? { taskChanged: event.taskChanged } : null));
  }

  subscribeBoard(boardId: string): AsyncIterable<{ boardChanged: BoardEvent }> {
    return this.subscribe((event) =>
      event.boardChanged?.boardId === boardId ? { boardChanged: event.boardChanged } : null,
    );
  }

  async stop(): Promise<void> {
    for (const subscriber of this.subscribers) {
      subscriber.active = false;
      this.flushSubscriber(subscriber);
    }
    this.subscribers.clear();
    if (this.listener) {
      await this.listener.query(`UNLISTEN ${TASK_EVENTS_CHANNEL}`);
      await this.listener.end();
      this.listener = null;
    }
  }

  private subscribe<T>(filter: (event: StreamValue) => T | null): AsyncIterable<T> {
    const subscriber: Subscriber<T> = { queue: [], waiters: [], active: true, filter };
    this.subscribers.add(subscriber as Subscriber<unknown>);
    void this.start();

    return {
      [Symbol.asyncIterator]: () => ({
        next: () => this.next(subscriber),
        return: async () => {
          subscriber.active = false;
          this.subscribers.delete(subscriber as Subscriber<unknown>);
          this.flushSubscriber(subscriber);
          return { done: true, value: undefined };
        },
        throw: async (error?: unknown) => {
          subscriber.active = false;
          this.subscribers.delete(subscriber as Subscriber<unknown>);
          this.flushSubscriber(subscriber);
          throw error;
        },
      }),
    };
  }

  private async connect(): Promise<void> {
    const listener = new Client({
      connectionString: env.databaseUrl,
      ssl: env.databaseSsl ? { rejectUnauthorized: false } : undefined,
      connectionTimeoutMillis: 10_000,
    });
    listener.on('notification', (message) => {
      if (message.channel !== TASK_EVENTS_CHANNEL || !message.payload) return;
      try {
        this.push(JSON.parse(message.payload) as StreamValue);
      } catch (error) {
        console.error('Failed to parse task event notification.', error);
      }
    });
    listener.on('error', (error) => {
      console.error('Task event listener error.', error);
      void this.reconnect();
    });
    await listener.connect();
    await listener.query(`LISTEN ${TASK_EVENTS_CHANNEL}`);
    this.listener = listener;
  }

  private async reconnect(): Promise<void> {
    if (this.listener) {
      try {
        await this.listener.end();
      } catch {
        // Connection is already broken.
      }
      this.listener = null;
    }
    if (this.subscribers.size) {
      this.connecting ??= this.connect();
      await this.connecting.finally(() => {
        this.connecting = null;
      });
    }
  }

  private push(event: StreamValue): void {
    for (const subscriber of this.subscribers) {
      if (!subscriber.active) continue;
      const value = subscriber.filter(event);
      if (!value) continue;
      const waiter = subscriber.waiters.shift();
      if (waiter) {
        waiter({ done: false, value });
      } else {
        subscriber.queue.push(value);
      }
    }
  }

  private next<T>(subscriber: Subscriber<T>): Promise<IteratorResult<T>> {
    if (!subscriber.active) return Promise.resolve({ done: true, value: undefined });
    const event = subscriber.queue.shift();
    if (event) return Promise.resolve({ done: false, value: event });
    return new Promise((resolve) => subscriber.waiters.push(resolve));
  }

  private flushSubscriber<T>(subscriber: Subscriber<T>): void {
    for (const waiter of subscriber.waiters.splice(0)) {
      waiter({ done: true, value: undefined });
    }
    subscriber.queue.length = 0;
  }
}

export const taskEventStream = new TaskEventStream();
