import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
  model,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TaskStatus } from '../task.types';

@Component({
  selector: 'app-task-toolbar',
  standalone: true,
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="toolbar">
      <div class="filters">
        <label>
          Status
          <select [ngModel]="statusFilter()" (ngModelChange)="statusFilter.set($event); filterChange.emit()">
            <option [ngValue]="null">All</option>
            <option [ngValue]="TaskStatus.Todo">Todo</option>
            <option [ngValue]="TaskStatus.InProgress">In Progress</option>
            <option [ngValue]="TaskStatus.Done">Done</option>
          </select>
        </label>
        <label>
          Search
          <input
            type="search"
            placeholder="Title, description, assignee…"
            [ngModel]="search()"
            (ngModelChange)="search.set($event)"
            (keyup.enter)="filterChange.emit()"
          />
        </label>
        <button type="button" class="btn-secondary" (click)="filterChange.emit()">Apply filters</button>
      </div>
      <div class="actions">
        <button type="button" class="btn-secondary" (click)="simulateFailure.emit()">Simulate network drop</button>
        <button type="button" class="btn-primary" (click)="create.emit()">New task</button>
      </div>
    </div>
    <div class="pagination">
      <span>{{ totalCount() }} tasks</span>
      <div class="pager">
        <button type="button" [disabled]="!hasPrevious()" (click)="pageChange.emit(page() - 1)">Previous</button>
        <span>Page {{ page() }}</span>
        <button type="button" [disabled]="!hasNext()" (click)="pageChange.emit(page() + 1)">Next</button>
      </div>
    </div>
  `,
  styles: `
    .toolbar {
      display: flex;
      flex-wrap: wrap;
      gap: 1rem;
      justify-content: space-between;
      align-items: flex-end;
      margin-bottom: 1rem;
    }
    .filters { display: flex; flex-wrap: wrap; gap: 0.75rem; align-items: flex-end; }
    label { display: flex; flex-direction: column; gap: 0.25rem; font-size: 0.75rem; font-weight: 600; color: #64748b; }
    select, input {
      padding: 0.5rem 0.75rem;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      font-size: 0.875rem;
      min-width: 10rem;
    }
    .actions { display: flex; gap: 0.5rem; }
    .btn-primary, .btn-secondary {
      padding: 0.5rem 1rem;
      border-radius: 8px;
      font-weight: 600;
      font-size: 0.875rem;
      cursor: pointer;
      border: none;
    }
    .btn-primary { background: #2563eb; color: #fff; }
    .btn-secondary { background: #f1f5f9; color: #334155; border: 1px solid #cbd5e1; }
    .pagination {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.75rem;
      font-size: 0.875rem;
      color: #64748b;
    }
    .pager { display: flex; gap: 0.75rem; align-items: center; }
    .pager button {
      padding: 0.35rem 0.75rem;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      background: #fff;
      cursor: pointer;
    }
    .pager button:disabled { opacity: 0.4; cursor: not-allowed; }
  `,
})
export class TaskToolbarComponent {
  protected readonly TaskStatus = TaskStatus;

  readonly page = input(1);
  readonly totalCount = input(0);
  readonly hasNext = input(false);
  readonly hasPrevious = input(false);

  readonly statusFilter = model<TaskStatus | null>(null);
  readonly search = model('');

  readonly filterChange = output<void>();
  readonly pageChange = output<number>();
  readonly create = output<void>();
  readonly simulateFailure = output<void>();
}
