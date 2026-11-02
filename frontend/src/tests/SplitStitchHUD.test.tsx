import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SplitStitchHUD } from '../components/reader/SplitStitchHUD';

describe('Sprint 76 - SplitStitchHUD Component Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders null when isOpen is false', () => {
    const { container } = render(
      <SplitStitchHUD
        isOpen={false}
        onClose={vi.fn()}
        isEnabled={true}
        mode="none"
        splitRatio={0.50}
        stitchGapPx={0}
        onToggleEnabled={vi.fn()}
        onChangeMode={vi.fn()}
        onChangeSplitRatio={vi.fn()}
        onChangeStitchGapPx={vi.fn()}
        onResetToDefaults={vi.fn()}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it('renders dialog, mode buttons, and controls when isOpen is true', () => {
    render(
      <SplitStitchHUD
        isOpen={true}
        onClose={vi.fn()}
        isEnabled={true}
        mode="split_rtl"
        splitRatio={0.52}
        stitchGapPx={0}
        onToggleEnabled={vi.fn()}
        onChangeMode={vi.fn()}
        onChangeSplitRatio={vi.fn()}
        onChangeStitchGapPx={vi.fn()}
        onResetToDefaults={vi.fn()}
      />
    );

    expect(screen.getByRole('dialog')).toBeDefined();
    expect(screen.getByText(/División & Costura Webtoon/i)).toBeDefined();
    expect(screen.getByText('Dividir RTL')).toBeDefined();
    expect(screen.getByText('Coser Webtoon')).toBeDefined();
    expect(screen.getByText('52%')).toBeDefined(); // 0.52 split ratio
    expect(screen.getByText('Activado')).toBeDefined();
  });

  it('switches mode when mode button is clicked', () => {
    const onChangeMode = vi.fn();

    render(
      <SplitStitchHUD
        isOpen={true}
        onClose={vi.fn()}
        isEnabled={true}
        mode="none"
        splitRatio={0.50}
        stitchGapPx={0}
        onToggleEnabled={vi.fn()}
        onChangeMode={onChangeMode}
        onChangeSplitRatio={vi.fn()}
        onChangeStitchGapPx={vi.fn()}
        onResetToDefaults={vi.fn()}
      />
    );

    const stitchBtn = screen.getByLabelText('Coser Webtoon');
    fireEvent.click(stitchBtn);
    expect(onChangeMode).toHaveBeenCalledWith('stitch_webtoon');
  });

  it('triggers onResetToDefaults callback when reset is clicked', () => {
    const onReset = vi.fn();

    render(
      <SplitStitchHUD
        isOpen={true}
        onClose={vi.fn()}
        isEnabled={true}
        mode="split_rtl"
        splitRatio={0.52}
        stitchGapPx={0}
        onToggleEnabled={vi.fn()}
        onChangeMode={vi.fn()}
        onChangeSplitRatio={vi.fn()}
        onChangeStitchGapPx={vi.fn()}
        onResetToDefaults={onReset}
      />
    );

    const resetBtn = screen.getByLabelText(/Restablecer valores por defecto/i);
    fireEvent.click(resetBtn);
    expect(onReset).toHaveBeenCalledTimes(1);
  });
});
