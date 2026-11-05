import React, { useState, useEffect } from 'react';
import { ArrowLeft, User, Calendar, Edit3, Check, X, Shield } from 'lucide-react';
import { authApiClient, SessionIdentity } from '../services/auth-api-client.js';

export interface PublicProfileData {
  handle: string;
  displayName: string | null;
  bio: string | null;
  createdAt: string;
}

export interface UserProfilePageProps {
  handle: string;
  onBack?: () => void;
  currentUser?: SessionIdentity | null;
}

export const UserProfilePage: React.FC<UserProfilePageProps> = ({
  handle,
  onBack,
  currentUser: initialUser,
}) => {
  const [profile, setProfile] = useState<PublicProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [session, setSession] = useState<SessionIdentity | null>(initialUser || null);

  // Edit mode state
  const [isEditing, setIsEditing] = useState(false);
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      setLoading(true);
      setError(null);

      try {
        // Resolve current session if not provided
        if (!initialUser) {
          const s = await authApiClient.getSession();
          if (isMounted) setSession(s);
        }

        // Fetch public profile
        const res = await fetch(`/api/v1/users/${encodeURIComponent(handle)}`);
        if (!res.ok) {
          if (res.status === 404) {
            if (isMounted) setError('El usuario solicitado no existe o fue deshabilitado.');
          } else {
            if (isMounted) setError('No se pudo cargar la información del usuario.');
          }
          if (isMounted) setLoading(false);
          return;
        }

        const data = await res.json();
        if (isMounted) {
          setProfile(data.profile);
          setEditDisplayName(data.profile.displayName || '');
          setEditBio(data.profile.bio || '');
        }
      } catch (err) {
        if (isMounted) setError('Error de red al consultar el perfil.');
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadData();

    return () => {
      isMounted = false;
    };
  }, [handle, initialUser]);

  const isOwner = Boolean(
    session &&
    profile &&
    session.handle.toLowerCase() === profile.handle.toLowerCase()
  );

  const handleStartEdit = () => {
    if (!profile) return;
    setEditDisplayName(profile.displayName || '');
    setEditBio(profile.bio || '');
    setSaveError(null);
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    if (!profile) return;
    setEditDisplayName(profile.displayName || '');
    setEditBio(profile.bio || '');
    setSaveError(null);
    setIsEditing(false);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);

    try {
      const res = await fetch('/api/v1/users/me', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          displayName: editDisplayName.trim() || null,
          bio: editBio.trim() || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || 'Error al guardar los cambios.');
      }

      const updated = await res.json();
      setProfile(updated.profile);
      setIsEditing(false);
    } catch (err: any) {
      setSaveError(err.message || 'Ocurrió un error al actualizar el perfil.');
    } finally {
      setSaving(false);
    }
  };

  const formatJoinDate = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
      });
    } catch {
      return isoString;
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] max-w-2xl mx-auto px-4 py-16">
        <div className="w-10 h-10 border-4 border-cyan-500/20 border-t-cyan-400 rounded-full animate-spin mb-4" />
        <p className="text-zinc-400 text-sm">Cargando perfil público...</p>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center">
        <div className="w-16 h-16 rounded-full bg-zinc-800/80 border border-zinc-700/60 flex items-center justify-center mx-auto mb-4 text-zinc-400">
          <User className="w-8 h-8" />
        </div>
        <h1 className="text-xl font-bold text-white mb-2">Perfil no encontrado</h1>
        <p className="text-zinc-400 text-sm mb-6">
          {error || 'No se encontró ningún usuario con ese identificador.'}
        </p>
        {onBack && (
          <button
            onClick={onBack}
            className="px-5 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-sm font-medium transition-colors"
          >
            Volver
          </button>
        )}
      </div>
    );
  }

  const initialLetter = (profile.displayName || profile.handle).charAt(0).toUpperCase();

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {onBack && (
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-sm text-zinc-400 hover:text-white mb-8 transition-colors group cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
          <span>Volver</span>
        </button>
      )}

      <div className="bg-zinc-900/70 border border-zinc-800/80 rounded-2xl p-6 sm:p-8 backdrop-blur-sm shadow-xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 pb-6 border-b border-zinc-800/80">
          <div className="flex items-center gap-5">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-cyan-600 to-indigo-600 flex items-center justify-center text-white text-3xl font-extrabold shadow-lg shadow-cyan-950/40 select-none">
              {initialLetter}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-white tracking-tight">
                  {profile.displayName || profile.handle}
                </h1>
                {session?.role === 'admin' && session.handle.toLowerCase() === profile.handle.toLowerCase() && (
                  <span className="flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300">
                    <Shield className="w-3 h-3" /> Admin
                  </span>
                )}
              </div>
              <p className="text-sm font-mono text-cyan-400 mt-0.5">
                @{profile.handle}
              </p>
              <div className="flex items-center gap-1.5 text-xs text-zinc-400 mt-2">
                <Calendar className="w-3.5 h-3.5 text-zinc-500" />
                <span>Se unió en {formatJoinDate(profile.createdAt)}</span>
              </div>
            </div>
          </div>

          {isOwner && !isEditing && (
            <button
              onClick={handleStartEdit}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-sm font-medium border border-zinc-700/60 transition-colors shadow-sm cursor-pointer"
            >
              <Edit3 className="w-4 h-4 text-cyan-400" />
              <span>Editar perfil</span>
            </button>
          )}
        </div>

        {/* Profile Content / Edit Form */}
        <div className="pt-6">
          {isEditing ? (
            <form onSubmit={handleSaveProfile} className="space-y-5">
              {saveError && (
                <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm">
                  {saveError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
                  Nombre visible (2 a 40 caracteres)
                </label>
                <input
                  type="text"
                  value={editDisplayName}
                  onChange={(e) => setEditDisplayName(e.target.value)}
                  placeholder={profile.handle}
                  maxLength={40}
                  className="w-full px-4 py-2.5 rounded-xl bg-zinc-950/80 border border-zinc-800 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 text-white text-sm outline-none transition-all placeholder:text-zinc-600"
                />
                <p className="text-[11px] text-zinc-500 mt-1">
                  Tu identificador único sigue siendo @{profile.handle}.
                </p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                    Biografía corta
                  </label>
                  <span className={`text-[11px] ${editBio.length > 280 ? 'text-rose-400' : 'text-zinc-500'}`}>
                    {editBio.length} / 280
                  </span>
                </div>
                <textarea
                  value={editBio}
                  onChange={(e) => setEditBio(e.target.value)}
                  placeholder="Escribe algo sobre tus gustos o lecturas favoritas..."
                  rows={4}
                  maxLength={280}
                  className="w-full px-4 py-2.5 rounded-xl bg-zinc-950/80 border border-zinc-800 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 text-white text-sm outline-none transition-all placeholder:text-zinc-600 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  disabled={saving}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-zinc-800/80 hover:bg-zinc-800 text-zinc-300 text-sm font-medium transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                  <span>Cancelar</span>
                </button>
                <button
                  type="submit"
                  disabled={saving || editBio.length > 280}
                  className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-semibold transition-all shadow-md shadow-cyan-950/40 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {saving ? (
                    <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                  <span>{saving ? 'Guardando...' : 'Guardar cambios'}</span>
                </button>
              </div>
            </form>
          ) : (
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">
                Biografía
              </h2>
              {profile.bio ? (
                <p className="text-zinc-200 text-sm leading-relaxed whitespace-pre-wrap">
                  {profile.bio}
                </p>
              ) : (
                <p className="text-zinc-500 text-sm italic">
                  Este usuario no ha agregado una biografía aún.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UserProfilePage;
