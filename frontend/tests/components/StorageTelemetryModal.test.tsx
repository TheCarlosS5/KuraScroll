import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import React from 'react';
import { StorageTelemetryModal } from '../../src/components/settings/StorageTelemetryModal';

describe('StorageTelemetryModal Component (Pentium T4500 & Self-Healing)', () => {
  const mockTelemetry = {
    savingsPercentage: 85.5,
    savedBytes: 1500000000,
    projected4TBCapacityChapters: 235000,
    totalSeries: 12,
    totalChapters: 450,
    totalPages: 9000,
    hdd4TBUsedPercentage: 1.25,
    memoryCache: {
      imagesUsedBytes: 25000000,
    },
  };

  const mockAdaptive = {
    success: true,
    status: {
      state: 'RUNNING',
      isPaused: false,
      isThrottled: false,
      p95Ms: 14.5,
      rssMb: 185,
    },
  };

  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url) => {
        if (url === '/api/v1/storage/cache/flush') {
          return Promise.resolve(new Response(JSON.stringify({ success: true, freedBytes: { images: 25000000 } })));
        }
        if (url === '/api/v1/telemetry/adaptive') {
          return Promise.resolve(new Response(JSON.stringify(mockAdaptive)));
        }
        if (url === '/api/v1/admin/self-heal') {
          return Promise.resolve(new Response(JSON.stringify({ success: true, report: { integrity: { checkpointOk: true } } })));
        }
        if (url === '/api/v1/admin/maintenance/compact') {
          return Promise.resolve(new Response(JSON.stringify({ success: true, report: { orphanFilesDeleted: 3, orphanBytesReclaimed: 15360 } })));
        }
        return Promise.resolve(new Response(JSON.stringify({ success: true, telemetry: mockTelemetry })));
      })
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders nothing when isOpen is false', () => {
    const { container } = render(<StorageTelemetryModal isOpen={false} onClose={() => {}} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders telemetry modal and loads storage stats on open', async () => {
    await act(async () => {
      render(<StorageTelemetryModal isOpen={true} onClose={() => {}} />);
    });

    await waitFor(() => {
      expect(screen.getByText('Telemetría 4TB & Perfil T4500')).toBeDefined();
      expect(screen.getByText('Pentium T4500 Host')).toBeDefined();
      expect(screen.getByText('85.5%')).toBeDefined();
      expect(screen.getByText(/235[.,]000/)).toBeDefined();
      expect(screen.getByText('12')).toBeDefined();
      expect(screen.getByText('450')).toBeDefined();
      expect(screen.getByText('9000')).toBeDefined();
    });
  });

  it('displays adaptive ingestion state and metrics', async () => {
    await act(async () => {
      render(<StorageTelemetryModal isOpen={true} onClose={() => {}} />);
    });

    await waitFor(() => {
      expect(screen.getByText(/ESTADO: NORMAL/i)).toBeDefined();
      expect(screen.getByText(/15 ms/i)).toBeDefined();
      expect(screen.getByText(/185 MB/i)).toBeDefined();
    });
  });

  it('triggers self healing on button click', async () => {
    await act(async () => {
      render(<StorageTelemetryModal isOpen={true} onClose={() => {}} />);
    });

    const healBtn = await screen.findByRole('button', { name: /Autocuración/i });
    await act(async () => {
      fireEvent.click(healBtn);
    });

    await waitFor(() => {
      expect(screen.getByText('¡Sana y Lista!')).toBeDefined();
    }, { timeout: 3000 });
  });

  it('calls onClose when close icon button is clicked', async () => {
    const onClose = vi.fn();
    await act(async () => {
      render(<StorageTelemetryModal isOpen={true} onClose={onClose} />);
    });

    const closeBtn = screen.getByLabelText('Cerrar telemetría');
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('triggers cache flush on button click', async () => {
    await act(async () => {
      render(<StorageTelemetryModal isOpen={true} onClose={() => {}} />);
    });

    const flushBtn = await screen.findByRole('button', { name: /Vaciar RAM/i });
    await act(async () => {
      fireEvent.click(flushBtn);
    });

    await waitFor(() => {
      expect(screen.getByText('¡Liberada!')).toBeDefined();
    }, { timeout: 3000 });
  });

  it('triggers storage and WAL compaction on button click', async () => {
    await act(async () => {
      render(<StorageTelemetryModal isOpen={true} onClose={() => {}} />);
    });

    const compactBtn = await screen.findByTestId('compact-storage-btn');
    await act(async () => {
      fireEvent.click(compactBtn);
    });

    await waitFor(() => {
      expect(screen.getByText('¡Compactado!')).toBeDefined();
    });
  });
});
