import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  SpeechBubbleOverlay,
  SpeechBubbleRecord
} from '../../src/components/reader/SpeechBubbleOverlay.js';

describe('SpeechBubbleOverlay Component Unit Suite (Sprint 46)', () => {
  const mockBubbles: SpeechBubbleRecord[] = [
    {
      id: 'b-1',
      index: 0,
      bbox: { x: 50, y: 20, width: 25, height: 30 },
      readingDirection: 'vertical',
      rawText: '鬼滅の刃',
      translations: {
        es: 'Cazador de Demonios',
        en: 'Demon Slayer'
      },
      ruby: [
        { base: '鬼滅', ruby: 'きめつ' },
        { base: 'の', ruby: null },
        { base: '刃', ruby: 'やいば' }
      ],
      confidence: 0.99
    }
  ];

  it('renders speech bubble overlay with ruby furigana tags in furigana mode', () => {
    render(
      <SpeechBubbleOverlay
        bubbles={mockBubbles}
        mode="furigana"
        showModeSelector={true}
      />
    );

    expect(screen.getByTestId('speech-bubble-overlay')).toBeDefined();
    expect(screen.getByTestId('bubble-box-b-1')).toBeDefined();
    expect(screen.getByText('きめつ')).toBeDefined();
    expect(screen.getByText('やいば')).toBeDefined();
  });

  it('renders Spanish translated text when mode is es', () => {
    render(
      <SpeechBubbleOverlay
        bubbles={mockBubbles}
        mode="es"
      />
    );

    expect(screen.getByText('Cazador de Demonios')).toBeDefined();
    expect(screen.queryByText('きめつ')).toBeNull();
  });

  it('renders English translated text when mode is en', () => {
    render(
      <SpeechBubbleOverlay
        bubbles={mockBubbles}
        mode="en"
      />
    );

    expect(screen.getByText('Demon Slayer')).toBeDefined();
    expect(screen.queryByText('きめつ')).toBeNull();
  });

  it('renders raw text when mode is raw', () => {
    render(
      <SpeechBubbleOverlay
        bubbles={mockBubbles}
        mode="raw"
      />
    );

    expect(screen.getByText('鬼滅の刃')).toBeDefined();
  });

  it('hides bubbles when mode is off', () => {
    const { container } = render(
      <SpeechBubbleOverlay
        bubbles={mockBubbles}
        mode="off"
        showModeSelector={false}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it('triggers onSelectBubble when clicking a speech bubble', () => {
    const onSelectBubble = vi.fn();
    render(
      <SpeechBubbleOverlay
        bubbles={mockBubbles}
        mode="furigana"
        onSelectBubble={onSelectBubble}
      />
    );

    const bubbleBox = screen.getByTestId('bubble-box-b-1');
    fireEvent.click(bubbleBox);

    expect(onSelectBubble).toHaveBeenCalledTimes(1);
    expect(onSelectBubble).toHaveBeenCalledWith(mockBubbles[0]);
  });

  it('triggers onModeChange when clicking mode selector buttons', () => {
    const onModeChange = vi.fn();
    render(
      <SpeechBubbleOverlay
        bubbles={mockBubbles}
        mode="furigana"
        showModeSelector={true}
        onModeChange={onModeChange}
      />
    );

    const esBtn = screen.getByTestId('mode-es');
    fireEvent.click(esBtn);

    expect(onModeChange).toHaveBeenCalledWith('es');
  });
});
