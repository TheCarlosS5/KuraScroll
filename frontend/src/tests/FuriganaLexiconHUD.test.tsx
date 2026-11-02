import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FuriganaLexiconHUD } from '../components/reader/FuriganaLexiconHUD.js';
import { LexiconEntry } from '../reader/useFuriganaLexicon.js';

describe('Sprint 62 - FuriganaLexiconHUD Component Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const mockEntry: LexiconEntry = {
    id: 'lex-test-1',
    term: '卍解',
    reading: 'ばんかい',
    romaji: 'bankai',
    category: 'SERIES_LORE',
    definitionEs: 'Liberación final de la Zanpakuto en Bleach.',
    definitionEn: 'Final Zanpakuto release.',
    seriesId: null,
    frequency: 12,
  };

  it('does not render when isOpen is false', () => {
    const { container } = render(
      <FuriganaLexiconHUD
        entry={mockEntry}
        isOpen={false}
        onClose={vi.fn()}
        position={{ x: 100, y: 100 }}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it('renders entry details with semantic ruby tag and category badge', () => {
    render(
      <FuriganaLexiconHUD
        entry={mockEntry}
        isOpen={true}
        onClose={vi.fn()}
        position={{ x: 200, y: 300 }}
      />
    );

    expect(screen.getByRole('tooltip')).toBeDefined();
    expect(screen.getByText('卍解')).toBeDefined();
    expect(screen.getByText('ばんかい')).toBeDefined();
    expect(screen.getByText('bankai')).toBeDefined();
    expect(screen.getByText('SERIES LORE')).toBeDefined();
    expect(screen.getByText('Liberación final de la Zanpakuto en Bleach.')).toBeDefined();
    expect(screen.getByText('Final Zanpakuto release.')).toBeDefined();
  });

  it('renders loading state when isLoading is true', () => {
    render(
      <FuriganaLexiconHUD
        entry={null}
        isOpen={true}
        isLoading={true}
        onClose={vi.fn()}
        position={{ x: 100, y: 100 }}
      />
    );

    expect(screen.getByText('Consultando base léxica...')).toBeDefined();
  });

  it('calls onClose when close button is clicked or Escape key pressed', () => {
    const handleClose = vi.fn();
    render(
      <FuriganaLexiconHUD
        entry={mockEntry}
        isOpen={true}
        onClose={handleClose}
        position={{ x: 100, y: 100 }}
      />
    );

    const closeBtn = screen.getByLabelText('Cerrar glosario');
    fireEvent.click(closeBtn);
    expect(handleClose).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(handleClose).toHaveBeenCalledTimes(2);
  });
});
