/**
 * KuraScroll Sprint 100: VectorQuantizerHUD Component Tests
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { VectorQuantizerHUD } from '../components/reader/VectorQuantizerHUD';

describe('VectorQuantizerHUD Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders null when isVisible is false', () => {
    const { container } = render(
      <VectorQuantizerHUD
        isVisible={false}
        onClose={vi.fn()}
        mode="int8_quantized"
        onModeChange={vi.fn()}
        embeddingDimension={64}
        onEmbeddingDimensionChange={vi.fn()}
        similarityThreshold={0.75}
        onSimilarityThresholdChange={vi.fn()}
        maxTopK={5}
        onMaxTopKChange={vi.fn()}
        isSpoilerShieldActive={true}
        onToggleSpoilerShield={vi.fn()}
        candidateRevealChapter={25}
        userCurrentChapter={10}
        cosineSimilarity={0.92}
        isMatch={true}
        isSpoilerShielded={true}
        similarityPct={92}
        radarBarColor="#f59e0b"
        isEnabled={true}
        onToggleEnabled={vi.fn()}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it('renders correctly with telemetry and handles interactions when visible', () => {
    const onClose = vi.fn();
    const onModeChange = vi.fn();
    const onToggleEnabled = vi.fn();
    const onToggleSpoilerShield = vi.fn();
    const onSimilarityThresholdChange = vi.fn();

    render(
      <VectorQuantizerHUD
        isVisible={true}
        onClose={onClose}
        mode="int8_quantized"
        onModeChange={onModeChange}
        embeddingDimension={64}
        onEmbeddingDimensionChange={vi.fn()}
        similarityThreshold={0.75}
        onSimilarityThresholdChange={onSimilarityThresholdChange}
        maxTopK={5}
        onMaxTopKChange={vi.fn()}
        isSpoilerShieldActive={true}
        onToggleSpoilerShield={onToggleSpoilerShield}
        candidateRevealChapter={25}
        userCurrentChapter={10}
        cosineSimilarity={0.92}
        isMatch={true}
        isSpoilerShielded={true}
        similarityPct={92}
        radarBarColor="#f59e0b"
        isEnabled={true}
        onToggleEnabled={onToggleEnabled}
      />
    );

    expect(screen.getByRole('region', { name: /Vector Quantizer HUD/i })).toBeDefined();
    expect(screen.getByText('Vector Search & Spoiler Shield')).toBeDefined();
    expect(screen.getByText('[Q]')).toBeDefined();
    expect(screen.getByText('🛡️ SPOILER SHIELDED')).toBeDefined();
    expect(screen.getByText('0.75')).toBeDefined();
    expect(screen.getByText('64 dim')).toBeDefined();
    expect(screen.getAllByText('5').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('ACTIVE').length).toBeGreaterThanOrEqual(1);

    // Mode switch
    const compactBtn = screen.getByText('📦 Compact 32d');
    fireEvent.click(compactBtn);
    expect(onModeChange).toHaveBeenCalledWith('compact_scalar');

    // Spoiler shield toggle
    const shieldBtn = screen.getAllByText('ACTIVE')[0];
    fireEvent.click(shieldBtn);
    expect(onToggleSpoilerShield).toHaveBeenCalled();

    // Engine toggle
    const activeBtn = screen.getAllByText('ACTIVE')[1];
    fireEvent.click(activeBtn);
    expect(onToggleEnabled).toHaveBeenCalled();

    // Close button
    const closeBtn = screen.getByRole('button', { name: /Close HUD/i });
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalled();
  });
});
