import React, { useEffect } from 'react';

export interface AudioDeckHUDProps {
  isMuted: boolean;
  bgmVolume: number; // 0 to 100
  sfxVolume: number; // 0 to 100
  isPlaying: boolean;
  activePreset?: string;
  onToggleMute: () => void;
  onChangeBgm: (vol: number) => void;
  onChangeSfx: (vol: number) => void;
}

export const AudioDeckHUD: React.FC<AudioDeckHUDProps> = ({
  isMuted,
  bgmVolume,
  sfxVolume,
  isPlaying,
  activePreset,
  onToggleMute,
  onChangeBgm,
  onChangeSfx,
}) => {
  // Global keyboard shortcut 'M' to toggle mute
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName)) return;

      if (e.key.toLowerCase() === 'm') {
        e.preventDefault();
        onToggleMute();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onToggleMute]);

  return (
    <aside
      data-testid="audio-deck-hud"
      role="region"
      aria-label="Control de Audio de Lectura"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '12px',
        padding: '6px 14px',
        backgroundColor: '#18181b',
        border: '1px solid #27272a',
        borderRadius: '24px',
        fontSize: '12px',
        color: '#e4e4e7',
        contain: 'layout paint',
        boxShadow: '0 2px 10px rgba(0, 0, 0, 0.4)',
        userSelect: 'none',
      }}
    >
      {/* Master Mute Button */}
      <button
        data-testid="mute-toggle-btn"
        onClick={onToggleMute}
        aria-label={isMuted ? 'Activar sonido (M)' : 'Silenciar sonido (M)'}
        title={isMuted ? 'Activar sonido (Tecla M)' : 'Silenciar sonido (Tecla M)'}
        style={{
          background: isMuted ? '#ef444422' : '#27272a',
          border: isMuted ? '1px solid #ef444488' : '1px solid #3f3f46',
          borderRadius: '12px',
          width: '32px',
          height: '32px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          fontSize: '14px',
          color: isMuted ? '#f87171' : '#ffffff',
          transition: 'background 0.2s ease',
        }}
      >
        {isMuted ? '🔇' : bgmVolume === 0 && sfxVolume === 0 ? '🔈' : '🔊'}
      </button>

      {/* Zero-Blur Animated Audio Wave Indicator */}
      <div
        data-testid="audio-wave-indicator"
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: '3px',
          height: '16px',
          width: '18px',
        }}
        aria-hidden="true"
      >
        <span
          style={{
            width: '3px',
            backgroundColor: isPlaying && !isMuted ? '#38bdf8' : '#52525b',
            borderRadius: '2px',
            height: isPlaying && !isMuted ? '14px' : '4px',
            transition: 'height 0.2s ease',
          }}
        />
        <span
          style={{
            width: '3px',
            backgroundColor: isPlaying && !isMuted ? '#818cf8' : '#52525b',
            borderRadius: '2px',
            height: isPlaying && !isMuted ? '10px' : '4px',
            transition: 'height 0.2s ease',
          }}
        />
        <span
          style={{
            width: '3px',
            backgroundColor: isPlaying && !isMuted ? '#a78bfa' : '#52525b',
            borderRadius: '2px',
            height: isPlaying && !isMuted ? '16px' : '4px',
            transition: 'height 0.2s ease',
          }}
        />
      </div>

      {/* Preset Indicator Tag */}
      {activePreset && (
        <span
          data-testid="audio-preset-tag"
          style={{
            fontSize: '11px',
            padding: '2px 8px',
            borderRadius: '10px',
            backgroundColor: '#27272a',
            color: '#38bdf8',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
          }}
        >
          {activePreset}
        </span>
      )}

      {/* BGM Volume Slider */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#a1a1aa' }}>
          <span>BGM</span>
          <span data-testid="bgm-volume-label">{isMuted ? '0%' : `${bgmVolume}%`}</span>
        </div>
        <input
          data-testid="bgm-volume-slider"
          type="range"
          min="0"
          max="100"
          value={bgmVolume}
          disabled={isMuted}
          onChange={(e) => onChangeBgm(parseInt(e.target.value, 10))}
          style={{
            width: '64px',
            height: '4px',
            cursor: isMuted ? 'not-allowed' : 'pointer',
            accentColor: '#38bdf8',
          }}
          aria-label="Volumen de Música Ambiental (BGM)"
        />
      </div>

      {/* SFX Volume Slider */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#a1a1aa' }}>
          <span>SFX</span>
          <span data-testid="sfx-volume-label">{isMuted ? '0%' : `${sfxVolume}%`}</span>
        </div>
        <input
          data-testid="sfx-volume-slider"
          type="range"
          min="0"
          max="100"
          value={sfxVolume}
          disabled={isMuted}
          onChange={(e) => onChangeSfx(parseInt(e.target.value, 10))}
          style={{
            width: '64px',
            height: '4px',
            cursor: isMuted ? 'not-allowed' : 'pointer',
            accentColor: '#a78bfa',
          }}
          aria-label="Volumen de Efectos de Sonido (SFX)"
        />
      </div>
    </aside>
  );
};
