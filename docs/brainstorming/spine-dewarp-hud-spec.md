# Sprint 74 Specification: Smart Page Curvature & Spine Flattening Dewarping (`SpineDewarpHUD.tsx`)

## Overview
The **Spine DewarpHUD** is an optical correction control interface designed for digital manga and comics scanned from physical bound volumes. It allows readers to correct cylindrical page curvature ("spine shadow" and text distortion near the book fold) without GPU-heavy distortion shaders.

---

## GPU Constraints Compliance (Intel GMA 4500MHD)
- **Zero CSS Blur / Backdrop Filter**: All panels and modals use solid `#18181b` backgrounds with `#27272a` borders.
- **Strict Containment**: `contain: layout paint` on all interactive panels.
- **Zero Layout Shift (CLS = 0)**: Fixed positioning overlays with absolute dimensions.

---

## Component Architecture (`SpineDewarpHUD.tsx`)

### 1. Visual Layout & Structure
- **Container**: Fixed overlay card (`width: 320px`, `background: #18181b`, `border: 1px solid #27272a`, `border-radius: 8px`).
- **Header**: Title ("Spine Dewarp & Flattening"), Status Badge (Active/Bypassed), Close button.
- **Spine Side Selector**: 
  - Segmented button group: `Auto (RTL)`, `Left`, `Right`, `Center (Spread)`.
- **Parameter Sliders**:
  - **Curvature Depth (0% - 100%)**: Adjusts optical mesh stretch.
  - **Spine Width (5% - 50%)**: Defines gutter exclusion zone.
  - **Shadow Compensation (0% - 50%)**: Brightens gutter gradient overlay.
- **Actions**: Real-time preview toggle (`'W'` shortcut to open/close).

---

## Keyboard Shortcuts
- **`W`**: Toggle Spine Dewarp HUD.
