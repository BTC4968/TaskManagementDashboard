import { randomUUID } from 'node:crypto';
import {
  CreateTaskInput,
  SortDirection,
  Task,
  TaskFilterInput,
  TaskSortInput,
  TaskStatus,
  UpdateTaskInput,
} from './types.js';

const tasks = new Map<string, Task>();

const SORTABLE_FIELDS = new Set(['title', 'status', 'priority', 'assignee', 'updatedAt']);

export function seedTasks(samples: CreateTaskInput[]): void {
  tasks.clear();
  for (const sample of samples) {
    createTask(sample);
  }
}

export function listTasks(
  page: number,
  pageSize: number,
  filter?: TaskFilterInput | null,
  sort?: TaskSortInput[] | null,
): { nodes: Task[]; totalCount: number } {
  let result = [...tasks.values()];

  if (filter?.status) {
    result = result.filter((t) => t.status === filter.status);
  }
  if (filter?.search?.trim()) {
    const q = filter.search.trim().toLowerCase();
    result = result.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        (t.description?.toLowerCase().includes(q) ?? false) ||
        (t.assignee?.toLowerCase().includes(q) ?? false),
    );
  }

  const sortRules = sort?.length ? sort : [{ field: 'updatedAt', direction: SortDirection.DESC }];
  result.sort((a, b) => compareWithSort(a, b, sortRules));

  const totalCount = result.length;
  const safePage = Math.max(1, page);
  const safeSize = Math.min(100, Math.max(1, pageSize));
  const start = (safePage - 1) * safeSize;
  const nodes = result.slice(start, start + safeSize);

  return { nodes, totalCount };
}

export function getTask(id: string): Task | undefined {
  return tasks.get(id);
}

export function createTask(input: CreateTaskInput): Task {
  const now = new Date().toISOString();
  const task: Task = {
    id: randomUUID(),
    title: input.title.trim(),
    description: input.description?.trim() ?? null,
    status: input.status ?? TaskStatus.TODO,
    priority: input.priority ?? 2,
    assignee: input.assignee?.trim() ?? null,
    version: 1,
    updatedAt: now,
  };
  tasks.set(task.id, task);
  return task;
}

export function updateTask(
  id: string,
  input: UpdateTaskInput,
  expectedVersion?: number | null,
): { task?: Task; conflict?: boolean } {
  const existing = tasks.get(id);
  if (!existing) {
    return {};
  }
  if (expectedVersion != null && existing.version !== expectedVersion) {
    return { conflict: true, task: existing };
  }

  const updated: Task = {
    ...existing,
    title: input.title?.trim() ?? existing.title,
    description: input.description !== undefined ? input.description?.trim() ?? null : existing.description,
    status: input.status ?? existing.status,
    priority: input.priority ?? existing.priority,
    assignee: input.assignee !== undefined ? input.assignee?.trim() ?? null : existing.assignee,
    version: existing.version + 1,
    updatedAt: new Date().toISOString(),
  };
  tasks.set(id, updated);
  return { task: updated };
}

export function deleteTask(id: string): Task | undefined {
  const existing = tasks.get(id);
  if (existing) {
    tasks.delete(id);
  }
  return existing;
}

function compareWithSort(a: Task, b: Task, rules: TaskSortInput[]): number {
  for (const rule of rules) {
    const field = SORTABLE_FIELDS.has(rule.field) ? rule.field : 'updatedAt';
    const av = a[field as keyof Task];
    const bv = b[field as keyof Task];
    let cmp = 0;
    if (typeof av === 'number' && typeof bv === 'number') {
      cmp = av - bv;
    } else {
      cmp = String(av ?? '').localeCompare(String(bv ?? ''));
    }
    if (cmp !== 0) {
      return rule.direction === SortDirection.DESC ? -cmp : cmp;
    }
  }
  return 0;
}
