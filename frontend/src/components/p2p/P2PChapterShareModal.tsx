import React, { useEffect } from 'react';
import { Radio, QrCode, ArrowDownCircle, CheckCircle2, X, AlertTriangle, ShieldCheck } from 'lucide-react';

export type P2PModalMode = 'discover' | 'pairing' | 'transferring' | 'incoming' | 'complete';

export interface PeerDevice {
  id: string;
  name: string;
  ipAddress: string;
  signalStrength: 'strong' | 'medium' | 'weak';
}

export interface TransferProgress {
  fileName: string;
  fileSizeMb: number;
  completedPages: number;
  totalPages: number;
  speedMbS: number;
  percentage: number;
}

export interface P2PChapterShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: P2PModalMode;
  pinCode?: string;
  peers: PeerDevice[];
  incomingRequest?: {
    deviceName: string;
    chapterTitle: string;
    totalPages: number;
    fileSizeMb: number;
  };
  transferProgress?: TransferProgress;
  onSelectPeer: (peerId: string) => void;
  onAcceptIncoming: () => void;
  onRejectIncoming: () => void;
  onCancelTransfer: () => void;
}

export const P2PChapterShareModal: React.FC<P2PChapterShareModalProps> = ({
  isOpen,
  onClose,
  mode,
  pinCode,
  peers,
  incomingRequest,
  transferProgress,
  onSelectPeer,
  onAcceptIncoming,
  onRejectIncoming,
  onCancelTransfer,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      style={{ contain: 'layout paint' }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="p2p-modal-title"
    >
      <div className="bg-[var(--reader-card-bg,#18181B)] border border-[var(--reader-border,#27272A)] rounded-2xl w-full max-w-lg p-6 text-gray-100 shadow-2xl">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <Radio className="w-5 h-5 text-cyan-400 animate-pulse" />
            <h2 id="p2p-modal-title" className="text-lg font-bold text-gray-100">
              {mode === 'discover' && 'Radar P2P: Dispositivos Cercanos'}
              {mode === 'pairing' && 'Emparejamiento Directo (Sin Internet)'}
              {mode === 'transferring' && 'Transfiriendo Capítulo vía WebRTC...'}
              {mode === 'incoming' && 'Solicitud de Capítulo Entrante'}
              {mode === 'complete' && 'Transferencia Completada'}
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar modal"
            className="p-1.5 text-gray-400 hover:text-gray-200 hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode 1: Discovery Radar */}
        {mode === 'discover' && (
          <div className="space-y-4">
            <p className="text-xs text-gray-400">
              Buscando lectores en la red LAN o WiFi Direct. Conexión directa sin intermediarios.
            </p>
            {pinCode && (
              <div className="p-3 bg-zinc-900 border border-zinc-800 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-gray-400 uppercase tracking-wider block">Código PIN del Dispositivo</span>
                  <span className="font-mono text-xl font-bold tracking-widest text-cyan-400">{pinCode}</span>
                </div>
                <QrCode className="w-8 h-8 text-zinc-500" />
              </div>
            )}
            <div className="space-y-2 max-h-56 overflow-y-auto">
              {peers.length === 0 ? (
                <div className="p-6 text-center text-xs text-zinc-500 border border-dashed border-zinc-800 rounded-xl">
                  Buscando dispositivos en la red local...
                </div>
              ) : (
                peers.map((peer) => (
                  <div
                    key={peer.id}
                    className="flex items-center justify-between p-3 bg-zinc-900/80 rounded-xl border border-zinc-800 hover:border-zinc-700 transition-colors"
                  >
                    <div>
                      <h3 className="text-sm font-semibold text-gray-200">{peer.name}</h3>
                      <p className="text-[10px] text-gray-400 font-mono">{peer.ipAddress}</p>
                    </div>
                    <button
                      onClick={() => onSelectPeer(peer.id)}
                      className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-semibold transition-colors"
                    >
                      Conectar
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Mode 2: Incoming Request Toast */}
        {mode === 'incoming' && incomingRequest && (
          <div className="p-4 bg-zinc-900/90 rounded-xl border border-cyan-800/80 space-y-4">
            <div className="flex items-center gap-2 text-cyan-400 text-xs font-semibold">
              <ShieldCheck className="w-4 h-4" />
              <span>Transferencia Local Autenticada</span>
            </div>
            <p className="text-sm text-gray-200">
              Dispositivo <strong className="text-cyan-300">'{incomingRequest.deviceName}'</strong> quiere compartir:
            </p>
            <div className="p-3 bg-black/60 rounded-lg border border-zinc-800">
              <h3 className="font-bold text-sm text-gray-100">{incomingRequest.chapterTitle}</h3>
              <p className="text-xs text-gray-400 mt-1">
                {incomingRequest.totalPages} págs • {incomingRequest.fileSizeMb.toFixed(1)} MB
              </p>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={onRejectIncoming}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-gray-300 rounded-lg text-xs font-medium transition-colors"
              >
                Rechazar
              </button>
              <button
                onClick={onAcceptIncoming}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5"
              >
                <ArrowDownCircle className="w-3.5 h-3.5" />
                Aceptar y Guardar
              </button>
            </div>
          </div>
        )}

        {/* Mode 3: Transferring via WebRTC Chunks */}
        {mode === 'transferring' && transferProgress && (
          <div className="space-y-4">
            <div className="flex justify-between text-xs text-gray-300">
              <span className="truncate max-w-[240px] font-medium">{transferProgress.fileName}</span>
              <span className="text-cyan-400 font-mono">{transferProgress.speedMbS.toFixed(1)} MB/s</span>
            </div>
            <div className="w-full bg-zinc-800 h-3 rounded-full overflow-hidden">
              <div
                className="bg-cyan-500 h-full transition-all duration-200"
                style={{ width: `${transferProgress.percentage}%` }}
              />
            </div>
            <div className="flex justify-between text-[11px] text-gray-400">
              <span>Páginas: {transferProgress.completedPages} / {transferProgress.totalPages}</span>
              <span className="font-mono">{transferProgress.percentage}%</span>
            </div>
            <div className="flex justify-end pt-2">
              <button
                onClick={onCancelTransfer}
                className="px-4 py-2 bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-800 rounded-lg text-xs font-medium transition-colors"
              >
                Cancelar Transferencia
              </button>
            </div>
          </div>
        )}

        {/* Mode 4: Complete */}
        {mode === 'complete' && (
          <div className="p-6 text-center space-y-4">
            <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
            <h3 className="text-base font-bold text-gray-100">Capítulo Guardado en la Biblioteca</h3>
            <p className="text-xs text-gray-400">
              El capítulo ha sido verificado con checksum SHA256 y está disponible para lectura offline sin internet.
            </p>
            <button
              onClick={onClose}
              className="px-5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-semibold transition-colors"
            >
              Cerrar y Continuar
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
