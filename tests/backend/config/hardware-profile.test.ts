import { describe, it, expect } from 'vitest';
import { getHardwareProfile, applyWorkerPriority } from '../../../src/backend/config/hardware-profile.js';

describe('Hardware Profile Detection & Tuning Suite (Intel Pentium T4500 & Legacy Host)', () => {
  it('1. correctly configures low-resource mode for Pentium T4500 when forced', () => {
    const profile = getHardwareProfile({ LOW_RESOURCE_MODE: 'true' });

    expect(profile.isLowResource).toBe(true);
    expect(profile.profileName).toBe('pentium-t4500-legacy');
    expect(profile.sharpConcurrency).toBe(1);
    expect(profile.sqliteMmapSize).toBe(0);
    expect(profile.sqliteCacheSize).toBeLessThanOrEqual(-1024);
    expect(profile.byteLruImagesMaxBytes).toBeLessThanOrEqual(16 * 1024 * 1024);
    expect(profile.byteLruManifestsMaxBytes).toBeLessThanOrEqual(4 * 1024 * 1024);
    expect(profile.nodeOldSpaceLimitMb).toBeLessThanOrEqual(512);
    expect(profile.interPageSleepMs).toBe(15);
  });

  it('2. allocates standard desktop profile when forced off', () => {
    const profile = getHardwareProfile({ LOW_RESOURCE_MODE: 'false' });

    expect(profile.isLowResource).toBe(false);
    expect(profile.profileName).toBe('standard-desktop');
    expect(profile.byteLruImagesMaxBytes).toBe(256 * 1024 * 1024);
    expect(profile.byteLruManifestsMaxBytes).toBe(32 * 1024 * 1024);
    expect(profile.sqliteMmapSize).toBe(268435456);
    expect(profile.nodeOldSpaceLimitMb).toBe(2048);
    expect(profile.interPageSleepMs).toBe(0);
  });

  it('3. applies process priority without throwing unhandled exceptions', () => {
    const result = applyWorkerPriority();
    expect(typeof result).toBe('boolean');
  });
});
