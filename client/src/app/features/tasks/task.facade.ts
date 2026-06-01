import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ApolloCache, NormalizedCacheObject } from '@apollo/client/core';
import { Apollo } from 'apollo-angular';
import { map } from 'rxjs/operators';
import { ToastService } from '../../core/toast/toast.service';
import {
  ExternalConflict,
  Task,
  TaskConnection,
  TaskEventType,
  TaskStatus,
} from './task.types';
import {
  CREATE_TASK_MUTATION,
  DELETE_TASK_MUTATION,
  SIMULATE_FAILURE_MUTATION,
  TASK_CHANGED_SUBSCRIPTION,
  TASKS_QUERY,
  UPDATE_TASK_MUTATION,
} from './task.queries';

export interface TaskFilter {
  status: TaskStatus | null;
  search: string;
}

export interface TaskSort {
  field: string;
  direction: 'ASC' | 'DESC';
}

interface TasksQueryResult {
  tasks: TaskConnection;
}

interface CreateTaskResult {
  createTask: Task;
}

interface UpdateTaskResult {
  updateTask: {
    success: boolean;
    conflict: boolean;
    task: Task | null;
  };
}

interface TaskChangedResult {
  taskChanged: {
    type: TaskEventType;
    task: Task;
  };
}

@Injectable()
export class TaskFacade {
  private readonly apollo = inject(Apollo);
  private readonly destroyRef = inject(DestroyRef);
  private readonly toast = inject(ToastService);

  readonly loading = signal(false);
  readonly connection = signal<TaskConnection | null>(null);
  readonly conflicts = signal<ExternalConflict[]>([]);
  readonly editingTaskId = signal<string | null>(null);

  private listQueryRef = this.apollo.watchQuery<TasksQueryResult>({
    query: TASKS_QUERY,
    variables: this.currentListVariables(),
  });

  private subscriptionActive = false;

  init(): void {
    this.listQueryRef.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ data, loading }) => {
          this.loading.set(loading);
          if (data?.tasks) {
            this.connection.set(data.tasks);
          }
        },
        error: () => this.toast.error('Failed to load tasks.'),
      });

    this.startSubscription();
  }

  refreshList(
    page: number,
    pageSize: number,
    filter: TaskFilter,
    sort: TaskSort[],
  ): void {
    const variables = {
      page,
      pageSize,
      filter: {
        status: filter.status,
        search: filter.search || null,
      },
      sort,
    };
    this.listQueryRef.setVariables(variables);
    this.listQueryRef.refetch(variables);
  }

  createTask(input: {
    title: string;
    description: string | null;
    status: TaskStatus;
    priority: number;
    assignee: string | null;
  }): void {
    const optimisticId = `temp-${crypto.randomUUID()}`;
    const optimisticTask: Task = {
      id: optimisticId,
      title: input.title,
      description: input.description,
      status: input.status,
      priority: input.priority,
      assignee: input.assignee,
      version: 0,
      updatedAt: new Date().toISOString(),
    };

    this.apollo
      .mutate<CreateTaskResult>({
        mutation: CREATE_TASK_MUTATION,
        variables: { input },
        optimisticResponse: { createTask: optimisticTask },
        update: (cache, { data }) => {
          if (!data?.createTask) return;
          this.patchTaskInCache(cache, data.createTask, 'add');
        },
      })
      .subscribe({
        next: () => this.toast.success('Task created.'),
        error: () => {
          this.listQueryRef.refetch();
          this.toast.error('Create failed — changes reverted.');
        },
      });
  }

  updateTask(
    id: string,
    input: Partial<Pick<Task, 'title' | 'description' | 'status' | 'priority' | 'assignee'>>,
    expectedVersion: number,
  ): void {
    const previous = this.findTaskInCache(id);
    if (!previous) return;

    const optimistic: Task = {
      ...previous,
      ...input,
      version: expectedVersion + 1,
      updatedAt: new Date().toISOString(),
    };

    this.apollo
      .mutate<UpdateTaskResult>({
        mutation: UPDATE_TASK_MUTATION,
        variables: { id, input, expectedVersion },
        optimisticResponse: {
          updateTask: { success: true, conflict: false, task: optimistic },
        },
        update: (cache, { data }) => {
          const result = data?.updateTask;
          if (!result) return;
          if (result.conflict && result.task) {
            this.registerConflict(id, expectedVersion, result.task);
            this.patchTaskInCache(cache, result.task, 'replace');
            return;
          }
          if (result.task) {
            this.patchTaskInCache(cache, result.task, 'replace');
            this.clearConflict(id);
          }
        },
      })
      .subscribe({
        next: ({ data }) => {
          if (data?.updateTask.conflict) {
            this.toast.warning('Conflict detected — server version applied.');
          } else {
            this.toast.success('Task updated.');
          }
        },
        error: () => {
          if (previous) {
            this.patchTaskInCache(this.apollo.client.cache, previous, 'replace');
          }
          this.listQueryRef.refetch();
          this.toast.error('Update failed — changes reverted.');
        },
      });
  }

  deleteTask(id: string): void {
    const previous = this.findTaskInCache(id);
    this.apollo
      .mutate({
        mutation: DELETE_TASK_MUTATION,
        variables: { id },
        optimisticResponse: { deleteTask: true },
        update: (cache) => {
          this.patchTaskInCache(cache, { id } as Task, 'remove');
        },
      })
      .subscribe({
        next: () => this.toast.success('Task deleted.'),
        error: () => {
          if (previous) {
            this.patchTaskInCache(this.apollo.client.cache, previous, 'add');
          }
          this.listQueryRef.refetch();
          this.toast.error('Delete failed — changes reverted.');
        },
      });
  }

  simulateNetworkFailure(): void {
    this.apollo
      .mutate({ mutation: SIMULATE_FAILURE_MUTATION })
      .subscribe({
        next: () =>
          this.toast.info('Next mutation will fail (5s window). Try editing a task.'),
      });
  }

  acceptRemoteVersion(conflict: ExternalConflict): void {
    this.patchTaskInCache(this.apollo.client.cache, conflict.remoteTask, 'replace');
    this.clearConflict(conflict.taskId);
    this.toast.info('Applied latest server version.');
  }

  dismissConflict(taskId: string): void {
    this.clearConflict(taskId);
  }

  setEditingTask(id: string | null): void {
    this.editingTaskId.set(id);
  }

  private startSubscription(): void {
    if (this.subscriptionActive) return;
    this.subscriptionActive = true;

    this.apollo
      .subscribe<TaskChangedResult>({ query: TASK_CHANGED_SUBSCRIPTION })
      .pipe(
        map((r) => r.data?.taskChanged),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (event) => {
          if (!event) return;
          const editingId = this.editingTaskId();
          if (
            event.type === TaskEventType.Updated &&
            editingId === event.task.id
          ) {
            const local = this.findTaskInCache(event.task.id);
            if (local && local.version !== event.task.version) {
              this.registerConflict(event.task.id, local.version, event.task);
              this.toast.warning(`"${event.task.title}" was updated elsewhere.`);
            }
          }
          if (event.type === TaskEventType.Deleted) {
            this.patchTaskInCache(this.apollo.client.cache, event.task, 'remove');
          } else {
            this.patchTaskInCache(this.apollo.client.cache, event.task, 'replace');
          }
          this.listQueryRef.refetch();
        },
      });
  }

  private registerConflict(
    taskId: string,
    localVersion: number,
    remoteTask: Task,
  ): void {
    const entry: ExternalConflict = {
      taskId,
      localVersion,
      remoteVersion: remoteTask.version,
      remoteTask,
    };
    this.conflicts.update((list) => {
      const filtered = list.filter((c) => c.taskId !== taskId);
      return [...filtered, entry];
    });
  }

  private clearConflict(taskId: string): void {
    this.conflicts.update((list) => list.filter((c) => c.taskId !== taskId));
  }

  private findTaskInCache(id: string): Task | undefined {
    const conn = this.connection();
    return conn?.nodes.find((t) => t.id === id);
  }

  private patchTaskInCache(
    cache: ApolloCache<NormalizedCacheObject>,
    task: Task,
    mode: 'add' | 'replace' | 'remove',
  ): void {
    const variables = this.listQueryRef.variables;
    const existing = cache.readQuery<TasksQueryResult>({
      query: TASKS_QUERY,
      variables,
    });
    if (!existing?.tasks) return;

    let nodes = [...existing.tasks.nodes];
    if (mode === 'add') {
      nodes = [task, ...nodes];
    } else if (mode === 'remove') {
      nodes = nodes.filter((n) => n.id !== task.id);
    } else {
      const idx = nodes.findIndex((n) => n.id === task.id);
      if (idx >= 0) {
        nodes[idx] = task;
      } else {
        nodes = [task, ...nodes];
      }
    }

    cache.writeQuery({
      query: TASKS_QUERY,
      variables,
      data: {
        tasks: {
          ...existing.tasks,
          nodes,
          totalCount:
            mode === 'add'
              ? existing.tasks.totalCount + 1
              : mode === 'remove'
                ? Math.max(0, existing.tasks.totalCount - 1)
                : existing.tasks.totalCount,
        },
      },
    });
  }

  private currentListVariables() {
    return {
      page: 1,
      pageSize: 10,
      filter: { status: null, search: null },
      sort: [{ field: 'updatedAt', direction: 'DESC' as const }],
    };
  }
}
