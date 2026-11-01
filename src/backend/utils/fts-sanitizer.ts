export function sanitizeFtsQuery(query: string): string {
  if (!query || typeof query !== 'string') {
    return '';
  }

  // Remove FTS special operator characters: * " ( ) : ^ - +
  const cleaned = query.replace(/[*"():^+\-\[\]{}]/g, ' ').trim();
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
