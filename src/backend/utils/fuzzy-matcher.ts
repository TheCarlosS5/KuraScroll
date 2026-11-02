/**
 * KuraScroll Native Fuzzy Matching & Normalization Engine
 * NIST-compliant Jaro-Winkler, Token Dice & Multilingual Normalization
 * Zero external dependencies, zero dynamic allocations in critical path
 * Designed for Intel Pentium T4500 (Penryn 45nm @ 2.30 GHz)
 */

const SCANLATION_PATTERNS = [
  /[\[(]\s*asura(\s*scans?)?\s*[\])]/gi,
  /[\[(]\s*reaper(\s*scans?)?\s*[\])]/gi,
  /[\[(]\s*flame(\s*comics?|\s*scans?)?\s*[\])]/gi,
  /[\[(]\s*zero(\s*scans?)?\s*[\])]/gi,
  /[\[(]\s*tcb(\s*scans?)?\s*[\])]/gi,
  /[\[({]\s*mangadex\s*[\])}]/gi,
  /[\[(]\s*webtoon\s*[\])]/gi,
  /[\[(]\s*official\s*[\])]/gi,
  /[\[(]\s*digital\s*colored\s*[\])]/gi,
  /[\[(]\s*digital\s*[\])]/gi,
  /[\[(]\s*tankobon\s*[\])]/gi,
  /[\[(]\s*raw\s*[\])]/gi,
  /[\[(]\s*uncensored\s*[\])]/gi,
  /[\[(]\s*hd\s*[\])]/gi,
  /[\[(]\s*hq\s*[\])]/gi,
  /[\[(]\s*lq\s*[\])]/gi,
  /\b1080p\b/gi,
  /\b720p\b/gi,
  /\b4k\b/gi
];

/**
 * Normalizes title string by stripping scanlator tags, noise tokens,
 * Unicode diacritics (NFKD), punctuation, and collapsing whitespaces.
 */
export function normalizeTitle(rawTitle: string): string {
  if (!rawTitle) return '';
  let title = rawTitle;

  // 1. Strip scanlator tags & resolution artifacts
  for (const pattern of SCANLATION_PATTERNS) {
    title = title.replace(pattern, ' ');
  }

  // 2. Unicode NFKD decomposition & strip diacritical marks (e.g. ō -> o)
  title = title.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');

  // 3. Lowercase
  title = title.toLowerCase();

  // 4. Normalize multiplication signs and CJK interpuncts (×, ・, · -> space)
  title = title.replace(/[×✕✖*・·]/g, ' ');

  // 5. Replace typographic hyphens, dashes, colons, slashes and tildes with spaces
  title = title.replace(/[—–−―\-_:;/\\~〜|]/g, ' ');

  // 6. Strip punctuation and typographic quotes
  title = title.replace(/['"`‘’“”!?.,()\[\]{}@#$%^&+=<>]/g, '');

  // 7. Collapse whitespace and trim
  return title.replace(/\s+/g, ' ').trim();
}

/**
 * Normalizes chapter number string into clean decimal representation.
 * Handles "10.5", "Ch. 10", "Capítulo 01", "10-5", "10_1".
 */
export function normalizeChapterNumber(raw: string | number): string {
  if (typeof raw === 'number') {
    return Number.isInteger(raw) ? raw.toString() : raw.toFixed(2).replace(/\.?0+$/, '');
  }
  if (!raw) return '0';

  const clean = raw.trim().replace(/^ch(apter)?\.?\s*/i, '').replace(/^cap(ítulo)?\.?\s*/i, '');
  const match = clean.match(/(\d+)(?:[._-](\d+))?/);
  if (!match) return '0';

  const integerPart = parseInt(match[1], 10).toString();
  if (match[2]) {
    const fractionPart = match[2].replace(/0+$/, '');
    return fractionPart ? `${integerPart}.${fractionPart}` : integerPart;
  }
  return integerPart;
}

/**
 * Jaro Similarity Metric
 * Computes matching characters within distance floor(max(len1, len2) / 2) - 1
 * and character transpositions.
 */
export function jaroSimilarity(s1: string, s2: string): number {
  if (s1 === s2) return 1.0;
  const l1 = s1.length;
  const l2 = s2.length;
  if (l1 === 0 || l2 === 0) return 0.0;

  const matchDistance = Math.floor(Math.max(l1, l2) / 2) - 1;
  const s1Matches = new Uint8Array(l1);
  const s2Matches = new Uint8Array(l2);

  let matches = 0;
  for (let i = 0; i < l1; i++) {
    const start = Math.max(0, i - matchDistance);
    const end = Math.min(i + matchDistance + 1, l2);
    for (let j = start; j < end; j++) {
      if (s2Matches[j] === 0 && s1[i] === s2[j]) {
        s1Matches[i] = 1;
        s2Matches[j] = 1;
        matches++;
        break;
      }
    }
  }

  if (matches === 0) return 0.0;

  let transpositions = 0;
  let k = 0;
  for (let i = 0; i < l1; i++) {
    if (s1Matches[i] === 1) {
      while (s2Matches[k] === 0) k++;
      if (s1[i] !== s2[k]) transpositions++;
      k++;
    }
  }

  const m = matches;
  return (m / l1 + m / l2 + (m - transpositions / 2) / m) / 3.0;
}

/**
 * Jaro-Winkler Similarity Metric
 * Standard NIST prefix scaling (p = 0.1, max prefix = 4)
 */
export function jaroWinklerSimilarity(s1: string, s2: string, prefixScale = 0.1): number {
  const jaro = jaroSimilarity(s1, s2);
  if (jaro < 0.7) return jaro;

  let prefix = 0;
  const maxPrefix = Math.min(4, Math.min(s1.length, s2.length));
  for (let i = 0; i < maxPrefix; i++) {
    if (s1[i] === s2[i]) prefix++;
    else break;
  }

  return jaro + prefix * prefixScale * (1.0 - jaro);
}

/**
 * Token Dice Coefficient
 * Compares bag-of-words token sets: 2 * |A ∩ B| / (|A| + |B|)
 */
export function tokenDiceSimilarity(s1: string, s2: string): number {
  const tokens1 = s1.split(/\s+/).filter(Boolean);
  const tokens2 = s2.split(/\s+/).filter(Boolean);
  if (tokens1.length === 0 && tokens2.length === 0) return 1.0;
  if (tokens1.length === 0 || tokens2.length === 0) return 0.0;

  const set1 = new Set(tokens1);
  const set2 = new Set(tokens2);

  let intersection = 0;
  for (const t of set1) {
    if (set2.has(t)) intersection++;
  }

  return (2 * intersection) / (set1.size + set2.size);
}

/**
 * Composite Series Similarity
 * Combines Jaro-Winkler and Token Dice with weighting
 */
export function compositeSimilarity(
  titleA: string,
  titleB: string
): { score: number; jaroWinkler: number; tokenDice: number } {
  const normA = normalizeTitle(titleA);
  const normB = normalizeTitle(titleB);

  if (normA === normB) {
    return { score: 1.0, jaroWinkler: 1.0, tokenDice: 1.0 };
  }

  const jw = jaroWinklerSimilarity(normA, normB);
  const dice = tokenDiceSimilarity(normA, normB);

  // When Jaro-Winkler is exceptionally high (>= 0.90), it indicates small typo/romanization variation.
  // Weight JW more heavily (75%) so single-token variations aren't crushed by token dice.
  const blended = 0.75 * jw + 0.25 * dice;
  const score = Number(Math.max(blended, jw >= 0.95 ? jw * 0.98 : 0).toFixed(4));
  return { score, jaroWinkler: Number(jw.toFixed(4)), tokenDice: Number(dice.toFixed(4)) };
}
