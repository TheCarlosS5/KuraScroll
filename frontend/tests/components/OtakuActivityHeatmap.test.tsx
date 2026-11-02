import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { OtakuActivityHeatmap, DayActivityItem } from '../../src/components/stats/OtakuActivityHeatmap.js';

describe('OtakuActivityHeatmap Component Unit Suite (Sprint 41)', () => {
  const sampleDays: DayActivityItem[] = [
    { date: '2026-10-01', pages: 12, seconds: 600, intensity: 1 },
    { date: '2026-10-02', pages: 35, seconds: 1500, intensity: 2 },
    { date: '2026-10-03', pages: 75, seconds: 2400, intensity: 3 },
    { date: '2026-10-04', pages: 120, seconds: 4000, intensity: 4 },
    { date: '2026-10-05', pages: 0, seconds: 0, intensity: 0 },
  ];

  it('renders heatmap container and metrics summary', () => {
    render(
      <OtakuActivityHeatmap
        days={sampleDays}
        totalDaysActive={4}
        totalPagesPeriod={242}
        totalReadingSeconds={8500}
      />
    );

    expect(screen.getByTestId('otaku-activity-heatmap')).toBeDefined();
    expect(screen.getByText('4')).toBeDefined();
    expect(screen.getByText('242')).toBeDefined();
  });

  it('renders individual day cells with native tooltips for zero GPU overlay reflows', () => {
    render(<OtakuActivityHeatmap days={sampleDays} />);

    const cell1 = screen.getByTestId('heatmap-cell-2026-10-01');
    expect(cell1).toBeDefined();
    expect(cell1.getAttribute('fill')).toBe('#083344'); // intensity 1

    const cell4 = screen.getByTestId('heatmap-cell-2026-10-04');
    expect(cell4).toBeDefined();
    expect(cell4.getAttribute('fill')).toBe('#22d3ee'); // intensity 4
  });

  it('enforces contain: layout paint to guarantee zero Cumulative Layout Shift', () => {
    const { container } = render(<OtakuActivityHeatmap days={sampleDays} />);
    const heatmap = container.querySelector('[data-testid="otaku-activity-heatmap"]') as HTMLElement;

    expect(heatmap.style.contain).toBe('layout paint');
  });
});
