# Sprint 70: Motor de Transiciones Cinéticas y Efecto Parallax en Viñetas Clímax (`KineticMotionHUD.tsx`)

> [!IMPORTANT]
> Especificación técnica para el control de efecto cinético 2.5D y obturador letterbox, optimizado para la GPU Intel GMA 4500MHD con **CLS = 0**.

---

## 1. Especificación de Estados & Props

```tsx
export type KineticIntensity = 'subtle' | 'normal' | 'intense'; // 4px, 8px, 12px

export interface KineticMotionHUDProps {
  isClimaxPanel: boolean;
  isKineticActive: boolean;
  intensity: KineticIntensity;
  onToggleKinetic: () => void;
  onChangeIntensity: (intensity: KineticIntensity) => void;
}
```

---

## 2. Estilos CSS & Obturador Letterbox sin Reflows (Intel GMA 4500MHD)

```css
.letterbox-shutter-top,
.letterbox-shutter-bottom {
  position: absolute;
  left: 0;
  right: 0;
  height: 0;
  background-color: #000000;
  transition: height 250ms cubic-bezier(0.16, 1, 0.3, 1);
  contain: layout paint;
  z-index: 25;
}

.letterbox-shutter-top { top: 0; }
.letterbox-shutter-bottom { bottom: 0; }

.letterbox-active .letterbox-shutter-top,
.letterbox-active .letterbox-shutter-bottom {
  height: 10%; /* Enmarca la escena en viñetas clímax */
}

.kinetic-hud-card {
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

export const KineticMotionHUD: React.FC<KineticMotionHUDProps> = ({
  isClimaxPanel,
  isKineticActive,
  intensity,
  onToggleKinetic,
  onChangeIntensity,
}) => {
  // Atajo de teclado 'K' para alternar efecto cinético
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (['INPUT', 'TEXTAREA'].includes(target.tagName)) return;

      if (e.key.toLowerCase() === 'k') {
        e.preventDefault();
        onToggleKinetic();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onToggleKinetic]);

  if (!isClimaxPanel) return null;

  const intensities: { id: KineticIntensity; label: string }[] = [
    { id: 'subtle', label: 'Sutil (4px)' },
    { id: 'normal', label: 'Normal (8px)' },
    { id: 'intense', label: 'Intenso (12px)' },
  ];

  return (
    <div 
      className="fixed top-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 px-4 py-2 rounded-2xl text-xs text-gray-200 shadow-xl kinetic-hud-card"
      style={{ contain: 'layout paint' }}
      role="region"
      aria-label="Control de Movimiento Cinético"
    >
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
        <span className="font-bold text-gray-100">Efecto Cinético 2.5D (K)</span>
      </div>

      <div className="flex items-center bg-zinc-900 p-1 rounded-xl border border-zinc-800">
        {intensities.map((item) => (
          <button
            key={item.id}
            onClick={() => onChangeIntensity(item.id)}
            className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-colors cursor-pointer ${
              intensity === item.id ? 'bg-indigo-600 text-white' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
};
```
