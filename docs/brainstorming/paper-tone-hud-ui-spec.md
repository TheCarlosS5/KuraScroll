# Sprint 64: Paper Tone & E-Ink Palette Remapper (`PaperToneHUD.tsx`)

> [!IMPORTANT]
> Especificación técnica para el motor adaptativo de tinte de papel y remapeo de paleta, optimizado para la GPU Intel GMA 4500MHD con **CLS = 0**.

---

## 1. Especificación de Presets & Matrices `feColorMatrix`

```tsx
export type PaperTonePresetId = 
  | 'ORIGINAL' 
  | 'SEPIA_CALIDO' 
  | 'PAPEL_E_INK' 
  | 'PERIODICO_VINTAGE' 
  | 'AMBAR_MEDIANOCHE' 
  | 'NOIR_ALTO_CONTRASTE';

export interface PaperToneHUDProps {
  currentPreset: PaperTonePresetId;
  warmth: number; // 0 a 100
  contrast: number; // 50 a 150
  luminance: number; // 50 a 150
  onSelectPreset: (preset: PaperTonePresetId) => void;
  onChangeWarmth: (val: number) => void;
  onChangeContrast: (val: number) => void;
  onChangeLuminance: (val: number) => void;
  isOpen: boolean;
  onClose: () => void;
}
```

### Matrices SVG `feColorMatrix` para los 6 Presets:
```xml
<!-- 1. ORIGINAL -->
<feColorMatrix type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 1 0" />

<!-- 2. SEPIA_CALIDO -->
<feColorMatrix type="matrix" values="0.393 0.769 0.189 0 0  0.349 0.686 0.168 0 0  0.272 0.534 0.131 0 0  0 0 0 1 0" />

<!-- 3. PAPEL_E_INK -->
<feColorMatrix type="matrix" values="0.33 0.33 0.33 0 0.1  0.33 0.33 0.33 0 0.1  0.33 0.33 0.33 0 0.1  0 0 0 1 0" />

<!-- 4. PERIODICO_VINTAGE -->
<feColorMatrix type="matrix" values="0.4 0.6 0.1 0 0.08  0.3 0.5 0.1 0 0.05  0.2 0.4 0.1 0 -0.05  0 0 0 1 0" />

<!-- 5. AMBAR_MEDIANOCHE -->
<feColorMatrix type="matrix" values="0.5 0.3 0 0 0.05  0.3 0.3 0 0 0.02  0 0 0 0 0  0 0 0 1 0" />

<!-- 6. NOIR_ALTO_CONTRASTE -->
<feColorMatrix type="matrix" values="1.5 0 0 0 -0.2  0 1.5 0 0 -0.2  0 0 1.5 0 -0.2  0 0 0 1 0" />
```

---

## 2. Layout JSX & Estructura de UI (Cero CLS)

```tsx
import React, { useEffect } from 'react';

export const PAPER_TONE_PRESETS: { id: PaperTonePresetId; label: string }[] = [
  { id: 'ORIGINAL', label: 'Original' },
  { id: 'SEPIA_CALIDO', label: 'Sepia Cálido' },
  { id: 'PAPEL_E_INK', label: 'E-Ink Reflejo' },
  { id: 'PERIODICO_VINTAGE', label: 'Periódico Vintage' },
  { id: 'AMBAR_MEDIANOCHE', label: 'Ámbar Medianoche' },
  { id: 'NOIR_ALTO_CONTRASTE', label: 'Noir Alto Contraste' },
];

export const PaperToneHUD: React.FC<PaperToneHUDProps> = ({
  currentPreset,
  warmth,
  contrast,
  luminance,
  onSelectPreset,
  onChangeWarmth,
  onChangeContrast,
  onChangeLuminance,
  isOpen,
  onClose,
}) => {
  // Atajo de teclado 'T' para toggle
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (['INPUT', 'TEXTAREA'].includes(target.tagName)) return;

      if (e.key.toLowerCase() === 't') {
        e.preventDefault();
        if (isOpen) onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      style={{ contain: 'layout paint' }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="papertone-modal-title"
    >
      <div className="bg-[#18181b] border border-[#27272a] rounded-2xl w-full max-w-sm p-6 text-gray-100 shadow-2xl">
        <div className="flex justify-between items-center mb-4">
          <h2 id="papertone-modal-title" className="text-sm font-bold text-indigo-400">
            Motor de Tinte de Papel & E-Ink
          </h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-200">✕</button>
        </div>

        {/* Selector de Presets */}
        <div className="grid grid-cols-2 gap-2 mb-6">
          {PAPER_TONE_PRESETS.map((preset) => {
            const isSelected = currentPreset === preset.id;
            return (
              <button
                key={preset.id}
                onClick={() => onSelectPreset(preset.id)}
                className={`p-2.5 rounded-xl text-xs font-medium transition-colors cursor-pointer border text-left ${
                  isSelected 
                    ? 'bg-indigo-950/80 border-indigo-700 text-indigo-200' 
                    : 'bg-zinc-900 border-zinc-800 hover:bg-zinc-800 text-zinc-300'
                }`}
              >
                {preset.label}
              </button>
            );
          })}
        </div>

        {/* Controles de Ajuste Fino */}
        <div className="space-y-3 pt-4 border-t border-zinc-800">
          <div className="flex flex-col gap-1">
            <div className="flex justify-between text-[11px] text-zinc-400">
              <span>Calidez</span>
              <span>{warmth}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={warmth}
              onChange={(e) => onChangeWarmth(Number(e.target.value))}
              className="w-full accent-indigo-500 cursor-pointer"
            />
          </div>

          <div className="flex flex-col gap-1">
            <div className="flex justify-between text-[11px] text-zinc-400">
              <span>Contraste</span>
              <span>{contrast}%</span>
            </div>
            <input
              type="range"
              min="50"
              max="150"
              value={contrast}
              onChange={(e) => onChangeContrast(Number(e.target.value))}
              className="w-full accent-indigo-500 cursor-pointer"
            />
          </div>

          <div className="flex flex-col gap-1">
            <div className="flex justify-between text-[11px] text-zinc-400">
              <span>Luminancia</span>
              <span>{luminance}%</span>
            </div>
            <input
              type="range"
              min="50"
              max="150"
              value={luminance}
              onChange={(e) => onChangeLuminance(Number(e.target.value))}
              className="w-full accent-indigo-500 cursor-pointer"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
```
