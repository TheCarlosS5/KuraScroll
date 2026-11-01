import { describe, it, expect } from 'vitest';
import { parseCliArgs } from '../../../src/backend/cli/ingest-cli';

describe('parseCliArgs', () => {
  it('parses series, chapter, and file parameters accurately', () => {
    const args = ['--series', 'chainsaw-man', '--chap', '105', '--file', 'C:/scans/c105.cbz'];
    const parsed = parseCliArgs(args);
    expect(parsed.mode).toBe('chapter');
    expect(parsed.series).toBe('chainsaw-man');
    expect(parsed.chapter).toBe(105);
    expect(parsed.file).toBe('C:/scans/c105.cbz');
    expect(parsed.volume).toBe(1);
  });

  it('supports volume and title flags', () => {
    const args = ['--series', 'solo-leveling', '--vol', '3', '--chap', '45', '--file', 'C:/scans/c45.zip', '--title', 'I am the King'];
    const parsed = parseCliArgs(args);
    expect(parsed.volume).toBe(3);
    expect(parsed.title).toBe('I am the King');
  });

  it('parses volume mode with --volume flag', () => {
    const args = ['--volume', 'C:/scans/One_Piece_Vol_01.cbz'];
    const parsed = parseCliArgs(args);
    expect(parsed.mode).toBe('volume');
    expect(parsed.file).toBe('C:/scans/One_Piece_Vol_01.cbz');
    expect(parsed.series).toBe('one-piece-vol-01');
  });

  it('parses backup mode with --backup flag', () => {
    const args = ['--backup', 'C:/backups/mihon_backup.tachibk'];
    const parsed = parseCliArgs(args);
    expect(parsed.mode).toBe('backup');
    expect(parsed.file).toBe('C:/backups/mihon_backup.tachibk');
  });

  it('throws descriptive error when required arguments are omitted', () => {
    expect(() => parseCliArgs(['--series', 'chainsaw-man'])).toThrow(/Faltan parámetros requeridos/i);
  });
});
