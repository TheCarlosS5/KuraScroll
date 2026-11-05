import React, { useState, useEffect } from 'react';
import { Send, EyeOff, AlertCircle, LogIn, MailCheck, UserCheck } from 'lucide-react';
import { SessionIdentity, authApiClient } from '../../services/auth-api-client.js';

export interface CommentComposerProps {
  seriesSlug: string;
  currentUser?: SessionIdentity | null;
  onCommentCreated?: (comment: any) => void;
  onOpenAuthModal?: () => void;
  onContinueAsGuest?: () => void;
}

export const CommentComposer: React.FC<CommentComposerProps> = ({
  seriesSlug,
  currentUser,
  onCommentCreated,
  onOpenAuthModal,
  onContinueAsGuest,
}) => {
  const [resolvedUser, setResolvedUser] = useState<SessionIdentity | null>(currentUser || null);
  const [isGuestMode, setIsGuestMode] = useState<boolean>(false);
  const [body, setBody] = useState('');
  const [hasSpoiler, setHasSpoiler] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const maxLength = 2000;
  const trimmed = body.trim();
  const isValid = trimmed.length >= 1 && trimmed.length <= maxLength;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid || submitting) return;

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/v1/series/${encodeURIComponent(seriesSlug)}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          body: trimmed,
          hasSpoiler,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.message || 'No se pudo publicar el comentario.');
      }

      setBody('');
      setHasSpoiler(false);
      if (onCommentCreated) {
        onCommentCreated(data.comment);
      }
    } catch (err: any) {
      // Keep draft text intact on error
      setError(err.message || 'Ocurrió un error al enviar el comentario.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleGuestClick = () => {
    setIsGuestMode(true);
    if (onContinueAsGuest) {
      onContinueAsGuest();
    }
  };

  // Not logged in state: friendly message with link to login or continue as guest
  if (!resolvedUser) {
    return (
      <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5 text-center sm:text-left flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-white">
            ¿Quieres unirte a la conversación?
          </h3>
          <p className="text-xs text-zinc-400 mt-1 max-w-xl">
            {isGuestMode
              ? 'Estás en modo invitado. Los comentarios son públicos, pero para opinar debes iniciar sesión o crear una cuenta.'
              : 'Inicia sesión con tu cuenta para comentar y debatir con la comunidad, o continúa como invitado para seguir leyendo.'}
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          {!isGuestMode && (
            <button
              type="button"
              onClick={handleGuestClick}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium transition-colors cursor-pointer"
            >
              <UserCheck className="w-3.5 h-3.5 text-zinc-400" />
              <span>Continuar como invitado</span>
            </button>
          )}

          {onOpenAuthModal ? (
            <button
              type="button"
              onClick={onOpenAuthModal}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shadow-md shadow-cyan-950/40 transition-colors cursor-pointer"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Iniciar sesión</span>
            </button>
          ) : (
            <a
              href="/login"
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shadow-md shadow-cyan-950/40 transition-colors"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Iniciar sesión</span>
            </a>
          )}
        </div>
      </div>
    );
  }

  // Logged in but email unverified
  if (!resolvedUser.emailVerified) {
    return (
      <div className="bg-amber-950/20 border border-amber-800/40 rounded-2xl p-5 flex items-start gap-3.5 text-amber-200">
        <MailCheck className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
        <div>
          <h3 className="text-sm font-semibold text-amber-300">
            Verificación de correo requerida
          </h3>
          <p className="text-xs text-amber-400/90 mt-0.5 leading-relaxed">
            Revisa tu bandeja de entrada y confirma tu correo electrónico para poder comentar, debatir y participar en la comunidad.
          </p>
        </div>
      </div>
    );
  }

  // Verified user comment composer
  return (
    <form
      onSubmit={handleSubmit}
      className="bg-zinc-900/70 border border-zinc-800 rounded-2xl p-4 sm:p-5 shadow-sm space-y-3"
    >
      {error && (
        <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <div className="relative">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Escribe lo que piensas de esta serie o de sus últimos capítulos..."
          rows={3}
          maxLength={maxLength}
          className="w-full px-4 py-3 rounded-xl bg-zinc-950/90 border border-zinc-800/80 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none transition-all resize-none"
        />
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-1">
        <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={hasSpoiler}
            onChange={(e) => setHasSpoiler(e.target.checked)}
            className="w-4 h-4 rounded bg-zinc-950 border-zinc-700 text-cyan-500 focus:ring-cyan-500/40 cursor-pointer"
          />
          <span className="flex items-center gap-1.5 font-medium">
            <EyeOff className="w-3.5 h-3.5 text-amber-400" />
            Marcar como spoiler
          </span>
        </label>

        <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
          <span
            className={`text-[11px] ${
              body.length > maxLength ? 'text-rose-400' : 'text-zinc-500'
            }`}
          >
            {body.length} / {maxLength}
          </span>

          <button
            type="submit"
            disabled={!isValid || submitting}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold transition-all shadow-md shadow-cyan-950/40 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            {submitting ? (
              <div className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            ) : (
              <Send className="w-3.5 h-3.5" />
            )}
            <span>{submitting ? 'Publicando...' : 'Comentar'}</span>
          </button>
        </div>
      </div>
    </form>
  );
};

export default CommentComposer;
