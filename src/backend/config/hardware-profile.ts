import os from 'node:os';

export interface HardwareProfile {
  isLowResource: boolean;
  profileName: 'pentium-t4500-legacy' | 'standard-desktop';
  cpuCores: number;
  totalRamMb: number;
  sharpConcurrency: number;
  byteLruImagesMaxBytes: number;
  byteLruManifestsMaxBytes: number;
  sqliteCacheSize: number;
  sqliteMmapSize: number;
  nodeOldSpaceLimitMb: number;
  interPageSleepMs: number;
}

/**
 * Detects host hardware constraints and selects optimal memory/CPU tuning.
 * Specially calibrated for legacy host architectures such as Intel Pentium T4500
 * (2 cores / 2 threads, 3GB-4GB RAM, SATA II, mechanical 4TB HDD).
 */
export function getHardwareProfile(env: NodeJS.ProcessEnv = process.env): HardwareProfile {
  const cpuCount = os.cpus()?.length || 2;
  const totalRamBytes = os.totalmem() || 4 * 1024 * 1024 * 1024;
  const totalRamMb = Math.round(totalRamBytes / (1024 * 1024));

  // Determine low-resource threshold: explicit flag OR <= 2 CPU cores OR <= 4.2 GB RAM
  const forceLow = env.LOW_RESOURCE_MODE === 'true' || env.LOW_RESOURCE_MODE === '1';
  const forceStandard = env.LOW_RESOURCE_MODE === 'false' || env.LOW_RESOURCE_MODE === '0';

  const isLowResource = forceStandard
    ? false
    : forceLow || cpuCount <= 2 || totalRamMb <= 4300;

  if (isLowResource) {
    // 3GB vs 4GB differentiation
    const is3GbOrLess = totalRamMb <= 3300;

    return {
      isLowResource: true,
      profileName: 'pentium-t4500-legacy',
      cpuCores: cpuCount,
      totalRamMb,
      sharpConcurrency: 1, // Single-threaded image processing prevents freezing dual-core T4500
      byteLruImagesMaxBytes: is3GbOrLess ? 8 * 1024 * 1024 : 16 * 1024 * 1024, // 8-16 MB RAM
      byteLruManifestsMaxBytes: is3GbOrLess ? 2 * 1024 * 1024 : 4 * 1024 * 1024, // 2-4 MB RAM
      sqliteCacheSize: is3GbOrLess ? -1024 : -2048, // 1-2 MB SQLite page cache
      sqliteMmapSize: 0, // Disable mmap to avoid swap memory pressure on SATA II
      nodeOldSpaceLimitMb: is3GbOrLess ? 384 : 512,
      interPageSleepMs: 15, // Cooperative yield during batch image compression
    };
  }

  // Standard multi-core desktop / server profile
  return {
    isLowResource: false,
    profileName: 'standard-desktop',
    cpuCores: cpuCount,
    totalRamMb,
    sharpConcurrency: Math.max(1, cpuCount - 1),
    byteLruImagesMaxBytes: 256 * 1024 * 1024, // 256 MB RAM
    byteLruManifestsMaxBytes: 32 * 1024 * 1024, // 32 MB RAM
    sqliteCacheSize: -64000, // ~64 MB SQLite page cache
    sqliteMmapSize: 268435456, // 256 MB mmap
    nodeOldSpaceLimitMb: 2048,
    interPageSleepMs: 0,
  };
}

/**
 * Applies Windows process priority adjustment to current process if supported.
 */
export function applyWorkerPriority(): boolean {
  try {
    if (typeof os.setPriority === 'function' && os.constants?.priority?.PRIORITY_BELOW_NORMAL !== undefined) {
      os.setPriority(process.pid, os.constants.priority.PRIORITY_BELOW_NORMAL);
      return true;
    }
  } catch {
    // Non-fatal if OS permissions restrict priority modification
  }
  return false;
}
