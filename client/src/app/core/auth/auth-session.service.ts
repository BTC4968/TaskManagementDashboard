import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '@auth0/auth0-angular';
import { Apollo } from 'apollo-angular';
import { disposeApolloWs } from '../apollo/create-apollo';
import { TokenService } from './token.service';

@Injectable({ providedIn: 'root' })
export class AuthSessionService {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly tokenService = inject(TokenService);
  private readonly apollo = inject(Apollo);

  logout(): void {
    this.tokenService.clear();
    disposeApolloWs();
    void this.apollo.client.clearStore();

    // Federated logout redirects to Auth0 /v2/logout to clear the SSO session
    // cookie, then Auth0 redirects back to /login (must be in Auth0 "Allowed
    // Logout URLs" — currently http://localhost:4200/login).
    // Fallback navigation in case the redirect doesn't happen.
    this.auth
      .logout({
        logoutParams: {
          returnTo: window.location.origin + '/login',
        },
      })
      .subscribe({
        next: () => void this.router.navigateByUrl('/login'),
        error: () => void this.router.navigateByUrl('/login'),
      });
  }
}
