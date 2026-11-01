import { describe, it, expect } from 'vitest';
import { sanitizeFtsQuery } from '../../../src/backend/utils/fts-sanitizer';

describe('sanitizeFtsQuery', () => {
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
});
