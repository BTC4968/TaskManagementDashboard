import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { AuthSessionService } from '../../../core/auth/auth-session.service';

const PROVIDER_LABELS: Record<string, string> = {
  'google-oauth2': 'Google',
  auth0: 'email and password',
  github: 'GitHub',
  facebook: 'Facebook',
  apple: 'Apple',
  windowslive: 'Microsoft',
  linkedin: 'LinkedIn',
};

function displayLabel(provider: string): string {
  return PROVIDER_LABELS[provider] ?? provider;
}

@Component({
  selector: 'app-wrong-provider',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="verify-screen">
      <section class="verify-panel">
        <p class="eyebrow">Sign-in method mismatch</p>
        <h1>Wrong sign-in method</h1>
        <p class="subtitle">
          {{ message() }}
        </p>
        <div class="actions">
          <button type="button" class="primary" (click)="signInAgain()">Sign in again</button>
          <button type="button" class="secondary" (click)="logout()">Sign out</button>
        </div>
      </section>
    </main>
  `,
  styleUrl: './verify-email.component.scss',
})
export class WrongProviderComponent implements OnInit {
  private readonly authSession = inject(AuthSessionService);
  private readonly route = inject(ActivatedRoute);

  readonly message = signal<string>(
    'Your account was created with a different sign-in method. Please use the correct sign-in option below.',
  );

  ngOnInit(): void {
    const providers = this.route.snapshot.queryParamMap.getAll('provider');
    if (providers.length) {
      const labels = providers.map(displayLabel);
      const label =
        labels.length === 1
          ? labels[0]
          : `${labels.slice(0, -1).join(', ')} or ${labels[labels.length - 1]}`;
      this.message.set(
        `Your account was created with ${label}. Please sign in using ${label}.`,
      );
    }
  }

  signInAgain(): void {
    this.authSession.logout();
  }

  logout(): void {
    this.authSession.logout();
  }
}
