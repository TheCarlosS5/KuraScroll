import React, { useState, useEffect } from 'react';
import { DailyGoalRing } from './DailyGoalRing';

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

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="goal-modal-title"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '16px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: '#1E293B',
          color: '#F8FAFC',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '460px',
          padding: '24px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 id="goal-modal-title" style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>🎯</span> Meta Diaria de Lectura
          </h2>
          <button
            onClick={onClose}
            aria-label="Cerrar modal"
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94A3B8',
              fontSize: '1.5rem',
              cursor: 'pointer',
              lineHeight: 1,
            }}
          >
            &times;
          </button>
        </div>

        {/* Center Progress Hero */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '16px 0 24px' }}>
          <DailyGoalRing
            current={currentMetric}
            target={targetValue}
            unit={unitLabel}
            size={112}
            strokeWidth={10}
            showText={true}
          />
          <div style={{ marginTop: '12px', textAlign: 'center' }}>
            <span style={{ fontSize: '1.1rem', fontWeight: 600 }}>
              {currentMetric} / {targetValue} {unitLabel}
            </span>
            <div style={{ fontSize: '0.85rem', color: todayProgress.goalCompleted ? '#10B981' : '#94A3B8', marginTop: '2px' }}>
              {todayProgress.goalCompleted ? '¡Meta de hoy cumplida! 🎉' : `Faltan ${Math.max(0, targetValue - currentMetric)} ${unitLabel}`}
            </div>
          </div>
        </div>

        {/* Past 7-Day Habit History */}
        <div style={{ marginBottom: '20px', backgroundColor: '#0F172A', padding: '12px', borderRadius: '12px' }}>
          <div style={{ fontSize: '0.8rem', color: '#94A3B8', marginBottom: '8px', fontWeight: 600 }}>
            ÚLTIMOS 7 DÍAS
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            {calendar.map((day) => {
              const dayName = new Date(`${day.date}T00:00:00Z`).toLocaleDateString('es-ES', { weekday: 'narrow' });
              return (
                <div key={day.date} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                  <span style={{ fontSize: '0.75rem', color: '#64748B' }}>{dayName}</span>
                  <div
                    title={`${day.date}: ${day.pagesRead} páginas (${day.goalCompleted ? 'Cumplida' : 'Incompleta'})`}
                    style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      backgroundColor: day.goalCompleted ? '#10B981' : day.pagesRead > 0 ? '#F59E0B' : '#334155',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.7rem',
                      color: '#FFF',
                    }}
                  >
                    {day.goalCompleted ? '✓' : ''}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Goal Settings Controls */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Target Type Toggle */}
          <div>
            <label style={{ fontSize: '0.85rem', color: '#94A3B8', display: 'block', marginBottom: '6px' }}>
              Tipo de objetivo
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setTargetType('pages')}
                style={{
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1px solid',
                  borderColor: targetType === 'pages' ? '#3B82F6' : '#334155',
                  backgroundColor: targetType === 'pages' ? 'rgba(59, 130, 246, 0.2)' : '#0F172A',
                  color: targetType === 'pages' ? '#60A5FA' : '#94A3B8',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                📖 Páginas leídas
              </button>
              <button
                type="button"
                onClick={() => setTargetType('minutes')}
                style={{
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1px solid',
                  borderColor: targetType === 'minutes' ? '#3B82F6' : '#334155',
                  backgroundColor: targetType === 'minutes' ? 'rgba(59, 130, 246, 0.2)' : '#0F172A',
                  color: targetType === 'minutes' ? '#60A5FA' : '#94A3B8',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                ⏱️ Minutos de lectura
              </button>
            </div>
          </div>

          {/* Target Value Number Input & Presets */}
          <div>
            <label htmlFor="goal-target-input" style={{ fontSize: '0.85rem', color: '#94A3B8', display: 'block', marginBottom: '6px' }}>
              Cantidad objetivo diaria
            </label>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input
                id="goal-target-input"
                type="number"
                min={1}
                max={500}
                value={targetValue}
                onChange={(e) => setTargetValue(Math.max(1, parseInt(e.target.value) || 1))}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  backgroundColor: '#0F172A',
                  border: '1px solid #334155',
                  borderRadius: '8px',
                  color: '#FFF',
                  fontSize: '1rem',
                }}
              />
              {[15, 30, 50].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setTargetValue(preset)}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '8px',
                    backgroundColor: '#334155',
                    border: 'none',
                    color: '#CBD5E1',
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                  }}
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>

          {/* Notifications Toggle */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0' }}>
            <span style={{ fontSize: '0.85rem', color: '#CBD5E1' }}>
              Avisos in-app y notificaciones al completar
            </span>
            <input
              type="checkbox"
              checked={notificationsEnabled}
              onChange={(e) => setNotificationsEnabled(e.target.checked)}
              style={{ width: '18px', height: '18px', cursor: 'pointer' }}
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '10px 16px',
              backgroundColor: 'transparent',
              border: '1px solid #475569',
              borderRadius: '8px',
              color: '#CBD5E1',
              cursor: 'pointer',
              fontWeight: 500,
            }}
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={isSaving}
            onClick={handleSave}
            style={{
              padding: '10px 20px',
              backgroundColor: '#3B82F6',
              border: 'none',
              borderRadius: '8px',
              color: '#FFFFFF',
              cursor: isSaving ? 'wait' : 'pointer',
              fontWeight: 600,
            }}
          >
            {isSaving ? 'Guardando...' : 'Guardar Meta'}
          </button>
        </div>
      </div>
    </div>
  );
};
