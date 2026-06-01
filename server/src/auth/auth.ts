import { GraphQLError } from 'graphql';
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';
import { env } from '../config/env.js';

export interface AuthUser {
  id: string;
  name: string | null;
  email: string | null;
}

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;
let jwtVerifierForTests: ((token: string) => Promise<JWTPayload>) | null = null;

function authError(message = 'Authentication required'): GraphQLError {
  return new GraphQLError(message, { extensions: { code: 'UNAUTHENTICATED' } });
}

function bearerToken(header: string | null | undefined): string | null {
  if (!header) {
    return null;
  }
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match?.[1] ?? null;
}

function userFromClaims(claims: JWTPayload): AuthUser {
  const sub = typeof claims.sub === 'string' ? claims.sub : null;
  if (!sub) {
    throw authError('Token is missing subject.');
  }

  return {
    id: sub,
    name: typeof claims.name === 'string' ? claims.name : null,
    email: typeof claims.email === 'string' ? claims.email : null,
  };
}

export async function authenticateHeader(header: string | null | undefined): Promise<AuthUser | null> {
  const token = bearerToken(header);
  if (!token) {
    return null;
  }

  try {
    const payload = jwtVerifierForTests
      ? await jwtVerifierForTests(token)
      : (
          await jwtVerify(token, (jwks ??= createRemoteJWKSet(new URL(`${env.auth0Issuer}.well-known/jwks.json`))), {
            issuer: env.auth0Issuer,
            audience: env.auth0Audience,
          })
        ).payload;
    return userFromClaims(payload);
  } catch {
    throw authError('Invalid or expired token.');
  }
}

export function setJwtVerifierForTests(verifier: ((token: string) => Promise<JWTPayload>) | null): void {
  if (env.nodeEnv !== 'test') {
    throw new Error('setJwtVerifierForTests can only be used when NODE_ENV=test.');
  }
  jwtVerifierForTests = verifier;
}

export async function authenticateConnectionParams(params: unknown): Promise<AuthUser | null> {
  if (!params || typeof params !== 'object') {
    return null;
  }
  const record = params as Record<string, unknown>;
  const value = record.authorization ?? record.Authorization;
  return authenticateHeader(typeof value === 'string' ? value : null);
}

export function requireUser(context: { user: AuthUser | null }): AuthUser {
  if (!context.user) {
    throw authError();
  }
  return context.user;
}
