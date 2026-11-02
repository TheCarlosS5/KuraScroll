import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AudioDeckHUD } from '../../src/components/reader/AudioDeckHUD.js';

describe('AudioDeckHUD Component Unit Tests (Sprint 49)', () => {
  it('renders audio deck with volume levels and active preset', () => {
    render(
      <AudioDeckHUD
        isMuted={false}
        bgmVolume={45}
        sfxVolume={80}
        isPlaying={true}
        activePreset="rain"
        onToggleMute={vi.fn()}
        onChangeBgm={vi.fn()}
        onChangeSfx={vi.fn()}
      />
    );

    expect(screen.getByTestId('audio-deck-hud')).toBeDefined();
    expect(screen.getByTestId('mute-toggle-btn')).toBeDefined();
    expect(screen.getByTestId('audio-wave-indicator')).toBeDefined();
    expect(screen.getByText(/rain/i)).toBeDefined();
    expect(screen.getByTestId('bgm-volume-label').textContent).toBe('45%');
    expect(screen.getByTestId('sfx-volume-label').textContent).toBe('80%');
  });

  it('triggers onToggleMute when mute button is clicked', () => {
    const handleToggleMute = vi.fn();
    render(
      <AudioDeckHUD
        isMuted={false}
        bgmVolume={50}
        sfxVolume={50}
        isPlaying={true}
        onToggleMute={handleToggleMute}
        onChangeBgm={vi.fn()}
        onChangeSfx={vi.fn()}
      />
    );

    const muteBtn = screen.getByTestId('mute-toggle-btn');
    fireEvent.click(muteBtn);
    expect(handleToggleMute).toHaveBeenCalledTimes(1);
  });

  it('triggers onToggleMute when "M" keyboard shortcut is pressed', () => {
    const handleToggleMute = vi.fn();
    render(
      <AudioDeckHUD
        isMuted={false}
        bgmVolume={50}
        sfxVolume={50}
        isPlaying={true}
        onToggleMute={handleToggleMute}
        onChangeBgm={vi.fn()}
        onChangeSfx={vi.fn()}
      />
    );

    fireEvent.keyDown(window, { key: 'm' });
    expect(handleToggleMute).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(window, { key: 'M' });
    expect(handleToggleMute).toHaveBeenCalledTimes(2);
  });

  it('does not trigger "M" shortcut when typing in input elements', () => {
    const handleToggleMute = vi.fn();
    render(
      <div>
        <input data-testid="dummy-input" type="text" />
        <AudioDeckHUD
          isMuted={false}
          bgmVolume={50}
          sfxVolume={50}
          isPlaying={true}
          onToggleMute={handleToggleMute}
          onChangeBgm={vi.fn()}
          onChangeSfx={vi.fn()}
        />
      </div>
    );

    const input = screen.getByTestId('dummy-input');
    fireEvent.keyDown(input, { key: 'm' });
    expect(handleToggleMute).not.toHaveBeenCalled();
  });

  it('triggers onChangeBgm and onChangeSfx on slider changes', () => {
    const handleChangeBgm = vi.fn();
    const handleChangeSfx = vi.fn();

    render(
      <AudioDeckHUD
        isMuted={false}
        bgmVolume={30}
        sfxVolume={70}
        isPlaying={true}
        onToggleMute={vi.fn()}
        onChangeBgm={handleChangeBgm}
        onChangeSfx={handleChangeSfx}
      />
    );

    const bgmSlider = screen.getByTestId('bgm-volume-slider');
    fireEvent.change(bgmSlider, { target: { value: '60' } });
    expect(handleChangeBgm).toHaveBeenCalledWith(60);

    const sfxSlider = screen.getByTestId('sfx-volume-slider');
    fireEvent.change(sfxSlider, { target: { value: '90' } });
    expect(handleChangeSfx).toHaveBeenCalledWith(90);
  });

  it('disables sliders and displays 0% when muted', () => {
    render(
      <AudioDeckHUD
        isMuted={true}
        bgmVolume={50}
        sfxVolume={80}
        isPlaying={true}
        onToggleMute={vi.fn()}
        onChangeBgm={vi.fn()}
        onChangeSfx={vi.fn()}
      />
    );

    expect(screen.getByTestId('bgm-volume-label').textContent).toBe('0%');
    expect(screen.getByTestId('sfx-volume-label').textContent).toBe('0%');
    expect((screen.getByTestId('bgm-volume-slider') as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByTestId('sfx-volume-slider') as HTMLInputElement).disabled).toBe(true);
  });
});
