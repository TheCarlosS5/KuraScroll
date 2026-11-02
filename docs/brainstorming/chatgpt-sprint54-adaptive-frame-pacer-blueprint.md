# Sprint 54 Blueprint: Adaptive Frame-Rate Pacer & Thermal Throttling Guard
**Senior ChatGPT & Swarm Architectural Blueprint**
*Host Architecture: Intel Pentium T4500 (2C/2T @ 2.30 GHz, Penryn 45nm, 1MB L2 Cache) | Storage: 4TB Mechanical HDD (SATA II) | GPU: Intel GMA 4500MHD*

---

## 1. Core Architectural Directives

1. **Adaptive Rendering Governor (3-Level State Machine):**
   - **`NOMINAL_60` (Target: 16.67 ms / frame):**
     - Full 60 FPS rendering. Kinetic continuous scroll enabled. Standard image scaling.
   - **`PACED_30` (Target: 33.33 ms / frame - Thermal Saver):**
     - Engaged when frame drop ratio $> 15\%$ over the last 60 frames or via manual user toggle.
     - Time-gated `requestAnimationFrame`: callbacks firing before $33.3$ ms elapsed skip layout update and canvas redraw calls, reducing GPU fill-rate demands and CPU power consumption by $> 45\%$.
   - **`EMERGENCY_STEP` (Target: on-demand / discrete steps):**
     - Engaged when frame drop ratio $> 25\%$ or consecutive frame times exceed $50$ ms.
     - Disables continuous smooth interpolation. Transitions directly between discrete page steps.

2. **Zero-Allocation Circular Ring Buffer:**
   - Pre-allocated `Float64Array(60)` tracking the last 60 delta times.
   - Frame tick updates in $O(1)$ time ($< 0.0015$ ms) with **0 bytes allocated** on the V8 heap:
     ```typescript
     buffer[index % 60] = deltaMs;
     index++;
     ```
   - Drop ratio calculated as fraction of samples where $\Delta t > 22.0$ ms.

3. **Background Tab Blur & Visibility Change Handling:**
   - When `document.visibilityState === 'hidden'`, the frame pacer suspends metric recording.
   - Upon return to foreground, the timestamp baseline is reset to `performance.now()`, preventing a false burst of skipped frame penalties.

4. **Telemetry Ingestion Endpoint in Fastify:**
   - Table `client_render_telemetry` tracking client render health (`fps_average`, `drop_rate_pct`, `governor_state`, `user_id`, `created_at`).
   - `POST /api/v1/telemetry/frame-drops` with LRU in-memory aggregation.

5. **Intel GMA 4500MHD Zero-Blur HUD:**
   - `ThermalGuardHUD.tsx` renders a discrete pill: `🟢 60 FPS`, `🟡 30 FPS Paced`, `🟠 Step Mode`.
   - `contain: layout paint` with min-width to ensure $CLS = 0$. Zero CSS blur.
