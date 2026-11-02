# Sprint 39: Dynamic Ambient Ambilight Glow & Performance Throttling for Intel GMA 4500MHD Blueprint
**Architectural Blueprint & Hardware-Grounded Guidance from Senior ChatGPT (Brave MCP)**
**Platform:** KuraScroll (Standalone Sister Platform to KuraStream, KS Monogram)
**Target Host CPU:** Intel Pentium T4500 (2C/2T @ 2.30 GHz, Penryn 45nm, 1MB L2 cache, 512MB RAM cap)
**Target Host GPU:** Intel GMA 4500MHD (Gen4 integrated graphics, extreme fill-rate sensitivity, NO modern fragment shaders)
**Date:** 2026-11-02

---

## 1. Executive Summary & Problem Formulation

In **Sprint 39**, we harden and optimize KuraScroll's **Ambient Glow (Ambilight)** immersion engine.
While high-end discrete GPUs can handle real-time full-screen gaussian blurs (`filter: blur(40px)`) and 60fps video canvas sampling with ease, attempting this on an **Intel GMA 4500MHD** results in:
1. Massive GPU fill-rate exhaustion (drop from 60 FPS to 8-12 FPS).
2. CPU thermal spikes on the Penryn 45nm die as the software rasterizer attempts multi-pass convolution.
3. Rapid battery drain on legacy laptops.

This blueprint establishes a **zero-blur, zero-concurrency-leak, hardware-accelerated Ambilight architecture** combining:
- **Zero-Allocation 16x16 Subsampled Palette Extraction:** Sampling peripheral perimeter pixels using `createImageBitmap` or small offscreen canvas with nearest-neighbor interpolation ($< 0.4\text{ ms}$ CPU slice).
- **GPU-Friendly Pure Radial-Gradient Rendering:** Utilizing native CSS hardware-accelerated radial gradients (`radial-gradient(ellipse at center, rgba(r,g,b,0.40) 0%, rgba(r,g,b,0.12) 50%, transparent 80%)`) with pure opacity/background transitions instead of expensive gaussian convolutions.
- **Delta-E Chromatic Hysteresis & Scroll Throttling:** 250ms scroll debounce in continuous Webtoon mode, triggering updates only when the perceptual color difference $\Delta E > 15$ to avoid perceptible color flickering between adjacent manga panels.
- **Strict Low-Resource & Thermal Saver Bypass:** Automatic shutdown of the color extraction loop when `lowResourceMode` or `displaySettings.thermalSaverEnabled` is active, maintaining flat `#080c14` / `#000000` background.

---

## 2. Core Architectural Components

### Pillar A: Subsampled Color Extraction (`ambient-color-extractor.ts`)
- **Perimeter Weighting:** Manga pages often have white gutters or dark borders. The color extractor analyzes four quadrant borders (top, bottom, left, right) and downweights pure monochrome extremes (RGB values $> 245$ or $< 10$) unless the entire scene is monochromatic.
- **Algorithm:**
  1. Downsample source to $16 \times 16$ pixels.
  2. Sample perimeter edge pixels ($y=0$, $y=15$, $x=0$, $x=15$).
  3. Compute weighted arithmetic mean of RGB channels.
  4. Format as standard hex and RGBA strings: `rgba(r, g, b, alpha)`.
  5. Maximum execution duration: $< 0.5\text{ ms}$ on Intel Pentium T4500.

### Pillar B: Chromatic Hysteresis Engine
- **Formula:**
  $$\Delta E = \sqrt{(\Delta R)^2 + (\Delta G)^2 + (\Delta B)^2}$$
- If $\Delta E < 18$, the existing ambient color is retained without mutating DOM properties. This avoids GPU texture re-uploads and prevents visual jitter during fast reading.

### Pillar C: Intel GMA 4500MHD Compliant Backdrop Component (`AmbilightBackdrop.tsx`)
- Container uses `position: fixed`, `inset: 0`, `z-index: 0`, and `pointer-events: none`.
- Background set to:
  ```css
  background: radial-gradient(
    ellipse at 50% 45%,
    rgba(var(--amb-r), var(--amb-g), var(--amb-b), 0.35) 0%,
    rgba(var(--amb-r), var(--amb-g), var(--amb-b), 0.10) 55%,
    rgba(8, 12, 20, 0.95) 85%
  );
  transition: background 600ms cubic-bezier(0.16, 1, 0.3, 1);
  contain: strict;
  ```
- **Zero CSS blur filter:** Strictly 0 instances of `filter: blur()` or `backdrop-filter: blur()`.

### Pillar D: Thermal Saver & Low-Resource Bypass
- When `thermalSaverEnabled === true` or `saveData === true`:
  - Ambient extractor short-circuits to `null`.
  - Backdrop defaults to static `#080c14` (Deep Void) or `#000000` (Pure Black).
  - CPU usage drops to 0.00% during scrolling and page turns.

---

## 3. Implementation Plan

1. **Frontend Utility:**
   - [`frontend/src/utils/ambient-color-extractor.ts`](file:///C:/Users/Admin/dev/kura-scroll/frontend/src/utils/ambient-color-extractor.ts): Color sampling with perimeter weighting, monochrome filter, and $\Delta E$ hysteresis.
   - Unit tests: `frontend/tests/utils/ambient-color-extractor.test.ts`.

2. **Frontend Component:**
   - [`frontend/src/components/reader/AmbilightBackdrop.tsx`](file:///C:/Users/Admin/dev/kura-scroll/frontend/src/components/reader/AmbilightBackdrop.tsx): Zero-blur radial gradient backdrop with smooth CSS transitions and layout containment.
   - Unit tests: `frontend/tests/components/AmbilightBackdrop.test.tsx`.

3. **Reader Integration:**
   - Integrate into [`useZenModeGSAP.ts`](file:///C:/Users/Admin/dev/kura-scroll/frontend/src/hooks/useZenModeGSAP.ts) and [`ReaderPage.tsx`](file:///C:/Users/Admin/dev/kura-scroll/frontend/src/pages/ReaderPage.tsx).
   - Hook to page turns with 250ms debounce.

4. **Empirical Benchmark & Verification:**
   - Frame render benchmark under GMA 4500MHD profile: `docs/reports/sprint39-ambilight-gma4500mhd-benchmark.md`.
   - Full monorepo verification: Backend (428+ tests), Frontend (235+ tests), 11/11 SLAs Passed, Vite build.
