import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { DailyGoalRing } from './DailyGoalRing';
import { Target, X, Check, Flame } from 'lucide-react';

export interface DailyGoalData {
  targetType: 'pages' | 'minutes';
  targetValue: number;
  notificationsEnabled: boolean;
}

export interface TodayProgressData {
  pagesRead: number;
  readingSeconds: number;
  goalCompleted: boolean;
  progressPercentage: number;
}

export interface CalendarDayData {
  date: string;
  pagesRead: number;
  readingSeconds: number;
  goalCompleted: boolean;
}

export interface LifetimeStatsData {
  lifetimePages: number;
  lifetimeSeconds: number;
  totalGoalsCompleted: number;
  currentStreak: number;
  bestStreak: number;
}

export interface DailyGoalModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialGoal?: DailyGoalData;
  todayProgress?: TodayProgressData;
  calendar?: CalendarDayData[];
  lifetime?: LifetimeStatsData;
  onSaveGoal?: (goal: DailyGoalData) => Promise<void>;
}

export const DailyGoalModal: React.FC<DailyGoalModalProps> = ({
  isOpen,
  onClose,
  initialGoal = { targetType: 'pages', targetValue: 30, notificationsEnabled: true },
  todayProgress = { pagesRead: 0, readingSeconds: 0, goalCompleted: false, progressPercentage: 0 },
  calendar = [],
  lifetime = { lifetimePages: 0, lifetimeSeconds: 0, totalGoalsCompleted: 0, currentStreak: 0, bestStreak: 0 },
  onSaveGoal,
}) => {
  const [targetType, setTargetType] = useState<'pages' | 'minutes'>(initialGoal.targetType);
  const [targetValue, setTargetValue] = useState<number>(initialGoal.targetValue);
  const [notificationsEnabled, setNotificationsEnabled] = useState<boolean>(initialGoal.notificationsEnabled);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setTargetType(initialGoal.targetType);
    setTargetValue(initialGoal.targetValue);
    setNotificationsEnabled(initialGoal.notificationsEnabled);
  }, [initialGoal]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const currentMetric =
    targetType === 'pages' ? todayProgress.pagesRead : Math.round(todayProgress.readingSeconds / 60);
  const unitLabel = targetType === 'pages' ? 'páginas' : 'minutos';

  const handleSave = async () => {
    if (onSaveGoal) {
      setIsSaving(true);
      try {
        await onSaveGoal({ targetType, targetValue, notificationsEnabled });
      } finally {
        setIsSaving(false);
      }
    }
    onClose();
  };

  const modalContent = (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="goal-modal-title"
      className="fixed inset-0 z-[99999] overflow-y-auto bg-black/80 backdrop-blur-sm p-4 sm:p-6 flex justify-center items-center"
      onClick={onClose}
    >
      <div
        className="relative my-auto w-full max-w-md max-h-[90vh] flex flex-col rounded-2xl bg-zinc-900 border border-zinc-800 text-zinc-100 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800/80 bg-zinc-900/90 sticky top-0 z-10 backdrop-blur">
          <div className="flex items-center gap-2.5">
            <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <Target className="w-4 h-4" />
            </span>
            <h2 id="goal-modal-title" className="text-base font-semibold text-zinc-100 tracking-tight">
              Meta Diaria de Lectura
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar modal"
            className="flex items-center justify-center w-8 h-8 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Progress Hero */}
          <div className="flex flex-col items-center justify-center py-2">
            <DailyGoalRing
              current={currentMetric}
              target={targetValue}
              unit={unitLabel}
              size={112}
              strokeWidth={8}
              showText={true}
            />
            <div className="mt-3 text-center">
              <span className="text-sm font-medium text-zinc-200">
                {currentMetric} / {targetValue} {unitLabel}
              </span>
              <div
                className={`text-xs mt-0.5 font-medium ${
                  todayProgress.goalCompleted ? 'text-emerald-400' : 'text-zinc-400'
                }`}
              >
                {todayProgress.goalCompleted
                  ? '¡Meta de hoy cumplida!'
                  : `Faltan ${Math.max(0, targetValue - currentMetric)} ${unitLabel}`}
              </div>
            </div>
          </div>

          {/* Past 7-Day Habit History */}
          <div className="bg-zinc-950/60 border border-zinc-800/80 rounded-xl p-3.5">
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-[11px] font-semibold tracking-wider text-zinc-400 uppercase">
                ÚLTIMOS 7 DÍAS
              </span>
              {lifetime.currentStreak > 0 && (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-400">
                  <Flame className="w-3 h-3" /> {lifetime.currentStreak} d racha
                </span>
              )}
            </div>
            <div className="flex items-center justify-between gap-1">
              {calendar.map((day) => {
                const dayName = new Date(`${day.date}T00:00:00Z`).toLocaleDateString('es-ES', { weekday: 'narrow' });
                return (
                  <div key={day.date} className="flex flex-col items-center gap-1.5 flex-1">
                    <span className="text-[10px] font-mono text-zinc-500 uppercase">{dayName}</span>
                    <div
                      title={`${day.date}: ${day.pagesRead} páginas (${day.goalCompleted ? 'Cumplida' : 'Incompleta'})`}
                      className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-semibold transition-all ${
                        day.goalCompleted
                          ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 shadow-sm'
                          : day.pagesRead > 0
                          ? 'bg-amber-500/20 border border-amber-500/30 text-amber-400'
                          : 'bg-zinc-800/60 border border-zinc-700/30 text-zinc-600'
                      }`}
                    >
                      {day.goalCompleted ? <Check className="w-3.5 h-3.5" /> : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Goal Settings Controls */}
          <div className="space-y-4">
            {/* Target Type Toggle */}
            <div>
              <label className="text-xs font-medium text-zinc-400 block mb-2">
                Tipo de objetivo
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setTargetType('pages')}
                  className={`px-3 py-2 rounded-xl text-xs font-medium border transition-all flex items-center justify-center gap-2 ${
                    targetType === 'pages'
                      ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300 font-semibold'
                      : 'bg-zinc-800/40 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/70'
                  }`}
                >
                  Páginas leídas
                </button>
                <button
                  type="button"
                  onClick={() => setTargetType('minutes')}
                  className={`px-3 py-2 rounded-xl text-xs font-medium border transition-all flex items-center justify-center gap-2 ${
                    targetType === 'minutes'
                      ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300 font-semibold'
                      : 'bg-zinc-800/40 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/70'
                  }`}
                >
                  Minutos de lectura
                </button>
              </div>
            </div>

            {/* Target Value Number Input & Presets */}
            <div>
              <label htmlFor="goal-target-input" className="text-xs font-medium text-zinc-400 block mb-2">
                Cantidad objetivo diaria
              </label>
              <div className="flex gap-2 items-center">
                <input
                  id="goal-target-input"
                  type="number"
                  min={1}
                  max={500}
                  value={targetValue}
                  onChange={(e) => setTargetValue(Math.max(1, parseInt(e.target.value) || 1))}
                  className="flex-1 px-3 py-2 rounded-xl bg-zinc-950/70 border border-zinc-800 text-zinc-100 text-sm focus:outline-none focus:border-indigo-500/80 transition-colors"
                />
                {[15, 30, 50].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setTargetValue(preset)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-medium border transition-all ${
                      targetValue === preset
                        ? 'bg-zinc-700 border-zinc-600 text-zinc-100 font-semibold'
                        : 'bg-zinc-800/60 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            {/* Notifications Toggle */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-950/40 border border-zinc-800/60">
              <span className="text-xs text-zinc-300 font-medium">
                Avisos in-app y notificaciones al completar
              </span>
              <input
                type="checkbox"
                checked={notificationsEnabled}
                onChange={(e) => setNotificationsEnabled(e.target.checked)}
                className="w-4 h-4 rounded border-zinc-700 text-indigo-600 focus:ring-indigo-500 bg-zinc-900 cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2.5 px-6 py-4 border-t border-zinc-800/80 bg-zinc-900/90 sticky bottom-0 z-10 backdrop-blur">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-zinc-400 hover:text-zinc-200 bg-transparent border border-zinc-800 hover:border-zinc-700 rounded-xl transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={isSaving}
            onClick={handleSave}
            className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 rounded-xl shadow-sm transition-colors disabled:opacity-50"
          >
            {isSaving ? 'Guardando...' : 'Guardar Meta'}
          </button>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
};
