import { describe, it, expect } from 'vitest';
import { parseCliArgs } from '../../../src/backend/cli/ingest-cli';

describe('parseCliArgs', () => {
  it('parses series, chapter, and file parameters accurately', () => {
    const args = ['--series', 'chainsaw-man', '--chap', '105', '--file', 'C:/scans/c105.cbz'];
    const parsed = parseCliArgs(args);
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

  it('throws descriptive error when required arguments are omitted', () => {
    expect(() => parseCliArgs(['--series', 'chainsaw-man'])).toThrow(/Faltan parámetros requeridos/i);
  });
});
