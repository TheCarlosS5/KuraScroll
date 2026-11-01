import { describe, it, expect, vi } from 'vitest';
import { MetadataResolverService } from '../../../src/backend/services/metadata-resolver-service';
import { MangaDexClient } from '../../../src/backend/clients/mangadex-client';
import { AniListClient } from '../../../src/backend/clients/anilist-client';
import { KitsuClient } from '../../../src/backend/clients/kitsu-client';

describe('MetadataResolverService', () => {
  it('unifies MangaDex and AniList results into a comprehensive multilingual series record', async () => {
    const mockMangaDex = new MangaDexClient();
    vi.spyOn(mockMangaDex, 'search').mockResolvedValue([
      {
        id: 'md-solo-123',
        primaryTitle: 'Solo Leveling',
        titles: [
          { languageCode: 'en', title: 'Solo Leveling' },
          { languageCode: 'ko', title: '나 혼자만 레벨업' },
          { languageCode: 'es', title: 'Solo Leveling (Español)' }
        ],
        synopsis: 'Sung Jinwoo ascends as the Shadow Monarch.',
        status: 'completed',
        originalLanguage: 'ko',
        coverUrl: 'https://mangadex/cover.jpg'
      }
    ]);

    const mockAniList = new AniListClient();
    vi.spyOn(mockAniList, 'search').mockResolvedValue([
      {
        anilistId: 105398,
        titleRomaji: 'Na Honjaman Level Up',
        titleEnglish: 'Solo Leveling',
        titleNative: '나 혼자만 레벨업',
        synonyms: ['I Alone Level Up', 'Only I Level Up'],
        description: 'In a world where hunters must battle deadly monsters...',
        status: 'FINISHED',
        format: 'MANGA',
        genres: ['Action', 'Fantasy'],
        coverUrl: 'https://anilist/cover.jpg'
      }
    ]);

    const mockKitsu = new KitsuClient();
    vi.spyOn(mockKitsu, 'search').mockResolvedValue([]);

    const resolver = new MetadataResolverService(mockMangaDex, mockAniList, mockKitsu);
    const resolved = await resolver.resolve('Solo Leveling');

    expect(resolved).toBeDefined();
    expect(resolved?.titlePrimary).toBe('Solo Leveling');
    expect(resolved?.type).toBe('manhwa'); // correctly detected from originalLanguage 'ko'
    expect(resolved?.status).toBe('completed');
    expect(resolved?.mangadexId).toBe('md-solo-123');
    expect(resolved?.anilistId).toBe(105398);
    expect(resolved?.kitsuId).toBeNull();

    const titleStrings = resolved?.titles.map((t) => t.title);
    expect(titleStrings).toContain('Solo Leveling');
    expect(titleStrings).toContain('나 혼자만 레벨업');
    expect(titleStrings).toContain('Na Honjaman Level Up');
    expect(titleStrings).toContain('I Alone Level Up');
  });

  it('unifies MangaDex, AniList, and Kitsu results with multilingual titles and zero duplicates', async () => {
    const mockMangaDex = new MangaDexClient();
    vi.spyOn(mockMangaDex, 'search').mockResolvedValue([
      {
        id: 'md-snk-456',
        primaryTitle: 'Attack on Titan',
        titles: [
          { languageCode: 'en', title: 'Attack on Titan' },
          { languageCode: 'ja', title: '進撃の巨人' }
        ],
        synopsis: 'Titans attack humanity.',
        status: 'completed',
        originalLanguage: 'ja',
        coverUrl: 'https://mangadex/snk.jpg'
      }
    ]);

    const mockAniList = new AniListClient();
    vi.spyOn(mockAniList, 'search').mockResolvedValue([
      {
        anilistId: 30002,
        titleRomaji: 'Shingeki no Kyojin',
        titleEnglish: 'Attack on Titan',
        titleNative: '進撃の巨人',
        synonyms: ['AoT', 'SnK'],
        description: 'Several hundred years ago, humans were nearly exterminated by Titans...',
        status: 'FINISHED',
        format: 'MANGA',
        genres: ['Action', 'Drama', 'Fantasy', 'Mystery'],
        coverUrl: 'https://anilist/snk.jpg'
      }
    ]);

    const mockKitsu = new KitsuClient();
    vi.spyOn(mockKitsu, 'search').mockResolvedValue([
      {
        id: 'kitsu-789',
        slug: 'shingeki-no-kyojin',
        canonicalTitle: 'Attack on Titan',
        titles: [
          { languageCode: 'en', title: 'Attack on Titan' },
          { languageCode: 'ja-ro', title: 'Shingeki no Kyojin' },
          { languageCode: 'ja', title: '進撃の巨人' },
          { languageCode: 'es', title: 'Ataque a los Titanes' }
        ],
        abbreviatedTitles: ['AoT', 'SnK', 'Titan of Shingeki'],
        synopsis: 'Centuries ago, mankind was slaughtered by monstrous humanoids called Titans...',
        status: 'finished',
        subtype: 'manga',
        posterUrl: 'https://kitsu/poster.jpg',
        coverUrl: 'https://kitsu/cover.jpg'
      }
    ]);

    const resolver = new MetadataResolverService(mockMangaDex, mockAniList, mockKitsu);
    const resolved = await resolver.resolve('Attack on Titan');

    expect(resolved).toBeDefined();
    expect(resolved?.mangadexId).toBe('md-snk-456');
    expect(resolved?.anilistId).toBe(30002);
    expect(resolved?.kitsuId).toBe('kitsu-789');
    expect(resolved?.titlePrimary).toBe('Attack on Titan');
    expect(resolved?.status).toBe('completed');
    expect(resolved?.genres).toContain('Drama');

    const titleStrings = resolved?.titles.map((t) => t.title);
    expect(titleStrings).toContain('Attack on Titan');
    expect(titleStrings).toContain('Shingeki no Kyojin');
    expect(titleStrings).toContain('進撃の巨人');
    expect(titleStrings).toContain('Ataque a los Titanes');
    expect(titleStrings).toContain('Titan of Shingeki');

    // Ensure zero duplicates (case-insensitive deduplication)
    const lowerTitles = titleStrings?.map((t) => t.toLowerCase());
    const uniqueLowerTitles = new Set(lowerTitles);
    expect(lowerTitles?.length).toBe(uniqueLowerTitles.size);
  });

  it('falls back to Kitsu when MangaDex and AniList return no results', async () => {
    const mockMangaDex = new MangaDexClient();
    vi.spyOn(mockMangaDex, 'search').mockResolvedValue([]);

    const mockAniList = new AniListClient();
    vi.spyOn(mockAniList, 'search').mockResolvedValue([]);

    const mockKitsu = new KitsuClient();
    vi.spyOn(mockKitsu, 'search').mockResolvedValue([
      {
        id: 'kitsu-manhwa-101',
        slug: 'the-greatest-estate-developer',
        canonicalTitle: 'The Greatest Estate Developer',
        titles: [
          { languageCode: 'en', title: 'The Greatest Estate Developer' },
          { languageCode: 'ko', title: '역대급 영지 설계사' },
          { languageCode: 'es', title: 'El mejor diseñador de fincas del mundo' }
        ],
        abbreviatedTitles: ['TGED'],
        synopsis: 'When civil engineering student Suho Kim falls asleep reading a fantasy webnovel...',
        status: 'current',
        subtype: 'manhwa',
        posterUrl: 'https://kitsu/tged-poster.jpg',
        coverUrl: 'https://kitsu/tged-cover.jpg'
      }
    ]);

    const resolver = new MetadataResolverService(mockMangaDex, mockAniList, mockKitsu);
    const resolved = await resolver.resolve('The Greatest Estate Developer');

    expect(resolved).toBeDefined();
    expect(resolved?.titlePrimary).toBe('The Greatest Estate Developer');
    expect(resolved?.slug).toBe('the-greatest-estate-developer');
    expect(resolved?.type).toBe('manhwa');
    expect(resolved?.status).toBe('ongoing');
    expect(resolved?.synopsis).toContain('civil engineering student Suho Kim');
    expect(resolved?.coverImage).toBe('https://kitsu/tged-cover.jpg');
    expect(resolved?.mangadexId).toBeNull();
    expect(resolved?.anilistId).toBeNull();
    expect(resolved?.kitsuId).toBe('kitsu-manhwa-101');

    const titleStrings = resolved?.titles.map((t) => t.title);
    expect(titleStrings).toContain('The Greatest Estate Developer');
    expect(titleStrings).toContain('역대급 영지 설계사');
    expect(titleStrings).toContain('El mejor diseñador de fincas del mundo');
    expect(titleStrings).toContain('TGED');
  });

  it('uses Kitsu for fallback synopsis and cover when primary sources lack them', async () => {
    const mockMangaDex = new MangaDexClient();
    vi.spyOn(mockMangaDex, 'search').mockResolvedValue([
      {
        id: 'md-nosynopsis',
        primaryTitle: 'Rare Manga',
        titles: [{ languageCode: 'en', title: 'Rare Manga' }],
        synopsis: null,
        status: 'ongoing',
        originalLanguage: 'ja',
        coverUrl: null
      }
    ]);

    const mockAniList = new AniListClient();
    vi.spyOn(mockAniList, 'search').mockResolvedValue([
      {
        anilistId: 777,
        titleRomaji: 'Rare Manga',
        titleEnglish: 'Rare Manga',
        titleNative: null,
        synonyms: [],
        description: null,
        status: 'RELEASING',
        format: 'MANGA',
        genres: ['Mystery'],
        coverUrl: null
      }
    ]);

    const mockKitsu = new KitsuClient();
    vi.spyOn(mockKitsu, 'search').mockResolvedValue([
      {
        id: 'kitsu-fallback',
        slug: 'rare-manga',
        canonicalTitle: 'Rare Manga',
        titles: [{ languageCode: 'en', title: 'Rare Manga' }],
        abbreviatedTitles: [],
        synopsis: 'Recovered synopsis from Kitsu edge API.',
        status: 'current',
        subtype: 'manga',
        posterUrl: 'https://kitsu/fallback-cover.jpg',
        coverUrl: 'https://kitsu/fallback-cover.jpg'
      }
    ]);

    const resolver = new MetadataResolverService(mockMangaDex, mockAniList, mockKitsu);
    const resolved = await resolver.resolve('Rare Manga');

    expect(resolved).toBeDefined();
    expect(resolved?.synopsis).toBe('Recovered synopsis from Kitsu edge API.');
    expect(resolved?.coverImage).toBe('https://kitsu/fallback-cover.jpg');
    expect(resolved?.kitsuId).toBe('kitsu-fallback');
  });

  it('returns null when all services return no results', async () => {
    const mockMangaDex = new MangaDexClient();
    vi.spyOn(mockMangaDex, 'search').mockResolvedValue([]);

    const mockAniList = new AniListClient();
    vi.spyOn(mockAniList, 'search').mockResolvedValue([]);

    const mockKitsu = new KitsuClient();
    vi.spyOn(mockKitsu, 'search').mockResolvedValue([]);

    const resolver = new MetadataResolverService(mockMangaDex, mockAniList, mockKitsu);
    const resolved = await resolver.resolve('CompletelyNonExistentTitle12345');

    expect(resolved).toBeNull();
  });
});
