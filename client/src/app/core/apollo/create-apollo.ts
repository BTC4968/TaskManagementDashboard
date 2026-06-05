import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { ApolloClientOptions, InMemoryCache, split } from '@apollo/client/core';
import { onError } from '@apollo/client/link/error';
import { setContext } from '@apollo/client/link/context';
import { HttpLink } from 'apollo-angular/http';
import { GraphQLWsLink } from '@apollo/client/link/subscriptions';
import { createClient } from 'graphql-ws';
import { getMainDefinition } from '@apollo/client/utilities';
import { environment } from '../../../environments/environment';
import { TokenService } from '../auth/token.service';

let wsClient: ReturnType<typeof createClient> | null = null;

export function createApolloOptions(httpLink: HttpLink): ApolloClientOptions<unknown> {
  const tokenService = inject(TokenService);
  const router = inject(Router);

  const errorLink = onError(({ graphQLErrors }) => {
    const mismatch = graphQLErrors?.find((e) => e.extensions?.['code'] === 'AUTH_PROVIDER_MISMATCH');
    if (mismatch) {
      const providers = (mismatch.extensions?.['expectedProviders'] as string[] | undefined) ?? [];
      void router.navigate(['/wrong-provider'], { queryParams: providers.length ? { provider: providers } : {} });
    }
  });

  const authLink = setContext(async (_, { headers }) => {
    const token = await tokenService.getAccessToken();
    return {
      headers: {
        ...headers,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    };
  });

  const http = httpLink.create({ uri: environment.graphqlHttpUri });

  if (wsClient) {
    wsClient.dispose();
    wsClient = null;
  }

  wsClient = createClient({
    url: environment.graphqlWsUri,
    connectionParams: async () => {
      const token = await tokenService.getAccessToken();
      return token ? { authorization: `Bearer ${token}` } : {};
    },
    retryAttempts: 5,
    shouldRetry: () => true,
    lazy: true,
  });

  const wsLink = new GraphQLWsLink(wsClient);

  const splitLink = split(
    ({ query }) => {
      const definition = getMainDefinition(query);
      return definition.kind === 'OperationDefinition' && definition.operation === 'subscription';
    },
    wsLink,
    errorLink.concat(authLink.concat(http)),
  );

  return {
    link: splitLink,
    cache: new InMemoryCache({
      typePolicies: {
        Query: {
          fields: {
            tasks: {
              keyArgs: ['filter', 'sort'],
              merge: false,
            },
          },
        },
      },
    }),
    defaultOptions: {
      watchQuery: { fetchPolicy: 'cache-and-network' },
      query: { fetchPolicy: 'network-only' },
    },
  };
}

export function disposeApolloWs(): void {
  wsClient?.dispose();
  wsClient = null;
}
