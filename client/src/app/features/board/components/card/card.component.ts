import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { BoardCardModel } from '../../models/board.types';

@Component({
  selector: 'app-board-card',
  standalone: true,
  templateUrl: './card.component.html',
  styleUrl: './card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CardComponent {
  readonly card = input.required<BoardCardModel>();
  readonly conflicted = input(false);
  readonly open = output<BoardCardModel>();
  readonly archive = output<BoardCardModel>();

  readonly checklistProgress = computed(() => {
    const items = this.card().checklist;
    if (!items.length) return null;
    return `${items.filter((item) => item.checked).length}/${items.length}`;
  });
}
