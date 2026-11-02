# Sprint 63: Platter Defrag & HDD Cylinder Re-Alignment HUD (`PlatterDefragHUD.tsx`)

> [!IMPORTANT]
> Especificación técnica para el HUD de desfragmentación y optimización de cilindros de disco mecánico, optimizado para la GPU Intel GMA 4500MHD con **CLS = 0**.

---

## 1. Especificación de Estados & Props

```tsx
export type DefragStatus = 'idle' | 'analyzing' | 'defragmenting' | 'complete';

export interface PlatterDefragHUDProps {
  status: DefragStatus;
  fragmentationPercent: number; // 0 a 100
  currentCylinder?: number;
  totalCylinders?: number;
  onStartDefrag: () => void;
  onClose: () => void;
}
```

---

## 2. Estilos CSS & Aislamiento de Hardware (Intel GMA 4500MHD)

```css
.defrag-hud-modal {
  background-color: #18181b; /* Fondo sólido puro */
  border: 1px solid #27272a;
  contain: layout paint;
  transform: translateZ(0);
}
```

---

## 3. Layout JSX & Estructura de UI

```tsx
import React from 'react';

export const PlatterDefragHUD: React.FC<PlatterDefragHUDProps> = ({
  status,
  fragmentationPercent,
  currentCylinder,
  totalCylinders,
  onStartDefrag,
  onClose,
}) => {
  const getStatusLabel = () => {
    switch (status) {
      case 'idle': return 'Listo para analizar';
      case 'analyzing': return 'Analizando sectores de plato...';
      case 'defragmenting': return 'Optimización de cilindros activa...';
      case 'complete': return 'Optimización completada con éxito';
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      style={{ contain: 'layout paint' }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="defrag-modal-title"
    >
      <div className="defrag-hud-modal rounded-2xl w-full max-w-md p-6 text-gray-100 shadow-2xl">
        <div className="flex justify-between items-center mb-4">
          <h2 id="defrag-modal-title" className="text-sm font-bold text-indigo-400">
            Optimizador de Plato HDD & Cilindros
          </h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-200">✕</button>
        </div>

        {/* Indicador de Fragmentación */}
        <div className="mb-6 p-4 bg-zinc-900 rounded-xl border border-zinc-800 text-center">
          <span className="text-3xl font-extrabold text-gray-100">{fragmentationPercent}%</span>
          <p className="text-xs text-zinc-400 mt-1">Fragmentación del Volumen de Manga</p>
        </div>

        {/* Estado en Tiempo Real */}
        <div className="mb-6 space-y-2">
          <div className="flex justify-between text-xs text-zinc-300">
            <span>Estado:</span>
            <span className="font-semibold text-indigo-300">{getStatusLabel()}</span>
          </div>
          {currentCylinder && totalCylinders && (
            <div className="flex justify-between text-[11px] text-zinc-500">
              <span>Cilindro actual:</span>
              <span>{currentCylinder} / {totalCylinders}</span>
            </div>
          )}
          <div className="w-full bg-zinc-800 h-2 rounded-full overflow-hidden">
            <div 
              className="bg-indigo-500 h-full transition-all duration-300"
              style={{ width: `${status === 'complete' ? 100 : fragmentationPercent}%` }}
            />
          </div>
        </div>

        {/* Botón de Acción */}
        <div className="flex justify-end gap-3 pt-4 border-t border-zinc-800">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-xs font-medium transition-colors"
          >
            Cerrar
          </button>
          <button
            onClick={onStartDefrag}
            disabled={status === 'analyzing' || status === 'defragmenting'}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer"
          >
            {status === 'idle' ? 'Iniciar Análisis' : 'Optimizar Cilindros'}
          </button>
        </div>
      </div>
    </div>
  );
};
```
