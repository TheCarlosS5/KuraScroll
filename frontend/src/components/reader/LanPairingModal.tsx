/**
 * KuraScroll LAN Companion Pairing Modal
 * Sprint 69 - Direct Mobile QR Code Bridge for Home Wi-Fi
 *
 * Hardware-tuned for Intel GMA 4500MHD:
 * Zero CSS blur, zero backdrop-filter, pure solid containment #18181b, CLS = 0.
 */

import React, { useState } from 'react';
import { UseLanCompanionResult } from '../../reader/useLanCompanion';

export interface LanPairingModalProps {
  companion: UseLanCompanionResult;
  className?: string;
}

export const LanPairingModal: React.FC<LanPairingModalProps> = ({
  companion,
  className = '',
}) => {
  const {
    isOpen,
    isLoading,
    qrSvg,
    pairingUrl,
    lanIp,
    port,
    activeDevices,
    error,
    closeModal,
    refreshQr,
    revokeDevice,
  } = companion;

  const [copied, setCopied] = useState<boolean>(false);

  if (!isOpen) {
    return null;
  }

  const handleCopyUrl = async () => {
    if (pairingUrl) {
      try {
        await navigator.clipboard.writeText(pairingUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        // Fallback
      }
    }
  };

  return (
    <div
      data-testid="lan-pairing-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 select-none"
      onClick={closeModal}
      role="dialog"
      aria-modal="true"
      aria-label="Emparejar dispositivo móvil por código QR"
    >
      <div
        data-testid="lan-pairing-modal-card"
        className={`w-full max-w-md p-6 rounded-xl border border-zinc-800 text-zinc-200 ${className}`}
        style={{
          backgroundColor: '#18181b',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.8)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded bg-indigo-600 font-bold text-white text-xs flex items-center justify-center">
              KS
            </span>
            <h2 className="text-base font-semibold text-zinc-100">
              Conectar Móvil (LAN Companion)
            </h2>
          </div>
          <button
            type="button"
            data-testid="close-modal-btn"
            onClick={closeModal}
            className="text-zinc-400 hover:text-white p-1 rounded transition-colors"
            title="Cerrar modal (Esc)"
           aria-label="Cerrar">&times;</button>
        </div>

        {/* Body */}
        <div className="py-5 flex flex-col items-center text-center">
          {isLoading ? (
            <div data-testid="qr-loading-spinner" className="h-56 flex items-center justify-center">
              <span className="text-zinc-400 animate-pulse">Generando código QR seguro...</span>
            </div>
          ) : qrSvg ? (
            <div
              data-testid="qr-code-container"
              className="p-3 bg-white rounded-lg shadow-inner mb-4"
              dangerouslySetInnerHTML={{ __html: qrSvg }}
            />
          ) : (
            <div className="h-56 flex items-center justify-center text-amber-400 text-sm">
              {error || 'No se pudo cargar el código QR.'}
            </div>
          )}

          <p className="text-xs text-zinc-400 max-w-xs mb-3">
            Apunta la cámara de tu smartphone o tablet a este código QR para abrir el lector en tu red Wi-Fi sin instalar ninguna aplicación.
          </p>

          {/* Local network address */}
          {lanIp && (
            <div className="w-full bg-zinc-900 border border-zinc-800 rounded p-2.5 flex items-center justify-between text-xs font-mono text-zinc-300">
              <span className="truncate mr-2">
                http://{lanIp}:{port}/companion/
              </span>
              <button
                type="button"
                data-testid="copy-url-btn"
                onClick={handleCopyUrl}
                className="px-2 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded text-[11px] font-sans font-medium transition-colors shrink-0"
              >
                {copied ? 'Copiado' : 'Copiar URL'}
              </button>
            </div>
          )}
        </div>

        {/* Active Paired Devices Section */}
        <div className="mt-2 pt-3 border-t border-zinc-800">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
              Dispositivos Conectados ({activeDevices.length})
            </span>
            <button
              type="button"
              data-testid="regenerate-qr-btn"
              onClick={refreshQr}
              className="text-xs text-indigo-400 hover:text-indigo-300 font-medium"
            >
              ↻ Nuevo QR
            </button>
          </div>

          {activeDevices.length === 0 ? (
            <p data-testid="no-devices-msg" className="text-xs text-zinc-500 py-2 text-center">
              Ningún dispositivo conectado actualmente.
            </p>
          ) : (
            <div data-testid="active-devices-list" className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
              {activeDevices.map((d) => (
                <div
                  key={d.pairingId}
                  data-testid={`device-row-${d.pairingId}`}
                  className="flex items-center justify-between p-2 rounded bg-zinc-900/60 border border-zinc-800 text-xs"
                >
                  <div className="flex flex-col text-left">
                    <span className="font-medium text-zinc-200">
                      {d.deviceName || 'Dispositivo Móvil'}
                    </span>
                    <span className="text-[11px] text-zinc-500 font-mono">
                      {d.clientIp} · Pág {d.activePageNumber}
                    </span>
                  </div>
                  <button
                    type="button"
                    data-testid={`revoke-btn-${d.pairingId}`}
                    onClick={() => revokeDevice(d.pairingId)}
                    className="px-2 py-1 bg-red-950/60 hover:bg-red-900 border border-red-800 text-red-300 text-[11px] rounded transition-colors"
                  >
                    Desconectar
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
