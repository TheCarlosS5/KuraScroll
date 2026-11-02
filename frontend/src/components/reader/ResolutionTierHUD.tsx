/**
 * Sprint 58 - Resolution Tier HUD & Quality Selector
 *
 * Designed under Intel GMA 4500MHD hardware constraints:
 * - Pure solid colors (ZERO CSS blur, ZERO backdrop-filter)
 * - Strict layout containment (contain: layout paint) for CLS = 0
 * - Accessible controls for inspecting active WebP downsampling tier
 */

import React from 'react';
import { UseAdaptiveResolutionReturn, ResolutionTier, ResolutionOverride } from '../../reader/useAdaptiveResolution.js';

export interface ResolutionTierHUDProps {
  resolutionEngine: UseAdaptiveResolutionReturn;
}

export const ResolutionTierHUD: React.FC<ResolutionTierHUDProps> = ({ resolutionEngine }) => {
  const { targetWidth, tierName, dpr, isAuto, override, setOverride } = resolutionEngine;

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val === 'auto') {
      setOverride('auto');
    } else {
      setOverride(Number.parseInt(val, 10) as ResolutionTier);
    }
  };

  return (
    <div
      role="region"
      aria-label="Controles de Resolución y Downsampling"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        backgroundColor: '#18181b', // Pure solid, zero blur
        border: '1px solid #27272a',
        borderRadius: '6px',
        padding: '4px 10px',
        color: '#f4f4f5',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: '12px',
        contain: 'layout paint',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span style={{ color: '#00e5ff', fontWeight: 'bold' }}>📐</span>
        <span style={{ fontWeight: 600 }}>
          {targetWidth}px
        </span>
        <span
          style={{
            fontSize: '10px',
            color: '#a1a1aa',
            backgroundColor: '#27272a',
            padding: '2px 6px',
            borderRadius: '4px',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
          }}
        >
          {tierName} {isAuto ? '(Auto)' : '(Manual)'}
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        <label htmlFor="res-tier-select" style={{ fontSize: '11px', color: '#71717a' }}>
          Calidad:
        </label>
        <select
          id="res-tier-select"
          aria-label="Seleccionar resolución de imagen"
          value={override}
          onChange={handleSelectChange}
          style={{
            backgroundColor: '#27272a',
            color: '#f4f4f5',
            border: '1px solid #3f3f46',
            borderRadius: '4px',
            padding: '2px 6px',
            fontSize: '11px',
            cursor: 'pointer',
            outline: 'none',
          }}
        >
          <option value="auto">Auto (DPR {dpr.toFixed(1)}x)</option>
          <option value="800">800px (Ahorro Datos)</option>
          <option value="1200">1200px (GMA 4500MHD Equilibrado)</option>
          <option value="1600">1600px (Otaku Crisp 1080p)</option>
        </select>
      </div>
    </div>
  );
};
