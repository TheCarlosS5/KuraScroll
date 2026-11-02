# Sprint 61: Spatial Attention Heatmap Overlay & Canvas 2D UI/UX Design

> [!IMPORTANT]
> Especificación técnica para el mapa de calor espacial en Canvas 2D de $16 \times 16$, optimizado para la GPU Intel GMA 4500MHD con **CLS = 0**.

---

## 1. Especificación de Componentes & Props

```tsx
export interface SpatialHeatmapOverlayProps {
  isVisible: boolean;
  opacity: number; // 0.1 a 0.8
  gridData: number[][]; // Matriz 16x16 con valores de atención normalizados (0.0 a 1.0)
}
```

---

## 2. Rampa de Color & Interpolación Bilineal (Canvas 2D)

```tsx
import React, { useEffect, useRef } from 'react';

export const SpatialHeatmapOverlay: React.FC<SpatialHeatmapOverlayProps> = ({
  isVisible,
  opacity,
  gridData,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!isVisible || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.imageSmoothingEnabled = true;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.globalAlpha = opacity;

    const rows = gridData.length;
    const cols = gridData[0]?.length || 0;
    const cellWidth = canvas.width / cols;
    const cellHeight = canvas.height / rows;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const val = gridData[r][c]; // 0.0 a 1.0
        if (val <= 0.05) continue;

        // Rampa de color paramétrica
        let color = 'transparent';
        if (val > 0.8) color = 'rgba(239, 68, 68, 0.75)'; // Rojo coral intenso
        else if (val > 0.6) color = 'rgba(234, 179, 8, 0.7)'; // Amarillo cálido
        else if (val > 0.3) color = 'rgba(6, 182, 212, 0.6)'; // Cian
        else color = 'rgba(30, 27, 75, 0.5)'; // Azul índigo

        ctx.fillStyle = color;
        ctx.fillRect(c * cellWidth, r * cellHeight, cellWidth + 1, cellHeight + 1);
      }
    }
  }, [isVisible, opacity, gridData]);

  if (!isVisible) return null;

  return (
    <div 
      className="absolute inset-0 pointer-events-none z-30 overflow-hidden"
      style={{ contain: 'layout paint' }}
      aria-hidden="true"
    >
      <canvas
        ref={canvasRef}
        width={800}
        height={1200}
        className="w-full h-full object-contain"
      />
    </div>
  );
};
```
