import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { ReadingVelocityBadge } from '../../src/components/recommendations/ReadingVelocityBadge';

describe('ReadingVelocityBadge Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders reading velocity badge with fetched stats', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        userId: 'local_user',
        pagesPerMinute: 2.8,
        secondsPerPage: 21.4,
        confidence: 'stable',
      }),
    } as any);

    render(<ReadingVelocityBadge userId="local_user" defaultPages={20} />);

    await waitFor(() => {
      expect(screen.getByTestId('reading-velocity-badge')).toBeDefined();
      expect(screen.getByText('2.8 ppm')).toBeDefined();
      expect(screen.getByText('~7 min / cap')).toBeDefined();
    });
  });

  it('falls back gracefully on network error', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));
    render(<ReadingVelocityBadge userId="local_user" />);

    expect(screen.getByTestId('reading-velocity-badge')).toBeDefined();
    expect(screen.getByText('1.7 ppm')).toBeDefined();
  });
});
