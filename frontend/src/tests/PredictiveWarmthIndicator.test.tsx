import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PredictiveWarmthIndicator } from '../components/reader/PredictiveWarmthIndicator.js';

describe('Sprint 59 - PredictiveWarmthIndicator Component Tests', () => {
  it('renders "Ready" with emerald styling when hot', () => {
    render(<PredictiveWarmthIndicator warmth="hot" pageNumber={5} />);

    const el = screen.getByRole('status');
    expect(el).toBeDefined();
    expect(el.getAttribute('aria-label')).toBe('Página lista en memoria caché');
    expect(screen.getByText('P.5 Ready')).toBeDefined();
  });

  it('renders "Warming..." when warming', () => {
    render(<PredictiveWarmthIndicator warmth="warming" pageNumber={6} />);

    const el = screen.getByRole('status');
    expect(el.getAttribute('aria-label')).toBe('Precargando página en segundo plano');
    expect(screen.getByText('P.6 Warming...')).toBeDefined();
  });

  it('renders "Cold" when cold', () => {
    render(<PredictiveWarmthIndicator warmth="cold" />);

    const el = screen.getByRole('status');
    expect(el.getAttribute('aria-label')).toBe('Página en disco frío');
    expect(screen.getByText('Cold')).toBeDefined();
  });

  it('hides text label in compact mode but keeps container and status role', () => {
    render(<PredictiveWarmthIndicator warmth="hot" pageNumber={5} compact={true} />);

    expect(screen.getByRole('status')).toBeDefined();
    expect(screen.queryByText('P.5 Ready')).toBeNull();
  });

  it('fires onRefreshWarmth click callback when clicked', () => {
    const handleClick = vi.fn();
    render(<PredictiveWarmthIndicator warmth="cold" onRefreshWarmth={handleClick} />);

    fireEvent.click(screen.getByRole('status'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});
