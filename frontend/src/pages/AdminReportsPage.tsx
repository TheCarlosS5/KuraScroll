import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldAlert,
  EyeOff,
  RotateCcw,
  Trash2,
  XCircle,
  ArrowLeft,
  CheckCircle2,
  MessageSquare,
  BookOpen,
  Library,
  Calendar,
  User,
  RefreshCw,
  AlertTriangle,
  ChevronDown,
  Clock,
  Shield,
} from 'lucide-react';
import { SessionIdentity, authApiClient } from '../services/auth-api-client.js';

export type TargetType = 'comment' | 'chapter' | 'series';
export type ReportStatus = 'pending' | 'resolved' | 'dismissed';

export interface ReportRecord {
  id: string;
  reporterId: string;
  reporterHandle: string;
  targetType: TargetType;
  targetId: string;
  targetSnippet?: string | null;
  reason: string;
  status: ReportStatus;
  reviewedBy: string | null;
  reviewedByHandle: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

export interface AdminReportsPageProps {
  onBack?: () => void;
  currentUser?: SessionIdentity | null;
  onNavigateUser?: (handle: string) => void;
}

type TabType = 'pending' | 'resolved' | 'dismissed' | 'all';

function formatDate(isoString: string): string {
  try {
    const d = new Date(isoString);
    return d.toLocaleString('es-ES', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return isoString;
  }
}

export const AdminReportsPage: React.FC<AdminReportsPageProps> = ({
  onBack,
  currentUser,
  onNavigateUser,
}) => {
  const [session, setSession] = useState<SessionIdentity | null>(currentUser || null);
  const [checkingAuth, setCheckingAuth] = useState(!currentUser);

  const [activeTab, setActiveTab] = useState<TabType>('pending');
  const [reports, setReports] = useState<ReportRecord[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [actionInProgressId, setActionInProgressId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Check user session
  useEffect(() => {
    if (currentUser !== undefined) {
      setSession(currentUser);
      setCheckingAuth(false);
      return;
    }
    let isMounted = true;
    authApiClient.getSession().then((s) => {
      if (isMounted) {
        setSession(s);
        setCheckingAuth(false);
      }
    });
    return () => {
      isMounted = false;
    };
  }, [currentUser]);

  // Load reports from API
  const fetchReports = useCallback(
    async (cursor?: string, append: boolean = false) => {
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }
      setError(null);

      try {
        const params = new URLSearchParams();
        if (activeTab !== 'all') {
          params.set('status', activeTab);
        }
        if (cursor) {
          params.set('cursor', cursor);
        }
        params.set('limit', '20');

        const res = await fetch(`/api/v1/admin/reports?${params.toString()}`, {
          credentials: 'same-origin',
        });

        if (!res.ok) {
          if (res.status === 403) {
            throw new Error('Acceso no autorizado: Se requieren permisos de administrador.');
          }
          throw new Error('Error al consultar la cola de reportes de moderación.');
        }

        const data = await res.json();
        const incoming: ReportRecord[] = data.reports || [];

        setReports((prev) => (append ? [...prev, ...incoming] : incoming));
        setNextCursor(data.nextCursor || null);
      } catch (err: any) {
        setError(err.message || 'Error de conexión con el servidor de moderación.');
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [activeTab]
  );

  useEffect(() => {
    if (session?.role === 'admin') {
      fetchReports();
    }
  }, [session, fetchReports]);

  // Handle Moderation Action
  const handleModerateAction = async (
    reportId: string,
    action: 'hide' | 'restore' | 'remove' | 'dismiss'
  ) => {
    const actionLabels: Record<string, string> = {
      hide: 'ocultar el contenido y resolver el reporte',
      restore: 'restaurar el contenido a estado público y resolver el reporte',
      remove: 'retirar definitivamente el contenido y resolver el reporte',
      dismiss: 'descartar este reporte sin aplicar sanciones',
    };

    if (!window.confirm(`¿Confirmas que deseas ${actionLabels[action]}?`)) {
      return;
    }

    setActionInProgressId(reportId);
    setError(null);

    const payload =
      action === 'dismiss'
        ? { status: 'dismissed', action: 'none' }
        : { status: 'resolved', action };

    try {
      const res = await fetch(`/api/v1/admin/reports/${encodeURIComponent(reportId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || 'Error al procesar la acción de moderación.');
      }

      setSuccessToast(`Acción procesada correctamente para el reporte.`);
      setTimeout(() => setSuccessToast(null), 3000);

      // If viewing pending and report is resolved/dismissed, remove from current view
      if (activeTab === 'pending') {
        setReports((prev) => prev.filter((r) => r.id !== reportId));
      } else {
        // Update item in place
        setReports((prev) =>
          prev.map((r) =>
            r.id === reportId
              ? {
                  ...r,
                  status: (payload.status as ReportStatus),
                  reviewedBy: session?.userId || 'admin',
                  reviewedByHandle: session?.handle || 'admin',
                  reviewedAt: new Date().toISOString(),
                }
              : r
          )
        );
      }
    } catch (err: any) {
      setError(err.message || 'Ocurrió un error al aplicar la resolución.');
    } finally {
      setActionInProgressId(null);
    }
  };

  // Auth checking loading state
  if (checkingAuth) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] max-w-2xl mx-auto px-4 py-16">
        <div className="w-10 h-10 border-4 border-rose-500/20 border-t-rose-500 rounded-full animate-spin mb-4" />
        <p className="text-zinc-400 text-sm">Verificando credenciales de moderador...</p>
      </div>
    );
  }

  // Non-admin restricted access screen
  if (!session || session.role !== 'admin') {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center">
        <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mx-auto mb-4 text-rose-400">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h1 className="text-xl font-bold text-white mb-2">Acceso Reservado a Moderación</h1>
        <p className="text-zinc-400 text-sm mb-6 max-w-md mx-auto">
          Esta sección está protegida y requiere una cuenta con rol de Administrador. Si crees que se trata de un error, por favor contacta al equipo técnico.
        </p>
        {onBack && (
          <button
            onClick={onBack}
            className="px-5 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-sm font-medium transition-colors cursor-pointer"
          >
            Regresar al inicio
          </button>
        )}
      </div>
    );
  }

  const targetTypeConfig: Record<
    TargetType,
    { label: string; icon: React.FC<{ className?: string }>; color: string }
  > = {
    comment: {
      label: 'Comentario',
      icon: MessageSquare,
      color: 'bg-indigo-500/10 border-indigo-500/30 text-indigo-300',
    },
    chapter: {
      label: 'Capítulo',
      icon: BookOpen,
      color: 'bg-cyan-500/10 border-cyan-500/30 text-cyan-300',
    },
    series: {
      label: 'Serie',
      icon: Library,
      color: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300',
    },
  };

  const statusConfig: Record<ReportStatus, { label: string; color: string }> = {
    pending: {
      label: 'Pendiente',
      color: 'bg-amber-500/10 border-amber-500/30 text-amber-300',
    },
    resolved: {
      label: 'Resuelto',
      color: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300',
    },
    dismissed: {
      label: 'Descartado',
      color: 'bg-zinc-800 border-zinc-700 text-zinc-400',
    },
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Back button */}
      {onBack && (
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-sm text-zinc-400 hover:text-white mb-6 transition-colors group cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
          <span>Volver</span>
        </button>
      )}

      {/* Header bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-zinc-800/80 mb-6">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-white tracking-tight">
                Cola de Moderación
              </h1>
              <span className="flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-300">
                <Shield className="w-3 h-3" /> Admin
              </span>
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">
              Revisión y resolución de reportes de comentarios, capítulos y series enviadas por la comunidad.
            </p>
          </div>
        </div>

        <button
          onClick={() => fetchReports()}
          disabled={loading}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium transition-colors cursor-pointer shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Actualizar</span>
        </button>
      </div>

      {/* Toast alert */}
      {successToast && (
        <div className="mb-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-sm flex items-center gap-2.5 animate-in fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span>{successToast}</span>
        </div>
      )}

      {error && (
        <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={() => fetchReports()}
            className="px-3 py-1 rounded bg-rose-500/20 hover:bg-rose-500/30 text-xs font-semibold cursor-pointer"
          >
            Reintentar
          </button>
        </div>
      )}

      {/* Status Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-zinc-800/80 pb-3 mb-6 overflow-x-auto">
        {(
          [
            { id: 'pending', label: 'Pendientes' },
            { id: 'resolved', label: 'Resueltos' },
            { id: 'dismissed', label: 'Descartados' },
            { id: 'all', label: 'Todos' },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === tab.id
                ? 'bg-rose-600 text-white shadow-md shadow-rose-950/40'
                : 'bg-zinc-900/60 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/70 border border-zinc-800/60'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Loading Skeleton */}
      {loading && reports.length === 0 && (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="p-6 rounded-2xl bg-zinc-900/50 border border-zinc-800/80 animate-pulse space-y-4"
            >
              <div className="flex items-center justify-between">
                <div className="w-32 h-5 bg-zinc-800 rounded" />
                <div className="w-24 h-5 bg-zinc-800 rounded" />
              </div>
              <div className="w-full h-12 bg-zinc-800/60 rounded" />
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && reports.length === 0 && (
        <div className="p-12 text-center bg-zinc-900/40 border border-zinc-800/80 rounded-2xl">
          <ShieldAlert className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-white">
            No hay reportes en esta categoría
          </h3>
          <p className="text-xs text-zinc-400 mt-1">
            {activeTab === 'pending'
              ? '¡Excelente! La cola de moderación está completamente al día.'
              : 'No se encontraron registros de reportes con este filtro.'}
          </p>
        </div>
      )}

      {/* Reports List */}
      <div className="space-y-4">
        {reports.map((report) => {
          const targetConf = targetTypeConfig[report.targetType] || targetTypeConfig.comment;
          const TargetIcon = targetConf.icon;
          const statusConf = statusConfig[report.status] || statusConfig.pending;
          const isPending = report.status === 'pending';
          const isProcessing = actionInProgressId === report.id;

          return (
            <div
              key={report.id}
              className="bg-zinc-900/70 border border-zinc-800/80 rounded-2xl p-5 sm:p-6 transition-all shadow-sm space-y-4"
            >
              {/* Card Header: Type Badge, Status, Date */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 pb-3 border-b border-zinc-800/60">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg border ${targetConf.color}`}
                  >
                    <TargetIcon className="w-3.5 h-3.5" />
                    <span>{targetConf.label}</span>
                  </span>

                  <span
                    className={`text-xs font-semibold px-2.5 py-1 rounded-lg border ${statusConf.color}`}
                  >
                    {statusConf.label}
                  </span>

                  <span className="text-[11px] font-mono text-zinc-500">
                    ID: {report.targetId}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 text-xs text-zinc-400">
                  <Clock className="w-3.5 h-3.5 text-zinc-500" />
                  <span>{formatDate(report.createdAt)}</span>
                </div>
              </div>

              {/* Reported Content Snippet */}
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1">
                  Contenido reportado
                </h4>
                <div className="p-3.5 rounded-xl bg-zinc-950/80 border border-zinc-800/70 text-sm text-zinc-200 leading-relaxed font-mono text-xs">
                  {report.targetSnippet || `[${targetConf.label} ${report.targetId}]`}
                </div>
              </div>

              {/* Reason Box */}
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-rose-400 mb-1">
                  Motivo del reporte
                </h4>
                <div className="p-3.5 rounded-xl bg-rose-500/5 border border-rose-500/20 text-sm text-rose-200 leading-relaxed">
                  {report.reason}
                </div>
              </div>

              {/* Reporter Info & Review info */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-zinc-400 pt-1">
                <div className="flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-zinc-500" />
                  <span>Reportado por:</span>
                  <a
                    href={`/user/${encodeURIComponent(report.reporterHandle)}`}
                    onClick={(e) => {
                      if (onNavigateUser) {
                        e.preventDefault();
                        onNavigateUser(report.reporterHandle);
                      }
                    }}
                    className="font-medium text-cyan-400 hover:underline"
                  >
                    @{report.reporterHandle}
                  </a>
                </div>

                {report.reviewedBy && (
                  <div className="text-zinc-500 text-[11px]">
                    Revisado por @{report.reviewedByHandle || report.reviewedBy}
                    {report.reviewedAt ? ` el ${formatDate(report.reviewedAt)}` : ''}
                  </div>
                )}
              </div>

              {/* Actions Toolbar */}
              <div className="pt-3 border-t border-zinc-800/60 flex flex-wrap items-center justify-end gap-2.5">
                {/* 1. Ocultar (hide) */}
                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={() => handleModerateAction(report.id, 'hide')}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer"
                  title="Oculta el contenido reportado y marca el reporte como resuelto"
                >
                  <EyeOff className="w-3.5 h-3.5" />
                  <span>Ocultar</span>
                </button>

                {/* 2. Restaurar (restore) */}
                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={() => handleModerateAction(report.id, 'restore')}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer"
                  title="Restaura la visibilidad pública del contenido reportado"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Restaurar</span>
                </button>

                {/* 3. Retirar (remove) */}
                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={() => handleModerateAction(report.id, 'remove')}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer"
                  title="Retira definitivamente el contenido infractor"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Retirar</span>
                </button>

                {/* 4. Descartar (dismiss) */}
                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={() => handleModerateAction(report.id, 'dismiss')}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer"
                  title="Descarta el reporte sin sancionar ni ocultar el contenido"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  <span>Descartar</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Pagination Load More Button */}
      {nextCursor && (
        <div className="pt-6 text-center">
          <button
            type="button"
            disabled={loadingMore}
            onClick={() => fetchReports(nextCursor, true)}
            className="px-5 py-2.5 rounded-xl bg-zinc-800/80 hover:bg-zinc-800 text-zinc-300 text-xs font-medium transition-colors cursor-pointer flex items-center gap-2 mx-auto disabled:opacity-50"
          >
            {loadingMore ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-zinc-400/20 border-t-zinc-200 rounded-full animate-spin" />
                <span>Cargando más reportes...</span>
              </>
            ) : (
              <>
                <ChevronDown className="w-4 h-4" />
                <span>Cargar más reportes</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
};

export default AdminReportsPage;
