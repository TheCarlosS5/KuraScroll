export interface ComicInfoMetadata {
  seriesTitle: string;
  chapterTitle?: string | null;
  chapterNumber?: number | null;
  volumeNumber?: number | null;
  summary?: string | null;
  writer?: string | null;
  genre?: string | null;
  mangaReadingDirection?: 'YesAndRightToLeft' | 'Yes' | 'No';
  pageCount: number;
  format?: string;
}

/**
 * Escapes unsafe XML characters into compliant predefined XML entities.
 */
export function escapeXml(str?: string | null): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Builds schema-compliant ComicInfo.xml metadata recognized by Tachiyomi,
 * Mihon, CDisplayEx, Chunky, Komga, and Calibre.
 */
export function buildComicInfoXml(meta: ComicInfoMetadata): string {
  const readingDirection = meta.mangaReadingDirection || 'YesAndRightToLeft';

  const lines = [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<ComicInfo xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">',
    `  <Series>${escapeXml(meta.seriesTitle)}</Series>`,
  ];

  if (meta.chapterTitle) {
    lines.push(`  <Title>${escapeXml(meta.chapterTitle)}</Title>`);
  }

  if (meta.chapterNumber !== undefined && meta.chapterNumber !== null) {
    lines.push(`  <Number>${meta.chapterNumber}</Number>`);
  }

  if (meta.volumeNumber !== undefined && meta.volumeNumber !== null) {
    lines.push(`  <Volume>${meta.volumeNumber}</Volume>`);
  }

  if (meta.summary) {
    lines.push(`  <Summary>${escapeXml(meta.summary)}</Summary>`);
  }

  if (meta.writer) {
    lines.push(`  <Writer>${escapeXml(meta.writer)}</Writer>`);
  }

  if (meta.genre) {
    lines.push(`  <Genre>${escapeXml(meta.genre)}</Genre>`);
  }

  lines.push(`  <Manga>${readingDirection}</Manga>`);
  lines.push(`  <PageCount>${meta.pageCount}</PageCount>`);
  lines.push('</ComicInfo>');

  return lines.join('\n');
}
