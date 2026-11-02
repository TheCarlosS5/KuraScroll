import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DialogueJumpHUD } from '../components/reader/DialogueJumpHUD.js';

describe('Sprint 60 - DialogueJumpHUD Component Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('does not render when isOpen is false', () => {
    render(
      <DialogueJumpHUD
        isOpen={false}
        onClose={vi.fn()}
        onJumpToBubble={vi.fn()}
      />
    );

    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('renders modal dialog when isOpen is true with input and controls', () => {
    render(
      <DialogueJumpHUD
        isOpen={true}
        onClose={vi.fn()}
        onJumpToBubble={vi.fn()}
      />
    );

    expect(screen.getByRole('dialog')).toBeDefined();
    expect(screen.getByPlaceholderText('Buscar frase, diálogo o personaje (CJK o texto)...')).toBeDefined();
    expect(screen.getByText('🛡️ Protección Anti-Spoiler')).toBeDefined();
  });

  it('calls onClose when ESC button is clicked or Escape key pressed', () => {
    const handleClose = vi.fn();
    render(
      <DialogueJumpHUD
        isOpen={true}
        onClose={handleClose}
        onJumpToBubble={vi.fn()}
      />
    );

    fireEvent.click(screen.getByLabelText('Cerrar buscador'));
    expect(handleClose).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(handleClose).toHaveBeenCalledTimes(2);
  });

  it('toggles anti-spoiler protection checkbox', () => {
    render(
      <DialogueJumpHUD
        isOpen={true}
        onClose={vi.fn()}
        onJumpToBubble={vi.fn()}
      />
    );

    const checkbox = screen.getByRole('checkbox') as HTMLInputElement;
    expect(checkbox.checked).toBe(true);

    fireEvent.click(checkbox);
    expect(checkbox.checked).toBe(false);
  });
});
