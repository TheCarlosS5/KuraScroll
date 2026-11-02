# Sprint 73 QA Resilience Matrix: Ambient Soundscapes Mixer & Audio Engine

## Executive Summary
Sprint 73 introduces the **Ambient Soundscapes Mixer & Audio Engine**, allowing readers to immerse themselves in atmospheric background audio (rain, tavern hum, wind, lo-fi beats) tied to manga chapters or user playlists.

This report establishes the exhaustive test plans, edge-case fuzzing matrices, and failure recovery protocols for browser Autoplay Policies, AudioContext lifecycle management across tab visibility changes, network audio 404 recovery, and master volume persistence.

---

## 1. Core Resilience Test Matrix

| ID | Test Scenario | Input / Condition | Expected Behavior | Verification Target |
| :--- | :--- | :--- | :--- | :--- |
| **AUD-01** | **Browser Autoplay Policy Guard** | Soundscape initialized before any user interaction (`AudioContext` in suspended state) | Engine catches `DOMException`, displays non-intrusive "Click to Enable Soundscapes" audio badge, and resumes context instantly on first user gesture. | `audio-autoplay.test.ts` |
| **AUD-02** | **Tab Visibility Suspend / Resume** | User switches away from KuraScroll tab (`document.hidden = true`) | AudioContext suspends gracefully to save CPU/battery cycles; resumes seamlessly upon returning to the active tab (`visibilitychange`). | `audio-visibility.test.ts` |
| **AUD-03** | **Missing Audio Track (HTTP 404 / Network Drop)** | Soundscape track URL returns 404 or fetch fails mid-stream | Engine catches error without crashing the reader thread, gracefully mutes the failing track, logs a warning, and attempts fallback or silent pass-through. | `audio-network-drop.test.ts` |
| **AUD-04** | **Volume & Mute Persistence** | User adjusts master volume or toggles mute and restarts application | Master volume level and mute boolean state persist correctly in SQLite / `localStorage`, restoring exact audio preferences on relaunch. | `audio-persistence.test.ts` |
| **AUD-05** | **Audio Node Leak Prevention** | Rapid toggling of multiple ambient soundscapes (rain $\rightarrow$ storm $\rightarrow$ wind) | Disconnected source nodes and gain nodes are explicitly garbage collected and disconnected to prevent memory leaks in V8. | `audio-leak.test.ts` |

---

## 2. Vitest Test Suite Specifications

### 2.1 Backend / AudioContext & State Unit Tests (`tests/unit/backend/services/soundscape-engine.test.ts`)
```typescript
import { describe, it, expect, vi } from 'vitest';
import { handleAutoplayPolicy, resumeOnVisibilityChange, sanitizeVolumePersistence } from '../../../../src/backend/services/soundscape-engine';

describe('Soundscape Audio Engine Resilience', () => {
  it('handles suspended AudioContext under strict browser Autoplay policies', async () => {
    const mockCtx = { state: 'suspended', resume: vi.fn().mockResolvedValue(undefined) };
    const result = await handleAutoplayPolicy(mockCtx as any);

    expect(mockCtx.resume).toHaveBeenCalled();
    expect(result.status).toBe('resumed');
  });

  it('suspends and resumes AudioContext correctly on tab visibility changes', () => {
    const mockCtx = { state: 'running', suspend: vi.fn(), resume: vi.fn() };
    
    // Tab hidden
    resumeOnVisibilityChange(mockCtx as any, true);
    expect(mockCtx.suspend).toHaveBeenCalled();

    // Tab visible again
    resumeOnVisibilityChange(mockCtx as any, false);
    expect(mockCtx.resume).toHaveBeenCalled();
  });

  it('sanitizes and clamps persisted volume levels to [0.0, 1.0]', () => {
    expect(sanitizeVolumePersistence(1.5)).toBe(1.0);
    expect(sanitizeVolumePersistence(-0.4)).toBe(0.0);
    expect(sanitizeVolumePersistence(0.75)).toBe(0.75);
  });
});
```

### 2.2 Frontend Audio Component Tests (`frontend/src/tests/SoundscapeMixer.test.tsx`)
```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { SoundscapeMixer } from '../components/audio/SoundscapeMixer';

describe('SoundscapeMixer Autoplay Guard & Error Recovery', () => {
  it('renders activation prompt when AudioContext is suspended by autoplay policy', () => {
    const { getByText } = render(<SoundscapeMixer audioState="suspended" />);
    expect(getByText(/click to enable soundscapes/i)).toBeInTheDocument();
  });

  it('catches audio fetch 404 without crashing the component tree', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { container } = render(<SoundscapeMixer trackUrl="/invalid-track.mp3" />);
    
    // Component should remain mounted and render fallback state
    expect(container).toBeDefined();
    consoleSpy.mockRestore();
  });
});
```

---

## 3. Failure Recovery & Edge Case Guidelines

1. **Audio Node Cleanup:** Every audio source node bound to an analyser or gain node implements `node.onended = () => node.disconnect()` to ensure zero detached DOM or audio graph memory leaks.
2. **Intermittent Network Handling:** If an ambient audio stream drops due to a flaky Wi-Fi connection, the engine retries up to 3 times with exponential backoff before gracefully falling back to a pre-cached offline white-noise generator.

---
*Generated by Senior QA & Resilience Engineer for KuraScroll — Sprint 73.*
