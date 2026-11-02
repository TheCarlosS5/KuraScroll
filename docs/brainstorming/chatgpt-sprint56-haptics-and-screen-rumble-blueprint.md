# Senior ChatGPT Architectural Blueprint: Sprint 56 — Dynamic Haptic Feedback & Screen Rumble Engine

## 1. Executive Summary & Hardware Context
- **Target Platform**: KuraScroll Manga/Manhwa/Manhua Reader.
- **Host CPU**: Intel Pentium T4500 (2 cores / 2 threads @ 2.30 GHz, 1MB L2 cache, <= 512MB V8 heap).
- **Host GPU**: Intel GMA 4500MHD (Pure hardware compositing, zero CSS blur, zero backdrop-filter, zero reflows, CLS = 0).
- **Host Storage**: Mechanical 4TB HDD (SATA II, 5400/7200 RPM, radial latency 12-15ms, batch writes only).
- **Core Architecture**: Impact Feedback Engine decoupled from audio and layout, connecting MangaSFX Audio Deck (Sprint 49) with tactile Web Vibration API and visual Screen Rumble.

---

## 2. Impact Feedback Engine Architecture
```
+-------------------------------------------------------+
|             MangaSFX Audio Deck (Sprint 49)           |
|        (Emits ImpactEvent on audio impact cue)         |
+-------------------------------------------------------+
                           |
                           v
+-------------------------------------------------------+
|                     ImpactRouter                      |
|  - Idempotent deduplication ring buffer (FIFO)        |
|  - Intensity arbitration: LIGERO (0), MEDIO (1),      |
|    PESADO (2)                                         |
|  - Preemption: PESADO replaces pending LIGERO;         |
|    LIGERO never interrupts PESADO                     |
|  - Cooldown: 100ms (0), 150ms (1), 220ms (2)          |
|  - Runtime Gates: preferences, prefers-reduced-motion,|
|    Battery Saver (Sprint 33), ThermalGuard (Sprint 54)|
+-------------------------------------------------------+
             |                               |
             v                               v
+------------------------+      +------------------------+
|      HapticDriver      |      |   ScreenRumbleDriver   |
| - navigator.vibrate()  |      | - .reader-stage only   |
| - [10ms] / [16,22,10]  |      | - translate3d keyframe |
|   / [28,24,16]         |      | - 45ms / 60ms / 80ms   |
| - Graceful no-op on    |      | - CLS = 0, zero blur   |
|   desktop / iOS Safari |      | - Zero layout reads    |
+------------------------+      +------------------------+
```

---

## 3. Screen Rumble Specifications for Intel GMA 4500MHD
1. **Target Element Isolation**:
   - The rumble animation applies **ONLY** to `.reader-stage` inside `ReaderShell`.
   - Never shakes `body`, `html`, or fixed HUDs (`ReaderHUD`, `ThermalGuardHUD`, `PanelZoomHUD`).
2. **Displacement & Duration Limits**:
   - `LIGERO` (0): Max displacement $\pm 0.75\text{px}$, duration $45\text{ms}$.
   - `MEDIO` (1): Max displacement $\pm 1.5\text{px}$, duration $60\text{ms}$.
   - `PESADO` (2): Max displacement $\pm 2.5\text{px}$, duration $80\text{ms}$.
3. **Compositing & Accessibility Rules**:
   - Pure `transform: translate3d(x, y, 0)` keyframes.
   - Zero rotation, zero scale, zero `filter: blur()`, zero `backdrop-filter`.
   - Strictly `@media (prefers-reduced-motion: reduce) { animation: none !important; transform: none !important; }`.
   - No layout reads (`offsetWidth`, `getBoundingClientRect()`) during playback triggers to prevent forced synchronous reflows.

---

## 4. Database Schema: Persistence & Batch Telemetry
### Table `user_immersion_preferences`
```sql
CREATE TABLE IF NOT EXISTS user_immersion_preferences (
  user_id TEXT PRIMARY KEY,
  haptics_enabled INTEGER NOT NULL DEFAULT 0 CHECK (haptics_enabled IN (0, 1)),
  screen_rumble_enabled INTEGER NOT NULL DEFAULT 0 CHECK (screen_rumble_enabled IN (0, 1)),
  max_haptic_intensity INTEGER NOT NULL DEFAULT 1 CHECK (max_haptic_intensity BETWEEN 0 AND 2),
  max_rumble_intensity INTEGER NOT NULL DEFAULT 1 CHECK (max_rumble_intensity BETWEEN 0 AND 2),
  haptics_with_reduced_motion INTEGER NOT NULL DEFAULT 0 CHECK (haptics_with_reduced_motion IN (0, 1)),
  updated_at INTEGER NOT NULL,
  revision INTEGER NOT NULL DEFAULT 1
);
```

### Table `impact_telemetry_batches` (No Per-Impact Disk Thrash)
```sql
CREATE TABLE IF NOT EXISTS impact_telemetry_batches (
  batch_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('sfx', 'onomatopoeia', 'manual')),
  intensity INTEGER NOT NULL CHECK (intensity BETWEEN 0 AND 2),
  trigger_count INTEGER NOT NULL DEFAULT 0,
  haptic_api_attempts INTEGER NOT NULL DEFAULT 0,
  haptic_accepted_count INTEGER NOT NULL DEFAULT 0,
  haptic_suppressed_count INTEGER NOT NULL DEFAULT 0,
  rumble_attempt_count INTEGER NOT NULL DEFAULT 0,
  rumble_executed_count INTEGER NOT NULL DEFAULT 0,
  rumble_suppressed_count INTEGER NOT NULL DEFAULT 0,
  flushed_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_telemetry_user_session ON impact_telemetry_batches (user_id, session_id);
```

---

## 5. SLA 20 Definition
- **Description**: ImpactRouter In-Memory Event Dispatch Latency.
- **Target**: P95 $< 0.01\text{ ms}$ ($10\ \mu\text{s}$) across 100,000+ dispatches.
- **Constraint**: Zero dynamic heap allocations per frame tick ($0\text{ bytes}$).
