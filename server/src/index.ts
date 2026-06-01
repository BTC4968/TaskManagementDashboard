import { config as loadEnv } from 'dotenv';
import { createServer } from 'node:http';
import { createYoga } from 'graphql-yoga';
import { useServer } from 'graphql-ws/use/ws';
import { WebSocketServer } from 'ws';
import cors from 'cors';
import express from 'express';
import { schema } from './resolvers.js';
import './seed.js';

loadEnv();

const PORT = Number(process.env.PORT) || 4000;
const HOST = process.env.HOST ?? '0.0.0.0';
const corsOrigins = process.env.CORS_ORIGINS?.split(',').map((o) => o.trim()).filter(Boolean);
const yogaCorsOrigin: string | string[] = corsOrigins?.length ? corsOrigins : '*';

const yoga = createYoga({
  schema,
  graphqlEndpoint: '/graphql',
  landingPage: true,
  cors: {
    origin: yogaCorsOrigin,
    credentials: true,
  },
});

const app = express();
app.use(
  cors({
    origin: corsOrigins?.length ? corsOrigins : true,
    credentials: true,
  }),
);
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});
app.use(yoga);

const httpServer = createServer(app);

const wsServer = new WebSocketServer({
  server: httpServer,
  path: '/graphql',
});

useServer(
  {
    schema,
    onConnect: () => true,
  },
  wsServer,
);

httpServer.listen(PORT, HOST, () => {
  console.log(`GraphQL API ready at http://localhost:${PORT}/graphql`);
  console.log(`WebSocket subscriptions at ws://localhost:${PORT}/graphql`);
});
