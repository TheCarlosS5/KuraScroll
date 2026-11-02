import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Navbar } from '../../src/components/common/Navbar';
import React from 'react';

describe('Navbar Component', () => {
  it('renders KuraScroll branding with KS badge', () => {
    render(<Navbar onNavigate={() => {}} currentView="catalog" />);
    expect(screen.getByText('KuraScroll')).toBeDefined();
    expect(screen.getByText('KS')).toBeDefined();
  });

  it('renders navigation category links', () => {
    render(<Navbar onNavigate={() => {}} currentView="catalog" />);
    expect(screen.getByText('Manga')).toBeDefined();
    expect(screen.getByText('Manhwa')).toBeDefined();
    expect(screen.getByText('Manhua')).toBeDefined();
  });

  it('renders Historial navigation button and responds to click', () => {
    const handleNavigate = vi.fn();
    render(<Navbar onNavigate={handleNavigate} currentView="catalog" />);

    const historyBtn = screen.getByTestId('nav-history-btn');
    expect(historyBtn).toBeDefined();
    expect(screen.getByText('Historial')).toBeDefined();

    historyBtn.click();
    expect(handleNavigate).toHaveBeenCalledWith('history');
  });

  it('renders KuraStream sister button and triggers callback', () => {
    const handleSisterModal = vi.fn();
    render(<Navbar onNavigate={() => {}} onOpenSisterModal={handleSisterModal} currentView="catalog" />);

    const sisterBtn = screen.getByTestId('nav-sister-btn');
    expect(sisterBtn).toBeDefined();
    expect(screen.getByText('KuraStream')).toBeDefined();

    sisterBtn.click();
    expect(handleSisterModal).toHaveBeenCalledTimes(1);
  });

  it('renders 4TB Local Host button and triggers telemetry callback on click', () => {
    const handleTelemetry = vi.fn();
    render(<Navbar onNavigate={() => {}} onOpenStorageTelemetry={handleTelemetry} currentView="catalog" />);

    const telemetryBtn = screen.getByTestId('nav-storage-telemetry-btn');
    expect(telemetryBtn).toBeDefined();
    expect(screen.getByText('4TB Local Host')).toBeDefined();

    telemetryBtn.click();
    expect(handleTelemetry).toHaveBeenCalledTimes(1);
  });

  it('renders daily goal ring in navbar and opens goal modal on click', () => {
    render(<Navbar onNavigate={() => {}} currentView="catalog" />);
    const ring = screen.getByTestId('nav-daily-goal-ring');
    expect(ring).toBeDefined();

    const progressBar = screen.getByRole('progressbar');
    expect(progressBar).toBeDefined();

    // Click ring to open modal
    fireEvent.click(progressBar);
    expect(screen.getByRole('dialog')).toBeDefined();
    expect(screen.getByText('Meta Diaria de Lectura')).toBeDefined();
  });
});
