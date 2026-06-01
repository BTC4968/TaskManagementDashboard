import { Component, ChangeDetectionStrategy, input, output, computed } from '@angular/core';
import { NgIf } from '@angular/common';
import { Task } from '../../task.types';
import { BadgeComponent } from '../../../../shared/components/badge/badge.component';

@Component({
  selector: 'app-task-card',
  standalone: true,
  imports: [NgIf, BadgeComponent],
  templateUrl: './task-card.component.html',
  styleUrl: './task-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TaskCardComponent {
  readonly task = input.required<Task>();
  readonly hasConflict = input(false);

  readonly click = output<void>();
  readonly deleteTask = output<Task>();

  readonly statusBadgeVariant = computed(() => {
    const status = this.task().status;
    switch (status) {
      case 'TODO':
        return 'todo';
      case 'IN_PROGRESS':
        return 'in-progress';
      case 'DONE':
        return 'done';
      default:
        return 'todo';
    }
  });

  onDelete(event: Event): void {
    event.stopPropagation();
    this.deleteTask.emit(this.task());
  }
}
