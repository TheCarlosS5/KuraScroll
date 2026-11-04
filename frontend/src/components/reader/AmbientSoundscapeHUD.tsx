/**
 * KuraScroll Multi-Track Ambient Soundscapes HUD
 * Sprint 73 - Atmospheric Soundscapes & BGM Mixer Engine
 *
 * Hardware-tuned for Intel Pentium T4500 & Intel GMA 4500MHD:
 * Pure solid background (#18181b), 0 CLS, zero CSS backdrop-filter blur.
 */

import React, { useEffect } from 'react';
import { SoundscapeTrack, SoundscapeTrackId } from '../../reader/useAmbientSoundscape';

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
  // ESC and 'B' key listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (['INPUT', 'TEXTAREA'].includes(target.tagName)) return;

      if ((e.key === 'Escape' || e.key.toLowerCase() === 'b') && isOpen) {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      data-testid="ambient-soundscape-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70"
      style={{ contain: 'layout paint' }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="soundscape-modal-title"
    >
      <div
        className="rounded-2xl w-full max-w-md p-6 text-gray-100 shadow-2xl flex flex-col gap-4 border border-zinc-800"
        style={{
          backgroundColor: '#18181b',
          contain: 'layout paint',
          transform: 'translateZ(0)',
        }}
      >
        {/* Header */}
        <div className="flex justify-between items-center pb-2 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            
            <div>
              <h2 id="soundscape-modal-title" className="text-sm font-bold text-indigo-400">
                Mezclador de Paisajes Sonoros (B)
              </h2>
              <p className="text-[11px] text-zinc-400">Música y ambientes para acompañar tu lectura</p>
            </div>
          </div>
          <button
            data-testid="soundscape-close-btn"
            onClick={onClose}
            className="text-zinc-400 hover:text-white cursor-pointer text-lg leading-none p-1"
            aria-label="Cerrar mezclador"
          >&times;</button>
        </div>

        {/* Master Control */}
        <div className="p-3 bg-zinc-900 rounded-xl border border-zinc-800 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-300">
              Volumen Maestro: {isMuted ? '0%' : `${masterVolume}%`}
            </span>
            <button
              data-testid="master-mute-btn"
              onClick={onToggleMasterMute}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                isMuted
                  ? 'bg-rose-950/80 border border-rose-700 text-rose-300'
                  : 'bg-emerald-950/80 border border-emerald-700 text-emerald-300'
              }`}
            >
              {isMuted ? 'Silenciado' : 'Activo'}
            </button>
          </div>

          <input
            data-testid="master-volume-slider"
            type="range"
            min="0"
            max="100"
            value={isMuted ? 0 : masterVolume}
            onChange={(e) => onChangeMasterVolume(Number(e.target.value))}
            className="w-full accent-indigo-500 cursor-pointer"
            aria-label="Control de volumen maestro"
          />
        </div>

        {/* Tracks List */}
        <div className="flex flex-col gap-2.5 max-h-64 overflow-y-auto pr-1">
          {tracks.map((track) => (
            <div
              key={track.id}
              data-testid={`track-card-${track.id}`}
              className="p-3 bg-zinc-900/60 rounded-xl border border-zinc-800 flex flex-col gap-2"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-indigo-400 inline-block" />
                  <span className="text-xs font-semibold text-gray-200">{track.name}</span>
                </div>
                <button
                  data-testid={`track-play-btn-${track.id}`}
                  onClick={() => onToggleTrackPlay(track.id)}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-colors cursor-pointer ${
                    track.isPlaying
                      ? 'bg-indigo-600 text-white'
                      : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {track.isPlaying ? 'Reproduciendo' : 'Pausado'}
                </button>
              </div>

              <div className="flex items-center gap-3">
                <input
                  data-testid={`track-volume-slider-${track.id}`}
                  type="range"
                  min="0"
                  max="100"
                  value={track.volume}
                  onChange={(e) => onChangeTrackVolume(track.id, Number(e.target.value))}
                  disabled={!track.isPlaying || isMuted}
                  className="w-full accent-indigo-500 cursor-pointer disabled:opacity-30"
                  aria-label={`Volumen de ${track.name}`}
                />
                {track.isPlaying && !isMuted && (
                  <div
                    data-testid={`sound-wave-${track.id}`}
                    className="flex items-end gap-0.5 h-4 w-5 shrink-0"
                    aria-label="Onda de sonido activa"
                  >
                    <span className="w-1 h-3 bg-cyan-400 rounded-full" />
                    <span className="w-1 h-4 bg-cyan-400 rounded-full" />
                    <span className="w-1 h-2 bg-cyan-400 rounded-full" />
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
