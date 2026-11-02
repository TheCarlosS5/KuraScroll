/**
 * Sprint 57 - Progressive Stream Indicator & Zero-CLS Skeleton
 *
 * Designed under strict Intel GMA 4500MHD constraints:
 * - Pure CSS translate3d linear shimmer (ZERO CSS blur, ZERO backdrop-filter)
 * - Exact aspect-ratio box reservation ensuring Cumulative Layout Shift = 0
 */

import React from 'react';

export interface ProgressiveStreamIndicatorProps {
  pageNumber: number;
  aspectRatio?: number; // e.g. 0.707 for standard B5/tankobon manga page
  isStreaming?: boolean;
}

export const ProgressiveStreamIndicator: React.FC<ProgressiveStreamIndicatorProps> = ({
  pageNumber,
  aspectRatio = 0.707,
  isStreaming = true,
}) => {
  return (
    <div
      role="status"
      aria-label={`Loading page ${pageNumber} from storage`}
      style={{
        position: 'relative',
        width: '100%',
        maxWidth: '800px',
        margin: '0 auto',
        aspectRatio: `${aspectRatio}`,
        backgroundColor: '#18181b', // Zero blur, pure opaque surface
        borderRadius: '6px',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        border: '1px solid #27272a',
        contain: 'layout paint size',
      }}
    >
      {/* Hardware Shimmer Bar */}
      <div
        className="stream-skeleton-shimmer"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.04) 50%, transparent 100%)',
          animation: 'shimmer-slide 1.5s infinite linear',
          pointerEvents: 'none',
        }}
      />

      {/* Central Badge */}
      <div
        style={{
          zIndex: 2,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '8px',
          color: '#a1a1aa',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            backgroundColor: '#27272a',
            padding: '4px 10px',
            borderRadius: '4px',
            fontSize: '12px',
            fontWeight: 600,
            border: '1px solid #3f3f46',
            color: '#f4f4f5',
          }}
        >
          <span style={{ color: '#00e5ff' }}>⚡</span>
          <span>Página {pageNumber}</span>
        </div>

        {isStreaming && (
          <div
            style={{
              fontSize: '11px',
              color: '#71717a',
              letterSpacing: '0.02em',
            }}
          >
            Streaming directo desde HDD 4TB (Zero-Seek)...
          </div>
        )}
      </div>
    </div>
  );
};
