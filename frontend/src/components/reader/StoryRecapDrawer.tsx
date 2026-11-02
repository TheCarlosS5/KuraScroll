import React, { useState, useEffect } from 'react';

export interface CharacterStatusItem {
  id: string;
  name: string;
  role: string;
  status: 'active' | 'injured' | 'captured' | 'deceased' | 'unknown';
  affiliation?: string;
  avatarUrl?: string;
  notes?: string;
}

export interface KeyEventItem {
  chapter: number;
  title: string;
  description: string;
  significance: 'pivotal' | 'major' | 'minor';
}

export interface StoryRecapDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  arcTitle: string;
  throughChapterSeq: number;
  currentChapterNumber: number;
  summaryText: string;
  characterStatuses?: CharacterStatusItem[];
  keyEvents?: KeyEventItem[];
  cliffhangerWarning?: string | null;
  onDontShowAgain?: () => void;
}

export const StoryRecapDrawer: React.FC<StoryRecapDrawerProps> = ({
  isOpen,
  onClose,
  arcTitle,
  throughChapterSeq,
  currentChapterNumber,
  summaryText,
  characterStatuses = [],
  keyEvents = [],
  cliffhangerWarning,
  onDontShowAgain,
}) => {
  const [activeTab, setActiveTab] = useState<'summary' | 'characters' | 'timeline'>('summary');

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const getStatusColor = (status: CharacterStatusItem['status']) => {
    switch (status) {
      case 'active':
        return '#22c55e'; // Green
      case 'injured':
      case 'captured':
        return '#f59e0b'; // Amber
      case 'deceased':
        return '#ef4444'; // Red
      default:
        return '#94a3b8'; // Slate
    }
  };

  const getStatusLabel = (status: CharacterStatusItem['status']) => {
    switch (status) {
      case 'active':
        return 'Activo';
      case 'injured':
        return 'Herido';
      case 'captured':
        return 'Capturado';
      case 'deceased':
        return 'Caído';
      default:
        return 'Desconocido';
    }
  };

  return (
    <>
      {/* Dimmed Overlay without CSS blur for Intel GMA 4500MHD performance */}
      <div
        data-testid="story-recap-overlay"
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.65)',
          opacity: isOpen ? 1 : 0,
          pointerEvents: isOpen ? 'auto' : 'none',
          transition: 'opacity 0.25s ease',
          zIndex: 90,
        }}
        aria-hidden={!isOpen}
      />

      {/* Slide-over Drawer with 0 CLS and pure transform animations */}
      <aside
        data-testid="story-recap-drawer"
        role="dialog"
        aria-label="Acompañante de Resumen de Historia"
        aria-modal="true"
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: '100%',
          maxWidth: '460px',
          backgroundColor: '#121316',
          borderLeft: '1px solid #27272a',
          color: '#f4f4f5',
          transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
          zIndex: 100,
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '-4px 0 24px rgba(0, 0, 0, 0.6)',
          contain: 'layout paint',
          willChange: 'transform',
        }}
      >
        {/* Header with Anti-Spoiler Badge */}
        <header
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid #27272a',
            backgroundColor: '#18181b',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  padding: '3px 8px',
                  borderRadius: '4px',
                  backgroundColor: '#3b82f6',
                  color: '#ffffff',
                }}
              >
                Previously On...
              </span>
              <span style={{ fontSize: '12px', color: '#a1a1aa' }}>
                Capítulo actual: <strong>#{currentChapterNumber}</strong>
              </span>
            </div>
            <button
              data-testid="recap-close-button"
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#a1a1aa',
                cursor: 'pointer',
                fontSize: '20px',
                padding: '4px 8px',
                borderRadius: '4px',
              }}
              title="Cerrar resumen"
            >
              ✕
            </button>
          </div>

          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: '#fafafa' }}>
            {arcTitle}
          </h2>

          <div
            style={{
              fontSize: '12px',
              color: '#10b981',
              backgroundColor: '#064e3b33',
              border: '1px solid #059669',
              borderRadius: '6px',
              padding: '6px 10px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <span>🛡️</span>
            <span>
              Resumen hasta el <strong>Cap. {throughChapterSeq}</strong> (100% Anti-Spoiler para Cap. {currentChapterNumber})
            </span>
          </div>

          {/* Tab Selector */}
          <nav
            style={{
              display: 'flex',
              gap: '4px',
              marginTop: '6px',
              borderBottom: '1px solid #27272a',
              paddingBottom: '2px',
            }}
          >
            <button
              data-testid="tab-summary"
              onClick={() => setActiveTab('summary')}
              style={{
                flex: 1,
                padding: '8px 12px',
                background: 'transparent',
                border: 'none',
                borderBottom: activeTab === 'summary' ? '2px solid #3b82f6' : '2px solid transparent',
                color: activeTab === 'summary' ? '#ffffff' : '#a1a1aa',
                fontWeight: activeTab === 'summary' ? 600 : 400,
                cursor: 'pointer',
                fontSize: '13px',
              }}
            >
              Sinopsis
            </button>
            <button
              data-testid="tab-characters"
              onClick={() => setActiveTab('characters')}
              style={{
                flex: 1,
                padding: '8px 12px',
                background: 'transparent',
                border: 'none',
                borderBottom: activeTab === 'characters' ? '2px solid #3b82f6' : '2px solid transparent',
                color: activeTab === 'characters' ? '#ffffff' : '#a1a1aa',
                fontWeight: activeTab === 'characters' ? 600 : 400,
                cursor: 'pointer',
                fontSize: '13px',
              }}
            >
              Personajes ({characterStatuses.length})
            </button>
            <button
              data-testid="tab-timeline"
              onClick={() => setActiveTab('timeline')}
              style={{
                flex: 1,
                padding: '8px 12px',
                background: 'transparent',
                border: 'none',
                borderBottom: activeTab === 'timeline' ? '2px solid #3b82f6' : '2px solid transparent',
                color: activeTab === 'timeline' ? '#ffffff' : '#a1a1aa',
                fontWeight: activeTab === 'timeline' ? 600 : 400,
                cursor: 'pointer',
                fontSize: '13px',
              }}
            >
              Eventos ({keyEvents.length})
            </button>
          </nav>
        </header>

        {/* Scrollable Content Body */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
          }}
        >
          {activeTab === 'summary' && (
            <div data-testid="recap-tab-content-summary" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#e4e4e7', marginBottom: '8px' }}>
                  Acontecimientos Previos
                </h3>
                <p style={{ fontSize: '13px', lineHeight: '1.6', color: '#d4d4d8', whiteSpace: 'pre-line' }}>
                  {summaryText}
                </p>
              </div>

              {cliffhangerWarning && (
                <div
                  style={{
                    backgroundColor: '#7c2d1233',
                    border: '1px solid #c2410c',
                    borderRadius: '8px',
                    padding: '12px 14px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                  }}
                >
                  <strong style={{ fontSize: '13px', color: '#fdba74' }}>⚠️ Estado al final del arco:</strong>
                  <span style={{ fontSize: '12px', color: '#fed7aa', lineHeight: '1.5' }}>
                    {cliffhangerWarning}
                  </span>
                </div>
              )}
            </div>
          )}

          {activeTab === 'characters' && (
            <div data-testid="recap-tab-content-characters" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {characterStatuses.length === 0 ? (
                <p style={{ fontSize: '13px', color: '#71717a' }}>Sin estados registrados de personajes para este arco.</p>
              ) : (
                characterStatuses.map((char) => (
                  <div
                    key={char.id}
                    data-testid={`character-card-${char.id}`}
                    style={{
                      backgroundColor: '#18181b',
                      border: '1px solid #27272a',
                      borderRadius: '8px',
                      padding: '12px 14px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong style={{ fontSize: '14px', color: '#f4f4f5' }}>{char.name}</strong>
                      <span
                        style={{
                          fontSize: '11px',
                          padding: '2px 8px',
                          borderRadius: '12px',
                          backgroundColor: `${getStatusColor(char.status)}22`,
                          color: getStatusColor(char.status),
                          border: `1px solid ${getStatusColor(char.status)}88`,
                          fontWeight: 600,
                        }}
                      >
                        {getStatusLabel(char.status)}
                      </span>
                    </div>
                    <span style={{ fontSize: '12px', color: '#a1a1aa' }}>
                      {char.role} {char.affiliation ? `• ${char.affiliation}` : ''}
                    </span>
                    {char.notes && (
                      <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#71717a', fontStyle: 'italic' }}>
                        {char.notes}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'timeline' && (
            <div data-testid="recap-tab-content-timeline" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {keyEvents.length === 0 ? (
                <p style={{ fontSize: '13px', color: '#71717a' }}>No hay cronología de eventos guardada para este arco.</p>
              ) : (
                keyEvents.map((evt, idx) => (
                  <div
                    key={idx}
                    data-testid={`timeline-event-${evt.chapter}`}
                    style={{
                      borderLeft: evt.significance === 'pivotal' ? '3px solid #ef4444' : '3px solid #3b82f6',
                      paddingLeft: '12px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '2px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: '#3b82f6' }}>
                        Cap. {evt.chapter}
                      </span>
                      <strong style={{ fontSize: '13px', color: '#e4e4e7' }}>{evt.title}</strong>
                    </div>
                    <p style={{ margin: 0, fontSize: '12px', color: '#a1a1aa', lineHeight: '1.4' }}>
                      {evt.description}
                    </p>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <footer
          style={{
            padding: '16px 20px',
            borderTop: '1px solid #27272a',
            backgroundColor: '#18181b',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          {onDontShowAgain ? (
            <button
              data-testid="recap-dont-show-again-btn"
              onClick={onDontShowAgain}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#71717a',
                fontSize: '12px',
                cursor: 'pointer',
                textDecoration: 'underline',
              }}
            >
              No mostrar para este arco
            </button>
          ) : (
            <div />
          )}

          <button
            data-testid="recap-continue-reading-btn"
            onClick={onClose}
            style={{
              backgroundColor: '#3b82f6',
              border: 'none',
              borderRadius: '6px',
              padding: '8px 16px',
              color: '#ffffff',
              fontWeight: 600,
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            Continuar Lectura →
          </button>
        </footer>
      </aside>
    </>
  );
};
