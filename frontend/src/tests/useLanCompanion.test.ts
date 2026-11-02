import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLanCompanion } from '../reader/useLanCompanion';

describe('Sprint 69 - useLanCompanion Hook Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('initializes with modal closed and empty devices list', () => {
    const { result } = renderHook(() => useLanCompanion());

    expect(result.current.isOpen).toBe(false);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.qrSvg).toBeNull();
    expect(result.current.activeDevices).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it('opens modal, requests QR session, and fetches devices', async () => {
    const mockQrResponse = {
      success: true,
      pairingId: 'pair-123',
      rawToken: 'token-abc',
      pairingUrl: 'http://192.168.1.15:4000/companion/#pair-123',
      qrSvg: '<svg>test</svg>',
      lanIp: '192.168.1.15',
      port: 4000,
      expiresAt: Date.now() + 90000,
    };

    const mockDevicesResponse = {
      success: true,
      devices: [
        {
          pairingId: 'pair-999',
          deviceName: 'Pixel 8',
          deviceType: 'mobile',
          clientIp: '192.168.1.20',
          activePageNumber: 4,
        },
      ],
    };

    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/qr-pair/create')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockQrResponse),
        });
      }
      if (url.includes('/companion/active-devices')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockDevicesResponse),
        });
      }
      return Promise.reject(new Error('Unknown endpoint'));
    }) as any;

    const { result } = renderHook(() => useLanCompanion());

    await act(async () => {
      result.current.openModal();
    });

    expect(result.current.isOpen).toBe(true);
    expect(result.current.pairingId).toBe('pair-123');
    expect(result.current.lanIp).toBe('192.168.1.15');
    expect(result.current.qrSvg).toBe('<svg>test</svg>');
    expect(result.current.activeDevices.length).toBe(1);
    expect(result.current.activeDevices[0].deviceName).toBe('Pixel 8');

    act(() => {
      result.current.closeModal();
    });
    expect(result.current.isOpen).toBe(false);
  });

  it('revokes a paired device and updates state', async () => {
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/companion/revoke')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true, devices: [] }),
      });
    }) as any;

    const { result } = renderHook(() => useLanCompanion());

    let success = false;
    await act(async () => {
      success = await result.current.revokeDevice('pair-123');
    });

    expect(success).toBe(true);
  });
});
