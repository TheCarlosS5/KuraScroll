# Sprint 75 Specification: Dynamic Dialogue TTS Synthesizer (`DialogueTtsHUD.tsx`)

## Overview
The **Dialogue TTS HUD** is an accessibility and immersion control interface for text-to-speech synthesis of manga dialogue bubbles. It coordinates voice roles, reading rates, and visual bubble tracking across pages without GPU-heavy distortion or blur effects.

---

## GPU Constraints Compliance (Intel GMA 4500MHD)
- **Zero CSS Blur / Backdrop Filter**: All panels and modals use solid `#18181b` backgrounds with `#27272a` borders and `#f4f4f5` typography.
- **Strict Containment**: `contain: layout paint` on all interactive panels.
- **Zero Layout Shift (CLS = 0)**: Fixed positioning overlays with absolute dimensions.

---

## Component Architecture (`DialogueTtsHUD.tsx` & `useDialogueTTS.ts`)

### 1. Visual Layout & Structure
- **Container**: Fixed floating overlay card (`width: 360px`, `background: #18181b`, `border: 1px solid #27272a`, `border-radius: 8px`).
- **Header**: Title ("Dynamic Dialogue TTS"), Active State Badge (Playing/Paused/Idle), Close button.
- **Playback Controls**: 
  - Play, Pause, Stop, Skip Forward/Backward buttons with high-contrast SVG icons.
- **Global Settings**:
  - Master Rate Slider (`0.75x` to `1.75x`).
  - Auto-Advance Toggle (automatically turn page upon TTS completion).
- **Voice Role Customization (Accordion / Tabs)**:
  - Roles: `Narrator`, `Male Hero`, `Female Hero`, `Child / Creature`.
  - Pitch & Rate fine-tuning sliders per role.
- **Active Bubble Tracker**:
  - Live preview list showing the currently spoken dialogue text with glowing amber accent border (`#d97706`).

---

## Keyboard Shortcuts
- **`T`**: Toggle Dialogue TTS HUD visibility.
- **`Space`**: Play / Pause TTS playback.
