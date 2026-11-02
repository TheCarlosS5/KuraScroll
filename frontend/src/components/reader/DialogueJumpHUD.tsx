/**
 * Sprint 60 - Instant Dialogue Jump HUD & Quote Scrubber
 *
 * Micro-search modal optimized for Intel GMA 4500MHD:
 * - Pure solid colors (ZERO CSS blur, ZERO backdrop-filter)
 * - Strict layout containment (contain: layout paint) for CLS = 0
 * - Instant quote navigation and bounding-box jumping
 * - Anti-spoiler causal progress toggle
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  useDialogueSearch,
  DialogueSearchResultItem,
  UseDialogueSearchOptions,
} from '../../reader/useDialogueSearch.js';

export interface DialogueJumpHUDProps {
  isOpen: boolean;
  onClose: () => void;
  onJumpToBubble: (result: DialogueSearchResultItem) => void;
  searchOptions?: UseDialogueSearchOptions;
}

export const DialogueJumpHUD: React.FC<DialogueJumpHUDProps> = ({
  isOpen,
  onClose,
  onJumpToBubble,
  searchOptions = {},
}) => {
  const {
    query,
    setQuery,
    results,
    isLoading,
    error,
    protectSpoilers,
    setProtectSpoilers,
    totalMatches,
    queryTimeMs,
    clear,
  } = useDialogueSearch(searchOptions);

  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setSelectedIndex(0);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (results.length > 0 ? (prev + 1) % results.length : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) =>
        results.length > 0 ? (prev - 1 + results.length) % results.length : 0
      );
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (results[selectedIndex]) {
        onJumpToBubble(results[selectedIndex]);
        onClose();
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Buscador de Diálogos y Citas"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: '64px',
        backgroundColor: 'rgba(0, 0, 0, 0.75)', // Solid dimming without blur
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown={handleKeyDown}
    >
      <div
        style={{
          width: '90%',
          maxWidth: '560px',
          maxHeight: '80vh',
          backgroundColor: '#18181b', // Pure solid background, zero blur
          border: '1px solid #27272a',
          borderRadius: '8px',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 10px 25px rgba(0, 0, 0, 0.6)',
          contain: 'layout paint',
          color: '#f4f4f5',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        {/* Header & Search Input */}
        <div
          style={{
            padding: '12px 16px',
            borderBottom: '1px solid #27272a',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
          }}
        >
          <span style={{ fontSize: '16px', color: '#00e5ff' }}>💬</span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar frase, diálogo o personaje (CJK o texto)..."
            aria-label="Buscar diálogo"
            style={{
              flex: 1,
              backgroundColor: '#27272a',
              border: '1px solid #3f3f46',
              borderRadius: '6px',
              padding: '8px 12px',
              color: '#ffffff',
              fontSize: '13px',
              outline: 'none',
            }}
          />
          {query && (
            <button
              type="button"
              onClick={clear}
              aria-label="Limpiar búsqueda"
              style={{
                backgroundColor: 'transparent',
                border: 'none',
                color: '#a1a1aa',
                cursor: 'pointer',
                fontSize: '14px',
                padding: '4px',
              }}
            >
              ✕
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar buscador"
            style={{
              backgroundColor: '#27272a',
              border: '1px solid #3f3f46',
              borderRadius: '4px',
              color: '#a1a1aa',
              cursor: 'pointer',
              fontSize: '11px',
              padding: '4px 8px',
            }}
          >
            ESC
          </button>
        </div>

        {/* Toolbar & Filter Options */}
        <div
          style={{
            padding: '6px 16px',
            backgroundColor: '#121215',
            borderBottom: '1px solid #27272a',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '11px',
            color: '#a1a1aa',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>
              {isLoading
                ? 'Buscando...'
                : totalMatches > 0
                ? `${totalMatches} coincidencia${totalMatches > 1 ? 's' : ''} (${queryTimeMs} ms)`
                : query
                ? 'Sin coincidencias'
                : 'Escribe para buscar'}
            </span>
          </div>

          {/* Anti-Spoiler Toggle */}
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
              userSelect: 'none',
            }}
          >
            <input
              type="checkbox"
              checked={protectSpoilers}
              onChange={(e) => setProtectSpoilers(e.target.checked)}
              style={{ cursor: 'pointer' }}
            />
            <span style={{ color: protectSpoilers ? '#38bdf8' : '#71717a' }}>
              🛡️ Protección Anti-Spoiler
            </span>
          </label>
        </div>

        {/* Results List */}
        <div
          role="listbox"
          aria-label="Resultados de diálogos"
          style={{
            flex: 1,
            overflowY: 'auto',
            maxHeight: '360px',
            padding: '8px',
          }}
        >
          {error && (
            <div
              style={{
                padding: '12px',
                color: '#f87171',
                fontSize: '12px',
                textAlign: 'center',
              }}
            >
              {error}
            </div>
          )}

          {!isLoading && results.length === 0 && query.trim() && !error && (
            <div
              style={{
                padding: '24px 16px',
                color: '#71717a',
                fontSize: '12px',
                textAlign: 'center',
              }}
            >
              No se encontraron diálogos con "{query}".
            </div>
          )}

          {results.map((item, idx) => {
            const isSelected = idx === selectedIndex;
            return (
              <div
                key={item.bubbleId}
                role="option"
                aria-selected={isSelected}
                onClick={() => {
                  onJumpToBubble(item);
                  onClose();
                }}
                onMouseEnter={() => setSelectedIndex(idx)}
                style={{
                  padding: '8px 12px',
                  borderRadius: '6px',
                  marginBottom: '4px',
                  backgroundColor: isSelected ? '#27272a' : 'transparent',
                  border: isSelected ? '1px solid #38bdf8' : '1px solid transparent',
                  cursor: 'pointer',
                  transition: 'background-color 0.1s ease',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '4px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span
                      style={{
                        fontSize: '10px',
                        fontWeight: 600,
                        backgroundColor: '#0284c7',
                        color: '#ffffff',
                        padding: '1px 5px',
                        borderRadius: '3px',
                      }}
                    >
                      Cap. {item.chapterNumber}
                    </span>
                    <span
                      style={{
                        fontSize: '10px',
                        color: '#a1a1aa',
                      }}
                    >
                      Pág. {item.pageNumber}
                    </span>
                  </div>

                  <span
                    style={{
                      fontSize: '9px',
                      textTransform: 'uppercase',
                      color: '#71717a',
                      backgroundColor: '#1f1f23',
                      padding: '1px 4px',
                      borderRadius: '3px',
                    }}
                  >
                    {item.bubbleType}
                  </span>
                </div>

                <div
                  style={{
                    fontSize: '12px',
                    lineHeight: '18px',
                    color: '#e4e4e7',
                  }}
                  dangerouslySetInnerHTML={{ __html: item.snippet || item.text }}
                />
              </div>
            );
          })}
        </div>

        {/* Footer shortcuts info */}
        <div
          style={{
            padding: '6px 16px',
            backgroundColor: '#121215',
            borderTop: '1px solid #27272a',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '10px',
            color: '#71717a',
          }}
        >
          <span>↑↓ Navegar • ↵ Saltar a página • ESC Cerrar</span>
          <span style={{ color: '#00e5ff' }}>KuraScroll Trigram OCR Engine</span>
        </div>
      </div>
    </div>
  );
};
