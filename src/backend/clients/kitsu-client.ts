export interface KitsuTitle {
  languageCode: string;
  title: string;
}

export interface KitsuSearchResult {
  id: string;
  slug: string;
  canonicalTitle: string;
  titles: KitsuTitle[];
  abbreviatedTitles: string[];
  synopsis: string | null;
  status: string;
  subtype: string;
  posterUrl: string | null;
  coverUrl: string | null;
}

export interface KitsuClientOptions {
  fetcher?: typeof fetch;
  baseUrl?: string;
}

export function normalizeKitsuLanguageCode(lang: string): string {
  const lower = lang.toLowerCase().trim();
  if (lower === 'en_jp') return 'ja-ro';
  if (lower === 'ja_jp') return 'ja';
  if (lower === 'ko_kr') return 'ko';
  if (lower === 'zh_cn' || lower === 'zh_tw') return 'zh';
  if (lower.startsWith('en')) return 'en';
  if (lower.startsWith('es')) return 'es';
  if (lower.startsWith('fr')) return 'fr';
  if (lower.startsWith('de')) return 'de';
  if (lower.startsWith('it')) return 'it';
  return lower.replace(/_/g, '-');
}

export class KitsuClient {
  private fetcher: typeof fetch;
  private baseUrl: string;

  constructor(options: KitsuClientOptions = {}) {
    this.fetcher = options.fetcher ?? fetch;
    this.baseUrl = options.baseUrl ?? 'https://kitsu.io/api/edge';
  }

  async search(query: string, limit = 5): Promise<KitsuSearchResult[]> {
    if (!query.trim()) {
      return [];
    }

    const url = `${this.baseUrl}/manga?filter[text]=${encodeURIComponent(query)}&page[limit]=${limit}`;

    try {
      const res = await this.fetcher(url, {
        headers: {
          'User-Agent': 'KuraScroll/1.0.0 (https://github.com/carlos/kura-scroll)',
          Accept: 'application/vnd.api+json, application/json',
        },
      });

      if (!res.ok) {
        return [];
      }

      const json = (await res.json()) as any;
      if (!json || !Array.isArray(json.data)) {
        return [];
      }

      return json.data.map((item: any) => this.mapKitsuItem(item));
    } catch {
      return [];
    }
  }

  private mapKitsuItem(item: any): KitsuSearchResult {
    const attr = item.attributes || {};
    const canonicalTitle = attr.canonicalTitle || 'Unknown Title';

    const titles: KitsuTitle[] = [];
    const seen = new Set<string>();

    const titlesObj = attr.titles || {};
    for (const [lang, val] of Object.entries(titlesObj)) {
      if (typeof val === 'string' && val.trim()) {
        const normLang = normalizeKitsuLanguageCode(lang);
        const cleanVal = val.trim();
        const key = `${normLang}:${cleanVal.toLowerCase()}`;
        if (!seen.has(key)) {
          seen.add(key);
          titles.push({ languageCode: normLang, title: cleanVal });
        }
      }
    }

    const abbreviatedTitles: string[] = [];
    if (Array.isArray(attr.abbreviatedTitles)) {
      for (const alt of attr.abbreviatedTitles) {
        if (typeof alt === 'string' && alt.trim()) {
          abbreviatedTitles.push(alt.trim());
        }
      }
    }

    const posterImage = attr.posterImage || {};
    const posterUrl =
      posterImage.large ||
      posterImage.original ||
      posterImage.medium ||
      posterImage.small ||
      null;

    const coverImage = attr.coverImage || {};
    const coverUrl =
      coverImage.large ||
      coverImage.original ||
      coverImage.small ||
      posterUrl;

    const synopsis = attr.synopsis || attr.description || null;

    return {
      id: String(item.id || ''),
      slug: attr.slug || '',
      canonicalTitle,
      titles,
      abbreviatedTitles,
      synopsis: typeof synopsis === 'string' ? synopsis : null,
      status: attr.status || 'unknown',
      subtype: attr.subtype || 'manga',
      posterUrl,
      coverUrl,
    };
  }
}
