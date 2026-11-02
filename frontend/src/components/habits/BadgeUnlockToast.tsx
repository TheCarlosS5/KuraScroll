import React, { useEffect } from 'react';
import { UserBadgeItem } from './BadgeGridModal';

export interface BadgeUnlockToastProps {
  badge: UserBadgeItem | null;
  onDismiss: () => void;
  autoDismissMs?: number;
}

export const BadgeUnlockToast: React.FC<BadgeUnlockToastProps> = ({
  badge,
  onDismiss,
  autoDismissMs = 5000,
}) => {
  useEffect(() => {
    if (!badge) return;
    const timer = setTimeout(() => {
      onDismiss();
    }, autoDismissMs);
    return () => clearTimeout(timer);
  }, [badge, onDismiss, autoDismissMs]);

  if (!badge) return null;

  return (
    <aside
      aria-label="Alerta de medalla desbloqueada"
      style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        backgroundColor: '#1E293B',
        color: '#FFFFFF',
        padding: '16px 20px',
        borderRadius: '14px',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.6), 0 0 15px rgba(245, 158, 11, 0.3)',
        border: '1px solid #F59E0B',
        zIndex: 10000,
        display: 'flex',
        alignItems: 'center',
        gap: '14px',
        maxWidth: '380px',
        cursor: 'pointer',
        animation: 'slideIn 0.3s ease-out',
        contain: 'layout paint',
      }}
      onClick={onDismiss}
    >
      <div
        style={{
          fontSize: '2rem',
          lineHeight: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        🏆
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#F59E0B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          ¡Nueva Medalla Desbloqueada!
        </div>
        <div style={{ fontSize: '0.95rem', fontWeight: 700, margin: '2px 0' }}>
          {badge.title}
        </div>
        <div style={{ fontSize: '0.8rem', color: '#94A3B8', lineHeight: 1.2 }}>
          {badge.description}
        </div>
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDismiss();
        }}
        aria-label="Cerrar notificación"
        style={{
          background: 'transparent',
          border: 'none',
          color: '#64748B',
          fontSize: '1.2rem',
          cursor: 'pointer',
          padding: '4px',
        }}
      >
        &times;
      </button>
    </aside>
  );
};
