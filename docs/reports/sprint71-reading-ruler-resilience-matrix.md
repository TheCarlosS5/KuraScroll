# Sprint 71 QA Resilience Matrix: Optical Reading Ruler & Saccadic Guided Focus Engine

## Executive Summary
Sprint 71 introduces the **Optical Reading Ruler & Saccadic Guided Focus Engine**, designed to assist readers with focus pacing by overlaying a customizable translucent reading guide (shutter/ruler) that follows the user's cursor or saccadic rhythm without interfering with UI interactions or text selection.

This report establishes exhaustive test plans, edge-case fuzzing matrices, and failure recovery protocols for out-of-bounds pointer jumps, orientation switches, window resizing/zooming, `prefers-reduced-motion` compliance, and absolute `pointer-events: none` accessibility invariants.

---

## 1. Core Resilience Test Matrix

| ID | Test Scenario | Input / Condition | Expected Behavior | Verification Target |
| :--- | :--- | :--- | :--- | :--- |
| **RUL-01** | **Out-of-Bounds Pointer Jumps** | Rapid cursor exit (`pointerleave` / jumping outside viewport coordinates `x < 0, y > window.innerHeight`) | Reading ruler clamps position to the nearest viewport boundary or smoothly fades out rather than getting stuck off-screen. | `reading-ruler-service.test.ts` |
| **RUL-02** | **Dynamic Orientation Switching** | Switching layout mode from vertical webtoon to traditional horizontal manga reader mid-session | Ruler orientation dynamically re-axes (horizontal shutter bar $\rightarrow$ vertical tracking column) without layout corruption. | `reading-ruler-service.test.ts` |
| **RUL-03** | **Window Resize & Zoom Stability** | Browser window resized or page zoomed (`window.devicePixelRatio` changes) | Ruler coordinate calculations recalibrate immediately to match transformed DOM coordinates without overlay misalignment. | `useReadingRuler.test.ts` |
| **RUL-04** | **Reduced Motion Accessibility** | User system preference set to `prefers-reduced-motion: reduce` | Auto-pacing animations and smooth floating inertia are disabled instantly; ruler remains statically pinned to keyboard navigation or manual drag. | `useReadingRuler.test.ts` |
| **RUL-05** | **Pointer Events Invariant (Click-Through)** | User attempts to select dialogue text or click page navigation buttons underneath the ruler overlay | CSS `pointer-events: none` is strictly enforced on the container element, guaranteeing zero interaction blockage or click interception. | `ReadingRulerHUD.test.tsx` |

---

## 2. Conclusion
The resilience matrix establishes rigorous guarantees for all edge cases across viewport resizing, orientation switches, accessibility standards, and click-through preservation.
