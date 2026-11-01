import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { ThumbnailScrubber, ScrubberPageItem } from '../../src/components/reader/ThumbnailScrubber';

describe('ThumbnailScrubber Component', () => {
  const dummyPages: ScrubberPageItem[] = [
    { id: 1, pageNumber: 1, fileName: '001.webp', width: 1000, height: 1500, aspectRatio: 0.666 },
    { id: 2, pageNumber: 2, fileName: '002.webp', width: 1000, height: 1500, aspectRatio: 0.666 },
    { id: 3, pageNumber: 3, fileName: '003.webp', width: 1000, height: 1500, aspectRatio: 0.666 },
    { id: 4, pageNumber: 4, fileName: '004.webp', width: 1000, height: 1500, aspectRatio: 0.666 },
  ];

  const defaultProps = {
    pages: dummyPages,
    currentPage: 2,
    storageBaseUrl: '/storage/series/test/c1',
    isOpen: true,
    onSelectPage: vi.fn(),
    onClose: vi.fn(),
    onToggle: vi.fn(),
  };

  it('renders all page thumbnails with numbered badges', () => {
    render(<ThumbnailScrubber {...defaultProps} />);

    expect(screen.getByTestId('thumbnail-scrubber')).toBeDefined();
    expect(screen.getByTestId('thumbnail-item-1')).toBeDefined();
    expect(screen.getByTestId('thumbnail-item-2')).toBeDefined();
    expect(screen.getByTestId('thumbnail-item-3')).toBeDefined();
    expect(screen.getByTestId('thumbnail-item-4')).toBeDefined();

    // Check header counter
    const counter = screen.getByTestId('scrubber-page-counter');
    expect(counter.textContent).toContain('2');
    expect(counter.textContent).toContain('4');
  });

  it('visually highlights the active page with crimson accent (#dc2626)', () => {
    render(<ThumbnailScrubber {...defaultProps} currentPage={2} />);

    const activeItem = screen.getByTestId('thumbnail-item-2');
    const inactiveItem = screen.getByTestId('thumbnail-item-1');

    expect(activeItem.getAttribute('aria-current')).toBe('page');
    expect(inactiveItem.getAttribute('aria-current')).toBeNull();

    // Verify crimson accent border and class presence
    expect(activeItem.className).toContain('border-[#dc2626]');
    expect(activeItem.style.borderColor).toBe('rgb(220, 38, 38)'); // #dc2626 in rgb
  });

  it('triggers onSelectPage callback when a thumbnail is clicked', () => {
    const handleSelectPage = vi.fn();
    render(<ThumbnailScrubber {...defaultProps} onSelectPage={handleSelectPage} />);

    const targetThumb = screen.getByTestId('thumbnail-item-3');
    fireEvent.click(targetThumb);

    expect(handleSelectPage).toHaveBeenCalledWith(3);
  });

  it('triggers onClose when close button is clicked', () => {
    const handleClose = vi.fn();
    render(<ThumbnailScrubber {...defaultProps} onClose={handleClose} />);

    const closeBtn = screen.getByTestId('close-scrubber-btn');
    fireEvent.click(closeBtn);

    expect(handleClose).toHaveBeenCalled();
  });

  it('expands drawer on mouse enter in hover trigger zone', () => {
    render(<ThumbnailScrubber {...defaultProps} isOpen={false} />);

    const scrubber = screen.getByTestId('thumbnail-scrubber');
    expect(scrubber.className).toContain('translate-y-full');

    const hoverTrigger = screen.getByTestId('scrubber-hover-trigger');
    fireEvent.mouseEnter(hoverTrigger);

    expect(scrubber.className).toContain('translate-y-0');
  });

  it('renders correct image sources and handles mouse wheel scrolling', () => {
    render(<ThumbnailScrubber {...defaultProps} />);

    const img1 = screen.getByAltText('Página 1') as HTMLImageElement;
    expect(img1.src).toContain('/storage/series/test/c1/001.webp');

    const filmstrip = screen.getByTestId('scrubber-filmstrip');
    expect(filmstrip).toBeDefined();

    // Simulate vertical mouse wheel to horizontal scroll
    fireEvent.wheel(filmstrip, { deltaY: 120 });
  });

  it('shows floating tooltip on thumbnail hover with page number preview and hides on leave', () => {
    render(<ThumbnailScrubber {...defaultProps} />);

    expect(screen.queryByTestId('scrubber-floating-tooltip')).toBeNull();

    const targetThumb = screen.getByTestId('thumbnail-item-2');
    fireEvent.mouseEnter(targetThumb);

    const tooltip = screen.getByTestId('scrubber-floating-tooltip');
    expect(tooltip).toBeDefined();
    expect(tooltip.textContent).toContain('Página 2');

    fireEvent.mouseLeave(targetThumb);
    expect(screen.queryByTestId('scrubber-floating-tooltip')).toBeNull();
  });
});
