import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MangaReader } from '../../src/components/reader/MangaReader';
import React from 'react';

describe('MangaReader', () => {
  const dummyPages = [
    { id: 1, pageNumber: 1, fileName: '001.webp', width: 1000, height: 1500, aspectRatio: 0.666 },
    { id: 2, pageNumber: 2, fileName: '002.webp', width: 1000, height: 1500, aspectRatio: 0.666 }
  ];

  it('in RTL mode, ArrowLeft key advances to next page', () => {
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

  it('in LTR mode, ArrowRight key advances to next page', () => {
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
});
