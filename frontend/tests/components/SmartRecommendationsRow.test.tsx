import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { SmartRecommendationsRow } from '../../src/components/recommendations/SmartRecommendationsRow';

describe('SmartRecommendationsRow Component (Sprint 32 UI)', () => {
  const mockRecommendations = [
    {
      id: 's1',
      slug: 'solo-leveling',
      titlePrimary: 'Solo Leveling',
      type: 'manhwa',
      coverImage: 'https://example.com/sl.jpg',
      genres: ['Acción', 'Fantasía'],
      affinityScore: 94,
      reasonBadge: 'Porque leíste Solo Leveling',
      reasonType: 'similarity',
      estimatedChapterMinutes: 4,
    },
    {
      id: 's2',
      slug: 'berserk',
      titlePrimary: 'Berserk',
      type: 'manga',
      coverImage: null,
      genres: ['Dark Fantasy'],
      affinityScore: 78,
      reasonBadge: 'Salto de Dimensión (Descubrimiento)',
      reasonType: 'serendipity',
      estimatedChapterMinutes: 5,
    },
  ];

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders loading skeleton while fetching data', () => {
    // Return unresolved promise to simulate pending fetch
    global.fetch = vi.fn().mockImplementation(() => new Promise(() => {}));
    render(<SmartRecommendationsRow onSelectSeries={vi.fn()} />);

    expect(screen.getByTestId('recommendations-loading')).toBeDefined();
  });

  it('renders recommendation cards with match pills and reason badges', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ recommendations: mockRecommendations }),
    } as any);

    render(<SmartRecommendationsRow onSelectSeries={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Recomendados para ti')).toBeDefined();
      expect(screen.getByText('Solo Leveling')).toBeDefined();
      expect(screen.getAllByText('Berserk').length).toBeGreaterThan(0);
      expect(screen.getByText('94% match')).toBeDefined();
      expect(screen.getByText('Salto')).toBeDefined();
      expect(screen.getByText('Porque leíste Solo Leveling')).toBeDefined();
      expect(screen.getByText('~4 min / cap')).toBeDefined();
    });
  });

  it('calls onSelectSeries with the correct slug when card is clicked', async () => {
    const handleSelect = vi.fn();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ recommendations: mockRecommendations }),
    } as any);

    render(<SmartRecommendationsRow onSelectSeries={handleSelect} />);

    await waitFor(() => {
      expect(screen.getByTestId('recommendation-card-solo-leveling')).toBeDefined();
    });

    fireEvent.click(screen.getByTestId('recommendation-card-solo-leveling'));
    expect(handleSelect).toHaveBeenCalledWith('solo-leveling');
  });

  it('renders nothing if the recommendation catalog returns empty list', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ recommendations: [] }),
    } as any);

    const { container } = render(<SmartRecommendationsRow onSelectSeries={vi.fn()} />);

    await waitFor(() => {
      expect(container.firstChild).toBeNull();
    });
  });
});
