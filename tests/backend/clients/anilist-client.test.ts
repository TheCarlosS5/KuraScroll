import { describe, it, expect, vi } from 'vitest';
import { AniListClient } from '../../../src/backend/clients/anilist-client';

describe('AniListClient', () => {
  it('extracts romaji, english, native titles, cover, and synonyms from AniList GraphQL response', async () => {
    const mockGqlResponse = {
      data: {
        Page: {
          media: [
            {
              id: 30002,
              title: {
                romaji: 'Berserk',
                english: 'Berserk',
                native: 'ベルセルク'
              },
              synonyms: ['Berserk: The Prototype', 'Kenpuu Denki Berserk'],
              description: 'Guts is a wandering mercenary...',
              status: 'RELEASING',
              format: 'MANGA',
              genres: ['Action', 'Dark Fantasy', 'Horror'],
              coverImage: {
                extraLarge: 'https://s4.anilist.co/file/anilistcdn/media/manga/cover/large/bx30002.jpg'
              }
            }
          ]
        }
      }
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockGqlResponse
    } as any);

    const client = new AniListClient({ fetcher: mockFetch });
    const results = await client.search('Berserk');

    expect(results.length).toBe(1);
    expect(results[0].anilistId).toBe(30002);
    expect(results[0].titleRomaji).toBe('Berserk');
    expect(results[0].titleNative).toBe('ベルセルク');
    expect(results[0].synonyms).toContain('Kenpuu Denki Berserk');
    expect(results[0].coverUrl).toBe('https://s4.anilist.co/file/anilistcdn/media/manga/cover/large/bx30002.jpg');
    expect(results[0].genres).toContain('Dark Fantasy');
  });
});
