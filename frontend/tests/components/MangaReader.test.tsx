import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MangaReader } from '../../src/components/reader/MangaReader';
import React from 'react';

describe('MangaReader', () => {
  const dummyPages = [
    { id: 1, pageNumber: 1, fileName: '001.webp', width: 1000, height: 1500, aspectRatio: 0.666 },
    { id: 2, pageNumber: 2, fileName: '002.webp', width: 1000, height: 1500, aspectRatio: 0.666 },
    { id: 3, pageNumber: 3, fileName: '003.webp', width: 1000, height: 1500, aspectRatio: 0.666 },
    { id: 4, pageNumber: 4, fileName: '004.webp', width: 1000, height: 1500, aspectRatio: 0.666 },
  ];

  it('in RTL mode, ArrowLeft key advances to next page in single mode', () => {
    const handlePageChange = vi.fn();
    render(
      <MangaReader
        pages={dummyPages}
        currentPage={1}
        mode="RTL"
        storageBaseUrl="/storage/series/test/c1"
        onPageChange={handlePageChange}
      />
    );

    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(handlePageChange).toHaveBeenCalledWith(2);
  });

  it('in LTR mode, ArrowRight key advances to next page in single mode', () => {
    const handlePageChange = vi.fn();
    render(
      <MangaReader
        pages={dummyPages}
        currentPage={1}
        mode="LTR"
        storageBaseUrl="/storage/series/test/c1"
        onPageChange={handlePageChange}
      />
    );

    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(handlePageChange).toHaveBeenCalledWith(2);
  });

  it('renders ambient glow lighting behind the active page reflecting the comic mood', () => {
    const handlePageChange = vi.fn();
    const { container } = render(
      <MangaReader
        pages={dummyPages}
        currentPage={1}
        mode="RTL"
        storageBaseUrl="/storage/series/test/c1"
        onPageChange={handlePageChange}
      />
    );

    const ambientGlow = container.querySelector('img[aria-hidden="true"]');
    expect(ambientGlow).not.toBeNull();
    expect(ambientGlow?.getAttribute('src')).toBe('/storage/series/test/c1/001.webp');
  });

  it('renders aspect ratio container to guarantee zero layout shifts', () => {
    const handlePageChange = vi.fn();
    const { container } = render(
      <MangaReader
        pages={dummyPages}
        currentPage={1}
        mode="RTL"
        storageBaseUrl="/storage/series/test/c1"
        onPageChange={handlePageChange}
      />
    );

    const pageContainer = container.querySelector('div[style*="aspect-ratio"]');
    expect(pageContainer).not.toBeNull();
  });

  describe('Keyboard Shortcuts HUD Modal', () => {
    it('opens HUD modal when pressing "?" key and displays navigation shortcuts', () => {
      render(
        <MangaReader
          pages={dummyPages}
          currentPage={1}
          mode="RTL"
          storageBaseUrl="/storage/series/test/c1"
          onPageChange={vi.fn()}
        />
      );

      // Modal should initially not be visible
      expect(screen.queryByTestId('shortcuts-hud-modal')).toBeNull();

      // Press '?'
      fireEvent.keyDown(window, { key: '?' });

      // Modal should appear
      const modal = screen.getByTestId('shortcuts-hud-modal');
      expect(modal).not.toBeNull();
      expect(screen.getByText('Atajos de Teclado')).toBeDefined();
      expect(screen.getByText('Pantalla completa')).toBeDefined();
      expect(screen.getByText('Alternar modo Manga / Webtoon')).toBeDefined();
      expect(screen.getByText('Alternar tema de fondo')).toBeDefined();
    });

    it('closes HUD modal when pressing Escape or clicking close button', () => {
      render(
        <MangaReader
          pages={dummyPages}
          currentPage={1}
          mode="RTL"
          storageBaseUrl="/storage/series/test/c1"
          onPageChange={vi.fn()}
        />
      );

      // Open HUD
      fireEvent.keyDown(window, { key: '?' });
      expect(screen.getByTestId('shortcuts-hud-modal')).toBeDefined();

      // Press Escape to close
      fireEvent.keyDown(window, { key: 'Escape' });
      expect(screen.queryByTestId('shortcuts-hud-modal')).toBeNull();

      // Open again and click close button
      fireEvent.keyDown(window, { key: '?' });
      const closeBtn = screen.getByTestId('close-hud-btn');
      fireEvent.click(closeBtn);
      expect(screen.queryByTestId('shortcuts-hud-modal')).toBeNull();
    });

    it('opens HUD modal when clicking the pill shortcuts button', () => {
      render(
        <MangaReader
          pages={dummyPages}
          currentPage={1}
          mode="RTL"
          storageBaseUrl="/storage/series/test/c1"
          onPageChange={vi.fn()}
        />
      );

      const openBtn = screen.getByTestId('pill-open-shortcuts');
      fireEvent.click(openBtn);

      expect(screen.getByTestId('shortcuts-hud-modal')).toBeDefined();
    });
  });

  describe('Double-Page Spread Mode (Facing Pages)', () => {
    it('renders facing pages side-by-side in Japanese RTL order (page 1 on right, page 2 on left)', () => {
      render(
        <MangaReader
          pages={dummyPages}
          currentPage={1}
          mode="RTL"
          doublePage={true}
          storageBaseUrl="/storage/series/test/c1"
          onPageChange={vi.fn()}
        />
      );

      // Both spread pages should exist in DOM
      expect(screen.getByTestId('spread-page-1')).toBeDefined();
      expect(screen.getByTestId('spread-page-2')).toBeDefined();

      // Spread container should wrap them
      expect(screen.getByTestId('manga-spread-container')).toBeDefined();
    });

    it('in RTL double-page mode, ArrowLeft advances by 2 pages', () => {
      const handlePageChange = vi.fn();
      render(
        <MangaReader
          pages={dummyPages}
          currentPage={1}
          mode="RTL"
          doublePage={true}
          storageBaseUrl="/storage/series/test/c1"
          onPageChange={handlePageChange}
        />
      );

      fireEvent.keyDown(window, { key: 'ArrowLeft' });
      expect(handlePageChange).toHaveBeenCalledWith(3);
    });

    it('in LTR double-page mode, ArrowRight advances by 2 pages', () => {
      const handlePageChange = vi.fn();
      render(
        <MangaReader
          pages={dummyPages}
          currentPage={1}
          mode="LTR"
          doublePage={true}
          storageBaseUrl="/storage/series/test/c1"
          onPageChange={handlePageChange}
        />
      );

      fireEvent.keyDown(window, { key: 'ArrowRight' });
      expect(handlePageChange).toHaveBeenCalledWith(3);
    });

    it('intelligently detects wide panoramic scans (aspectRatio > 1.2) as single double-page spreads', () => {
      const pagesWithWideSpread = [
        { id: 1, pageNumber: 1, fileName: '001_wide.webp', width: 2400, height: 1600, aspectRatio: 1.5 },
        { id: 2, pageNumber: 2, fileName: '002.webp', width: 1000, height: 1500, aspectRatio: 0.666 },
      ];

      const handlePageChange = vi.fn();
      render(
        <MangaReader
          pages={pagesWithWideSpread}
          currentPage={1}
          mode="RTL"
          doublePage={true}
          storageBaseUrl="/storage/series/test/c1"
          onPageChange={handlePageChange}
        />
      );

      // Should render as single-page spread rather than paired spread
      expect(screen.getByTestId('single-page-1')).toBeDefined();
      expect(screen.queryByTestId('spread-page-2')).toBeNull();

      // Advancing from a wide spread advances by 1
      fireEvent.keyDown(window, { key: 'ArrowLeft' });
      expect(handlePageChange).toHaveBeenCalledWith(2);
    });

    it('toggles double-page mode when clicking the pill toggle button', () => {
      const handleToggle = vi.fn();
      render(
        <MangaReader
          pages={dummyPages}
          currentPage={1}
          mode="RTL"
          doublePage={false}
          onToggleDoublePage={handleToggle}
          storageBaseUrl="/storage/series/test/c1"
          onPageChange={vi.fn()}
        />
      );

      const toggleBtn = screen.getByTestId('pill-toggle-double-page');
      fireEvent.click(toggleBtn);
      expect(handleToggle).toHaveBeenCalledWith(true);
    });
  });
});
