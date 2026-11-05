# Matriz de Control de Acceso de Rutas HTTP (KuraScroll Web Pública)

**Estado:** Borrador (Draft) - En Revisión  
**Fecha:** 2026-11-04  
**Referencia:** Código fuente verificado en `src/backend/app.ts` y `src/backend/routes/*.ts`  
**Total de rutas registradas inspeccionadas:** 138

> [!IMPORTANT]
> Este documento es un **borrador técnico en revisión**. Se derivó directamente de los endpoints actualmente registrados en el backend para evitar rutas inventadas o desalineadas con la implementación real.

---

## 1. Reglas Globales de Seguridad

1. **Derivación de identidad:** Cualquier ruta clasificada como `Usuario Autenticado` o `Administrador` deriva el `userId` exclusivamente de la cookie de sesión `kura_session` validada por el servidor (`request.sessionIdentity`). Cualquier `userId` o `x-user-id` recibido del cliente en headers, query o body es ignorado o rechazado.
2. **Denegación por defecto:** Cualquier endpoint o método no catalogado en esta matriz responde con `404 Not Found` en lecturas o `403 Forbidden` en peticiones de escritura.
3. **Manejo de API_TOKEN:** En despliegues públicos detrás de proxy HTTPS inverso, el proxy elimina `x-api-token` entrante del cliente e inyecta el token al upstream loopback (`127.0.0.1`). `API_TOKEN` nunca llega al navegador ni sustituye la sesión de usuario.
4. **Protección de Caché Privada:** Los endpoints de usuario autenticado (`/api/v1/progress`, `/api/v1/user/preferences`, etc.) responden con encabezado `Cache-Control: no-store` y están excluidos del Service Worker Cache API.

---

## 2. Inventario Completo de Rutas Registradas

| Método | Ruta HTTP Registrada | Acceso Requerido | Rol / Política | Notas y Archivo de Origen |
|---|---|---|---|---|
| GET | `/api/v1/acoustics/substrates` | Público | none | Lectura pública; elegible para caché offline del Service Worker si es GET (`page-acoustics-routes.ts`) |
| GET | `/api/v1/admin/dedup/history` | Administrador | admin | Operación administrativa interna protegida por requireRole("admin") (`dedup-routes.ts`) |
| GET | `/api/v1/admin/embeddings/stats` | Administrador | admin | Operación administrativa interna protegida por requireRole("admin") (`vector-routes.ts`) |
| POST | `/api/v1/admin/maintenance/compact` | Administrador | admin | Operación administrativa interna protegida por requireRole("admin") (`maintenance-routes.ts`) |
| GET | `/api/v1/admin/maintenance/status` | Administrador | admin | Operación administrativa interna protegida por requireRole("admin") (`maintenance-routes.ts`) |
| POST | `/api/v1/admin/self-heal` | Administrador | admin | Operación administrativa interna protegida por requireRole("admin") (`telemetry-routes.ts`) |
| POST | `/api/v1/analytics/activity` | Usuario Autenticado | user | Deriva userId de sessionIdentity; ignora valores en query/body; Cache-Control: no-store (`analytics-routes.ts`) |
| GET | `/api/v1/analytics/activity-heatmap` | Público | none | Lectura pública; elegible para caché offline del Service Worker si es GET (`stats-routes.ts`) |
| POST | `/api/v1/analytics/activity/buffered` | Usuario Autenticado | user | Deriva userId de sessionIdentity; ignora valores en query/body; Cache-Control: no-store (`analytics-routes.ts`) |
| POST | `/api/v1/analytics/dwell/flush` | Administrador | admin | Operación administrativa interna protegida por requireRole("admin") (`dwell-routes.ts`) |
| GET | `/api/v1/analytics/dwell/telemetry` | Público | none | Lectura pública; elegible para caché offline del Service Worker si es GET (`dwell-routes.ts`) |
| GET | `/api/v1/analytics/goals` | Usuario Autenticado | user | Deriva userId de sessionIdentity; ignora valores en query/body; Cache-Control: no-store (`analytics-routes.ts`) |
| PUT | `/api/v1/analytics/goals` | Usuario Autenticado | user | Deriva userId de sessionIdentity; ignora valores en query/body; Cache-Control: no-store (`analytics-routes.ts`) |
| GET | `/api/v1/analytics/reading-velocity` | Público | none | Lectura pública; elegible para caché offline del Service Worker si es GET (`recommendation-routes.ts`) |
| POST | `/api/v1/analytics/record-read` | Usuario Autenticado | user | Deriva userId de sessionIdentity; ignora valores en query/body; Cache-Control: no-store (`stats-routes.ts`) |
| GET | `/api/v1/analytics/spatial-heatmap/stats` | Público | none | Lectura pública; elegible para caché offline del Service Worker si es GET (`spatial-heatmap-routes.ts`) |
| GET | `/api/v1/analytics/stats-radar` | Público | none | Lectura pública; elegible para caché offline del Service Worker si es GET (`stats-routes.ts`) |
| GET | `/api/v1/analytics/streak` | Público | none | Lectura pública; elegible para caché offline del Service Worker si es GET (`analytics-routes.ts`) |
| POST | `/api/v1/analytics/velocity/sample` | Público | none | Lectura pública; elegible para caché offline del Service Worker si es GET (`recommendation-routes.ts`) |
| POST | `/api/v1/auth/forgot-password` | Público | none | Endpoints públicos de autenticación con rate-limiting (`auth-routes.ts`) |
| POST | `/api/v1/auth/login` | Público | none | Endpoints públicos de autenticación con rate-limiting (`auth-routes.ts`) |
| POST | `/api/v1/auth/logout` | Autenticado (Cookie) | user | Revoca sesión activa y limpia cookie (`auth-routes.ts`) |
| POST | `/api/v1/auth/register` | Público | none | Endpoints públicos de autenticación con rate-limiting (`auth-routes.ts`) |
| POST | `/api/v1/auth/reset-password` | Público | none | Endpoints públicos de autenticación con rate-limiting (`auth-routes.ts`) |
| GET | `/api/v1/auth/session` | Público / Opcional | none | Resuelve identidad o null; Cache-Control: no-store (`auth-routes.ts`) |
| GET | `/api/v1/auth/verify-email` | Público | none | Endpoints públicos de autenticación con rate-limiting (`auth-routes.ts`) |
| GET | `/api/v1/backup/export` | Administrador | admin | Operación administrativa interna protegida por requireRole("admin") (`backup-routes.ts`) |
| POST | `/api/v1/backup/import` | Administrador | admin | Operación administrativa interna protegida por requireRole("admin") (`backup-routes.ts`) |
| POST | `/api/v1/backup/mirror` | Administrador | admin | Operación administrativa interna protegida por requireRole("admin") (`backup-routes.ts`) |
| GET | `/api/v1/backup/mirror/history` | Administrador | admin | Operación administrativa interna protegida por requireRole("admin") (`backup-routes.ts`) |
| GET | `/api/v1/badges` | Público | none | Lectura pública; elegible para caché offline del Service Worker si es GET (`badge-routes.ts`) |
| POST | `/api/v1/badges/evaluate` | Usuario Autenticado | user | Deriva userId de sessionIdentity; ignora valores en query/body; Cache-Control: no-store (`badge-routes.ts`) |
| POST | `/api/v1/badges/notified` | Usuario Autenticado | user | Deriva userId de sessionIdentity; ignora valores en query/body; Cache-Control: no-store (`badge-routes.ts`) |
| GET | `/api/v1/badges/unnotified` | Usuario Autenticado | user | Deriva userId de sessionIdentity; ignora valores en query/body; Cache-Control: no-store (`badge-routes.ts`) |
| POST | `/api/v1/bookmarks` | Usuario Autenticado | user | Deriva userId de sessionIdentity; ignora valores en query/body; Cache-Control: no-store (`bookmark-routes.ts`) |
| DELETE | `/api/v1/bookmarks/:id` | Usuario Autenticado | user | Deriva userId de sessionIdentity; ignora valores en query/body; Cache-Control: no-store (`bookmark-routes.ts`) |
| POST | `/api/v1/cache/transcode/prune` | Administrador | admin | Operación administrativa interna protegida por requireRole("admin") (`transcode-routes.ts`) |
| GET | `/api/v1/cache/transcode/stats` | Público | none | Lectura pública; elegible para caché offline del Service Worker si es GET (`transcode-routes.ts`) |
| GET | `/api/v1/chapters/:chapterId` | Público | none | Lectura pública; elegible para caché offline del Service Worker si es GET (`chapter-routes.ts`) |
| GET | `/api/v1/chapters/:chapterId/bookmarks` | Público | none | Lectura pública; elegible para caché offline del Service Worker si es GET (`bookmark-routes.ts`) |
| DELETE | `/api/v1/chapters/:chapterId/bookmarks/:pageIndex` | Público | none | Lectura pública; elegible para caché offline del Service Worker si es GET (`bookmark-routes.ts`) |
| GET | `/api/v1/chapters/:chapterId/clusters` | Público | none | Lectura pública; elegible para caché offline del Service Worker si es GET (`cbz-stream-routes.ts`) |
| GET | `/api/v1/chapters/:chapterId/export/cbz` | Público | none | Lectura pública; elegible para caché offline del Service Worker si es GET (`chapter-routes.ts`) |
| GET | `/api/v1/chapters/:chapterId/offsets` | Público | none | Lectura pública; elegible para caché offline del Service Worker si es GET (`cbz-stream-routes.ts`) |
| GET | `/api/v1/chapters/:chapterId/pages/:pageFile` | Público | none | Lectura pública; elegible para caché offline del Service Worker si es GET (`chapter-routes.ts`) |
| GET | `/api/v1/chapters/:chapterId/pages/:pageNumber/stream` | Público | none | Lectura pública; elegible para caché offline del Service Worker si es GET (`cbz-stream-routes.ts`) |
| GET | `/api/v1/chapters/:chapterId/pages/:pageNumber/transcode` | Público | none | Lectura pública; elegible para caché offline del Service Worker si es GET (`transcode-routes.ts`) |
| POST | `/api/v1/chapters/ingest` | Administrador | admin | Operación administrativa interna protegida por requireRole("admin") (`chapter-routes.ts`) |
| POST | `/api/v1/dialogue/optimize` | Administrador | admin | Operación administrativa interna protegida por requireRole("admin") (`dialogue-search-routes.ts`) |
| GET | `/api/v1/dialogue/stats` | Público | none | Lectura pública; elegible para caché offline del Service Worker si es GET (`dialogue-search-routes.ts`) |
| GET | `/api/v1/health` | Público | none | Health check probe (`health-routes.ts`) |
| GET | `/api/v1/lexicon/stats` | Público | none | Lectura pública; elegible para caché offline del Service Worker si es GET (`furigana-lexicon-routes.ts`) |
| GET | `/api/v1/metrics/cache` | Público | none | Lectura pública; elegible para caché offline del Service Worker si es GET (`chapter-routes.ts`) |
| GET | `/api/v1/network/companion/active-devices` | Público | none | Lectura pública; elegible para caché offline del Service Worker si es GET (`lan-companion-routes.ts`) |
| GET | `/api/v1/network/lan-info` | Público | none | Lectura pública; elegible para caché offline del Service Worker si es GET (`lan-companion-routes.ts`) |
| POST | `/api/v1/network/qr-pair/create` | Público | none | Lectura pública; elegible para caché offline del Service Worker si es GET (`lan-companion-routes.ts`) |
| GET | `/api/v1/prefetch/stats` | Público | none | Lectura pública; elegible para caché offline del Service Worker si es GET (`prefetch-routes.ts`) |
| POST | `/api/v1/progress` | Usuario Autenticado | user | Deriva userId de sessionIdentity; ignora valores en query/body; Cache-Control: no-store (`progress-routes.ts`) |
| GET | `/api/v1/progress/:seriesId` | Usuario Autenticado | user | Deriva userId de sessionIdentity; ignora valores en query/body; Cache-Control: no-store (`progress-routes.ts`) |
| GET | `/api/v1/progress/recent` | Usuario Autenticado | user | Deriva userId de sessionIdentity; ignora valores en query/body; Cache-Control: no-store (`progress-routes.ts`) |
| GET | `/api/v1/projection/presets` | Público | none | Lectura pública; elegible para caché offline del Service Worker si es GET (`page-projection-routes.ts`) |
| GET | `/api/v1/reader/acoustic-reverb/presets` | Público | none | Lectura pública; elegible para caché offline del Service Worker si es GET (`acoustic-reverb-routes.ts`) |
| GET | `/api/v1/reader/adr-tone/presets` | Público | none | Lectura pública; elegible para caché offline del Service Worker si es GET (`adr-tone-routes.ts`) |
| GET | `/api/v1/reader/ambient-glow/presets` | Público | none | Lectura pública; elegible para caché offline del Service Worker si es GET (`ambient-glow-routes.ts`) |
| GET | `/api/v1/reader/anamorphic-seam/presets` | Público | none | Lectura pública; elegible para caché offline del Service Worker si es GET (`anamorphic-seam-routes.ts`) |
| GET | `/api/v1/reader/balloon-collision/presets` | Público | none | Lectura pública; elegible para caché offline del Service Worker si es GET (`balloon-collision-routes.ts`) |
| GET | `/api/v1/reader/balloon-font/presets` | Público | none | Lectura pública; elegible para caché offline del Service Worker si es GET (`balloon-font-routes.ts`) |
| GET | `/api/v1/reader/balloon-tail/presets` | Público | none | Lectura pública; elegible para caché offline del Service Worker si es GET (`balloon-tail-routes.ts`) |
| GET | `/api/v1/reader/bayer-dither/presets` | Público | none | Lectura pública; elegible para caché offline del Service Worker si es GET (`bayer-dither-routes.ts`) |
| GET | `/api/v1/reader/cellulose-relief/presets` | Público | none | Lectura pública; elegible para caché offline del Service Worker si es GET (`cellulose-relief-routes.ts`) |
| GET | `/api/v1/reader/chapter-seam/presets` | Público | none | Lectura pública; elegible para caché offline del Service Worker si es GET (`chapter-seam-routes.ts`) |
| GET | `/api/v1/reader/chroma-bleed/presets` | Público | none | Lectura pública; elegible para caché offline del Service Worker si es GET (`chroma-bleed-routes.ts`) |
| GET | `/api/v1/reader/chromatic-fringe/presets` | Público | none | Lectura pública; elegible para caché offline del Service Worker si es GET (`chromatic-fringe-routes.ts`) |
| GET | `/api/v1/reader/chunked-stream/presets` | Público | none | Lectura pública; elegible para caché offline del Service Worker si es GET (`chunked-stream-routes.ts`) |
| GET | `/api/v1/reader/cjk-kerning/presets` | Público | none | Lectura pública; elegible para caché offline del Service Worker si es GET (`cjk-kerning-routes.ts`) |
| GET | `/api/v1/reader/cloudless-sync/modes` | Público | none | Lectura pública; elegible para caché offline del Service Worker si es GET (`cloudless-sync-routes.ts`) |
| GET | `/api/v1/reader/cmyk-simulator/presets` | Público | none | Lectura pública; elegible para caché offline del Service Worker si es GET (`cmyk-simulator-routes.ts`) |
| GET | `/api/v1/reader/crease-shadow/presets` | Público | none | Lectura pública; elegible para caché offline del Service Worker si es GET (`crease-shadow-routes.ts`) |
| GET | `/api/v1/reader/dark-adaptation/presets` | Público | none | Lectura pública; elegible para caché offline del Service Worker si es GET (`dark-adaptation-routes.ts`) |
| GET | `/api/v1/reader/dynamic-tone/modes` | Público | none | Lectura pública; elegible para caché offline del Service Worker si es GET (`dynamic-tone-routes.ts`) |
| GET | `/api/v1/reader/eye-rest/presets` | Público | none | Lectura pública; elegible para caché offline del Service Worker si es GET (`eye-rest-routes.ts`) |
| GET | `/api/v1/reader/gaze-anchor/modes` | Público | none | Lectura pública; elegible para caché offline del Service Worker si es GET (`gaze-anchor-routes.ts`) |
| GET | `/api/v1/reader/gaze-vignette/presets` | Público | none | Lectura pública; elegible para caché offline del Service Worker si es GET (`gaze-vignette-routes.ts`) |
| GET | `/api/v1/reader/glyph-sharpener/presets` | Público | none | Lectura pública; elegible para caché offline del Service Worker si es GET (`glyph-sharpener-routes.ts`) |
| GET | `/api/v1/reader/halftone-grain/presets` | Público | none | Lectura pública; elegible para caché offline del Service Worker si es GET (`halftone-grain-routes.ts`) |
| GET | `/api/v1/reader/history-scrubber/presets` | Público | none | Lectura pública; elegible para caché offline del Service Worker si es GET (`history-scrubber-routes.ts`) |
| GET | `/api/v1/reader/inertial-scroll/presets` | Público | none | Lectura pública; elegible para caché offline del Service Worker si es GET (`inertial-scroll-routes.ts`) |
| GET | `/api/v1/reader/ink-bleed/presets` | Público | none | Lectura pública; elegible para caché offline del Service Worker si es GET (`ink-bleed-routes.ts`) |
| GET | `/api/v1/reader/ink-splatter/presets` | Público | none | Lectura pública; elegible para caché offline del Service Worker si es GET (`ink-splatter-routes.ts`) |
| GET | `/api/v1/reader/ink-trapping/presets` | Público | none | Lectura pública; elegible para caché offline del Service Worker si es GET (`ink-trapping-routes.ts`) |
| GET | `/api/v1/reader/lens-distortion/presets` | Público | none | Lectura pública; elegible para caché offline del Service Worker si es GET (`lens-distortion-routes.ts`) |
| GET | `/api/v1/reader/moire-suppressor/presets` | Público | none | Lectura pública; elegible para caché offline del Service Worker si es GET (`moire-suppressor-routes.ts`) |
| GET | `/api/v1/reader/motion-deblur/presets` | Público | none | Lectura pública; elegible para caché offline del Service Worker si es GET (`motion-deblur-routes.ts`) |
| GET | `/api/v1/reader/motion-stabilizer/presets` | Público | none | Lectura pública; elegible para caché offline del Service Worker si es GET (`motion-stabilizer-routes.ts`) |
| GET | `/api/v1/reader/page-bevel/presets` | Público | none | Lectura pública; elegible para caché offline del Service Worker si es GET (`page-bevel-routes.ts`) |
| GET | `/api/v1/reader/page-buffer/presets` | Público | none | Lectura pública; elegible para caché offline del Service Worker si es GET (`page-tile-recycler-routes.ts`) |
| GET | `/api/v1/reader/page-curl/presets` | Público | none | Lectura pública; elegible para caché offline del Service Worker si es GET (`page-curl-routes.ts`) |
| GET | `/api/v1/reader/panel-pacing/presets` | Público | none | Lectura pública; elegible para caché offline del Service Worker si es GET (`panel-pacing-routes.ts`) |
| GET | `/api/v1/reader/paper-lighting/presets` | Público | none | Lectura pública; elegible para caché offline del Service Worker si es GET (`paper-lighting-routes.ts`) |
| GET | `/api/v1/reader/reading-dwell/presets` | Público | none | Lectura pública; elegible para caché offline del Service Worker si es GET (`reading-dwell-routes.ts`) |
| GET | `/api/v1/reader/sliding-window/modes` | Público | none | Lectura pública; elegible para caché offline del Service Worker si es GET (`sliding-window-routes.ts`) |
| GET | `/api/v1/reader/smart-crop/modes` | Público | none | Lectura pública; elegible para caché offline del Service Worker si es GET (`smart-crop-routes.ts`) |
| GET | `/api/v1/reader/spatial-audio/presets` | Público | none | Lectura pública; elegible para caché offline del Service Worker si es GET (`spatial-audio-routes.ts`) |
| GET | `/api/v1/reader/speed-line/presets` | Público | none | Lectura pública; elegible para caché offline del Service Worker si es GET (`speed-line-routes.ts`) |
| GET | `/api/v1/reader/storage-tier/presets` | Público | none | Lectura pública; elegible para caché offline del Service Worker si es GET (`storage-tier-routes.ts`) |
| GET | `/api/v1/reader/text-equalizer/presets` | Público | none | Lectura pública; elegible para caché offline del Service Worker si es GET (`text-equalizer-routes.ts`) |
| GET | `/api/v1/reader/texture-atlas/presets` | Público | none | Lectura pública; elegible para caché offline del Service Worker si es GET (`texture-atlas-routes.ts`) |
| GET | `/api/v1/reader/tile-invalidation/presets` | Público | none | Lectura pública; elegible para caché offline del Service Worker si es GET (`tile-invalidation-routes.ts`) |
| GET | `/api/v1/reader/tile-prefetch/presets` | Público | none | Lectura pública; elegible para caché offline del Service Worker si es GET (`tile-prefetch-routes.ts`) |
| GET | `/api/v1/reader/tile-prefetch/ring-buffer` | Público | none | Lectura pública; elegible para caché offline del Service Worker si es GET (`tile-prefetch-routes.ts`) |
| GET | `/api/v1/reader/tone/presets` | Público | none | Lectura pública; elegible para caché offline del Service Worker si es GET (`paper-tone-routes.ts`) |
| GET | `/api/v1/reader/unsharp-mask/presets` | Público | none | Lectura pública; elegible para caché offline del Service Worker si es GET (`unsharp-mask-routes.ts`) |
| GET | `/api/v1/reader/vector-quantizer/presets` | Público | none | Lectura pública; elegible para caché offline del Service Worker si es GET (`vector-quantizer-routes.ts`) |
| GET | `/api/v1/reader/vignette-aperture/presets` | Público | none | Lectura pública; elegible para caché offline del Service Worker si es GET (`vignette-aperture-routes.ts`) |
| GET | `/api/v1/recommendations/personalized` | Público | none | Lectura pública; elegible para caché offline del Service Worker si es GET (`recommendation-routes.ts`) |
| GET | `/api/v1/series` | Público | none | Lectura pública; elegible para caché offline del Service Worker si es GET (`series-routes.ts`) |
| GET | `/api/v1/series/:seriesId/bookmarks` | Público | none | Lectura pública; elegible para caché offline del Service Worker si es GET (`bookmark-routes.ts`) |
| GET | `/api/v1/series/:seriesId/chapters/quick-index` | Público | none | Lectura pública; elegible para caché offline del Service Worker si es GET (`bookmark-routes.ts`) |
| GET | `/api/v1/series/:slug` | Público | none | Lectura pública; elegible para caché offline del Service Worker si es GET (`series-routes.ts`) |
| POST | `/api/v1/storage/cache/flush` | Administrador | admin | Operación administrativa interna protegida por requireRole("admin") (`telemetry-routes.ts`) |
| GET | `/api/v1/storage/platter/stats` | Público | none | Lectura pública; elegible para caché offline del Service Worker si es GET (`platter-defrag-routes.ts`) |
| GET | `/api/v1/storage/telemetry` | Público | none | Lectura pública; elegible para caché offline del Service Worker si es GET (`telemetry-routes.ts`) |
| POST | `/api/v1/sync/replay` | Usuario Autenticado | user | Deriva userId de sessionIdentity; ignora valores en query/body; Cache-Control: no-store (`sync-routes.ts`) |
| GET | `/api/v1/sync/status` | Usuario Autenticado | user | Deriva userId de sessionIdentity; ignora valores en query/body; Cache-Control: no-store (`sync-routes.ts`) |
| GET | `/api/v1/telemetry/adaptive` | Público | none | Lectura pública; elegible para caché offline del Service Worker si es GET (`telemetry-routes.ts`) |
| POST | `/api/v1/telemetry/adaptive/override` | Administrador | admin | Operación administrativa interna protegida por requireRole("admin") (`telemetry-routes.ts`) |
| GET | `/api/v1/telemetry/badges` | Público | none | Lectura pública; elegible para caché offline del Service Worker si es GET (`badge-routes.ts`) |
| GET | `/api/v1/telemetry/buffer` | Público | none | Lectura pública; elegible para caché offline del Service Worker si es GET (`analytics-routes.ts`) |
| POST | `/api/v1/telemetry/impact-batches` | Público | none | Lectura pública; elegible para caché offline del Service Worker si es GET (`immersion-routes.ts`) |
| GET | `/api/v1/telemetry/impact-summary` | Público | none | Lectura pública; elegible para caché offline del Service Worker si es GET (`immersion-routes.ts`) |
| GET | `/api/v1/telemetry/integrity` | Público | none | Lectura pública; elegible para caché offline del Service Worker si es GET (`telemetry-routes.ts`) |
| POST | `/api/v1/telemetry/integrity/scan` | Público | none | Lectura pública; elegible para caché offline del Service Worker si es GET (`telemetry-routes.ts`) |
| GET | `/api/v1/telemetry/io` | Público | none | Lectura pública; elegible para caché offline del Service Worker si es GET (`telemetry-routes.ts`) |
| GET | `/api/v1/user/preferences` | Usuario Autenticado | user | Deriva userId de sessionIdentity; ignora valores en query/body; Cache-Control: no-store (`preference-routes.ts`) |
| PUT | `/api/v1/user/preferences` | Usuario Autenticado | user | Deriva userId de sessionIdentity; ignora valores en query/body; Cache-Control: no-store (`preference-routes.ts`) |
| GET | `/api/v1/users/me/immersion-preferences` | Usuario Autenticado | user | Deriva userId de sessionIdentity; ignora valores en query/body; Cache-Control: no-store (`immersion-routes.ts`) |
| PATCH | `/api/v1/users/me/immersion-preferences` | Usuario Autenticado | user | Deriva userId de sessionIdentity; ignora valores en query/body; Cache-Control: no-store (`immersion-routes.ts`) |
| GET | `/health` | Público | none | Health check probe (`app.ts`) |
