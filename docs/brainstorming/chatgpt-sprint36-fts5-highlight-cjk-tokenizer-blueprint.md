# Sprint 36: Full-Text Search Highlight Match Snippets & Natural CJK Fuzzy Tokenizer Blueprint

## 1. Executive Summary & Senior Architectural Guidance
Following consultation with senior ChatGPT via Brave MCP, Sprint 36 delivers a zero-overhead, highly performant multilingual search engine tailored for the Intel Pentium T4500 (2C/2T, 1MB L2 cache, <=512MB RAM) and mechanical 4TB SATA II HDD.

Instead of heavy external native tokenizers (MeCab, Sudachi, Kuromoji), KuraScroll adopts a **deterministic hybrid N-gram architecture**:
1. **Unicode NFC & CJK Script Detection:** Normalizes Japanese Kanji, Hiragana, Katakana, and Korean Hangul.
2. **Katakana-to-Hiragana & Bigram/Unigram Token Generation:** Splits continuous CJK scripts into unigrams and overlapping character bigrams (e.g. `進撃の巨人` -> `進 撃 の 巨 人 進撃 撃の の巨 巨人`), indexed in SQLite FTS5.
3. **Bulletproof Query Sanitizer:** Strips illegal SQLite FTS5 operators, balances quotes, neutralizes solitary boolean keywords (`AND`, `OR`, `NOT`), and appends clean prefix matchers (`"term"*`).
4. **Contextual Snippets & Multibyte Safety:** Safe snippet rendering using `snippet(series_fts, ...)` with HTML-escaping of raw text before injecting highlight tags `<mark class="bg-indigo-500/30 text-indigo-300 rounded px-1">`.
5. **Zero-CLS Frontend Highlighting:** Non-destructive token highlighting in `SearchBar.tsx` and `CatalogPage.tsx` with pure CSS transforms and zero backdrop blur (Intel GMA 4500MHD target).

---

## 2. Tokenizer & Normalization Specification
```typescript
// CJK Unicode Block Ranges:
// Hiragana: \u3040-\u309F
// Katakana: \u30A0-\u30FF
// CJK Unified Ideographs (Kanji): \u4E00-\u9FFF
// Hangul Syllables: \uAC00-\uD7AF
// Hangul Jamo: \u1100-\u11FF, \u3130-\u318F
```

- **Japanese Katakana to Hiragana conversion:**
  $\text{codePoint} - 0x60$ (when $0x30A1 \le \text{codePoint} \le 0x30F6$).
- **Bigram Generation:**
  For any CJK sequence $c_1 c_2 \dots c_n$, generate individual characters $c_i$ (for single-character matches) and pairs $c_i c_{i+1}$ (for exact phrase/prefix matches).
- **Latin Query Sanitizer:**
  Trims punctuation, strips unescaped quotes, prevents solitary FTS operators from triggering SQLite syntax exceptions, and appends `*` prefix operator to trailing word.

---

## 3. SLA Targets & Benchmark Envelope (Pentium T4500)
- Latin Point Prefix Lookup: **< 1.0 ms**
- CJK Bigram Substring Match (Kanji / Kana / Hangul): **< 5.0 ms**
- Snippet Generation: **< 0.5 ms**
- HTML Sanitization Overhead: **< 0.05 ms**
- Memory Footprint: **< 128 KB** in-memory LRU query cache
