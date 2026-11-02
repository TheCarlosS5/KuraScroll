# Sprint 60: Instant Dialogue Jump HUD & Quote Scrubber

> [!IMPORTANT]
> Especificación técnica para el buscador OCR de diálogos y el scrubber de citas, optimizado para la GPU Intel GMA 4500MHD con **CLS = 0**.

---

## 1. Especificación de Componentes & Props

```tsx
export interface DialogueMatch {
  id: string;
  speaker: string;
  text: string;
  pageNumber: number;
}

export interface DialogueJumpHUDProps {
  isOpen: boolean;
  onClose: () => void;
  query: string;
  onChangeQuery: (q: string) => void;
  matches: DialogueMatch[];
  onSelectMatch: (match: DialogueMatch) => void;
}
```

---

## 2. Estilos CSS & Aislamiento de Hardware (Intel GMA 4500MHD)

```css
.dialogue-hud-modal {
  background-color: #18181b; /* Fondo sólido puro */
  border: 1px solid #27272a;
  contain: layout paint;
  transform: translateZ(0);
}

mark.dialogue-highlight {
  background-color: rgba(99, 102, 241, 0.25);
  color: #93c5fd;
  padding: 0.125rem 0.25rem;
  border-radius: 0.25rem;
  font-weight: 600;
}
```

---

## 3. Layout JSX & Estructura de UI

```tsx
import React, { useEffect } from 'react';

export const DialogueJumpHUD: React.FC<DialogueJumpHUDProps> = ({
  isOpen,
  onClose,
  query,
  onChangeQuery,
  matches,
  onSelectMatch,
}) => {
  // Atajo de teclado 'Escape' para cerrar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-black/60 p-4"
      style={{ contain: 'layout paint' }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="dialogue-search-title"
    >
      <div className="dialogue-hud-modal rounded-2xl w-full max-w-xl p-4 text-gray-100 shadow-2xl">
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
          <h2 id="dialogue-search-title" className="text-sm font-bold text-indigo-400">
            Buscador Instantáneo de Diálogos (OCR)
          </h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-200">✕</button>
        </div>

        {/* Input de Búsqueda */}
        <div className="py-3">
          <input
            type="text"
            value={query}
            onChange={(e) => onChangeQuery(e.target.value)}
            placeholder="Escribe una frase o palabra clave del diálogo..."
            autoFocus
            className="w-full px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-sm text-gray-100 focus:outline-none focus:border-indigo-500"
          />
        </div>

        {/* Resultados / Coincidencias */}
        <div className="max-h-80 overflow-y-auto space-y-2">
          {matches.length === 0 ? (
            <p className="text-xs text-zinc-500 text-center py-6">No se encontraron diálogos coincidentes.</p>
          ) : (
            matches.map((match) => (
              <div
                key={match.id}
                onClick={() => {
                  onSelectMatch(match);
                  onClose();
                }}
                className="p-3 bg-zinc-900/60 hover:bg-zinc-800/80 border border-zinc-800/80 rounded-xl cursor-pointer transition-colors"
              >
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs font-semibold text-indigo-300">{match.speaker}</span>
                  <span className="text-[10px] bg-zinc-800 px-2 py-0.5 rounded text-zinc-400">Pág. {match.pageNumber}</span>
                </div>
                <p className="text-xs text-zinc-300 line-clamp-2">{match.text}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
```
