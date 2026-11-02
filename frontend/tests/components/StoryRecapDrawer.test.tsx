import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  StoryRecapDrawer,
  CharacterStatusItem,
  KeyEventItem,
} from '../../src/components/reader/StoryRecapDrawer.js';

describe('StoryRecapDrawer Component Unit Suite (Sprint 48)', () => {
  const mockCharacters: CharacterStatusItem[] = [
    { id: 'luffy', name: 'Monkey D. Luffy', role: 'Capitán', status: 'active', affiliation: 'Sombreros de Paja' },
    { id: 'zoro', name: 'Roronoa Zoro', role: 'Espadachín', status: 'injured', notes: 'Gravemente herido en combate' },
    { id: 'ace', name: 'Portgas D. Ace', role: 'Comandante', status: 'captured', affiliation: 'Piratas de Barbablanca' },
  ];

  const mockKeyEvents: KeyEventItem[] = [
    { chapter: 96, title: 'Escape de Loguetown', description: 'Salvados por un rayo y tormenta', significance: 'pivotal' },
    { chapter: 101, title: 'Entrada a Grand Line', description: 'Descenso por Reverse Mountain', significance: 'major' },
  ];

  it('renders closed drawer correctly without displaying contents', () => {
    render(
      <StoryRecapDrawer
        isOpen={false}
        onClose={vi.fn()}
        arcTitle="East Blue Saga"
        throughChapterSeq={100}
        currentChapterNumber={105}
        summaryText="Resumen de East Blue"
      />
    );

    const drawer = screen.getByTestId('story-recap-drawer');
    expect(drawer.style.transform).toBe('translateX(100%)');
  });

  it('renders open drawer with anti-spoiler badge and summary content', () => {
    render(
      <StoryRecapDrawer
        isOpen={true}
        onClose={vi.fn()}
        arcTitle="East Blue Saga"
        throughChapterSeq={100}
        currentChapterNumber={105}
        summaryText="Resumen completo de East Blue antes de entrar a Grand Line."
        cliffhangerWarning="Ace se encuentra en la prisión de Impel Down."
      />
    );

    const drawer = screen.getByTestId('story-recap-drawer');
    expect(drawer.style.transform).toBe('translateX(0)');
    expect(screen.getByText('East Blue Saga')).toBeDefined();
    expect(screen.getByText(/100% Anti-Spoiler para Cap. 105/)).toBeDefined();
    expect(screen.getByText(/Resumen completo de East Blue/)).toBeDefined();
    expect(screen.getByText(/Ace se encuentra en la prisión de Impel Down/)).toBeDefined();
  });

  it('allows switching between Summary, Characters, and Timeline tabs', () => {
    render(
      <StoryRecapDrawer
        isOpen={true}
        onClose={vi.fn()}
        arcTitle="East Blue Saga"
        throughChapterSeq={100}
        currentChapterNumber={105}
        summaryText="Resumen de East Blue"
        characterStatuses={mockCharacters}
        keyEvents={mockKeyEvents}
      />
    );

    // Initial tab is summary
    expect(screen.getByTestId('recap-tab-content-summary')).toBeDefined();

    // Click Characters tab
    const charTab = screen.getByTestId('tab-characters');
    fireEvent.click(charTab);
    expect(screen.getByTestId('recap-tab-content-characters')).toBeDefined();
    expect(screen.getByText('Monkey D. Luffy')).toBeDefined();
    expect(screen.getByText('Roronoa Zoro')).toBeDefined();
    expect(screen.getByText('Portgas D. Ace')).toBeDefined();
    expect(screen.getByText('Herido')).toBeDefined();
    expect(screen.getByText('Capturado')).toBeDefined();

    // Click Timeline tab
    const timelineTab = screen.getByTestId('tab-timeline');
    fireEvent.click(timelineTab);
    expect(screen.getByTestId('recap-tab-content-timeline')).toBeDefined();
    expect(screen.getByText('Escape de Loguetown')).toBeDefined();
    expect(screen.getByText('Entrada a Grand Line')).toBeDefined();
  });

  it('triggers onClose when close button, continue reading button, or overlay is clicked', () => {
    const handleClose = vi.fn();
    render(
      <StoryRecapDrawer
        isOpen={true}
        onClose={handleClose}
        arcTitle="East Blue Saga"
        throughChapterSeq={100}
        currentChapterNumber={105}
        summaryText="Resumen"
      />
    );

    fireEvent.click(screen.getByTestId('recap-close-button'));
    expect(handleClose).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTestId('recap-continue-reading-btn'));
    expect(handleClose).toHaveBeenCalledTimes(2);

    fireEvent.click(screen.getByTestId('story-recap-overlay'));
    expect(handleClose).toHaveBeenCalledTimes(3);
  });

  it('triggers onDontShowAgain when button is clicked', () => {
    const handleDontShowAgain = vi.fn();
    render(
      <StoryRecapDrawer
        isOpen={true}
        onClose={vi.fn()}
        arcTitle="East Blue Saga"
        throughChapterSeq={100}
        currentChapterNumber={105}
        summaryText="Resumen"
        onDontShowAgain={handleDontShowAgain}
      />
    );

    fireEvent.click(screen.getByTestId('recap-dont-show-again-btn'));
    expect(handleDontShowAgain).toHaveBeenCalledTimes(1);
  });
});
