import { ChangeDetectionStrategy, Component, computed, effect, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BoardActivityModel, BoardCardModel, BoardLabelModel, CardConflict } from '../../models/board.types';

interface ActivityGroup {
  entry: BoardActivityModel;
  count: number;
}

@Component({
  selector: 'app-card-detail-modal',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './card-detail-modal.component.html',
  styleUrl: './card-detail-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CardDetailModalComponent {
  readonly card = input<BoardCardModel | null>(null);
  readonly labels = input<BoardLabelModel[]>([]);
  readonly activity = input<BoardActivityModel[]>([]);
  readonly conflicts = input<CardConflict[]>([]);

  readonly close = output<void>();
  readonly saveCard = output<{
    card: BoardCardModel;
    input: Partial<Pick<BoardCardModel, 'title' | 'description' | 'priority' | 'assignee' | 'dueDate' | 'coverColor'>>;
  }>();
  readonly archiveCard = output<BoardCardModel>();
  readonly addChecklistItem = output<{ card: BoardCardModel; text: string }>();
  readonly toggleChecklistItem = output<{ id: string; checked: boolean }>();
  readonly addComment = output<{ card: BoardCardModel; body: string }>();
  readonly dismissConflict = output<string>();

  readonly title = signal('');
  readonly description = signal('');
  readonly assignee = signal('');
  readonly dueDate = signal('');
  readonly coverColor = signal('');
  readonly priority = signal(2);
  readonly checklistText = signal('');
  readonly commentBody = signal('');

  readonly activeConflict = computed(() => {
    const id = this.card()?.id;
    return id ? this.conflicts().find((conflict) => conflict.taskId === id) ?? null : null;
  });

  readonly cardActivity = computed(() => {
    const id = this.card()?.id;
    const groups: ActivityGroup[] = [];
    for (const entry of this.activity().filter((item) => item.taskId === id)) {
      const previous = groups[groups.length - 1];
      if (previous && previous.entry.actor === entry.actor && previous.entry.type === entry.type && previous.entry.message === entry.message) {
        previous.count += 1;
      } else {
        groups.push({ entry, count: 1 });
      }
      if (groups.length >= 12) break;
    }
    return groups;
  });

  constructor() {
    effect(() => {
      const card = this.card();
      this.title.set(card?.title ?? '');
      this.description.set(card?.description ?? '');
      this.assignee.set(card?.assignee ?? '');
      this.dueDate.set(card?.dueDate ?? '');
      this.coverColor.set(card?.coverColor ?? '');
      this.priority.set(card?.priority ?? 2);
      this.checklistText.set('');
      this.commentBody.set('');
    });
  }

  save(): void {
    const card = this.card();
    if (!card || !this.title().trim()) return;
    this.saveCard.emit({
      card,
      input: {
        title: this.title().trim(),
        description: this.description().trim() || null,
        assignee: this.assignee().trim() || null,
        dueDate: this.dueDate() || null,
        coverColor: this.coverColor() || null,
        priority: Number(this.priority()) || 2,
      },
    });
  }

  commitCoverColor(value: string): void {
    this.coverColor.set(value);
    this.save();
  }

  displayActor(actor: string): string {
    if (!actor || actor.includes('|')) return 'User';
    return actor;
  }

  displayActivity(message: string): string {
    const card = this.card();
    if (!card) return message;
    return message.replaceAll(`"${card.title}"`, 'this card');
  }

  submitChecklist(): void {
    const card = this.card();
    if (!card || !this.checklistText().trim()) return;
    this.addChecklistItem.emit({ card, text: this.checklistText() });
    this.checklistText.set('');
  }

  submitComment(): void {
    const card = this.card();
    if (!card || !this.commentBody().trim()) return;
    this.addComment.emit({ card, body: this.commentBody() });
    this.commentBody.set('');
  }
}
