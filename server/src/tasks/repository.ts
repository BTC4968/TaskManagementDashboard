import { GraphQLError } from 'graphql';
import type { AuthUser } from '../auth/auth.js';
import type { DbClient } from '../db/pool.js';
import {
  Board,
  BoardCard,
  BoardEventType,
  BoardList,
  BoardView,
  ChecklistItem,
  CreateBoardInput,
  CreateListInput,
  CreateTaskInput,
  Label,
  MoveTaskInput,
  SortDirection,
  Task,
  TaskComment,
  TaskEventType,
  TaskFilterInput,
  TaskList,
  TaskSortInput,
  TaskStatus,
  UpdateBoardInput,
  UpdateListInput,
  UpdateTaskInput,
  type ActivityItem,
} from '../types.js';

interface BoardRow {
  id: string;
  title: string;
  description: string | null;
  background: string;
  version: number;
  created_at: Date | string;
  updated_at: Date | string;
}

interface ListRow {
  id: string;
  board_id: string;
  title: string;
  status: TaskStatus | null;
  position: string | number;
  archived: boolean;
  version: number;
  created_at: Date | string;
  updated_at: Date | string;
}

interface TaskRow {
  id: string;
  board_id: string;
  list_id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: number;
  assignee: string | null;
  position: string | number;
  due_date: Date | string | null;
  cover_color: string | null;
  archived: boolean;
  version: number;
  updated_at: Date | string;
}

interface LabelRow {
  id: string;
  board_id: string;
  name: string;
  color: string;
}

interface ChecklistRow {
  id: string;
  task_id: string;
  text: string;
  checked: boolean;
  position: string | number;
}

interface CommentRow {
  id: string;
  task_id: string;
  body: string;
  author: string;
  created_at: Date | string;
}

interface ActivityRow {
  id: string;
  task_id: string | null;
  type: string;
  message: string;
  actor: string;
  created_at: Date | string;
}

export interface TaskListResult {
  nodes: Task[];
  totalCount: number;
}

export interface TaskMutationResult {
  task: Task | null;
  conflict: boolean;
}

export interface ListMutationResult {
  list: TaskList | null;
  conflict: boolean;
}

export interface BoardMutationResult {
  board: Board | null;
  conflict: boolean;
}

export interface TaskEvent {
  type: TaskEventType;
  task: Task;
}

export interface BoardEvent {
  type: BoardEventType;
  boardId: string;
  clientMutationId?: string | null;
  actorId?: string | null;
  actorName?: string | null;
  task?: Task | null;
  list?: TaskList | null;
  label?: Label | null;
  comment?: TaskComment | null;
  activity?: ActivityItem | null;
}

const SORT_FIELDS: Record<string, string> = {
  title: 'title',
  status: 'status',
  priority: 'priority',
  assignee: 'assignee',
  position: 'position',
  updatedAt: 'updated_at',
};

function iso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function dateOnly(value: Date | string | null): string | null {
  if (!value) return null;
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
}

function numeric(value: string | number): number {
  return typeof value === 'number' ? value : Number(value);
}

function actor(user: AuthUser): string {
  return user.name ?? user.email ?? 'User';
}

function cleanOptional(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

function cleanTitle(value: string, entity = 'Task'): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new GraphQLError(`${entity} title is required.`, { extensions: { code: 'BAD_USER_INPUT' } });
  }
  if (trimmed.length > 120) {
    throw new GraphQLError(`${entity} title must be 120 characters or fewer.`, { extensions: { code: 'BAD_USER_INPUT' } });
  }
  return trimmed;
}

function cleanPriority(value: number | null | undefined): number {
  const priority = value ?? 2;
  if (!Number.isInteger(priority) || priority < 1 || priority > 5) {
    throw new GraphQLError('Task priority must be an integer from 1 to 5.', { extensions: { code: 'BAD_USER_INPUT' } });
  }
  return priority;
}

function cleanColor(value: string | null | undefined): string | null {
  const cleaned = cleanOptional(value);
  if (!cleaned) return null;
  if (!/^#[0-9a-f]{6}$/i.test(cleaned)) {
    throw new GraphQLError('Color must be a six-digit hex value.', { extensions: { code: 'BAD_USER_INPUT' } });
  }
  return cleaned;
}

function toBoard(row: BoardRow): Board {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    background: row.background,
    version: row.version,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

function toList(row: ListRow): TaskList {
  return {
    id: row.id,
    boardId: row.board_id,
    title: row.title,
    status: row.status,
    position: numeric(row.position),
    archived: row.archived,
    version: row.version,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

function toTask(row: TaskRow): Task {
  return {
    id: row.id,
    boardId: row.board_id,
    listId: row.list_id,
    title: row.title,
    description: row.description,
    status: row.status,
    priority: row.priority,
    assignee: row.assignee,
    position: numeric(row.position),
    dueDate: dateOnly(row.due_date),
    coverColor: row.cover_color,
    archived: row.archived,
    version: row.version,
    updatedAt: iso(row.updated_at),
  };
}

function toLabel(row: LabelRow): Label {
  return { id: row.id, boardId: row.board_id, name: row.name, color: row.color };
}

function toChecklist(row: ChecklistRow): ChecklistItem {
  return {
    id: row.id,
    taskId: row.task_id,
    text: row.text,
    checked: row.checked,
    position: numeric(row.position),
  };
}

function toComment(row: CommentRow): TaskComment {
  return {
    id: row.id,
    taskId: row.task_id,
    body: row.body,
    author: row.author,
    createdAt: iso(row.created_at),
  };
}

function toActivity(row: ActivityRow): ActivityItem {
  return {
    id: row.id,
    taskId: row.task_id,
    type: row.type,
    message: row.message,
    actor: row.actor,
    createdAt: iso(row.created_at),
  };
}

async function recordActivity(db: DbClient, boardId: string, taskId: string | null, type: string, message: string, user: AuthUser): Promise<ActivityItem> {
  const displayActor = actor(user);
  const recent = await db.query<ActivityRow>(
    `
      SELECT id, task_id, type, message, actor, created_at
      FROM task_activity
      WHERE board_id = $1
        AND ($2::uuid IS NULL OR task_id = $2::uuid)
        AND type = $3
        AND actor = $4
        AND message = $5
        AND created_at > now() - interval '60 seconds'
      ORDER BY created_at DESC
      LIMIT 1
    `,
    [boardId, taskId, type, displayActor, message],
  );
  if (recent.rows[0]) {
    return toActivity(recent.rows[0]);
  }

  const result = await db.query<ActivityRow>(
    `
      INSERT INTO task_activity (board_id, task_id, type, message, actor)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, task_id, type, message, actor, created_at
    `,
    [boardId, taskId, type, message, displayActor],
  );
  return toActivity(result.rows[0]);
}

export async function listBoards(db: DbClient): Promise<Board[]> {
  const result = await db.query<BoardRow>(
    'SELECT id, title, description, background, version, created_at, updated_at FROM boards ORDER BY updated_at DESC',
  );
  return result.rows.map(toBoard);
}

export async function getBoard(db: DbClient, id: string): Promise<Board | null> {
  const result = await db.query<BoardRow>(
    'SELECT id, title, description, background, version, created_at, updated_at FROM boards WHERE id = $1',
    [id],
  );
  return result.rows[0] ? toBoard(result.rows[0]) : null;
}

export async function getDefaultBoard(db: DbClient): Promise<Board | null> {
  const result = await db.query<BoardRow>(
    'SELECT id, title, description, background, version, created_at, updated_at FROM boards ORDER BY created_at ASC LIMIT 1',
  );
  return result.rows[0] ? toBoard(result.rows[0]) : null;
}

export async function getBoardView(db: DbClient, boardId: string): Promise<BoardView | null> {
  const board = await getBoard(db, boardId);
  if (!board) return null;

  const listsResult = await db.query<ListRow>(
    'SELECT id, board_id, title, status, position, archived, version, created_at, updated_at FROM task_lists WHERE board_id = $1 AND archived = false ORDER BY position ASC, created_at ASC',
    [boardId],
  );
  const tasksResult = await db.query<TaskRow>(
    `
      SELECT id, board_id, list_id, title, description, status, priority, assignee, position, due_date, cover_color, archived, version, updated_at
      FROM tasks
      WHERE board_id = $1 AND archived = false
      ORDER BY position ASC, updated_at DESC
    `,
    [boardId],
  );
  const labelsResult = await db.query<LabelRow>('SELECT id, board_id, name, color FROM labels WHERE board_id = $1 ORDER BY name ASC, id ASC', [boardId]);
  const taskLabelsResult = await db.query<{ task_id: string; label_id: string }>(
    `
      SELECT tl.task_id, tl.label_id
      FROM task_labels tl
      JOIN tasks t ON t.id = tl.task_id
      WHERE t.board_id = $1
    `,
    [boardId],
  );
  const checklistResult = await db.query<ChecklistRow>(
    `
      SELECT ci.id, ci.task_id, ci.text, ci.checked, ci.position
      FROM checklist_items ci
      JOIN tasks t ON t.id = ci.task_id
      WHERE t.board_id = $1
      ORDER BY ci.position ASC, ci.created_at ASC
    `,
    [boardId],
  );
  const commentsResult = await db.query<CommentRow>(
    `
      SELECT tc.id, tc.task_id, tc.body, tc.author, tc.created_at
      FROM task_comments tc
      JOIN tasks t ON t.id = tc.task_id
      WHERE t.board_id = $1
      ORDER BY tc.created_at DESC
    `,
    [boardId],
  );
  const activityResult = await db.query<ActivityRow>(
    'SELECT id, task_id, type, message, actor, created_at FROM task_activity WHERE board_id = $1 ORDER BY created_at DESC LIMIT 100',
    [boardId],
  );

  const labels = labelsResult.rows.map(toLabel);
  const labelsById = new Map(labels.map((label) => [label.id, label]));
  const labelIdsByTask = new Map<string, string[]>();
  for (const row of taskLabelsResult.rows) {
    labelIdsByTask.set(row.task_id, [...(labelIdsByTask.get(row.task_id) ?? []), row.label_id]);
  }

  const checklistByTask = groupBy(checklistResult.rows.map(toChecklist), (item) => item.taskId);
  const commentsByTask = groupBy(commentsResult.rows.map(toComment), (comment) => comment.taskId);
  const cards = tasksResult.rows.map((row): BoardCard => {
    const task = toTask(row);
    return {
      ...task,
      labels: (labelIdsByTask.get(task.id) ?? []).map((id) => labelsById.get(id)).filter((label): label is Label => Boolean(label)),
      checklist: checklistByTask.get(task.id) ?? [],
      comments: commentsByTask.get(task.id) ?? [],
    };
  });
  const cardsByList = groupBy(cards, (card) => card.listId);

  return {
    board,
    labels,
    activity: activityResult.rows.map(toActivity),
    lists: listsResult.rows.map((row): BoardList => {
      const list = toList(row);
      return { ...list, cards: cardsByList.get(list.id) ?? [] };
    }),
  };
}

function groupBy<T>(items: T[], key: (item: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const groupKey = key(item);
    groups.set(groupKey, [...(groups.get(groupKey) ?? []), item]);
  }
  return groups;
}

function listWhere(filter: TaskFilterInput | null | undefined): { sql: string; values: unknown[] } {
  const clauses = ['archived = false'];
  const values: unknown[] = [];

  if (filter?.status) {
    values.push(filter.status);
    clauses.push(`status = $${values.length}`);
  }
  const search = filter?.search?.trim();
  if (search) {
    values.push(search);
    const param = `$${values.length}`;
    clauses.push(`(
      title ILIKE '%' || ${param} || '%'
      OR coalesce(description, '') ILIKE '%' || ${param} || '%'
      OR coalesce(assignee, '') ILIKE '%' || ${param} || '%'
    )`);
  }

  return { sql: `WHERE ${clauses.join(' AND ')}`, values };
}

function orderBy(sort: TaskSortInput[] | null | undefined): string {
  const rules = sort?.length ? sort : [{ field: 'position', direction: SortDirection.ASC }];
  const clauses = rules.map((rule) => {
    const column = SORT_FIELDS[rule.field] ?? SORT_FIELDS.position;
    const direction = rule.direction === SortDirection.DESC ? 'DESC' : 'ASC';
    return `${column} ${direction} NULLS LAST`;
  });
  return `ORDER BY ${clauses.join(', ')}, id ASC`;
}

export async function listTasks(
  db: DbClient,
  page: number,
  pageSize: number,
  filter?: TaskFilterInput | null,
  sort?: TaskSortInput[] | null,
): Promise<TaskListResult> {
  const safePage = Math.max(1, page);
  const safePageSize = Math.min(100, Math.max(1, pageSize));
  const offset = (safePage - 1) * safePageSize;
  const where = listWhere(filter);
  const count = await db.query<{ count: string }>(`SELECT count(*)::text AS count FROM tasks ${where.sql}`, where.values);
  const rows = await db.query<TaskRow>(
    `
      SELECT id, board_id, list_id, title, description, status, priority, assignee, position, due_date, cover_color, archived, version, updated_at
      FROM tasks
      ${where.sql}
      ${orderBy(sort)}
      LIMIT $${where.values.length + 1}
      OFFSET $${where.values.length + 2}
    `,
    [...where.values, safePageSize, offset],
  );
  return { nodes: rows.rows.map(toTask), totalCount: Number(count.rows[0]?.count ?? 0) };
}

export async function getTask(db: DbClient, id: string): Promise<Task | null> {
  const result = await db.query<TaskRow>(
    `
      SELECT id, board_id, list_id, title, description, status, priority, assignee, position, due_date, cover_color, archived, version, updated_at
      FROM tasks
      WHERE id = $1
    `,
    [id],
  );
  return result.rows[0] ? toTask(result.rows[0]) : null;
}

async function resolveCreateTarget(db: DbClient, input: CreateTaskInput): Promise<{ boardId: string; listId: string; status: TaskStatus; position: number }> {
  const boardId = input.boardId ?? (await getDefaultBoard(db))?.id;
  if (!boardId) {
    throw new GraphQLError('A board is required before creating cards.', { extensions: { code: 'BAD_USER_INPUT' } });
  }
  const listResult = await db.query<ListRow>(
    `
      SELECT id, board_id, title, status, position, archived, version, created_at, updated_at
      FROM task_lists
      WHERE board_id = $1 AND archived = false AND ($2::uuid IS NULL OR id = $2::uuid)
      ORDER BY position ASC
      LIMIT 1
    `,
    [boardId, input.listId ?? null],
  );
  const list = listResult.rows[0] ? toList(listResult.rows[0]) : null;
  if (!list) {
    throw new GraphQLError('Target list was not found.', { extensions: { code: 'BAD_USER_INPUT' } });
  }
  const positionResult = await db.query<{ next_position: string }>(
    'SELECT coalesce(max(position), 0) + 1024 AS next_position FROM tasks WHERE list_id = $1 AND archived = false',
    [list.id],
  );
  return {
    boardId,
    listId: list.id,
    status: input.status ?? list.status ?? TaskStatus.TODO,
    position: input.position ?? Number(positionResult.rows[0]?.next_position ?? 1024),
  };
}

export async function createTask(db: DbClient, input: CreateTaskInput, user: AuthUser): Promise<Task> {
  const target = await resolveCreateTarget(db, input);
  const result = await db.query<TaskRow>(
    `
      INSERT INTO tasks (board_id, list_id, title, description, status, priority, assignee, position, due_date, cover_color, updated_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING id, board_id, list_id, title, description, status, priority, assignee, position, due_date, cover_color, archived, version, updated_at
    `,
    [
      target.boardId,
      target.listId,
      cleanTitle(input.title),
      cleanOptional(input.description),
      target.status,
      cleanPriority(input.priority),
      cleanOptional(input.assignee),
      target.position,
      input.dueDate ?? null,
      cleanColor(input.coverColor),
      actor(user),
    ],
  );
  const task = toTask(result.rows[0]);
  await recordActivity(db, task.boardId, task.id, 'CARD_CREATED', `created "${task.title}"`, user);
  return task;
}

export async function updateTask(
  db: DbClient,
  id: string,
  input: UpdateTaskInput,
  expectedVersion: number | null | undefined,
  user: AuthUser,
): Promise<TaskMutationResult> {
  const sets: string[] = [];
  const values: unknown[] = [];

  if (input.listId !== undefined) {
    values.push(input.listId);
    sets.push(`list_id = $${values.length}`);
  }
  if (input.title !== undefined) {
    values.push(cleanTitle(input.title));
    sets.push(`title = $${values.length}`);
  }
  if (input.description !== undefined) {
    values.push(cleanOptional(input.description));
    sets.push(`description = $${values.length}`);
  }
  if (input.status !== undefined) {
    values.push(input.status);
    sets.push(`status = $${values.length}`);
  }
  if (input.priority !== undefined) {
    values.push(cleanPriority(input.priority));
    sets.push(`priority = $${values.length}`);
  }
  if (input.assignee !== undefined) {
    values.push(cleanOptional(input.assignee));
    sets.push(`assignee = $${values.length}`);
  }
  if (input.position !== undefined) {
    values.push(input.position);
    sets.push(`position = $${values.length}`);
  }
  if (input.dueDate !== undefined) {
    values.push(input.dueDate);
    sets.push(`due_date = $${values.length}`);
  }
  if (input.coverColor !== undefined) {
    values.push(cleanColor(input.coverColor));
    sets.push(`cover_color = $${values.length}`);
  }
  if (input.archived !== undefined && input.archived !== null) {
    values.push(input.archived);
    sets.push(`archived = $${values.length}`);
  }

  if (!sets.length) return { task: await getTask(db, id), conflict: false };

  values.push(actor(user));
  sets.push(`updated_by = $${values.length}`, 'version = version + 1', 'updated_at = now()');
  values.push(id);
  let where = `id = $${values.length}`;
  if (expectedVersion != null) {
    values.push(expectedVersion);
    where += ` AND version = $${values.length}`;
  }

  const result = await db.query<TaskRow>(
    `
      UPDATE tasks
      SET ${sets.join(', ')}
      WHERE ${where}
      RETURNING id, board_id, list_id, title, description, status, priority, assignee, position, due_date, cover_color, archived, version, updated_at
    `,
    values,
  );
  if (result.rows[0]) {
    const task = toTask(result.rows[0]);
    await recordActivity(db, task.boardId, task.id, input.archived ? 'CARD_ARCHIVED' : 'CARD_UPDATED', `updated "${task.title}"`, user);
    return { task, conflict: false };
  }
  const current = await getTask(db, id);
  return { task: current, conflict: Boolean(current && expectedVersion != null) };
}

export async function moveTask(db: DbClient, input: MoveTaskInput, user: AuthUser): Promise<TaskMutationResult> {
  const list = await getList(db, input.toListId);
  if (!list || list.boardId !== input.boardId) {
    throw new GraphQLError('Target list was not found.', { extensions: { code: 'BAD_USER_INPUT' } });
  }
  return updateTask(
    db,
    input.taskId,
    {
      listId: input.toListId,
      position: input.position,
      status: input.status ?? list.status ?? undefined,
    },
    input.expectedVersion,
    user,
  );
}

export async function deleteTask(db: DbClient, id: string, expectedVersion?: number | null): Promise<TaskMutationResult> {
  return updateTask(db, id, { archived: true }, expectedVersion, { id: 'system', name: 'System', email: null });
}

export async function createBoard(db: DbClient, input: CreateBoardInput, user: AuthUser): Promise<Board> {
  const result = await db.query<BoardRow>(
    `
      INSERT INTO boards (title, description, background, updated_by)
      VALUES ($1, $2, $3, $4)
      RETURNING id, title, description, background, version, created_at, updated_at
    `,
    [
      cleanTitle(input.title, 'Board'),
      cleanOptional(input.description),
      cleanOptional(input.background) ?? 'linear-gradient(135deg, #0c66e4 0%, #5e4db2 100%)',
      actor(user),
    ],
  );
  return toBoard(result.rows[0]);
}

export async function updateBoard(db: DbClient, id: string, input: UpdateBoardInput, expectedVersion: number | null | undefined, user: AuthUser): Promise<BoardMutationResult> {
  const sets: string[] = [];
  const values: unknown[] = [];
  if (input.title != null) {
    values.push(cleanTitle(input.title, 'Board'));
    sets.push(`title = $${values.length}`);
  }
  if (input.description !== undefined) {
    values.push(cleanOptional(input.description));
    sets.push(`description = $${values.length}`);
  }
  if (input.background !== undefined) {
    values.push(cleanOptional(input.background) ?? 'linear-gradient(135deg, #0c66e4 0%, #5e4db2 100%)');
    sets.push(`background = $${values.length}`);
  }
  if (!sets.length) return { board: await getBoard(db, id), conflict: false };
  values.push(actor(user));
  sets.push(`updated_by = $${values.length}`, 'version = version + 1', 'updated_at = now()');
  values.push(id);
  let where = `id = $${values.length}`;
  if (expectedVersion != null) {
    values.push(expectedVersion);
    where += ` AND version = $${values.length}`;
  }
  const result = await db.query<BoardRow>(
    `UPDATE boards SET ${sets.join(', ')} WHERE ${where} RETURNING id, title, description, background, version, created_at, updated_at`,
    values,
  );
  if (result.rows[0]) return { board: toBoard(result.rows[0]), conflict: false };
  return { board: await getBoard(db, id), conflict: expectedVersion != null };
}

export async function getList(db: DbClient, id: string): Promise<TaskList | null> {
  const result = await db.query<ListRow>(
    'SELECT id, board_id, title, status, position, archived, version, created_at, updated_at FROM task_lists WHERE id = $1',
    [id],
  );
  return result.rows[0] ? toList(result.rows[0]) : null;
}

export async function createList(db: DbClient, input: CreateListInput, user: AuthUser): Promise<TaskList> {
  const positionResult = await db.query<{ next_position: string }>(
    'SELECT coalesce(max(position), 0) + 1024 AS next_position FROM task_lists WHERE board_id = $1 AND archived = false',
    [input.boardId],
  );
  const result = await db.query<ListRow>(
    `
      INSERT INTO task_lists (board_id, title, status, position, updated_by)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, board_id, title, status, position, archived, version, created_at, updated_at
    `,
    [input.boardId, cleanTitle(input.title, 'List'), input.status ?? null, input.position ?? Number(positionResult.rows[0]?.next_position ?? 1024), actor(user)],
  );
  const list = toList(result.rows[0]);
  await recordActivity(db, input.boardId, null, 'LIST_CREATED', `created list "${list.title}"`, user);
  return list;
}

export async function updateList(db: DbClient, id: string, input: UpdateListInput, expectedVersion: number | null | undefined, user: AuthUser): Promise<ListMutationResult> {
  const sets: string[] = [];
  const values: unknown[] = [];
  if (input.title != null) {
    values.push(cleanTitle(input.title, 'List'));
    sets.push(`title = $${values.length}`);
  }
  if (input.status !== undefined) {
    values.push(input.status);
    sets.push(`status = $${values.length}`);
  }
  if (input.position !== undefined) {
    values.push(input.position);
    sets.push(`position = $${values.length}`);
  }
  if (input.archived !== undefined && input.archived !== null) {
    values.push(input.archived);
    sets.push(`archived = $${values.length}`);
  }
  if (!sets.length) return { list: await getList(db, id), conflict: false };
  values.push(actor(user));
  sets.push(`updated_by = $${values.length}`, 'version = version + 1', 'updated_at = now()');
  values.push(id);
  let where = `id = $${values.length}`;
  if (expectedVersion != null) {
    values.push(expectedVersion);
    where += ` AND version = $${values.length}`;
  }
  const result = await db.query<ListRow>(
    `UPDATE task_lists SET ${sets.join(', ')} WHERE ${where} RETURNING id, board_id, title, status, position, archived, version, created_at, updated_at`,
    values,
  );
  if (result.rows[0]) {
    const list = toList(result.rows[0]);
    await recordActivity(db, list.boardId, null, list.archived ? 'LIST_ARCHIVED' : 'LIST_UPDATED', `updated list "${list.title}"`, user);
    return { list, conflict: false };
  }
  return { list: await getList(db, id), conflict: expectedVersion != null };
}

export async function createLabel(db: DbClient, boardId: string, name: string | null | undefined, color: string, user: AuthUser): Promise<Label> {
  const result = await db.query<LabelRow>(
    'INSERT INTO labels (board_id, name, color) VALUES ($1, $2, $3) RETURNING id, board_id, name, color',
    [boardId, cleanOptional(name) ?? '', cleanColor(color)],
  );
  await recordActivity(db, boardId, null, 'LABEL_UPDATED', 'created a label', user);
  return toLabel(result.rows[0]);
}

export async function setTaskLabels(db: DbClient, taskId: string, labelIds: string[], user: AuthUser): Promise<Task | null> {
  const task = await getTask(db, taskId);
  if (!task) return null;
  await db.query('DELETE FROM task_labels WHERE task_id = $1', [taskId]);
  for (const labelId of labelIds) {
    await db.query('INSERT INTO task_labels (task_id, label_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [taskId, labelId]);
  }
  await recordActivity(db, task.boardId, taskId, 'LABEL_UPDATED', `updated labels on "${task.title}"`, user);
  return task;
}

export async function createChecklistItem(db: DbClient, taskId: string, text: string, user: AuthUser): Promise<ChecklistItem> {
  const task = await getTask(db, taskId);
  if (!task) throw new GraphQLError('Task not found.', { extensions: { code: 'BAD_USER_INPUT' } });
  const position = await db.query<{ next_position: string }>(
    'SELECT coalesce(max(position), 0) + 1024 AS next_position FROM checklist_items WHERE task_id = $1',
    [taskId],
  );
  const result = await db.query<ChecklistRow>(
    'INSERT INTO checklist_items (task_id, text, position) VALUES ($1, $2, $3) RETURNING id, task_id, text, checked, position',
    [taskId, cleanTitle(text, 'Checklist item'), Number(position.rows[0]?.next_position ?? 1024)],
  );
  await recordActivity(db, task.boardId, taskId, 'CHECKLIST_UPDATED', `added a checklist item to "${task.title}"`, user);
  return toChecklist(result.rows[0]);
}

export async function updateChecklistItem(db: DbClient, id: string, text: string | null | undefined, checked: boolean | null | undefined, user: AuthUser): Promise<ChecklistItem | null> {
  const current = await db.query<{ task_id: string; board_id: string; title: string }>(
    'SELECT ci.task_id, t.board_id, t.title FROM checklist_items ci JOIN tasks t ON t.id = ci.task_id WHERE ci.id = $1',
    [id],
  );
  if (!current.rows[0]) return null;
  const sets: string[] = [];
  const values: unknown[] = [];
  if (text != null) {
    values.push(cleanTitle(text, 'Checklist item'));
    sets.push(`text = $${values.length}`);
  }
  if (checked != null) {
    values.push(checked);
    sets.push(`checked = $${values.length}`);
  }
  if (!sets.length) return null;
  values.push(id);
  const result = await db.query<ChecklistRow>(
    `UPDATE checklist_items SET ${sets.join(', ')} WHERE id = $${values.length} RETURNING id, task_id, text, checked, position`,
    values,
  );
  await recordActivity(db, current.rows[0].board_id, current.rows[0].task_id, 'CHECKLIST_UPDATED', `updated checklist on "${current.rows[0].title}"`, user);
  return result.rows[0] ? toChecklist(result.rows[0]) : null;
}

export async function addComment(db: DbClient, taskId: string, body: string, user: AuthUser): Promise<TaskComment> {
  const task = await getTask(db, taskId);
  if (!task) throw new GraphQLError('Task not found.', { extensions: { code: 'BAD_USER_INPUT' } });
  const result = await db.query<CommentRow>(
    'INSERT INTO task_comments (task_id, body, author) VALUES ($1, $2, $3) RETURNING id, task_id, body, author, created_at',
    [taskId, cleanTitle(body, 'Comment'), actor(user)],
  );
  const comment = toComment(result.rows[0]);
  await recordActivity(db, task.boardId, taskId, 'COMMENT_CREATED', `commented on "${task.title}"`, user);
  return comment;
}
