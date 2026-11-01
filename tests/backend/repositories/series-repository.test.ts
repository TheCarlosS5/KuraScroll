import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createDatabase, runMigrations, DatabaseInstance } from '../../../src/backend/db/database';
import { SeriesRepository } from '../../../src/backend/repositories/series-repository';

describe('SeriesRepository multilingual search and taxonomy filtering', () => {
  let db: DatabaseInstance;
  let repo: SeriesRepository;

  beforeEach(() => {
    db = createDatabase(':memory:');
    runMigrations(db);
    repo = new SeriesRepository(db);

    repo.createSeries({
      id: 'demon-slayer',
      slug: 'demon-slayer',
      titlePrimary: 'Demon Slayer: Kimetsu no Yaiba',
      type: 'manga',
      status: 'completed',
    });

    repo.addSeriesTitles('demon-slayer', [
      { languageCode: 'en', title: 'Demon Slayer: Kimetsu no Yaiba', isPrimary: true },
      { languageCode: 'ja-ro', title: 'Kimetsu no Yaiba' },
      { languageCode: 'ja', title: '鬼滅の刃' },
      { languageCode: 'es', title: 'Guardianes de la Noche' },
    ]);

    repo.addSeriesGenres('demon-slayer', ['Action', 'Dark Fantasy', 'Historical']);

    repo.createSeries({
      id: 'tower-of-god',
      slug: 'tower-of-god',
      titlePrimary: 'Tower of God',
      type: 'manhwa',
      status: 'ongoing',
    });

    repo.addSeriesTitles('tower-of-god', [
      { languageCode: 'en', title: 'Tower of God', isPrimary: true },
      { languageCode: 'ko', title: '신의 탑' },
    ]);

    repo.addSeriesGenres('tower-of-god', ['Action', 'Mystery', 'Supernatural']);

    repo.createSeries({
      id: 'tales-of-demons-and-gods',
      slug: 'tales-of-demons-and-gods',
      titlePrimary: 'Tales of Demons and Gods',
      type: 'manhua',
      status: 'ongoing',
    });

    repo.addSeriesTitles('tales-of-demons-and-gods', [
      { languageCode: 'en', title: 'Tales of Demons and Gods', isPrimary: true },
      { languageCode: 'zh', title: '妖神记' },
    ]);

    repo.addSeriesGenres('tales-of-demons-and-gods', ['Fantasy', 'Martial Arts', 'Reincarnation']);
  });

  afterEach(() => {
    db.close();
  });

  it('retrieves the same series searching by Romaji, English, Spanish or Kanji', () => {
    const byRomaji = repo.searchSeries('Kimetsu');
    expect(byRomaji.length).toBe(1);
    expect(byRomaji[0].id).toBe('demon-slayer');

    const bySpanish = repo.searchSeries('Guardianes de la Noche');
    expect(bySpanish.length).toBe(1);
    expect(bySpanish[0].id).toBe('demon-slayer');

    const byKanji = repo.searchSeries('鬼滅');
    expect(byKanji.length).toBe(1);
    expect(byKanji[0].id).toBe('demon-slayer');

    // Single Kanji prefix lookup (prefix = '1 2 3' optimization)
    const bySingleKanji = repo.searchSeries('鬼');
    expect(bySingleKanji.length).toBe(1);
    expect(bySingleKanji[0].id).toBe('demon-slayer');

    const byEnglish = repo.searchSeries('Demon Slayer');
    expect(byEnglish.length).toBe(1);
    expect(byEnglish[0].id).toBe('demon-slayer');
  });

  it('retrieves full series by slug with all localized titles and genres', () => {
    const full = repo.getSeriesBySlug('demon-slayer');
    expect(full).toBeDefined();
    expect(full?.titlePrimary).toBe('Demon Slayer: Kimetsu no Yaiba');
    expect(full?.titles.length).toBe(4);
    expect(full?.genres).toContain('Action');
    expect(full?.genres).toContain('Dark Fantasy');
  });

  it('filters series by type (manga, manhwa, manhua)', () => {
    const mangas = repo.listSeries({ type: 'manga' });
    expect(mangas.total).toBe(1);
    expect(mangas.items[0].id).toBe('demon-slayer');

    const manhwas = repo.listSeries({ type: 'manhwa' });
    expect(manhwas.total).toBe(1);
    expect(manhwas.items[0].id).toBe('tower-of-god');

    const manhuas = repo.listSeries({ type: 'manhua' });
    expect(manhuas.total).toBe(1);
    expect(manhuas.items[0].id).toBe('tales-of-demons-and-gods');
  });

  it('filters series by status (ongoing, completed)', () => {
    const completed = repo.listSeries({ status: 'completed' });
    expect(completed.total).toBe(1);
    expect(completed.items[0].id).toBe('demon-slayer');

    const ongoing = repo.listSeries({ status: 'ongoing' });
    expect(ongoing.total).toBe(2);
    const ongoingIds = ongoing.items.map((s) => s.id);
    expect(ongoingIds).toContain('tower-of-god');
    expect(ongoingIds).toContain('tales-of-demons-and-gods');
  });

  it('filters series by partial genre match', () => {
    // Partial match 'Dark' -> 'Dark Fantasy'
    const darkResults = repo.listSeries({ genre: 'Dark' });
    expect(darkResults.total).toBe(1);
    expect(darkResults.items[0].id).toBe('demon-slayer');

    // Partial match 'art' -> 'Martial Arts'
    const martialResults = repo.listSeries({ genre: 'art' });
    expect(martialResults.total).toBe(1);
    expect(martialResults.items[0].id).toBe('tales-of-demons-and-gods');

    // Matches 'Action' -> both demon-slayer and tower-of-god
    const actionResults = repo.listSeries({ genre: 'Action' });
    expect(actionResults.total).toBe(2);
    const actionIds = actionResults.items.map((s) => s.id);
    expect(actionIds).toContain('demon-slayer');
    expect(actionIds).toContain('tower-of-god');
  });

  it('combines type, status, genre, and text search simultaneously', () => {
    // Both demon-slayer and tower-of-god have genre 'Action', but only tower-of-god is manhwa + ongoing
    const combined = repo.listSeries({
      q: 'god',
      type: 'manhwa',
      status: 'ongoing',
      genre: 'action',
    });

    expect(combined.total).toBe(1);
    expect(combined.items[0].id).toBe('tower-of-god');

    // Searching 'god' with type 'manga' should yield no results
    const noMatch = repo.listSeries({
      q: 'god',
      type: 'manga',
    });
    expect(noMatch.total).toBe(0);
    expect(noMatch.items.length).toBe(0);
  });
});
