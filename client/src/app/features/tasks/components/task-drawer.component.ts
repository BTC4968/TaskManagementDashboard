import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ExternalConflict, Task, TaskStatus } from '../task.types';

@Component({
  selector: 'app-task-drawer',
  standalone: true,
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (open()) {
      <div class="backdrop" (click)="close.emit()" role="presentation"></div>
      <aside class="drawer" role="dialog" aria-modal="true" [attr.aria-label]="mode() === 'create' ? 'Create task' : 'Edit task'">
        <header>
          <h2>{{ mode() === 'create' ? 'New task' : 'Edit task' }}</h2>
          <button type="button" class="close" (click)="close.emit()" aria-label="Close">×</button>
        </header>

        @if (activeConflict(); as conflict) {
          <div class="conflict-panel">
            <p>
              This task was updated externally (v{{ conflict.localVersion }} → v{{ conflict.remoteVersion }}).
            </p>
            <div class="conflict-actions">
              <button type="button" (click)="acceptRemote.emit(conflict)">Use server version</button>
              <button type="button" class="muted-btn" (click)="dismissConflict.emit(conflict.taskId)">Keep editing</button>
            </div>
          </div>
        }

        <form [formGroup]="form" (ngSubmit)="submit()">
          <label>
            Title
            <input formControlName="title" />
          </label>
          <label>
            Description
            <textarea formControlName="description" rows="3"></textarea>
          </label>
          <label>
            Status
            <select formControlName="status">
              <option [value]="TaskStatus.Todo">Todo</option>
              <option [value]="TaskStatus.InProgress">In Progress</option>
              <option [value]="TaskStatus.Done">Done</option>
            </select>
          </label>
          <label>
            Priority (1–5)
            <input type="number" formControlName="priority" min="1" max="5" />
          </label>
          <label>
            Assignee
            <input formControlName="assignee" />
          </label>
          <footer>
            <button type="button" class="muted-btn" (click)="close.emit()">Cancel</button>
            <button type="submit" class="btn-primary" [disabled]="form.invalid">Save</button>
          </footer>
        </form>
      </aside>
    }
  `,
  styles: `
    .backdrop {
      position: fixed;
      inset: 0;
      background: rgba(15, 23, 42, 0.4);
      z-index: 40;
    }
    .drawer {
      position: fixed;
      top: 0;
      right: 0;
      width: min(24rem, 100vw);
      height: 100vh;
      background: #fff;
      z-index: 50;
      box-shadow: -8px 0 30px rgba(0, 0, 0, 0.12);
      display: flex;
      flex-direction: column;
      padding: 1.25rem;
      gap: 1rem;
    }
    header { display: flex; justify-content: space-between; align-items: center; }
    header h2 { margin: 0; font-size: 1.125rem; }
    .close { border: none; background: none; font-size: 1.5rem; cursor: pointer; }
    form { display: flex; flex-direction: column; gap: 0.75rem; flex: 1; }
    label { display: flex; flex-direction: column; gap: 0.25rem; font-size: 0.75rem; font-weight: 600; color: #64748b; }
    input, textarea, select {
      padding: 0.5rem;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      font-size: 0.875rem;
    }
    footer { margin-top: auto; display: flex; gap: 0.5rem; justify-content: flex-end; }
    .btn-primary {
      padding: 0.5rem 1rem;
      background: #2563eb;
      color: #fff;
      border: none;
      border-radius: 8px;
      font-weight: 600;
      cursor: pointer;
    }
    .muted-btn {
      padding: 0.5rem 1rem;
      background: #f8fafc;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      cursor: pointer;
    }
    .conflict-panel {
      background: #fffbeb;
      border: 1px solid #fcd34d;
      border-radius: 8px;
      padding: 0.75rem;
      font-size: 0.8125rem;
    }
    .conflict-actions { display: flex; gap: 0.5rem; margin-top: 0.5rem; }
    .conflict-actions button {
      padding: 0.35rem 0.6rem;
      border-radius: 6px;
      border: 1px solid #cbd5e1;
      background: #fff;
      cursor: pointer;
      font-size: 0.75rem;
    }
  `,
})
export class TaskDrawerComponent {
  protected readonly TaskStatus = TaskStatus;

  readonly open = input(false);
  readonly mode = input<'create' | 'edit'>('create');
  readonly task = input<Task | null>(null);
  readonly conflicts = input<ExternalConflict[]>([]);

  readonly save = output<{
    title: string;
    description: string | null;
    status: TaskStatus;
    priority: number;
    assignee: string | null;
  }>();
  readonly close = output<void>();
  readonly acceptRemote = output<ExternalConflict>();
  readonly dismissConflict = output<string>();

  private readonly fb = inject(FormBuilder);
  readonly form = this.fb.nonNullable.group({
    title: ['', Validators.required],
    description: [''],
    status: [TaskStatus.Todo, Validators.required],
    priority: [2, [Validators.required, Validators.min(1), Validators.max(5)]],
    assignee: [''],
  });

  readonly activeConflict = signal<ExternalConflict | null>(null);

  constructor() {
    effect(() => {
      const t = this.task();
      if (t && this.mode() === 'edit') {
        this.form.patchValue({
          title: t.title,
          description: t.description ?? '',
          status: t.status,
          priority: t.priority,
          assignee: t.assignee ?? '',
        });
      } else if (this.mode() === 'create') {
        this.form.reset({
          title: '',
          description: '',
          status: TaskStatus.Todo,
          priority: 2,
          assignee: '',
        });
      }
      const id = t?.id;
      const conflict = id
        ? this.conflicts().find((c) => c.taskId === id) ?? null
        : null;
      this.activeConflict.set(conflict);
    });
  }

  submit(): void {
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    this.save.emit({
      title: v.title.trim(),
      description: v.description.trim() || null,
      status: v.status,
      priority: v.priority,
      assignee: v.assignee.trim() || null,
    });
  }
}
