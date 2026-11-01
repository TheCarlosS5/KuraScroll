import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { ReaderControls } from '../../src/components/reader/ReaderControls';

describe('ReaderControls Component', () => {
  const defaultProps = {
    seriesTitle: 'Solo Leveling',
    chapterNumber: 42,
    chapterTitle: 'Arise',
    readerMode: 'webtoon' as const,
    prevChapterId: 'ch-41',
    nextChapterId: 'ch-43',
    onBack: vi.fn(),
    onSelectChapter: vi.fn(),
    onChangeMode: vi.fn(),
  };

  it('renders series title, chapter number, and mode options', () => {
    render(<ReaderControls {...defaultProps} />);

    expect(screen.getByText('Solo Leveling')).toBeDefined();
    expect(screen.getByText(/Capítulo 42/)).toBeDefined();
    expect(screen.getByText(/Arise/)).toBeDefined();
  });

  it('displays the reading progress percentage pill based on currentPage and totalPages', () => {
    const { rerender } = render(
      <ReaderControls
        {...defaultProps}
        currentPage={5}
        totalPages={20}
      />
    );

    const pill = screen.getByTestId('reading-progress-pill');
    expect(pill.textContent).toContain('25%');

    // Update to page 10 of 20 -> 50%
    rerender(
      <ReaderControls
        {...defaultProps}
        currentPage={10}
        totalPages={20}
      />
    );
    expect(pill.textContent).toContain('50%');
  });

  it('displays the reading progress percentage pill when progressPercent is passed directly', () => {
    render(
      <ReaderControls
        {...defaultProps}
        progressPercent={73}
      />
    );

    const pill = screen.getByTestId('reading-progress-pill');
    expect(pill.textContent).toContain('73%');
  });

  it('renders reading background theme options (Pure Black, Deep Void, Warm Sepia)', () => {
    render(<ReaderControls {...defaultProps} />);

    const pureBlackBtn = screen.getByTestId('bg-theme-pure-black');
    const deepVoidBtn = screen.getByTestId('bg-theme-deep-void');
    const warmSepiaBtn = screen.getByTestId('bg-theme-warm-sepia');

    expect(pureBlackBtn).toBeDefined();
    expect(deepVoidBtn).toBeDefined();
    expect(warmSepiaBtn).toBeDefined();

    expect(pureBlackBtn.getAttribute('title')).toContain('#000');
    expect(deepVoidBtn.getAttribute('title')).toContain('#080c14');
    expect(warmSepiaBtn.getAttribute('title')).toContain('#1a1612');
  });

  it('calls onChangeBackground when a background option is selected', () => {
    const handleChangeBackground = vi.fn();
    render(
      <ReaderControls
        {...defaultProps}
        currentBackground="#080c14"
        onChangeBackground={handleChangeBackground}
      />
    );

    const warmSepiaBtn = screen.getByTestId('bg-theme-warm-sepia');
    fireEvent.click(warmSepiaBtn);

    expect(handleChangeBackground).toHaveBeenCalledWith('#1a1612');

    const pureBlackBtn = screen.getByTestId('bg-theme-pure-black');
    fireEvent.click(pureBlackBtn);

    expect(handleChangeBackground).toHaveBeenCalledWith('#000000');
  });

  it('calls onChangeMode when switching reading mode', () => {
    const handleChangeMode = vi.fn();
    render(
      <ReaderControls
        {...defaultProps}
        onChangeMode={handleChangeMode}
      />
    );

    const mangaRtlBtn = screen.getByRole('button', { name: /Manga \(RTL\)/i });
    fireEvent.click(mangaRtlBtn);

    expect(handleChangeMode).toHaveBeenCalledWith('manga-rtl');
  });

  it('handles chapter navigation and back button', () => {
    const handleBack = vi.fn();
    const handleSelectChapter = vi.fn();

    render(
      <ReaderControls
        {...defaultProps}
        onBack={handleBack}
        onSelectChapter={handleSelectChapter}
      />
    );

    const backBtn = screen.getByRole('button', { name: /Volver a la serie/i });
    fireEvent.click(backBtn);
    expect(handleBack).toHaveBeenCalled();

    const nextBtn = screen.getByRole('button', { name: /Capítulo Siguiente/i });
    fireEvent.click(nextBtn);
    expect(handleSelectChapter).toHaveBeenCalledWith('ch-43');
  });
});
