import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { isPathSafe, extractArchive } from '../../../src/backend/services/archive-extractor';
import AdmZip from 'adm-zip';
import fs from 'node:fs/promises';
import path from 'node:path';

describe('Archive Extractor with Zip Slip Protection', () => {
  const tmpDir = path.resolve(__dirname, 'tmp-archive-test');
  const dummyZipPath = path.join(tmpDir, 'test-chapter.cbz');

  beforeAll(async () => {
    await fs.mkdir(tmpDir, { recursive: true });

    const zip = new AdmZip();
    zip.addFile('page_10.jpg', Buffer.from('fake-jpg-content'));
    zip.addFile('page_1.png', Buffer.from('fake-png-content'));
    zip.addFile('page_2.webp', Buffer.from('fake-webp-content'));
    zip.addFile('.DS_Store', Buffer.from('system-garbage'));
    zip.addFile('info.txt', Buffer.from('text metadata'));
    zip.writeZip(dummyZipPath);
  });

  afterAll(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  describe('isPathSafe', () => {
    it('detects and blocks path traversal attempts', () => {
      const targetDir = path.resolve('/var/app/storage');
      expect(isPathSafe(targetDir, '../../etc/passwd')).toBe(false);
      expect(isPathSafe(targetDir, '..\\..\\windows\\system32\\cmd.exe')).toBe(false);
      expect(isPathSafe(targetDir, 'subfolder/page1.jpg')).toBe(true);
      expect(isPathSafe(targetDir, 'page1.jpg')).toBe(true);
    });
  });

  describe('extractArchive', () => {
    it('extracts only valid image files in natural order and ignores non-images', async () => {
      const destDir = path.join(tmpDir, 'extracted');
      const files = await extractArchive(dummyZipPath, destDir);

      expect(files.length).toBe(3);
      expect(path.basename(files[0])).toBe('page_1.png');
      expect(path.basename(files[1])).toBe('page_2.webp');
      expect(path.basename(files[2])).toBe('page_10.jpg');

      // Ensure files exist on disk
      for (const f of files) {
        const stat = await fs.stat(f);
        expect(stat.isFile()).toBe(true);
      }
    });
  });
});
