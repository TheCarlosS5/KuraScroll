import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import {
  ReaderVisualSettingsModal,
  DEFAULT_DISPLAY_SETTINGS,
  ReaderDisplaySettings,
  buildImageFilter,
  loadReaderDisplaySettings,
  saveReaderDisplaySettings,
  STORAGE_KEY,
} from '../../src/components/reader/ReaderVisualSettingsModal';
import { ReaderControls } from '../../src/components/reader/ReaderControls';
import { WebtoonReader, ReaderPageItem } from '../../src/components/reader/WebtoonReader';
import { MangaReader } from '../../src/components/reader/MangaReader';

describe('ReaderVisualSettingsModal Component & Utilities', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  describe('Modal Rendering and Visibility', () => {
    it('does not render anything when isOpen is false', () => {
      render(
        <ReaderVisualSettingsModal
          isOpen={false}
          onClose={vi.fn()}
          settings={DEFAULT_DISPLAY_SETTINGS}
          onChangeSettings={vi.fn()}
        />
      );

      expect(screen.queryByTestId('reader-visual-settings-modal')).toBeNull();
    });

    it('renders modal dialog and title when isOpen is true', () => {
      render(
        <ReaderVisualSettingsModal
          isOpen={true}
          onClose={vi.fn()}
          settings={DEFAULT_DISPLAY_SETTINGS}
          onChangeSettings={vi.fn()}
        />
      );

      expect(screen.getByTestId('reader-visual-settings-modal')).toBeDefined();
      expect(screen.getByText('Ajustes Visuales & Ambilight')).toBeDefined();
    });

    it('triggers onClose when close button or Esc key is pressed', () => {
      const onClose = vi.fn();
      render(
        <ReaderVisualSettingsModal
          isOpen={true}
          onClose={onClose}
          settings={DEFAULT_DISPLAY_SETTINGS}
          onChangeSettings={vi.fn()}
        />
      );

      fireEvent.click(screen.getByTestId('close-visual-settings-btn'));
      expect(onClose).toHaveBeenCalledTimes(1);

      fireEvent.keyDown(window, { key: 'Escape' });
      expect(onClose).toHaveBeenCalledTimes(2);
    });
  });

  describe('Image Filters Controls', () => {
    it('modifies brightness slider and updates settings & localStorage', () => {
      const onChangeSettings = vi.fn();
      render(
        <ReaderVisualSettingsModal
          isOpen={true}
          onClose={vi.fn()}
          settings={DEFAULT_DISPLAY_SETTINGS}
          onChangeSettings={onChangeSettings}
        />
      );

      const slider = screen.getByTestId('brightness-slider');
      fireEvent.change(slider, { target: { value: '125' } });

      expect(onChangeSettings).toHaveBeenCalledWith({
        ...DEFAULT_DISPLAY_SETTINGS,
        brightness: 125,
      });

      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      expect(saved.brightness).toBe(125);
    });

    it('modifies contrast slider and updates settings & localStorage', () => {
      const onChangeSettings = vi.fn();
      render(
        <ReaderVisualSettingsModal
          isOpen={true}
          onClose={vi.fn()}
          settings={DEFAULT_DISPLAY_SETTINGS}
          onChangeSettings={onChangeSettings}
        />
      );

      const slider = screen.getByTestId('contrast-slider');
      fireEvent.change(slider, { target: { value: '80' } });

      expect(onChangeSettings).toHaveBeenCalledWith({
        ...DEFAULT_DISPLAY_SETTINGS,
        contrast: 80,
      });

      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      expect(saved.contrast).toBe(80);
    });

    it('toggles warm sepia preset and adjusts sepia slider', () => {
      const onChangeSettings = vi.fn();
      const { rerender } = render(
        <ReaderVisualSettingsModal
          isOpen={true}
          onClose={vi.fn()}
          settings={DEFAULT_DISPLAY_SETTINGS}
          onChangeSettings={onChangeSettings}
        />
      );

      // Toggle preset on (from 0 to 50%)
      const presetBtn = screen.getByTestId('toggle-sepia-preset');
      fireEvent.click(presetBtn);

      expect(onChangeSettings).toHaveBeenCalledWith({
        ...DEFAULT_DISPLAY_SETTINGS,
        sepia: 50,
      });

      // Rerender with sepia: 50 and use slider to change to 70
      rerender(
        <ReaderVisualSettingsModal
          isOpen={true}
          onClose={vi.fn()}
          settings={{ ...DEFAULT_DISPLAY_SETTINGS, sepia: 50 }}
          onChangeSettings={onChangeSettings}
        />
      );

      const slider = screen.getByTestId('sepia-slider');
      fireEvent.change(slider, { target: { value: '70' } });

      expect(onChangeSettings).toHaveBeenCalledWith({
        ...DEFAULT_DISPLAY_SETTINGS,
        sepia: 70,
      });
    });

    it('toggles grayscale and invert OLED modes', () => {
      const onChangeSettings = vi.fn();
      render(
        <ReaderVisualSettingsModal
          isOpen={true}
          onClose={vi.fn()}
          settings={DEFAULT_DISPLAY_SETTINGS}
          onChangeSettings={onChangeSettings}
        />
      );

      // Toggle grayscale
      fireEvent.click(screen.getByTestId('toggle-grayscale-btn'));
      expect(onChangeSettings).toHaveBeenCalledWith({
        ...DEFAULT_DISPLAY_SETTINGS,
        grayscale: true,
      });

      // Toggle invert
      fireEvent.click(screen.getByTestId('toggle-invert-btn'));
      expect(onChangeSettings).toHaveBeenCalledWith({
        ...DEFAULT_DISPLAY_SETTINGS,
        invert: true,
      });
    });
  });

  describe('Atmospheric Ambilight Depth System', () => {
    it('toggles Ambilight enabled state', () => {
      const onChangeSettings = vi.fn();
      render(
        <ReaderVisualSettingsModal
          isOpen={true}
          onClose={vi.fn()}
          settings={DEFAULT_DISPLAY_SETTINGS}
          onChangeSettings={onChangeSettings}
        />
      );

      const toggleBtn = screen.getByTestId('toggle-ambilight-btn');
      expect(toggleBtn.textContent).toBe('Activado');

      fireEvent.click(toggleBtn);
      expect(onChangeSettings).toHaveBeenCalledWith({
        ...DEFAULT_DISPLAY_SETTINGS,
        ambilightEnabled: false,
      });
    });

    it('adjusts Ambilight halo intensity slider when enabled', () => {
      const onChangeSettings = vi.fn();
      render(
        <ReaderVisualSettingsModal
          isOpen={true}
          onClose={vi.fn()}
          settings={{ ...DEFAULT_DISPLAY_SETTINGS, ambilightEnabled: true, ambilightIntensity: 100 }}
          onChangeSettings={onChangeSettings}
        />
      );

      const slider = screen.getByTestId('ambilight-intensity-slider');
      fireEvent.change(slider, { target: { value: '60' } });

      expect(onChangeSettings).toHaveBeenCalledWith({
        ...DEFAULT_DISPLAY_SETTINGS,
        ambilightIntensity: 60,
      });
    });

    it('hides intensity slider when Ambilight is disabled', () => {
      render(
        <ReaderVisualSettingsModal
          isOpen={true}
          onClose={vi.fn()}
          settings={{ ...DEFAULT_DISPLAY_SETTINGS, ambilightEnabled: false }}
          onChangeSettings={vi.fn()}
        />
      );

      expect(screen.queryByTestId('ambilight-intensity-slider')).toBeNull();
    });
  });

  describe('Webtoon Format Adjustments', () => {
    it('updates column max width selector buttons', () => {
      const onChangeSettings = vi.fn();
      render(
        <ReaderVisualSettingsModal
          isOpen={true}
          onClose={vi.fn()}
          settings={DEFAULT_DISPLAY_SETTINGS}
          onChangeSettings={onChangeSettings}
        />
      );

      fireEvent.click(screen.getByTestId('webtoon-width-700px'));
      expect(onChangeSettings).toHaveBeenCalledWith({
        ...DEFAULT_DISPLAY_SETTINGS,
        webtoonMaxWidth: '700px',
      });

      fireEvent.click(screen.getByTestId('webtoon-width-100%'));
      expect(onChangeSettings).toHaveBeenCalledWith({
        ...DEFAULT_DISPLAY_SETTINGS,
        webtoonMaxWidth: '100%',
      });
    });

    it('updates panel gap separation buttons', () => {
      const onChangeSettings = vi.fn();
      render(
        <ReaderVisualSettingsModal
          isOpen={true}
          onClose={vi.fn()}
          settings={DEFAULT_DISPLAY_SETTINGS}
          onChangeSettings={onChangeSettings}
        />
      );

      fireEvent.click(screen.getByTestId('webtoon-gap-16px'));
      expect(onChangeSettings).toHaveBeenCalledWith({
        ...DEFAULT_DISPLAY_SETTINGS,
        webtoonGap: '16px',
      });

      fireEvent.click(screen.getByTestId('webtoon-gap-0px'));
      expect(onChangeSettings).toHaveBeenCalledWith({
        ...DEFAULT_DISPLAY_SETTINGS,
        webtoonGap: '0px',
      });
    });
  });

  describe('Reset to Defaults', () => {
    it('restores default display settings when reset button is clicked', () => {
      const onChangeSettings = vi.fn();
      const customized: ReaderDisplaySettings = {
        brightness: 130,
        contrast: 120,
        sepia: 40,
        invert: true,
        grayscale: true,
        webtoonMaxWidth: '1100px',
        webtoonGap: '24px',
        ambilightEnabled: false,
        ambilightIntensity: 50,
        thermalSaverEnabled: true,
      };

      render(
        <ReaderVisualSettingsModal
          isOpen={true}
          onClose={vi.fn()}
          settings={customized}
          onChangeSettings={onChangeSettings}
        />
      );

      fireEvent.click(screen.getByTestId('reset-visual-settings-btn'));
      expect(onChangeSettings).toHaveBeenCalledWith(DEFAULT_DISPLAY_SETTINGS);

      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      expect(saved).toEqual(DEFAULT_DISPLAY_SETTINGS);
    });
  });

  describe('CSS Filter String Builder and Persistence Utilities', () => {
    it('generates correct CSS filter string with buildImageFilter', () => {
      expect(buildImageFilter(DEFAULT_DISPLAY_SETTINGS)).toBe('none');

      expect(
        buildImageFilter({
          ...DEFAULT_DISPLAY_SETTINGS,
          brightness: 120,
        })
      ).toBe('brightness(120%)');

      expect(
        buildImageFilter({
          ...DEFAULT_DISPLAY_SETTINGS,
          brightness: 90,
          contrast: 110,
          sepia: 30,
          grayscale: true,
          invert: true,
        })
      ).toBe('brightness(90%) contrast(110%) sepia(30%) grayscale(100%) invert(100%)');
    });

    it('persists and loads settings from localStorage', () => {
      const custom: ReaderDisplaySettings = {
        brightness: 85,
        contrast: 115,
        sepia: 25,
        invert: false,
        grayscale: false,
        webtoonMaxWidth: '700px',
        webtoonGap: '8px',
        ambilightEnabled: true,
        ambilightIntensity: 75,
        thermalSaverEnabled: false,
      };

      saveReaderDisplaySettings(custom);
      const loaded = loadReaderDisplaySettings();
      expect(loaded).toEqual(custom);
    });

    it('falls back to default settings when localStorage is empty or corrupt', () => {
      localStorage.setItem(STORAGE_KEY, 'invalid-json');
      const loaded = loadReaderDisplaySettings();
      expect(loaded).toEqual(DEFAULT_DISPLAY_SETTINGS);
    });
  });

  describe('Reader Integration Tests', () => {
    it('ReaderControls renders visual settings trigger button and calls handler', () => {
      const onOpenVisualSettings = vi.fn();
      render(
        <ReaderControls
          seriesTitle="Solo Leveling"
          chapterNumber={1}
          readerMode="manga-rtl"
          onBack={vi.fn()}
          onSelectChapter={vi.fn()}
          onChangeMode={vi.fn()}
          onOpenVisualSettings={onOpenVisualSettings}
        />
      );

      const btn = screen.getByTestId('visual-settings-btn');
      expect(btn).toBeDefined();
      fireEvent.click(btn);
      expect(onOpenVisualSettings).toHaveBeenCalledTimes(1);
    });

    it('WebtoonReader dynamically applies visual settings to panels and central channel', () => {
      const mockPages: ReaderPageItem[] = [
        { id: 1, pageNumber: 1, fileName: '001.webp', width: 800, height: 1200, aspectRatio: 0.666 },
        { id: 2, pageNumber: 2, fileName: '002.webp', width: 800, height: 1200, aspectRatio: 0.666 },
      ];

      const settings: ReaderDisplaySettings = {
        ...DEFAULT_DISPLAY_SETTINGS,
        brightness: 120,
        contrast: 110,
        webtoonMaxWidth: '700px',
        webtoonGap: '16px',
      };

      render(
        <WebtoonReader
          pages={mockPages}
          storageBaseUrl="/storage/manhwa"
          displaySettings={settings}
        />
      );

      const channel = screen.getByTestId('webtoon-reading-channel');
      expect(channel.style.maxWidth).toBe('700px');
      expect(channel.style.gap).toBe('16px');

      const pageImg = screen.getByAltText('Página 1');
      expect(pageImg.style.filter).toContain('brightness(120%)');
      expect(pageImg.style.filter).toContain('contrast(110%)');
    });

    it('MangaReader applies CSS filter and opens visual settings via pill & V key', () => {
      const mockPages: ReaderPageItem[] = [
        { id: 1, pageNumber: 1, fileName: '001.webp', width: 800, height: 1200, aspectRatio: 0.666 },
      ];

      const onOpenVisualSettings = vi.fn();
      const settings: ReaderDisplaySettings = {
        ...DEFAULT_DISPLAY_SETTINGS,
        brightness: 90,
        sepia: 40,
      };

      render(
        <MangaReader
          pages={mockPages}
          currentPage={1}
          mode="RTL"
          storageBaseUrl="/storage/manga"
          onPageChange={vi.fn()}
          displaySettings={settings}
          onOpenVisualSettings={onOpenVisualSettings}
        />
      );

      const pageImg = screen.getByAltText('Página 1');
      expect(pageImg.style.filter).toContain('brightness(90%)');
      expect(pageImg.style.filter).toContain('sepia(40%)');

      // Click visual settings button in indicator pill
      const pillBtn = screen.getByTestId('pill-open-visual-settings');
      fireEvent.click(pillBtn);
      expect(onOpenVisualSettings).toHaveBeenCalledTimes(1);

      // Press 'v' key
      fireEvent.keyDown(window, { key: 'v' });
      expect(onOpenVisualSettings).toHaveBeenCalledTimes(2);
    });

    it('toggles thermalSaverEnabled setting when thermal saver button is clicked', () => {
      const onChangeSettings = vi.fn();
      render(
        <ReaderVisualSettingsModal
          isOpen={true}
          onClose={vi.fn()}
          settings={DEFAULT_DISPLAY_SETTINGS}
          onChangeSettings={onChangeSettings}
        />
      );

      const thermalBtn = screen.getByTestId('toggle-thermal-saver-btn');
      fireEvent.click(thermalBtn);
      expect(onChangeSettings).toHaveBeenCalledWith(
        expect.objectContaining({ thermalSaverEnabled: true })
      );
    });
  });
});
