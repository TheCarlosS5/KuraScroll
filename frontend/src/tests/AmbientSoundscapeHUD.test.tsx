import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AmbientSoundscapeHUD } from '../components/reader/AmbientSoundscapeHUD';
import { SoundscapeTrack } from '../reader/useAmbientSoundscape';

describe('Sprint 73 - AmbientSoundscapeHUD Component Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const sampleTracks: SoundscapeTrack[] = [
    { id: 'rain', name: 'Lluvia en Ventana', icon: '🌧️', volume: 60, isPlaying: true },
    { id: 'campfire', name: 'Hoguera & Campamento', icon: '🔥', volume: 40, isPlaying: false },
  ];

  it('renders null when isOpen is false', () => {
    const { container } = render(
      <AmbientSoundscapeHUD
        isOpen={false}
        onClose={vi.fn()}
        masterVolume={70}
        isMuted={false}
        tracks={sampleTracks}
        onToggleMasterMute={vi.fn()}
        onChangeMasterVolume={vi.fn()}
        onChangeTrackVolume={vi.fn()}
        onToggleTrackPlay={vi.fn()}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it('renders modal dialog, master controls, and tracks when isOpen is true', () => {
    render(
      <AmbientSoundscapeHUD
        isOpen={true}
        onClose={vi.fn()}
        masterVolume={75}
        isMuted={false}
        tracks={sampleTracks}
        onToggleMasterMute={vi.fn()}
        onChangeMasterVolume={vi.fn()}
        onChangeTrackVolume={vi.fn()}
        onToggleTrackPlay={vi.fn()}
      />
    );

    expect(screen.getByTestId('ambient-soundscape-modal')).toBeDefined();
    expect(screen.getByText(/Mezclador de Paisajes Sonoros/i)).toBeDefined();
    expect(screen.getByText(/Volumen Maestro: 75%/i)).toBeDefined();

    expect(screen.getByTestId('track-card-rain')).toBeDefined();
    expect(screen.getByText(/Lluvia en Ventana/i)).toBeDefined();
    expect(screen.getByTestId('sound-wave-rain')).toBeDefined(); // isPlaying = true

    expect(screen.getByTestId('track-card-campfire')).toBeDefined();
    expect(screen.getByText(/Hoguera & Campamento/i)).toBeDefined();
    expect(screen.queryByTestId('sound-wave-campfire')).toBeNull(); // isPlaying = false
  });

  it('calls onToggleMasterMute when mute button is clicked', () => {
    const handleMute = vi.fn();
    render(
      <AmbientSoundscapeHUD
        isOpen={true}
        onClose={vi.fn()}
        masterVolume={75}
        isMuted={false}
        tracks={sampleTracks}
        onToggleMasterMute={handleMute}
        onChangeMasterVolume={vi.fn()}
        onChangeTrackVolume={vi.fn()}
        onToggleTrackPlay={vi.fn()}
      />
    );

    const muteBtn = screen.getByTestId('master-mute-btn');
    fireEvent.click(muteBtn);
    expect(handleMute).toHaveBeenCalledTimes(1);
  });

  it('calls onChangeMasterVolume when slider changes', () => {
    const handleVol = vi.fn();
    render(
      <AmbientSoundscapeHUD
        isOpen={true}
        onClose={vi.fn()}
        masterVolume={75}
        isMuted={false}
        tracks={sampleTracks}
        onToggleMasterMute={vi.fn()}
        onChangeMasterVolume={handleVol}
        onChangeTrackVolume={vi.fn()}
        onToggleTrackPlay={vi.fn()}
      />
    );

    const slider = screen.getByTestId('master-volume-slider');
    fireEvent.change(slider, { target: { value: '90' } });
    expect(handleVol).toHaveBeenCalledWith(90);
  });

  it('calls onToggleTrackPlay when track button is clicked', () => {
    const handleTogglePlay = vi.fn();
    render(
      <AmbientSoundscapeHUD
        isOpen={true}
        onClose={vi.fn()}
        masterVolume={75}
        isMuted={false}
        tracks={sampleTracks}
        onToggleMasterMute={vi.fn()}
        onChangeMasterVolume={vi.fn()}
        onChangeTrackVolume={vi.fn()}
        onToggleTrackPlay={handleTogglePlay}
      />
    );

    const playBtn = screen.getByTestId('track-play-btn-campfire');
    fireEvent.click(playBtn);
    expect(handleTogglePlay).toHaveBeenCalledWith('campfire');
  });

  it('calls onChangeTrackVolume when track slider changes', () => {
    const handleTrackVol = vi.fn();
    render(
      <AmbientSoundscapeHUD
        isOpen={true}
        onClose={vi.fn()}
        masterVolume={75}
        isMuted={false}
        tracks={sampleTracks}
        onToggleMasterMute={vi.fn()}
        onChangeMasterVolume={vi.fn()}
        onChangeTrackVolume={handleTrackVol}
        onToggleTrackPlay={vi.fn()}
      />
    );

    const trackSlider = screen.getByTestId('track-volume-slider-rain');
    fireEvent.change(trackSlider, { target: { value: '80' } });
    expect(handleTrackVol).toHaveBeenCalledWith('rain', 80);
  });

  it('closes when close button, Escape key, or "b" key is pressed', () => {
    const handleClose = vi.fn();
    render(
      <AmbientSoundscapeHUD
        isOpen={true}
        onClose={handleClose}
        masterVolume={75}
        isMuted={false}
        tracks={sampleTracks}
        onToggleMasterMute={vi.fn()}
        onChangeMasterVolume={vi.fn()}
        onChangeTrackVolume={vi.fn()}
        onToggleTrackPlay={vi.fn()}
      />
    );

    const closeBtn = screen.getByTestId('soundscape-close-btn');
    fireEvent.click(closeBtn);
    expect(handleClose).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(handleClose).toHaveBeenCalledTimes(2);

    fireEvent.keyDown(window, { key: 'b' });
    expect(handleClose).toHaveBeenCalledTimes(3);
  });
});
