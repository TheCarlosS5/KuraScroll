export function sanitizeFtsQuery(query: string): string {
  if (!query || typeof query !== 'string') {
    return '';
  }

  // Remove invisible control characters, zero-width spaces, and FTS operators / delimiters: * " ( ) : ^ - + [ ] { } ~ < > = ` ' × · / _
  const cleaned = query
    .replace(/[\u0000-\u001F\u007F-\u009F\u200B-\u200F\u2028-\u202F\u2060-\u206F\uFEFF]/g, ' ')
    .replace(/[*"():^+\-\[\]{}~<>=`'×·/_]/g, ' ')
    .trim();

  if (!cleaned) {
    return '';
  }

  // Tokenize by whitespace, wrap each non-empty token in double quotes and append prefix wildcard *
  const tokens = cleaned
    .split(/\s+/)
    .filter((t) => t.length > 0)
    .map((t) => `"${t}"*`);

  return tokens.join(' ');
}
