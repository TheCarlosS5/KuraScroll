import React from 'react';
import { SafeUser } from '../../services/auth-service.js';
import { User, LogIn, LogOut, PlusCircle, Shield } from 'lucide-react';

export interface UserAuthHUDProps {
  user: SafeUser | null;
  onNavigate: (view: string, handle?: string) => void;
  onLogout: () => void;
}

export const UserAuthHUD: React.FC<UserAuthHUDProps> = ({
  user,
  onNavigate,
  onLogout,
}) => {
  return (
    <div className="flex items-center gap-2">
      {user ? (
        <div className="flex items-center gap-2">
          {(user.role === 'moderator' || user.role === 'admin') && (
            <button
              type="button"
              onClick={() => onNavigate('moderation')}
              className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600/15 text-amber-300 border border-amber-600/30 text-xs font-semibold hover:bg-amber-600/25 transition-colors"
            >
              <Shield className="w-3.5 h-3.5" /> Moderación
            </button>
          )}
          {/* Quick Publish Action */}
          <button
            onClick={() => onNavigate('publish')}
            title="Publicar Manga / Capítulo"
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-600/20 text-cyan-400 border border-cyan-500/30 text-xs font-semibold hover:bg-cyan-600/30 transition-colors"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Publicar</span>
          </button>

          {/* User Profile Button */}
          <button
            onClick={() => onNavigate('profile', user.handle)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-800/80 hover:bg-gray-700/80 border border-gray-700/60 text-xs text-gray-200 transition-colors"
          >
            {user.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt={user.displayName}
                className="w-4 h-4 rounded-full object-cover"
              />
            ) : (
              <User className="w-3.5 h-3.5 text-cyan-400" />
            )}
            <span className="font-semibold">{user.displayName}</span>
            {user.role !== 'user' && (
              <span className="flex items-center gap-0.5 text-[10px] uppercase font-bold text-amber-400 bg-amber-950/60 border border-amber-800 px-1 rounded">
                <Shield className="w-2.5 h-2.5" />
                {user.role}
              </span>
            )}
          </button>

          {/* Logout Button */}
          <button
            onClick={onLogout}
            title="Cerrar sesión"
            className="p-1.5 rounded-lg bg-gray-800/60 hover:bg-red-950/50 hover:text-red-400 border border-gray-700/50 text-gray-400 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <button
            onClick={() => onNavigate('login')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-800/80 hover:bg-gray-700 border border-gray-700/60 text-xs font-semibold text-gray-300 hover:text-white transition-colors"
          >
            <LogIn className="w-3.5 h-3.5 text-cyan-400" />
            <span>Ingresar</span>
          </button>

          <button
            onClick={() => onNavigate('register')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shadow-sm transition-colors"
          >
            <span>Crear cuenta</span>
          </button>
        </div>
      )}
    </div>
  );
};
