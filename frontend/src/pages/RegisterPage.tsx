import React, { useState } from 'react';
import { UserPlus, ArrowLeft, AlertCircle, Mail, KeyRound, User, CheckCircle2 } from 'lucide-react';

export interface RegisterPageProps {
  onSuccess: () => void;
  onNavigateLogin: () => void;
  onBack: () => void;
  onRegister: (params: {
    handle: string;
    email: string;
    password: string;
    displayName?: string;
  }) => Promise<{ user: any; requiresVerification: boolean }>;
  onVerifyEmail: (code: string) => Promise<any>;
  onResendCode: () => Promise<any>;
}

export const RegisterPage: React.FC<RegisterPageProps> = ({
  onSuccess,
  onNavigateLogin,
  onBack,
  onRegister,
  onVerifyEmail,
  onResendCode,
}) => {
  const [handle, setHandle] = useState('');
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Verification step
  const [requiresVerification, setRequiresVerification] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [resendStatus, setResendStatus] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!handle.trim() || !email.trim() || !password) {
      setError('Por favor complete todos los campos obligatorios.');
      return;
    }

    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }

    setLoading(true);
    try {
      const res = await onRegister({
        handle: handle.trim(),
        email: email.trim(),
        displayName: displayName.trim() || handle.trim(),
        password,
      });

      if (res.requiresVerification) {
        setRequiresVerification(true);
      } else {
        onSuccess();
      }
    } catch (err: any) {
      setError(err.message || 'Error al registrar la cuenta.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (verificationCode.trim().length !== 6) {
      setError('El código debe tener 6 dígitos.');
      return;
    }

    setLoading(true);
    try {
      await onVerifyEmail(verificationCode.trim());
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Código incorrecto o expirado.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResendStatus('Reenviando código...');
    try {
      await onResendCode();
      setResendStatus('Código reenviado con éxito a tu correo.');
    } catch (err: any) {
      setResendStatus(err.message || 'Error al reenviar código.');
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md bg-[#0e1422] border border-gray-800 rounded-2xl p-6 sm:p-8 shadow-xl">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-cyan-400 mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Volver</span>
        </button>

        {!requiresVerification ? (
          <>
            <div className="text-center mb-8">
              <div className="w-12 h-12 rounded-xl bg-cyan-600/20 border border-cyan-500/30 flex items-center justify-center mx-auto mb-3 text-cyan-400">
                <UserPlus className="w-6 h-6" />
              </div>
              <h1 className="text-2xl font-bold text-gray-100">Crear Cuenta</h1>
              <p className="text-sm text-gray-400 mt-1">
                Únete a la comunidad de lectores y creadores de KuraScroll.
              </p>
            </div>

            {error && (
              <div className="mb-6 p-3 rounded-xl bg-red-950/50 border border-red-800/80 text-red-200 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                  Nombre de Usuario (@handle) *
                </label>
                <div className="relative">
                  <span className="text-gray-500 absolute left-3 top-1/2 -translate-y-1/2 text-sm">@</span>
                  <input
                    type="text"
                    value={handle}
                    onChange={(e) => setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                    placeholder="otaku_lector"
                    maxLength={30}
                    required
                    className="w-full pl-8 pr-3 py-2.5 bg-gray-900 border border-gray-700/80 rounded-xl text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-cyan-500 transition-colors"
                  />
                </div>
                <p className="text-[11px] text-gray-500 mt-1">Solo letras, números y guiones bajos (3-30 caracteres).</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                  Nombre Público
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Carlos Scanlator"
                    maxLength={60}
                    className="w-full pl-9 pr-3 py-2.5 bg-gray-900 border border-gray-700/80 rounded-xl text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-cyan-500 transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                  Correo Electrónico *
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="usuario@correo.com"
                    required
                    className="w-full pl-9 pr-3 py-2.5 bg-gray-900 border border-gray-700/80 rounded-xl text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-cyan-500 transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                  Contraseña (8-128 caracteres) *
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    minLength={8}
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
                  <span>Creando cuenta...</span>
                ) : (
                  <>
                    <UserPlus className="w-4 h-4" />
                    <span>Registrarse</span>
                  </>
                )}
              </button>
            </form>

            <div className="mt-6 pt-6 border-t border-gray-800 text-center">
              <p className="text-xs text-gray-400">
                ¿Ya tienes una cuenta?{' '}
                <button
                  onClick={onNavigateLogin}
                  className="text-cyan-400 font-semibold hover:underline"
                >
                  Inicia sesión aquí
                </button>
              </p>
            </div>
          </>
        ) : (
          <div>
            <div className="text-center mb-6">
              <div className="w-12 h-12 rounded-xl bg-cyan-600/20 border border-cyan-500/30 flex items-center justify-center mx-auto mb-3 text-cyan-400">
                <Mail className="w-6 h-6" />
              </div>
              <h1 className="text-xl font-bold text-gray-100">Verificar Correo</h1>
              <p className="text-sm text-gray-400 mt-1">
                Hemos enviado un código de 6 dígitos a <span className="text-cyan-400">{email}</span>.
              </p>
            </div>

            {error && (
              <div className="mb-4 p-3 rounded-xl bg-red-950/50 border border-red-800/80 text-red-200 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {resendStatus && (
              <div className="mb-4 p-3 rounded-xl bg-gray-800 text-gray-200 text-xs">
                {resendStatus}
              </div>
            )}

            <form onSubmit={handleVerifyCode} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1.5 text-center">
                  Código de Verificación (6 dígitos)
                </label>
                <input
                  type="text"
                  maxLength={6}
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value.replace(/[^0-9]/g, ''))}
                  placeholder="123456"
                  required
                  className="w-full text-center tracking-widest text-2xl py-3 bg-gray-900 border border-gray-700/80 rounded-xl text-gray-100 focus:outline-none focus:border-cyan-500 font-mono"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-semibold text-sm shadow-md transition-colors flex items-center justify-center gap-2"
              >
                {loading ? 'Verificando...' : 'Confirmar Código'}
              </button>
            </form>

            <div className="mt-4 text-center">
              <button
                onClick={handleResend}
                className="text-xs text-gray-400 hover:text-cyan-400 transition-colors"
              >
                ¿No recibiste el código? Reenviar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
