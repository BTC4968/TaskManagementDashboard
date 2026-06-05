import { GraphQLError } from 'graphql';
import type { DbClient } from '../../db/pool.js';
import { providerFromSub } from './mappers.js';
import type { UserIdentityRow } from './db-types.js';

const PROVIDER_LABELS: Record<string, string> = {
  'google-oauth2': 'Google',
  auth0: 'email and password',
  github: 'GitHub',
  facebook: 'Facebook',
  apple: 'Apple',
  windowslive: 'Microsoft',
  linkedin: 'LinkedIn',
};

export function providerDisplayName(provider: string): string {
  return PROVIDER_LABELS[provider] ?? provider;
}

export function authProviderMismatchError(registered: Iterable<string>): GraphQLError {
  const providers = [...new Set(registered)];
  const labels = providers.map(providerDisplayName);
  const label =
    labels.length === 1
      ? labels[0]
      : labels.length === 2
        ? `${labels[0]} or ${labels[1]}`
        : `${labels.slice(0, -1).join(', ')}, or ${labels[labels.length - 1]}`;

  const message =
    labels.length === 1
      ? `This account was created with ${label}. Please sign in with ${label}.`
      : `This account uses ${label}. Please sign in with one of those methods.`;

  return new GraphQLError(message, {
    extensions: { code: 'AUTH_PROVIDER_MISMATCH', expectedProviders: providers },
  });
}

export function assertSignInProviderAllowed(incomingSub: string, registered: Set<string>): void {
  const incoming = providerFromSub(incomingSub);
  if (!registered.has(incoming)) {
    throw authProviderMismatchError(registered);
  }
}

export async function registeredProvidersForProfile(db: DbClient, profileSub: string): Promise<Set<string>> {
  const result = await db.query<UserIdentityRow>(
    `SELECT auth0_sub, profile_auth0_sub, provider, created_at
     FROM user_identities
     WHERE profile_auth0_sub = $1
     ORDER BY created_at ASC`,
    [profileSub],
  );
  const providers = new Set(result.rows.map((row) => row.provider || providerFromSub(row.auth0_sub)));
  if (!providers.size) {
    providers.add(providerFromSub(profileSub));
  }
  return providers;
}
