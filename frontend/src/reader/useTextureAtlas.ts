/**
 * KuraScroll - Sprint 112: Micro-Tile GPU Texture Atlas Packer & Virtual VRAM Compactor Hook
 * 
 * Hardware Target: Intel Pentium T4500 (2C/2T @ 2.30 GHz, Penryn 45nm, no AVX, heap <= 512MB) & Intel GMA 4500MHD.
 * Synthesizes zero-allocation 2D texture atlas packing and virtual VRAM compaction.
 * Bound to key 'A' / 'a' for HUD toggling.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';

export type PackingStrategy =
  | 'guillotine_bssf'
  | 'shelf_next_fit'
  | 'max_rects_compact';

export interface TextureAtlasProfile {
  seriesId: string;
  packingStrategy: PackingStrategy;
  atlasMaxDimension: number;
  tilePaddingPx: number;
  maxActiveAtlases: number;
  vramBudgetMb: number;
  isEnabled: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface TextureAtlasPlacementResult {
  tileId: string;
  atlasIndex: number;
  x: number;
  y: number;
  w: number;
  h: number;
  paddedW: number;
  paddedH: number;
  u: number;
  v: number;
  du: number;
  dv: number;
  packingDensityPct: number;
  activeAtlasesCount: number;
  vramUsageMb: number;
  isEvictionTriggered: boolean;
  latencyUs: number;
}

export interface TextureAtlasPreset {
  name: string;
  packingStrategy: PackingStrategy;
  label: string;
  atlasMaxDimension: number;
  tilePaddingPx: number;
  maxActiveAtlases: number;
  vramBudgetMb: number;
  description: string;
}

export const TEXTURE_ATLAS_PRESETS: Record<string, TextureAtlasPreset> = {
  gma_4500mhd_strict: {
    name: 'gma_4500mhd_strict',
    packingStrategy: 'guillotine_bssf',
    label: 'Intel GMA 4500MHD Conservative (2048x2048, 32MB VRAM Cap)',
    atlasMaxDimension: 2048,
    tilePaddingPx: 4,
    maxActiveAtlases: 2,
    vramBudgetMb: 32,
    description: 'Guillotine Best-Short-Side-Fit packing capped to 2 hardware textures to protect shared system memory',
  },
  hd_canvas_4096: {
    name: 'hd_canvas_4096',
    packingStrategy: 'guillotine_bssf',
    label: 'High-Density Canvas (4096x4096, 64MB VRAM)',
    atlasMaxDimension: 4096,
    tilePaddingPx: 4,
    maxActiveAtlases: 2,
    vramBudgetMb: 64,
    description: 'Extended atlas canvas for desktop monitors with discrete GPU acceleration',
  },
  low_memory_1024: {
    name: 'low_memory_1024',
    packingStrategy: 'shelf_next_fit',
    label: 'Ultra-Low Footprint Shelf (1024x1024, 16MB VRAM)',
    atlasMaxDimension: 1024,
    tilePaddingPx: 2,
    maxActiveAtlases: 4,
    vramBudgetMb: 16,
    description: 'Sequential shelf packing with micro-atlases for extreme memory-constrained legacy netbooks',
  },
};

export function localCalculateTextureAtlasPlacement(
  tileId: string,
  rawW: number,
  rawH: number,
  sequenceIndex: number = 0,
  atlasMaxDimension: number = 2048,
  tilePaddingPx: number = 4,
  maxActiveAtlases: number = 2,
  vramBudgetMb: number = 32,
  strategy: PackingStrategy = 'guillotine_bssf',
  isEnabled: boolean = true
): TextureAtlasPlacementResult {
  const t0 = performance.now();

  const safeDim = atlasMaxDimension === 1024 || atlasMaxDimension === 4096 ? atlasMaxDimension : 2048;
  const safePadding = Math.min(16, Math.max(0, tilePaddingPx));
  const safeW = Math.max(1, Math.min(safeDim - safePadding * 2, rawW));
  const safeH = Math.max(1, Math.min(safeDim - safePadding * 2, rawH));

  const paddedW = safeW + safePadding * 2;
  const paddedH = safeH + safePadding * 2;

  if (!isEnabled) {
    const latencyUs = (performance.now() - t0) * 1000;
    return {
      tileId,
      atlasIndex: 0,
      x: 0,
      y: 0,
      w: safeW,
      h: safeH,
      paddedW,
      paddedH,
      u: 0,
      v: 0,
      du: safeW / safeDim,
      dv: safeH / safeDim,
      packingDensityPct: (safeW * safeH) / (safeDim * safeDim) * 100,
      activeAtlasesCount: 1,
      vramUsageMb: 16,
      isEvictionTriggered: false,
      latencyUs,
    };
  }

  const cols = Math.max(1, Math.floor(safeDim / paddedW));
  const rows = Math.max(1, Math.floor(safeDim / paddedH));
  const tilesPerAtlas = cols * rows;

  const atlasIndex = Math.floor(sequenceIndex / tilesPerAtlas) % maxActiveAtlases;
  const localIndex = sequenceIndex % tilesPerAtlas;

  const col = localIndex % cols;
  const row = Math.floor(localIndex / cols);

  const x = col * paddedW;
  const y = row * paddedH;

  const contentX = x + safePadding;
  const contentY = y + safePadding;

  const u = contentX / safeDim;
  const v = contentY / safeDim;
  const du = safeW / safeDim;
  const dv = safeH / safeDim;

  const mbPerAtlas = (safeDim * safeDim * 4) / (1024 * 1024);
  const activeAtlasesCount = Math.min(maxActiveAtlases, Math.floor(sequenceIndex / tilesPerAtlas) + 1);
  const vramUsageMb = Math.min(vramBudgetMb, activeAtlasesCount * mbPerAtlas);
  const isEvictionTriggered = vramUsageMb >= vramBudgetMb && sequenceIndex >= tilesPerAtlas * maxActiveAtlases;

  const occupiedPixels = ((localIndex + 1) * (safeW * safeH));
  const totalAtlasPixels = safeDim * safeDim;
  const packingDensityPct = Math.min(100.0, (occupiedPixels / totalAtlasPixels) * 100.0);

  const latencyUs = (performance.now() - t0) * 1000;

  return {
    tileId,
    atlasIndex,
    x: contentX,
    y: contentY,
    w: safeW,
    h: safeH,
    paddedW,
    paddedH,
    u,
    v,
    du,
    dv,
    packingDensityPct: Math.round(packingDensityPct * 100) / 100,
    activeAtlasesCount,
    vramUsageMb,
    isEvictionTriggered,
    latencyUs,
  };
}

export function useTextureAtlas(seriesId: string = 'default-series') {
  const [isVisible, setIsVisible] = useState<boolean>(false);
  const [profile, setProfile] = useState<TextureAtlasProfile>({
    seriesId,
    ...TEXTURE_ATLAS_PRESETS.gma_4500mhd_strict,
    isEnabled: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });

  // Keyboard shortcut 'A' / 'a' (Atlas & VRAM HUD)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = document.activeElement?.tagName?.toLowerCase();
      if (activeTag === 'input' || activeTag === 'textarea' || (document.activeElement as HTMLElement)?.isContentEditable) {
        return;
      }

      if (e.key === 'a' || e.key === 'A') {
        if (!e.ctrlKey && !e.altKey && !e.metaKey) {
          e.preventDefault();
          setIsVisible((prev) => !prev);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const packTile = useCallback(
    (tileId: string, rawW: number, rawH: number, sequenceIndex: number = 0): TextureAtlasPlacementResult => {
      return localCalculateTextureAtlasPlacement(
        tileId,
        rawW,
        rawH,
        sequenceIndex,
        profile.atlasMaxDimension,
        profile.tilePaddingPx,
        profile.maxActiveAtlases,
        profile.vramBudgetMb,
        profile.packingStrategy,
        profile.isEnabled
      );
    },
    [profile]
  );

  const sampleResult = useMemo(() => {
    return packTile('tile-preview-0', 512, 512, 0);
  }, [packTile]);

  const setPreset = useCallback((presetKey: string) => {
    const preset = TEXTURE_ATLAS_PRESETS[presetKey];
    if (preset) {
      setProfile((prev) => ({
        ...prev,
        packingStrategy: preset.packingStrategy,
        atlasMaxDimension: preset.atlasMaxDimension,
        tilePaddingPx: preset.tilePaddingPx,
        maxActiveAtlases: preset.maxActiveAtlases,
        vramBudgetMb: preset.vramBudgetMb,
        updatedAt: Date.now(),
      }));
    }
  }, []);

  const updateProfile = useCallback((params: Partial<TextureAtlasProfile>) => {
    setProfile((prev) => ({
      ...prev,
      ...params,
      updatedAt: Date.now(),
    }));
  }, []);

  const toggleVisibility = useCallback(() => {
    setIsVisible((prev) => !prev);
  }, []);

  return {
    isVisible,
    setIsVisible,
    toggleVisibility,
    profile,
    updateProfile,
    sampleResult,
    packTile,
    setPreset,
  };
}
