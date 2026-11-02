import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DialogueTtsHUD } from '../components/reader/DialogueTtsHUD';

describe('Sprint 75 - DialogueTtsHUD Component Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders null when isOpen is false', () => {
    const { container } = render(
      <DialogueTtsHUD
        isOpen={false}
        onClose={vi.fn()}
        isPlaying={false}
        isPaused={false}
        currentIndex={0}
        totalBubbles={5}
        masterRate={1.0}
        autoAdvance={true}
        onPlay={vi.fn()}
        onPause={vi.fn()}
        onResume={vi.fn()}
        onStop={vi.fn()}
        onSkipNext={vi.fn()}
        onSkipPrevious={vi.fn()}
        onChangeMasterRate={vi.fn()}
        onToggleAutoAdvance={vi.fn()}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it('renders HUD with speaker badge, text, and playback controls when isOpen is true', () => {
    render(
      <DialogueTtsHUD
        isOpen={true}
        onClose={vi.fn()}
        isPlaying={false}
        isPaused={false}
        currentIndex={0}
        totalBubbles={3}
        currentSpeaker="Luffy"
        currentRole="male_hero"
        currentBubbleText="¡Voy a ser el Rey de los Piratas!"
        masterRate={1.1}
        autoAdvance={true}
        onPlay={vi.fn()}
        onPause={vi.fn()}
        onResume={vi.fn()}
        onStop={vi.fn()}
        onSkipNext={vi.fn()}
        onSkipPrevious={vi.fn()}
        onChangeMasterRate={vi.fn()}
        onToggleAutoAdvance={vi.fn()}
      />
    );

    expect(screen.getByRole('dialog')).toBeDefined();
    expect(screen.getByText(/Voz Dinámica & TTS/i)).toBeDefined();
    expect(screen.getByText(/Héroe/i)).toBeDefined();
    expect(screen.getByText('Luffy')).toBeDefined();
    expect(screen.getByText('¡Voy a ser el Rey de los Piratas!')).toBeDefined();
    expect(screen.getByText('1 / 3')).toBeDefined();
    expect(screen.getByText('1.10x')).toBeDefined();
    expect(screen.getByText('Activado')).toBeDefined();
  });

  it('triggers onPlay and onStop callbacks when buttons are clicked', () => {
    const onPlay = vi.fn();
    const onStop = vi.fn();

    const { rerender } = render(
      <DialogueTtsHUD
        isOpen={true}
        onClose={vi.fn()}
        isPlaying={false}
        isPaused={false}
        currentIndex={0}
        totalBubbles={2}
        masterRate={1.0}
        autoAdvance={true}
        onPlay={onPlay}
        onPause={vi.fn()}
        onResume={vi.fn()}
        onStop={onStop}
        onSkipNext={vi.fn()}
        onSkipPrevious={vi.fn()}
        onChangeMasterRate={vi.fn()}
        onToggleAutoAdvance={vi.fn()}
      />
    );

    const playBtn = screen.getByLabelText(/Comenzar lectura/i);
    fireEvent.click(playBtn);
    expect(onPlay).toHaveBeenCalledTimes(1);

    // Rerender as playing
    rerender(
      <DialogueTtsHUD
        isOpen={true}
        onClose={vi.fn()}
        isPlaying={true}
        isPaused={false}
        currentIndex={0}
        totalBubbles={2}
        masterRate={1.0}
        autoAdvance={true}
        onPlay={onPlay}
        onPause={vi.fn()}
        onResume={vi.fn()}
        onStop={onStop}
        onSkipNext={vi.fn()}
        onSkipPrevious={vi.fn()}
        onChangeMasterRate={vi.fn()}
        onToggleAutoAdvance={vi.fn()}
      />
    );

    const stopBtn = screen.getByLabelText(/Detener lectura/i);
    fireEvent.click(stopBtn);
    expect(onStop).toHaveBeenCalledTimes(1);
  });

  it('changes master rate on slider input', () => {
    const onChangeRate = vi.fn();

    render(
      <DialogueTtsHUD
        isOpen={true}
        onClose={vi.fn()}
        isPlaying={false}
        isPaused={false}
        currentIndex={0}
        totalBubbles={1}
        masterRate={1.0}
        autoAdvance={true}
        onPlay={vi.fn()}
        onPause={vi.fn()}
        onResume={vi.fn()}
        onStop={vi.fn()}
        onSkipNext={vi.fn()}
        onSkipPrevious={vi.fn()}
        onChangeMasterRate={onChangeRate}
        onToggleAutoAdvance={vi.fn()}
      />
    );

    const slider = screen.getByLabelText(/Velocidad de Lectura/i);
    fireEvent.change(slider, { target: { value: '1.25' } });
    expect(onChangeRate).toHaveBeenCalledWith(1.25);
  });

  it('toggles auto-advance when button is clicked', () => {
    const onToggle = vi.fn();

    render(
      <DialogueTtsHUD
        isOpen={true}
        onClose={vi.fn()}
        isPlaying={false}
        isPaused={false}
        currentIndex={0}
        totalBubbles={1}
        masterRate={1.0}
        autoAdvance={true}
        onPlay={vi.fn()}
        onPause={vi.fn()}
        onResume={vi.fn()}
        onStop={vi.fn()}
        onSkipNext={vi.fn()}
        onSkipPrevious={vi.fn()}
        onChangeMasterRate={vi.fn()}
        onToggleAutoAdvance={onToggle}
      />
    );

    const toggleBtn = screen.getByLabelText(/Alternar avance automático/i);
    fireEvent.click(toggleBtn);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });
});
