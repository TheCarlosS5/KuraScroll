import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HybridSearchMatchBadge } from '../../src/components/catalog/HybridSearchMatchBadge.js';

describe('HybridSearchMatchBadge Component Unit Suite (Sprint 47)', () => {
  it('renders hybrid match badge with percentage', () => {
    render(<HybridSearchMatchBadge matchType="hybrid" similarity={0.92} rrfScore={0.032} />);

    expect(screen.getByTestId('badge-hybrid')).toBeDefined();
    expect(screen.getByText('Híbrido 92%')).toBeDefined();
  });

  it('renders semantic match badge with percentage', () => {
    render(<HybridSearchMatchBadge matchType="semantic" similarity={0.85} />);

    expect(screen.getByTestId('badge-semantic')).toBeDefined();
    expect(screen.getByText('Semántico 85%')).toBeDefined();
  });

  it('renders lexical match badge', () => {
    render(<HybridSearchMatchBadge matchType="lexical" />);

    expect(screen.getByTestId('badge-lexical')).toBeDefined();
    expect(screen.getByText('Exacto')).toBeDefined();
  });
});
