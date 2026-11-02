# ChatGPT Senior Architectural Blueprint: Sprint 45
## Reading Session Optical Replay & Kinetic Scroll Eye-Tracking Heatmaps

**Consultor Senior:** ChatGPT (Sesión Brave `Colaboración en proyecto - Brave`)  
**Fecha:** Noviembre 2026  
**Hardware Objetivo:** Intel Pentium T4500 (2C/2T @ 2.30 GHz, 512 MB RAM cap, 4 TB SATA II HDD)  
**Objetivo:** Capturar y proyectar métricas de atención por página (tiempo de fijación de mirada y dwell de scroll) con latencia < 0.1 ms en SQLite y payload ultracompacto (< 6 KB).

---

## 1. Esquema DDL de Base de Datos SQLite: `chapter_page_dwell_stats`

```sql
CREATE TABLE IF NOT EXISTS chapter_page_dwell_stats (
    chapter_id TEXT NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
    page_number INTEGER NOT NULL CHECK(page_number >= 1),
    total_reads INTEGER NOT NULL DEFAULT 0 CHECK(total_reads >= 0),
    total_dwell_seconds REAL NOT NULL DEFAULT 0.0 CHECK(total_dwell_seconds >= 0.0),
    avg_dwell_seconds REAL NOT NULL DEFAULT 0.0 CHECK(avg_dwell_seconds >= 0.0),
    dwell_intensity_score REAL NOT NULL DEFAULT 0.0 CHECK(dwell_intensity_score >= 0.0 AND dwell_intensity_score <= 100.0),
    updated_at TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (chapter_id, page_number)
);

CREATE INDEX IF NOT EXISTS idx_dwell_stats_lookup 
    ON chapter_page_dwell_stats(chapter_id, page_number ASC);

CREATE INDEX IF NOT EXISTS idx_dwell_stats_intensity 
    ON chapter_page_dwell_stats(chapter_id, dwell_intensity_score DESC);
```

---

## 2. Tipos TypeScript

```typescript
export type AttentionTier = 'breeze' | 'flow' | 'deep' | 'epic';

export interface PageDwellRecord {
  pageNumber: number;
  totalReads: number;
  totalDwellSeconds: number;
  avgDwellSeconds: number;
  intensityScore: number; // 0.0 - 100.0
  tier: AttentionTier;
}

export interface ChapterAttentionMetrics {
  totalSessionViews: number;
  totalDwellSeconds: number;
  chapterAvgDwellSeconds: number;
  peakAttentionPage: number;
  peakDwellSeconds: number;
}

export interface ChapterDwellHeatmapResponse {
  success: boolean;
  chapterId: string;
  totalPages: number;
  metrics: ChapterAttentionMetrics;
  heatmap: PageDwellRecord[];
}
```

---

## 3. Formato JSON Fastify: `GET /api/v1/analytics/chapter/:chapterId/dwell-heatmap`

```json
{
  "success": true,
  "chapterId": "solo-leveling-c14",
  "totalPages": 45,
  "metrics": {
    "totalSessionViews": 128,
    "totalDwellSeconds": 14350.5,
    "chapterAvgDwellSeconds": 31.8,
    "peakAttentionPage": 34,
    "peakDwellSeconds": 84.3
  },
  "heatmap": [
    {
      "pageNumber": 1,
      "totalReads": 128,
      "totalDwellSeconds": 2432.0,
      "avgDwellSeconds": 19.0,
      "intensityScore": 22.5,
      "tier": "breeze"
    },
    {
      "pageNumber": 34,
      "totalReads": 125,
      "totalDwellSeconds": 10537.5,
      "avgDwellSeconds": 84.3,
      "intensityScore": 100.0,
      "tier": "epic"
    }
  ]
}
```

---

## 4. Política de Privacidad y Consentimiento de Telemetría (Directiva ChatGPT)

1. **Opt-in Explícito para Datos Comunitarios**:
   - Por defecto, la telemetría de dwell se calcula y almacena exclusivamente de forma local en el dispositivo del lector.
   - La agregación comunitaria requiere consentimiento explícito del usuario (`shareReadingAnalytics: true`).
2. **Umbral Mínimo de Contribución (`contributor_count >= 20`)**:
   - Para prevenir la inferencia o desanonimización de hábitos de lectura de usuarios individuales en mangas poco leídos, la vista comunitaria solo se desbloquea cuando el capítulo acumula al menos 20 lecturas de contribuyentes distintos.
3. **Descarte de Outliers y Skimming**:
   - Skimming rápido: eventos con dwell $< 1.0\text{ s}$ o velocidad de scroll $v > 1500\text{ px/s}$ se descartan por no representar lectura consciente.
   - Pausas/AFK: eventos con dwell $> 180.0\text{ s}$ se truncan/clamped a $180.0\text{ s}$ para evitar distorsión por dejar la pestaña abierta.
4. **Buffer Write-Behind en Memoria**:
   - Los eventos de dwell se acumulan en memoria y se escriben en bloques de hasta 50 registros por transacción SQLite WAL, asegurando un tiempo de commit $< 1.0\text{ ms}$ en disco HDD SATA II.
