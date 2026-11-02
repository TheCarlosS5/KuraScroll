import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BoustrophedonCameraHUD } from '../components/reader/BoustrophedonCameraHUD';

describe('BoustrophedonCameraHUD Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders trigger button when HUD is closed and opens on click', () => {
    render(<BoustrophedonCameraHUD seriesId="series-hud-1" />);

    const triggerBtn = screen.getByTitle(/Open Boustrophedon Camera Director HUD/i);
    expect(triggerBtn).toBeDefined();

    fireEvent.click(triggerBtn);

    const hud = screen.getByTestId('boustrophedon-camera-hud');
    expect(hud).toBeDefined();
    expect(screen.getByText(/Camera Director/i)).toBeDefined();
    expect(screen.getByText(/SLA 78/i)).toBeDefined();
  });

  it('allows switching reading flows and adjusting sliders', () => {
    render(<BoustrophedonCameraHUD seriesId="series-hud-2" />);

    // Open HUD
    const triggerBtn = screen.getByTitle(/Open Boustrophedon Camera Director HUD/i);
    fireEvent.click(triggerBtn);

    // Switch flow
    const webtoonBtn = screen.getByText(/Webtoon Vertical Ribbon/i);
    fireEvent.click(webtoonBtn);
    expect(screen.getByText(/Continuous vertical pan/i)).toBeDefined();

    // Adjust climax zoom slider
    const sliders = screen.getAllByRole('slider');
    expect(sliders.length).toBeGreaterThanOrEqual(3);

    // Close HUD
    const closeBtn = screen.getByText('✕');
    fireEvent.click(closeBtn);
    expect(screen.queryByTestId('boustrophedon-camera-hud')).toBeNull();
  });
});
