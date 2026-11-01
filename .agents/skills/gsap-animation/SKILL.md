---
name: gsap-animation
description: Comprehensive expert guide for GSAP (GreenSock Animation Platform) in React and modern Web applications, focusing on manga readers, smooth canvas transformations, and micro-interactions.
---

# GSAP Animation Skill Guide

Use this skill when implementing fluid, 60-120fps animations for manga readers, UI micro-interactions, page flip transitions, floating controls, and ambient lighting.

## Core Rules for GSAP in React 19 / Modern Web

1. **Context & Cleanup:** Always wrap animations in `gsap.context()` inside `useLayoutEffect` or `useEffect` to avoid memory leaks and ghost timelines during component unmounts.
2. **GPU Acceleration:** Animate `transform` (`x`, `y`, `scale`, `rotation`) and `opacity`. Never animate `top`, `left`, `width`, or `height` directly during continuous gestures to prevent reflows.
3. **Eases:** Use expressive modern eases:
   - Entrance: `power3.out` or `expo.out`
   - Exit: `power2.in`
   - Elastic/Snappy: `back.out(1.4)` for badges and tooltips
4. **Manga Reader Transitions:**
   - **Page Turn Flip:** Use 3D perspective (`perspective: 1200px`) and rotateY (-90deg to 0deg) with subtle shadow gradient opacity.
   - **Ambient Glow:** Duplicate the active manga page image into a blurred background canvas (`filter: blur(40px) opacity(0.3)`) and softly tween brightness on page changes.
   - **Webtoon Scroll Velocity:** Enhance vertical scrolling with smooth lerp physics.
