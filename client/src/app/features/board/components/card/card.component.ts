import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { BoardCardModel, BoardMemberModel } from '../../models/board.types';
import { memberSingleInitial } from '../../utils/board.utils';
import { formatDuration, parseDurationToMinutes } from '../../utils/time.utils';

@Component({
  selector: 'app-board-card',
  standalone: true,
  templateUrl: './card.component.html',
  styleUrl: './card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CardComponent {
  readonly card = input.required<BoardCardModel>();
  readonly members = input<BoardMemberModel[]>([]);
  readonly conflicted = input(false);
  readonly open = output<BoardCardModel>();
  readonly archive = output<BoardCardModel>();
  readonly estimateChange = output<{ card: BoardCardModel; estimateMinutes: number | null }>();

  readonly editingEstimate = signal(false);
  readonly estimateDraft = signal('');

  readonly checklistProgress = computed(() => {
    const items = this.card().checklist;
    if (!items.length) return null;
    const done = items.every((item) => item.checked);
    if (done) return 'done';
    return `${items.filter((item) => item.checked).length}/${items.length}`;
  });

  readonly checklistDone = computed(() => this.checklistProgress() === 'done');

  readonly assignees = computed(() => {
    const ids = this.card().assignees ?? [];
    if (!ids.length) return [];
    const lookup = new Map(this.members().map((member) => [member.auth0Sub, member]));
    return ids.map((id) => lookup.get(id)).filter((member): member is BoardMemberModel => Boolean(member));
  });

  readonly estimateLabel = computed(() => formatDuration(this.card().estimateMinutes));

  memberInitials = memberSingleInitial;
  formatDuration = formatDuration;

  startEstimateEdit(event: Event): void {
    event.stopPropagation();
    this.estimateDraft.set(formatDuration(this.card().estimateMinutes) || '');
    this.editingEstimate.set(true);
  }

  commitEstimate(event: Event): void {
    event.stopPropagation();
    this.editingEstimate.set(false);
    const draft = this.estimateDraft().trim();
    const minutes = draft ? parseDurationToMinutes(draft) : null;
    if (draft && minutes == null) return;
    const current = this.card().estimateMinutes ?? null;
    if (minutes === current) return;
    this.estimateChange.emit({ card: this.card(), estimateMinutes: minutes });
  }

  cancelEstimate(event: Event): void {
    event.stopPropagation();
    this.editingEstimate.set(false);
  }

  onEstimateKeydown(event: KeyboardEvent): void {
    event.stopPropagation();
    if (event.key === 'Enter') {
      event.preventDefault();
      this.commitEstimate(event);
    } else if (event.key === 'Escape') {
      this.cancelEstimate(event);
    }
  }
}
