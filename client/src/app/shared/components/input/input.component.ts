import { Component, ChangeDetectionStrategy, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-input',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './input.component.html',
  styleUrl: './input.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InputComponent {
  readonly label = input<string>('');
  readonly placeholder = input<string>('');
  readonly type = input<string>('text');
  readonly disabled = input(false);
  readonly error = input<string>('');
  readonly value = signal<string>('');

  readonly valueChange = output<string>();

  onValueChange(newValue: string): void {
    this.value.set(newValue);
    this.valueChange.emit(newValue);
  }
}
