export interface AniListSearchResult {
  anilistId: number;
  titleRomaji: string;
  titleEnglish: string | null;
  titleNative: string | null;
  synonyms: string[];
  description: string | null;
  status: string;
  format: string;
  genres: string[];
  coverUrl: string | null;
}

export interface AniListClientOptions {
  fetcher?: typeof fetch;
  endpoint?: string;
}

const SEARCH_MANGA_QUERY = `
query ($search: String, $perPage: Int) {
  Page (page: 1, perPage: $perPage) {
    media (search: $search, type: MANGA) {
      id
      title {
        romaji
        english
        native
      }
      synonyms
      description(asHtml: false)
      status
      format
      genres
      coverImage {
        extraLarge
        large
      }
    }
  }
}
`;

export class AniListClient {
  private fetcher: typeof fetch;
  private endpoint: string;

  constructor(options: AniListClientOptions = {}) {
    this.fetcher = options.fetcher ?? fetch;
    this.endpoint = options.endpoint ?? 'https://graphql.anilist.co';
  }

  async search(query: string, perPage = 5): Promise<AniListSearchResult[]> {
    if (!query.trim()) {
      return [];
    }

    const res = await this.fetcher(this.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        query: SEARCH_MANGA_QUERY,
        variables: { search: query, perPage },
      }),
    });

    if (!res.ok) {
      return [];
    }

    const json = (await res.json()) as any;
    const mediaList = json?.data?.Page?.media;
    if (!Array.isArray(mediaList)) {
      return [];
    }

    return mediaList.map((m: any) => ({
      anilistId: m.id,
      titleRomaji: m.title?.romaji || 'Unknown Title',
      titleEnglish: m.title?.english || null,
      titleNative: m.title?.native || null,
      synonyms: Array.isArray(m.synonyms) ? m.synonyms : [],
      description: m.description || null,
      status: m.status || 'UNKNOWN',
      format: m.format || 'MANGA',
      genres: Array.isArray(m.genres) ? m.genres : [],
      coverUrl: m.coverImage?.extraLarge || m.coverImage?.large || null,
    }));
  }
}
