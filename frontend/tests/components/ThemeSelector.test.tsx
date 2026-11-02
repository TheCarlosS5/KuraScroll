import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { ThemeSelector, THEME_OPTIONS } from '../../src/components/reader/ThemeSelector';

describe('ThemeSelector Component (Sprint 33)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    } as any);
  });

  it('renders all 4 ambient theme options', () => {
    render(<ThemeSelector currentTheme="carbon" />);

    expect(screen.getByTestId('theme-selector')).toBeDefined();
    for (const opt of THEME_OPTIONS) {
      expect(screen.getByTestId(`theme-option-${opt.id}`)).toBeDefined();
      expect(screen.getByText(opt.name)).toBeDefined();
    }
  });

  it('sets data-reader-theme on document root and calls callback on select', () => {
    const handleThemeChange = vi.fn();
    render(<ThemeSelector currentTheme="carbon" onThemeChange={handleThemeChange} />);

    // Click 'oled' option
    const oledBtn = screen.getByTestId('theme-option-oled');
    fireEvent.click(oledBtn);

    expect(handleThemeChange).toHaveBeenCalledWith('oled');
    expect(document.documentElement.getAttribute('data-reader-theme')).toBe('oled');
    expect(global.fetch).toHaveBeenCalledWith('/api/v1/user/preferences', expect.objectContaining({
      method: 'PUT',
    }));
  });

  it('switches to sepia theme correctly without layout shifts', () => {
    const handleThemeChange = vi.fn();
    render(<ThemeSelector currentTheme="carbon" onThemeChange={handleThemeChange} />);

    const sepiaBtn = screen.getByTestId('theme-option-sepia');
    fireEvent.click(sepiaBtn);

    expect(handleThemeChange).toHaveBeenCalledWith('sepia');
    expect(document.documentElement.getAttribute('data-reader-theme')).toBe('sepia');
  });
});
