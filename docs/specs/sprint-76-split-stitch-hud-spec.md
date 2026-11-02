# Sprint 76 Specification: Intelligent Dual-Page Splitter & Webtoon Vertical Stitcher Engine (`SplitStitchHUD.tsx`)

## Overview
The **Split & Stitch HUD** is an optical layout transformation control interface designed to convert scanned double-page spreads into single sequential pages or stitch vertical webtoons with zero layout shifts.

---

## GPU Constraints Compliance (Intel GMA 4500MHD)
- **Zero CSS Blur / Backdrop Filter**: All panels and modals use solid `#18181b` backgrounds with `#27272a` borders and `#f4f4f5` typography.
- **Strict Containment**: `contain: layout paint` on all interactive panels.
- **Zero Layout Shift (CLS = 0)**: Fixed positioning overlays with absolute dimensions.

---

## Component Architecture (`SplitStitchHUD.tsx` & `usePageSplitStitch.ts`)

### 1. Visual Layout & Structure
- **Container**: Fixed floating overlay card (`width: 340px`, `background: #18181b`, `border: 1px solid #27272a`, `border-radius: 8px`).
- **Header**: Title ("Page Split & Stitch Engine"), Status Badge (Active Mode), Close button.
- **Layout Mode Selector (Segmented Tabs)**:
  - `Normal (Original)`
  - `Dividir RTL (Manga)`
  - `Dividir LTR (Manhwa)`
  - `Coser Webtoon (Zero-Gap)`
- **Parameter Sliders**:
  - **Split Ratio (0.40 to 0.60)**: Fine-tunes center split demarcation for asymmetrical spreads (default `0.50`).
  - **Stitch Gap (0px to 16px)**: Controls vertical spacing between stitched webtoon panels (default `0px`).
- **Action Toolbar**: Reset to Defaults, Apply to Chapter / Series.

---

## Keyboard Shortcuts
- **`D`**: Toggle Split & Stitch HUD visibility.
