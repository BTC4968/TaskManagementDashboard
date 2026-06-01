import { ChangeDetectionStrategy, Component, OnDestroy, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '@auth0/auth0-angular';
import { AsyncPipe } from '@angular/common';
import { ToastContainerComponent } from './core/toast/toast-container.component';
import { disposeApolloWs } from './core/apollo/create-apollo';
import { environment } from '../environments/environment';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, ToastContainerComponent, AsyncPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="app-shell">
      <nav class="top-nav">
        <a routerLink="/dashboard" class="brand">Task Dashboard</a>
        <div class="nav-links">
          <a routerLink="/dashboard" routerLinkActive="active">Dashboard</a>
          @if (!devBypass && (auth?.isAuthenticated$ | async)) {
            <button type="button" class="link-btn" (click)="logout()">Sign out</button>
          }
          @if (devBypass) {
            <span class="dev-badge">Dev auth</span>
          }
        </div>
      </nav>
      <main>
        <router-outlet />
      </main>
      <app-toast-container />
    </div>
  `,
  styles: `
    .app-shell { min-height: 100vh; display: flex; flex-direction: column; }
    .top-nav {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.75rem 1.5rem;
      background: #0f172a;
      color: #f8fafc;
    }
    .brand { font-weight: 700; color: #fff; text-decoration: none; }
    .nav-links { display: flex; align-items: center; gap: 1rem; }
    .nav-links a { color: #cbd5e1; text-decoration: none; font-size: 0.875rem; }
    .nav-links a.active { color: #fff; }
    .link-btn {
      border: none;
      background: transparent;
      color: #cbd5e1;
      cursor: pointer;
      font-size: 0.875rem;
    }
    .dev-badge {
      font-size: 0.6875rem;
      text-transform: uppercase;
      background: #334155;
      padding: 0.2rem 0.5rem;
      border-radius: 4px;
    }
    main { flex: 1; padding: 1.5rem; background: #f8fafc; }
  `,
})
export class AppComponent implements OnDestroy {
  readonly auth = inject(AuthService, { optional: true });
  readonly devBypass = environment.devAuthBypass;

  logout(): void {
    this.auth?.logout({ logoutParams: { returnTo: window.location.origin } });
  }

  ngOnDestroy(): void {
    disposeApolloWs();
  }
}
