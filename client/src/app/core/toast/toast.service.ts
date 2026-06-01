import { Injectable, signal } from '@angular/core';

export type ToastKind = 'success' | 'error' | 'info' | 'warning';

export interface ToastMessage {
  id: string;
  kind: ToastKind;
  message: string;
  key?: string;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly toasts = signal<ToastMessage[]>([]);
  private readonly recentKeys = new Map<string, number>();

  show(kind: ToastKind, message: string, durationMs = 4500, key?: string): void {
    const dedupeKey = key ?? `${kind}:${message}`;
    const now = Date.now();
    const recentAt = this.recentKeys.get(dedupeKey);
    if (this.toasts().some((toast) => toast.key === dedupeKey) || (recentAt && now - recentAt < durationMs)) {
      return;
    }
    this.recentKeys.set(dedupeKey, now);
    const id = crypto.randomUUID();
    this.toasts.update((list) => [...list, { id, kind, message, key: dedupeKey }].slice(-4));
    window.setTimeout(() => {
      this.dismiss(id);
      if (this.recentKeys.get(dedupeKey) === now) {
        this.recentKeys.delete(dedupeKey);
      }
    }, durationMs);
  }

  success(message: string, key?: string): void {
    this.show('success', message, 4500, key);
  }

  error(message: string, key?: string): void {
    this.show('error', message, 4500, key);
  }

  info(message: string, key?: string): void {
    this.show('info', message, 4500, key);
  }

  warning(message: string, key?: string): void {
    this.show('warning', message, 4500, key);
  }

  dismiss(id: string): void {
    this.toasts.update((list) => list.filter((t) => t.id !== id));
  }
}
