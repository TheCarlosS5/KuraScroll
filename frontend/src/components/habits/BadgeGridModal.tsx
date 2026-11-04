import React, { useState, useEffect } from 'react';

export type BadgeCategory = 'volume' | 'streak' | 'time' | 'explorer' | 'collector';
export type BadgeRarity = 'common' | 'rare' | 'epic' | 'legendary';

export interface UserBadgeItem {
  id: string;
  title: string;
  description: string;
  icon: string;
  category: BadgeCategory;
  targetValue: number;
  rarity: BadgeRarity;
  currentValue: number;
  isUnlocked: boolean;
  unlockedAt: string | null;
  progressPercent: number;
}

export interface BadgeSummaryData {
  total: number;
  unlocked: number;
  inProgress: number;
  percentage: number;
}

export interface BadgeGridModalProps {
  isOpen: boolean;
  onClose: () => void;
  badges?: UserBadgeItem[];
  summary?: BadgeSummaryData;
}

const RARITY_COLORS: Record<BadgeRarity, { border: string; bg: string; text: string; label: string }> = {
  common: { border: '#64748B', bg: 'rgba(100, 116, 139, 0.2)', text: '#94A3B8', label: 'Común' },
  rare: { border: '#3B82F6', bg: 'rgba(59, 130, 246, 0.2)', text: '#60A5FA', label: 'Rara' },
  epic: { border: '#A855F7', bg: 'rgba(168, 85, 247, 0.2)', text: '#C084FC', label: 'Épica' },
  legendary: { border: '#F59E0B', bg: 'rgba(245, 158, 11, 0.2)', text: '#FCD34D', label: 'Legendaria' },
};

export const BadgeGridModal: React.FC<BadgeGridModalProps> = ({
  isOpen,
  onClose,
  badges = [],
  summary = { total: 12, unlocked: 0, inProgress: 0, percentage: 0 },
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [filterUnlockedOnly, setFilterUnlockedOnly] = useState<boolean>(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const filteredBadges = badges.filter((b) => {
    if (selectedCategory !== 'all' && b.category !== selectedCategory) return false;
    if (filterUnlockedOnly && !b.isUnlocked) return false;
    return true;
  });

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="badge-modal-title"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '16px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: '#0F172A',
          color: '#F8FAFC',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '720px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <h2 id="badge-modal-title" style={{ margin: 0, fontSize: '1.3rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
              Logros & Medallas de Lectura
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: '#94A3B8' }}>
              Desbloquea medallas leyendo mangas, manteniendo rachas y descubriendo obras.
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar modal"
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94A3B8',
              fontSize: '1.6rem',
              cursor: 'pointer',
              lineHeight: 1,
            }}
          >
            &times;
          </button>
        </div>

        {/* Summary Metric Bar */}
        <div
          style={{
            padding: '12px 24px',
            backgroundColor: '#1E293B',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
          }}
        >
          <div style={{ display: 'flex', gap: '16px', fontSize: '0.85rem' }}>
            <span>
              Desbloqueadas: <strong style={{ color: '#10B981' }}>{summary.unlocked}</strong> / {summary.total}
            </span>
            <span>
              Progreso General: <strong style={{ color: '#F59E0B' }}>{summary.percentage}%</strong>
            </span>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', cursor: 'pointer', color: '#CBD5E1' }}>
            <input
              type="checkbox"
              checked={filterUnlockedOnly}
              onChange={(e) => setFilterUnlockedOnly(e.target.checked)}
              style={{ cursor: 'pointer' }}
            />
            Solo desbloqueadas
          </label>
        </div>

        {/* Category Tabs */}
        <div
          style={{
            padding: '10px 24px',
            display: 'flex',
            gap: '8px',
            overflowX: 'auto',
            borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
          }}
        >
          {[
            { id: 'all', label: 'Todas' },
            { id: 'volume', label: 'Volumen' },
            { id: 'streak', label: 'Racha' },
            { id: 'time', label: 'Horarios' },
            { id: 'explorer', label: 'Explorador' },
            { id: 'collector', label: 'Colección' },
          ].map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(cat.id)}
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                border: '1px solid',
                borderColor: selectedCategory === cat.id ? '#3B82F6' : '#334155',
                backgroundColor: selectedCategory === cat.id ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
                color: selectedCategory === cat.id ? '#60A5FA' : '#94A3B8',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Badges Grid */}
        <div
          style={{
            padding: '20px 24px',
            overflowY: 'auto',
            flex: 1,
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: '12px',
          }}
        >
          {filteredBadges.map((badge) => {
            const rarity = RARITY_COLORS[badge.rarity];
            return (
              <div
                key={badge.id}
                data-testid={`badge-card-${badge.id}`}
                style={{
                  padding: '14px',
                  borderRadius: '12px',
                  backgroundColor: badge.isUnlocked ? '#1E293B' : '#0B1120',
                  border: '1px solid',
                  borderColor: badge.isUnlocked ? rarity.border : '#1E293B',
                  opacity: badge.isUnlocked ? 1 : 0.7,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  contain: 'layout paint',
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <span style={{ fontSize: '1.6rem', filter: badge.isUnlocked ? 'none' : 'grayscale(1)' }}>
                      {badge.isUnlocked ? 'Unlocked' : 'Locked'}
                    </span>
                    <span
                      style={{
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        padding: '2px 6px',
                        borderRadius: '4px',
                        backgroundColor: rarity.bg,
                        color: rarity.text,
                        border: `1px solid ${rarity.border}`,
                      }}
                    >
                      {rarity.label}
                    </span>
                  </div>

                  <h3 style={{ margin: '0 0 4px', fontSize: '0.95rem', fontWeight: 700, color: badge.isUnlocked ? '#FFF' : '#94A3B8' }}>
                    {badge.title}
                  </h3>
                  <p style={{ margin: 0, fontSize: '0.78rem', color: '#64748B', lineHeight: 1.3 }}>
                    {badge.description}
                  </p>
                </div>

                {/* Progress or Unlocked Badge Tag */}
                <div style={{ marginTop: '12px' }}>
                  {badge.isUnlocked ? (
                    <div style={{ fontSize: '0.75rem', color: '#10B981', fontWeight: 600 }}>
                      Desbloqueada
                    </div>
                  ) : (
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#94A3B8', marginBottom: '4px' }}>
                        <span>Progreso</span>
                        <span>{badge.currentValue} / {badge.targetValue}</span>
                      </div>
                      <div style={{ height: '5px', backgroundColor: '#334155', borderRadius: '3px', overflow: 'hidden' }}>
                        <div
                          style={{
                            height: '100%',
                            width: `${badge.progressPercent}%`,
                            backgroundColor: '#3B82F6',
                            transition: 'width 0.3s ease',
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
