# Sprint 64: QA Resilience Test Plan & Paper Tone Matrix
**Feature:** Adaptive Paper Tone, E-Ink Simulation & Palette Remapping Engine  
**Target Host Platform:** Intel GMA 4500MHD / Pentium T4500 & CSS / WebGL Color Matrix Shaders

---

## 1. Executive Summary & Objective

In **Sprint 64**, KuraScroll introduces the **Adaptive Paper Tone, E-Ink Simulation & Palette Remapping Engine**, applying sepia, yellowed newsprint, or e-ink grayscale adjustments to manga panels to reduce eye strain on low-spec displays.

Because color matrix coefficients and custom tint parameters can be manipulated or corrupted in storage, our QA resilience test suite rigorously verifies:
1. Matrix coefficient fuzzing (excessive negative values, `NaN`, `Infinity`).
2. Unrecognized or corrupted SQLite presets (graceful fallback to `ORIGINAL`).
3. Strict parameter clamping for contrast, warmth, and brightness (`[0, 100]` or `[-1.0, 1.0]`).
4. Cross-tab profile synchronization concurrency.

---

## 2. Adversarial Test Case Matrix

### Case 1: Out-of-Range Matrix Coefficients (NaN, Infinity, Extreme Negatives)
- **Scenario:** Passing malformed color matrix coefficients to the WebGL/CSS filter pipeline (`[NaN, Infinity, -9999.0, 500.0]`).
- **Behavioral Expectation:**
  - The coefficient sanitizer must intercept non-finite numbers and clamp extreme values strictly to valid color matrix ranges `[-2.0, 2.0]`.
  - Prevents WebGL shader compilation errors or canvas rendering crashes.
- **Test Implementation Outline (`tests/unit/backend/services/paper-tone-service.test.ts`):**
  ```typescript
  it('sanitizes and clamps out-of-range or non-finite matrix coefficients safely', () => {
    const rawCoeffs = [NaN, Infinity, -50.0, 10.0];
    const sanitized = sanitizeColorMatrix(rawCoeffs);

    for (const val of sanitized) {
      expect(Number.isFinite(val)).toBe(true);
      expect(val).toBeGreaterThanOrEqual(-2.0);
      expect(val).toBeLessThanOrEqual(2.0);
    }
  });
  ```

---

### Case 2: Unrecognized or Corrupted Presets in SQLite
- **Scenario:** Database user preferences contain invalid or corrupted paper tone preset names (e.g., `preset: "neon_cyberpunk"`, `preset: null`, `preset: ""`).
- **Behavioral Expectation:**
  - The paper tone service must validate preset strings against the allowed whitelist (`['ORIGINAL', 'SEPIA_WARM', 'NEWSPRINT_AGED', 'E_INK_MONO']`).
  - Unrecognized presets must gracefully fallback to `'ORIGINAL'` without throwing database or runtime exceptions.
- **Test Implementation Outline (`tests/unit/backend/services/paper-tone-service.test.ts`):**
  ```typescript
  it('falls back gracefully to ORIGINAL preset when SQLite contains invalid or unknown preset strings', () => {
    const service = new PaperToneService({ db: mockDb });

    const preset = service.resolvePreset('neon_cyberpunk' as any);
    expect(preset).toBe('ORIGINAL');

    const nullPreset = service.resolvePreset(null as any);
    expect(nullPreset).toBe('ORIGINAL');
  });
  ```

---

### Case 3: Strict Parameter Clamping (Contrast, Warmth, Brightness)
- **Scenario:** Setting extreme numerical adjustments for contrast (`-500%`), warmth (`1000K`), or brightness (`-99%`).
- **Behavioral Expectation:**
  - Parameters must be strictly clamped to their respective bounds:
    - Contrast: `[0, 100]`
    - Warmth: `[-1.0, 1.0]`
    - Brightness: `[0, 100]`
- **Test Implementation Outline (`frontend/tests/usePaperTone.test.ts`):**
  ```typescript
  it('strictly clamps contrast, warmth, and brightness parameters to valid bounds', () => {
    const hook = renderHook(() => usePaperTone());

    act(() => {
      hook.result.current.setContrast(-200);
      hook.result.current.setWarmth(5.5);
      hook.result.current.setBrightness(300);
    });

    expect(hook.result.current.contrast).toBe(0);
    expect(hook.result.current.warmth).toBe(1.0);
    expect(hook.result.current.brightness).toBe(100);
  });
  ```

---

### Case 4: Profile Update Concurrency Across Tabs / Sessions
- **Scenario:** Multiple browser tabs/sessions simultaneously update paper tone preferences on SQLite WAL mode.
- **Behavioral Expectation:**
  - Concurrent writes must execute cleanly via WAL immediate transactions without SQLITE_BUSY lock timeouts.
- **Test Implementation Outline (`tests/unit/backend/services/paper-tone-service.test.ts`):**
  ```typescript
  it('handles concurrent paper tone profile updates cleanly under SQLite WAL mode', async () => {
    const service = new PaperToneService({ db: walDb });

    const updates = Array.from({ length: 20 }, (_, i) => 
      service.updateUserPreference('user-1', { preset: i % 2 === 0 ? 'SEPIA_WARM' : 'E_INK_MONO' })
    );

    await expect(Promise.all(updates)).resolves.not.toThrow();
  });
  ```

---

## 3. Deliverables & Artifact Summary
- This resilience test plan document (`docs/reports/sprint64-paper-tone-resilience-matrix.md`).
- Automated test suites:
  - `tests/unit/backend/services/paper-tone-service.test.ts`
  - `frontend/tests/usePaperTone.test.ts`
