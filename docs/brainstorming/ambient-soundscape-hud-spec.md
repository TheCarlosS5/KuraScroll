# Sprint 73: Ambient Soundscapes Mixer (`AmbientSoundscapeHUD.tsx`)

> [!IMPORTANT]
> Especificación técnica para el mezclador de paisajes sonoros atmosféricos, optimizado para la GPU Intel GMA 4500MHD con **CLS = 0**.

---

## 1. Especificación de Pistas & Props

```tsx
export type SoundscapeTrackId = 'rain' | 'campfire' | 'wind' | 'tavern' | 'mystery' | 'lofi_zen';

export interface SoundscapeTrack {
  id: SoundscapeTrackId;
  name: string;
  icon: string;
  volume: number; // 0 a 100
  isPlaying: boolean;
}

export interface AmbientSoundscapeHUDProps {
  isOpen: boolean;
  onClose: () => void;
  masterVolume: number;
  isMuted: boolean;
  tracks: SoundscapeTrack[];
  onToggleMasterMute: () => void;
  onChangeMasterVolume: (vol: number) => void;
  onChangeTrackVolume: (trackId: SoundscapeTrackId, vol: number) => void;
  onToggleTrackPlay: (trackId: SoundscapeTrackId) => void;
}
```

---

## 2. Estilos CSS & Animación de Onda sin Blur (Intel GMA 4500MHD)

```css
@keyframes sound-pulse {
  0%, 100% { transform: scaleY(0.4); }
  50% { transform: scaleY(1); }
}

.sound-wave-bar {
  animation: sound-pulse 0.8s ease-in-out infinite;
  transform-origin: bottom;
  contain: layout paint;
}

.soundscape-hud-modal {
  background-color: #18181b; /* Fondo sólido puro */
  border: 1px solid #27272a;
  contain: layout paint;
  transform: translateZ(0);
}
```

---

## 3. Layout JSX & Estructura de UI

```tsx
import React, { useEffect } from 'react';

export const AmbientSoundscapeHUD: React.FC<AmbientSoundscapeHUDProps> = ({
  isOpen,
  onClose,
  masterVolume,
  isMuted,
  tracks,
  onToggleMasterMute,
  onChangeMasterVolume,
  onChangeTrackVolume,
  onToggleTrackPlay,
}) => {
  // Atajo de teclado 'B' para abrir/cerrar el mezclador
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (['INPUT', 'TEXTAREA'].includes(target.tagName)) return;

      if (e.key.toLowerCase() === 'b') {
        e.preventDefault();
        if (isOpen) onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      style={{ contain: 'layout paint' }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="soundscape-modal-title"
    >
      <div className="soundscape-hud-modal rounded-2xl w-full max-w-md p-6 text-gray-100 shadow-2xl">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <span className="text-base">🎧</span>
            <h2 id="soundscape-modal-title" className="text-sm font-bold text-indigo-400">
              Mezclador de Paisajes Sonoros (B)
            </h2>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-200">✕</button>
        </div>

        {/* Control Maestro */}
        <div className="mb-6 p-4 bg-zinc-900 rounded-xl border border-zinc-800 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-300">Volumen Maestro</span>
            <button
              onClick={onToggleMasterMute}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                isMuted ? 'bg-rose-950/80 border border-rose-700 text-rose-300' : 'bg-emerald-950/80 border border-emerald-700 text-emerald-300'
              }`}
            >
              {isMuted ? 'Silenciado' : 'Activo'}
            </button>
          </div>

          <input
            type="range"
            min="0"
            max="100"
            value={isMuted ? 0 : masterVolume}
            onChange={(e) => onChangeMasterVolume(Number(e.target.value))}
            className="w-full accent-indigo-500 cursor-pointer"
          />
        </div>

        {/* Selector de Pistas */}
        <div className="space-y-3 max-h-64 overflow-y-auto">
          {tracks.map((track) => (
            <div key={track.id} className="p-3 bg-zinc-900/60 rounded-xl border border-zinc-800 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm">{track.icon}</span>
                  <span className="text-xs font-semibold text-gray-200">{track.name}</span>
                </div>
                <button
                  onClick={() => onToggleTrackPlay(track.id)}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-colors cursor-pointer ${
                    track.isPlaying ? 'bg-indigo-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {track.isPlaying ? 'Reproduciendo' : 'Pausado'}
                </button>
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={track.volume}
                  onChange={(e) => onChangeTrackVolume(track.id, Number(e.target.value))}
                  disabled={!track.isPlaying || isMuted}
                  className="w-full accent-indigo-500 cursor-pointer disabled:opacity-30"
                />
                {track.isPlaying && !isMuted && (
                  <div className="flex items-end gap-0.5 h-4 w-5 shrink-0">
                    <span className="w-1 bg-cyan-400 rounded-full sound-wave-bar" style={{ animationDelay: '0s' }} />
                    <span className="w-1 bg-cyan-400 rounded-full sound-wave-bar" style={{ animationDelay: '0.2s' }} />
                    <span className="w-1 bg-cyan-400 rounded-full sound-wave-bar" style={{ animationDelay: '0.4s' }} />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
```
