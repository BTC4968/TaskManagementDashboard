import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { TaskFacade, TaskFilter, TaskSort } from '../task.facade';
import { Task, TaskStatus, Column } from '../task.types';
import { KanbanBoardComponent } from '../components/kanban-board/kanban-board.component';
import { TaskDetailModalComponent } from '../components/task-detail-modal/task-detail-modal.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [KanbanBoardComponent, TaskDetailModalComponent],
  providers: [TaskFacade],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent implements OnInit {
  readonly facade = inject(TaskFacade);

  // Sample columns - in a real app, these would come from the backend
  readonly columns = signal<Column[]>([
    { id: 'col-1', name: 'Todo', status: TaskStatus.Todo, sortOrder: 1, createdAt: '', updatedAt: '' },
    { id: 'col-2', name: 'In Progress', status: TaskStatus.InProgress, sortOrder: 2, createdAt: '', updatedAt: '' },
    { id: 'col-3', name: 'Done', status: TaskStatus.Done, sortOrder: 3, createdAt: '', updatedAt: '' },
  ]);

  readonly statusFilter = signal<TaskStatus | null>(null);
  readonly searchQuery = signal('');

  readonly drawerOpen = signal(false);
  readonly drawerMode = signal<'create' | 'edit'>('create');
  readonly selectedTask = signal<Task | null>(null);

  readonly tasks = computed(() => this.facade.connection()?.nodes ?? []);
  readonly allConflicts = computed(() => this.facade.conflicts());

  ngOnInit(): void {
    this.facade.init();
    this.refreshTasks();
  }

  private refreshTasks(): void {
    const filter: TaskFilter = {
      status: this.statusFilter(),
      search: this.searchQuery(),
    };
    this.facade.refreshList(1, 100, filter, [{ field: 'updatedAt', direction: 'DESC' }]);
  }

  onCreateColumn(): void {
    // TODO: Implement column creation UI
    const newColumn: Column = {
      id: `col-${Date.now()}`,
      name: `New Column ${this.columns().length + 1}`,
      status: TaskStatus.Todo,
      sortOrder: this.columns().length + 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.columns.update(cols => [...cols, newColumn]);
  }

  onEditTask(task: Task): void {
    this.drawerMode.set('edit');
    this.selectedTask.set(task);
    this.facade.setEditingTask(task.id);
    this.drawerOpen.set(true);
  }

  onDeleteTask(task: Task): void {
    if (confirm(`Delete "${task.title}"?`)) {
      this.facade.deleteTask(task.id);
    }
  }

  onCreateTask(): void {
    this.drawerMode.set('create');
    this.selectedTask.set(null);
    this.facade.setEditingTask(null);
    this.drawerOpen.set(true);
  }

  onSaveTask(payload: {
    title: string;
    description: string | null;
    status: TaskStatus;
    priority: number;
    assignee: string | null;
  }): void {
    const mode = this.drawerMode();
    if (mode === 'create') {
      this.facade.createTask(payload);
    } else {
      const task = this.selectedTask();
      if (task) {
        this.facade.updateTask(task.id, payload, task.version);
      }
    }
    this.closeModal();
  }

  onTaskMove(event: any): void {
    const task = event.task;
    const newStatus = this.columns().find(c => c.id === event.currentColumnId)?.status;
    if (newStatus && newStatus !== task.status) {
      this.facade.updateTask(task.id, { ...task, status: newStatus }, task.version);
    }
  }

  closeModal(): void {
    this.drawerOpen.set(false);
    this.facade.setEditingTask(null);
    this.selectedTask.set(null);
  }

  onColumnReorder(event: any): void {
    // TODO: Persist column order
    const newColumns = [...this.columns()];
    const [removed] = newColumns.splice(event.previousIndex, 1);
    newColumns.splice(event.currentIndex, 0, removed);
    this.columns.set(newColumns);
  }
}
