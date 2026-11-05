import React, { useState } from 'react';
import { useAuth } from './AuthProvider.js';
import { BookOpen, LogIn, UserPlus, ArrowRight, ShieldCheck, WifiOff, KeyRound } from 'lucide-react';
import { authApiClient } from '../../services/auth-api-client.js';

interface AuthEntryScreenProps {
  onSuccess?: () => void;
}

export const AuthEntryScreen: React.FC<AuthEntryScreenProps> = ({ onSuccess }) => {
  const { login, register, skipToGuest } = useAuth();
  const [tab, setTab] = useState<'login' | 'register' | 'forgot'>('login');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [handle, setHandle] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setSubmitting(true);

    try {
      if (tab === 'login') {
        await login({ email, password });
        onSuccess?.();
      } else if (tab === 'register') {
        if (!handle.trim()) {
          throw new Error('El identificador público (handle) es requerido.');
        }
        await register({ email, password, handle: handle.trim(), displayName: displayName.trim() || undefined });
        onSuccess?.();
      } else if (tab === 'forgot') {
        const res = await authApiClient.forgotPassword(email);
        setSuccessMsg(res.message || 'Si el correo está registrado, se envió un enlace de restablecimiento.');
      }
    } catch (err: any) {
      setError(err.message || 'Ocurrió un error inesperado');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSkip = () => {
    skipToGuest();
    onSuccess?.();
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col justify-center items-center px-4 py-8">
      <div className="w-full max-w-md bg-zinc-900/90 border border-zinc-800 rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl">
        {/* Header / Brand */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-600/20 text-indigo-400 mb-3 border border-indigo-500/30">
            <BookOpen className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">KuraScroll</h1>
          <p className="text-xs text-zinc-400 mt-1">
            Lector de Manga, Manhwa y Manhua de Alto Rendimiento
          </p>
        </div>

        {/* Offline Notice Banner */}
        {isOffline && (
          <div className="mb-5 p-3 rounded-xl bg-amber-950/40 border border-amber-800/60 text-amber-300 text-xs flex items-center gap-2.5">
            <WifiOff className="w-4 h-4 shrink-0 text-amber-400" />
            <div>
              <p className="font-medium">Modo sin conexión detectado</p>
              <p className="text-amber-400/80">Puedes usar <strong>Omitir</strong> para leer el contenido disponible en caché.</p>
            </div>
          </div>
        )}

        {/* Prominent SKIP / GUEST Button (Always Visible Online and Offline) */}
        <div className="mb-6">
          <button
            type="button"
            onClick={handleSkip}
            className="w-full py-3 px-4 rounded-xl font-medium text-sm transition-all duration-200 flex items-center justify-center gap-2 bg-zinc-800/90 hover:bg-zinc-700/90 text-zinc-200 border border-zinc-700 hover:border-zinc-500 hover:text-white shadow-sm"
          >
            <span>Continuar como invitado (Omitir)</span>
            <ArrowRight className="w-4 h-4" />
          </button>
          <p className="text-[11px] text-zinc-500 text-center mt-1.5">
            Acceso libre al catálogo y lectura. El progreso se guarda en este dispositivo.
          </p>
        </div>

        {/* Divider */}
        <div className="relative flex items-center justify-center mb-6">
          <div className="border-t border-zinc-800 w-full" />
          <span className="bg-zinc-900 px-3 text-[11px] text-zinc-500 uppercase tracking-wider font-semibold">
            O accede a tu cuenta
          </span>
          <div className="border-t border-zinc-800 w-full" />
        </div>

        {/* Tabs */}
        <div className="grid grid-cols-2 gap-1 bg-zinc-950/60 p-1 rounded-xl mb-6 border border-zinc-800/80">
          <button
            type="button"
            onClick={() => { setTab('login'); setError(null); }}
            className={`py-2 text-xs font-medium rounded-lg transition-colors flex items-center justify-center gap-1.5 ${
              tab === 'login' ? 'bg-indigo-600 text-white shadow' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>Iniciar Sesión</span>
          </button>
          <button
            type="button"
            onClick={() => { setTab('register'); setError(null); }}
            className={`py-2 text-xs font-medium rounded-lg transition-colors flex items-center justify-center gap-1.5 ${
              tab === 'register' ? 'bg-indigo-600 text-white shadow' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Crear Cuenta</span>
          </button>
        </div>

        {/* Error / Success Feedback */}
        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-950/50 border border-red-800/60 text-red-300 text-xs">
            {error}
          </div>
        )}
        {successMsg && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-950/50 border border-emerald-800/60 text-emerald-300 text-xs">
            {successMsg}
          </div>
        )}

        {/* Auth Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {tab === 'register' && (
            <>
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Nombre de usuario único (@handle)
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-zinc-500 text-sm">@</span>
                  <input
                    type="text"
                    required
                    value={handle}
                    onChange={(e) => setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                    placeholder="otaku_lector"
                    className="w-full pl-8 pr-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Nombre visible (opcional)
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Carlos"
                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </>
          )}

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">
              Correo Electrónico
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@correo.com"
              className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {tab !== 'forgot' && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-medium text-zinc-300">
                  Contraseña
                </label>
                {tab === 'login' && (
                  <button
                    type="button"
                    onClick={() => { setTab('forgot'); setError(null); }}
                    className="text-[11px] text-indigo-400 hover:text-indigo-300"
                  >
                    ¿Olvidaste tu contraseña?
                  </button>
                )}
              </div>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-indigo-500"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 px-4 rounded-xl font-medium text-sm transition-colors flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white shadow disabled:opacity-50"
          >
            {submitting ? (
              <span>Procesando...</span>
            ) : tab === 'login' ? (
              <>
                <LogIn className="w-4 h-4" />
                <span>Iniciar Sesión</span>
              </>
            ) : tab === 'register' ? (
              <>
                <UserPlus className="w-4 h-4" />
                <span>Registrar Cuenta</span>
              </>
            ) : (
              <>
                <KeyRound className="w-4 h-4" />
                <span>Enviar Enlace de Recuperación</span>
              </>
            )}
          </button>

          {tab === 'forgot' && (
            <button
              type="button"
              onClick={() => { setTab('login'); setError(null); }}
              className="w-full py-1 text-xs text-zinc-400 hover:text-zinc-200 text-center"
            >
              Volver al inicio de sesión
            </button>
          )}
        </form>

        <div className="mt-6 pt-4 border-t border-zinc-800/60 flex items-center justify-center gap-1.5 text-[11px] text-zinc-500">
          <ShieldCheck className="w-3.5 h-3.5 text-zinc-400" />
          <span>Tus datos de lectura son privados y seguros.</span>
        </div>
      </div>
    </div>
  );
};
