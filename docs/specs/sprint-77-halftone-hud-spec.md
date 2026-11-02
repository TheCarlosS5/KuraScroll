# Sprint 77 Specification: Dynamic Halftone Screentone & Vintage Paper Aging Engine (`HalftoneScreentoneHUD.tsx`)

## Overview
The **Halftone & Vintage Aging HUD** is a visual filter control interface designed to simulate traditional manga printing screentones (dot patterns, AM/FM screen frequencies) and physical paper aging (foxing, yellowing, grain) without GPU-heavy SVG or canvas blur shaders.

---

## GPU Constraints Compliance (Intel GMA 4500MHD)
- **Zero CSS Blur / Backdrop Filter**: All panels and modals use solid `#18181b` backgrounds with `#27272a` borders and `#f4f4f5` typography.
- **Strict Containment**: `contain: layout paint` on all interactive panels.
- **Zero Layout Shift (CLS = 0)**: Fixed positioning overlays with absolute dimensions.

---

## Component Architecture (`HalftoneScreentoneHUD.tsx` & `useHalftoneScreentone.ts`)

### 1. Visual Layout & Structure
- **Container**: Fixed floating overlay card (`width: 360px`, `background: #18181b`, `border: 1px solid #27272a`, `border-radius: 8px`).
- **Header**: Title ("Halftone & Vintage Paper Engine"), Status Badge (Active Preset), Close button.
- **Presets Selector (Segmented Cards)**:
  - `Pristino (Moderno)`
  - `Shonen 90s (60 LPI)`
  - `Tankōbon Retro (85 LPI)`
  - `Prensa Pulp (Vintage)`
- **Parameter Sliders**:
  - **Dot Pitch (30 - 120 LPI)**: Controls screentone dot density.
  - **Dot Intensity (0% - 100%)**: Opacity / contrast of halftone dots.
  - **Paper Age (0% - 100%)**: Warm yellowing / sepia tint intensity.
  - **Foxing / Grain (0% - 50%)**: Simulated age spots and paper texture noise.
- **Action Toolbar**: Bypass filter toggle, Reset defaults.

---

## Keyboard Shortcuts
- **`H`**: Toggle Halftone & Vintage Aging HUD visibility.
