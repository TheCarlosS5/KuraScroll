import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import path from 'node:path';
import fs from 'node:fs';
import { DatabaseInstance, createDatabase, runMigrations } from './db/database.js';
import { registerSeriesRoutes } from './routes/series-routes.js';
import { registerChapterRoutes } from './routes/chapter-routes.js';
import { registerProgressRoutes } from './routes/progress-routes.js';

export interface AppOptions {
  db?: DatabaseInstance;
  storageRoot?: string;
  bodyLimit?: number;
}

export function buildApp(options: AppOptions = {}): FastifyInstance {
  const bodyLimit = options.bodyLimit ?? 1048576; // Default: 1MB body limit
  const app = Fastify({
    logger: false,
    bodyLimit,
  });

  const storageRoot = options.storageRoot
    ? path.resolve(options.storageRoot)
    : path.resolve('./data/storage');

  if (!fs.existsSync(storageRoot)) {
    fs.mkdirSync(storageRoot, { recursive: true });
  }

  const db = options.db ?? (() => {
    const defaultDbPath = path.resolve('./data/kura-scroll.db');
    const instance = createDatabase(defaultDbPath);
    runMigrations(instance);
    return instance;
  })();

  // Enable CORS for local development and companion apps
  app.register(cors, {
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  });

  // Serve 4TB storage assets with immutable long-term caching
  app.register(fastifyStatic, {
    root: storageRoot,
    prefix: '/storage/',
    maxAge: '1y',
    immutable: true,
    cacheControl: true,
  });

  // Health check
  app.get('/health', async () => {
    return {
      status: 'ok',
      service: 'kura-scroll-backend',
      timestamp: new Date().toISOString(),
    };
  });

  // Register domain route modules
  registerSeriesRoutes(app, db);
  registerChapterRoutes(app, db, storageRoot);
  registerProgressRoutes(app, db);

  return app;
}
