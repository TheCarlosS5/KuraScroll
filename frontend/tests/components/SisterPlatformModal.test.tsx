import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import React from 'react';
import { SisterPlatformModal } from '../../src/components/common/SisterPlatformModal';

describe('SisterPlatformModal Component', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve(new Response(null, { status: 200 }))));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not render anything when isOpen is false', () => {
    const { container } = render(
      <SisterPlatformModal isOpen={false} onClose={() => {}} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders modal dialog when isOpen is true', async () => {
    await act(async () => {
      render(<SisterPlatformModal isOpen={true} onClose={() => {}} />);
    });

    expect(screen.getByRole('dialog')).toBeDefined();
    expect(screen.getByText('Ecosistema Hermano KS')).toBeDefined();
    expect(screen.getByText('KuraScroll')).toBeDefined();
    expect(screen.getByText('KuraStream')).toBeDefined();
    expect(screen.getByText('KS')).toBeDefined();
    expect(screen.getByText('Abrir KuraStream')).toBeDefined();
  });

  it('calls onClose when close icon button is clicked', async () => {
    const onClose = vi.fn();
    await act(async () => {
      render(<SisterPlatformModal isOpen={true} onClose={onClose} />);
    });

    const closeBtn = screen.getByLabelText('Cerrar modal');
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when Entendido button is clicked', async () => {
    const onClose = vi.fn();
    await act(async () => {
      render(<SisterPlatformModal isOpen={true} onClose={onClose} />);
    });

    const entendidoBtn = screen.getByText('Entendido');
    fireEvent.click(entendidoBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when clicking outside on the backdrop', async () => {
    const onClose = vi.fn();
    let containerElement: HTMLElement;
    await act(async () => {
      const { container } = render(<SisterPlatformModal isOpen={true} onClose={onClose} />);
      containerElement = container;
    });

    const backdrop = containerElement!.firstChild as HTMLElement;
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('persists custom companion url into localStorage on input change', async () => {
    await act(async () => {
      render(<SisterPlatformModal isOpen={true} onClose={() => {}} />);
    });

    const input = screen.getByPlaceholderText('http://localhost:3000') as HTMLInputElement;
    expect(input.value).toBe('http://localhost:3000');

    await act(async () => {
      fireEvent.change(input, { target: { value: 'http://192.168.1.100:8080' } });
    });
    expect(input.value).toBe('http://192.168.1.100:8080');
    expect(localStorage.getItem('kurastream_companion_url')).toBe('http://192.168.1.100:8080');
  });

  it('loads previously stored companion url from localStorage', async () => {
    localStorage.setItem('kurastream_companion_url', 'http://127.0.0.1:4000');
    await act(async () => {
      render(<SisterPlatformModal isOpen={true} onClose={() => {}} />);
    });

    const input = screen.getByPlaceholderText('http://localhost:3000') as HTMLInputElement;
    expect(input.value).toBe('http://127.0.0.1:4000');
  });

  it('attempts healthcheck on KuraStream URL and reflects status', async () => {
    await act(async () => {
      render(<SisterPlatformModal isOpen={true} onClose={() => {}} />);
    });

    await waitFor(() => {
      expect(screen.getByText('En línea')).toBeDefined();
    });
  });
});
