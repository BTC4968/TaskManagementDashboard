import { PubSub } from 'graphql-subscriptions';
import { Task, TaskEventType } from './types.js';

export const TASK_CHANGED = 'TASK_CHANGED';

export const pubsub = new PubSub();

export async function publishTaskEvent(type: TaskEventType, task: Task): Promise<void> {
  await pubsub.publish(TASK_CHANGED, { taskChanged: { type, task } });
}
