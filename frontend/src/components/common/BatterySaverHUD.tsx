import React, { useState, useEffect } from 'react';
import { BatteryCharging, BatteryLow, Zap } from 'lucide-react';
import { batterySaverEngine, BatteryState } from '../../services/battery-saver-engine.js';

export const BatterySaverHUD: React.FC = () => {
  const [batteryState, setBatteryState] = useState<BatteryState>(batterySaverEngine.getState());

  useEffect(() => {
    const unsubscribe = batterySaverEngine.subscribe((state) => {
      setBatteryState(state);
    });
    return () => {
      unsubscribe();
    };
  }, []);

  if (!batteryState.isPowerSaverActive && !batteryState.isCharging) {
    return null;
  }

  const levelPercent = batteryState.batteryLevel !== null
    ? Math.round(batteryState.batteryLevel * 100)
    : 100;

  return (
    <div
      data-testid="battery-saver-hud"
      role="status"
      aria-label="Estado de Ahorro de Batería"
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-amber-950/80 border border-amber-800/60 text-amber-300"
      title={`Modo Ahorro de Energía activo (${levelPercent}% batería). Prefetch agresivo y animaciones pausadas.`}
    >
      {batteryState.isCharging ? (
        <BatteryCharging className="w-3.5 h-3.5 text-emerald-400" />
      ) : (
        <BatteryLow className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
      )}
      <span>{levelPercent}%</span>
      <span className="text-amber-500/60">·</span>
      <span className="flex items-center gap-0.5 text-amber-200">
        <Zap className="w-3 h-3 text-amber-400" />
        Ahorro Activo
      </span>
    </div>
  );
};
