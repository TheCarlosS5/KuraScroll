# Sprint 60: QA Resilience Test Plan & Dialogue Search Matrix
**Feature:** Ultra-Low-Latency Local Dialogue OCR & Trigram Substring Search Engine  
**Target Host Platform:** Intel Pentium T4500 (2C/2T) & SQLite FTS5 / Trigram Tokenizer

---

## 1. Executive Summary & Objective

In **Sprint 60**, KuraScroll introduces the **Ultra-Low-Latency Local Dialogue OCR & Trigram Substring Search Engine**, allowing readers to search spoken text inside manga speech bubbles across chapters and series.

Operating against SQLite FTS5 with trigram tokenization, searching user-provided text containing unclosed quotes, wildcards, CJK punctuation, and malicious SQL fragments requires rigorous fuzzing and edge-case validation to prevent FTS5 syntax errors or data leaks.

Our QA resilience test suite rigorously verifies:
1. FTS5 search syntax fuzzing (unclosed quotes, erratic wildcards, CJK punctuation `「`, `」`, `…`, `・`, SQL injections, empty strings).
2. Orphaned dialogue & corrupt OCR resilience (missing bounding boxes, page index out of bounds, invalid UTF-8 control characters).
3. Chapter & Series boundary isolation (zero data leakage across series).

---

## 2. Adversarial Test Case Matrix

### Case 1: FTS5 Search Syntax Fuzzing
- **Scenario:** Submitting hostile or malformed search queries to the dialogue search endpoint:
  - Unclosed quotes: `"Nami`
  - Erratic wildcards: `* Luffy *`
  - Special CJK punctuation: `「お前は...」` or `・`
  - SQL injection payloads: `' OR 1=1; --`
  - Empty strings or whitespace: `   `
- **Behavioral Expectation:**
  - The query sanitizer (`sanitizeDialogueQuery`) must strip or escape special FTS5 operators (`*`, `^`, `NEAR`, `OR`, `AND`, `NOT`) and quotes.
  - Executing the sanitized query against `dialogue_search_fts MATCH ?` must **never** throw an SQLite syntax error (`fts5: syntax error`).
- **Test Implementation Outline (`tests/backend/resilience/dialogue-search-fuzz.test.ts`):**
  ```typescript
  it('safely sanitizes and executes hostile FTS5 dialogue queries without syntax errors', () => {
    const hostileQueries = [
      '"Unclosed quote',
      '***Luffy***',
      '「お前は...」 仲間だ！',
      "' OR 1=1; --",
      '   '
    ];

    for (const query of hostileQueries) {
      const sanitized = sanitizeDialogueQuery(query);
      expect(() => {
        db.prepare('SELECT * FROM dialogue_search_fts WHERE dialogue_search_fts MATCH ?').all(sanitized || 'fallback');
      }).not.toThrow();
    }
  });
  ```

---

### Case 2: Orphaned Dialogues & Corrupt OCR Resilience
- **Scenario:** Ingesting OCR metadata where a dialogue item lacks bounding coordinates (`x: null, y: null`), references a page number exceeding the chapter's total page count (e.g. Page 55 in a 20-page chapter), or contains invalid control characters / malformed UTF-8 sequences.
- **Behavioral Expectation:**
  - Missing coordinates must default to center-page bounding boxes or be safely omitted without crashing the indexer.
  - Out-of-bounds page numbers must be clamped to `min(page, totalPages)` or flagged as orphaned.
  - Invalid control characters (`\x00-\x1F`) must be stripped during sanitization.
- **Test Implementation Outline (`tests/backend/resilience/dialogue-search-fuzz.test.ts`):**
  ```typescript
  it('handles orphaned dialogues and corrupt OCR metadata gracefully', () => {
    const corruptOCR = {
      chapterId: 'chap-1',
      pageNumber: 999, // out of bounds
      boundingBox: null, // missing coordinates
      text: 'Corrupt\x00\x1Ftext'
    };

    expect(() => ingestDialogueRecord(corruptOCR)).not.toThrow();
    const sanitized = getSanitizedDialogue('chap-1');
    expect(sanitized.pageNumber).toBeLessThanOrEqual(20); // clamped
    expect(sanitized.text).not.toContain('\x00');
  });
  ```

---

### Case 3: Chapter & Series Boundary Isolation
- **Scenario:** Executing a dialogue search with `seriesId` and `chapterId` filters across a database containing multiple series and chapters.
- **Behavioral Expectation:**
  - Results must be strictly scoped to the requested series and chapter.
  - Zero data leakage of dialogue text from Series A when querying Series B.
- **Test Implementation Outline (`tests/backend/resilience/dialogue-search-fuzz.test.ts`):**
  ```typescript
  it('strictly isolates dialogue search results by seriesId and chapterId with zero leakage', async () => {
    const results = await dialogueSearchEngine.search({
      query: 'Straw Hat',
      seriesId: 'series-one-piece',
      chapterId: 'chap-one-piece-1'
    });

    for (const res of results) {
      expect(res.seriesId).toBe('series-one-piece');
      expect(res.chapterId).toBe('chap-one-piece-1');
    }
  });
  ```

---

## 3. Deliverables & Artifact Summary
- This resilience test plan document (`docs/reports/sprint60-dialogue-search-resilience-matrix.md`).
- Automated test suites:
  - `tests/backend/resilience/dialogue-search-fuzz.test.ts`
  - `tests/backend/routes/dialogue-search-routes.test.ts`
