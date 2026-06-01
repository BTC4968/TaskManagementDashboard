import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Apollo } from 'apollo-angular';
import { map } from 'rxjs';
import { ToastService } from '../../../core/toast/toast.service';
import {
  AddCommentDocument,
  BoardChangedDocument,
  BoardChangedSubscription,
  BoardChangedSubscriptionVariables,
  BoardEventType,
  BoardViewDocument,
  BoardViewQuery,
  BoardViewQueryVariables,
  CreateChecklistItemDocument,
  CreateChecklistItemMutation,
  CreateChecklistItemMutationVariables,
  CreateListDocument,
  CreateListMutation,
  CreateListMutationVariables,
  CreateTaskDocument,
  CreateTaskMutation,
  CreateTaskMutationVariables,
  DefaultBoardDocument,
  DefaultBoardQuery,
  DeleteTaskDocument,
  DeleteTaskMutation,
  DeleteTaskMutationVariables,
  MoveTaskDocument,
  MoveTaskMutation,
  MoveTaskMutationVariables,
  SimulateNetworkFailureDocument,
  TaskStatus,
  UpdateChecklistItemDocument,
  UpdateChecklistItemMutation,
  UpdateChecklistItemMutationVariables,
  UpdateListDocument,
  UpdateListMutation,
  UpdateListMutationVariables,
  UpdateTaskDocument,
  UpdateTaskMutation,
  UpdateTaskMutationVariables,
  AddCommentMutation,
  AddCommentMutationVariables,
} from '../../../graphql/generated/graphql';
import { BoardCardModel, BoardListModel, BoardViewModel, CardConflict, CardMoveRequest, ListMoveRequest } from '../models/board.types';

type CardUpdateInput = Partial<Pick<BoardCardModel, 'title' | 'description' | 'priority' | 'assignee' | 'dueDate' | 'coverColor'>>;

@Injectable()
export class BoardFacade {
  private readonly apollo = inject(Apollo);
  private readonly destroyRef = inject(DestroyRef);
  private readonly toast = inject(ToastService);

  readonly loading = signal(true);
  readonly boardId = signal<string | null>(null);
  readonly view = signal<BoardViewModel | null>(null);
  readonly selectedCardId = signal<string | null>(null);
  readonly conflicts = signal<CardConflict[]>([]);

  readonly board = computed(() => this.view()?.board ?? null);
  readonly lists = computed(() => this.view()?.lists ?? []);
  readonly selectedCard = computed(() => {
    const id = this.selectedCardId();
    if (!id) return null;
    return this.lists().flatMap((list) => list.cards).find((card) => card.id === id) ?? null;
  });

  private subscriptionStartedFor: string | null = null;
  private readonly pendingMutationIds = new Set<string>();
  private readonly pendingTaskIds = new Set<string>();

  init(): void {
    this.apollo
      .query<DefaultBoardQuery>({ query: DefaultBoardDocument, fetchPolicy: 'network-only' })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ data }) => {
          const id = data.defaultBoard?.id;
          if (!id) {
            this.loading.set(false);
            this.toast.error('No board is available.');
            return;
          }
          this.boardId.set(id);
          this.watchBoard(id);
          this.startSubscription(id);
        },
        error: () => {
          this.loading.set(false);
          this.toast.error('Unable to load the board.');
        },
      });
  }

  createList(title: string): void {
    const boardId = this.boardId();
    if (!boardId || !title.trim()) return;
    const snapshot = this.view();
    this.apollo
      .mutate<CreateListMutation, CreateListMutationVariables>({ mutation: CreateListDocument, variables: { input: { boardId, title: title.trim() } } })
      .subscribe({
        next: () => this.refetchBoard(),
        error: () => this.rollback(snapshot, 'List creation failed.'),
      });
  }

  createCard(list: BoardListModel, title: string): void {
    const cleaned = title.trim();
    if (!cleaned) return;
    const snapshot = this.view();
    const optimistic = this.addLocalCard(snapshot, list, cleaned);
    if (optimistic) this.view.set(optimistic);

    this.apollo
      .mutate<CreateTaskMutation, CreateTaskMutationVariables>({
        mutation: CreateTaskDocument,
        variables: {
          input: {
            boardId: list.boardId,
            listId: list.id,
            title: cleaned,
            status: list.status ?? TaskStatus.Todo,
            priority: 2,
          },
        },
      })
      .subscribe({
        next: () => this.refetchBoard(),
        error: () => this.rollback(snapshot, 'Card creation failed.'),
      });
  }

  updateCard(card: BoardCardModel, input: CardUpdateInput): void {
    const changed = this.changedCardInput(card, input);
    if (!Object.keys(changed).length) return;

    const snapshot = this.view();
    const clientMutationId = this.trackMutation(card.id);
    this.patchLocalCard(card.id, { ...card, ...changed, version: card.version + 1, updatedAt: new Date().toISOString() });
    this.apollo
      .mutate<UpdateTaskMutation, UpdateTaskMutationVariables>({
        mutation: UpdateTaskDocument,
        variables: { id: card.id, expectedVersion: card.version, input: { ...changed, clientMutationId } },
      })
      .subscribe({
        next: ({ data }) => {
          if (data?.updateTask.conflict && data.updateTask.task) {
            this.registerConflict(card.id, card.version, data.updateTask.task);
            this.toast.warning('This card changed elsewhere.', `conflict:${card.id}`);
          } else {
            this.dismissConflict(card.id);
          }
          this.refetchBoard();
        },
        error: () => this.rollback(snapshot, 'Card update failed.'),
      });
  }

  moveCard(request: CardMoveRequest): void {
    const snapshot = this.view();
    const position = this.positionForMove(snapshot, request);
    const clientMutationId = this.trackMutation(request.task.id);
    const moved = this.moveLocalCard(snapshot, request, position);
    if (moved) this.view.set(moved);

    this.apollo
      .mutate<MoveTaskMutation, MoveTaskMutationVariables>({
        mutation: MoveTaskDocument,
        variables: {
          input: {
            boardId: request.task.boardId,
            taskId: request.task.id,
            toListId: request.toListId,
            position,
            status: request.status,
            expectedVersion: request.task.version,
            clientMutationId,
          },
        },
      })
      .subscribe({
        next: ({ data }) => {
          if (data?.moveTask.conflict && data.moveTask.task) {
            this.registerConflict(request.task.id, request.task.version, data.moveTask.task);
            this.toast.warning('Move conflict detected.', `conflict:${request.task.id}`);
          } else {
            this.dismissConflict(request.task.id);
          }
          this.refetchBoard();
        },
        error: () => this.rollback(snapshot, 'Move failed.'),
      });
  }

  reorderList(request: ListMoveRequest): void {
    if (request.fromIndex === request.toIndex) return;
    const snapshot = this.view();
    const position = this.positionForListMove(snapshot, request);
    const clientMutationId = this.trackMutation();
    const moved = this.moveLocalList(snapshot, request, position);
    if (moved) this.view.set(moved);

    this.apollo
      .mutate<UpdateListMutation, UpdateListMutationVariables>({
        mutation: UpdateListDocument,
        variables: {
          id: request.list.id,
          expectedVersion: request.list.version,
          input: { position, clientMutationId },
        },
      })
      .subscribe({
        next: ({ data }) => {
          if (data?.updateList.conflict) {
            this.toast.warning('List order changed elsewhere.', `conflict:list:${request.list.id}`);
          }
          this.refetchBoard();
        },
        error: () => this.rollback(snapshot, 'List move failed.', `rollback:list:${request.list.id}`),
      });
  }

  archiveCard(card: BoardCardModel): void {
    const snapshot = this.view();
    this.removeLocalCard(card.id);
    this.apollo
      .mutate<DeleteTaskMutation, DeleteTaskMutationVariables>({ mutation: DeleteTaskDocument, variables: { id: card.id, expectedVersion: card.version } })
      .subscribe({
        next: () => this.refetchBoard(),
        error: () => this.rollback(snapshot, 'Archive failed.'),
      });
  }

  addChecklistItem(card: BoardCardModel, text: string): void {
    if (!text.trim()) return;
    this.apollo
      .mutate<CreateChecklistItemMutation, CreateChecklistItemMutationVariables>({ mutation: CreateChecklistItemDocument, variables: { taskId: card.id, text: text.trim() } })
      .subscribe({ next: () => this.refetchBoard(), error: () => this.toast.error('Checklist update failed.') });
  }

  updateChecklistItem(id: string, checked: boolean): void {
    this.apollo
      .mutate<UpdateChecklistItemMutation, UpdateChecklistItemMutationVariables>({ mutation: UpdateChecklistItemDocument, variables: { id, checked } })
      .subscribe({ next: () => this.refetchBoard(), error: () => this.toast.error('Checklist update failed.') });
  }

  addComment(card: BoardCardModel, body: string): void {
    if (!body.trim()) return;
    this.apollo
      .mutate<AddCommentMutation, AddCommentMutationVariables>({ mutation: AddCommentDocument, variables: { taskId: card.id, body: body.trim() } })
      .subscribe({ next: () => this.refetchBoard(), error: () => this.toast.error('Comment failed.') });
  }

  simulateFailure(): void {
    this.apollo.mutate({ mutation: SimulateNetworkFailureDocument }).subscribe({
      next: () => this.toast.info('The next mutation will fail for rollback testing.'),
    });
  }

  selectCard(id: string | null): void {
    this.selectedCardId.set(id);
  }

  dismissConflict(taskId: string): void {
    this.conflicts.update((items) => items.filter((item) => item.taskId !== taskId));
  }

  private watchBoard(boardId: string): void {
    this.apollo
      .watchQuery<BoardViewQuery, BoardViewQueryVariables>({
        query: BoardViewDocument,
        variables: { boardId },
        fetchPolicy: 'cache-and-network',
      })
      .valueChanges.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ data, loading }) => {
          this.loading.set(loading);
          if (data.boardView) this.view.set(data.boardView);
        },
        error: () => {
          this.loading.set(false);
          this.toast.error('Board refresh failed.');
        },
      });
  }

  private startSubscription(boardId: string): void {
    if (this.subscriptionStartedFor === boardId) return;
    this.subscriptionStartedFor = boardId;
    this.apollo
      .subscribe<BoardChangedSubscription, BoardChangedSubscriptionVariables>({
        query: BoardChangedDocument,
        variables: { boardId },
      })
      .pipe(
        map((result) => result.data?.boardChanged),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (event) => {
          if (!event) return;
          const taskId = event.task?.id ?? null;
          if (event.clientMutationId && this.pendingMutationIds.has(event.clientMutationId)) {
            this.pendingMutationIds.delete(event.clientMutationId);
            if (taskId) this.pendingTaskIds.delete(taskId);
            this.dismissConflict(taskId ?? '');
            this.refetchBoard();
            return;
          }
          if (taskId && this.pendingTaskIds.has(taskId)) {
            this.pendingTaskIds.delete(taskId);
            this.dismissConflict(taskId);
            this.refetchBoard();
            return;
          }
          const selected = this.selectedCard();
          if (selected && event.task?.id === selected.id && event.task.version > selected.version) {
            this.registerConflict(selected.id, selected.version, event.task);
          }
          this.refetchBoard();
        },
        error: () => this.toast.warning('Live updates disconnected.', 'subscription:board'),
      });
  }

  private refetchBoard(): void {
    const boardId = this.boardId();
    if (!boardId) return;
    void this.apollo.client.refetchQueries({ include: [BoardViewDocument] });
  }

  private rollback(snapshot: BoardViewModel | null, message: string, key?: string): void {
    if (snapshot) this.view.set(snapshot);
    this.refetchBoard();
    this.toast.error(`${message} Changes reverted.`, key ?? `rollback:${message}`);
  }

  private registerConflict(taskId: string, localVersion: number, remoteTask: CardConflict['remoteTask']): void {
    this.conflicts.update((items) => [
      ...items.filter((item) => item.taskId !== taskId),
      { taskId, localVersion, remoteVersion: remoteTask.version, remoteTask },
    ]);
  }

  private trackMutation(taskId?: string): string {
    const id = crypto.randomUUID();
    this.pendingMutationIds.add(id);
    if (taskId) this.pendingTaskIds.add(taskId);
    window.setTimeout(() => {
      this.pendingMutationIds.delete(id);
      if (taskId) this.pendingTaskIds.delete(taskId);
    }, 15000);
    return id;
  }

  private changedCardInput(card: BoardCardModel, input: CardUpdateInput): CardUpdateInput {
    const changed: CardUpdateInput = {};
    if (input.title !== undefined && input.title !== card.title) changed.title = input.title;
    if (input.description !== undefined && input.description !== card.description) changed.description = input.description;
    if (input.priority !== undefined && Number(input.priority) !== card.priority) changed.priority = Number(input.priority);
    if (input.assignee !== undefined && input.assignee !== card.assignee) changed.assignee = input.assignee;
    if (input.dueDate !== undefined && input.dueDate !== card.dueDate) changed.dueDate = input.dueDate;
    if (input.coverColor !== undefined && input.coverColor !== card.coverColor) changed.coverColor = input.coverColor;
    return changed;
  }

  private patchLocalCard(id: string, card: BoardCardModel): void {
    const view = this.view();
    if (!view) return;
    this.view.set({
      ...view,
      lists: view.lists.map((list) => ({
        ...list,
        cards: list.cards.map((existing) => (existing.id === id ? { ...existing, ...card } : existing)),
      })),
    });
  }

  private removeLocalCard(id: string): void {
    const view = this.view();
    if (!view) return;
    this.view.set({
      ...view,
      lists: view.lists.map((list) => ({ ...list, cards: list.cards.filter((card) => card.id !== id) })),
    });
  }

  private addLocalCard(view: BoardViewModel | null, list: BoardListModel, title: string): BoardViewModel | null {
    if (!view) return null;
    const now = new Date().toISOString();
    const card = {
      __typename: 'BoardCard' as const,
      id: `temp-${crypto.randomUUID()}`,
      boardId: list.boardId,
      listId: list.id,
      title,
      description: null,
      status: list.status ?? TaskStatus.Todo,
      priority: 2,
      assignee: null,
      position: 0,
      dueDate: null,
      coverColor: null,
      archived: false,
      version: 0,
      updatedAt: now,
      labels: [],
      checklist: [],
      comments: [],
    };
    return {
      ...view,
      lists: view.lists.map((candidate) =>
        candidate.id === list.id ? { ...candidate, cards: [...candidate.cards, card] } : candidate,
      ),
    };
  }

  private moveLocalCard(view: BoardViewModel | null, request: CardMoveRequest, position: number): BoardViewModel | null {
    if (!view) return null;
    const movedCard = {
      ...request.task,
      listId: request.toListId,
      status: request.status,
      position,
      version: request.task.version + 1,
      updatedAt: new Date().toISOString(),
    };
    return {
      ...view,
      lists: view.lists.map((list) => {
        const without = list.cards.filter((card) => card.id !== request.task.id);
        if (list.id !== request.toListId) return { ...list, cards: without };
        const cards = [...without];
        cards.splice(request.toIndex, 0, movedCard);
        return { ...list, cards };
      }),
    };
  }

  private positionForMove(view: BoardViewModel | null, request: CardMoveRequest): number {
    const cards = (view?.lists.find((list) => list.id === request.toListId)?.cards ?? []).filter((card) => card.id !== request.task.id);
    const before = cards[request.toIndex - 1]?.position ?? 0;
    const after = cards[request.toIndex]?.position ?? before + 2048;
    return (before + after) / 2;
  }

  private moveLocalList(view: BoardViewModel | null, request: ListMoveRequest, position: number): BoardViewModel | null {
    if (!view) return null;
    const lists = view.lists.filter((list) => list.id !== request.list.id);
    lists.splice(request.toIndex, 0, { ...request.list, position, version: request.list.version + 1 });
    return { ...view, lists };
  }

  private positionForListMove(view: BoardViewModel | null, request: ListMoveRequest): number {
    const lists = (view?.lists ?? []).filter((list) => list.id !== request.list.id);
    const before = lists[request.toIndex - 1]?.position ?? 0;
    const after = lists[request.toIndex]?.position ?? before + 2048;
    return (before + after) / 2;
  }
}
