import React, { useState, useEffect } from 'react';
import { X, BarChart2, Calendar, Sparkles } from 'lucide-react';
import { OtakuStatsRadar, GenreRadarAxis } from './OtakuStatsRadar.js';
import { OtakuActivityHeatmap, DayActivityItem } from './OtakuActivityHeatmap.js';

export interface OtakuStatsModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId?: string;
}

export const OtakuStatsModal: React.FC<OtakuStatsModalProps> = ({
  isOpen,
  onClose,
  userId = 'default_user',
}) => {
  const [axes, setAxes] = useState<GenreRadarAxis[]>([]);
  const [days, setDays] = useState<DayActivityItem[]>([]);
  const [totalDaysActive, setTotalDaysActive] = useState(0);
  const [totalPagesPeriod, setTotalPagesPeriod] = useState(0);
  const [totalReadingSeconds, setTotalReadingSeconds] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return;

    setLoading(true);

    Promise.all([
      fetch(`/api/v1/analytics/stats-radar?userId=${encodeURIComponent(userId)}`)
        .then((res) => (res.ok ? res.json() : null))
        .catch(() => null),
      fetch(`/api/v1/analytics/activity-heatmap?userId=${encodeURIComponent(userId)}&daysBack=364`)
        .then((res) => (res.ok ? res.json() : null))
        .catch(() => null),
    ])
      .then(([radarData, heatData]) => {
        if (radarData && Array.isArray(radarData.axes)) {
          setAxes(radarData.axes);
        }
        if (heatData && Array.isArray(heatData.days)) {
          setDays(heatData.days);
          setTotalDaysActive(heatData.totalDaysActive || 0);
          setTotalPagesPeriod(heatData.totalPagesPeriod || 0);
          setTotalReadingSeconds(heatData.totalReadingSeconds || 0);
        }
      })
      .finally(() => setLoading(false));
  }, [isOpen, userId]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="otaku-stats-modal-title"
      data-testid="otaku-stats-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80"
      style={{ contain: 'layout paint' }}
    >
      <div
        className="w-full max-w-2xl bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        style={{ contain: 'layout paint' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800 bg-neutral-950/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-cyan-950/80 border border-cyan-800/60 text-cyan-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 id="otaku-stats-modal-title" className="text-lg font-bold text-white tracking-tight">
                Estadísticas Otaku
              </h2>
              <p className="text-xs text-neutral-400">
                Preferencias de lectura por género y actividad anual
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar modal de estadísticas"
            className="p-2 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Radar Chart Section */}
          <div className="flex flex-col items-center p-4 rounded-xl bg-neutral-950/40 border border-neutral-800/80">
            <div className="w-full flex items-center gap-2 mb-2 text-xs font-semibold text-neutral-300">
              <BarChart2 className="w-4 h-4 text-cyan-400" />
              <span>Polígono de Preferencias por Género</span>
            </div>
            <OtakuStatsRadar axes={axes} size={300} />
          </div>

          {/* Activity Heatmap Section */}
          <div className="p-4 rounded-xl bg-neutral-950/40 border border-neutral-800/80">
            <div className="w-full flex items-center gap-2 mb-3 text-xs font-semibold text-neutral-300">
              <Calendar className="w-4 h-4 text-cyan-400" />
              <span>Mapa de Calor de Lectura Anual</span>
            </div>
            <OtakuActivityHeatmap
              days={days}
              totalDaysActive={totalDaysActive}
              totalPagesPeriod={totalPagesPeriod}
              totalReadingSeconds={totalReadingSeconds}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
