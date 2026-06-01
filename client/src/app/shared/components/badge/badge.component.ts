import { Component, input } from '@angular/core';

@Component({
  selector: 'app-badge',
  standalone: true,
  templateUrl: './badge.component.html',
  styleUrl: './badge.component.scss',
})
export class BadgeComponent {
  readonly variant = input<'todo' | 'in-progress' | 'done' | 'primary' | 'danger' | 'warning'>('primary');
}
