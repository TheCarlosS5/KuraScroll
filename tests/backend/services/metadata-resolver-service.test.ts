import { describe, it, expect, vi } from 'vitest';
import { MetadataResolverService } from '../../../src/backend/services/metadata-resolver-service';
import { MangaDexClient } from '../../../src/backend/clients/mangadex-client';
import { AniListClient } from '../../../src/backend/clients/anilist-client';

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

    const resolver = new MetadataResolverService(mockMangaDex, mockAniList);
    const resolved = await resolver.resolve('Solo Leveling');

    expect(resolved).toBeDefined();
    expect(resolved?.titlePrimary).toBe('Solo Leveling');
    expect(resolved?.type).toBe('manhwa'); // correctly detected from originalLanguage 'ko'
    expect(resolved?.status).toBe('completed');
    expect(resolved?.mangadexId).toBe('md-solo-123');
    expect(resolved?.anilistId).toBe(105398);

    const titleStrings = resolved?.titles.map((t) => t.title);
    expect(titleStrings).toContain('Solo Leveling');
    expect(titleStrings).toContain('나 혼자만 레벨업');
    expect(titleStrings).toContain('Na Honjaman Level Up');
    expect(titleStrings).toContain('I Alone Level Up');
  });
});
