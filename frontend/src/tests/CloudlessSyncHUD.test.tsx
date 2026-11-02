import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CloudlessSyncHUD } from '../components/reader/CloudlessSyncHUD';

describe('Sprint 85 - CloudlessSyncHUD Component Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders null modal when isOpen is false and no milestone', () => {
    const { container } = render(
      <CloudlessSyncHUD
        isOpen={false}
        onClose={vi.fn()}
        isEnabled={true}
        mode="local_broadcast"
        localDeviceId="test_dev"
        activePeerCount={1}
        vectorClock={1}
        chaptersCompleted={0}
        totalReadingSeconds={0}
        streakDays={1}
        isSyncing={false}
        milestoneUnlocked={null}
        onToggleEnabled={vi.fn()}
        onChangeMode={vi.fn()}
        onDismissMilestone={vi.fn()}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it('renders milestone toast even when HUD is closed', () => {
    render(
      <CloudlessSyncHUD
        isOpen={false}
        onClose={vi.fn()}
        isEnabled={true}
        mode="local_broadcast"
        localDeviceId="test_dev"
        activePeerCount={1}
        vectorClock={1}
        chaptersCompleted={10}
        totalReadingSeconds={1200}
        streakDays={2}
        isSyncing={false}
        milestoneUnlocked="¡Hito: 10 Capítulos Completados!"
        onToggleEnabled={vi.fn()}
        onChangeMode={vi.fn()}
        onDismissMilestone={vi.fn()}
      />
    );

    expect(screen.getByRole('status')).toBeDefined();
    expect(screen.getByText('¡Hito: 10 Capítulos Completados!')).toBeDefined();
  });

  it('renders dialog and telemetry controls when isOpen is true', () => {
    const onToggleEnabled = vi.fn();
    const onChangeMode = vi.fn();

    render(
      <CloudlessSyncHUD
        isOpen={true}
        onClose={vi.fn()}
        isEnabled={true}
        mode="local_broadcast"
        localDeviceId="dev_carlos"
        activePeerCount={3}
        vectorClock={5}
        chaptersCompleted={25}
        totalReadingSeconds={7200}
        streakDays={5}
        isSyncing={false}
        milestoneUnlocked={null}
        onToggleEnabled={onToggleEnabled}
        onChangeMode={onChangeMode}
        onDismissMilestone={vi.fn()}
      />
    );

    expect(screen.getByRole('dialog')).toBeDefined();
    expect(screen.getByText(/CloudlessSync • Sincronizador Local/i)).toBeDefined();
    expect(screen.getByText('ACTIVADO')).toBeDefined();
    expect(screen.getByText('25')).toBeDefined();
    expect(screen.getByText('dev_carlos')).toBeDefined();
    expect(screen.getByText('v5')).toBeDefined();

    // Toggle button
    fireEvent.click(screen.getByText('ACTIVADO'));
    expect(onToggleEnabled).toHaveBeenCalledTimes(1);

    // Switch mode
    fireEvent.click(screen.getByText('Emparejamiento Directo P2P'));
    expect(onChangeMode).toHaveBeenCalledWith('p2p_direct');
  });
});
