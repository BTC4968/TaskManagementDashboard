import { seedTasks } from './store.js';
import { TaskStatus } from './types.js';

seedTasks([
  {
    title: 'Define GraphQL schema',
    description: 'Model tasks with version field for optimistic concurrency',
    status: TaskStatus.DONE,
    priority: 1,
    assignee: 'Alex Chen',
  },
  {
    title: 'Wire Apollo split link',
    description: 'HTTP for queries/mutations, WebSocket for subscriptions',
    status: TaskStatus.IN_PROGRESS,
    priority: 1,
    assignee: 'Jordan Lee',
  },
  {
    title: 'Implement optimistic mutations',
    description: 'Cache updates with rollback on failure',
    status: TaskStatus.TODO,
    priority: 2,
    assignee: 'Sam Rivera',
  },
  {
    title: 'Add Auth0 route guards',
    description: 'Protect dashboard routes and inject JWT in Apollo links',
    status: TaskStatus.IN_PROGRESS,
    priority: 2,
    assignee: 'Alex Chen',
  },
  {
    title: 'Deploy to Vercel',
    description: 'Configure env vars and lazy-loaded routes',
    status: TaskStatus.TODO,
    priority: 3,
    assignee: 'Jordan Lee',
  },
  {
    title: 'Document ADR in README',
    status: TaskStatus.TODO,
    priority: 3,
    assignee: 'Sam Rivera',
  },
  {
    title: 'Server-side pagination QA',
    description: 'Verify sort and filter combinations',
    status: TaskStatus.DONE,
    priority: 2,
    assignee: 'Jordan Lee',
  },
  {
    title: 'Conflict resolution UX',
    description: 'Surface external updates while user is editing',
    status: TaskStatus.IN_PROGRESS,
    priority: 1,
    assignee: 'Sam Rivera',
  },
]);

console.log('Seeded task store.');
