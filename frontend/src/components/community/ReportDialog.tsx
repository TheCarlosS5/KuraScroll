import React, { useState } from 'react';
import { X, AlertTriangle, CheckCircle2, ShieldAlert } from 'lucide-react';

export type TargetType = 'comment' | 'chapter' | 'series';

export interface ReportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  targetType: TargetType;
  targetId: string;
  targetTitle?: string;
  onReportSubmitted?: () => void;
}

const COMMON_REASONS = [
  'Spoilers sin marcar o revelar',
  'Spam o contenido publicitario no deseado',
  'Acoso, insultos o comportamiento tóxico',
  'Contenido ilegal, violento o inapropiado',
  'Traducción de pésima calidad o páginas rotas/duplicadas',
  'Otro motivo',
];

export const ReportDialog: React.FC<ReportDialogProps> = ({
  isOpen,
  onClose,
  targetType,
  targetId,
  targetTitle,
  onReportSubmitted,
}) => {
  const [selectedReason, setSelectedReason] = useState<string>(COMMON_REASONS[0]);
  const [customDetails, setCustomDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  if (!isOpen) return null;

  const targetTypeLabel: Record<TargetType, string> = {
    comment: 'Comentario',
    chapter: 'Capítulo',
    series: 'Serie',
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(null);

    const finalReason =
      selectedReason === 'Otro motivo'
        ? customDetails.trim()
        : customDetails.trim()
        ? `${selectedReason}: ${customDetails.trim()}`
        : selectedReason;

    if (finalReason.length < 3) {
      setError('Por favor describe el motivo con mayor detalle.');
      setSubmitting(false);
      return;
    }

    try {
      const res = await fetch('/api/v1/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          targetType,
          targetId,
          reason: finalReason,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.message || 'No se pudo enviar el reporte.');
      }

      if (data.report?.alreadyReported) {
        setSuccess('Ya has reportado este elemento anteriormente. El equipo de moderación lo revisará pronto.');
      } else {
        setSuccess('Reporte enviado correctamente. Gracias por ayudar a proteger la comunidad.');
      }

      if (onReportSubmitted) {
        onReportSubmitted();
      }

      setTimeout(() => {
        onClose();
        setSuccess(null);
        setCustomDetails('');
      }, 1800);
    } catch (err: any) {
      setError(err.message || 'Error al enviar el reporte.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className="relative w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-2xl text-zinc-100"
        role="dialog"
        aria-modal="true"
        aria-labelledby="report-dialog-title"
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
          aria-label="Cerrar ventana"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <h2 id="report-dialog-title" className="text-lg font-bold text-white">
              Reportar {targetTypeLabel[targetType]}
            </h2>
            {targetTitle && (
              <p className="text-xs text-zinc-400 line-clamp-1 mt-0.5">
                {targetTitle}
              </p>
            )}
          </div>
        </div>

        {success ? (
          <div className="py-6 text-center space-y-3">
            <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto animate-bounce" />
            <p className="text-sm font-medium text-emerald-300 px-4">
              {success}
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
                Motivo principal
              </label>
              <select
                value={selectedReason}
                onChange={(e) => setSelectedReason(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-sm text-zinc-200 outline-none focus:border-rose-500 transition-colors"
              >
                {COMMON_REASONS.map((r, idx) => (
                  <option key={idx} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                  Detalles adicionales {selectedReason === 'Otro motivo' ? '(requerido)' : '(opcional)'}
                </label>
                <span className={`text-[11px] ${customDetails.length > 500 ? 'text-rose-400' : 'text-zinc-500'}`}>
                  {customDetails.length} / 500
                </span>
              </div>
              <textarea
                value={customDetails}
                onChange={(e) => setCustomDetails(e.target.value)}
                placeholder="Indica qué norma se incumple o en qué momento ocurre..."
                rows={3}
                maxLength={500}
                required={selectedReason === 'Otro motivo'}
                className="w-full px-3.5 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-sm text-zinc-200 outline-none focus:border-rose-500 transition-colors resize-none placeholder:text-zinc-600"
              />
            </div>

            <p className="text-[11px] text-zinc-500 leading-normal">
              Los reportes son revisados por administradores. Las denuncias falsas o abusivas reiteradas pueden conllevar la suspensión de la cuenta.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm font-medium transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={submitting || (selectedReason === 'Otro motivo' && customDetails.trim().length < 3)}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1.5"
              >
                {submitting ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    <span>Enviando...</span>
                  </>
                ) : (
                  <span>Enviar reporte</span>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default ReportDialog;
