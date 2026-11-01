import { describe, it, expect, vi } from 'vitest';
import { MangaDexClient } from '../../../src/backend/clients/mangadex-client';

describe('MangaDexClient', () => {
  it('parses title and altTitles array correctly from MangaDex v5 JSON response', async () => {
    const mockResponse = {
      result: 'ok',
      data: [
        {
          id: '1e74ab46-bda8-493e-bcaa-6d1a50f1a91e',
          type: 'manga',
          attributes: {
            title: { en: 'SPY×FAMILY' },
            altTitles: [
              { ja: 'スパイファミリー' },
              { 'ja-ro': 'Spy x Family' },
              { es: 'Spy x Family (España)' }
            ],
            description: { en: 'A master spy...' },
            status: 'ongoing',
            originalLanguage: 'ja'
          },
          relationships: [
            {
              id: 'cover-123',
              type: 'cover_art',
              attributes: {
                fileName: 'cover.jpg'
              }
            }
          ]
        }
      ]
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse
    } as any);

    const client = new MangaDexClient({ fetcher: mockFetch });
    const results = await client.search('Spy Family');

    expect(results.length).toBe(1);
    expect(results[0].primaryTitle).toBe('SPY×FAMILY');
    expect(results[0].titles).toContainEqual({ languageCode: 'en', title: 'SPY×FAMILY' });
    expect(results[0].titles).toContainEqual({ languageCode: 'ja', title: 'スパイファミリー' });
    expect(results[0].titles).toContainEqual({ languageCode: 'ja-ro', title: 'Spy x Family' });
    expect(results[0].coverUrl).toBe('https://uploads.mangadex.org/covers/1e74ab46-bda8-493e-bcaa-6d1a50f1a91e/cover.jpg');
  });

  it('handles empty response gracefully when no manga matches', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ result: 'ok', data: [] })
    } as any);

    const client = new MangaDexClient({ fetcher: mockFetch });
    const results = await client.search('NonExistentManga12345');
    expect(results.length).toBe(0);
  });
});
