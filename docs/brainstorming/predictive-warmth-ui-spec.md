# Sprint 59: Predictive Warmth Indicator & Prefetch HUD

> [!IMPORTANT]
> Especificación técnica para el seguimiento del estado de precarga y el indicador visual de "calidez" en memoria, optimizado para la GPU Intel GMA 4500MHD con **CLS = 0**.

---

## 1. Hook `usePrefetchWarmth.ts` - Estado de Precarga

Este hook evalúa el buffer de memoria y las solicitudes de red para clasificar el estado de la siguiente página en la cola de lectura.

```tsx
import { useState, useEffect } from 'react';

export type WarmthState = 'cold' | 'warming' | 'hot';

export function usePrefetchWarmth(nextPageNumber: number, cachedPages: Set<number>, loadingPages: Set<number>): WarmthState {
  const [warmth, setWarmth] = useState<WarmthState>('cold');

  useEffect(() => {
    if (cachedPages.has(nextPageNumber)) {
      setWarmth('hot');
    } else if (loadingPages.has(nextPageNumber)) {
      setWarmth('warming');
    } else {
      setWarmth('cold');
    }
  }, [nextPageNumber, cachedPages, loadingPages]);

  return warmth;
}
```

---

## 2. Componente `PredictiveWarmthIndicator.tsx` - Indicador Minimalista

```tsx
export interface PredictiveWarmthIndicatorProps {
  warmth: WarmthState;
}
```

### Layout JSX & Estilos (GMA 4500MHD Safe):
```tsx
import React from 'react';
import { WarmthState } from './usePrefetchWarmth';

export const PredictiveWarmthIndicator: React.FC<PredictiveWarmthIndicatorProps> = ({ warmth }) => {
  const getConfig = () => {
    switch (warmth) {
      case 'hot':
        return {
          label: 'Listo (RAM)',
          dotColor: 'bg-emerald-500',
          borderColor: 'border-emerald-700',
          textColor: 'text-emerald-300',
        };
      case 'warming':
        return {
          label: 'Precargando...',
          dotColor: 'bg-amber-500 animate-pulse',
          borderColor: 'border-amber-700',
          textColor: 'text-amber-300',
        };
      case 'cold':
      default:
        return {
          label: 'En cola',
          dotColor: 'bg-gray-500',
          borderColor: 'border-gray-700',
          textColor: 'text-gray-400',
        };
    }
  };

  const config = getConfig();

  return (
    <div 
      className={`inline-flex items-center gap-2 px-2.5 py-1 bg-gray-900/90 border ${config.borderColor} rounded-full text-[10px] font-medium shadow-sm`}
      style={{ contain: 'layout paint', transform: 'translateZ(0)' }}
      role="status"
      aria-label={`Estado de precarga: ${config.label}`}
    >
      <span className={`w-2 h-2 rounded-full ${config.dotColor}`} />
      <span className={config.textColor}>{config.label}</span>
    </div>
  );
};
```
