import { Component, ChangeDetectionStrategy, input, output, signal } from '@angular/core';
import { CdkDropList, CdkDrag, CdkDragPlaceholder } from '@angular/cdk/drag-drop';
import { NgClass, NgForOf } from '@angular/common';
import { Task, Column } from '../../task.types';
import { TaskCardComponent } from '../task-card/task-card.component';
import { CardComponent } from '../../../../shared/components/card/card.component';
import { ButtonComponent } from '../../../../shared/components/button/button.component';

@Component({
  selector: 'app-kanban-column',
  standalone: true,
  imports: [
    CdkDropList,
    CdkDrag,
    CdkDragPlaceholder,
    NgForOf,
    NgClass,
    TaskCardComponent,
    CardComponent,
    ButtonComponent,
  ],
  templateUrl: './kanban-column.component.html',
  styleUrl: './kanban-column.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class KanbanColumnComponent {
  readonly column = input.required<Column>();
  readonly tasks = input.required<Task[]>();
  readonly allConflicts = input<any[]>([]);

  readonly showMenu = signal(false);

  readonly taskDropped = output<any>();
  readonly taskClick = output<Task>();
  readonly deleteTask = output<Task>();
  readonly editColumn = output<Column>();
  readonly deleteColumn = output<Column>();

  getTaskCount(): string {
    return this.tasks().length.toString();
  }

  toggleMenu(): void {
    this.showMenu.update(v => !v);
  }

  closeMenu(): void {
    this.showMenu.set(false);
  }

  onEditColumn(): void {
    this.editColumn.emit(this.column());
    this.closeMenu();
  }

  onDeleteColumn(): void {
    if (confirm(`Delete column "${this.column().name}"?`)) {
      this.deleteColumn.emit(this.column());
    }
    this.closeMenu();
  }

  hasConflict(taskId: string): boolean {
    return this.allConflicts().some((c: any) => c.taskId === taskId);
  }
}
