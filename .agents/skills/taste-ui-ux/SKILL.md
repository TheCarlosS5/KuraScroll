---
name: taste-ui-ux
description: Principles of aesthetic taste, visual balance, high-end dark mode palettes, typography, and ergonomic user experience for digital reading applications.
---

# Taste and UI/UX Design Skill Guide

Use this skill to elevate visual and experiential quality beyond generic templates. Design for obsession, immersion, and physical comfort.

## The Principles of Taste in Media Readers

1. **The Content is the Hero:**
   - The manga or comic artwork is the focal point. UI chrome (navbars, sliders, chapter numbers) must melt away when reading begins and re-emerge effortlessly on gesture or hover.
2. **True Dark Mode (Not Pure Black):**
   - Deep Void (`#080c14` or `#0b0f19`) creates depth without the harsh optical contrast of pure `#000000` against bright white speech bubbles.
   - Use multi-layer surface elevation:
     * Base canvas: `#080c14`
     * Cards & containers: `#0f172a` (with subtle 1px border `rgba(255,255,255,0.06)`)
     * Floating overlays: `#0f172a/90` with backdrop-filter `blur(12px)`
3. **Typography Hierarchy:**
   - Display/Titles: Bold, tight letter-spacing (`tracking-tight`), modern sans or geometric fonts.
   - Body/Synopses: Readable line-height (`leading-relaxed`), text muted `#94a3b8` to avoid eye strain.
   - Chapter numbers and metadata: Monospace accents or tabular numbers (`font-mono text-xs`).
4. **Ergonomic Hotkeys & Touch Zones:**
   - Dual-zone reading: Respect both Japanese Right-to-Left (manga) and Western/Webtoon habits.
   - Never force a reader to reach for the top corner of the screen while reading. Floating drawers and bottom progress pills keep thumb reach natural.
5. **Zero Layout Shifts (Zero CLS):**
   - Every single image container MUST pre-allocate its physical height via `aspect-ratio` before the image byte stream completes.
