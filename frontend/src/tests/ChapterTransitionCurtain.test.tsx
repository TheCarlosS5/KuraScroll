import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ChapterTransitionCurtain } from '../components/reader/ChapterTransitionCurtain';

describe('Sprint 79 - ChapterTransitionCurtain Component Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders null when both isCurtainVisible and isOpen are false', () => {
    const { container } = render(
      <ChapterTransitionCurtain
        isCurtainVisible={false}
        nextChapter={null}
        autoAdvanceProgress={0}
        onAdvanceImmediately={vi.fn()}
        onDismissCurtain={vi.fn()}
        isOpen={false}
        onClose={vi.fn()}
        isEnabled={true}
        transitionStyle="curtain"
        prebakeTriggerPageOffset={3}
        autoAdvanceDelayMs={1500}
        showReadingSummary={true}
        onToggleEnabled={vi.fn()}
        onChangeStyle={vi.fn()}
        onChangeOffset={vi.fn()}
        onChangeDelayMs={vi.fn()}
        onToggleShowSummary={vi.fn()}
        onResetToDefaults={vi.fn()}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it('renders visual curtain dialog when isCurtainVisible is true', () => {
    render(
      <ChapterTransitionCurtain
        isCurtainVisible={true}
        nextChapter={{
          id: 'chap-2',
          title: 'Batalla en las Sombras',
          chapterNumber: 2,
          estimatedReadMinutes: 4,
        }}
        autoAdvanceProgress={40}
        onAdvanceImmediately={vi.fn()}
        onDismissCurtain={vi.fn()}
        isOpen={false}
        onClose={vi.fn()}
        isEnabled={true}
        transitionStyle="curtain"
        prebakeTriggerPageOffset={3}
        autoAdvanceDelayMs={1500}
        showReadingSummary={true}
        onToggleEnabled={vi.fn()}
        onChangeStyle={vi.fn()}
        onChangeOffset={vi.fn()}
        onChangeDelayMs={vi.fn()}
        onToggleShowSummary={vi.fn()}
        onResetToDefaults={vi.fn()}
      />
    );

    expect(screen.getByRole('dialog')).toBeDefined();
    expect(screen.getByText(/Siguiente Capítulo/i)).toBeDefined();
    expect(screen.getByText(/Capítulo 2: Batalla en las Sombras/i)).toBeDefined();
    expect(screen.getByText(/~4 min de lectura estimada/i)).toBeDefined();
    expect(screen.getByText(/Continuar Lectura/i)).toBeDefined();
  });

  it('triggers onAdvanceImmediately when advance button is clicked', () => {
    const onAdvanceImmediately = vi.fn();

    render(
      <ChapterTransitionCurtain
        isCurtainVisible={true}
        nextChapter={{
          id: 'chap-2',
          title: 'Batalla',
          chapterNumber: 2,
        }}
        autoAdvanceProgress={50}
        onAdvanceImmediately={onAdvanceImmediately}
        onDismissCurtain={vi.fn()}
        isOpen={false}
        onClose={vi.fn()}
        isEnabled={true}
        transitionStyle="curtain"
        prebakeTriggerPageOffset={3}
        autoAdvanceDelayMs={1500}
        showReadingSummary={true}
        onToggleEnabled={vi.fn()}
        onChangeStyle={vi.fn()}
        onChangeOffset={vi.fn()}
        onChangeDelayMs={vi.fn()}
        onToggleShowSummary={vi.fn()}
        onResetToDefaults={vi.fn()}
      />
    );

    const advanceBtn = screen.getByText(/Continuar Lectura/i);
    fireEvent.click(advanceBtn);

    expect(onAdvanceImmediately).toHaveBeenCalled();
  });

  it('renders celebratory end screen when nextChapter is null (last chapter)', () => {
    render(
      <ChapterTransitionCurtain
        isCurtainVisible={true}
        nextChapter={null}
        autoAdvanceProgress={0}
        onAdvanceImmediately={vi.fn()}
        onDismissCurtain={vi.fn()}
        isOpen={false}
        onClose={vi.fn()}
        isEnabled={true}
        transitionStyle="curtain"
        prebakeTriggerPageOffset={3}
        autoAdvanceDelayMs={1500}
        showReadingSummary={true}
        onToggleEnabled={vi.fn()}
        onChangeStyle={vi.fn()}
        onChangeOffset={vi.fn()}
        onChangeDelayMs={vi.fn()}
        onToggleShowSummary={vi.fn()}
        onResetToDefaults={vi.fn()}
      />
    );

    expect(screen.getByText(/¡Capítulo Final Alcanzado!/i)).toBeDefined();
    expect(screen.getByText(/Volver a la Biblioteca/i)).toBeDefined();
  });

  it('renders configuration HUD when isOpen is true', () => {
    render(
      <ChapterTransitionCurtain
        isCurtainVisible={false}
        nextChapter={null}
        autoAdvanceProgress={0}
        onAdvanceImmediately={vi.fn()}
        onDismissCurtain={vi.fn()}
        isOpen={true}
        onClose={vi.fn()}
        isEnabled={true}
        transitionStyle="curtain"
        prebakeTriggerPageOffset={3}
        autoAdvanceDelayMs={1500}
        showReadingSummary={true}
        onToggleEnabled={vi.fn()}
        onChangeStyle={vi.fn()}
        onChangeOffset={vi.fn()}
        onChangeDelayMs={vi.fn()}
        onToggleShowSummary={vi.fn()}
        onResetToDefaults={vi.fn()}
      />
    );

    expect(screen.getByRole('dialog')).toBeDefined();
    expect(screen.getByText(/Transición de Capítulos/i)).toBeDefined();
    expect(screen.getByText('Scroll Infinito')).toBeDefined();
    expect(screen.getByText('3 págs antes')).toBeDefined();
    expect(screen.getByText(/activado/i)).toBeDefined();
  });
});
