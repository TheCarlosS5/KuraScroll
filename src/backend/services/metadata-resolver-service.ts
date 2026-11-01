import { MangaDexClient, MangaDexSearchResult } from '../clients/mangadex-client.js';
import { AniListClient, AniListSearchResult } from '../clients/anilist-client.js';
import { KitsuClient, KitsuSearchResult } from '../clients/kitsu-client.js';

export interface LocalizedTitle {
  languageCode: string;
  title: string;
  isPrimary?: boolean;
}

export interface ResolvedSeriesMetadata {
  slug: string;
  titlePrimary: string;
  titles: LocalizedTitle[];
  type: 'manga' | 'manhwa' | 'manhua' | 'comic';
  status: 'ongoing' | 'completed' | 'hiatus' | 'cancelled';
  synopsis: string | null;
  coverImage: string | null;
  genres: string[];
  anilistId: number | null;
  mangadexId: string | null;
  kitsuId: string | null;
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100);
}

export class MetadataResolverService {
  constructor(
    private mangaDexClient: MangaDexClient = new MangaDexClient(),
    private aniListClient: AniListClient = new AniListClient(),
    private kitsuClient: KitsuClient = new KitsuClient()
  ) {}

  async resolve(query: string): Promise<ResolvedSeriesMetadata | null> {
    const [mdResults, aniResults, kitsuResults] = await Promise.all([
      this.mangaDexClient.search(query, 3).catch(() => [] as MangaDexSearchResult[]),
      this.aniListClient.search(query, 3).catch(() => [] as AniListSearchResult[]),
      this.kitsuClient.search(query, 3).catch(() => [] as KitsuSearchResult[]),
    ]);

    const md = mdResults[0] || null;
    const ani = aniResults[0] || null;
    const kitsu = kitsuResults[0] || null;

    if (!md && !ani && !kitsu) {
      return null;
    }

    const titlePrimary =
      md?.primaryTitle ||
      ani?.titleEnglish ||
      ani?.titleRomaji ||
      kitsu?.canonicalTitle ||
      query;
    const slug = slugify(titlePrimary);

    // Determine series medium type
    let type: 'manga' | 'manhwa' | 'manhua' | 'comic' = 'manga';
    if (md?.originalLanguage === 'ko' || kitsu?.subtype === 'manhwa') {
      type = 'manhwa';
    } else if (
      md?.originalLanguage === 'zh' ||
      md?.originalLanguage === 'zh-hk' ||
      kitsu?.subtype === 'manhua'
    ) {
      type = 'manhua';
    }

    // Determine publication status
    let status: 'ongoing' | 'completed' | 'hiatus' | 'cancelled' = 'ongoing';
    const rawStatus = (md?.status || ani?.status || kitsu?.status || '').toLowerCase();
    if (rawStatus === 'completed' || rawStatus === 'finished') {
      status = 'completed';
    } else if (rawStatus === 'hiatus') {
      status = 'hiatus';
    } else if (rawStatus === 'cancelled') {
      status = 'cancelled';
    }

    // Gather and deduplicate all titles
    const titleMap = new Map<string, LocalizedTitle>();

    function addTitle(lang: string, titleStr: string, isPrimary = false) {
      const clean = titleStr.trim();
      if (!clean) return;
      const key = clean.toLowerCase();
      if (!titleMap.has(key)) {
        titleMap.set(key, { languageCode: lang, title: clean, isPrimary });
      }
    }

    addTitle('en', titlePrimary, true);

    if (md) {
      for (const t of md.titles) {
        addTitle(t.languageCode, t.title);
      }
    }

    if (ani) {
      if (ani.titleRomaji) addTitle('ja-ro', ani.titleRomaji);
      if (ani.titleNative) addTitle('native', ani.titleNative);
      if (ani.titleEnglish) addTitle('en', ani.titleEnglish);
      for (const syn of ani.synonyms) {
        addTitle('synonym', syn);
      }
    }

    if (kitsu) {
      if (kitsu.canonicalTitle) addTitle('canonical', kitsu.canonicalTitle);
      for (const t of kitsu.titles) {
        addTitle(t.languageCode, t.title);
      }
      for (const syn of kitsu.abbreviatedTitles) {
        addTitle('synonym', syn);
      }
    }

    const synopsis = md?.synopsis || ani?.description || kitsu?.synopsis || null;
    const coverImage = md?.coverUrl || ani?.coverUrl || kitsu?.coverUrl || kitsu?.posterUrl || null;
    const genres = ani?.genres || [];

    return {
      slug,
      titlePrimary,
      titles: Array.from(titleMap.values()),
      type,
      status,
      synopsis,
      coverImage,
      genres,
      anilistId: ani?.anilistId || null,
      mangadexId: md?.id || null,
      kitsuId: kitsu?.id || null,
    };
  }
}
