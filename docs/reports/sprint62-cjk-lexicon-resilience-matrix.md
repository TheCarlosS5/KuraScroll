# Sprint 62: QA Resilience Test Plan & CJK Lexicon Matrix
**Feature:** CJK Lexicon & Terminology Lookup Engine  
**Target Host Platform:** Intel Pentium T4500 (2C/2T) & SQLite FTS5 Unicode61 Tokenizer

---

## 1. Executive Summary & Objective

In **Sprint 62**, KuraScroll introduces the **CJK Lexicon & Terminology Lookup Engine**, providing contextual glossaries and lore lookups for East Asian terms (Kanji, Kana, Hanzi, Hangul) appearing in manga and manhwa.

Operating against SQLite FTS5 with unicode61 tokenization, processing half-width katakana, surrogate pairs of rare kanji, nonexistent terms, and SQL injection payloads in lore terms requires rigorous fuzzing.

Our QA resilience test suite rigorously verifies:
1. Half-width Katakana normalization & searching.
2. Rare Kanji surrogate pair handling (UTF-16 high/low surrogates).
3. Nonexistent term lookup & graceful fallback (empty results, zero errors).
4. SQL injection attack resistance on lore term parameters.

---

## 2. Adversarial Test Case Matrix

### Case 1: Half-Width Katakana Normalization
- **Scenario:** User searches for a term using half-width katakana (`ｱｲｳｴｵ`) or mixed half-width/full-width characters.
- **Behavioral Expectation:**
  - The lexicon normalizer must automatically convert half-width katakana into standard full-width katakana (`アイウエオ`) prior to matching against the database index.
- **Test Implementation Outline (`tests/backend/resilience/cjk-lexicon.test.ts`):**
  ```typescript
  it('normalizes half-width katakana to full-width katakana for successful matching', () => {
    const halfWidthInput = 'ｶｶｶ';
    const normalized = normalizeCJKInput(halfWidthInput);

    expect(normalized).toBe('カカカ');
    const match = lexiconEngine.lookup(normalized);
    expect(match).toBeDefined();
  });
  ```

---

### Case 2: Rare Kanji Surrogate Pairs (Supplementary Multilingual Plane)
- **Scenario:** Looking up lore terms containing rare Kanji represented as UTF-16 surrogate pairs (e.g., SMP characters like `𠮷` or extension ideographs).
- **Behavioral Expectation:**
  - The tokenizer and database search must correctly handle multi-byte Unicode surrogate pairs without splitting characters or corrupting string byte lengths.
- **Test Implementation Outline (`tests/backend/resilience/cjk-lexicon.test.ts`):**
  ```typescript
  it('correctly handles rare Kanji surrogate pairs without string truncation', () => {
    const rareTerm = '𠮷野家';
    const result = lexiconEngine.lookup(rareTerm);

    expect(result).toBeDefined();
    expect(result.term).toBe(rareTerm);
  });
  ```

---

### Case 3: Nonexistent Term Lookup & Graceful Fallback
- **Scenario:** Searching for a completely fabricated or nonexistent term (`"xyznonexistent123"`).
- **Behavioral Expectation:**
  - The lookup engine must return a clean empty result object or `null` gracefully without throwing database exceptions or HTTP 500 errors.
- **Test Implementation Outline (`tests/backend/resilience/cjk-lexicon.test.ts`):**
  ```typescript
  it('returns clean empty results for nonexistent terms without throwing errors', () => {
    const result = lexiconEngine.lookup('xyznonexistent123');
    expect(result).toBeNull();
  });
  ```

---

### Case 4: SQL Injection Resistance on Lore Terms
- **Scenario:** Passing SQL injection payloads as search queries or lore term parameters (`"' OR 1=1; --"` or `"; DROP TABLE cjk_lexicon; --"`).
- **Behavioral Expectation:**
  - All queries must be strictly parameterized using `better-sqlite3`.
  - Malicious payloads are treated as literal search strings, preventing SQL execution and table dropping.
- **Test Implementation Outline (`tests/backend/resilience/cjk-lexicon.test.ts`):**
  ```typescript
  it('resists SQL injection attacks passed via lore search queries', () => {
    const maliciousQuery = "' OR 1=1; --";
    expect(() => lexiconEngine.lookup(maliciousQuery)).not.toThrow();

    // Verify table still exists and query returned nothing or literal match
    const tableCheck = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='cjk_lexicon'").get();
    expect(tableCheck).toBeDefined();
  });
  ```

---

## 3. Deliverables & Artifact Summary
- This resilience test plan document (`docs/reports/sprint62-cjk-lexicon-resilience-matrix.md`).
- Automated test suites:
  - `tests/backend/resilience/cjk-lexicon.test.ts`
  - `tests/backend/routes/cjk-routes.test.ts`
