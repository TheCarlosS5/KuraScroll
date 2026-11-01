import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MangaReader } from '../../src/components/reader/MangaReader';
import React from 'react';

describe('MangaReader RTL mode', () => {
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
});
