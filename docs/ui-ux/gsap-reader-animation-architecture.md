# KuraScroll GSAP Reader Animation & UI/UX Architecture

This specification document outlines the fluid animation system, ambient backlighting mechanics, double-page spread engine, and ergonomic design principles implemented for KuraScroll's dual-engine reader (`MangaReader` & `WebtoonReader`).

---

## 1. Design Philosophy & Taste Guidelines

Following the principles established in `.agents/skills/taste-ui-ux/SKILL.md` and `.agents/skills/gsap-animation/SKILL.md`:

1. **The Content is the Hero:**
   - Visual chrome (navbars, toolbars) melts into the background during immersion.
   - Reader canvas uses **Deep Void** (`#080c14`) to eliminate the optical fatigue caused by pure `#000000` against stark white comic speech bubbles.
2. **Zero Cumulative Layout Shift (Zero CLS):**
   - Every single manga page, spread pair, and webtoon slice pre-allocates its container height using `aspectRatio: p.aspectRatio > 0 ? p.aspectRatio : 0.666` alongside skeleton placeholders before the image byte stream completes.
3. **Hardware-Accelerated 60-120fps GSAP Physics:**
   - Only GPU-accelerated CSS properties (`opacity`, `transform: translate3d / scale / rotateY`) are animated.
   - Reflow-inducing properties (`top`, `left`, `width`, `height`) are strictly avoided during continuous reading gestures.
4. **React 19 Clean Lifecycle:**
   - Every timeline is scoped within `gsap.context()` inside `useEffect`, guaranteeing that when components unmount or route switches occur, all tweens and inline styles revert cleanly without memory leaks or ghost timelines.

---

## 2. MangaReader Architecture & Transitions

### A. Soft Ambient Lighting (Ambilight)
- **Concept:** An ambient glow duplicate of the active page is positioned behind the manga panel, with `filter: blur(56px) sm:blur(72px) saturate(1.6) opacity(0.30)`.
- **Radial Falloff:** A radial gradient overlay (`bg-radial from-transparent via-[#080c14]/30 to-[#080c14]/90`) softly disperses the backlight into the Deep Void background canvas.
- **GSAP Tween:** When pages change, GSAP softly tweens the backlight scale and brightness from `opacity: 0.08, scale: 1.05` to `opacity: 0.32, scale: 1.15` over `0.65s` with `power2.out`.

### B. Dual-Zone Directional Page Flip & Slide
- **3D Perspective:** Container utilizes `perspective: 1200px` and `transformStyle: preserve-3d`.
- **RTL (Japanese Manga):**
  - Next Page (advancing right-to-left): Incoming page slides from `x: -35px`, tilted at `rotateY: -2.5deg` into `x: 0, rotateY: 0` (`0.38s`, `power3.out`).
  - Previous Page: Slides from `x: 35px`, tilted at `rotateY: 2.5deg`.
- **LTR (Western Comic):**
  - Next Page (advancing left-to-right): Slides from `x: 35px`, tilted at `rotateY: 2.5deg`.
  - Previous Page: Slides from `x: -35px`, tilted at `rotateY: -2.5deg`.
- **Page Pill Micro-Interaction:** Bottom progress indicator gently bounces on each page transition using `scale: 0.92 -> 1.0` with `back.out(1.4)`.

---

## 3. WebtoonReader Architecture & Progressive Reveal

### A. Infinite Scroll Strip & Lateral Ambient Spill
- **Channel Framing:** Central reader lane constrained to `max-w-4xl` with subtle `border-x border-white/[0.04]` and `shadow-2xl`.
- **Lateral Spill:** Overflow is clipped horizontally (`overflow-x-hidden`) while allowing the ambient backlighting behind each panel to illuminate the ultra-wide screen margins, creating a home-theater OLED ambiance.

### B. Viewport Intersection & Progressive Entrance
- **IntersectionObserver:** Each `WebtoonPanel` registers an observer with `rootMargin: '200px 0px 200px 0px'`.
- When intersecting or loading:
  - Container performs a gentle slide-up: `opacity: 0.35, y: 18 -> opacity: 1, y: 0` (`0.5s`, `power3.out`).
  - Panel ambient backlight softly illuminates: `opacity: 0 -> 0.28` (`0.8s`, `power2.out`).
  - Triggers `onPageVisible(pageNumber)` to update reading progress.
- **SSR & Test Fallback:** In non-browser environments (such as Vitest jsdom), immediate fallback gracefully reveals the panel without layout delay.

### C. Floating Progress Indicator
- Displays current active panel number dynamically: `Página X / Y • Webtoon`.
- Uses GSAP micro-interaction `scale: 0.93 -> 1.0` (`back.out(1.4)`) whenever the active panel advances.

---

## 4. Double-Page Spread Mode (Facing Pages)

### A. Physical Japanese Manga Spread Realism
- In traditional physical Japanese tankobon volumes, reading progresses Right-to-Left (RTL).
- In two-page spread mode:
  - **RTL Mode:** Page $N$ is positioned on the **RIGHT**, and Page $N+1$ is positioned on the **LEFT**.
  - **LTR Mode:** Page $N$ is positioned on the **LEFT**, and Page $N+1$ is positioned on the **RIGHT**.
- Navigation automatically jumps by 2 pages (`handleNext` advances by 2; `handlePrev` retreats by 2) when displaying a dual spread.

### B. Intelligent Wide-Scan Auto-Detection
- Scans containing panoramic double spreads (`aspectRatio > 1.2`) are automatically detected.
- Wide spreads are presented individually as full-width panoramic spreads, preventing accidental mismatching with adjacent single pages.

### C. Ergonomic Layout & Zero CLS
- Both facing pages render within `max-h-[calc(100vh-80px)]` with individual `aspectRatio` constraints and skeleton backdrops.
- GSAP hardware-accelerated transitions animate the entire spread pair with 3D perspective and paper tilt without layout shifts.

---

## 5. Floating Keyboard Shortcuts HUD Modal

- **Trigger:** Accessible via keyboard shortcut `?` (or Shift + `/`), dedicated header toolbar button, or bottom progress pill button.
- **Available Hotkeys:**
  * `←` / `→` / `A` / `D` / `Espacio`: Directional page advance/retreat (aware of RTL/LTR mode).
  * `F`: Toggle Fullscreen mode (`document.fullscreenElement`).
  * `M`: Cycle reader mode (Webtoon ↔ Manga RTL ↔ Comic LTR).
  * `T`: Cycle background reading theme (Pure Black ↔ Deep Void ↔ Warm Sepia).
  * `Esc`: Dismiss HUD modal.
- **GSAP Modal Entrance:** Smooth scale and fade tween (`opacity: 0, scale: 0.94, y: -12 -> opacity: 1, scale: 1, y: 0`, `0.25s`, `power3.out`).

---

## 6. Comprehensive Test Verification

Frontend test suite verified via `npx vitest run`:
- `MangaReader.test.tsx` (12 tests):
  * Keyboard navigation in RTL and LTR single page modes.
  * Ambient glow lighting element and zero CLS aspect ratio rendering.
  * Shortcuts HUD modal trigger via `?`, pill button, and dismissal via `Esc` / close button.
  * Double-page spread facing page arrangement (RTL right-to-left order).
  * Double-page ArrowLeft navigation advancing by 2 pages.
  * Intelligent detection of wide panoramic scans (`aspectRatio > 1.2`).
  * Double-page mode toggle via pill button.
- `ReaderControls.test.tsx` (9 tests):
  * Mode switching, reading progress pills, background theme selection.
  * Double-page spread toggle button in manga mode.
  * Shortcuts help button trigger.
- Full suite: **39 / 39 tests passing (100% pass rate)**.
