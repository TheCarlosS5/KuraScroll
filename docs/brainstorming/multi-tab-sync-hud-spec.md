# Sprint 65: Multi-Tab Sync & Tab Leader Election HUD (`MultiTabSyncHUD.tsx`)

> [!IMPORTANT]
> Especificación técnica para el HUD de sincronización multi-pestaña mediante BroadcastChannel, optimizado para la GPU Intel GMA 4500MHD con **CLS = 0**.

---

## 1. Especificación de Estados & Props

```tsx
export type TabRole = 'leader' | 'follower';

export interface MultiTabSyncHUDProps {
  role: TabRole;
  activeTabsCount: number;
  isSyncingPulse: boolean;
  onForceLeadership: () => void;
}
```

---

## 2. Estilos CSS & Aislamiento de Hardware (Intel GMA 4500MHD)

```css
@keyframes sync-pulse {
  0% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.6; transform: scale(1.03); }
  100% { opacity: 1; transform: scale(1); }
}

.sync-pulse-active {
  animation: sync-pulse 300ms ease-in-out;
}

.multitab-hud-card {
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

export const MultiTabSyncHUD: React.FC<MultiTabSyncHUDProps> = ({
  role,
  activeTabsCount,
  isSyncingPulse,
  onForceLeadership,
}) => {
  const isLeader = role === 'leader';

  return (
    <div 
      className={`multitab-hud-card flex items-center gap-3 px-3 py-1.5 rounded-xl text-xs text-gray-200 shadow-sm ${
        isSyncingPulse ? 'sync-pulse-active border-cyan-600' : ''
      }`}
      style={{ contain: 'layout paint', transform: 'translateZ(0)' }}
      role="status"
      aria-label="Estado de Sincronización Multi-Pestaña"
    >
      {/* Indicador de Rol */}
      <div className="flex items-center gap-1.5">
        <span className={`w-2 h-2 rounded-full ${isLeader ? 'bg-emerald-500' : 'bg-indigo-400'}`} />
        <span className="font-semibold text-gray-100">
          {isLeader ? 'Líder' : 'Sincronizada'}
        </span>
      </div>

      <span className="text-zinc-600">|</span>

      {/* Contador de Pestañas */}
      <span className="text-[11px] text-zinc-400">
        {activeTabsCount} pestaña{activeTabsCount !== 1 ? 's' : ''} conectada{activeTabsCount !== 1 ? 's' : ''}
      </span>

      {/* Botón de Forzar Liderazgo */}
      {!isLeader && (
        <button
          onClick={onForceLeadership}
          className="ml-1 px-2 py-0.5 bg-zinc-800 hover:bg-zinc-700 text-indigo-300 rounded text-[10px] font-medium transition-colors cursor-pointer"
          title="Forzar esta pestaña como líder de guardado"
        >
          Forzar Liderazgo
        </button>
      )}
    </div>
  );
};
```
