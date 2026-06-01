import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { TaskDrawerComponent } from './components/task-drawer.component';
import { TaskGridComponent } from './components/task-grid.component';
import { TaskToolbarComponent } from './components/task-toolbar.component';
import { TaskFacade, TaskFilter, TaskSort } from './task.facade';
import { ExternalConflict, Task, TaskStatus } from './task.types';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [TaskToolbarComponent, TaskGridComponent, TaskDrawerComponent],
  providers: [TaskFacade],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="dashboard">
      <header class="page-header">
        <div>
          <h1>Task Dashboard</h1>
          <p class="subtitle">Real-time collaborative task management</p>
        </div>
        <span class="live-indicator" title="WebSocket subscription active">Live</span>
      </header>

      <app-task-toolbar
        [page]="page()"
        [totalCount]="totalCount()"
        [hasNext]="hasNext()"
        [hasPrevious]="hasPrevious()"
        [(statusFilter)]="statusFilter"
        [(search)]="searchQuery"
        (filterChange)="applyFilters()"
        (pageChange)="goToPage($event)"
        (create)="openCreate()"
        (simulateFailure)="facade.simulateNetworkFailure()"
      />

      <app-task-grid
        [tasks]="tasks()"
        [loading]="facade.loading()"
        [conflicts]="facade.conflicts()"
        (sort)="toggleSort($event)"
        (edit)="openEdit($event)"
        (remove)="confirmDelete($event)"
      />

      <app-task-drawer
        [open]="drawerOpen()"
        [mode]="drawerMode()"
        [task]="selectedTask()"
        [conflicts]="facade.conflicts()"
        (close)="closeDrawer()"
        (save)="onSave($event)"
        (acceptRemote)="facade.acceptRemoteVersion($event)"
        (dismissConflict)="facade.dismissConflict($event)"
      />
    </section>
  `,
  styles: `
    .dashboard { max-width: 1200px; margin: 0 auto; }
    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 1.5rem;
    }
    .page-header h1 { margin: 0; font-size: 1.75rem; color: #0f172a; }
    .subtitle { margin: 0.25rem 0 0; color: #64748b; font-size: 0.9375rem; }
    .live-indicator {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      font-size: 0.75rem;
      font-weight: 700;
      color: #047857;
      text-transform: uppercase;
    }
    .live-indicator::before {
      content: '';
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #10b981;
      animation: pulse 1.5s infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.4; }
    }
  `,
})
export class DashboardComponent implements OnInit {
  readonly facade = inject(TaskFacade);

  readonly page = signal(1);
  readonly pageSize = signal(10);
  readonly statusFilter = signal<TaskStatus | null>(null);
  readonly searchQuery = signal('');
  readonly sortState = signal<TaskSort[]>([{ field: 'updatedAt', direction: 'DESC' }]);

  readonly drawerOpen = signal(false);
  readonly drawerMode = signal<'create' | 'edit'>('create');
  readonly selectedTask = signal<Task | null>(null);

  readonly tasks = computed(() => this.facade.connection()?.nodes ?? []);
  readonly totalCount = computed(() => this.facade.connection()?.totalCount ?? 0);
  readonly hasNext = computed(() => this.facade.connection()?.pageInfo.hasNextPage ?? false);
  readonly hasPrevious = computed(
    () => this.facade.connection()?.pageInfo.hasPreviousPage ?? false,
  );

  ngOnInit(): void {
    this.facade.init();
    this.refresh();
  }

  applyFilters(): void {
    this.page.set(1);
    this.refresh();
  }

  goToPage(next: number): void {
    this.page.set(Math.max(1, next));
    this.refresh();
  }

  toggleSort(field: string): void {
    const current = this.sortState()[0];
    const direction =
      current?.field === field && current.direction === 'ASC' ? 'DESC' : 'ASC';
    this.sortState.set([{ field, direction }]);
    this.refresh();
  }

  openCreate(): void {
    this.drawerMode.set('create');
    this.selectedTask.set(null);
    this.facade.setEditingTask(null);
    this.drawerOpen.set(true);
  }

  openEdit(task: Task): void {
    this.drawerMode.set('edit');
    this.selectedTask.set(task);
    this.facade.setEditingTask(task.id);
    this.drawerOpen.set(true);
  }

  closeDrawer(): void {
    this.drawerOpen.set(false);
    this.facade.setEditingTask(null);
    this.selectedTask.set(null);
  }

  onSave(payload: {
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
    this.closeDrawer();
  }

  confirmDelete(task: Task): void {
    if (confirm(`Delete "${task.title}"?`)) {
      this.facade.deleteTask(task.id);
    }
  }

  private refresh(): void {
    const filter: TaskFilter = {
      status: this.statusFilter(),
      search: this.searchQuery(),
    };
    this.facade.refreshList(this.page(), this.pageSize(), filter, this.sortState());
  }
}
