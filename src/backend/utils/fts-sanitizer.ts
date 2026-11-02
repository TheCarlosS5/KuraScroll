/**
 * Sprint 36: Multilingual FTS5 Sanitizer, CJK Fuzzy Tokenizer & Contextual Snippet Generator
 * Zero external dependencies. Tailored for Intel Pentium T4500 and SQLite FTS5 unicode61 engine.
 */

// CJK Unicode ranges:
// \u3040-\u309F: Hiragana
// \u30A0-\u30FF: Katakana
// \u4E00-\u9FFF: CJK Unified Ideographs (Kanji)
// \u3400-\u4DBF: CJK Ideographs Extension A
// \uF900-\uFAFF: CJK Compatibility Ideographs
// \uAC00-\uD7AF: Hangul Syllables (Korean)
// \u1100-\u11FF, \u3130-\u318F: Hangul Jamo
const CJK_REGEX = /[\u3040-\u309F\u30A0-\u30FF\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF\uAC00-\uD7AF\u1100-\u11FF\u3130-\u318F]/;

const DANGEROUS_FTS_CHARS = /[*"():^+\-\[\]{}~<>=`'×·/\\|_!?,;%@#$]/g;
const INVISIBLE_CHARS = /[\u0000-\u001F\u007F-\u009F\u200B-\u200F\u2028-\u202F\u2060-\u206F\uFEFF]/g;

/**
 * Checks if a string contains any CJK (Japanese Kanji/Kana, Korean Hangul) characters.
 */
export function isCjk(text: string): boolean {
  if (!text) return false;
  return CJK_REGEX.test(text);
}

/**
 * Converts Japanese Katakana characters to their Hiragana equivalents.
 */
export function katakanaToHiragana(text: string): string {
  if (!text) return '';
  return text.replace(/[\u30A1-\u30F6]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) - 0x60)
  );
}

/**
 * Generates overlapping character bigrams and unigrams for continuous CJK text
 * enabling partial substring matching in SQLite FTS5 without a dictionary parser.
 */
export function generateCjkNgrams(text: string): string[] {
  if (!text) return [];
  const normalized = text.normalize('NFC').trim();
  const ngrams = new Set<string>();

  for (let i = 0; i < normalized.length; i++) {
    // Unigram
    ngrams.add(normalized[i]);

    // Bigram
    if (i + 1 < normalized.length) {
      ngrams.add(normalized.slice(i, i + 2));
    }
  }

  return Array.from(ngrams);
}

/**
 * Escapes raw strings for safe HTML rendering to prevent XSS.
 */
export function escapeHtml(text: string): string {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export interface SanitizeFtsOptions {
  enableCjkFuzzy?: boolean;
}

/**
 * Sanitizes raw user search queries for SQLite FTS5 MATCH expressions.
 * - Strips dangerous operators, unmatched quotes, and control chars.
 * - Prevents solitary boolean keywords (AND, OR, NOT, NEAR) from triggering syntax errors.
 * - Formats valid tokens into prefix-matched terms ("token"*).
 */
export function sanitizeFtsQuery(
  query: string,
  options: SanitizeFtsOptions = {}
): string {
  if (!query || typeof query !== 'string') {
    return '';
  }

  // 1. Unicode NFC normalization
  const normalized = query.normalize('NFC');

  // 2. Strip invisible control characters & FTS delimiter symbols
  const cleaned = normalized
    .replace(INVISIBLE_CHARS, ' ')
    .replace(DANGEROUS_FTS_CHARS, ' ')
    .trim();

  if (!cleaned) {
    return '';
  }

  // 3. Tokenize by whitespace
  const rawTokens = cleaned.split(/\s+/).filter((t) => t.length > 0);
  if (rawTokens.length === 0) {
    return '';
  }

  const resultTokens: string[] = [];

  for (const token of rawTokens) {
    // If token is an isolated boolean operator, treat it as a literal search term
    const upper = token.toUpperCase();
    if (upper === 'AND' || upper === 'OR' || upper === 'NOT' || upper === 'NEAR') {
      resultTokens.push(`"${token}"*`);
      continue;
    }

    if (options.enableCjkFuzzy && isCjk(token)) {
      // Add exact token prefix
      resultTokens.push(`"${token}"*`);
      // Add unigram/bigram ngrams for CJK tokens longer than 1 character
      if (token.length > 1) {
        const ngrams = generateCjkNgrams(token);
        for (const ng of ngrams) {
          resultTokens.push(`"${ng}"*`);
        }
      }
    } else {
      resultTokens.push(`"${token}"*`);
    }
  }

  return resultTokens.join(' ');
}

export interface ContextualSnippetResult {
  html: string;
  hasMatch: boolean;
}

/**
 * Generates an XSS-safe highlighted snippet around matching search terms.
 * Formatted with Intel GMA 4500MHD zero-blur styles (<mark class="bg-indigo-500/25 text-indigo-300 rounded px-1 font-semibold">).
 */
export function createSearchSnippet(
  text: string,
  query: string,
  maxLen: number = 140
): ContextualSnippetResult {
  if (!text) {
    return { html: '', hasMatch: false };
  }

  if (!query || !query.trim()) {
    const rawSafe = escapeHtml(text);
    return {
      html: rawSafe.length > maxLen ? rawSafe.slice(0, maxLen) + '...' : rawSafe,
      hasMatch: false,
    };
  }

  const cleanQuery = query
    .normalize('NFC')
    .replace(DANGEROUS_FTS_CHARS, ' ')
    .replace(INVISIBLE_CHARS, ' ')
    .trim();

  const queryTerms = cleanQuery
    .split(/\s+/)
    .filter((t) => t.length > 0)
    .map((t) => t.toLowerCase());

  if (queryTerms.length === 0) {
    const rawSafe = escapeHtml(text);
    return {
      html: rawSafe.length > maxLen ? rawSafe.slice(0, maxLen) + '...' : rawSafe,
      hasMatch: false,
    };
  }

  // Find position of first match
  const lowerText = text.toLowerCase();
  let firstMatchIndex = -1;
  let matchTermLen = 0;

  for (const term of queryTerms) {
    const idx = lowerText.indexOf(term);
    if (idx !== -1 && (firstMatchIndex === -1 || idx < firstMatchIndex)) {
      firstMatchIndex = idx;
      matchTermLen = term.length;
    }
  }

  // Determine window slice
  let sliceStart = 0;
  let sliceEnd = text.length;

  if (firstMatchIndex !== -1 && text.length > maxLen) {
    const halfWindow = Math.floor(maxLen / 2);
    sliceStart = Math.max(0, firstMatchIndex - halfWindow);
    sliceEnd = Math.min(text.length, sliceStart + maxLen);

    if (sliceEnd - sliceStart < maxLen && sliceStart > 0) {
      sliceStart = Math.max(0, sliceEnd - maxLen);
    }
  } else if (text.length > maxLen) {
    sliceEnd = maxLen;
  }

  let windowText = text.slice(sliceStart, sliceEnd);
  const prefixEllipsis = sliceStart > 0 ? '...' : '';
  const suffixEllipsis = sliceEnd < text.length ? '...' : '';

  // Escape the slice before injecting HTML mark tags
  let escapedWindow = escapeHtml(windowText);

  let hasMatch = false;
  // Apply highlight replacement to escaped window
  for (const term of queryTerms) {
    const escapedTerm = escapeHtml(term);
    const escapedRegex = new RegExp(`(${escapedTerm.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')})`, 'gi');
    if (escapedRegex.test(escapedWindow)) {
      hasMatch = true;
      escapedWindow = escapedWindow.replace(
        escapedRegex,
        '<mark class="bg-indigo-500/25 text-indigo-300 rounded px-1 font-semibold">$1</mark>'
      );
    }
  }

  return {
    html: `${prefixEllipsis}${escapedWindow}${suffixEllipsis}`,
    hasMatch,
  };
}
