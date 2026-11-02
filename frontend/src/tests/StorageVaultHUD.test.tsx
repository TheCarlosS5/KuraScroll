import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StorageVaultHUD } from '../components/reader/StorageVaultHUD';
import { OfflineChapterItem } from '../reader/useStorageVault';

describe('Sprint 72 - StorageVaultHUD Component Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const sampleChapters: OfflineChapterItem[] = [
    {
      id: 'c1',
      seriesTitle: 'Solo Leveling',
      chapterNumber: 1,
      sizeMb: 25,
      status: 'unread',
      isPinned: false,
    },
    {
      id: 'c2',
      seriesTitle: 'Tower of God',
      chapterNumber: 10,
      sizeMb: 50,
      status: 'pinned',
      isPinned: true,
    },
  ];

  it('renders null when isOpen is false', () => {
    const { container } = render(
      <StorageVaultHUD
        isOpen={false}
        onClose={vi.fn()}
        usedBytes={100 * 1024 * 1024}
        totalBytes={1073741824}
        thresholdPercent={75}
        chapters={sampleChapters}
        onTogglePin={vi.fn()}
        onDeleteChapter={vi.fn()}
        onQuickCleanup={vi.fn()}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it('renders modal with title, quota progress bar, and chapters when isOpen is true', () => {
    render(
      <StorageVaultHUD
        isOpen={true}
        onClose={vi.fn()}
        usedBytes={500 * 1024 * 1024} // 0.49 GB
        totalBytes={1073741824} // 1.00 GB -> ~47%
        thresholdPercent={75}
        chapters={sampleChapters}
        onTogglePin={vi.fn()}
        onDeleteChapter={vi.fn()}
        onQuickCleanup={vi.fn()}
      />
    );

    expect(screen.getByTestId('storage-vault-modal')).toBeDefined();
    expect(screen.getByText(/Bóveda Offline & Cuota/i)).toBeDefined();
    expect(screen.getByTestId('quota-progress-bar')).toBeDefined();

    expect(screen.getByTestId('chapter-item-c1')).toBeDefined();
    expect(screen.getByText(/Solo Leveling - Cap. 1/i)).toBeDefined();
    expect(screen.getByText('25 MB')).toBeDefined();

    expect(screen.getByTestId('chapter-item-c2')).toBeDefined();
    expect(screen.getByText(/Tower of God - Cap. 10/i)).toBeDefined();
    expect(screen.getByText('50 MB')).toBeDefined();
  });

  it('displays warning style on progress bar when over threshold', () => {
    render(
      <StorageVaultHUD
        isOpen={true}
        onClose={vi.fn()}
        usedBytes={850 * 1024 * 1024} // ~80%
        totalBytes={1073741824}
        thresholdPercent={75}
        chapters={sampleChapters}
        onTogglePin={vi.fn()}
        onDeleteChapter={vi.fn()}
        onQuickCleanup={vi.fn()}
      />
    );

    const bar = screen.getByTestId('quota-progress-bar');
    expect(bar.className).toContain('bg-amber-500');
  });

  it('calls onTogglePin when pin button is clicked', () => {
    const handleTogglePin = vi.fn();
    render(
      <StorageVaultHUD
        isOpen={true}
        onClose={vi.fn()}
        usedBytes={100 * 1024 * 1024}
        totalBytes={1073741824}
        thresholdPercent={75}
        chapters={sampleChapters}
        onTogglePin={handleTogglePin}
        onDeleteChapter={vi.fn()}
        onQuickCleanup={vi.fn()}
      />
    );

    const pinBtn = screen.getByTestId('pin-btn-c1');
    fireEvent.click(pinBtn);
    expect(handleTogglePin).toHaveBeenCalledWith('c1');
  });

  it('calls onDeleteChapter when delete button is clicked', () => {
    const handleDeleteChapter = vi.fn();
    render(
      <StorageVaultHUD
        isOpen={true}
        onClose={vi.fn()}
        usedBytes={100 * 1024 * 1024}
        totalBytes={1073741824}
        thresholdPercent={75}
        chapters={sampleChapters}
        onTogglePin={vi.fn()}
        onDeleteChapter={handleDeleteChapter}
        onQuickCleanup={vi.fn()}
      />
    );

    const delBtn = screen.getByTestId('delete-btn-c1');
    fireEvent.click(delBtn);
    expect(handleDeleteChapter).toHaveBeenCalledWith('c1');
  });

  it('calls onQuickCleanup when cleanup button is clicked', () => {
    const handleQuickCleanup = vi.fn();
    render(
      <StorageVaultHUD
        isOpen={true}
        onClose={vi.fn()}
        usedBytes={100 * 1024 * 1024}
        totalBytes={1073741824}
        thresholdPercent={75}
        chapters={sampleChapters}
        onTogglePin={vi.fn()}
        onDeleteChapter={vi.fn()}
        onQuickCleanup={handleQuickCleanup}
      />
    );

    const cleanupBtn = screen.getByTestId('quick-cleanup-btn');
    fireEvent.click(cleanupBtn);
    expect(handleQuickCleanup).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when close button is clicked or Escape key is pressed', () => {
    const handleClose = vi.fn();
    render(
      <StorageVaultHUD
        isOpen={true}
        onClose={handleClose}
        usedBytes={100 * 1024 * 1024}
        totalBytes={1073741824}
        thresholdPercent={75}
        chapters={sampleChapters}
        onTogglePin={vi.fn()}
        onDeleteChapter={vi.fn()}
        onQuickCleanup={vi.fn()}
      />
    );

    const closeBtn = screen.getByTestId('vault-close-btn');
    fireEvent.click(closeBtn);
    expect(handleClose).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(handleClose).toHaveBeenCalledTimes(2);
  });

  it('renders empty message when chapters array is empty', () => {
    render(
      <StorageVaultHUD
        isOpen={true}
        onClose={vi.fn()}
        usedBytes={0}
        totalBytes={1073741824}
        thresholdPercent={75}
        chapters={[]}
        onTogglePin={vi.fn()}
        onDeleteChapter={vi.fn()}
        onQuickCleanup={vi.fn()}
      />
    );

    expect(screen.getByText(/No hay capítulos guardados offline en la bóveda/i)).toBeDefined();
  });
});
