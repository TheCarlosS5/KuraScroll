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
import { paperToneRoutes } from './routes/paper-tone-routes.js';
import { PaperToneService } from './services/paper-tone-service.js';
import { tabSessionRoutes } from './routes/tab-session-routes.js';
import { TabSessionService } from './services/tab-session-service.js';
import { deepZoomRoutes } from './routes/deep-zoom-routes.js';
import { DeepZoomTileService } from './services/deep-zoom-tile-service.js';
import { sfxOverlayRoutes } from './routes/sfx-overlay-routes.js';
import { SfxOverlayService } from './services/sfx-overlay-service.js';
import { guidedPanelRoutes } from './routes/guided-panel-routes.js';
import { GuidedPanelService } from './services/guided-panel-service.js';
import { lanCompanionRoutes } from './routes/lan-companion-routes.js';
import { LanCompanionService } from './services/lan-companion-service.js';
import { kineticParallaxRoutes } from './routes/kinetic-parallax-routes.js';
import { KineticParallaxService } from './services/kinetic-parallax-service.js';
import { readingRulerRoutes } from './routes/reading-ruler-routes.js';
import { ReadingRulerService } from './services/reading-ruler-service.js';
import { storageVaultRoutes } from './routes/storage-vault-routes.js';
import { StorageVaultService } from './services/storage-vault-service.js';
import { ambientSoundscapeRoutes } from './routes/ambient-soundscape-routes.js';
import { AmbientSoundscapeService } from './services/ambient-soundscape-service.js';
import { spineDewarpRoutes } from './routes/spine-dewarp-routes.js';
import { SpineDewarpService } from './services/spine-dewarp-service.js';
import { dialogueTTSRoutes } from './routes/dialogue-tts-routes.js';
import { DialogueTTSService } from './services/dialogue-tts-service.js';
import { pageSplitStitchRoutes } from './routes/page-split-stitch-routes.js';
import { PageSplitStitchService } from './services/page-split-stitch-service.js';
import { pageHalftoneRoutes } from './routes/page-halftone-routes.js';
import { PageHalftoneService } from './services/page-halftone-service.js';
import { pageMagnifierRoutes } from './routes/page-magnifier-routes.js';
import { PageMagnifierService } from './services/page-magnifier-service.js';
import { chapterTransitionRoutes } from './routes/chapter-transition-routes.js';
import { ChapterTransitionService } from './services/chapter-transition-service.js';
import { ambientBacklightRoutes } from './routes/ambient-backlight-routes.js';
import { AmbientBacklightService } from './services/ambient-backlight-service.js';
import { pageProjectionRoutes } from './routes/page-projection-routes.js';
import { PageProjectionService } from './services/page-projection-service.js';
import { pageAcousticsRoutes } from './routes/page-acoustics-routes.js';
import { PageAcousticsService } from './services/page-acoustics-service.js';
import { gazeAnchorRoutes } from './routes/gaze-anchor-routes.js';
import { GazeAnchorService } from './services/gaze-anchor-service.js';
import { smartCropRoutes } from './routes/smart-crop-routes.js';
import { SmartCropService } from './services/smart-crop-service.js';
import { cloudlessSyncRoutes } from './routes/cloudless-sync-routes.js';
import { CloudlessSyncService } from './services/cloudless-sync-service.js';
import { slidingWindowRoutes } from './routes/sliding-window-routes.js';
import { SlidingWindowService } from './services/sliding-window-service.js';
import { chunkedStreamRoutes } from './routes/chunked-stream-routes.js';
import { ChunkedStreamService } from './services/chunked-stream-service.js';
import { inertialScrollRoutes } from './routes/inertial-scroll-routes.js';
import { InertialScrollService } from './services/inertial-scroll-service.js';
import { dynamicToneRoutes } from './routes/dynamic-tone-routes.js';
import { DynamicToneService } from './services/dynamic-tone-service.js';
import { historyScrubberRoutes } from './routes/history-scrubber-routes.js';
import { HistoryScrubberService } from './services/history-scrubber-service.js';
import { chromaticFringeRoutes } from './routes/chromatic-fringe-routes.js';
import { ChromaticFringeService } from './services/chromatic-fringe-service.js';
import { ambientGlowRoutes } from './routes/ambient-glow-routes.js';
import { AmbientGlowService } from './services/ambient-glow-service.js';
import { pageCurlRoutes } from './routes/page-curl-routes.js';
import { PageCurlService } from './services/page-curl-service.js';
import { storageTierRoutes } from './routes/storage-tier-routes.js';
import { StorageTierService } from './services/storage-tier-service.js';
import { motionStabilizerRoutes } from './routes/motion-stabilizer-routes.js';
import { MotionStabilizerService } from './services/motion-stabilizer-service.js';
import { creaseShadowRoutes } from './routes/crease-shadow-routes.js';
import { CreaseShadowService } from './services/crease-shadow-service.js';
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
  paperToneService?: PaperToneService;
  tabSessionService?: TabSessionService;
  deepZoomService?: DeepZoomTileService;
  sfxOverlayService?: SfxOverlayService;
  guidedPanelService?: GuidedPanelService;
  lanCompanionService?: LanCompanionService;
  kineticParallaxService?: KineticParallaxService;
  readingRulerService?: ReadingRulerService;
  storageVaultService?: StorageVaultService;
  ambientSoundscapeService?: AmbientSoundscapeService;
  spineDewarpService?: SpineDewarpService;
  dialogueTTSService?: DialogueTTSService;
  pageSplitStitchService?: PageSplitStitchService;
  pageHalftoneService?: PageHalftoneService;
  pageMagnifierService?: PageMagnifierService;
  chapterTransitionService?: ChapterTransitionService;
  ambientBacklightService?: AmbientBacklightService;
  pageProjectionService?: PageProjectionService;
  pageAcousticsService?: PageAcousticsService;
  gazeAnchorService?: GazeAnchorService;
  smartCropService?: SmartCropService;
  cloudlessSyncService?: CloudlessSyncService;
  slidingWindowService?: SlidingWindowService;
  chunkedStreamService?: ChunkedStreamService;
  inertialScrollService?: InertialScrollService;
  dynamicToneService?: DynamicToneService;
  historyScrubberService?: HistoryScrubberService;
  chromaticFringeService?: ChromaticFringeService;
  ambientGlowService?: AmbientGlowService;
  pageCurlService?: PageCurlService;
  storageTierService?: StorageTierService;
  motionStabilizerService?: MotionStabilizerService;
  creaseShadowService?: CreaseShadowService;
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
  app.register(paperToneRoutes, {
    db,
    paperToneService: options.paperToneService ?? new PaperToneService(db),
  });
  app.register(tabSessionRoutes, {
    db,
    tabSessionService: options.tabSessionService ?? new TabSessionService(db),
  });
  app.register(deepZoomRoutes, {
    db,
    deepZoomService:
      options.deepZoomService ??
      new DeepZoomTileService({
        db,
        storageRoot,
      }),
  });
  app.register(sfxOverlayRoutes, {
    db,
    sfxService: options.sfxOverlayService ?? new SfxOverlayService(db),
  });
  app.register(guidedPanelRoutes, {
    db,
    guidedPanelService: options.guidedPanelService ?? new GuidedPanelService(db),
  });
  app.register(lanCompanionRoutes, {
    db,
    lanCompanionService: options.lanCompanionService ?? new LanCompanionService(db),
  });
  app.register(kineticParallaxRoutes, {
    db,
    kineticParallaxService: options.kineticParallaxService ?? new KineticParallaxService(db),
  });
  app.register(readingRulerRoutes, {
    db,
    readingRulerService: options.readingRulerService ?? new ReadingRulerService(db),
  });
  app.register(storageVaultRoutes, {
    db,
    storageVaultService: options.storageVaultService ?? new StorageVaultService(db),
  });
  app.register(ambientSoundscapeRoutes, {
    db,
    soundscapeService: options.ambientSoundscapeService ?? new AmbientSoundscapeService(db),
  });
  app.register(spineDewarpRoutes, {
    db,
    spineDewarpService: options.spineDewarpService ?? new SpineDewarpService(db),
  });
  app.register(dialogueTTSRoutes, {
    db,
    dialogueTTSService: options.dialogueTTSService ?? new DialogueTTSService(db),
  });
  app.register(pageSplitStitchRoutes, {
    db,
    pageSplitStitchService: options.pageSplitStitchService ?? new PageSplitStitchService(db),
  });
  app.register(pageHalftoneRoutes, {
    db,
    pageHalftoneService: options.pageHalftoneService ?? new PageHalftoneService(db),
  });
  app.register(pageMagnifierRoutes, {
    db,
    pageMagnifierService: options.pageMagnifierService ?? new PageMagnifierService(db),
  });
  app.register(chapterTransitionRoutes, {
    db,
    chapterTransitionService: options.chapterTransitionService ?? new ChapterTransitionService(db),
  });
  app.register(ambientBacklightRoutes, {
    db,
    ambientBacklightService: options.ambientBacklightService ?? new AmbientBacklightService(db),
  });
  app.register(pageProjectionRoutes, {
    db,
    pageProjectionService: options.pageProjectionService ?? new PageProjectionService(db),
  });
  app.register(pageAcousticsRoutes, {
    db,
    pageAcousticsService: options.pageAcousticsService ?? new PageAcousticsService(db),
  });
  app.register(gazeAnchorRoutes, {
    db,
    gazeAnchorService: options.gazeAnchorService ?? new GazeAnchorService(db),
  });
  app.register(smartCropRoutes, {
    db,
    smartCropService: options.smartCropService ?? new SmartCropService(db),
  });
  app.register(cloudlessSyncRoutes, {
    db,
    cloudlessSyncService: options.cloudlessSyncService ?? new CloudlessSyncService(db),
  });
  app.register(slidingWindowRoutes, {
    db,
    slidingWindowService: options.slidingWindowService ?? new SlidingWindowService(db),
  });
  app.register(chunkedStreamRoutes, {
    db,
    chunkedStreamService: options.chunkedStreamService ?? new ChunkedStreamService(db),
  });
  app.register(inertialScrollRoutes, {
    db,
    inertialScrollService: options.inertialScrollService ?? new InertialScrollService(db),
  });
  app.register(dynamicToneRoutes, {
    db,
    dynamicToneService: options.dynamicToneService ?? new DynamicToneService(db),
  });
  app.register(historyScrubberRoutes, {
    db,
    historyScrubberService: options.historyScrubberService ?? new HistoryScrubberService(db),
  });
  app.register(chromaticFringeRoutes, {
    db,
    chromaticFringeService: options.chromaticFringeService ?? new ChromaticFringeService(db),
  });
  app.register(ambientGlowRoutes, {
    db,
    ambientGlowService: options.ambientGlowService ?? new AmbientGlowService(db),
  });
  app.register(pageCurlRoutes, {
    db,
    pageCurlService: options.pageCurlService ?? new PageCurlService(db),
  });
  app.register(storageTierRoutes, {
    db,
    storageTierService: options.storageTierService ?? new StorageTierService(db),
  });
  app.register(motionStabilizerRoutes, {
    db,
    motionStabilizerService: options.motionStabilizerService ?? new MotionStabilizerService(db),
  });
  app.register(creaseShadowRoutes, {
    db,
    creaseShadowService: options.creaseShadowService ?? new CreaseShadowService(db),
  });

  return app;
}
