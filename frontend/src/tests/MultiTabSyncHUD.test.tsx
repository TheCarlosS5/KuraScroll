import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MultiTabSyncHUD } from '../components/reader/MultiTabSyncHUD.js';

describe('Sprint 65 - MultiTabSyncHUD Component Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders leader role badge when isLeader is true', () => {
    render(
      <MultiTabSyncHUD
        isLeader={true}
        activePeerCount={1}
        onClaimLeadership={vi.fn()}
      />
    );

    expect(screen.getByRole('status')).toBeDefined();
    expect(screen.getByText('Pestaña Líder')).toBeDefined();
    expect(screen.getByText('1 pestaña')).toBeDefined();
    // Claim leader button should not exist for active leader
    expect(screen.queryByText('Asumir Líder')).toBeNull();
  });

  it('renders synchronized worker role badge and allows claiming leadership', () => {
    const onClaimLeadership = vi.fn();
    render(
      <MultiTabSyncHUD
        isLeader={false}
        activePeerCount={3}
        onClaimLeadership={onClaimLeadership}
      />
    );

    expect(screen.getByText('Pestaña Sincronizada')).toBeDefined();
    expect(screen.getByText('3 pestañas')).toBeDefined();

    const claimBtn = screen.getByText('Asumir Líder');
    fireEvent.click(claimBtn);
    expect(onClaimLeadership).toHaveBeenCalledTimes(1);
  });

  it('displays micro-pulse notification toast on sync event', () => {
    render(
      <MultiTabSyncHUD
        isLeader={false}
        activePeerCount={2}
        lastSyncEvent={{
          type: 'SYNC_READING_PROGRESS',
          payload: { pageNumber: 12 },
          timestamp: Date.now(),
        }}
      />
    );

    expect(screen.getByText(/Progreso de lectura actualizado/)).toBeDefined();
  });
});
