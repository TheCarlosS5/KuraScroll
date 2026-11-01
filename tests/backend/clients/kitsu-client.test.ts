import { describe, it, expect, vi } from 'vitest';
import { KitsuClient, normalizeKitsuLanguageCode } from '../../../src/backend/clients/kitsu-client';

describe('normalizeKitsuLanguageCode', () => {
  it('maps Kitsu language keys to standard BCP-47 tags', () => {
    expect(normalizeKitsuLanguageCode('en_jp')).toBe('ja-ro');
    expect(normalizeKitsuLanguageCode('ja_jp')).toBe('ja');
    expect(normalizeKitsuLanguageCode('ko_kr')).toBe('ko');
    expect(normalizeKitsuLanguageCode('zh_cn')).toBe('zh');
    expect(normalizeKitsuLanguageCode('zh_tw')).toBe('zh');
    expect(normalizeKitsuLanguageCode('en_us')).toBe('en');
    expect(normalizeKitsuLanguageCode('en')).toBe('en');
    expect(normalizeKitsuLanguageCode('es_la')).toBe('es');
    expect(normalizeKitsuLanguageCode('es_es')).toBe('es');
    expect(normalizeKitsuLanguageCode('fr_fr')).toBe('fr');
    expect(normalizeKitsuLanguageCode('pt_br')).toBe('pt-br');
  });
});

describe('KitsuClient', () => {
  it('parses canonicalTitle, titles, abbreviatedTitles, synopsis, and images from Kitsu JSON:API response', async () => {
    const mockKitsuResponse = {
      data: [
        {
          id: '12345',
          type: 'manga',
          attributes: {
            slug: 'shingeki-no-kyojin',
            canonicalTitle: 'Attack on Titan',
            titles: {
              en: 'Attack on Titan',
              en_jp: 'Shingeki no Kyojin',
              ja_jp: '進撃の巨人',
              es_la: 'Ataque a los Titanes'
            },
            abbreviatedTitles: ['AoT', 'SnK'],
            synopsis: 'Centuries ago, mankind was slaughtered nearly to extinction by monstrous humanoids called Titans...',
            status: 'finished',
            subtype: 'manga',
            posterImage: {
              small: 'https://kitsu.io/poster-small.jpg',
              large: 'https://kitsu.io/poster-large.jpg',
              original: 'https://kitsu.io/poster-orig.jpg'
            },
            coverImage: {
              small: 'https://kitsu.io/cover-small.jpg',
              large: 'https://kitsu.io/cover-large.jpg'
            }
          }
        }
      ]
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockKitsuResponse,
    } as any);

    const client = new KitsuClient({ fetcher: mockFetch });
    const results = await client.search('Attack on Titan');

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('filter[text]=Attack%20on%20Titan'),
      expect.objectContaining({
        headers: expect.objectContaining({
          Accept: expect.stringContaining('application/vnd.api+json'),
        }),
      })
    );

    expect(results.length).toBe(1);
    const item = results[0];
    expect(item.id).toBe('12345');
    expect(item.slug).toBe('shingeki-no-kyojin');
    expect(item.canonicalTitle).toBe('Attack on Titan');
    expect(item.status).toBe('finished');
    expect(item.subtype).toBe('manga');
    expect(item.synopsis).toContain('monstrous humanoids called Titans');
    expect(item.coverUrl).toBe('https://kitsu.io/cover-large.jpg');
    expect(item.posterUrl).toBe('https://kitsu.io/poster-large.jpg');
    expect(item.abbreviatedTitles).toEqual(['AoT', 'SnK']);

    expect(item.titles).toContainEqual({ languageCode: 'en', title: 'Attack on Titan' });
    expect(item.titles).toContainEqual({ languageCode: 'ja-ro', title: 'Shingeki no Kyojin' });
    expect(item.titles).toContainEqual({ languageCode: 'ja', title: '進撃の巨人' });
    expect(item.titles).toContainEqual({ languageCode: 'es', title: 'Ataque a los Titanes' });
  });

  it('falls back to posterImage when coverImage is missing', async () => {
    const mockKitsuResponse = {
      data: [
        {
          id: '999',
          type: 'manga',
          attributes: {
            canonicalTitle: 'Tower of God',
            titles: {
              en: 'Tower of God',
              ko_kr: '신의 탑'
            },
            abbreviatedTitles: [],
            synopsis: 'What do you desire?',
            status: 'current',
            subtype: 'manhwa',
            posterImage: {
              large: 'https://kitsu.io/poster-tog.jpg'
            },
            coverImage: null
          }
        }
      ]
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockKitsuResponse,
    } as any);

    const client = new KitsuClient({ fetcher: mockFetch });
    const results = await client.search('Tower of God');

    expect(results.length).toBe(1);
    expect(results[0].coverUrl).toBe('https://kitsu.io/poster-tog.jpg');
    expect(results[0].subtype).toBe('manhwa');
    expect(results[0].titles).toContainEqual({ languageCode: 'ko', title: '신의 탑' });
  });

  it('returns empty array when query is whitespace', async () => {
    const mockFetch = vi.fn();
    const client = new KitsuClient({ fetcher: mockFetch });
    const results = await client.search('   ');

    expect(results).toEqual([]);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('handles empty response gracefully when no manga matches', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [] }),
    } as any);

    const client = new KitsuClient({ fetcher: mockFetch });
    const results = await client.search('NonExistentTitleXYZ');

    expect(results).toEqual([]);
  });

  it('handles HTTP error responses gracefully', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
    } as any);

    const client = new KitsuClient({ fetcher: mockFetch });
    const results = await client.search('ErrorManga');

    expect(results).toEqual([]);
  });

  it('handles network failure gracefully', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error('Network connection timeout'));

    const client = new KitsuClient({ fetcher: mockFetch });
    const results = await client.search('TimeoutManga');

    expect(results).toEqual([]);
  });
});
