import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { OfflineSyncHUD } from '../../src/components/common/OfflineSyncHUD.js';
import { localClientStorage } from '../../src/services/local-storage-service.js';

describe('OfflineSyncHUD Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders synchronized status badge when online and 0 pending items', async () => {
    vi.spyOn(localClientStorage, 'getPendingSync').mockResolvedValue([]);

    render(<OfflineSyncHUD />);

    await waitFor(() => {
      expect(screen.getByTestId('offline-sync-hud-btn')).toBeDefined();
    });

    expect(screen.getByText(/Sincronizado/i)).toBeDefined();
  });

  it('renders pending count badge when there are queued outbox items', async () => {
    vi.spyOn(localClientStorage, 'getPendingSync').mockResolvedValue([
      {
        seriesId: 'solo-leveling',
        chapterId: 'ch-100',
        pageNumber: 14,
        scrollOffsetY: 0,
        timestamp: Date.now(),
        queuedAt: Date.now(),
      },
    ]);

    render(<OfflineSyncHUD />);

    await waitFor(() => {
      expect(screen.getByText(/1 pendientes/i)).toBeDefined();
    });
  });

  it('opens diagnostics modal on click and displays pending mutations', async () => {
    vi.spyOn(localClientStorage, 'getPendingSync').mockResolvedValue([
      {
        seriesId: 'chainsaw-man',
        chapterId: 'ch-12',
        pageNumber: 8,
        scrollOffsetY: 0,
        timestamp: Date.now(),
        queuedAt: Date.now(),
      },
    ]);

    render(<OfflineSyncHUD />);

    const hudBtn = await screen.findByTestId('offline-sync-hud-btn');
    fireEvent.click(hudBtn);

    expect(screen.getByTestId('offline-sync-modal')).toBeDefined();
    expect(screen.getByText(/Diagnóstico de Sincronización/i)).toBeDefined();
    expect(screen.getByText('chainsaw-man')).toBeDefined();
    expect(screen.getByText(/Cap\. ch-12 • Pág\. 8/i)).toBeDefined();

    // Close modal
    const closeBtn = screen.getByTestId('close-sync-modal-btn');
    fireEvent.click(closeBtn);

    expect(screen.queryByTestId('offline-sync-modal')).toBeNull();
  });

  it('triggers manual synchronization on button click', async () => {
    vi.spyOn(localClientStorage, 'getPendingSync').mockResolvedValue([
      {
        seriesId: 'jujutsu-kaisen',
        chapterId: 'ch-250',
        pageNumber: 1,
        scrollOffsetY: 0,
        timestamp: Date.now(),
        queuedAt: Date.now(),
      },
    ]);

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true }),
    } as any);

    const onSyncComplete = vi.fn();
    render(<OfflineSyncHUD onSyncComplete={onSyncComplete} />);

    const hudBtn = await screen.findByTestId('offline-sync-hud-btn');
    fireEvent.click(hudBtn);

    const triggerBtn = screen.getByTestId('trigger-manual-sync-btn');
    fireEvent.click(triggerBtn);

    await waitFor(() => {
      expect(screen.getByText(/Sincronizados/i)).toBeDefined();
    });
  });
});
