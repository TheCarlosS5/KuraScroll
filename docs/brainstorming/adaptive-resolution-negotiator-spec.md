# Sprint 58: Adaptive Resolution Negotiator & Tier Inspector

> [!IMPORTANT]
> Especificación técnica para el sistema de negociación de resolución adaptativa y el HUD de inspección, optimizado para la GPU Intel GMA 4500MHD con **CLS = 0**.

---

## 1. Hook `useAdaptiveResolution.ts` - Negociador de Tiers

Este hook evalúa el ancho de la ventana, el Device Pixel Ratio (DPR) y la red para seleccionar el parámetro de URL óptimo (`?w=800`, `?w=1200`, `?w=1600`).

```tsx
import { useState, useEffect } from 'react';

export type ResolutionTier = 800 | 1200 | 1600;

export function useAdaptiveResolution(manualOverride?: ResolutionTier) {
  const [tier, setTier] = useState<ResolutionTier>(1200);

  useEffect(() => {
    if (manualOverride) {
      setTier(manualOverride);
      return;
    }

    const calculateTier = () => {
      const width = window.innerWidth;
      const dpr = window.devicePixelRatio || 1;
      const effectiveWidth = width * dpr;

      if (effectiveWidth <= 900) {
        setTier(800);
      } else if (effectiveWidth <= 1400) {
        setTier(1200);
      } else {
        setTier(1600);
      }
    };

    calculateTier();
    window.addEventListener('resize', calculateTier);
    return () => window.removeEventListener('resize', calculateTier);
  }, [manualOverride]);

  return tier;
}
```

---

## 2. Componente `ResolutionTierHUD.tsx` - Inspector & Override

```tsx
export interface ResolutionTierHUDProps {
  currentTier: ResolutionTier;
  isManual: boolean;
  onSelectTier: (tier: ResolutionTier | undefined) => void;
}
```

### Layout JSX & Estilos (GMA 4500MHD Safe):
```tsx
import React from 'react';

export const ResolutionTierHUD: React.FC<ResolutionTierHUDProps> = ({
  currentTier,
  isManual,
  onSelectTier,
}) => {
  return (
    <div 
      className="flex items-center gap-3 px-3 py-1.5 bg-gray-900/90 border border-gray-800 rounded-xl text-xs text-gray-200 shadow-sm"
      style={{ contain: 'layout paint', transform: 'translateZ(0)' }}
      role="region"
      aria-label="Inspector de Resolución Adaptativa"
    >
      <span className="font-semibold text-indigo-400">Tier: {currentTier}px</span>
      
      <div className="flex items-center gap-1">
        {([800, 1200, 1600] as ResolutionTier[]).map((t) => (
          <button
            key={t}
            onClick={() => onSelectTier(t)}
            className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors cursor-pointer ${
              currentTier === t && isManual 
                ? 'bg-indigo-600 text-white' 
                : 'bg-gray-800 hover:bg-gray-700 text-gray-300'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {isManual && (
        <button
          onClick={() => onSelectTier(undefined)}
          className="text-[10px] text-gray-400 hover:text-gray-200 underline ml-1"
        >
          Auto
        </button>
      )}
    </div>
  );
};
```
