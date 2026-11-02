import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import path from 'node:path';
import fs from 'node:fs';
import { DatabaseInstance, createDatabase, runMigrations } from './db/database.js';
import { registerSeriesRoutes } from './routes/series-routes.js';
import { registerChapterRoutes } from './routes/chapter-routes.js';
import { registerProgressRoutes } from './routes/progress-routes.js';
import { registerAnalyticsRoutes } from './routes/analytics-routes.js';
import { registerBadgeRoutes } from './routes/badge-routes.js';
import { registerRecommendationRoutes } from './routes/recommendation-routes.js';
import { registerPreferenceRoutes } from './routes/preference-routes.js';
import { bookmarkRoutes } from './routes/bookmark-routes.js';
import { registerSyncRoutes } from './routes/sync-routes.js';
import { registerStatsRoutes } from './routes/stats-routes.js';
import { registerHealthRoutes } from './routes/health-routes.js';
import { registerBackupRoutes } from './routes/backup-routes.js';
import { BackupDaemon } from './daemon/backup-daemon.js';
import { registerEventRoutes, EventBus } from './events/event-bus.js';
import { registerTelemetryRoutes } from './routes/telemetry-routes.js';
import { registerMaintenanceRoutes } from './routes/maintenance-routes.js';
import { dedupRoutes } from './routes/dedup-routes.js';
import { p2pRoutes } from './routes/p2p-routes.js';
import { dwellRoutes } from './routes/dwell-routes.js';
import { bubbleRoutes } from './routes/bubble-routes.js';
import { vectorRoutes } from './routes/vector-routes.js';
import { recapRoutes } from './routes/recap-routes.js';
import { audioRoutes } from './routes/audio-routes.js';
import { eyeCareRoutes } from './routes/eye-care-routes.js';
import { spreadRoutes } from './routes/spread-routes.js';
import { annotationRoutes } from './routes/annotation-routes.js';
import { cadenceRoutes } from './routes/cadence-routes.js';
import { frameTelemetryRoutes } from './routes/frame-telemetry-routes.js';
import { registerPanelRoutes } from './routes/panel-routes.js';
import { PanelDetectionService } from './services/panel-detection-service.js';
import { immersionRoutes } from './routes/immersion-routes.js';
import { ImmersionService } from './services/immersion-service.js';
import { cbzStreamRoutes } from './routes/cbz-stream-routes.js';
import { CbzStreamService } from './services/cbz-stream-service.js';
import { transcodeRoutes } from './routes/transcode-routes.js';
import { TranscodeCacheService } from './services/transcode-cache-service.js';
import { prefetchRoutes } from './routes/prefetch-routes.js';
import { PredictivePrefetchDaemon } from './services/predictive-prefetch-daemon.js';
import { dialogueSearchRoutes } from './routes/dialogue-search-routes.js';
import { DialogueSearchService } from './services/dialogue-search-service.js';
import { spatialHeatmapRoutes } from './routes/spatial-heatmap-routes.js';
import { SpatialHeatmapService } from './services/spatial-heatmap-service.js';
import { furiganaLexiconRoutes } from './routes/furigana-lexicon-routes.js';
import { FuriganaLexiconService } from './services/furigana-lexicon-service.js';
import { platterDefragRoutes } from './routes/platter-defrag-routes.js';
import { PlatterDefragService } from './services/platter-defrag-service.js';
import { AdaptiveIngestionController } from './services/adaptive-ingestion-controller.js';
import { DifferentialMirrorService } from './services/differential-mirror-service.js';

export interface AppOptions {
  db?: DatabaseInstance;
  storageRoot?: string;
  bodyLimit?: number;
  backupDaemon?: BackupDaemon;
  eventBus?: EventBus;
  folderWatcher?: { active: boolean; incomingDir?: string };
  adaptiveController?: AdaptiveIngestionController;
  differentialMirror?: DifferentialMirrorService;
  platterDefragService?: PlatterDefragService;
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
  registerAnalyticsRoutes(app, db);
  registerBadgeRoutes(app, db);
  registerRecommendationRoutes(app, db);
  registerPreferenceRoutes(app, db);
  app.register(bookmarkRoutes, { db });
  registerSyncRoutes(app, db);
  registerStatsRoutes(app, db);

  const backupDaemon = options.backupDaemon ?? new BackupDaemon({
    db,
    backupDir: path.resolve(storageRoot, 'backups'),
  });

  // Latency monitoring hook for Adaptive Ingestion Controller
  if (options.adaptiveController) {
    const controller = options.adaptiveController;
    app.addHook('onRequest', async (req) => {
      (req as any)._startTimeNs = process.hrtime.bigint();
    });
    app.addHook('onResponse', async (req) => {
      const start = (req as any)._startTimeNs;
      if (start) {
        const elapsedNs = process.hrtime.bigint() - start;
        const elapsedMs = Number(elapsedNs) / 1_000_000;
        controller.recordApiLatency(elapsedMs);
      }
    });
  }

  registerHealthRoutes(app, {
    db,
    storageRoot,
    folderWatcher: options.folderWatcher,
    backupDaemon,
  });

  const differentialMirror =
    options.differentialMirror ??
    new DifferentialMirrorService({
      db,
      storageRoot,
      adaptiveController: options.adaptiveController,
    });

  registerBackupRoutes(app, db, backupDaemon, differentialMirror);
  registerEventRoutes(app, options.eventBus);
  registerTelemetryRoutes(app, { db, storageRoot, adaptiveController: options.adaptiveController });
  registerMaintenanceRoutes(app, { db, storageRoot });
  app.register(dedupRoutes, { db });
  app.register(p2pRoutes);
  app.register(dwellRoutes, { db });
  app.register(bubbleRoutes, { db });
  app.register(vectorRoutes, { db });
  app.register(recapRoutes, { db });
  app.register(audioRoutes, { db });
  app.register(eyeCareRoutes, { db });
  app.register(spreadRoutes, { db });
  app.register(annotationRoutes, { db });
  app.register(cadenceRoutes, { db });
  app.register(frameTelemetryRoutes, { db });
  app.register(registerPanelRoutes, { panelService: new PanelDetectionService(db) });
  app.register(immersionRoutes, { immersionService: new ImmersionService(db) });
  app.register(cbzStreamRoutes, { db, cbzStreamService: new CbzStreamService(db) });
  const transcodeCacheService = new TranscodeCacheService(db, path.resolve(storageRoot, 'cache'));
  app.register(transcodeRoutes, {
    db,
    transcodeCacheService,
  });
  const prefetchDaemon = new PredictivePrefetchDaemon({
    transcodeCache: transcodeCacheService,
    storageRoot,
  });
  app.register(prefetchRoutes, {
    db,
    prefetchDaemon,
  });
  app.register(dialogueSearchRoutes, {
    db,
    dialogueService: new DialogueSearchService(db),
  });
  app.register(spatialHeatmapRoutes, {
    db,
    spatialHeatmapService: new SpatialHeatmapService(db),
  });
  app.register(furiganaLexiconRoutes, {
    db,
    lexiconService: new FuriganaLexiconService(db),
  });
  app.register(platterDefragRoutes, {
    db,
    defragService: options.platterDefragService ?? new PlatterDefragService(db),
  });

  return app;
}
