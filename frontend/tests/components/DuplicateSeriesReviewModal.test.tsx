import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  DuplicateSeriesReviewModal,
  DuplicatePair
} from '../../src/components/catalog/DuplicateSeriesReviewModal.js';

describe('DuplicateSeriesReviewModal Component Unit Suite (Sprint 43)', () => {
  const mockPair: DuplicatePair = {
    id: 'pair-123',
    similarityScore: 0.94,
    primarySeries: {
      id: 's-prim',
      title: 'Solo Leveling (Official)',
      coverUrl: '/covers/sl.webp',
      chaptersCount: 179,
      scanlationGroup: 'D&C Media'
    },
    duplicateSeries: {
      id: 's-dup',
      title: 'Solo Leveling [Asura Scans]',
      coverUrl: '/covers/sl-asura.webp',
      chaptersCount: 175,
      scanlationGroup: 'Asura Scans'
    }
  };

  it('renders modal dialog, titles, and Jaro-Winkler similarity chip', () => {
    render(
      <DuplicateSeriesReviewModal
        isOpen={true}
        onClose={vi.fn()}
        duplicatePair={mockPair}
        onMerge={vi.fn()}
        onDismiss={vi.fn()}
      />
    );

    expect(screen.getByRole('dialog')).toBeDefined();
    expect(screen.getByText('Revisión de Posible Duplicado')).toBeDefined();
    expect(screen.getByText('Similitud Jaro-Winkler: 94%')).toBeDefined();
    expect(screen.getByText('Solo Leveling (Official)')).toBeDefined();
    expect(screen.getByText('Solo Leveling [Asura Scans]')).toBeDefined();
    expect(screen.getByText('179')).toBeDefined();
    expect(screen.getByText('175')).toBeDefined();
  });

  it('triggers onMerge with primary and duplicate series IDs when clicking Merge button', () => {
    const onMergeMock = vi.fn();
    render(
      <DuplicateSeriesReviewModal
        isOpen={true}
        onClose={vi.fn()}
        duplicatePair={mockPair}
        onMerge={onMergeMock}
        onDismiss={vi.fn()}
      />
    );

    const mergeBtn = screen.getByText('Fusionar Series (Merge)');
    fireEvent.click(mergeBtn);

    expect(onMergeMock).toHaveBeenCalledWith('s-prim', 's-dup');
  });

  it('triggers onDismiss when clicking Dismiss button and onClose on Escape key', () => {
    const onDismissMock = vi.fn();
    const onCloseMock = vi.fn();

    render(
      <DuplicateSeriesReviewModal
        isOpen={true}
        onClose={onCloseMock}
        duplicatePair={mockPair}
        onMerge={vi.fn()}
        onDismiss={onDismissMock}
      />
    );

    const dismissBtn = screen.getByText('Mantener Separadas (Dismiss)');
    fireEvent.click(dismissBtn);
    expect(onDismissMock).toHaveBeenCalledWith('pair-123');

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onCloseMock).toHaveBeenCalled();
  });

  it('does not render anything when isOpen is false', () => {
    const { container } = render(
      <DuplicateSeriesReviewModal
        isOpen={false}
        onClose={vi.fn()}
        duplicatePair={mockPair}
        onMerge={vi.fn()}
        onDismiss={vi.fn()}
      />
    );

    expect(container.firstChild).toBeNull();
  });
});
