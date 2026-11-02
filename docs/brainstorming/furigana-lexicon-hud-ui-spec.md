# Sprint 62: FuriganaLexiconHUD.tsx & Interactive Vocabulary/Lore Tooltips

> [!IMPORTANT]
> Especificación técnica para el componente de glosario y fichas de lore con soporte nativo de etiquetas `<ruby>` y `<rt>`, optimizado para la GPU Intel GMA 4500MHD con **CLS = 0**.

---

## 1. Especificación de Componentes & Props

```tsx
export type LexiconCategory = 'SERIES_LORE' | 'KANJI' | 'VOCAB' | 'SFX';

export interface LexiconEntry {
  id: string;
  term: string; // e.g. "霊圧"
  furiganaHtml: string; // e.g. "<ruby>霊圧<rt>reiatsu</rt></ruby>"
  category: LexiconCategory;
  definition: string;
  romaji?: string;
}

export interface FuriganaLexiconHUDProps {
  entry: LexiconEntry | null;
  isOpen: boolean;
  onClose: () => void;
  position: { x: number; y: number };
}
```

---

## 2. Estilos CSS & Aislamiento de Hardware (Intel GMA 4500MHD)

```css
.lexicon-hud-card {
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

export const FuriganaLexiconHUD: React.FC<FuriganaLexiconHUDProps> = ({
  entry,
  isOpen,
  onClose,
  position,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !entry) return null;

  const getCategoryBadge = (cat: LexiconCategory) => {
    switch (cat) {
      case 'SERIES_LORE':
        return 'bg-indigo-950/80 border-indigo-700 text-indigo-300';
      case 'KANJI':
        return 'bg-emerald-950/80 border-emerald-700 text-emerald-300';
      case 'VOCAB':
        return 'bg-amber-950/80 border-amber-700 text-amber-300';
      case 'SFX':
        return 'bg-rose-950/80 border-rose-700 text-rose-300';
    }
  };

  return (
    <div 
      className="absolute z-50 w-72 lexicon-hud-card rounded-xl p-4 text-gray-100 shadow-xl"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        contain: 'layout paint',
      }}
      role="tooltip"
      aria-label={`Definición de ${entry.term}`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${getCategoryBadge(entry.category)}`}>
          {entry.category}
        </span>
        <button onClick={onClose} className="text-zinc-400 hover:text-zinc-200 text-xs">✕</button>
      </div>

      <div className="mb-2">
        <div className="text-lg font-bold text-gray-100" dangerouslySetInnerHTML={{ __html: entry.furiganaHtml }} />
        {entry.romaji && <span className="text-[11px] text-zinc-400 italic">({entry.romaji})</span>}
      </div>

      <p className="text-xs text-zinc-300 leading-relaxed border-t border-zinc-800 pt-2">
        {entry.definition}
      </p>
    </div>
  );
};
```
