import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { AuthService } from '@auth0/auth0-angular';

@Component({
  selector: 'app-login',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="login-screen">
      <section class="login-panel">
        <h1>Project Board</h1>
        <p>Sign in with your enterprise account.</p>
        <button type="button" (click)="login()">Sign in with Auth0</button>
      </section>
    </main>
  `,
  styles: `
    .login-screen {
      min-height: 100vh;
      display: grid;
      place-items: center;
      background: var(--board-bg);
      padding: 24px;
    }
    .login-panel {
      width: min(360px, 100%);
      border-radius: 12px;
      background: var(--surface-raised);
      color: var(--text);
      box-shadow: var(--shadow-modal);
      padding: 28px;
      display: grid;
      gap: 12px;
    }
    h1, p { margin: 0; }
    button {
      border: 0;
      border-radius: var(--radius-2);
      background: var(--accent);
      color: #fff;
      padding: 10px 14px;
      font-weight: 700;
      cursor: pointer;
    }
  `,
})
export class LoginComponent {
  private readonly auth = inject(AuthService);

  login(): void {
    this.auth.loginWithRedirect();
  }
}
