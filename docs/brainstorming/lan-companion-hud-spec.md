# Sprint 69: LAN Companion Sync & Zero-Config Mobile Reader Bridge

> [!IMPORTANT]
> Especificación técnica para el emparejamiento QR en escritorio y la vista del lector companion móvil, optimizado para la GPU Intel GMA 4500MHD con **CLS = 0**.

---

## 1. `LanPairingModal.tsx` - Modal de Emparejamiento en Escritorio

```tsx
export interface PairedDevice {
  id: string;
  name: string;
  lastConnected: string;
}

export interface LanPairingModalProps {
  isOpen: boolean;
  onClose: () => void;
  localUrl: string;
  qrCodeSvg: string; // SVG string o URL del código QR
  pairedDevices: PairedDevice[];
  onRevokeDevice: (deviceId: string) => void;
}
```

### Layout JSX & Estilos Sólidos (GMA 4500MHD Safe):
```tsx
import React from 'react';

export const LanPairingModal: React.FC<LanPairingModalProps> = ({
  isOpen,
  onClose,
  localUrl,
  qrCodeSvg,
  pairedDevices,
  onRevokeDevice,
}) => {
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      style={{ contain: 'layout paint' }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="lan-pairing-title"
    >
      <div className="bg-[#18181b] border border-[#27272a] rounded-2xl w-full max-w-lg p-6 text-gray-100 shadow-2xl">
        <div className="flex justify-between items-center mb-4">
          <h2 id="lan-pairing-title" className="text-sm font-bold text-indigo-400">
            Emparejamiento LAN & Companion Móvil
          </h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-200">✕</button>
        </div>

        {/* Sección QR y URL Local */}
        <div className="flex flex-col sm:flex-row items-center gap-6 my-6 p-4 bg-zinc-900 rounded-xl border border-zinc-800">
          <div className="w-32 h-32 bg-white p-2 rounded-lg flex items-center justify-center shrink-0">
            {/* Contenedor del Código QR */}
            <div dangerouslySetInnerHTML={{ __html: qrCodeSvg }} className="w-full h-full" />
          </div>
          <div className="flex flex-col gap-2 min-w-0">
            <span className="text-xs text-zinc-400">Escanea el código QR con la cámara de tu móvil o abre este enlace en tu red local:</span>
            <code className="px-3 py-1.5 bg-black/50 border border-zinc-800 rounded-lg text-xs font-mono text-indigo-300 break-all select-all">
              {localUrl}
            </code>
          </div>
        </div>

        {/* Lista de Dispositivos Emparejados */}
        <div>
          <h3 className="text-xs font-bold text-zinc-300 uppercase tracking-wider mb-3">Dispositivos Emparejados</h3>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {pairedDevices.length === 0 ? (
              <p className="text-xs text-zinc-500 py-2">No hay dispositivos móviles vinculados.</p>
            ) : (
              pairedDevices.map((dev) => (
                <div key={dev.id} className="flex items-center justify-between p-2.5 bg-zinc-900/60 rounded-xl border border-zinc-800">
                  <div>
                    <h4 className="text-xs font-semibold text-gray-200">{dev.name}</h4>
                    <span className="text-[10px] text-zinc-500">Última conexión: {dev.lastConnected}</span>
                  </div>
                  <button
                    onClick={() => onRevokeDevice(dev.id)}
                    className="px-2.5 py-1 bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-800 rounded-lg text-[10px] font-medium transition-colors cursor-pointer"
                  >
                    Revocar
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
```

---

## 2. `CompanionReaderView.tsx` - Interfaz del Lector Móvil

```tsx
export interface CompanionReaderViewProps {
  seriesTitle: string;
  chapterNumber: number;
  currentPage: number;
  totalPages: number;
  imageUrl: string;
  batteryLevel?: number; // e.g. 20 (%)
  isSyncing: boolean;
  onNextPage: () => void;
  onPrevPage: () => void;
}

export const CompanionReaderView: React.FC<CompanionReaderViewProps> = ({
  seriesTitle,
  chapterNumber,
  currentPage,
  totalPages,
  imageUrl,
  batteryLevel,
  isSyncing,
  onNextPage,
  onPrevPage,
}) => {
  return (
    <div 
      className="flex flex-col h-screen bg-[#18181b] text-gray-100 select-none overflow-hidden"
      style={{ contain: 'layout paint' }}
    >
      {/* Barra Superior Mínima */}
      <header className="flex items-center justify-between px-4 h-12 bg-zinc-900 border-b border-zinc-800 shrink-0">
        <div className="min-w-0">
          <h1 className="text-xs font-bold text-gray-200 truncate">{seriesTitle}</h1>
          <span className="text-[10px] text-zinc-400">Cap. {chapterNumber} • Pág {currentPage}/{totalPages}</span>
        </div>

        <div className="flex items-center gap-3">
          {isSyncing && <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" title="Sincronizando..." />}
          {batteryLevel !== undefined && batteryLevel <= 20 && (
            <span className="text-[10px] text-amber-400 font-mono">🔋 {batteryLevel}%</span>
          )}
        </div>
      </header>

      {/* Visor de Página Táctil */}
      <main 
        className="flex-1 relative flex items-center justify-center p-2 overflow-hidden"
        onClick={(e) => {
          const x = e.clientX;
          const mid = window.innerWidth / 2;
          if (x > mid) onNextPage();
          else onPrevPage();
        }}
      >
        <img 
          src={imageUrl} 
          alt={`Página ${currentPage}`} 
          className="max-h-full max-w-full object-contain"
          loading="eager"
          decoding="async"
        />
      </main>
    </div>
  );
};
```
