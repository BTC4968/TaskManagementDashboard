import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-card-composer',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './card-composer.component.html',
  styleUrl: './card-composer.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CardComposerComponent {
  readonly placeholder = input('Enter a title for this card');
  readonly addLabel = input('Add a card');
  readonly create = output<string>();

  readonly open = signal(false);
  readonly title = signal('');

  submit(): void {
    const value = this.title().trim();
    if (!value) return;
    this.create.emit(value);
    this.title.set('');
    this.open.set(false);
  }

  cancel(): void {
    this.title.set('');
    this.open.set(false);
  }
}
