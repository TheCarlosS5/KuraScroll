import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { OfflineMutationOutboxHUD } from '../../src/components/sync/OfflineMutationOutboxHUD.js';

describe('OfflineMutationOutboxHUD Component (Sprint 35)', () => {
  it('renders synchronized state badge when online and 0 pending items', () => {
    render(
      <OfflineMutationOutboxHUD
        status="synced"
        pendingCount={0}
        isOnline={true}
        onTriggerSync={vi.fn()}
      />
    );

    expect(screen.getByTestId('offline-mutation-hud')).toBeDefined();
    expect(screen.getByText('Sincronizado')).toBeDefined();
    expect(screen.getByText('✔')).toBeDefined();
  });

  it('renders offline state badge with pending count when disconnected', () => {
    render(
      <OfflineMutationOutboxHUD
        status="offline"
        pendingCount={4}
        isOnline={false}
        onTriggerSync={vi.fn()}
      />
    );

    expect(screen.getByTestId('offline-mutation-hud')).toBeDefined();
    expect(screen.getByText(/Sin conexión \(4 cambios pendientes\)/i)).toBeDefined();
    expect(screen.getByText('⚡')).toBeDefined();
  });

  it('renders syncing indicator and rotating spinner when syncing', () => {
    render(
      <OfflineMutationOutboxHUD
        status="syncing"
        pendingCount={2}
        isOnline={true}
        onTriggerSync={vi.fn()}
      />
    );

    expect(screen.getByTestId('offline-mutation-hud')).toBeDefined();
    expect(screen.getByText('Sincronizando cambios en segundo plano...')).toBeDefined();
  });

  it('triggers manual sync callback when clicking "Sincronizar Ahora"', () => {
    const handleSync = vi.fn();
    render(
      <OfflineMutationOutboxHUD
        status="pending"
        pendingCount={3}
        isOnline={true}
        onTriggerSync={handleSync}
      />
    );

    const btn = screen.getByTestId('offline-mutation-sync-btn');
    expect(btn).toBeDefined();
    fireEvent.click(btn);

    expect(handleSync).toHaveBeenCalledTimes(1);
  });
});
