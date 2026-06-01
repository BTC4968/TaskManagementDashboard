import { CdkDrag, CdkDragDrop, CdkDropList } from '@angular/cdk/drag-drop';
import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BoardCardModel, BoardListModel, CardConflict, CardMoveRequest, ListMoveRequest, TaskStatus } from '../../models/board.types';
import { BoardListComponent } from '../board-list/board-list.component';

@Component({
  selector: 'app-board-canvas',
  standalone: true,
  imports: [FormsModule, CdkDropList, CdkDrag, BoardListComponent],
  templateUrl: './board-canvas.component.html',
  styleUrl: './board-canvas.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BoardCanvasComponent {
  readonly lists = input.required<BoardListModel[]>();
  readonly loading = input(false);
  readonly conflicts = input<CardConflict[]>([]);

  readonly createList = output<string>();
  readonly createCard = output<{ list: BoardListModel; title: string }>();
  readonly moveCard = output<CardMoveRequest>();
  readonly moveList = output<ListMoveRequest>();
  readonly openCard = output<BoardCardModel>();
  readonly archiveCard = output<BoardCardModel>();

  readonly listTitle = signal('');
  readonly addingList = signal(false);
  readonly connectedIds = computed(() => this.lists().map((list) => list.id));

  submitList(): void {
    const title = this.listTitle().trim();
    if (!title) return;
    this.createList.emit(title);
    this.listTitle.set('');
    this.addingList.set(false);
  }

  onDrop(event: CdkDragDrop<BoardCardModel[]>): void {
    const task = event.item.data as BoardCardModel;
    const target = this.lists().find((list) => list.id === event.container.id);
    if (!target) return;
    if (event.previousContainer.id === event.container.id && event.previousIndex === event.currentIndex) return;
    this.moveCard.emit({
      task,
      fromListId: event.previousContainer.id,
      toListId: event.container.id,
      toIndex: event.currentIndex,
      status: target.status ?? this.statusForList(target),
    });
  }

  onListDrop(event: CdkDragDrop<BoardListModel[]>): void {
    const list = event.item.data as BoardListModel;
    if (!list || event.previousIndex === event.currentIndex) return;
    this.moveList.emit({ list, fromIndex: event.previousIndex, toIndex: event.currentIndex });
  }

  private statusForList(list: BoardListModel): TaskStatus {
    const lower = list.title.toLowerCase();
    if (lower.includes('done')) return TaskStatus.Done;
    if (lower.includes('progress')) return TaskStatus.InProgress;
    return TaskStatus.Todo;
  }
}
