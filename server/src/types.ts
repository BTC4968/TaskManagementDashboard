export enum TaskStatus {
  TODO = 'TODO',
  IN_PROGRESS = 'IN_PROGRESS',
  DONE = 'DONE',
}

export enum TaskEventType {
  CREATED = 'CREATED',
  UPDATED = 'UPDATED',
  DELETED = 'DELETED',
}

export enum SortDirection {
  ASC = 'ASC',
  DESC = 'DESC',
}

export interface Task {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: number;
  assignee: string | null;
  version: number;
  updatedAt: string;
}

export interface TaskFilterInput {
  status?: TaskStatus | null;
  search?: string | null;
}

export interface TaskSortInput {
  field: string;
  direction: SortDirection;
}

export interface CreateTaskInput {
  title: string;
  description?: string | null;
  status?: TaskStatus;
  priority?: number;
  assignee?: string | null;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string | null;
  status?: TaskStatus;
  priority?: number;
  assignee?: string | null;
}
