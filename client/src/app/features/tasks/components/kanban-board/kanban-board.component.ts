import { Component, ChangeDetectionStrategy, input, output, computed } from '@angular/core';
import { CdkDropList, CdkDrag } from '@angular/cdk/drag-drop';
import { NgForOf } from '@angular/common';
import { Task, Column } from '../../task.types';
import { KanbanColumnComponent } from '../kanban-column/kanban-column.component';
import { ButtonComponent } from '../../../../shared/components/button/button.component';

export interface ColumnDropEvent {
  previousIndex: number;
  currentIndex: number;
  item: Column;
}

export interface TaskDropEvent {
  previousColumnId: string;
  currentColumnId: string;
  previousIndex: number;
  currentIndex: number;
  task: Task;
}

@Component({
  selector: 'app-kanban-board',
  standalone: true,
  imports: [
    CdkDropList,
    CdkDrag,
    NgForOf,
    KanbanColumnComponent,
    ButtonComponent,
  ],
  templateUrl: './kanban-board.component.html',
  styleUrl: './kanban-board.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class KanbanBoardComponent {
  readonly columns = input.required<Column[]>();
  readonly tasks = input.required<Task[]>();
  readonly loading = input(false);
  readonly conflicts = input<any[]>([]);

  readonly tasksByColumn = computed(() => {
    const cols = this.columns();
    const tasksList = this.tasks();
    return cols.map(col => ({
      column: col,
      tasks: tasksList.filter(t => t.status === col.status),
    }));
  });

  readonly createColumn = output<void>();
  readonly columnReorder = output<ColumnDropEvent>();
  readonly taskMove = output<TaskDropEvent>();
  readonly taskReorder = output<TaskDropEvent>();
  readonly editTask = output<Task>();
  readonly deleteTask = output<Task>();
  readonly editColumn = output<Column>();
  readonly deleteColumn = output<Column>();

  onAddColumn(): void {
    this.createColumn.emit();
  }

  onColumnDropped(event: any): void {
    if (event.previousIndex !== event.currentIndex) {
      this.columnReorder.emit({
        previousIndex: event.previousIndex,
        currentIndex: event.currentIndex,
        item: event.item.data,
      });
    }
  }

  onTaskDropped(event: any): void {
    const task = event.item.data;
    const previousColumnId = event.previousContainer.id;
    const currentColumnId = event.container.id;
    const previousIndex = event.previousIndex;
    const currentIndex = event.currentIndex;

    if (previousColumnId === currentColumnId && previousIndex === currentIndex) {
      return;
    }

    if (previousColumnId === currentColumnId) {
      this.taskReorder.emit({
        previousColumnId,
        currentColumnId,
        previousIndex,
        currentIndex,
        task,
      });
    } else {
      this.taskMove.emit({
        previousColumnId,
        currentColumnId,
        previousIndex,
        currentIndex,
        task,
      });
    }
  }
}
