/**
 * KuraScroll - Sprint 114: Adaptive Boustrophedon Panel Sequence Flow & Cinematic Camera Pan Director Hook
 * 
 * Hardware Target: Intel Pentium T4500 (2C/2T @ 2.30 GHz, Penryn 45nm, no AVX, heap <= 512MB) & Intel GMA 4500MHD.
 * Pure transform-only camera motion: translate3d() + scale() + rotate(). Zero blur, zero CLS, zero layout shifts.
 * Bound to key 'C' / 'c' for HUD toggling.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';

export type ReadingFlow =
  | 'manga_rtl_zigzag'
  | 'webtoon_vertical'
  | 'comic_ltr_zigzag'
  | 'cinematic_freeflow';

export type TransitionEasing =
  | 'cubic_bezier_cinematic'
  | 'ease_in_out'
  | 'snappy_linear'
  | 'dramatic_punch';

export interface BoustrophedonCameraProfile {
  seriesId: string;
  readingFlow: ReadingFlow;
  transitionEasing: TransitionEasing;
  climaxZoomMultiplier: number;
  panLeadInPct: number;
  maxRotationDeg: number;
  isEnabled: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface PanelGeometry {
  id?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  isClimax?: boolean;
}

export interface CameraTrajectoryPlan {
  ax: number;
  bx: number;
  cx: number;
  dx: number;
  ay: number;
  by: number;
  cy: number;
  dy: number;
  zoomFrom: number;
  zoomTo: number;
  rotationFrom: number;
  rotationTo: number;
  targetWidth: number;
  targetHeight: number;
  flow: ReadingFlow;
  easing: TransitionEasing;
}

export interface CameraEvaluatedState {
  x: number;
  y: number;
  zoom: number;
  rotationDeg: number;
  cssTransform: string;
  latencyUs: number;
}

export interface CameraFlowPreset {
  flow: ReadingFlow;
  label: string;
  description: string;
  defaultEasing: TransitionEasing;
  defaultZoom: number;
  defaultLeadIn: number;
}

export const CAMERA_FLOW_PRESETS: Record<ReadingFlow, CameraFlowPreset> = {
  manga_rtl_zigzag: {
    flow: 'manga_rtl_zigzag',
    label: 'Manga RTL Zigzag',
    description: 'Traditional Japanese reading order: Right-to-left priority before descending.',
    defaultEasing: 'cubic_bezier_cinematic',
    defaultZoom: 1.25,
    defaultLeadIn: 15,
  },
  webtoon_vertical: {
    flow: 'webtoon_vertical',
    label: 'Webtoon Vertical Ribbon',
    description: 'Continuous vertical pan along long canvas with subtle centering.',
    defaultEasing: 'ease_in_out',
    defaultZoom: 1.2,
    defaultLeadIn: 20,
  },
  comic_ltr_zigzag: {
    flow: 'comic_ltr_zigzag',
    label: 'Western Comic LTR Zigzag',
    description: 'Left-to-right sequential reading order with smooth row jumps.',
    defaultEasing: 'cubic_bezier_cinematic',
    defaultZoom: 1.25,
    defaultLeadIn: 15,
  },
  cinematic_freeflow: {
    flow: 'cinematic_freeflow',
    label: 'Cinematic Freeflow & Orbit',
    description: 'Dynamic camera director with tangent curves, punch easing, and subtle pitch.',
    defaultEasing: 'dramatic_punch',
    defaultZoom: 1.35,
    defaultLeadIn: 25,
  },
};

/**
 * Plans polynomial coefficients for camera trajectory
 */
export function planCameraTrajectory(
  panelA: PanelGeometry,
  panelB: PanelGeometry,
  profile: Partial<BoustrophedonCameraProfile> = {}
): CameraTrajectoryPlan {
  const flow = profile.readingFlow ?? 'manga_rtl_zigzag';
  const easing = profile.transitionEasing ?? 'cubic_bezier_cinematic';
  const climaxZoom = profile.climaxZoomMultiplier ?? 1.25;
  const leadInPct = (profile.panLeadInPct ?? 15) / 100;
  const maxRot = profile.maxRotationDeg ?? 0.0;

  const c0x = panelA.x + panelA.width * 0.5;
  const c0y = panelA.y + panelA.height * 0.5;
  const c1x = panelB.x + panelB.width * 0.5;
  const c1y = panelB.y + panelB.height * 0.5;

  const dxTotal = c1x - c0x;
  const dyTotal = c1y - c0y;

  let p1x: number;
  let p1y: number;
  let p2x: number;
  let p2y: number;

  switch (flow) {
    case 'manga_rtl_zigzag':
      p1x = c0x + dxTotal * (0.5 + leadInPct);
      p1y = c0y + dyTotal * 0.1;
      p2x = c1x - dxTotal * 0.1;
      p2y = c1y - dyTotal * 0.4;
      break;

    case 'webtoon_vertical':
      p1x = c0x + dxTotal * 0.1;
      p1y = c0y + dyTotal * (0.4 + leadInPct);
      p2x = c1x - dxTotal * 0.1;
      p2y = c1y - dyTotal * (0.4 - leadInPct);
      break;

    case 'comic_ltr_zigzag':
      p1x = c0x + dxTotal * (0.6 - leadInPct);
      p1y = c0y + dyTotal * 0.1;
      p2x = c1x - dxTotal * 0.1;
      p2y = c1y - dyTotal * 0.4;
      break;

    case 'cinematic_freeflow':
    default:
      p1x = c0x + dxTotal * 0.33;
      p1y = c0y + dyTotal * 0.15;
      p2x = c0x + dxTotal * 0.67;
      p2y = c1y - dyTotal * 0.15;
      break;
  }

  const ax = -c0x + 3 * p1x - 3 * p2x + c1x;
  const bx = 3 * c0x - 6 * p1x + 3 * p2x;
  const cx = -3 * c0x + 3 * p1x;
  const dx = c0x;

  const ay = -c0y + 3 * p1y - 3 * p2y + c1y;
  const by = 3 * c0y - 6 * p1y + 3 * p2y;
  const cy = -3 * c0y + 3 * p1y;
  const dy = c0y;

  return {
    ax,
    bx,
    cx,
    dx,
    ay,
    by,
    cy,
    dy,
    zoomFrom: panelA.isClimax ? climaxZoom : 1.0,
    zoomTo: panelB.isClimax ? climaxZoom : 1.0,
    rotationFrom: 0.0,
    rotationTo: panelB.isClimax ? maxRot : 0.0,
    targetWidth: panelB.width,
    targetHeight: panelB.height,
    flow,
    easing,
  };
}

/**
 * Ultra-fast zero-allocation camera evaluation using Horner's rule
 */
export function evaluateCameraTrajectory(
  plan: CameraTrajectoryPlan,
  progress: number
): CameraEvaluatedState {
  const startHr = typeof performance !== 'undefined' ? performance.now() : 0;
  const rawT = progress <= 0 ? 0 : progress >= 1 ? 1 : progress;

  let t = rawT;
  switch (plan.easing) {
    case 'snappy_linear':
      t = rawT;
      break;
    case 'ease_in_out':
      t = rawT < 0.5 ? 2 * rawT * rawT : -1 + (4 - 2 * rawT) * rawT;
      break;
    case 'dramatic_punch':
      const inv = 1 - rawT;
      t = 1 - inv * inv * inv;
      break;
    case 'cubic_bezier_cinematic':
    default:
      t = rawT * rawT * (3 - 2 * rawT);
      break;
  }

  const x = ((plan.ax * t + plan.bx) * t + plan.cx) * t + plan.dx;
  const y = ((plan.ay * t + plan.by) * t + plan.cy) * t + plan.dy;
  const zoom = plan.zoomFrom + (plan.zoomTo - plan.zoomFrom) * t;
  const rotationDeg = plan.rotationFrom + (plan.rotationTo - plan.rotationFrom) * t;

  const transformParts = [
    `translate3d(${-x.toFixed(2)}px, ${-y.toFixed(2)}px, 0)`,
    `scale(${zoom.toFixed(4)})`,
  ];
  if (Math.abs(rotationDeg) > 0.01) {
    transformParts.push(`rotate(${rotationDeg.toFixed(2)}deg)`);
  }

  const latencyUs =
    typeof performance !== 'undefined' ? (performance.now() - startHr) * 1000 : 0.5;

  return {
    x,
    y,
    zoom,
    rotationDeg,
    cssTransform: transformParts.join(' '),
    latencyUs,
  };
}

export function useBoustrophedonCamera(seriesId: string) {
  const [isHUDOpen, setIsHUDOpen] = useState(false);
  const [readingFlow, setReadingFlow] = useState<ReadingFlow>('manga_rtl_zigzag');
  const [transitionEasing, setTransitionEasing] =
    useState<TransitionEasing>('cubic_bezier_cinematic');
  const [climaxZoomMultiplier, setClimaxZoomMultiplier] = useState(1.25);
  const [panLeadInPct, setPanLeadInPct] = useState(15);
  const [maxRotationDeg, setMaxRotationDeg] = useState(0.0);
  const [isEnabled, setIsEnabled] = useState(true);
  const [progress, setProgress] = useState(0);

  // Default synthetic panels for preview/telemetry
  const samplePanelA = useMemo<PanelGeometry>(
    () => ({ x: 100, y: 100, width: 400, height: 300, isClimax: false }),
    []
  );
  const samplePanelB = useMemo<PanelGeometry>(
    () => ({ x: 600, y: 700, width: 450, height: 350, isClimax: true }),
    []
  );

  const plan = useMemo(
    () =>
      planCameraTrajectory(samplePanelA, samplePanelB, {
        readingFlow,
        transitionEasing,
        climaxZoomMultiplier,
        panLeadInPct,
        maxRotationDeg,
      }),
    [
      samplePanelA,
      samplePanelB,
      readingFlow,
      transitionEasing,
      climaxZoomMultiplier,
      panLeadInPct,
      maxRotationDeg,
    ]
  );

  const currentCameraState = useMemo(
    () => evaluateCameraTrajectory(plan, progress),
    [plan, progress]
  );

  // Keyboard hotkey 'C' / 'c' toggle
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInput =
        activeEl instanceof HTMLInputElement ||
        activeEl instanceof HTMLTextAreaElement ||
        (activeEl as HTMLElement)?.isContentEditable;

      if (!isInput && (e.key === 'c' || e.key === 'C')) {
        e.preventDefault();
        setIsHUDOpen((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const selectFlow = useCallback((flow: ReadingFlow) => {
    setReadingFlow(flow);
    const preset = CAMERA_FLOW_PRESETS[flow];
    if (preset) {
      setTransitionEasing(preset.defaultEasing);
      setClimaxZoomMultiplier(preset.defaultZoom);
      setPanLeadInPct(preset.defaultLeadIn);
    }
  }, []);

  return {
    isHUDOpen,
    setIsHUDOpen,
    readingFlow,
    setReadingFlow,
    transitionEasing,
    setTransitionEasing,
    climaxZoomMultiplier,
    setClimaxZoomMultiplier,
    panLeadInPct,
    setPanLeadInPct,
    maxRotationDeg,
    setMaxRotationDeg,
    isEnabled,
    setIsEnabled,
    progress,
    setProgress,
    plan,
    currentCameraState,
    selectFlow,
  };
}
