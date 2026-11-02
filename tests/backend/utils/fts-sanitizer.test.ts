import { describe, it, expect } from 'vitest';
import {
  sanitizeFtsQuery,
  isCjk,
  katakanaToHiragana,
  generateCjkNgrams,
  escapeHtml,
  createSearchSnippet,
} from '../../../src/backend/utils/fts-sanitizer';

describe('Sprint 36: fts-sanitizer & CJK Natural Tokenizer Suite', () => {
  it('strips special FTS characters and formats words into prefix tokens', () => {
    expect(sanitizeFtsQuery('SPY x FAMILY')).toBe('"SPY"* "x"* "FAMILY"*');
    expect(sanitizeFtsQuery('SPY×FAMILY')).toBe('"SPY"* "FAMILY"*');
    expect(sanitizeFtsQuery('Fate/stay night')).toBe('"Fate"* "stay"* "night"*');
    expect(sanitizeFtsQuery("JoJo's Bizarre")).toBe('"JoJo"* "s"* "Bizarre"*');
    expect(sanitizeFtsQuery('Re:Zero - Starting')).toBe('"Re"* "Zero"* "Starting"*');
  });

  it('handles empty or whitespace strings', () => {
    expect(sanitizeFtsQuery('')).toBe('');
    expect(sanitizeFtsQuery('   ')).toBe('');
  });

  it('handles kanji, kana, and korean characters correctly', () => {
    expect(sanitizeFtsQuery('鬼滅の刃')).toBe('"鬼滅の刃"*');
    expect(sanitizeFtsQuery('나 혼자만')).toBe('"나"* "혼자만"*');
  });

  it('neutralizes solitary boolean keywords into literal search terms', () => {
    expect(sanitizeFtsQuery('Naruto AND Sasuke')).toBe('"Naruto"* "AND"* "Sasuke"*');
    expect(sanitizeFtsQuery('OR NOT NEAR')).toBe('"OR"* "NOT"* "NEAR"*');
  });

  it('detects CJK characters accurately with isCjk()', () => {
    expect(isCjk('One Piece')).toBe(false);
    expect(isCjk('進撃の巨人')).toBe(true);
    expect(isCjk('ナルト')).toBe(true);
    expect(isCjk('나 혼자만 레벨업')).toBe(true);
  });

  it('converts Katakana to Hiragana with katakanaToHiragana()', () => {
    expect(katakanaToHiragana('ナルト')).toBe('なると');
    expect(katakanaToHiragana('ワンピース')).toBe('わんぴーす');
    expect(katakanaToHiragana('Latin')).toBe('Latin');
  });

  it('generates unigrams and bigrams for CJK text with generateCjkNgrams()', () => {
    const ngrams = generateCjkNgrams('進撃の巨人');
    expect(ngrams).toContain('進');
    expect(ngrams).toContain('撃');
    expect(ngrams).toContain('進撃');
    expect(ngrams).toContain('撃の');
    expect(ngrams).toContain('巨人');
  });

  it('escapes dangerous HTML characters to prevent XSS injection', () => {
    expect(escapeHtml('<script>alert("pwned")</script>')).toBe(
      '&lt;script&gt;alert(&quot;pwned&quot;)&lt;/script&gt;'
    );
  });

  it('generates safe highlighted contextual snippets with createSearchSnippet()', () => {
    const snippet = createSearchSnippet(
      'In a world where titans roam, Eren Yeager vows to eliminate all titans.',
      'Eren'
    );
    expect(snippet.hasMatch).toBe(true);
    expect(snippet.html).toContain(
      '<mark class="bg-indigo-500/25 text-indigo-300 rounded px-1 font-semibold">Eren</mark>'
    );
  });

  it('safely escapes user HTML in snippet without double-escaping highlight marks', () => {
    const snippet = createSearchSnippet(
      'Series with <b>HTML</b> and <script>alert(1)</script> tags',
      'HTML'
    );
    expect(snippet.hasMatch).toBe(true);
    expect(snippet.html).toContain('&lt;b&gt;');
    expect(snippet.html).toContain('&lt;script&gt;');
    expect(snippet.html).not.toContain('<script>');
    expect(snippet.html).toContain(
      '<mark class="bg-indigo-500/25 text-indigo-300 rounded px-1 font-semibold">HTML</mark>'
    );
  });
});
