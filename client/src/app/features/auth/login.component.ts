import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { AuthService } from '@auth0/auth0-angular';
import { RouterLink } from '@angular/router';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="login-card">
      <h1>Sign in</h1>
      <p>Enterprise SSO via Auth0</p>
      @if (devBypass) {
        <a routerLink="/dashboard" class="btn-primary">Continue (dev bypass)</a>
        <p class="hint">Set <code>devAuthBypass: false</code> and configure Auth0 for production.</p>
      } @else {
        <button type="button" class="btn-primary" (click)="login()">Sign in with Auth0</button>
      }
    </div>
  `,
  styles: `
    :host {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 60vh;
    }
    .login-card {
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 16px;
      padding: 2rem;
      text-align: center;
      max-width: 24rem;
      width: 100%;
    }
    .btn-primary {
      display: inline-block;
      margin-top: 1rem;
      padding: 0.75rem 1.5rem;
      background: #2563eb;
      color: #fff;
      border: none;
      border-radius: 8px;
      font-weight: 600;
      text-decoration: none;
      cursor: pointer;
    }
    .hint { font-size: 0.8125rem; color: #64748b; margin-top: 1rem; }
  `,
})
export class LoginComponent {
  private readonly auth = inject(AuthService, { optional: true });
  readonly devBypass = environment.devAuthBypass;

  login(): void {
    this.auth?.loginWithRedirect();
  }
}
