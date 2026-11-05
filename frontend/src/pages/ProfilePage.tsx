import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, User, Calendar, BookOpen, Shield, Edit3, Save, AlertCircle, Camera } from 'lucide-react';
import { SafeUser, ClientAuthService } from '../services/auth-service.js';

export interface ProfilePageProps {
  handle: string;
  currentUser: SafeUser | null;
  onBack: () => void;
  onSelectSeries: (slug: string) => void;
  onUserUpdated?: (user: SafeUser) => void;
}

export const ProfilePage: React.FC<ProfilePageProps> = ({
  handle,
  currentUser,
  onBack,
  onSelectSeries,
  onUserUpdated,
}) => {
  const [profile, setProfile] = useState<any | null>(null);
  const [series, setSeries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Editing state
  const [isEditing, setIsEditing] = useState(false);
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [saving, setSaving] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isOwnProfile = Boolean(currentUser && currentUser.handle.toLowerCase() === handle.toLowerCase());

  const handleAvatarSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert('La imagen de avatar debe pesar menos de 5 MB.');
      return;
    }
    setAvatarUploading(true);
    try {
      const res = await ClientAuthService.uploadAvatar(file);
      setProfile((prev: any) => ({
        ...prev,
        avatarUrl: res.avatarUrl,
      }));
      if (onUserUpdated && res.user) {
        onUserUpdated(res.user);
      }
    } catch (err: any) {
      alert(err.message || 'Error al subir avatar');
    } finally {
      setAvatarUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  useEffect(() => {
    async function loadProfile() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/v1/users/${handle}`);
        if (!res.ok) {
          throw new Error('Perfil no encontrado');
        }
        const data = await res.json();
        setProfile(data.profile);
        setSeries(data.series || []);
        setEditDisplayName(data.profile.displayName);
        setEditBio(data.profile.bio || '');
      } catch (err: any) {
        setError(err.message || 'Error al cargar perfil.');
      } finally {
        setLoading(false);
      }
    }

    loadProfile();
  }, [handle]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const updated = await ClientAuthService.updateProfile({
        displayName: editDisplayName.trim(),
        bio: editBio.trim(),
      });
      setProfile((prev: any) => ({
        ...prev,
        displayName: updated.displayName,
        bio: updated.bio,
      }));
      setIsEditing(false);
      if (onUserUpdated) {
        onUserUpdated(updated);
      }
    } catch (err: any) {
      alert(err.message || 'Error al actualizar perfil');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 text-center text-gray-400">
        Cargando perfil...
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <div className="p-4 rounded-2xl bg-gray-900 border border-gray-800">
          <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-2" />
          <h2 className="text-lg font-bold text-gray-100">Usuario no encontrado</h2>
          <p className="text-sm text-gray-400 mt-1">El perfil @{handle} no existe o fue eliminado.</p>
          <button
            onClick={onBack}
            className="mt-4 px-4 py-2 rounded-xl bg-gray-800 text-xs font-semibold text-gray-200 hover:bg-gray-700 transition-colors"
          >
            Volver al catálogo
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-cyan-400 mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Volver</span>
      </button>

      {/* Header Profile Card */}
      <div className="bg-[#0e1422] border border-gray-800 rounded-2xl p-6 sm:p-8 mb-8 relative">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
          <div className="relative group w-20 h-20 rounded-2xl bg-cyan-950/60 border border-cyan-500/40 flex items-center justify-center text-cyan-400 flex-shrink-0 overflow-hidden">
            {profile.avatarUrl ? (
              <img
                src={profile.avatarUrl}
                alt={profile.displayName}
                className="w-full h-full rounded-2xl object-cover"
              />
            ) : (
              <User className="w-10 h-10" />
            )}

            {isOwnProfile && (
              <>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleAvatarSelect}
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={avatarUploading}
                  title="Cambiar avatar"
                  className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center text-white transition-opacity text-[10px] font-semibold"
                >
                  <Camera className="w-5 h-5 mb-0.5 text-cyan-300" />
                  <span>{avatarUploading ? 'Subiendo...' : 'Cambiar'}</span>
                </button>
              </>
            )}
          </div>

          <div className="flex-1 text-center sm:text-left">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mb-1">
              <h1 className="text-2xl font-bold text-gray-100">{profile.displayName}</h1>
              <span className="text-sm text-cyan-400 font-mono">@{profile.handle}</span>
              {profile.role !== 'user' && (
                <span className="flex items-center gap-1 text-[10px] uppercase font-bold text-amber-400 bg-amber-950/60 border border-amber-800 px-1.5 py-0.5 rounded">
                  <Shield className="w-3 h-3" />
                  {profile.role}
                </span>
              )}
            </div>

            {profile.bio && (
              <p className="text-sm text-gray-300 mt-2 max-w-xl leading-relaxed whitespace-pre-wrap">
                {profile.bio}
              </p>
            )}

            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 text-xs text-gray-400 mt-4">
              <span className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-gray-500" />
                Miembro desde {new Date(profile.createdAt).toLocaleDateString('es-ES', { month: 'short', year: 'numeric' })}
              </span>
              <span className="flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-gray-500" />
                {profile.seriesCount} {profile.seriesCount === 1 ? 'manga publicado' : 'mangas publicados'}
              </span>
            </div>
          </div>

          {isOwnProfile && (
            <button
              onClick={() => setIsEditing(!isEditing)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-xs font-semibold text-gray-300 transition-colors"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>{isEditing ? 'Cancelar' : 'Editar Perfil'}</span>
            </button>
          )}
        </div>

        {/* Edit Form */}
        {isEditing && (
          <form onSubmit={handleSaveProfile} className="mt-6 pt-6 border-t border-gray-800 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">Nombre Visible</label>
              <input
                type="text"
                value={editDisplayName}
                onChange={(e) => setEditDisplayName(e.target.value)}
                maxLength={60}
                required
                className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-xl text-sm text-gray-100"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">Biografía</label>
              <textarea
                value={editBio}
                onChange={(e) => setEditBio(e.target.value)}
                maxLength={500}
                rows={3}
                placeholder="Cuéntale a la comunidad sobre ti y tus mangas favoritos..."
                className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-xl text-sm text-gray-100"
              />
            </div>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-semibold transition-colors"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{saving ? 'Guardando...' : 'Guardar Cambios'}</span>
            </button>
          </form>
        )}
      </div>

      {/* Published Manga Works */}
      <div>
        <h2 className="text-lg font-bold text-gray-200 mb-4 flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-cyan-400" />
          <span>Mangas Publicados</span>
        </h2>

        {series.length === 0 ? (
          <div className="p-8 text-center bg-gray-900/40 rounded-2xl border border-gray-800 text-gray-400 text-sm">
            Este usuario aún no ha publicado mangas en la plataforma.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {series.map((s) => (
              <div
                key={s.id}
                onClick={() => onSelectSeries(s.slug)}
                className="bg-[#0e1422] border border-gray-800 rounded-xl overflow-hidden cursor-pointer hover:border-cyan-500/50 hover:bg-[#131b2e] transition-all group"
              >
                <div className="aspect-[3/4] bg-gray-900 relative overflow-hidden">
                  {s.coverImage ? (
                    <img
                      src={s.coverImage}
                      alt={s.titlePrimary}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-600">
                      <BookOpen className="w-8 h-8" />
                    </div>
                  )}
                </div>
                <div className="p-3">
                  <h3 className="text-sm font-semibold text-gray-200 line-clamp-1 group-hover:text-cyan-400 transition-colors">
                    {s.titlePrimary}
                  </h3>
                  <div className="flex items-center justify-between text-[11px] text-gray-500 mt-1 capitalize">
                    <span>{s.type}</span>
                    <span>{s.status}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
