/**
 * Sprint 56 - Screen Rumble & Haptic Settings HUD
 *
 * Designed under strict Intel GMA 4500MHD GPU constraints:
 * - ZERO backdrop-filter / CSS blur
 * - High-contrast opaque surfaces (#18181b)
 * - Pure hardware-accelerated transforms (0 CLS)
 */

import React, { useState } from 'react';
import {
  useImmersionEngine,
  ImmersionPreferencesState,
} from '../../reader/useImmersionEngine.js';
import { ImpactIntensity } from '../../reader/ImpactRouter.js';

interface ScreenRumbleHUDProps {
  engine?: ReturnType<typeof useImmersionEngine>;
  onClose?: () => void;
}

export const ScreenRumbleHUD: React.FC<ScreenRumbleHUDProps> = ({ engine, onClose }) => {
  const defaultEngine = useImmersionEngine();
  const imm = engine || defaultEngine;

  const [testStatus, setTestStatus] = useState<string | null>(null);

  const handleToggleHaptics = () => {
    imm.updatePreferences({ hapticsEnabled: !imm.preferences.hapticsEnabled });
  };

  const handleToggleRumble = () => {
    imm.updatePreferences({ screenRumbleEnabled: !imm.preferences.screenRumbleEnabled });
  };

  const handleToggleReducedMotionHaptics = () => {
    imm.updatePreferences({ hapticsWithReducedMotion: !imm.preferences.hapticsWithReducedMotion });
  };

  const handleHapticIntensityChange = (val: ImpactIntensity) => {
    imm.updatePreferences({ maxHapticIntensity: val });
  };

  const handleRumbleIntensityChange = (val: ImpactIntensity) => {
    imm.updatePreferences({ maxRumbleIntensity: val });
  };

  const handleTestVibration = () => {
    const ok = imm.testVibration();
    setTestStatus(ok ? 'Vibration pulsed!' : 'Vibration unavailable or simulated');
    setTimeout(() => setTestStatus(null), 2500);
  };

  const handleTestRumble = () => {
    const ok = imm.testRumble();
    setTestStatus(ok ? 'Screen Rumble triggered!' : 'Rumble suppressed (check settings)');
    setTimeout(() => setTestStatus(null), 2500);
  };

  return (
    <div
      role="region"
      aria-label="Screen Rumble and Haptic Immersion Controls"
      style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        width: '320px',
        backgroundColor: '#18181b', // Zero backdrop-filter, pure opaque for GMA 4500MHD
        border: '1px solid #3f3f46',
        borderRadius: '8px',
        padding: '16px',
        color: '#f4f4f5',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: '13px',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.6)',
        zIndex: 9999,
        contain: 'paint',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
        <div style={{ fontWeight: 700, fontSize: '14px', letterSpacing: '0.02em', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ color: '#ec4899' }}>⚡</span>
          <span>Tactile & Rumble Engine</span>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            aria-label="Close immersion settings"
            style={{
              background: 'transparent',
              border: 'none',
              color: '#a1a1aa',
              cursor: 'pointer',
              fontSize: '16px',
            }}
          >
            ✕
          </button>
        )}
      </div>

      {/* Hardware Status Indicators */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
        <span
          style={{
            padding: '3px 8px',
            borderRadius: '4px',
            fontSize: '11px',
            fontWeight: 600,
            backgroundColor: imm.isHapticSupported ? '#064e3b' : '#3f3f46',
            color: imm.isHapticSupported ? '#34d399' : '#a1a1aa',
          }}
        >
          {imm.isHapticSupported ? 'Haptics: Ready' : 'Haptics: No Actuator'}
        </span>
        <span
          style={{
            padding: '3px 8px',
            borderRadius: '4px',
            fontSize: '11px',
            fontWeight: 600,
            backgroundColor: imm.reducedMotion ? '#7c2d12' : '#27272a',
            color: imm.reducedMotion ? '#fdba74' : '#a1a1aa',
          }}
        >
          {imm.reducedMotion ? 'Reduced Motion: ON' : 'Motion: Normal'}
        </span>
      </div>

      {/* Toggles */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '14px' }}>
        <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
          <span>Physical Haptics</span>
          <input
            type="checkbox"
            checked={imm.preferences.hapticsEnabled}
            onChange={handleToggleHaptics}
            aria-label="Toggle physical haptics"
          />
        </label>

        <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
          <span>Screen Rumble (.reader-stage)</span>
          <input
            type="checkbox"
            checked={imm.preferences.screenRumbleEnabled}
            onChange={handleToggleRumble}
            aria-label="Toggle screen rumble"
          />
        </label>

        {imm.reducedMotion && (
          <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', color: '#fbbf24' }}>
            <span>Haptics during Reduced Motion</span>
            <input
              type="checkbox"
              checked={imm.preferences.hapticsWithReducedMotion}
              onChange={handleToggleReducedMotionHaptics}
              aria-label="Toggle haptics during reduced motion"
            />
          </label>
        )}
      </div>

      {/* Intensity Sliders */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '14px' }}>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span>Max Haptic Intensity:</span>
            <span style={{ fontWeight: 600, color: '#ec4899' }}>
              {imm.preferences.maxHapticIntensity === 0 ? 'LIGERO' : imm.preferences.maxHapticIntensity === 1 ? 'MEDIO' : 'PESADO'}
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={2}
            step={1}
            value={imm.preferences.maxHapticIntensity}
            onChange={(e) => handleHapticIntensityChange(Number(e.target.value) as ImpactIntensity)}
            aria-label="Max haptic intensity slider"
            style={{ width: '100%', accentColor: '#ec4899' }}
          />
        </div>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span>Max Rumble Intensity:</span>
            <span style={{ fontWeight: 600, color: '#ec4899' }}>
              {imm.preferences.maxRumbleIntensity === 0 ? 'LIGERO (0.75px)' : imm.preferences.maxRumbleIntensity === 1 ? 'MEDIO (1.5px)' : 'PESADO (2.5px)'}
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={2}
            step={1}
            value={imm.preferences.maxRumbleIntensity}
            onChange={(e) => handleRumbleIntensityChange(Number(e.target.value) as ImpactIntensity)}
            aria-label="Max rumble intensity slider"
            style={{ width: '100%', accentColor: '#ec4899' }}
          />
        </div>
      </div>

      {/* Test Buttons */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: testStatus ? '8px' : '0px' }}>
        <button
          onClick={handleTestVibration}
          style={{
            flex: 1,
            padding: '7px 10px',
            backgroundColor: '#27272a',
            border: '1px solid #52525b',
            borderRadius: '6px',
            color: '#f4f4f5',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Test Vibration
        </button>
        <button
          onClick={handleTestRumble}
          style={{
            flex: 1,
            padding: '7px 10px',
            backgroundColor: '#27272a',
            border: '1px solid #52525b',
            borderRadius: '6px',
            color: '#f4f4f5',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Test Rumble
        </button>
      </div>

      {/* Test Feedback */}
      {testStatus && (
        <div style={{ marginTop: '8px', textAlign: 'center', fontSize: '11px', color: '#a7f3d0' }}>
          {testStatus}
        </div>
      )}
    </div>
  );
};
