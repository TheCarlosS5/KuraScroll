import React, { useCallback, useEffect, useState } from 'react';
import { AlertCircle, ArrowLeft, CheckCircle2, Clock3, LoaderCircle, Shield, XCircle } from 'lucide-react';

type ReportStatus = 'pending' | 'reviewed' | 'resolved' | 'dismissed';

interface ReportRecord {
  id: string;
  reporterHandle: string | null;
  targetType: string;
  targetId: string;
  reason: string;
  description: string | null;
  status: ReportStatus;
  createdAt: string;
}

export interface ModerationPanelProps {
  onBack: () => void;
}

const statusLabels: Record<ReportStatus, string> = {
  pending: 'Pendientes',
  reviewed: 'Revisadas',
  resolved: 'Resueltas',
  dismissed: 'Descartadas',
};

const reasonLabels: Record<string, string> = {
  spam: 'Spam',
  harassment: 'Acoso',
  copyright: 'Derechos de autor',
  inappropriate: 'Contenido inapropiado',
  other: 'Otro',
};

export const ModerationPanel: React.FC<ModerationPanelProps> = ({ onBack }) => {
  const [status, setStatus] = useState<ReportStatus>('pending');
  const [reports, setReports] = useState<ReportRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadReports = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/v1/admin/reports?status=${status}`, { credentials: 'include' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'No se pudieron cargar las denuncias.');
      setReports(Array.isArray(data.reports) ? data.reports : []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudieron cargar las denuncias.');
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => { void loadReports(); }, [loadReports]);

  const updateReport = async (reportId: string, nextStatus: Exclude<ReportStatus, 'pending'>) => {
    setUpdatingId(reportId);
    setError(null);
    try {
      const response = await fetch(`/api/v1/admin/reports/${encodeURIComponent(reportId)}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'KuraScrollSPA',
        },
        credentials: 'include',
        body: JSON.stringify({ status: nextStatus }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'No se pudo actualizar la denuncia.');
      await loadReports();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo actualizar la denuncia.');
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-cyan-400 mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Volver
      </button>

      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 text-amber-400 mb-1">
            <Shield className="w-5 h-5" />
            <span className="text-xs font-semibold uppercase tracking-wide">Moderación</span>
          </div>
          <h1 className="text-2xl font-bold text-white">Denuncias de la comunidad</h1>
        </div>
        <label className="text-xs text-gray-400">
          Estado
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as ReportStatus)}
            className="ml-2 px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-gray-200"
          >
            {(Object.keys(statusLabels) as ReportStatus[]).map((item) => (
              <option key={item} value={item}>{statusLabels[item]}</option>
            ))}
          </select>
        </label>
      </div>

      {error && (
        <div role="alert" className="mb-5 p-3 rounded-xl bg-red-950/50 border border-red-800 text-red-200 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      {loading ? (
        <div className="py-14 text-center text-gray-400 text-sm flex items-center justify-center gap-2">
          <LoaderCircle className="w-4 h-4 animate-spin" /> Cargando denuncias…
        </div>
      ) : reports.length === 0 ? (
        <div className="py-14 text-center bg-[#0e1422] border border-gray-800 rounded-2xl text-gray-400 text-sm">
          No hay denuncias {statusLabels[status].toLowerCase()}.
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map((report) => (
            <article key={report.id} className="p-4 sm:p-5 bg-[#0e1422] border border-gray-800 rounded-2xl">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span className="px-2 py-1 rounded-lg bg-amber-950/60 border border-amber-800/60 text-amber-300 text-[11px] font-semibold">
                      {reasonLabels[report.reason] || report.reason}
                    </span>
                    <span className="px-2 py-1 rounded-lg bg-gray-900 border border-gray-700 text-gray-300 text-[11px]">
                      {report.targetType}: <code>{report.targetId}</code>
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">
                    Denunciado por @{report.reporterHandle || 'usuario eliminado'} · {new Date(report.createdAt).toLocaleString('es-ES')}
                  </p>
                  {report.description && <p className="mt-3 text-sm text-gray-200 whitespace-pre-wrap">{report.description}</p>}
                </div>
                {status === 'pending' && (
                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      onClick={() => void updateReport(report.id, 'resolved')}
                      disabled={updatingId === report.id}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-700/70 hover:bg-emerald-600 disabled:opacity-50 text-white text-xs font-semibold"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" /> Resolver
                    </button>
                    <button
                      type="button"
                      onClick={() => void updateReport(report.id, 'dismissed')}
                      disabled={updatingId === report.id}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-gray-200 text-xs font-semibold"
                    >
                      <XCircle className="w-3.5 h-3.5" /> Descartar
                    </button>
                  </div>
                )}
                {status !== 'pending' && (
                  <span className="inline-flex items-center gap-1 text-xs text-gray-400">
                    <Clock3 className="w-3.5 h-3.5" /> {statusLabels[status]}
                  </span>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
};

export default ModerationPanel;
