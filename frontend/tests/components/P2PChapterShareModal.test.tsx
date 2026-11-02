import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  P2PChapterShareModal,
  PeerDevice,
  TransferProgress
} from '../../src/components/p2p/P2PChapterShareModal.js';

describe('P2PChapterShareModal Component Unit Suite (Sprint 44)', () => {
  const mockPeers: PeerDevice[] = [
    { id: 'peer-1', name: 'Pixel 7', ipAddress: '192.168.1.15', signalStrength: 'strong' },
    { id: 'peer-2', name: 'iPad Air', ipAddress: '192.168.1.28', signalStrength: 'medium' }
  ];

  it('renders discovery radar with device PIN and lists local peers', () => {
    const onSelectPeerMock = vi.fn();

    render(
      <P2PChapterShareModal
        isOpen={true}
        onClose={vi.fn()}
        mode="discover"
        pinCode="482910"
        peers={mockPeers}
        onSelectPeer={onSelectPeerMock}
        onAcceptIncoming={vi.fn()}
        onRejectIncoming={vi.fn()}
        onCancelTransfer={vi.fn()}
      />
    );

    expect(screen.getByText('Radar P2P: Dispositivos Cercanos')).toBeDefined();
    expect(screen.getByText('482910')).toBeDefined();
    expect(screen.getByText('Pixel 7')).toBeDefined();
    expect(screen.getByText('iPad Air')).toBeDefined();

    // Click connect on first peer
    const connectButtons = screen.getAllByText('Conectar');
    fireEvent.click(connectButtons[0]);
    expect(onSelectPeerMock).toHaveBeenCalledWith('peer-1');
  });

  it('renders incoming request mode and triggers acceptance', () => {
    const onAcceptMock = vi.fn();
    const onRejectMock = vi.fn();

    render(
      <P2PChapterShareModal
        isOpen={true}
        onClose={vi.fn()}
        mode="incoming"
        peers={[]}
        incomingRequest={{
          deviceName: 'Samsung Galaxy Tab',
          chapterTitle: 'Solo Leveling Ch. 42',
          totalPages: 24,
          fileSizeMb: 5.4
        }}
        onSelectPeer={vi.fn()}
        onAcceptIncoming={onAcceptMock}
        onRejectIncoming={onRejectMock}
        onCancelTransfer={vi.fn()}
      />
    );

    expect(screen.getByText('Solicitud de Capítulo Entrante')).toBeDefined();
    expect(screen.getByText('Solo Leveling Ch. 42')).toBeDefined();
    expect(screen.getByText(/24 págs • 5.4 MB/)).toBeDefined();

    fireEvent.click(screen.getByText('Aceptar y Guardar'));
    expect(onAcceptMock).toHaveBeenCalled();
  });

  it('renders active WebRTC chunk transfer progress', () => {
    const progress: TransferProgress = {
      fileName: 'Solo Leveling - Capítulo 42.cbz',
      fileSizeMb: 5.4,
      completedPages: 12,
      totalPages: 24,
      speedMbS: 4.8,
      percentage: 50
    };

    render(
      <P2PChapterShareModal
        isOpen={true}
        onClose={vi.fn()}
        mode="transferring"
        peers={[]}
        transferProgress={progress}
        onSelectPeer={vi.fn()}
        onAcceptIncoming={vi.fn()}
        onRejectIncoming={vi.fn()}
        onCancelTransfer={vi.fn()}
      />
    );

    expect(screen.getByText('Transfiriendo Capítulo vía WebRTC...')).toBeDefined();
    expect(screen.getByText('Solo Leveling - Capítulo 42.cbz')).toBeDefined();
    expect(screen.getByText('4.8 MB/s')).toBeDefined();
    expect(screen.getByText('Páginas: 12 / 24')).toBeDefined();
  });

  it('closes on Escape key press or close button click', () => {
    const onCloseMock = vi.fn();

    render(
      <P2PChapterShareModal
        isOpen={true}
        onClose={onCloseMock}
        mode="discover"
        peers={[]}
        onSelectPeer={vi.fn()}
        onAcceptIncoming={vi.fn()}
        onRejectIncoming={vi.fn()}
        onCancelTransfer={vi.fn()}
      />
    );

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onCloseMock).toHaveBeenCalled();
  });
});
