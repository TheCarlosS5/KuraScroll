# Sprint 124: Subpixel Font Kerning & CJK Stroke Density Balancer (SLA 88) - QA & Resilience Test Matrix

Target Host: Intel Pentium T4500 (2C/2T 2.3GHz, 1MB L2 cache, no AVX, heap <= 512MB), GPU Intel GMA 4500MHD, HDD 4TB SATA II 5400 RPM.  
Author: Senior QA Resilience Engineer  
Status: Approved & Validated

---

## 1. Overview & Objectives

Sprint 124 introduces the **Subpixel Font Kerning & CJK Stroke Density Balancer (SLA 88)**, designed to optimize manga dialogue text, sound effects (SFX), and CJK (Chinese, Japanese, Korean) typography across diverse viewport densities without causing layout shifts or CPU spikes on low-spec hardware.

This specification outlines the exhaustive test matrix covering parameter bounds, Unicode script classification, Fastify endpoints with ETag caching, frontend hooks (`'K'` / `'k'`), and microsecond execution guarantees (`< 50 µs` assertion).

---

## 2. Parameter Bounds Checking Matrix

| Parameter | Type | Allowed Range | Default | Failure Mode / Attack Vector | Resilience Guard & Sanitization |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `baseKerningEm` | `number` | `[-0.10, 0.50]` | `0.02` | NaN, Infinity, Extreme negative overlapping text | `Math.max(-0.10, Math.min(0.50, Number(val) || 0.0))` |
| `trackingRatio` | `number` | `[0.0, 0.10]` | `0.01` | Negative tracking inversion, massive text expansion | `Math.max(0.0, Math.min(0.10, Number(val) || 0.0))` |
| `minKerningEm` | `number` | `[-0.20, 0.0]` | `-0.05` | Positive min-kerning causing glyph clipping | `Math.max(-0.20, Math.min(0.0, Number(val) || -0.05))` |
| `maxKerningEm` | `number` | `[0.0, 1.0]` | `0.20` | Zero max-kerning preventing tracking adjustments | `Math.max(0.0, Math.min(1.0, Number(val) || 0.20))` |

---

## 3. Unicode Script Classification & Stroke Density Suite

The CJK Stroke Density Balancer inspects character code points to apply appropriate tracking adjustments based on visual density and complexity.

### Test Cases

1. **Kanji Block (`0x4E00..0x9FFF`)**:
   - *Input*: `U+6F22` (漢字)
   - *Expected Classification*: `SCRIPT_CJK_IDEOGRAPH`
   - *Adjustment*: Applies high stroke-density compensation factor ($1.2\times$).
2. **Kana Block (`0x3040..0x30FF`)**:
   - *Input*: `U+3042` (あ), `U+30AB` (カ)
   - *Expected Classification*: `SCRIPT_KANA`
   - *Adjustment*: Standard proportional spacing.
3. **Hangul Syllables (`0xAC00..0xD7AF`)**:
   - *Input*: `U+D55C` (한)
   - *Expected Classification*: `SCRIPT_HANGUL`
   - *Adjustment*: Block-grid alignment rules.
4. **Latin & ASCII (`0x0020..0x007E`)**:
   - *Input*: `U+0041` ('A')
   - *Expected Classification*: `SCRIPT_LATIN`
   - *Adjustment*: Subpixel kerning table lookup.
5. **Boundary & Malformed Codepoints**:
   - *Input*: `0xD800` (Surrogate half), `0xFFFF` (Non-character), Negative integers.
   - *Expected Behavior*: Fallback safely to default Latin metrics without throwing exceptions or causing memory faults.

---

## 4. Fastify Endpoints & Caching Validation

All endpoints must respond within strict latency limits and support conditional requests to prevent unnecessary disk I/O on the 4TB SATA II HDD.

- **`GET /api/v1/reader/cjk-kerning/presets`**: Returns default and custom kerning profiles.
- **`GET /api/v1/reader/cjk-kerning/profile`**: Supports `If-None-Match` ETag headers returning `304 Not Modified` when unmodified.
- **`POST /api/v1/reader/cjk-kerning/profile`**: Persists profile parameters with SQLite WAL mode and strict schema validation.
- **`POST /api/v1/reader/cjk-kerning/calculate`**: Executes batch kerning adjustments for chapter text elements.

---

## 5. Frontend Integration & Hotkey Testing

- **Hotkey**: Pressing `'K'` or `'k'` toggles the Subpixel Kerning & CJK Density HUD overlay and cycles preset configurations.
- **Performance Budget**: Calculation invalidation and DOM measurement batching must complete in `< 50 µs` under Vitest unit test suites.

---

## 6. Vitest Resilience Test Specification

```typescript
import { describe, it, expect } from 'vitest';
import { calculateKerning, classifyUnicodeScript } from '../src/renderer/cjkKerning';

describe('Sprint 124: Subpixel Font Kerning & CJK Stroke Density Balancer (SLA 88)', () => {
  it('clamps invalid kerning parameters correctly', () => {
    const res = calculateKerning({ baseKerningEm: 999, trackingRatio: -5, minKerningEm: 1.0, maxKerningEm: -2.0 });
    expect(res.baseKerningEm).toBeLessThanOrEqual(0.50);
    expect(res.trackingRatio).toBeGreaterThanOrEqual(0.0);
    expect(res.minKerningEm).toBeLessThanOrEqual(0.0);
    expect(res.maxKerningEm).toBeGreaterThanOrEqual(0.0);
  });

  it('correctly classifies Unicode script blocks', () => {
    expect(classifyUnicodeScript(0x6F22)).toBe('SCRIPT_CJK_IDEOGRAPH');
    expect(classifyUnicodeScript(0x3042)).toBe('SCRIPT_KANA');
    expect(classifyUnicodeScript(0xD55C)).toBe('SCRIPT_HANGUL');
    expect(classifyUnicodeScript(0x0041)).toBe('SCRIPT_LATIN');
    expect(classifyUnicodeScript(0xFFFF)).toBe('SCRIPT_UNKNOWN');
  });

  it('executes kerning calculation within microsecond SLA (< 50 µs)', () => {
    const start = performance.now();
    for (let i = 0; i < 1000; i++) {
      calculateKerning({ baseKerningEm: 0.05, trackingRatio: 0.01, minKerningEm: -0.05, maxKerningEm: 0.20 });
    }
    const durationUs = (performance.now() - start) * 1000 / 1000;
    expect(durationUs).toBeLessThan(50);
  });
});
```
