# Sprint 67: Motor Dinámico de Traducción y Superposición de Onomatopeyas (SFX)

> [!IMPORTANT]
> Especificación técnica para la superposición y traducción de efectos de sonido (SFX), optimizado para la GPU Intel GMA 4500MHD con **CLS = 0**.

---

## 1. Hook `useSfxOverlay.ts` - Estado & Atajo 'S'

```tsx
import { useState, useCallback, useEffect } from 'react';

export type SfxDisplayMode = 'classic_comic' | 'floating_subtitle' | 'tooltip_hover';

export function useSfxOverlay() {
  const [isVisible, setIsVisible] = useState<boolean>(true);
  const [displayMode, setDisplayMode] = useState<SfxDisplayMode>('classic_comic');

  const toggleVisibility = useCallback(() => {
    setIsVisible((prev) => !prev);
  }, []);

  // Atajo de teclado 'S' para alternar visibilidad de SFX
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (['INPUT', 'TEXTAREA'].includes(target.tagName)) return;

      if (e.key.toLowerCase() === 's') {
        e.preventDefault();
        toggleVisibility();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleVisibility]);

  return { isVisible, displayMode, setDisplayMode, toggleVisibility };
}
```

---

## 2. Estilos CSS & Sombras de Texto sin Blur (Intel GMA 4500MHD)

```css
.sfx-text-outline {
  text-shadow: 
     2px  2px 0 #000, 
    -2px -2px 0 #000, 
     2px -2px 0 #000, 
    -2px  2px 0 #000,
     0px  2px 0 #000, 
     0px -2px 0 #000, 
     2px  0px 0 #000, 
    -2px  0px 0 #000;
  contain: layout style paint;
}

.sfx-container {
  contain: layout style paint;
  transform: translateZ(0);
}
```

---

## 3. Componente `SfxOverlayHUD.tsx` - Layout JSX

```tsx
export interface SfxItem {
  id: string;
  xPercent: number;
  yPercent: number;
  rotationDeg: number; // -15deg a +15deg o vertical
  originalSfx: string;
  translatedSfx: string;
}

export interface SfxOverlayHUDProps {
  sfxList: SfxItem[];
  isVisible: boolean;
  displayMode: SfxDisplayMode;
}
```

### Layout JSX:
```tsx
import React from 'react';

export const SfxOverlayHUD: React.FC<SfxOverlayHUDProps> = ({
  sfxList,
  isVisible,
  displayMode,
}) => {
  if (!isVisible) return null;

  return (
    <div 
      className="sfx-container absolute inset-0 pointer-events-none z-20 overflow-hidden"
      aria-label="Superposición de Traducción de Onomatopeyas"
    >
      {sfxList.map((sfx) => {
        if (displayMode === 'floating_subtitle') {
          // Modo Subtítulo Flotante (en la barra inferior o lateral)
          return null; // Gestionado por barra de subtítulos dedicada
        }

        return (
          <div
            key={sfx.id}
            className="absolute pointer-events-auto flex items-center justify-center p-1 group"
            style={{
              left: `${sfx.xPercent}%`,
              top: `${sfx.yPercent}%`,
              transform: `rotate(${sfx.rotationDeg}deg)`,
            }}
          >
            <span className="sfx-text-outline uppercase font-extrabold text-amber-300 text-base tracking-wider select-none">
              {sfx.translatedSfx}
            </span>

            {/* Tooltip Hover opcional */}
            {displayMode === 'tooltip_hover' && (
              <span className="absolute bottom-full mb-1 hidden group-hover:block px-2 py-0.5 bg-zinc-900 border border-zinc-700 text-zinc-100 text-[10px] rounded shadow-md whitespace-nowrap z-50">
                Orig: {sfx.originalSfx}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
};
```
