import { BoardEventType, TaskStatus } from '../../../graphql/generated/graphql';
import {
  BoardCardModel,
  BoardEventModel,
  BoardListModel,
  BoardViewModel,
} from '../models/board.types';

type TaskPayload = NonNullable<BoardEventModel['task']>;
type ListPayload = NonNullable<BoardEventModel['list']>;
type LabelPayload = NonNullable<BoardEventModel['label']>;
type CommentPayload = NonNullable<BoardEventModel['comment']>;
type ChecklistPayload = NonNullable<BoardEventModel['checklistItem']>;

export function applyBoardEvent(view: BoardViewModel | null, event: BoardEventModel): BoardViewModel | null {
  if (!view || event.boardId !== view.board.id) return view;

  switch (event.type) {
    case BoardEventType.BoardUpdated:
      return view;
    case BoardEventType.ListCreated:
      return event.list ? applyListCreated(view, event.list) : view;
    case BoardEventType.ListUpdated:
      return event.list ? applyListUpdated(view, event.list) : view;
    case BoardEventType.ListArchived:
      return event.list ? applyListArchived(view, event.list.id) : view;
    case BoardEventType.CardCreated:
      return event.task ? applyCardCreated(view, event.task) : view;
    case BoardEventType.CardUpdated:
      return event.task ? applyCardUpdated(view, event.task) : view;
    case BoardEventType.CardMoved:
      return event.task ? applyCardMoved(view, event.task) : view;
    case BoardEventType.CardArchived:
    case BoardEventType.CardDeleted:
      return event.task ? applyCardRemoved(view, event.task.id) : view;
    case BoardEventType.CommentCreated:
      return applyCommentCreated(view, event.task, event.comment, event.activity);
    case BoardEventType.ChecklistUpdated:
      return applyChecklistUpdated(view, event.task, event.checklistItem);
    case BoardEventType.LabelUpdated:
      return applyLabelUpdated(view, event.label, event.task);
    default:
      return view;
  }
}

export function taskToCard(task: TaskPayload, existing?: BoardCardModel): BoardCardModel {
  return {
    __typename: 'BoardCard',
    id: task.id,
    boardId: task.boardId,
    listId: task.listId,
    title: task.title,
    description: task.description ?? null,
    status: task.status,
    priority: task.priority,
    assignee: task.assignee ?? null,
    position: task.position,
    dueDate: task.dueDate ?? null,
    coverColor: task.coverColor ?? null,
    archived: task.archived,
    version: task.version,
    updatedAt: task.updatedAt,
    labels: existing?.labels ?? [],
    checklist: existing?.checklist ?? [],
    comments: existing?.comments ?? [],
  };
}

export function applyListCreated(view: BoardViewModel, list: ListPayload): BoardViewModel {
  if (view.lists.some((candidate) => candidate.id === list.id)) return view;
  const entry: BoardListModel = {
    __typename: 'BoardList',
    id: list.id,
    boardId: list.boardId,
    title: list.title,
    status: list.status ?? null,
    position: list.position,
    archived: list.archived,
    version: list.version,
    createdAt: list.createdAt,
    updatedAt: list.updatedAt,
    cards: [],
  };
  return { ...view, lists: sortLists([...view.lists, entry]) };
}

export function applyListUpdated(view: BoardViewModel, list: ListPayload): BoardViewModel {
  return {
    ...view,
    lists: sortLists(
      view.lists.map((candidate) =>
        candidate.id === list.id
          ? {
              ...candidate,
              title: list.title,
              status: list.status ?? candidate.status,
              position: list.position,
              archived: list.archived,
              version: list.version,
              updatedAt: list.updatedAt,
            }
          : candidate,
      ),
    ),
  };
}

export function applyListArchived(view: BoardViewModel, listId: string): BoardViewModel {
  return { ...view, lists: view.lists.filter((list) => list.id !== listId) };
}

export function applyCardCreated(view: BoardViewModel, task: TaskPayload): BoardViewModel {
  if (findCard(view, task.id)) return applyCardUpdated(view, task);
  return patchListsForCard(view, task, (cards) => insertCardByPosition(cards, taskToCard(task)));
}

export function applyCardUpdated(view: BoardViewModel, task: TaskPayload): BoardViewModel {
  const existing = findCard(view, task.id);
  if (!existing) return applyCardCreated(view, task);
  const updated = taskToCard(task, existing);
  if (existing.listId !== task.listId) {
    return applyCardMoved(view, task);
  }
  return patchCard(view, task.id, () => updated);
}

export function applyCardMoved(view: BoardViewModel, task: TaskPayload): BoardViewModel {
  const existing = findCard(view, task.id);
  const card = taskToCard(task, existing ?? undefined);
  return {
    ...view,
    lists: sortLists(
      view.lists.map((list) => {
        const without = list.cards.filter((candidate) => candidate.id !== task.id);
        if (list.id === task.listId) {
          return { ...list, cards: insertCardByPosition(without, card) };
        }
        return { ...list, cards: without };
      }),
    ),
  };
}

export function applyCardRemoved(view: BoardViewModel, taskId: string): BoardViewModel {
  return {
    ...view,
    lists: view.lists.map((list) => ({ ...list, cards: list.cards.filter((card) => card.id !== taskId) })),
  };
}

export function applyCommentCreated(
  view: BoardViewModel,
  task: BoardEventModel['task'],
  comment: BoardEventModel['comment'],
  activity: BoardEventModel['activity'],
): BoardViewModel {
  let next = view;
  if (comment && task?.id) {
    next = patchCard(next, task.id, (card) => ({
      ...card,
      comments: card.comments.some((item) => item.id === comment.id) ? card.comments : [comment, ...card.comments],
    }));
  }
  if (activity) {
    next = {
      ...next,
      activity: next.activity.some((item) => item.id === activity.id) ? next.activity : [activity, ...next.activity].slice(0, 100),
    };
  }
  if (task) {
    next = applyCardUpdated(next, task);
  }
  return next;
}

export function applyChecklistUpdated(
  view: BoardViewModel,
  task: BoardEventModel['task'],
  checklistItem: BoardEventModel['checklistItem'],
): BoardViewModel {
  if (!checklistItem) {
    return task ? applyCardUpdated(view, task) : view;
  }
  let next = patchCard(view, checklistItem.taskId, (card) => ({
    ...card,
    checklist: upsertChecklistItem(card.checklist, checklistItem),
  }));
  if (task) {
    next = applyCardUpdated(next, task);
  }
  return next;
}

export function applyLabelUpdated(
  view: BoardViewModel,
  label: BoardEventModel['label'],
  task: BoardEventModel['task'],
): BoardViewModel {
  let next = view;
  if (label) {
    const labels = view.labels.some((item) => item.id === label.id)
      ? view.labels.map((item) => (item.id === label.id ? label : item))
      : [...view.labels, label];
    next = { ...next, labels };
  }
  if (task) {
    next = applyCardUpdated(next, task);
  }
  return next;
}

export function reconcileCreatedCard(view: BoardViewModel, task: TaskPayload, tempListId?: string): BoardViewModel {
  let tempId: string | null = null;
  const lists = view.lists.map((list) => {
    if (list.id !== task.listId) return list;
    let replaced = false;
    const cards = list.cards.map((card) => {
      if (!replaced && card.id.startsWith('temp-')) {
        replaced = true;
        tempId = card.id;
        return taskToCard(task, card);
      }
      return card;
    });
    if (!replaced && !cards.some((card) => card.id === task.id)) {
      return { ...list, cards: insertCardByPosition(cards, taskToCard(task)) };
    }
    return { ...list, cards: sortCards(cards) };
  });
  return { ...view, lists };
}

export function reconcileTask(view: BoardViewModel, task: TaskPayload): BoardViewModel {
  const existing = findCard(view, task.id);
  if (!existing) return applyCardCreated(view, task);
  if (existing.listId !== task.listId) return applyCardMoved(view, task);
  return applyCardUpdated(view, task);
}

export function applyChecklistItem(view: BoardViewModel, item: ChecklistPayload): BoardViewModel {
  return patchCard(view, item.taskId, (card) => ({
    ...card,
    checklist: upsertChecklistItem(card.checklist, item),
  }));
}

export function applyComment(view: BoardViewModel, comment: CommentPayload): BoardViewModel {
  return patchCard(view, comment.taskId, (card) => ({
    ...card,
    comments: card.comments.some((item) => item.id === comment.id) ? card.comments : [comment, ...card.comments],
  }));
}

function findCard(view: BoardViewModel, taskId: string): BoardCardModel | undefined {
  for (const list of view.lists) {
    const card = list.cards.find((candidate) => candidate.id === taskId);
    if (card) return card;
  }
  return undefined;
}

function patchListsForCard(
  view: BoardViewModel,
  task: TaskPayload,
  transform: (cards: BoardCardModel[]) => BoardCardModel[],
): BoardViewModel {
  return {
    ...view,
    lists: sortLists(
      view.lists.map((list) => {
        const without = list.cards.filter((card) => card.id !== task.id);
        if (list.id === task.listId) {
          return { ...list, cards: transform(without) };
        }
        return { ...list, cards: without };
      }),
    ),
  };
}

function patchCard(view: BoardViewModel, taskId: string, transform: (card: BoardCardModel) => BoardCardModel): BoardViewModel {
  return {
    ...view,
    lists: view.lists.map((list) => ({
      ...list,
      cards: list.cards.map((card) => (card.id === taskId ? transform(card) : card)),
    })),
  };
}

function upsertChecklistItem(
  checklist: BoardCardModel['checklist'],
  item: ChecklistPayload,
): BoardCardModel['checklist'] {
  const next = checklist.some((entry) => entry.id === item.id)
    ? checklist.map((entry) => (entry.id === item.id ? item : entry))
    : [...checklist, item];
  return [...next].sort((a, b) => a.position - b.position || a.id.localeCompare(b.id));
}

function insertCardByPosition(cards: BoardCardModel[], card: BoardCardModel): BoardCardModel[] {
  return sortCards([...cards.filter((candidate) => candidate.id !== card.id), card]);
}

function sortLists(lists: BoardListModel[]): BoardListModel[] {
  return [...lists].sort((a, b) => a.position - b.position || a.id.localeCompare(b.id));
}

function sortCards(cards: BoardCardModel[]): BoardCardModel[] {
  return [...cards].sort((a, b) => a.position - b.position || a.id.localeCompare(b.id));
}

export function defaultCardStatus(list: BoardListModel): TaskStatus {
  return list.status ?? TaskStatus.Todo;
}
