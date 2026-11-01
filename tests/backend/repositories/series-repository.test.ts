import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createDatabase, runMigrations, DatabaseInstance } from '../../../src/backend/db/database';
import { SeriesRepository } from '../../../src/backend/repositories/series-repository';

describe('SeriesRepository multilingual search', () => {
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
      status: 'completed'
    });

    repo.addSeriesTitles('demon-slayer', [
      { languageCode: 'en', title: 'Demon Slayer: Kimetsu no Yaiba', isPrimary: true },
      { languageCode: 'ja-ro', title: 'Kimetsu no Yaiba' },
      { languageCode: 'ja', title: '鬼滅の刃' },
      { languageCode: 'es', title: 'Guardianes de la Noche' }
    ]);
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

    const byEnglish = repo.searchSeries('Demon Slayer');
    expect(byEnglish.length).toBe(1);
    expect(byEnglish[0].id).toBe('demon-slayer');
  });

  it('retrieves full series by slug with all localized titles', () => {
    const full = repo.getSeriesBySlug('demon-slayer');
    expect(full).toBeDefined();
    expect(full?.titlePrimary).toBe('Demon Slayer: Kimetsu no Yaiba');
    expect(full?.titles.length).toBe(4);
  });
});
