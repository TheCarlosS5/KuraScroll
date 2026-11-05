import React, { useState, useEffect } from 'react';
import { MessageSquare, Send, Trash2, Edit3, Flag, User, Shield, Check, X } from 'lucide-react';
import { SafeUser } from '../../services/auth-service.js';
import { ReportModal } from '../moderation/ReportModal.js';

export interface CommentSectionProps {
  targetType: 'series' | 'chapter';
  targetId: string;
  currentUser: SafeUser | null;
  onRequireAuth: () => void;
}

export const CommentSection: React.FC<CommentSectionProps> = ({
  targetType,
  targetId,
  currentUser,
  onRequireAuth,
}) => {
  const [comments, setComments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newBody, setNewBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pagination state
  const [page, setPage] = useState(1);
  const [totalComments, setTotalComments] = useState(0);
  const limit = 20;

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState('');

  // Report state
  const [reportTarget, setReportTarget] = useState<{ id: string; type: 'comment' | 'series' | 'chapter' } | null>(null);

  const fetchComments = async (targetPage = page) => {
    try {
      const res = await fetch(`/api/v1/comments?target_type=${targetType}&target_id=${targetId}&page=${targetPage}&limit=${limit}`);
      if (res.ok) {
        const data = await res.json();
        setComments(data.items || []);
        setTotalComments(typeof data.total === 'number' ? data.total : (data.items || []).length);
      }
    } catch (e) {
      console.error('Error fetching comments:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setPage(1);
    fetchComments(1);
  }, [targetType, targetId]);

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      onRequireAuth();
      return;
    }

    if (!newBody.trim()) return;

    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/comments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'KuraScrollSPA',
        },
        credentials: 'include',
        body: JSON.stringify({
          targetType,
          targetId,
          body: newBody.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Error al publicar comentario');
      }

      setNewBody('');
      setPage(1);
      await fetchComments(1);
    } catch (err: any) {
      setError(err.message || 'Error al enviar comentario.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!confirm('¿Desea eliminar este comentario?')) return;

    try {
      const res = await fetch(`/api/v1/comments/${commentId}`, {
        method: 'DELETE',
        headers: { 'X-Requested-With': 'KuraScrollSPA' },
        credentials: 'include',
      });
      if (res.ok) {
        await fetchComments(page);
      }
    } catch (err) {
      console.error('Error deleting comment:', err);
    }
  };

  const handleSaveEdit = async (commentId: string) => {
    if (!editBody.trim()) return;

    try {
      const res = await fetch(`/api/v1/comments/${commentId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'KuraScrollSPA',
        },
        credentials: 'include',
        body: JSON.stringify({ body: editBody.trim() }),
      });
      if (res.ok) {
        setEditingId(null);
        await fetchComments();
      }
    } catch (err) {
      console.error('Error updating comment:', err);
    }
  };

  return (
    <div className="mt-12 bg-[#0e1422] border border-gray-800 rounded-2xl p-6 sm:p-8">
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-800">
        <div className="flex items-center gap-2.5">
          <MessageSquare className="w-5 h-5 text-cyan-400" />
          <h3 className="text-lg font-bold text-gray-100">
            Comentarios ({totalComments})
          </h3>
        </div>
      </div>

      {/* Post Comment Form */}
      {currentUser ? (
        <form onSubmit={handlePostComment} className="mb-8">
          {error && (
            <div className="mb-3 p-2.5 rounded-xl bg-red-950/50 border border-red-800 text-red-200 text-xs">
              {error}
            </div>
          )}
          <div className="relative">
            <textarea
              value={newBody}
              onChange={(e) => setNewBody(e.target.value)}
              placeholder="Escribe tu opinión, teoría o reseña..."
              maxLength={2000}
              rows={3}
              className="w-full p-3.5 bg-gray-900 border border-gray-700/80 rounded-xl text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-cyan-500 transition-colors"
            />
            <div className="flex items-center justify-between mt-2">
              <span className="text-[11px] text-gray-500">
                {newBody.length} / 2000 caracteres
              </span>
              <button
                type="submit"
                disabled={submitting || !newBody.trim()}
                className="flex items-center gap-1.5 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-sm transition-colors"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{submitting ? 'Enviando...' : 'Comentar'}</span>
              </button>
            </div>
          </div>
        </form>
      ) : (
        <div className="mb-8 p-4 rounded-xl bg-gray-900/60 border border-gray-800 text-center">
          <p className="text-xs text-gray-400 mb-2">
            Inicia sesión o regístrate para unirte a la conversación.
          </p>
          <button
            onClick={onRequireAuth}
            className="px-4 py-1.5 rounded-lg bg-cyan-600/20 text-cyan-400 border border-cyan-500/30 text-xs font-semibold hover:bg-cyan-600/30 transition-colors"
          >
            Iniciar Sesión
          </button>
        </div>
      )}

      {/* Comments List */}
      {loading ? (
        <div className="text-center text-xs text-gray-500 py-6">Cargando comentarios...</div>
      ) : comments.length === 0 ? (
        <div className="text-center text-xs text-gray-500 py-6">
          Sé el primero en dejar un comentario.
        </div>
      ) : (
        <div className="space-y-4">
          {comments.map((c) => {
            const isAuthor = currentUser && c.author && currentUser.id === c.author.id;
            const isPrivileged = currentUser && (currentUser.role === 'admin' || currentUser.role === 'moderator');
            const canDelete = isAuthor || isPrivileged;

            return (
              <div
                key={c.id}
                className="p-4 rounded-xl bg-gray-900/50 border border-gray-800/80 hover:border-gray-700/80 transition-colors"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-cyan-950 border border-cyan-700/40 flex items-center justify-center text-cyan-400 text-xs">
                      {c.author?.avatarUrl ? (
                        <img
                          src={c.author.avatarUrl}
                          alt={c.author.displayName}
                          className="w-full h-full rounded-full object-cover"
                        />
                      ) : (
                        <User className="w-3 h-3" />
                      )}
                    </div>
                    <span className="font-semibold text-xs text-gray-200">
                      {c.author?.displayName || 'Usuario anónimo'}
                    </span>
                    {c.author && (
                      <span className="text-[11px] text-gray-500 font-mono">
                        @{c.author.handle}
                      </span>
                    )}
                    {c.author?.role !== 'user' && (
                      <span className="flex items-center gap-0.5 text-[9px] uppercase font-bold text-amber-400 bg-amber-950/60 border border-amber-800 px-1 rounded">
                        <Shield className="w-2.5 h-2.5" />
                        {c.author?.role}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span>
                      {new Date(c.createdAt).toLocaleDateString('es-ES', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    {c.isEdited && (
                      <span className="text-[10px] text-gray-500 italic">(editado)</span>
                    )}
                  </div>
                </div>

                {editingId === c.id ? (
                  <div className="mt-2 space-y-2">
                    <textarea
                      value={editBody}
                      onChange={(e) => setEditBody(e.target.value)}
                      maxLength={2000}
                      rows={2}
                      className="w-full p-2 bg-gray-950 border border-gray-700 rounded-lg text-sm text-gray-100"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => setEditingId(null)}
                        className="px-2.5 py-1 text-xs text-gray-400 hover:text-gray-200"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={() => handleSaveEdit(c.id)}
                        className="flex items-center gap-1 px-3 py-1 bg-cyan-600 text-white rounded-lg text-xs font-semibold"
                      >
                        <Check className="w-3 h-3" /> Guardar
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className={`text-sm mt-1 whitespace-pre-wrap ${c.isDeleted ? 'text-gray-500 italic' : 'text-gray-300'}`}>
                    {c.body}
                  </p>
                )}

                {/* Actions row */}
                {!c.isDeleted && (
                  <div className="flex items-center justify-end gap-3 mt-3 pt-2 border-t border-gray-800/40 text-xs">
                    {isAuthor && editingId !== c.id && (
                      <button
                        onClick={() => {
                          setEditingId(c.id);
                          setEditBody(c.body);
                        }}
                        className="text-gray-400 hover:text-cyan-400 flex items-center gap-1 transition-colors"
                      >
                        <Edit3 className="w-3 h-3" />
                        <span>Editar</span>
                      </button>
                    )}

                    {canDelete && (
                      <button
                        onClick={() => handleDeleteComment(c.id)}
                        className="text-gray-400 hover:text-red-400 flex items-center gap-1 transition-colors"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Eliminar</span>
                      </button>
                    )}

                    <button
                      onClick={() => {
                        if (!currentUser) {
                          onRequireAuth();
                          return;
                        }
                        setReportTarget({ id: c.id, type: 'comment' });
                      }}
                      title="Reportar comentario"
                      className="text-gray-500 hover:text-amber-400 flex items-center gap-1 transition-colors ml-1"
                    >
                      <Flag className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination Controls */}
      {totalComments > limit && (
        <div className="flex items-center justify-center gap-3 pt-6 mt-6 border-t border-gray-800">
          <button
            type="button"
            onClick={() => {
              const next = Math.max(1, page - 1);
              setPage(next);
              fetchComments(next);
            }}
            disabled={page <= 1}
            className="px-3.5 py-1.5 rounded-lg border border-gray-700 bg-gray-800/80 text-xs font-semibold text-gray-200 hover:bg-gray-700 hover:border-gray-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Anterior
          </button>
          <span className="text-xs text-gray-400">
            Página <strong className="text-gray-200">{page}</strong> de <strong className="text-gray-200">{Math.max(1, Math.ceil(totalComments / limit))}</strong>
          </span>
          <button
            type="button"
            onClick={() => {
              const totalPages = Math.max(1, Math.ceil(totalComments / limit));
              const next = Math.min(totalPages, page + 1);
              setPage(next);
              fetchComments(next);
            }}
            disabled={page >= Math.ceil(totalComments / limit)}
            className="px-3.5 py-1.5 rounded-lg border border-gray-700 bg-gray-800/80 text-xs font-semibold text-gray-200 hover:bg-gray-700 hover:border-gray-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Siguiente
          </button>
        </div>
      )}

      {/* Report Modal */}
      {reportTarget && (
        <ReportModal
          isOpen={Boolean(reportTarget)}
          onClose={() => setReportTarget(null)}
          targetType={reportTarget.type}
          targetId={reportTarget.id}
        />
      )}
    </div>
  );
};
