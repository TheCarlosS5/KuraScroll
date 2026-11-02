import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { DailyGoalRing } from '../../src/components/habits/DailyGoalRing';

describe('DailyGoalRing Component', () => {
  it('renders progressbar with correct accessibility aria attributes', () => {
    render(<DailyGoalRing current={15} target={30} unit="páginas" />);
    const bar = screen.getByRole('progressbar');
    expect(bar).toBeDefined();
    expect(bar.getAttribute('aria-valuenow')).toBe('15');
    expect(bar.getAttribute('aria-valuemax')).toBe('30');
    expect(bar.getAttribute('aria-valuetext')).toBe('15 de 30 páginas');
  });

  it('displays completion star icon when target is reached', () => {
    render(<DailyGoalRing current={35} target={30} />);
    expect(screen.getByText('⭐')).toBeDefined();
  });

  it('displays target icon when in progress', () => {
    render(<DailyGoalRing current={10} target={30} />);
    expect(screen.getByText('🎯')).toBeDefined();
  });

  it('renders percentage text when showText is true', () => {
    render(<DailyGoalRing current={15} target={30} showText={true} />);
    expect(screen.getByText('50%')).toBeDefined();
  });

  it('handles click callback when clicked', () => {
    const handleClick = vi.fn();
    render(<DailyGoalRing current={20} target={30} onClick={handleClick} />);
    fireEvent.click(screen.getByRole('progressbar'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});
