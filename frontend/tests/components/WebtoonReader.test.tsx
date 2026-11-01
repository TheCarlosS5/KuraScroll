import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { WebtoonReader } from '../../src/components/reader/WebtoonReader';
import React from 'react';

describe('WebtoonReader', () => {
  const dummyPages = [
    { id: 1, pageNumber: 1, fileName: '001.webp', width: 1000, height: 1500, aspectRatio: 0.666 },
    { id: 2, pageNumber: 2, fileName: '002.webp', width: 1000, height: 1500, aspectRatio: 0.666 }
  ];

  it('renders all pages in vertical strip with ambient glow and aspect ratios', () => {
    const handleVisible = vi.fn();
    const { container } = render(
      <WebtoonReader
        pages={dummyPages}
        storageBaseUrl="/storage/series/test/c1"
        onPageVisible={handleVisible}
      />
    );

    const page1 = container.querySelector('#page-1');
    const page2 = container.querySelector('#page-2');
    expect(page1).not.toBeNull();
    expect(page2).not.toBeNull();

    // Verify ambient glow images
    const ambientGlows = container.querySelectorAll('img[aria-hidden="true"]');
    expect(ambientGlows.length).toBe(2);
  });

  it('triggers onPageVisible when an image loads', () => {
    const handleVisible = vi.fn();
    render(
      <WebtoonReader
        pages={dummyPages}
        storageBaseUrl="/storage/series/test/c1"
        onPageVisible={handleVisible}
      />
    );

    const img1 = screen.getByAltText('Página 1');
    fireEvent.load(img1);
    expect(handleVisible).toHaveBeenCalledWith(1);
  });
});
