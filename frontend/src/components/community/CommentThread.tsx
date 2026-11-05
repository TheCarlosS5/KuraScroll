import React, { useState, useEffect, useCallback } from 'react';
import { Eye, EyeOff, Trash2, Flag, AlertCircle, MessageSquare, RefreshCw, ChevronDown } from 'lucide-react';
import { SessionIdentity, authApiClient } from '../../services/auth-api-client.js';
import { ReportDialog } from './ReportDialog.js';

export interface CommentRecord {
  id: string;
  seriesSlug: string;
  authorHandle: string;
  authorDisplayName: string | null;
  body: string;
  hasSpoiler: boolean;
  status: 'published' | 'hidden' | 'removed';
  createdAt: string;
  updatedAt: string;
}

export interface CommentThreadProps {
  seriesSlug: string;
  currentUser?: SessionIdentity | null;
  newlyAddedComment?: CommentRecord | null;
  onNavigateUser?: (handle: string) => void;
  onOpenAuthModal?: () => void;
}

function formatRelativeTime(isoString: string): string {
  try {
    const date = new Date(isoString);
    const now = Date.now();
    const diffMs = now - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHours = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSec < 60) return 'hace un momento';
    if (diffMin < 60) return `hace ${diffMin} ${diffMin === 1 ? 'minuto' : 'minutos'}`;
    if (diffHours < 24) return `hace ${diffHours} ${diffHours === 1 ? 'hora' : 'horas'}`;
    if (diffDays < 7) return `hace ${diffDays} ${diffDays === 1 ? 'día' : 'días'}`;
    return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return isoString;
  }
}

export const CommentThread: React.FC<CommentThreadProps> = ({
  seriesSlug,
  currentUser,
  newlyAddedComment,
  onNavigateUser,
}) => {
  const [comments, setComments] = useState<CommentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  const [resolvedUser, setResolvedUser] = useState<SessionIdentity | null>(currentUser || null);
  const [revealedSpoilers, setRevealedSpoilers] = useState<Set<string>>(new Set());
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [reportingComment, setReportingComment] = useState<CommentRecord | null>(null);

  // Sync or fetch currentUser if not passed from props
  useEffect(() => {
    if (currentUser !== undefined) {
      setResolvedUser(currentUser);
      return;
    }
    let isMounted = true;
    authApiClient.getSession().then((session) => {
      if (isMounted) setResolvedUser(session);
    });
    return () => {
      isMounted = false;
    };
  }, [currentUser]);

  // Load comments list
  const fetchComments = useCallback(
    async (cursor?: string, append: boolean = false) => {
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }
      setError(null);

      try {
        const query = new URLSearchParams();
        if (cursor) query.set('cursor', cursor);
        query.set('limit', '20');

        const res = await fetch(
          `/api/v1/series/${encodeURIComponent(seriesSlug)}/comments?${query.toString()}`
        );

        if (!res.ok) {
          throw new Error('No se pudieron cargar los comentarios.');
        }

        const data = await res.json();
        const incoming: CommentRecord[] = data.comments || [];

        setComments((prev) => (append ? [...prev, ...incoming] : incoming));
        setNextCursor(data.nextCursor || null);
      } catch (err: any) {
        setError(err.message || 'Error de conexión al cargar comentarios.');
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [seriesSlug]
  );

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  // Automatically prepend newly added comment from Composer
  useEffect(() => {
    if (newlyAddedComment && newlyAddedComment.seriesSlug === seriesSlug) {
      setComments((prev) => {
        if (prev.some((c) => c.id === newlyAddedComment.id)) return prev;
        return [newlyAddedComment, ...prev];
      });
    }
  }, [newlyAddedComment, seriesSlug]);

  const toggleSpoiler = (id: string) => {
    setRevealedSpoilers((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!window.confirm('¿Deseas eliminar este comentario definitivamente?')) {
      return;
    }

    setDeletingId(commentId);
    try {
      const res = await fetch(`/api/v1/comments/${encodeURIComponent(commentId)}`, {
        method: 'DELETE',
        credentials: 'same-origin',
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || 'Error al eliminar el comentario.');
      }

      setComments((prev) => prev.filter((c) => c.id !== commentId));
    } catch (err: any) {
      alert(err.message || 'No se pudo eliminar el comentario.');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header bar with counter & refresh */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-zinc-400" />
          <h3 className="text-sm font-semibold text-zinc-200">
            Comentarios de la comunidad ({comments.length})
          </h3>
        </div>
        <button
          onClick={() => fetchComments()}
          disabled={loading}
          className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
          title="Actualizar comentarios"
          aria-label="Actualizar comentarios"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
          <button
            onClick={() => fetchComments()}
            className="px-2.5 py-1 rounded bg-rose-500/20 hover:bg-rose-500/30 font-semibold cursor-pointer"
          >
            Reintentar
          </button>
        </div>
      )}

      {/* Initial Loading Skeleton */}
      {loading && comments.length === 0 && (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="p-4 rounded-2xl bg-zinc-900/40 border border-zinc-800/60 animate-pulse flex items-start gap-3"
            >
              <div className="w-9 h-9 rounded-xl bg-zinc-800 shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="w-32 h-4 bg-zinc-800 rounded" />
                <div className="w-full h-10 bg-zinc-800/60 rounded" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && comments.length === 0 && !error && (
        <div className="p-8 text-center bg-zinc-900/30 border border-zinc-800/60 rounded-2xl">
          <MessageSquare className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
          <p className="text-zinc-400 text-sm font-medium">
            Aún no hay comentarios en esta serie.
          </p>
          <p className="text-zinc-500 text-xs mt-1">
            ¡Sé el primero en compartir tu opinión o debatir los últimos acontecimientos!
          </p>
        </div>
      )}

      {/* Comments List */}
      <div className="space-y-3">
        {comments.map((comment) => {
          const isRevealed = revealedSpoilers.has(comment.id);
          const isAuthor =
            Boolean(resolvedUser) &&
            resolvedUser?.handle.toLowerCase() === comment.authorHandle.toLowerCase();
          const isAdmin = resolvedUser?.role === 'admin';
          const canDelete = isAuthor || isAdmin;
          const initialLetter = (
            comment.authorDisplayName || comment.authorHandle
          )
            .charAt(0)
            .toUpperCase();

          return (
            <div
              key={comment.id}
              className="bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-4 sm:p-5 transition-all shadow-sm hover:border-zinc-700/80"
            >
              <div className="flex items-start justify-between gap-3">
                {/* Author Info */}
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-600 to-indigo-600 flex items-center justify-center text-white text-sm font-bold shadow-md shadow-cyan-950/30 select-none shrink-0">
                    {initialLetter}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <a
                        href={`/user/${encodeURIComponent(comment.authorHandle)}`}
                        onClick={(e) => {
                          if (onNavigateUser) {
                            e.preventDefault();
                            onNavigateUser(comment.authorHandle);
                          }
                        }}
                        className="font-bold text-sm text-white hover:text-cyan-400 transition-colors"
                      >
                        {comment.authorDisplayName || comment.authorHandle}
                      </a>
                      <span className="text-xs text-zinc-500 font-mono">
                        @{comment.authorHandle}
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-500 mt-0.5">
                      {formatRelativeTime(comment.createdAt)}
                    </p>
                  </div>
                </div>

                {/* Actions: Report & Delete */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => setReportingComment(comment)}
                    title="Reportar comentario"
                    aria-label="Reportar comentario"
                    className="p-1.5 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-zinc-800 transition-colors cursor-pointer"
                  >
                    <Flag className="w-3.5 h-3.5" />
                  </button>

                  {canDelete && (
                    <button
                      type="button"
                      disabled={deletingId === comment.id}
                      onClick={() => handleDeleteComment(comment.id)}
                      title="Eliminar comentario"
                      aria-label="Eliminar comentario"
                      className="p-1.5 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-zinc-800 transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {deletingId === comment.id ? (
                        <div className="w-3.5 h-3.5 border-2 border-rose-500/20 border-t-rose-500 rounded-full animate-spin" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5" />
                      )}
                    </button>
                  )}
                </div>
              </div>

              {/* Comment Body / Spoiler Handling */}
              <div className="mt-3 pl-12">
                {comment.hasSpoiler && !isRevealed ? (
                  <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-amber-300 text-xs font-medium">
                      <EyeOff className="w-4 h-4 text-amber-400 shrink-0" />
                      <span>Este comentario contiene spoilers sobre la trama.</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleSpoiler(comment.id)}
                      className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer shrink-0"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Mostrar spoiler</span>
                    </button>
                  </div>
                ) : (
                  <div>
                    <p className="text-zinc-200 text-sm whitespace-pre-wrap leading-relaxed">
                      {comment.body}
                    </p>
                    {comment.hasSpoiler && isRevealed && (
                      <button
                        type="button"
                        onClick={() => toggleSpoiler(comment.id)}
                        className="mt-2 text-[11px] text-amber-400/80 hover:text-amber-300 flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <EyeOff className="w-3 h-3" />
                        <span>Ocultar spoiler</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Pagination button */}
      {nextCursor && (
        <div className="pt-2 text-center">
          <button
            type="button"
            disabled={loadingMore}
            onClick={() => fetchComments(nextCursor, true)}
            className="px-4 py-2 rounded-xl bg-zinc-800/80 hover:bg-zinc-800 text-zinc-300 text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5 mx-auto disabled:opacity-50"
          >
            {loadingMore ? (
              <>
                <div className="w-3 h-3 border-2 border-zinc-400/20 border-t-zinc-200 rounded-full animate-spin" />
                <span>Cargando más comentarios...</span>
              </>
            ) : (
              <>
                <ChevronDown className="w-3.5 h-3.5" />
                <span>Cargar más comentarios</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Report Modal */}
      {reportingComment && (
        <ReportDialog
          isOpen={Boolean(reportingComment)}
          onClose={() => setReportingComment(null)}
          targetType="comment"
          targetId={reportingComment.id}
          targetTitle={`Comentario de @${reportingComment.authorHandle}: "${
            reportingComment.body.length > 50
              ? reportingComment.body.substring(0, 50) + '...'
              : reportingComment.body
          }"`}
        />
      )}
    </div>
  );
};

export default CommentThread;
