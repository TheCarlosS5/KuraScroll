import { describe, it, expect, beforeEach } from 'vitest';
import { createDatabase, runMigrations, DatabaseInstance } from '../../../src/backend/db/database.js';
import { VectorSearchService } from '../../../src/backend/services/vector-search-service.js';

describe('VectorSearchService Unit Tests (Sprint 47)', () => {
  let db: DatabaseInstance;
  let service: VectorSearchService;

  beforeEach(() => {
    db = createDatabase(':memory:');
    runMigrations(db);

    // Insert 3 test series
    db.prepare(`
      INSERT INTO series (id, slug, title_primary, type, status, synopsis)
      VALUES 
        ('s-berserk', 'berserk', 'Berserk', 'manga', 'ongoing', 'Dark fantasy about a swordsman with a giant blade.'),
        ('s-solo', 'solo-leveling', 'Solo Leveling', 'manhwa', 'completed', 'Hunter gaining powers in dungeons alone.'),
        ('s-op', 'one-piece', 'One Piece', 'manga', 'ongoing', 'Pirate boy searching for treasure across the Grand Line.')
    `).run();

    // Populate FTS5 index
    db.prepare(`INSERT INTO series_titles (series_id, language_code, title, is_primary) VALUES ('s-berserk', 'en', 'Berserk', 1)`).run();
    db.prepare(`INSERT INTO series_titles (series_id, language_code, title, is_primary) VALUES ('s-solo', 'en', 'Solo Leveling', 1)`).run();
    db.prepare(`INSERT INTO series_titles (series_id, language_code, title, is_primary) VALUES ('s-op', 'en', 'One Piece', 1)`).run();

    service = new VectorSearchService(db);
  });

  it('upserts and retrieves embeddings, updating in-memory vector cache', () => {
    const dummyVector = new Float32Array(384);
    dummyVector[0] = 1.0;

    service.upsertEmbedding('s-berserk', dummyVector);

    expect(service.getVectorCount()).toBe(1);

    const row = db.prepare(`
      SELECT dimensions, scale_factor, magnitude, length(embedding_blob) as blob_len
      FROM series_embeddings
      WHERE series_id = 's-berserk'
    `).get() as { dimensions: number; scale_factor: number; magnitude: number; blob_len: number };

    expect(row).toBeDefined();
    expect(row.dimensions).toBe(384);
    expect(row.blob_len).toBe(384); // 384 bytes Int8Array
  });

  it('performs semantic vector search and returns ranked nearest neighbors', () => {
    // Vector 1: Dark Fantasy / Swordsman theme (high on first 50 dims)
    const vecBerserk = new Float32Array(384);
    for (let i = 0; i < 50; i++) vecBerserk[i] = 1.0;

    // Vector 2: Dungeons / Level up theme (high on dims 50 to 100)
    const vecSolo = new Float32Array(384);
    for (let i = 50; i < 100; i++) vecSolo[i] = 1.0;

    service.upsertEmbedding('s-berserk', vecBerserk);
    service.upsertEmbedding('s-solo', vecSolo);

    // Query vector: looking for dark swordsman (matches Berserk)
    const queryVec = new Float32Array(384);
    for (let i = 0; i < 50; i++) queryVec[i] = 0.9;

    const results = service.searchSemantic(queryVec, 5, 0.2);

    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].id).toBe('s-berserk');
    expect(results[0].similarity).toBeGreaterThan(0.9);
  });

  it('performs hybrid search with RRF fusion prioritizing dual lexical & semantic matches', () => {
    const vecBerserk = new Float32Array(384);
    for (let i = 0; i < 50; i++) vecBerserk[i] = 1.0;

    const vecSolo = new Float32Array(384);
    for (let i = 50; i < 100; i++) vecSolo[i] = 1.0;

    service.upsertEmbedding('s-berserk', vecBerserk);
    service.upsertEmbedding('s-solo', vecSolo);

    // Query text "Berserk" matches FTS5
    // Query vector matches Berserk
    const queryVec = new Float32Array(384);
    for (let i = 0; i < 50; i++) queryVec[i] = 0.95;

    const response = service.searchHybrid({
      queryText: 'Berserk',
      queryVector: queryVec,
      limit: 10
    });

    expect(response.success).toBe(true);
    expect(response.results.length).toBeGreaterThanOrEqual(1);

    const topHit = response.results[0];
    expect(topHit.seriesId).toBe('s-berserk');
    expect(topHit.matchType).toBe('hybrid'); // Dual match
    expect(topHit.lexicalRank).toBe(1);
    expect(topHit.semanticRank).toBe(1);
    expect(topHit.rrfScore).toBeCloseTo(0.03278, 4);
  });

  it('gracefully degrades to 100% lexical FTS5 search when queryVector is omitted', () => {
    const response = service.searchHybrid({
      queryText: 'Solo Leveling'
    });

    expect(response.success).toBe(true);
    expect(response.results.length).toBe(1);
    expect(response.results[0].seriesId).toBe('s-solo');
    expect(response.results[0].matchType).toBe('lexical');
  });

  it('handles batch embedding ingestion via upsertEmbeddingsBatch', () => {
    const vecA = new Float32Array(384);
    const vecB = new Float32Array(384);
    vecA[0] = 0.5;
    vecB[1] = 0.5;

    const count = service.upsertEmbeddingsBatch([
      { seriesId: 's-solo', vector: vecA },
      { seriesId: 's-op', vector: vecB }
    ]);

    expect(count).toBe(2);
    expect(service.getVectorCount()).toBe(2);
  });
});
