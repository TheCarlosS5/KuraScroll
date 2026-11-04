import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AnnotationDeckHUD, PageAnnotationItem } from '../../src/components/reader/AnnotationDeckHUD.js';
import { StickyNoteOverlay } from '../../src/components/reader/StickyNoteOverlay.js';

describe('AnnotationDeckHUD & StickyNoteOverlay Unit Tests (Sprint 52)', () => {
  const dummyAnnotations: PageAnnotationItem[] = [
    {
      id: 1,
      chapterId: 'chap_1',
      pageNumber: 3,
      userId: 'user_1',
      anchorX: 40.0,
      anchorY: 60.0,
      annotationType: 'sticky_note',
      contentText: 'Check the background shading here.',
      colorPreset: 'yellow',
      isSpoiler: false,
      createdAt: '2026-11-02T00:00:00Z',
    },
    {
      id: 2,
      chapterId: 'chap_1',
      pageNumber: 3,
      userId: 'user_2',
      anchorX: 75.0,
      anchorY: 25.0,
      annotationType: 'panel_bookmark',
      contentText: 'Crucial plot reveal spoiler!',
      colorPreset: 'pink',
      isSpoiler: true,
      createdAt: '2026-11-02T00:05:00Z',
    },
    {
      id: 3,
      chapterId: 'chap_1',
      pageNumber: 5,
      userId: 'user_3',
      anchorX: 10.0,
      anchorY: 10.0,
      annotationType: 'reaction',
      contentText: 'Hilarious facial expression',
      colorPreset: 'green',
      isSpoiler: false,
      createdAt: '2026-11-02T00:10:00Z',
    },
  ];

  it('renders AnnotationDeckHUD toggle button and drawer with annotations', () => {
    render(
      <AnnotationDeckHUD
        chapterId="chap_1"
        currentPageNumber={3}
        annotations={dummyAnnotations}
        isOpen={true}
        onToggleOpen={vi.fn()}
      />
    );

    expect(screen.getByTestId('annotation-deck-toggle')).toBeDefined();
    expect(screen.getByTestId('annotation-deck-drawer')).toBeDefined();
    expect(screen.getByTestId('annotation-item-1')).toBeDefined();
    expect(screen.getByTestId('annotation-item-2')).toBeDefined();
    expect(screen.getByTestId('annotation-item-3')).toBeDefined();
  });

  it('filters annotations by type', () => {
    render(
      <AnnotationDeckHUD
        chapterId="chap_1"
        currentPageNumber={3}
        annotations={dummyAnnotations}
        isOpen={true}
        onToggleOpen={vi.fn()}
      />
    );

    // Click filter for reactions
    fireEvent.click(screen.getByTestId('filter-tab-reaction'));
    expect(screen.queryByTestId('annotation-item-1')).toBeNull();
    expect(screen.queryByTestId('annotation-item-2')).toBeNull();
    expect(screen.getByTestId('annotation-item-3')).toBeDefined();
  });

  it('censors spoiler content and reveals upon user interaction', () => {
    render(
      <AnnotationDeckHUD
        chapterId="chap_1"
        currentPageNumber={3}
        annotations={dummyAnnotations}
        isOpen={true}
        onToggleOpen={vi.fn()}
      />
    );

    const spoilerCensored = screen.getByTestId('spoiler-censored-2');
    expect(spoilerCensored).toBeDefined();
    expect(screen.queryByText('Crucial plot reveal spoiler!')).toBeNull();

    // Click to reveal
    fireEvent.click(spoilerCensored);
    expect(screen.getByText('Crucial plot reveal spoiler!')).toBeDefined();
  });

  it('submits create annotation form', () => {
    const handleCreate = vi.fn();
    render(
      <AnnotationDeckHUD
        chapterId="chap_1"
        currentPageNumber={3}
        annotations={dummyAnnotations}
        isOpen={true}
        onToggleOpen={vi.fn()}
        onCreateAnnotation={handleCreate}
      />
    );

    const textarea = screen.getByPlaceholderText(/Escribe tu nota/i);
    fireEvent.change(textarea, { target: { value: 'New test annotation note' } });

    fireEvent.submit(screen.getByTestId('create-annotation-form'));
    expect(handleCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        pageNumber: 3,
        contentText: 'New test annotation note',
        annotationType: 'sticky_note',
        colorPreset: 'yellow',
        isSpoiler: false,
      })
    );
  });

  it('StickyNoteOverlay renders pins and toggles popup tooltip', () => {
    render(
      <StickyNoteOverlay
        pageNumber={3}
        annotations={dummyAnnotations}
        isEditable={false}
      />
    );

    expect(screen.getByTestId('sticky-overlay-page-3')).toBeDefined();
    expect(screen.getByTestId('annotation-pin-1')).toBeDefined();
    expect(screen.getByTestId('annotation-pin-2')).toBeDefined();
    expect(screen.queryByTestId('annotation-pin-3')).toBeNull(); // Page 5, not page 3

    // Click pin to open card
    fireEvent.click(screen.getByTestId('pin-marker-btn-1'));
    expect(screen.getByTestId('pin-card-1')).toBeDefined();
    expect(screen.getByText('Check the background shading here.')).toBeDefined();
  });

  it('StickyNoteOverlay triggers onCanvasClick in editable mode', () => {
    const handleCanvasClick = vi.fn();
    render(
      <StickyNoteOverlay
        pageNumber={3}
        annotations={dummyAnnotations}
        isEditable={true}
        onCanvasClick={handleCanvasClick}
      />
    );

    const overlay = screen.getByTestId('sticky-overlay-page-3');
    // Mock getBoundingClientRect
    vi.spyOn(overlay, 'getBoundingClientRect').mockReturnValue({
      left: 100,
      top: 100,
      width: 400,
      height: 600,
      right: 500,
      bottom: 700,
      x: 100,
      y: 100,
      toJSON: () => {},
    });

    fireEvent.click(overlay, { clientX: 300, clientY: 400 });
    expect(handleCanvasClick).toHaveBeenCalledWith({
      anchorX: 50,
      anchorY: 50,
    });
  });
});
