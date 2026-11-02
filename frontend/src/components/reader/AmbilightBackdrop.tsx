import React, { useMemo } from 'react';
import { RGBColor, DEFAULT_AMBIENT_RGB } from '../../utils/ambient-color-extractor';

export interface AmbilightBackdropProps {
  ambientColor?: RGBColor | null;
  enabled?: boolean;
  opacity?: number;
  theme?: string;
  thermalSaverActive?: boolean;
}

/**
 * Hardware-accelerated, zero-blur Ambilight backdrop designed strictly
 * for the Intel GMA 4500MHD GPU.
 * 
 * - Eliminates filter: blur() completely (0 fill-rate exhaustion).
 * - Uses native single-pass radial gradients rendered at 60 FPS.
 * - Hardware-accelerates opacity/color blending via CSS transitions.
 * - Automatically degrades to a flat dark tone when thermalSaverActive is true.
 */
export const AmbilightBackdrop: React.FC<AmbilightBackdropProps> = ({
  ambientColor = DEFAULT_AMBIENT_RGB,
  enabled = true,
  opacity = 0.28,
  theme = 'midnight',
  thermalSaverActive = false,
}) => {
  // If disabled or thermal saver is active, use static background to achieve 0% GPU load
  const isBypassed = !enabled || thermalSaverActive;

  const effectiveOpacity = useMemo(() => {
    if (isBypassed) return 0;
    // OLED theme requires very low opacity (12-15%) to avoid contrast eye strain
    if (theme === 'oled' || theme === '#000000' || theme === '#000') {
      return Math.min(opacity, 0.14);
    }
    // Sepia theme softly biased for warm paper reading
    if (theme === 'sepia' || theme === '#1a1612') {
      return Math.min(opacity, 0.22);
    }
    return Math.min(0.40, Math.max(0.05, opacity));
  }, [isBypassed, opacity, theme]);

  const backgroundStyle = useMemo(() => {
    if (isBypassed || !ambientColor) {
      if (theme === 'oled' || theme === '#000000' || theme === '#000') {
        return { backgroundColor: '#000000' };
      }
      if (theme === 'sepia' || theme === '#1a1612') {
        return { backgroundColor: '#1a1612' };
      }
      return { backgroundColor: '#080c14' };
    }

    const { r, g, b } = ambientColor;
    const centerColor = `rgba(${r}, ${g}, ${b}, ${effectiveOpacity})`;
    const midColor = `rgba(${r}, ${g}, ${b}, ${(effectiveOpacity * 0.35).toFixed(3)})`;
    const edgeColor = theme === 'oled' ? 'rgba(0, 0, 0, 0.98)' : 'rgba(8, 12, 20, 0.95)';

    return {
      background: `radial-gradient(ellipse at 50% 45%, ${centerColor} 0%, ${midColor} 55%, ${edgeColor} 88%)`,
    };
  }, [ambientColor, effectiveOpacity, isBypassed, theme]);

  return (
    <div
      data-testid="ambilight-backdrop"
      role="presentation"
      aria-hidden="true"
      className="fixed inset-0 pointer-events-none z-0 transition-[background,background-color] duration-700 ease-out"
      style={{
        ...backgroundStyle,
        contain: 'strict',
        transform: 'translateZ(0)', // Force GPU layer creation without layout recalculation
      }}
    />
  );
};
