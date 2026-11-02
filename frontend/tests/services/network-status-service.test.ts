import { describe, it, expect, beforeEach } from 'vitest';
import { networkStatusService } from '../../src/services/network-status-service';

describe('NetworkStatusService (Sprint 38)', () => {
  beforeEach(() => {
    // Reset to default online state
    networkStatusService._overrideStatus({
      online: true,
      saveData: false,
      effectiveType: '4g',
      tier: 'high',
      downlinkMb: 10,
    });
  });

  it('reports initial high tier on normal 4G connection', () => {
    const status = networkStatusService.getNetworkStatus();
    expect(status.online).toBe(true);
    expect(status.saveData).toBe(false);
    expect(status.tier).toBe('high');
    expect(networkStatusService.shouldPrefetch()).toBe(true);
  });

  it('switches to low tier and pauses prefetch when saveData is enabled', () => {
    networkStatusService._overrideStatus({
      saveData: true,
      tier: 'low',
    });

    const status = networkStatusService.getNetworkStatus();
    expect(status.saveData).toBe(true);
    expect(status.tier).toBe('low');
    expect(networkStatusService.shouldPrefetch()).toBe(false);
  });

  it('switches to low tier on 2g connections', () => {
    networkStatusService._overrideStatus({
      effectiveType: '2g',
      tier: 'low',
    });

    const status = networkStatusService.getNetworkStatus();
    expect(status.tier).toBe('low');
  });

  it('switches to balanced tier on 3g or restricted downlink', () => {
    networkStatusService._overrideStatus({
      effectiveType: '3g',
      tier: 'balanced',
      downlinkMb: 1.2,
    });

    const status = networkStatusService.getNetworkStatus();
    expect(status.tier).toBe('balanced');
  });

  it('respects mobilePrefetchAllowed opt-out flag on cellular networks', () => {
    networkStatusService._overrideStatus({
      effectiveType: '3g',
      tier: 'balanced',
    });

    // Mobile allowed
    expect(networkStatusService.shouldPrefetch(true)).toBe(true);

    // Mobile disallowed by user
    expect(networkStatusService.shouldPrefetch(false)).toBe(false);
  });

  it('notifies subscribers on network status changes', () => {
    let notifiedStatus: any = null;
    const unsubscribe = networkStatusService.subscribe((s) => {
      notifiedStatus = s;
    });

    networkStatusService._overrideStatus({ tier: 'low', saveData: true });
    expect(notifiedStatus).not.toBeNull();
    expect(notifiedStatus.tier).toBe('low');

    unsubscribe();
  });
});
