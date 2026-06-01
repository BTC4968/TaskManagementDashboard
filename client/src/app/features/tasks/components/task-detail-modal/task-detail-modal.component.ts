import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  effect,
  signal,
  inject,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Task, TaskStatus, ExternalConflict } from '../../task.types';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';
import { ButtonComponent } from '../../../../shared/components/button/button.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { BadgeComponent } from '../../../../shared/components/badge/badge.component';

@Component({
  selector: 'app-task-detail-modal',
  standalone: true,
  imports: [ReactiveFormsModule, ModalComponent, ButtonComponent, InputComponent, BadgeComponent],
  templateUrl: './task-detail-modal.component.html',
  styleUrl: './task-detail-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TaskDetailModalComponent {
  readonly fb = inject(FormBuilder);

  readonly open = input(false);
  readonly mode = input<'create' | 'edit'>('create');
  readonly task = input<Task | null>(null);
  readonly conflicts = input<ExternalConflict[]>([]);

  readonly close = output<void>();
  readonly save = output<{
    title: string;
    description: string | null;
    status: TaskStatus;
    priority: number;
    assignee: string | null;
  }>();
  readonly acceptRemote = output<ExternalConflict>();
  readonly dismissConflict = output<string>();

  readonly form = this.fb.group({
    title: ['', [Validators.required, Validators.minLength(3)]],
    description: [''],
    status: [TaskStatus.Todo],
    priority: [3, [Validators.required, Validators.min(1), Validators.max(5)]],
    assignee: [''],
  });

  readonly activeConflict = signal<ExternalConflict | null>(null);
  readonly saving = signal(false);

  constructor() {
    effect(() => {
      const task = this.task();
      if (task && this.mode() === 'edit') {
        this.form.patchValue({
          title: task.title,
          description: task.description || '',
          status: task.status,
          priority: task.priority,
          assignee: task.assignee || '',
        });
      } else {
        this.form.reset({
          status: TaskStatus.Todo,
          priority: 3,
        });
      }

      const conflict = this.conflicts().find(c => c.taskId === task?.id);
      this.activeConflict.set(conflict || null);
    });
  }

  onSubmit(): void {
    if (this.form.invalid) {
      return;
    }

    this.saving.set(true);
    const formValue = this.form.value as any;
    this.save.emit({
      title: formValue.title,
      description: formValue.description || null,
      status: formValue.status,
      priority: formValue.priority,
      assignee: formValue.assignee || null,
    });
    setTimeout(() => this.saving.set(false), 500);
  }

  getTitleError(): string {
    const control = this.form.get('title');
    if (control?.hasError('required')) return 'Title is required';
    if (control?.hasError('minlength')) return 'Title must be at least 3 characters';
    return '';
  }

  getPriorityError(): string {
    const control = this.form.get('priority');
    if (control?.hasError('required')) return 'Priority is required';
    if (control?.hasError('min') || control?.hasError('max')) return 'Priority must be 1-5';
    return '';
  }
}
