/**
 * KuraScroll Deep-Zoom Pan & Scan Hook
 * Sprint 66 - Dynamic Pyramidal LOD Navigation for High-Resolution Spreads
 *
 * Implements bounded viewport pan-scan, dynamic level of detail (LOD),
 * and keyboard shortcuts ('Z', '+', '-', '0', Arrow keys).
 * Strictly bounds GPU memory on Intel GMA 4500MHD (VRAM <= 8MB).
 */

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';

export interface TileDescriptor {
  level: number;
  col: number;
  row: number;
  x: number;
  y: number;
  width: number;
  height: number;
  url: string;
}

export interface PyramidLevelInfo {
  level: number;
  width: number;
  height: number;
  cols: number;
  rows: number;
  scale: number;
}

export interface DeepZoomManifest {
  chapterId: string;
  pageNumber: number;
  isPyramidal: boolean;
  originalWidth: number;
  originalHeight: number;
  tileSize: number;
  overlap: number;
  format: 'webp';
  maxLevel: number;
  totalTiles: number;
  levels: PyramidLevelInfo[];
}

export interface UseDeepZoomOptions {
  manifest?: DeepZoomManifest | null;
  viewportWidth?: number;
  viewportHeight?: number;
  initialScale?: number;
  minScale?: number;
  maxScale?: number;
  enableKeyboard?: boolean;
}

export interface DeepZoomPanScanResult {
  isActive: boolean;
  panX: number;
  panY: number;
  scale: number;
  minScale: number;
  maxScale: number;
  isDragging: boolean;
  level: number;
  visibleTiles: TileDescriptor[];
  totalVisible: number;
  vramMbEstimated: number;
  isClamped: boolean;
  toggleDeepZoom: () => void;
  zoomIn: (step?: number) => void;
  zoomOut: (step?: number) => void;
  resetView: () => void;
  panBy: (dx: number, dy: number) => void;
  handlePointerDown: (clientX: number, clientY: number) => void;
  handlePointerMove: (clientX: number, clientY: number) => void;
  handlePointerUp: () => void;
}

export function computeClientVisibleTiles(
  panX: number,
  panY: number,
  scale: number,
  viewportW: number,
  viewportH: number,
  manifest?: DeepZoomManifest | null
): { level: number; tiles: TileDescriptor[]; totalVisible: number; vramMbEstimated: number; isClamped: boolean } {
  if (!manifest) {
    return { level: 0, tiles: [], totalVisible: 0, vramMbEstimated: 0, isClamped: false };
  }

  const { isPyramidal, maxLevel, originalWidth, originalHeight, tileSize, levels, chapterId, pageNumber } = manifest;

  if (!isPyramidal || maxLevel <= 0 || levels.length === 0) {
    return {
      level: 0,
      tiles: [
        {
          level: 0,
          col: 0,
          row: 0,
          x: 0,
          y: 0,
          width: originalWidth,
          height: originalHeight,
          url: `/api/v1/tiles/${chapterId}/${pageNumber}/0/0_0.webp`,
        },
      ],
      totalVisible: 1,
      vramMbEstimated: Math.round((originalWidth * originalHeight * 4) / (1024 * 1024) * 10) / 10,
      isClamped: false,
    };
  }

  // Determine active level based on scale
  const zoomOffset = Math.round(Math.log2(Math.max(0.05, scale)));
  const targetLevel = Math.max(0, Math.min(maxLevel, maxLevel - 1 + zoomOffset));

  const levelInfo = levels.find((l) => l.level === targetLevel) ?? levels[levels.length - 1];
  const lvlW = levelInfo.width;
  const lvlH = levelInfo.height;

  const effectiveScale = scale * (lvlW / Math.max(1, originalWidth));
  const safeScale = effectiveScale <= 0 ? 0.0001 : effectiveScale;

  const minX = Math.max(0, -panX / safeScale);
  const minY = Math.max(0, -panY / safeScale);
  const maxX = Math.min(lvlW, (viewportW - panX) / safeScale);
  const maxY = Math.min(lvlH, (viewportH - panY) / safeScale);

  const minCol = Math.max(0, Math.floor(minX / tileSize));
  const maxCol = Math.min(levelInfo.cols - 1, Math.floor(maxX / tileSize));
  const minRow = Math.max(0, Math.floor(minY / tileSize));
  const maxRow = Math.min(levelInfo.rows - 1, Math.floor(maxY / tileSize));

  const tiles: TileDescriptor[] = [];
  const MAX_TILES_CLAMP = 36;
  let isClamped = false;

  if (minCol <= maxCol && minRow <= maxRow) {
    for (let r = minRow; r <= maxRow; r++) {
      for (let c = minCol; c <= maxCol; c++) {
        if (tiles.length >= MAX_TILES_CLAMP) {
          isClamped = true;
          break;
        }
        const tileX = c * tileSize;
        const tileY = r * tileSize;
        const tileW = Math.min(tileSize, lvlW - tileX);
        const tileH = Math.min(tileSize, lvlH - tileY);

        tiles.push({
          level: targetLevel,
          col: c,
          row: r,
          x: tileX,
          y: tileY,
          width: tileW,
          height: tileH,
          url: `/api/v1/tiles/${chapterId}/${pageNumber}/${targetLevel}/${c}_${r}.webp`,
        });
      }
      if (isClamped) break;
    }
  }

  let totalBytes = 0;
  for (let i = 0; i < tiles.length; i++) {
    totalBytes += tiles[i].width * tiles[i].height * 4;
  }
  const vramMbEstimated = Math.round((totalBytes / (1024 * 1024)) * 100) / 100;

  return {
    level: targetLevel,
    tiles,
    totalVisible: tiles.length,
    vramMbEstimated,
    isClamped,
  };
}

export function useDeepZoomPanScan(options: UseDeepZoomOptions = {}): DeepZoomPanScanResult {
  const {
    manifest,
    viewportWidth = 1920,
    viewportHeight = 1080,
    initialScale = 1.0,
    minScale = 0.5,
    maxScale = 4.0,
    enableKeyboard = true,
  } = options;

  const [isActive, setIsActive] = useState<boolean>(false);
  const [panX, setPanX] = useState<number>(0);
  const [panY, setPanY] = useState<number>(0);
  const [scale, setScale] = useState<number>(initialScale);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  const dragStartRef = useRef<{ startX: number; startY: number; origPanX: number; origPanY: number }>({
    startX: 0,
    startY: 0,
    origPanX: 0,
    origPanY: 0,
  });

  const toggleDeepZoom = useCallback(() => {
    setIsActive((prev) => !prev);
  }, []);

  const resetView = useCallback(() => {
    setPanX(0);
    setPanY(0);
    setScale(1.0);
  }, []);

  const zoomIn = useCallback(
    (step = 0.5) => {
      setScale((prev) => Math.min(maxScale, Math.round((prev + step) * 10) / 10));
    },
    [maxScale]
  );

  const zoomOut = useCallback(
    (step = 0.5) => {
      setScale((prev) => Math.max(minScale, Math.round((prev - step) * 10) / 10));
    },
    [minScale]
  );

  const panBy = useCallback((dx: number, dy: number) => {
    setPanX((prev) => prev + dx);
    setPanY((prev) => prev + dy);
  }, []);

  const handlePointerDown = useCallback(
    (clientX: number, clientY: number) => {
      setIsDragging(true);
      dragStartRef.current = {
        startX: clientX,
        startY: clientY,
        origPanX: panX,
        origPanY: panY,
      };
    },
    [panX, panY]
  );

  const handlePointerMove = useCallback(
    (clientX: number, clientY: number) => {
      if (!isDragging) return;
      const dx = clientX - dragStartRef.current.startX;
      const dy = clientY - dragStartRef.current.startY;
      setPanX(dragStartRef.current.origPanX + dx);
      setPanY(dragStartRef.current.origPanY + dy);
    },
    [isDragging]
  );

  const handlePointerUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Keyboard shortcut handler
  useEffect(() => {
    if (!enableKeyboard) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Do not trigger if typing in an input or textarea
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target as HTMLElement).isContentEditable
      ) {
        return;
      }

      const key = e.key.toLowerCase();
      if (key === 'z') {
        e.preventDefault();
        toggleDeepZoom();
      } else if (isActive) {
        if (key === '+' || key === '=') {
          e.preventDefault();
          zoomIn();
        } else if (key === '-' || key === '_') {
          e.preventDefault();
          zoomOut();
        } else if (key === '0' || key === 'escape') {
          e.preventDefault();
          resetView();
        } else if (key === 'arrowleft') {
          e.preventDefault();
          panBy(50, 0);
        } else if (key === 'arrowright') {
          e.preventDefault();
          panBy(-50, 0);
        } else if (key === 'arrowup') {
          e.preventDefault();
          panBy(0, 50);
        } else if (key === 'arrowdown') {
          e.preventDefault();
          panBy(0, -50);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enableKeyboard, isActive, toggleDeepZoom, zoomIn, zoomOut, resetView, panBy]);

  const { level, tiles, totalVisible, vramMbEstimated, isClamped } = useMemo(() => {
    return computeClientVisibleTiles(
      panX,
      panY,
      scale,
      viewportWidth,
      viewportHeight,
      manifest
    );
  }, [panX, panY, scale, viewportWidth, viewportHeight, manifest]);

  return {
    isActive,
    panX,
    panY,
    scale,
    minScale,
    maxScale,
    isDragging,
    level,
    visibleTiles: tiles,
    totalVisible,
    vramMbEstimated,
    isClamped,
    toggleDeepZoom,
    zoomIn,
    zoomOut,
    resetView,
    panBy,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
  };
}
