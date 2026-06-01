import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '@auth0/auth0-angular';

@Component({
  selector: 'app-callback',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<p class="loading">Completing sign-in…</p>`,
  styles: `
    .loading { text-align: center; padding: 3rem; color: #64748b; }
  `,
})
export class CallbackComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  ngOnInit(): void {
    this.auth.isAuthenticated$.subscribe((ok) => {
      if (ok) {
        void this.router.navigate(['/dashboard']);
      }
    });
  }
}
