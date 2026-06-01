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

export enum BoardEventType {
  BOARD_UPDATED = 'BOARD_UPDATED',
  LIST_CREATED = 'LIST_CREATED',
  LIST_UPDATED = 'LIST_UPDATED',
  LIST_ARCHIVED = 'LIST_ARCHIVED',
  CARD_CREATED = 'CARD_CREATED',
  CARD_UPDATED = 'CARD_UPDATED',
  CARD_MOVED = 'CARD_MOVED',
  CARD_ARCHIVED = 'CARD_ARCHIVED',
  CARD_DELETED = 'CARD_DELETED',
  LABEL_UPDATED = 'LABEL_UPDATED',
  CHECKLIST_UPDATED = 'CHECKLIST_UPDATED',
  COMMENT_CREATED = 'COMMENT_CREATED',
}

export enum SortDirection {
  ASC = 'ASC',
  DESC = 'DESC',
}

export interface Task {
  id: string;
  boardId: string;
  listId: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: number;
  assignee: string | null;
  position: number;
  dueDate: string | null;
  coverColor: string | null;
  archived: boolean;
  version: number;
  updatedAt: string;
}

export interface Board {
  id: string;
  title: string;
  description: string | null;
  background: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface TaskList {
  id: string;
  boardId: string;
  title: string;
  status: TaskStatus | null;
  position: number;
  archived: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface Label {
  id: string;
  boardId: string;
  name: string;
  color: string;
}

export interface ChecklistItem {
  id: string;
  taskId: string;
  text: string;
  checked: boolean;
  position: number;
}

export interface TaskComment {
  id: string;
  taskId: string;
  body: string;
  author: string;
  createdAt: string;
}

export interface ActivityItem {
  id: string;
  taskId: string | null;
  type: string;
  message: string;
  actor: string;
  createdAt: string;
}

export interface BoardCard extends Task {
  labels: Label[];
  checklist: ChecklistItem[];
  comments: TaskComment[];
}

export interface BoardList extends TaskList {
  cards: BoardCard[];
}

export interface BoardView {
  board: Board;
  lists: BoardList[];
  labels: Label[];
  activity: ActivityItem[];
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
  boardId?: string | null;
  listId?: string | null;
  title: string;
  description?: string | null;
  status?: TaskStatus;
  priority?: number;
  assignee?: string | null;
  position?: number | null;
  dueDate?: string | null;
  coverColor?: string | null;
}

export interface UpdateTaskInput {
  listId?: string | null;
  title?: string;
  description?: string | null;
  status?: TaskStatus;
  priority?: number;
  assignee?: string | null;
  position?: number | null;
  dueDate?: string | null;
  coverColor?: string | null;
  archived?: boolean | null;
  clientMutationId?: string | null;
}

export interface CreateBoardInput {
  title: string;
  description?: string | null;
  background?: string | null;
}

export interface UpdateBoardInput {
  title?: string | null;
  description?: string | null;
  background?: string | null;
}

export interface CreateListInput {
  boardId: string;
  title: string;
  status?: TaskStatus | null;
  position?: number | null;
}

export interface UpdateListInput {
  title?: string | null;
  status?: TaskStatus | null;
  position?: number | null;
  archived?: boolean | null;
  clientMutationId?: string | null;
}

export interface MoveTaskInput {
  boardId: string;
  taskId: string;
  toListId: string;
  position: number;
  status?: TaskStatus | null;
  expectedVersion?: number | null;
  clientMutationId?: string | null;
}
