export interface MangaDexTitle {
  languageCode: string;
  title: string;
}

export interface MangaDexSearchResult {
  id: string;
  primaryTitle: string;
  titles: MangaDexTitle[];
  synopsis: string | null;
  status: string;
  originalLanguage: string;
  coverUrl: string | null;
}

export interface MangaDexClientOptions {
  fetcher?: typeof fetch;
  baseUrl?: string;
}

export class MangaDexClient {
  private fetcher: typeof fetch;
  private baseUrl: string;

  constructor(options: MangaDexClientOptions = {}) {
    this.fetcher = options.fetcher ?? fetch;
    this.baseUrl = options.baseUrl ?? 'https://api.mangadex.org';
  }

  async search(query: string, limit = 5): Promise<MangaDexSearchResult[]> {
    if (!query.trim()) {
      return [];
    }

    const url = `${this.baseUrl}/manga?title=${encodeURIComponent(query)}&limit=${limit}&includes[]=cover_art`;

    const res = await this.fetcher(url, {
      headers: {
        'User-Agent': 'KuraScroll/1.0.0 (https://github.com/carlos/kura-scroll)',
        Accept: 'application/json',
      },
    });

    if (!res.ok) {
      return [];
    }

    const json = (await res.json()) as any;
    if (!json || json.result !== 'ok' || !Array.isArray(json.data)) {
      return [];
    }

    return json.data.map((item: any) => this.mapMangaDexItem(item));
  }

  private mapMangaDexItem(item: any): MangaDexSearchResult {
    const attr = item.attributes || {};
    const titleObj = attr.title || {};
    const primaryTitle = Object.values(titleObj)[0] as string || 'Unknown Title';

    const titles: MangaDexTitle[] = [];

    // Main title entries
    for (const [lang, val] of Object.entries(titleObj)) {
      if (typeof val === 'string' && val.trim()) {
        titles.push({ languageCode: lang, title: val.trim() });
      }
    }

    // Alt titles entries
    if (Array.isArray(attr.altTitles)) {
      for (const altObj of attr.altTitles) {
        for (const [lang, val] of Object.entries(altObj)) {
          if (typeof val === 'string' && val.trim()) {
            titles.push({ languageCode: lang, title: val.trim() });
          }
        }
      }
    }

    // Description (prioritize English or Spanish)
    const descObj = attr.description || {};
    const synopsis = descObj.en || descObj.es || Object.values(descObj)[0] || null;

    // Cover art URL resolution
    let coverUrl: string | null = null;
    const coverRel = (item.relationships || []).find((r: any) => r.type === 'cover_art');
    if (coverRel && coverRel.attributes && coverRel.attributes.fileName) {
      coverUrl = `https://uploads.mangadex.org/covers/${item.id}/${coverRel.attributes.fileName}`;
    }

    return {
      id: item.id,
      primaryTitle,
      titles,
      synopsis: typeof synopsis === 'string' ? synopsis : null,
      status: attr.status || 'ongoing',
      originalLanguage: attr.originalLanguage || 'ja',
      coverUrl,
    };
  }
}
