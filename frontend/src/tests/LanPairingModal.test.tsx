import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LanPairingModal } from '../components/reader/LanPairingModal';
import type { UseLanCompanionResult } from '../reader/useLanCompanion';

describe('Sprint 69 - LanPairingModal Component Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const createMockCompanion = (
    overrides?: Partial<UseLanCompanionResult>
  ): UseLanCompanionResult => ({
    isOpen: true,
    isLoading: false,
    qrSvg: '<svg data-testid="mock-qr-svg"><rect width="100" height="100"/></svg>',
    pairingUrl: 'http://192.168.1.50:4000/companion/#pair-1',
    pairingId: 'pair-1',
    lanIp: '192.168.1.50',
    port: 4000,
    expiresAt: Date.now() + 90000,
    activeDevices: [
      {
        pairingId: 'device-1',
        deviceName: 'iPad Air 5',
        deviceType: 'tablet',
        clientIp: '192.168.1.105',
        activePageNumber: 12,
        pairedAt: Date.now(),
        lastSeenAt: Date.now(),
      },
    ],
    error: null,
    openModal: vi.fn(),
    closeModal: vi.fn(),
    refreshQr: vi.fn(),
    revokeDevice: vi.fn().mockResolvedValue(true),
    refreshDevices: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  });

  it('renders modal with QR code container, LAN IP address, and connected devices', () => {
    const companion = createMockCompanion();
    render(<LanPairingModal companion={companion} />);

    expect(screen.getByTestId('lan-pairing-modal-card')).toBeDefined();
    expect(screen.getByTestId('qr-code-container')).toBeDefined();
    expect(screen.getByText(/192.168.1.50:4000/)).toBeDefined();
    expect(screen.getByText('iPad Air 5')).toBeDefined();
  });

  it('triggers closeModal on close button click and backdrop click', () => {
    const companion = createMockCompanion();
    render(<LanPairingModal companion={companion} />);

    const closeBtn = screen.getByTestId('close-modal-btn');
    fireEvent.click(closeBtn);
    expect(companion.closeModal).toHaveBeenCalledTimes(1);

    const backdrop = screen.getByTestId('lan-pairing-modal-backdrop');
    fireEvent.click(backdrop);
    expect(companion.closeModal).toHaveBeenCalledTimes(2);
  });

  it('triggers revokeDevice when disconnect button is clicked', () => {
    const companion = createMockCompanion();
    render(<LanPairingModal companion={companion} />);

    const revokeBtn = screen.getByTestId('revoke-btn-device-1');
    fireEvent.click(revokeBtn);
    expect(companion.revokeDevice).toHaveBeenCalledWith('device-1');
  });

  it('triggers refreshQr when regenerate QR button is clicked', () => {
    const companion = createMockCompanion();
    render(<LanPairingModal companion={companion} />);

    const regenBtn = screen.getByTestId('regenerate-qr-btn');
    fireEvent.click(regenBtn);
    expect(companion.refreshQr).toHaveBeenCalledTimes(1);
  });

  it('returns null when modal is not open', () => {
    const companion = createMockCompanion({ isOpen: false });
    const { container } = render(<LanPairingModal companion={companion} />);
    expect(container.firstChild).toBeNull();
  });
});
