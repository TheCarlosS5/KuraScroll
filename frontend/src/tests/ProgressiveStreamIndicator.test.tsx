import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProgressiveStreamIndicator } from '../components/reader/ProgressiveStreamIndicator.js';

describe('Sprint 57 - ProgressiveStreamIndicator Component Tests', () => {
  it('renders correctly with accessibility attributes and page number', () => {
    render(<ProgressiveStreamIndicator pageNumber={7} />);

    const container = screen.getByRole('status');
    expect(container).toBeDefined();
    expect(container.getAttribute('aria-label')).toBe('Loading page 7 from storage');
    expect(screen.getByText('Página 7')).toBeDefined();
    expect(screen.getByText('Streaming directo desde HDD 4TB (Zero-Seek)...')).toBeDefined();
  });

  it('hides streaming subtitle when isStreaming is false', () => {
    render(<ProgressiveStreamIndicator pageNumber={3} isStreaming={false} />);

    expect(screen.getByText('Página 3')).toBeDefined();
    expect(screen.queryByText('Streaming directo desde HDD 4TB (Zero-Seek)...')).toBeNull();
  });

  it('sets custom aspect ratio to maintain 0 CLS during progressive load', () => {
    render(<ProgressiveStreamIndicator pageNumber={12} aspectRatio={0.75} />);

    const container = screen.getByRole('status');
    expect(container.style.aspectRatio).toBe('0.75');
  });
});
