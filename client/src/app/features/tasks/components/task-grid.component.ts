import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';
import { ExternalConflict, Task, TaskStatus } from '../task.types';

@Component({
  selector: 'app-task-grid',
  standalone: true,
  imports: [DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="grid-wrap">
      <table class="task-table">
        <thead>
          <tr>
            <th scope="col">
              <button type="button" class="sort-btn" (click)="sort.emit('title')">Title</button>
            </th>
            <th scope="col">
              <button type="button" class="sort-btn" (click)="sort.emit('status')">Status</button>
            </th>
            <th scope="col">
              <button type="button" class="sort-btn" (click)="sort.emit('priority')">Priority</button>
            </th>
            <th scope="col">
              <button type="button" class="sort-btn" (click)="sort.emit('assignee')">Assignee</button>
            </th>
            <th scope="col">
              <button type="button" class="sort-btn" (click)="sort.emit('updatedAt')">Updated</button>
            </th>
            <th scope="col">Actions</th>
          </tr>
        </thead>
        <tbody>
          @if (loading()) {
            <tr>
              <td colspan="6" class="muted">Loading tasks…</td>
            </tr>
          } @else if (!tasks().length) {
            <tr>
              <td colspan="6" class="muted">No tasks match your filters.</td>
            </tr>
          } @else {
            @for (task of tasks(); track task.id) {
              <tr [class.row-conflict]="hasConflict(task.id)">
                <td>
                  <strong>{{ task.title }}</strong>
                  @if (task.description) {
                    <p class="desc">{{ task.description }}</p>
                  }
                  @if (hasConflict(task.id)) {
                    <span class="conflict-badge">External update</span>
                  }
                </td>
                <td><span class="pill pill--{{ task.status }}">{{ formatStatus(task.status) }}</span></td>
                <td>{{ task.priority }}</td>
                <td>{{ task.assignee ?? '—' }}</td>
                <td>{{ task.updatedAt | date: 'medium' }}</td>
                <td class="actions">
                  <button type="button" (click)="edit.emit(task)">Edit</button>
                  <button type="button" class="danger" (click)="remove.emit(task)">Delete</button>
                </td>
              </tr>
            }
          }
        </tbody>
      </table>
    </div>
  `,
  styles: `
    .grid-wrap { overflow-x: auto; border: 1px solid #e2e8f0; border-radius: 12px; background: #fff; }
    .task-table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
    th, td { padding: 0.75rem 1rem; text-align: left; border-bottom: 1px solid #f1f5f9; }
    th { background: #f8fafc; font-weight: 600; color: #475569; }
    .sort-btn { border: none; background: none; font: inherit; font-weight: 600; cursor: pointer; color: inherit; }
    .sort-btn:hover { color: #2563eb; }
    .desc { margin: 0.25rem 0 0; color: #64748b; font-size: 0.8125rem; }
    .muted { text-align: center; color: #94a3b8; padding: 2rem; }
    .pill { display: inline-block; padding: 0.15rem 0.5rem; border-radius: 999px; font-size: 0.75rem; font-weight: 600; }
    .pill--TODO { background: #f1f5f9; color: #475569; }
    .pill--IN_PROGRESS { background: #dbeafe; color: #1d4ed8; }
    .pill--DONE { background: #d1fae5; color: #047857; }
    .actions { display: flex; gap: 0.5rem; }
    .actions button {
      border: 1px solid #cbd5e1;
      background: #fff;
      border-radius: 6px;
      padding: 0.25rem 0.5rem;
      cursor: pointer;
      font-size: 0.8125rem;
    }
    .actions button.danger { color: #b91c1c; border-color: #fecaca; }
    .row-conflict { background: #fffbeb; }
    .conflict-badge {
      display: inline-block;
      margin-top: 0.25rem;
      font-size: 0.6875rem;
      font-weight: 700;
      text-transform: uppercase;
      color: #b45309;
    }
  `,
})
export class TaskGridComponent {
  readonly tasks = input.required<Task[]>();
  readonly loading = input(false);
  readonly conflicts = input<ExternalConflict[]>([]);

  readonly sort = output<string>();
  readonly edit = output<Task>();
  readonly remove = output<Task>();

  hasConflict(taskId: string): boolean {
    return this.conflicts().some((c) => c.taskId === taskId);
  }

  formatStatus(status: TaskStatus): string {
    switch (status) {
      case TaskStatus.Todo:
        return 'Todo';
      case TaskStatus.InProgress:
        return 'In Progress';
      case TaskStatus.Done:
        return 'Done';
    }
  }
}
