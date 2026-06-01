import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { BoardModel } from '../../models/board.types';

@Component({
  selector: 'app-board-header',
  standalone: true,
  templateUrl: './board-header.component.html',
  styleUrl: './board-header.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BoardHeaderComponent {
  readonly board = input<BoardModel | null>(null);
  readonly loading = input(false);
  readonly simulateFailure = output<void>();
}
