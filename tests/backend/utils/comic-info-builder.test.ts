import { describe, it, expect } from 'vitest';
import { buildComicInfoXml, escapeXml } from '../../../src/backend/utils/comic-info-builder.js';

describe('ComicInfoBuilder (Sprint 40)', () => {
  it('escapes XML special characters correctly to prevent malformed tags', () => {
    expect(escapeXml('Hunter & Hunter')).toBe('Hunter &amp; Hunter');
    expect(escapeXml('Attack <on> Titan')).toBe('Attack &lt;on&gt; Titan');
    expect(escapeXml('"Quotes" & \'Apostrophes\'')).toBe('&quot;Quotes&quot; &amp; &apos;Apostrophes&apos;');
  });

  it('builds schema-compliant ComicInfo.xml with all relevant manga metadata', () => {
    const xml = buildComicInfoXml({
      seriesTitle: 'One Piece',
      chapterTitle: 'Romance Dawn & New Adventures',
      chapterNumber: 1,
      volumeNumber: 1,
      summary: 'Luffy sets sail on a small boat <East Blue>.',
      writer: 'Eiichiro Oda',
      genre: 'Action, Adventure, Comedy',
      mangaReadingDirection: 'YesAndRightToLeft',
      pageCount: 54,
    });

    expect(xml).toContain('<?xml version="1.0" encoding="utf-8"?>');
    expect(xml).toContain('<ComicInfo xmlns:xsd="http://www.w3.org/2001/XMLSchema"');
    expect(xml).toContain('<Series>One Piece</Series>');
    expect(xml).toContain('<Title>Romance Dawn &amp; New Adventures</Title>');
    expect(xml).toContain('<Number>1</Number>');
    expect(xml).toContain('<Volume>1</Volume>');
    expect(xml).toContain('<Summary>Luffy sets sail on a small boat &lt;East Blue&gt;.</Summary>');
    expect(xml).toContain('<Writer>Eiichiro Oda</Writer>');
    expect(xml).toContain('<Genre>Action, Adventure, Comedy</Genre>');
    expect(xml).toContain('<Manga>YesAndRightToLeft</Manga>');
    expect(xml).toContain('<PageCount>54</PageCount>');
    expect(xml).toContain('</ComicInfo>');
  });

  it('handles sparse metadata gracefully with valid defaults', () => {
    const xml = buildComicInfoXml({
      seriesTitle: 'Solo Leveling',
      pageCount: 30,
    });

    expect(xml).toContain('<Series>Solo Leveling</Series>');
    expect(xml).toContain('<Manga>YesAndRightToLeft</Manga>');
    expect(xml).toContain('<PageCount>30</PageCount>');
    expect(xml).not.toContain('<Title>');
    expect(xml).not.toContain('<Volume>');
  });
});
