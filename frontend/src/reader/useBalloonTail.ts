/**
 * KuraScroll - Sprint 116: Adaptive Dialogue Balloon Tail Tracking & Dynamic Focus Pointer Hook
 * 
 * Hardware Target: Intel Pentium T4500 (2C/2T @ 2.30 GHz, Penryn 45nm, no AVX, heap <= 512MB) & Intel GMA 4500MHD.
 * Pure vector geometry math with zero layout thrashing, 0 CSS blur, 0 CLS.
 * Bound to key 'T' / 't' for HUD toggling.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';

export type TailStyle =
  | 'manga_compact'
  | 'expressive_curve'
  | 'manhwa_clean'
  | 'whisper_subtle'
  | 'shout_dynamic';

export type BalloonShape = 'ellipse' | 'rounded_rect' | 'polygon_shout';

export interface BalloonTailProfile {
  seriesId: string;
  tailStyle: TailStyle;
  balloonShape: BalloonShape;
  rootWidthPx: number;
  curvatureFactor: number;
  tipOffsetPx: number;
  isEnabled: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface BalloonTailPreset {
  name: TailStyle;
  tailStyle: TailStyle;
  label: string;
  balloonShape: BalloonShape;
  rootWidthPx: number;
  curvatureFactor: number;
  tipOffsetPx: number;
  description: string;
}

export const BALLOON_TAIL_PRESETS: Record<TailStyle, BalloonTailPreset> = {
  manga_compact: {
    name: 'manga_compact',
    tailStyle: 'manga_compact',
    label: 'Classic Manga Compact',
    balloonShape: 'ellipse',
    rootWidthPx: 12.0,
    curvatureFactor: 0.08,
    tipOffsetPx: 4.0,
    description: 'Crisp, short direct tail pointing cleanly from dialog oval towards speaker face.',
  },
  expressive_curve: {
    name: 'expressive_curve',
    tailStyle: 'expressive_curve',
    label: 'Expressive Dramatic Sweep',
    balloonShape: 'ellipse',
    rootWidthPx: 18.0,
    curvatureFactor: 0.22,
    tipOffsetPx: 6.0,
    description: 'Sweeping parabolic curve accentuating emotional emphasis and wide-angle panels.',
  },
  manhwa_clean: {
    name: 'manhwa_clean',
    tailStyle: 'manhwa_clean',
    label: 'Modern Manhwa Minimalist',
    balloonShape: 'rounded_rect',
    rootWidthPx: 14.0,
    curvatureFactor: 0.12,
    tipOffsetPx: 3.0,
    description: 'Sleek geometric pointer tailored for digital vertical webtoons and squircle balloons.',
  },
  whisper_subtle: {
    name: 'whisper_subtle',
    tailStyle: 'whisper_subtle',
    label: 'Whisper Soft Pointer',
    balloonShape: 'ellipse',
    rootWidthPx: 8.0,
    curvatureFactor: 0.05,
    tipOffsetPx: 8.0,
    description: 'Thin, unobtrusive tapered pointer with generous standoff distance.',
  },
  shout_dynamic: {
    name: 'shout_dynamic',
    tailStyle: 'shout_dynamic',
    label: 'Shout & Impact Jagged',
    balloonShape: 'polygon_shout',
    rootWidthPx: 24.0,
    curvatureFactor: 0.3,
    tipOffsetPx: 2.0,
    description: 'Broad root base with sudden energetic angle suitable for action exclamations.',
  },
};

export interface BalloonTailResult {
  tailStyle: TailStyle;
  balloonShape: BalloonShape;
  rootLeftX: number;
  rootLeftY: number;
  rootRightX: number;
  rootRightY: number;
  controlX: number;
  controlY: number;
  tipX: number;
  tipY: number;
  angleDeg: number;
  lengthPx: number;
  svgPathD: string;
  latencyUs: number;
}

export function localCalculateBalloonTail(
  balloonCenterX: number,
  balloonCenterY: number,
  radiusX: number,
  radiusY: number,
  targetAnchorX: number,
  targetAnchorY: number,
  tailStyle: TailStyle = 'manga_compact',
  balloonShape: BalloonShape = 'ellipse',
  rootWidthPx: number = 14.0,
  curvatureFactor: number = 0.15,
  tipOffsetPx: number = 4.0,
  isEnabled: boolean = true
): BalloonTailResult {
  const startHr = typeof performance !== 'undefined' ? performance.now() : 0;

  if (!isEnabled) {
    return {
      tailStyle,
      balloonShape,
      rootLeftX: 0,
      rootLeftY: 0,
      rootRightX: 0,
      rootRightY: 0,
      controlX: 0,
      controlY: 0,
      tipX: 0,
      tipY: 0,
      angleDeg: 0,
      lengthPx: 0,
      svgPathD: '',
      latencyUs: typeof performance !== 'undefined' ? (performance.now() - startHr) * 1000 : 0.5,
    };
  }

  const vx = targetAnchorX - balloonCenterX;
  const vy = targetAnchorY - balloonCenterY;
  const dist = Math.hypot(vx, vy);

  const safeDist = dist < 0.001 ? 0.001 : dist;
  const ux = vx / safeDist;
  const uy = vy / safeDist;

  const nx = -uy;
  const ny = ux;

  const angleDeg = (Math.atan2(vy, vx) * 180) / Math.PI;

  let rPerimeter: number;
  if (balloonShape === 'rounded_rect') {
    const absCos = Math.abs(ux);
    const absSin = Math.abs(uy);
    const scaleX = absCos > 0.0001 ? radiusX / absCos : radiusX;
    const scaleY = absSin > 0.0001 ? radiusY / absSin : radiusY;
    rPerimeter = Math.min(scaleX, scaleY);
  } else {
    const term1 = radiusY * ux;
    const term2 = radiusX * uy;
    const denom = Math.sqrt(term1 * term1 + term2 * term2);
    rPerimeter = denom > 0.0001 ? (radiusX * radiusY) / denom : radiusX;
  }

  const rootCenterX = balloonCenterX + rPerimeter * ux;
  const rootCenterY = balloonCenterY + rPerimeter * uy;

  const halfBase = rootWidthPx * 0.5;
  const rootLeftX = rootCenterX + halfBase * nx;
  const rootLeftY = rootCenterY + halfBase * ny;
  const rootRightX = rootCenterX - halfBase * nx;
  const rootRightY = rootCenterY - halfBase * ny;

  const effectiveTipDist = Math.max(rPerimeter + 5, safeDist - tipOffsetPx);
  const tipX = balloonCenterX + effectiveTipDist * ux;
  const tipY = balloonCenterY + effectiveTipDist * uy;

  const midX = (rootCenterX + tipX) * 0.5;
  const midY = (rootCenterY + tipY) * 0.5;
  const tailLength = effectiveTipDist - rPerimeter;
  const curveOffset = tailLength * curvatureFactor;

  const controlX = midX + curveOffset * nx;
  const controlY = midY + curveOffset * ny;

  const svgPathD = `M ${rootLeftX.toFixed(1)} ${rootLeftY.toFixed(1)} Q ${controlX.toFixed(1)} ${controlY.toFixed(1)} ${tipX.toFixed(1)} ${tipY.toFixed(1)} Q ${controlX.toFixed(1)} ${controlY.toFixed(1)} ${rootRightX.toFixed(1)} ${rootRightY.toFixed(1)} Z`;

  return {
    tailStyle,
    balloonShape,
    rootLeftX,
    rootLeftY,
    rootRightX,
    rootRightY,
    controlX,
    controlY,
    tipX,
    tipY,
    angleDeg,
    lengthPx: tailLength,
    svgPathD,
    latencyUs: typeof performance !== 'undefined' ? (performance.now() - startHr) * 1000 : 0.5,
  };
}

export function useBalloonTail(seriesId: string) {
  const [isHUDOpen, setIsHUDOpen] = useState(false);
  const [tailStyle, setTailStyle] = useState<TailStyle>('manga_compact');
  const [balloonShape, setBalloonShape] = useState<BalloonShape>('ellipse');
  const [rootWidthPx, setRootWidthPx] = useState(14.0);
  const [curvatureFactor, setCurvatureFactor] = useState(0.15);
  const [tipOffsetPx, setTipOffsetPx] = useState(4.0);
  const [isEnabled, setIsEnabled] = useState(true);

  // Sample interactive balloon & speaker position coordinates
  const [balloonCenter, setBalloonCenter] = useState({ x: 120, y: 70 });
  const [speakerTarget, setSpeakerTarget] = useState({ x: 220, y: 160 });
  const balloonRadii = useMemo(() => ({ rx: 65, ry: 40 }), []);

  const currentResult = useMemo(
    () =>
      localCalculateBalloonTail(
        balloonCenter.x,
        balloonCenter.y,
        balloonRadii.rx,
        balloonRadii.ry,
        speakerTarget.x,
        speakerTarget.y,
        tailStyle,
        balloonShape,
        rootWidthPx,
        curvatureFactor,
        tipOffsetPx,
        isEnabled
      ),
    [
      balloonCenter,
      balloonRadii,
      speakerTarget,
      tailStyle,
      balloonShape,
      rootWidthPx,
      curvatureFactor,
      tipOffsetPx,
      isEnabled,
    ]
  );

  // Keyboard hotkey 'T' / 't' toggle
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInput =
        activeEl instanceof HTMLInputElement ||
        activeEl instanceof HTMLTextAreaElement ||
        (activeEl as HTMLElement)?.isContentEditable;

      if (!isInput && (e.key === 't' || e.key === 'T')) {
        e.preventDefault();
        setIsHUDOpen((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const selectPreset = useCallback((style: TailStyle) => {
    setTailStyle(style);
    const preset = BALLOON_TAIL_PRESETS[style];
    if (preset) {
      setBalloonShape(preset.balloonShape);
      setRootWidthPx(preset.rootWidthPx);
      setCurvatureFactor(preset.curvatureFactor);
      setTipOffsetPx(preset.tipOffsetPx);
    }
  }, []);

  return {
    isHUDOpen,
    setIsHUDOpen,
    tailStyle,
    setTailStyle,
    balloonShape,
    setBalloonShape,
    rootWidthPx,
    setRootWidthPx,
    curvatureFactor,
    setCurvatureFactor,
    tipOffsetPx,
    setTipOffsetPx,
    isEnabled,
    setIsEnabled,
    balloonCenter,
    setBalloonCenter,
    speakerTarget,
    setSpeakerTarget,
    currentResult,
    selectPreset,
  };
}
