import { describe, it, expect, beforeEach } from 'vitest';
import { createDatabase, runMigrations, DatabaseInstance } from '../../../src/backend/db/database.js';
import { EyeCareService } from '../../../src/backend/services/eye-care-service.js';

describe('Sprint 50: EyeCareService', () => {
  let db: DatabaseInstance;
  let service: EyeCareService;

  beforeEach(() => {
    db = createDatabase(':memory:');
    runMigrations(db);
    service = new EyeCareService(db);
  });

  it('returns default preferences for unknown user', () => {
    const prefs = service.getPreferences('user_unknown');
    expect(prefs.userId).toBe('user_unknown');
    expect(prefs.filterMode).toBe('default');
    expect(prefs.brightnessPct).toBe(100);
    expect(prefs.contrastPct).toBe(100);
    expect(prefs.blueLightReductionPct).toBe(0);
  });

  it('persists and updates eye care preferences with strict bounds clamping', () => {
    const saved = service.upsertPreferences('carlos', {
      filterMode: 'sepia_warm',
      brightnessPct: 250, // exceeds max 200 -> clamps to 200
      contrastPct: 20,   // below min 50 -> clamps to 50
      blueLightReductionPct: 65,
    });

    expect(saved.userId).toBe('carlos');
    expect(saved.filterMode).toBe('sepia_warm');
    expect(saved.brightnessPct).toBe(200);
    expect(saved.contrastPct).toBe(50);
    expect(saved.blueLightReductionPct).toBe(65);

    const fetched = service.getPreferences('carlos');
    expect(fetched.filterMode).toBe('sepia_warm');
    expect(fetched.brightnessPct).toBe(200);
    expect(fetched.contrastPct).toBe(50);
    expect(fetched.blueLightReductionPct).toBe(65);
  });

  it('generates Intel GMA 4500MHD hardware-accelerated CSS filters with zero blur', () => {
    // 1. Default
    const cssDefault = service.buildCssFilter({ filterMode: 'default' });
    expect(cssDefault).toBe('none');

    // 2. Sepia Warm with blue light
    const cssSepia = service.buildCssFilter({
      filterMode: 'sepia_warm',
      blueLightReductionPct: 50,
      brightnessPct: 90,
    });
    expect(cssSepia).toContain('sepia(0.50)');
    expect(cssSepia).toContain('contrast(0.95)');
    expect(cssSepia).toContain('brightness(0.90)');
    expect(cssSepia).not.toContain('blur');

    // 3. Smart Invert on Monochrome Page
    const cssInvertMono = service.buildCssFilter({
      filterMode: 'smart_invert',
      isMonochromePage: true,
    });
    expect(cssInvertMono).toContain('invert(1)');
    expect(cssInvertMono).toContain('hue-rotate(180deg)');

    // 4. Smart Invert on Color Page (Protects color fidelity)
    const cssInvertColor = service.buildCssFilter({
      filterMode: 'smart_invert',
      isMonochromePage: false,
    });
    expect(cssInvertColor).not.toContain('invert');
    expect(cssInvertColor).toContain('brightness(0.92)');

    // 5. E-Ink Mode
    const cssEInk = service.buildCssFilter({ filterMode: 'e_ink_high_contrast' });
    expect(cssEInk).toContain('grayscale(1)');
    expect(cssEInk).toContain('contrast(1.45)');
  });
});
