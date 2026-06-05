import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { ProfileService } from './profile.service';

function wrongProviderRedirect(router: Router, error: unknown) {
  const providers = extractExtension<string[]>(error, 'expectedProviders') ?? [];
  return router.createUrlTree(['/wrong-provider'], { queryParams: providers.length ? { provider: providers } : {} });
}

function extractExtension<T>(error: unknown, key: string): T | null {
  if (!error || typeof error !== 'object') return null;
  const candidate = error as { graphQLErrors?: Array<{ extensions?: Record<string, unknown> }> };
  const ext = candidate.graphQLErrors?.[0]?.extensions;
  return ext ? (ext[key] as T) ?? null : null;
}

export const profileGuard: CanActivateFn = (_route, state) => {
  const profile = inject(ProfileService);
  const router = inject(Router);

  const cached = profile.me();
  if (cached?.isOnboarded) {
    return true;
  }
  if (cached && !cached.isOnboarded) {
    return router.createUrlTree(['/onboarding/profile'], {
      queryParams: state.url === '/onboarding/profile' ? undefined : { returnUrl: state.url },
    });
  }

  return profile.ensureMe().pipe(
    map((me) => {
      if (me?.isOnboarded) {
        return true;
      }

      return router.createUrlTree(['/onboarding/profile'], {
        queryParams: state.url === '/onboarding/profile' ? undefined : { returnUrl: state.url },
      });
    }),
    catchError((error: unknown) => {
      if (hasGraphqlCode(error, 'AUTH_PROVIDER_MISMATCH')) {
        return of(wrongProviderRedirect(router, error));
      }
      if (hasGraphqlCode(error, 'UNAUTHENTICATED')) {
        return of(router.createUrlTree(['/login']));
      }
      return of(router.createUrlTree(['/login']));
    }),
  );
};

export function hasGraphqlCode(error: unknown, code: string): boolean {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as {
    graphQLErrors?: Array<{ extensions?: { code?: string } }>;
    networkError?: { result?: { errors?: Array<{ extensions?: { code?: string } }> } };
  };
  return (
    candidate.graphQLErrors?.some((item) => item.extensions?.code === code) === true ||
    candidate.networkError?.result?.errors?.some((item) => item.extensions?.code === code) === true
  );
}
