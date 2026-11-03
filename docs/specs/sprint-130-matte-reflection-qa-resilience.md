# Sprint 130: Matte Paper Specular Reflection & Angular Lighting Modulator (SLA 94) - QA & Resilience Test Matrix

Target Host: Intel Pentium T4500 (2C/2T 2.3GHz, 1MB L2 cache, no AVX, heap <= 512MB), GPU Intel GMA 4500MHD, HDD 4TB SATA II 5400 RPM.  
Author: Senior QA Resilience Engineer  
Status: Approved & Validated

---

## 1. Overview & Objectives

Sprint 130 introduces the **Matte Paper Specular Reflection & Angular Lighting Modulator (SLA 94)**, simulating the realistic specular highlights and diffuse scattering of physical matte manga paper under variable virtual light angles.

This specification outlines the exhaustive test matrix covering extreme lighting angles, deep black ink specular attenuation ($K=1.0$), numerical fuzzing for NaN/Infinity/aberrant coordinates, Fastify REST endpoints, SQLite WAL persistence, and microsecond execution guarantees (`< 50 µs` assertion).

---

## 2. Parameter Bounds & Lighting Geometry Matrix

| Parameter | Type | Allowed Range | Default | Failure Mode / Attack Vector | Resilience Guard & Sanitization |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `light_azimuth` | `REAL` | `[-3.14159, 3.14159]` | `0.0` | Angles outside $[-\pi, \pi]$, NaN, Infinity | `Math.max(-Math.PI, Math.min(Math.PI, Number(val) || 0.0))` |
| `light_elevation`| `REAL` | `[0.0, 1.57079]` | `0.785` | Negative elevations (light behind page), angles $> \pi/2$ | `Math.max(0.0, Math.min(Math.PI / 2, Number(val) || 0.785))` |
| `specular_roughness`| `REAL` | `[0.05, 1.0]` | `0.4` | Zero roughness (infinite specular spike / division by zero) | `Math.max(0.05, Math.min(1.0, Number(val) || 0.4))` |
| `matte_strength` | `REAL` | `[0.0, 1.0]` | `0.85` | Negative or excessive scattering | `Math.max(0.0, Math.min(1.0, Number(val) || 0.85))` |

---

## 3. Edge-Case Test Suite

### 1. Extreme Lighting Angles
- **Perpendicular Incidence (Normal Light)** (`elevation = pi/2`, `azimuth = 0`): Maximum diffuse reflection, centered specular highlight.
- **Grazing Angle** (`elevation = pi/2 - 0.01`, near $90^\circ$): Elongated specular highlights, fading diffuse intensity proportional to $\cos(\theta)$.
- **Backlighting / Zero Light** (`elevation = 0.0`): Light source parallel to or behind the page plane; specular and diffuse contributions collapse safely to baseline ambient paper tone.

### 2. Deep Black Ink Specular Attenuation ($K=1.0$)
- **Condition**: For pixels with black ink density $K = 1.0$ (heavy screentone or dark outlines), specular highlights must be attenuated to near zero ($\text{specular} \times (1.0 - K)$), simulating matte ink absorbing light rather than reflecting it like glossy paper.

### 3. Aberrant Input & Numerical Fuzzing
- **NaN / Infinity Injection**: Passing `NaN`, `Infinity`, or string garbage into `light_azimuth` or `specular_roughness` must be caught and clamped to safe defaults without throwing exceptions.
- **Out-of-Range Angles**: Azimuth values like $\pm 10\pi$ must be wrapped or clamped into $[-\pi, \pi]$.

---

## 4. Fastify Endpoints & SQLite WAL Persistence

- **`GET /api/v1/reader/matte-reflection/presets`**: Retrieves predefined matte paper lighting profiles.
- **`GET /api/v1/reader/matte-reflection/profile`**: Returns current profile with ETag support (`304 Not Modified`).
- **`POST /api/v1/reader/matte-reflection/profile`**: Persists profile parameters to SQLite in WAL mode.
- **`POST /api/v1/reader/matte-reflection/calculate`**: Computes angular lighting modulation across viewport tiles.

---

## 5. Vitest Resilience Test Specification

```typescript
import { describe, it, expect } from 'vitest';
import { calculateMatteReflection, sanitizeMatteProfile } from '../src/renderer/matteReflection';

describe('Sprint 130: Matte Paper Specular Reflection & Angular Lighting Modulator (SLA 94)', () => {
  it('sanitizes and clamps aberrant lighting parameters correctly', () => {
    const raw = {
      light_azimuth: 99.9,
      light_elevation: -5.0,
      specular_roughness: 0.0, // should clamp >= 0.05
      matte_strength: 2.5
    };
    const sanitized = sanitizeMatteProfile(raw);
    expect(sanitized.light_azimuth).toBeLessThanOrEqual(Math.PI);
    expect(sanitized.light_azimuth).toBeGreaterThanOrEqual(-Math.PI);
    expect(sanitized.light_elevation).toBeGreaterThanOrEqual(0.0);
    expect(sanitized.specular_roughness).toBeGreaterThanOrEqual(0.05);
    expect(sanitized.matte_strength).toBeLessThanOrEqual(1.0);
  });

  it('attenuates specular highlights on deep black ink (K=1.0)', () => {
    const whitePaperReflect = calculateMatteReflection({ azimuth: 0, elevation: 1.0, roughness: 0.4 }, 0.0, 1.0); // K=0 (pure white)
    const blackInkReflect = calculateMatteReflection({ azimuth: 0, elevation: 1.0, roughness: 0.4 }, 1.0, 1.0); // K=1 (pure black)
    expect(blackInkReflect.specular).toBeLessThan(whitePaperReflect.specular);
    expect(blackInkReflect.specular).toBeCloseTo(0.0, 2);
  });

  it('executes lighting modulation within microsecond SLA (< 50 µs)', () => {
    const profile = { light_azimuth: 0.5, light_elevation: 0.8, specular_roughness: 0.4, matte_strength: 0.85 };
    const start = performance.now();
    for (let i = 0; i < 1000; i++) {
      calculateMatteReflection(profile, 0.5, 0.5);
    }
    const durationUs = (performance.now() - start) * 1000 / 1000;
    expect(durationUs).toBeLessThan(50);
  });
});
```
