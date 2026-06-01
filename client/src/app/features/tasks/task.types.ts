export enum TaskStatus {
  Todo = 'TODO',
  InProgress = 'IN_PROGRESS',
  Done = 'DONE',
}

export enum TaskEventType {
  Created = 'CREATED',
  Updated = 'UPDATED',
  Deleted = 'DELETED',
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

export interface TaskConnection {
  nodes: Task[];
  totalCount: number;
  pageInfo: {
    page: number;
    pageSize: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

export interface ExternalConflict {
  taskId: string;
  localVersion: number;
  remoteVersion: number;
  remoteTask: Task;
}
