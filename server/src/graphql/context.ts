import { authenticateConnectionParams, authenticateHeader, type AuthUser } from '../auth/auth.js';

export interface GraphQLContext {
  user: AuthUser | null;
}

export async function createHttpContext(request: Request): Promise<GraphQLContext> {
  return {
    user: await authenticateHeader(request.headers.get('authorization')),
  };
}

export async function createWsContext(connectionParams: unknown): Promise<GraphQLContext> {
  return {
    user: await authenticateConnectionParams(connectionParams),
  };
}
