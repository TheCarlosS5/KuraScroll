import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import 'fake-indexeddb/auto';
import {
  BackupModal,
  analyzeBackupFile,
  formatBytes,
} from '../../src/components/settings/BackupModal';
import { Navbar } from '../../src/components/common/Navbar';
import { localClientStorage } from '../../src/services/local-storage-service';

describe('BackupModal Component & Migration Utilities', () => {
  beforeEach(async () => {
    localStorage.clear();
    await localClientStorage.clearAllProgress();
    vi.clearAllMocks();

    // Mock URL.createObjectURL and revokeObjectURL
    if (!window.URL.createObjectURL) {
      window.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
    } else {
      vi.spyOn(window.URL, 'createObjectURL').mockReturnValue('blob:mock-url');
    }

    if (!window.URL.revokeObjectURL) {
      window.URL.revokeObjectURL = vi.fn();
    } else {
      vi.spyOn(window.URL, 'revokeObjectURL').mockImplementation(() => {});
    }
  });

  describe('Utility Functions', () => {
    it('formatBytes formats byte values correctly', () => {
      expect(formatBytes(0)).toBe('0 B');
      expect(formatBytes(1024)).toBe('1 KB');
      expect(formatBytes(1048576)).toBe('1 MB');
      expect(formatBytes(2500000)).toBe('2.38 MB');
    });

    it('analyzeBackupFile detects KuraScroll native backup format', () => {
      const payload = JSON.stringify({
        app: 'kura-scroll',
        version: 1,
        series: [{ id: 'solo-leveling' }, { id: 'omniscient-reader' }],
        readingProgress: [{ seriesId: 'solo-leveling', chapterId: 'ch-1' }],
        shelvedSeries: { 'solo-leveling': { shelf: 'reading', favorite: true } },
      });

      const report = analyzeBackupFile('backup-ks.json', payload);
      expect(report.format).toBe('kura_scroll_json');
      expect(report.formatLabel).toBe('KuraScroll Backup (JSON)');
      expect(report.seriesCount).toBe(2);
      expect(report.chapterCount).toBe(1);
    });

    it('analyzeBackupFile detects modern Mihon JSON format', () => {
      const payload = JSON.stringify({
        version: 2,
        mangas: [
          {
            title: 'Chainsaw Man',
            chapters: [{ name: 'Ch 1' }, { name: 'Ch 2' }],
          },
          {
            title: 'Dandadan',
            chapters: [{ name: 'Ch 1' }],
          },
        ],
      });

      const report = analyzeBackupFile('mihon_2026.json', payload);
      expect(report.format).toBe('mihon_json');
      expect(report.formatLabel).toBe('Mihon / Tachiyomi v2');
      expect(report.seriesCount).toBe(2);
      expect(report.chapterCount).toBe(3);
    });

    it('analyzeBackupFile detects Tachiyomi legacy JSON with array of manga', () => {
      const payload = JSON.stringify([
        {
          title: 'Berserk',
          chapters: [{ name: 'Ch 1' }],
        },
      ]);

      const report = analyzeBackupFile('tachiyomi_legacy.json', payload);
      expect(report.format).toBe('tachiyomi_legacy_json');
      expect(report.seriesCount).toBe(1);
      expect(report.chapterCount).toBe(1);
    });

    it('analyzeBackupFile detects .tachibk archive extension', () => {
      const buffer = new ArrayBuffer(512);
      const report = analyzeBackupFile('backup.tachibk', buffer);
      expect(report.format).toBe('tachibk_archive');
      expect(report.formatLabel).toBe('Tachiyomi / Mihon (.tachibk)');
    });

    it('analyzeBackupFile returns unknown for corrupt or invalid JSON', () => {
      const report = analyzeBackupFile('broken.json', '{ invalid-json');
      expect(report.format).toBe('unknown');
      expect(report.formatLabel).toContain('JSON inválido');
    });
  });

  describe('Modal Rendering & Interaction', () => {
    it('does not render when isOpen is false', () => {
      render(<BackupModal isOpen={false} onClose={vi.fn()} />);
      expect(screen.queryByTestId('backup-modal')).toBeNull();
    });

    it('renders modal dialog and header when isOpen is true', () => {
      render(<BackupModal isOpen={true} onClose={vi.fn()} />);
      expect(screen.getByTestId('backup-modal')).toBeDefined();
      expect(screen.getByText('Copias de Seguridad & Migración')).toBeDefined();
      expect(screen.getByTestId('tab-export')).toBeDefined();
      expect(screen.getByTestId('tab-import')).toBeDefined();
    });

    it('closes on close button click or Escape key', () => {
      const onClose = vi.fn();
      render(<BackupModal isOpen={true} onClose={onClose} />);

      fireEvent.click(screen.getByTestId('close-backup-modal-btn'));
      expect(onClose).toHaveBeenCalledTimes(1);

      fireEvent.keyDown(window, { key: 'Escape' });
      expect(onClose).toHaveBeenCalledTimes(2);
    });

    it('switches between Exportar and Importar tabs', () => {
      render(<BackupModal isOpen={true} onClose={vi.fn()} />);

      // Defaults to export tab
      expect(screen.getByTestId('export-backup-btn')).toBeDefined();
      expect(screen.queryByTestId('dropzone')).toBeNull();

      // Switch to import tab
      fireEvent.click(screen.getByTestId('tab-import'));
      expect(screen.getByTestId('dropzone')).toBeDefined();
      expect(screen.queryByTestId('export-backup-btn')).toBeNull();

      // Switch back to export tab
      fireEvent.click(screen.getByTestId('tab-export'));
      expect(screen.getByTestId('export-backup-btn')).toBeDefined();
    });
  });

  describe('Export Tab Flow', () => {
    it('renders library statistics and downloads JSON backup on click', async () => {
      // Seed some progress in IndexedDB
      await localClientStorage.saveProgress({
        seriesId: 'solo-leveling',
        chapterId: 'ch-1',
        pageNumber: 5,
        scrollOffsetY: 0,
        timestamp: Date.now(),
      });
      await localClientStorage.setSeriesShelf('solo-leveling', 'reading', true);

      render(<BackupModal isOpen={true} onClose={vi.fn()} />);

      // Wait for stats to load
      await waitFor(() => {
        const historyStat = screen.getByTestId('stat-history-count');
        expect(historyStat.textContent).not.toBe('...');
      });

      const exportBtn = screen.getByTestId('export-backup-btn');
      expect(exportBtn).toBeDefined();

      fireEvent.click(exportBtn);

      await waitFor(() => {
        expect(screen.getByText(/¡Respaldo JSON descargado con éxito!/i)).toBeDefined();
      });
    });
  });

  describe('Import Tab Flow', () => {
    it('analyzes uploaded KuraScroll backup file and displays preview report', async () => {
      render(<BackupModal isOpen={true} onClose={vi.fn()} />);

      fireEvent.click(screen.getByTestId('tab-import'));

      const fileInput = screen.getByTestId('backup-file-input') as HTMLInputElement;

      const mockPayload = JSON.stringify({
        app: 'kura-scroll',
        version: 1,
        shelvedSeries: { 'solo-leveling': { shelf: 'reading', favorite: true } },
        readingProgress: [{ seriesId: 'solo-leveling', chapterId: 'ch-1', pageNumber: 10 }],
      });

      const file = new File([mockPayload], 'my-kura-backup.json', { type: 'application/json' });

      // Trigger file selection
      fireEvent.change(fileInput, { target: { files: [file] } });

      await waitFor(() => {
        expect(screen.getByTestId('backup-preview')).toBeDefined();
        expect(screen.getByTestId('preview-filename').textContent).toBe('my-kura-backup.json');
        expect(screen.getByTestId('preview-format').textContent).toBe('KuraScroll Backup (JSON)');
        expect(screen.getByTestId('preview-series-count').textContent).toBe('1');
      });

      // Verify "Iniciar Importación" button is ready
      const startBtn = screen.getByTestId('start-import-btn');
      expect(startBtn).toBeDefined();
    });

    it('executes migration when Iniciar Importación is clicked and shows success state', async () => {
      const onImportComplete = vi.fn();
      render(<BackupModal isOpen={true} onClose={vi.fn()} onImportComplete={onImportComplete} />);

      fireEvent.click(screen.getByTestId('tab-import'));

      const fileInput = screen.getByTestId('backup-file-input') as HTMLInputElement;

      const mockPayload = JSON.stringify({
        version: 2,
        mangas: [
          {
            title: 'Tower of God',
            favorite: true,
            chapters: [{ name: 'Chapter 1', chapter_number: 1, read: true, last_page_read: 20 }],
          },
        ],
      });

      const file = new File([mockPayload], 'mihon_backup.json', { type: 'application/json' });
      fireEvent.change(fileInput, { target: { files: [file] } });

      await waitFor(() => {
        expect(screen.getByTestId('start-import-btn')).toBeDefined();
      });

      fireEvent.click(screen.getByTestId('start-import-btn'));

      // Verify success message appears after progress completes
      await waitFor(() => {
        expect(screen.getByTestId('import-success-msg')).toBeDefined();
        expect(screen.getByText(/¡Migración completada con éxito!/i)).toBeDefined();
      });

      expect(onImportComplete).toHaveBeenCalled();

      // Verify item was recorded into local storage
      const progress = await localClientStorage.getProgress('tower-of-god');
      expect(progress).toBeDefined();
      expect(progress?.pageNumber).toBe(20);
    });

    it('displays error message when an invalid JSON file is selected', async () => {
      render(<BackupModal isOpen={true} onClose={vi.fn()} />);

      fireEvent.click(screen.getByTestId('tab-import'));

      const fileInput = screen.getByTestId('backup-file-input') as HTMLInputElement;
      const file = new File(['{ corrupt: json'], 'broken.json', { type: 'application/json' });

      fireEvent.change(fileInput, { target: { files: [file] } });

      await waitFor(() => {
        expect(screen.getByText(/El archivo seleccionado no tiene un formato de respaldo válido/i)).toBeDefined();
      });
    });
  });

  describe('Navbar Integration', () => {
    it('renders Respaldos button in Navbar and calls onOpenBackup on click', () => {
      const onOpenBackup = vi.fn();
      render(<Navbar currentView="catalog" onOpenBackup={onOpenBackup} />);

      const backupBtn = screen.getByTestId('nav-backup-btn');
      expect(backupBtn).toBeDefined();
      expect(screen.getByText('Respaldos')).toBeDefined();

      fireEvent.click(backupBtn);
      expect(onOpenBackup).toHaveBeenCalledTimes(1);
    });
  });
});
