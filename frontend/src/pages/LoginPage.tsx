import React, { useState } from 'react';
import { LogIn, ArrowLeft, AlertCircle, KeyRound, User, Mail, CheckCircle2, Compass } from 'lucide-react';

export interface LoginPageProps {
  onSuccess: () => void;
  onNavigateRegister: () => void;
  onBack: () => void;
  onSkip?: () => void;
  onLogin: (login: string, pass: string) => Promise<{ requiresVerification?: boolean }>;
  onVerifyEmail: (code: string) => Promise<any>;
  onResendCode: () => Promise<any>;
}

export const LoginPage: React.FC<LoginPageProps> = ({
  onSuccess,
  onNavigateRegister,
  onBack,
  onSkip,
  onLogin,
  onVerifyEmail,
  onResendCode,
}) => {
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requiresVerification, setRequiresVerification] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [resendStatus, setResendStatus] = useState<string | null>(null);

  const handleSkip = () => {
    if (onSkip) {
      onSkip();
    } else {
      onBack();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!loginId.trim() || !password) {
      setError('Por favor complete todos los campos.');
      return;
    }

    setLoading(true);
    try {
      const result = await onLogin(loginId.trim(), password);
      if (result?.requiresVerification) {
        setRequiresVerification(true);
      } else {
        onSuccess();
      }
    } catch (err: any) {
      setError(err.message || 'Error al iniciar sesión.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!/^\d{6}$/.test(verificationCode.trim())) {
      setError('El código debe tener 6 dígitos.');
      return;
    }

    setLoading(true);
    try {
      await onVerifyEmail(verificationCode.trim());
      onSuccess();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Código incorrecto o expirado.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    setLoading(true);
    setResendStatus('Reenviando código…');
    try {
      await onResendCode();
      setResendStatus('Código reenviado a tu correo.');
    } catch (cause) {
      setResendStatus(cause instanceof Error ? cause.message : 'No se pudo reenviar el código.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md bg-[#0e1422] border border-gray-800 rounded-2xl p-6 sm:p-8 shadow-xl">
        <div className="flex items-center justify-between mb-6">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-cyan-400 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Volver</span>
          </button>

          <button
            type="button"
            onClick={handleSkip}
            title="Explorar el catálogo en modo invitado"
            className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 hover:text-cyan-400 bg-gray-800/60 hover:bg-gray-800 border border-gray-700/60 px-3 py-1.5 rounded-lg transition-colors"
          >
            <span>Omitir</span>
            <Compass className="w-3.5 h-3.5 text-cyan-400" />
          </button>
        </div>

        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-cyan-600/20 border border-cyan-500/30 flex items-center justify-center mx-auto mb-3 text-cyan-400">
            <LogIn className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold text-gray-100">Iniciar Sesión</h1>
          <p className="text-sm text-gray-400 mt-1">
            Accede a tu cuenta de KuraScroll para sincronizar lecturas y comentar.
          </p>
        </div>

        {!requiresVerification && error && (
          <div className="mb-6 p-3 rounded-xl bg-red-950/50 border border-red-800/80 text-red-200 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {!requiresVerification ? (
          <>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                  Usuario o Correo Electrónico
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={loginId}
                    onChange={(e) => setLoginId(e.target.value)}
                    placeholder="ej. otaku_san o usuario@correo.com"
                    required
                    className="w-full pl-9 pr-3 py-2.5 bg-gray-900 border border-gray-700/80 rounded-xl text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-cyan-500 transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                  Contraseña
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    maxLength={128}
                    required
                    className="w-full pl-9 pr-3 py-2.5 bg-gray-900 border border-gray-700/80 rounded-xl text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-cyan-500 transition-colors"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-semibold text-sm shadow-md transition-colors mt-6 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <span>Iniciando sesión...</span>
                ) : (
                  <>
                    <LogIn className="w-4 h-4" />
                    <span>Ingresar</span>
                  </>
                )}
              </button>
            </form>

            <div className="mt-6 pt-6 border-t border-gray-800 text-center space-y-4">
              <p className="text-xs text-gray-400">
                ¿Aún no tienes cuenta?{' '}
                <button
                  type="button"
                  onClick={onNavigateRegister}
                  className="text-cyan-400 font-semibold hover:underline"
                >
                  Regístrate aquí
                </button>
              </p>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleSkip}
                  className="w-full py-2.5 px-4 rounded-xl bg-gray-800/80 hover:bg-gray-700/80 border border-gray-700 text-gray-200 hover:text-white font-medium text-xs transition-colors flex items-center justify-center gap-2 group"
                >
                  <Compass className="w-4 h-4 text-cyan-400 group-hover:scale-110 transition-transform" />
                  <span>Continuar como invitado (Omitir)</span>
                </button>
                <p className="text-[11px] text-gray-500 mt-1.5">
                  Accede al catálogo y lee sin cuenta. Tu progreso se guardará en tu dispositivo.
                </p>
              </div>
            </div>
          </>
        ) : (
          <div>
            <div className="text-center mb-6">
              <div className="w-12 h-12 rounded-xl bg-cyan-600/20 border border-cyan-500/30 flex items-center justify-center mx-auto mb-3 text-cyan-400">
                <Mail className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-bold text-gray-100">Verifica tu correo</h2>
              <p className="text-sm text-gray-400 mt-1">Introduce el código de seis dígitos que enviamos a tu correo.</p>
            </div>

            {error && (
              <div role="alert" className="mb-4 p-3 rounded-xl bg-red-950/50 border border-red-800/80 text-red-200 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleVerifyCode} className="space-y-4">
              <label htmlFor="login-verification-code" className="block text-xs font-semibold text-gray-300">Código de verificación</label>
              <input
                id="login-verification-code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                maxLength={6}
                value={verificationCode}
                onChange={(event) => setVerificationCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                required
                disabled={loading}
                className="w-full px-4 py-3 bg-gray-900 border border-gray-700/80 rounded-xl text-lg text-center tracking-[0.5em] text-gray-100 focus:outline-none focus:border-cyan-500"
              />
              <button
                type="submit"
                disabled={loading || verificationCode.length !== 6}
                className="w-full py-2.5 px-4 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                {loading ? 'Verificando…' : 'Verificar correo'}
              </button>
            </form>

            {resendStatus && <p role="status" className="mt-4 text-center text-xs text-gray-400">{resendStatus}</p>}
            <button
              type="button"
              onClick={handleResendCode}
              disabled={loading}
              className="w-full mt-4 text-xs text-cyan-400 hover:underline disabled:opacity-50"
            >
              Reenviar código
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
