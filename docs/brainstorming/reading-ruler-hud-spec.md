# Sprint 71: Motor de Regla Óptica Dinámica y Foco Guiado Sacádico (`ReadingRulerHUD.tsx`)

> [!IMPORTANT]
> Especificación técnica para la regla óptica y pacer sacádico, optimizado para la GPU Intel GMA 4500MHD con **CLS = 0**.

---

## 1. Especificación de Estados & Props

```tsx
export type OpticalTint = 'amber' | 'mint' | 'rose' | 'neutral' | 'midnight';
export type RulerMode = 'ruler' | 'shutter' | 'saccadic_pacer';

export interface ReadingRulerHUDProps {
  isVisible: boolean;
  mode: RulerMode;
  slotHeight: number; // 40px a 160px
  opacity: number; // 0.2 a 0.8 (20% a 80%)
  tint: OpticalTint;
  isPaused: boolean;
  onToggleVisibility: () => void;
  onChangeMode: (mode: RulerMode) => void;
  onChangeSlotHeight: (height: number) => void;
  onChangeOpacity: (opacity: number) => void;
  onChangeTint: (tint: OpticalTint) => void;
  onTogglePause: () => void;
}
```

---

## 2. Estilos CSS & Aislamiento de Hardware (Intel GMA 4500MHD)

```css
.ruler-hud-card {
  background-color: #18181b; /* Fondo sólido puro */
  border: 1px solid #27272a;
  contain: layout paint;
  transform: translateZ(0);
}

.optical-ruler-mask {
  position: fixed;
  left: 0;
  right: 0;
  pointer-events: none;
  contain: layout paint;
  z-index: 35;
}
```

---

## 3. Layout JSX & Estructura de UI

```tsx
import React, { useEffect } from 'react';

export const ReadingRulerHUD: React.FC<ReadingRulerHUDProps> = ({
  isVisible,
  mode,
  slotHeight,
  opacity,
  tint,
  isPaused,
  onToggleVisibility,
  onChangeMode,
  onChangeSlotHeight,
  onChangeOpacity,
  onChangeTint,
  onTogglePause,
}) => {
  // Atajo de teclado 'U' para alternar regla, Espacio para pausa, Flechas para paso
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (['INPUT', 'TEXTAREA'].includes(target.tagName)) return;

      if (e.key.toLowerCase() === 'u') {
        e.preventDefault();
        onToggleVisibility();
      } else if (isVisible && e.key === ' ') {
        e.preventDefault();
        onTogglePause();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isVisible, onToggleVisibility, onTogglePause]);

  if (!isVisible) return null;

  const tints: { id: OpticalTint; label: string; color: string }[] = [
    { id: 'amber', label: 'Ámbar', color: 'bg-amber-500' },
    { id: 'mint', label: 'Menta', color: 'bg-emerald-500' },
    { id: 'rose', label: 'Rosa', color: 'bg-rose-500' },
    { id: 'neutral', label: 'Neutro', color: 'bg-zinc-500' },
    { id: 'midnight', label: 'Medianoche', color: 'bg-indigo-500' },
  ];

  return (
    <div 
      className="fixed bottom-6 right-6 z-40 flex flex-col gap-3 p-4 rounded-2xl text-xs text-gray-200 shadow-xl ruler-hud-card max-w-xs w-full"
      style={{ contain: 'layout paint' }}
      role="region"
      aria-label="Controles de Regla Óptica y Pacer"
    >
      <div className="flex justify-between items-center pb-2 border-b border-zinc-800">
        <h3 className="font-bold text-sm text-indigo-400">Regla Óptica & Pacer</h3>
        <button onClick={onToggleVisibility} className="text-zinc-400 hover:text-zinc-200">✕</button>
      </div>

      {/* Selector de Modo */}
      <div className="flex gap-1">
        {(['ruler', 'shutter', 'saccadic_pacer'] as RulerMode[]).map((m) => (
          <button
            key={m}
            onClick={() => onChangeMode(m)}
            className={`flex-1 py-1 rounded-lg text-[10px] font-semibold transition-colors cursor-pointer capitalize ${
              mode === m ? 'bg-indigo-600 text-white' : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200'
            }`}
          >
            {m.replace('_', ' ')}
          </button>
        ))}
      </div>

      {/* Selector de Tinte Óptico */}
      <div className="flex items-center justify-between">
        <span className="text-zinc-400">Tinte:</span>
        <div className="flex gap-1.5">
          {tints.map((t) => (
            <button
              key={t.id}
              onClick={() => onChangeTint(t.id)}
              className={`w-5 h-5 rounded-full ${t.color} transition-transform cursor-pointer ${
                tint === t.id ? 'ring-2 ring-white scale-110' : 'opacity-60 hover:opacity-100'
              }`}
              title={t.label}
            />
          ))}
        </div>
      </div>

      {/* Deslizadores de Altura y Opacidad */}
      <div className="space-y-2 pt-2 border-t border-zinc-800">
        <div className="flex flex-col gap-1">
          <div className="flex justify-between text-[10px] text-zinc-400">
            <span>Altura de ranura</span>
            <span>{slotHeight}px</span>
          </div>
          <input
            type="range"
            min="40"
            max="160"
            value={slotHeight}
            onChange={(e) => onChangeSlotHeight(Number(e.target.value))}
            className="w-full accent-indigo-500 cursor-pointer"
          />
        </div>

        <div className="flex flex-col gap-1">
          <div className="flex justify-between text-[10px] text-zinc-400">
            <span>Opacidad</span>
            <span>{Math.round(opacity * 100)}%</span>
          </div>
          <input
            type="range"
            min="0.2"
            max="0.8"
            step="0.05"
            value={opacity}
            onChange={(e) => onChangeOpacity(Number(e.target.value))}
            className="w-full accent-indigo-500 cursor-pointer"
          />
        </div>
      </div>
    </div>
  );
};
```
