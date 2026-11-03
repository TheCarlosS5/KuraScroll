import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TilePrefetchHUD } from '../components/reader/TilePrefetchHUD';

describe('TilePrefetchHUD Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders trigger button when closed and opens on click', () => {
    render(<TilePrefetchHUD seriesId="series-tp-hud-1" />);

    const triggerBtn = screen.getByTitle(/Open Tile Prefetcher HUD/i);
    expect(triggerBtn).toBeDefined();

    fireEvent.click(triggerBtn);

    const hud = screen.getByTestId('tile-prefetch-hud');
    expect(hud).toBeDefined();
    expect(screen.getByText(/Tile Prefetch & LRU/i)).toBeDefined();
    expect(screen.getByText(/SLA 81/i)).toBeDefined();
  });

  it('allows switching presets and triggering simulation actions', () => {
    render(<TilePrefetchHUD seriesId="series-tp-hud-2" />);

    // Open HUD
    const triggerBtn = screen.getByTitle(/Open Tile Prefetcher HUD/i);
    fireEvent.click(triggerBtn);

    // Switch preset
    const webtoonBtn = screen.getByText(/Continuous Vertical Webtoon/i);
    fireEvent.click(webtoonBtn);
    expect(screen.getByText(/500 ms/i)).toBeDefined();

    // Trigger prefetch simulation button
    const prefetchBtn = screen.getByText('+ Prefetch');
    fireEvent.click(prefetchBtn);

    // Close HUD
    const closeBtn = screen.getByTitle(/Close \(Hotkey: P\)/i);
    fireEvent.click(closeBtn);
    expect(screen.queryByTestId('tile-prefetch-hud')).toBeNull();
  });
});
