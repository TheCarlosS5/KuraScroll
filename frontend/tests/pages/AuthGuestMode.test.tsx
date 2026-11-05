import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { LoginPage } from '../../src/pages/LoginPage.js';
import { RegisterPage } from '../../src/pages/RegisterPage.js';

describe('Auth Pages Guest Mode (Omitir)', () => {
  it('LoginPage renders prominent Omitir button and triggers onSkip callback', () => {
    const handleSkip = vi.fn();
    const handleBack = vi.fn();

    render(
      <LoginPage
        onSuccess={vi.fn()}
        onNavigateRegister={vi.fn()}
        onBack={handleBack}
        onSkip={handleSkip}
        onLogin={vi.fn()}
        onVerifyEmail={vi.fn()}
        onResendCode={vi.fn()}
      />
    );

    // Verify skip button at the top and in the footer
    const skipButtons = screen.getAllByRole('button', { name: /omitir/i });
    expect(skipButtons.length).toBeGreaterThanOrEqual(1);

    // Click the guest mode button
    fireEvent.click(skipButtons[0]);
    expect(handleSkip).toHaveBeenCalledTimes(1);

    // Verify guest mode descriptive text
    expect(screen.getByText(/continuar como invitado/i)).toBeDefined();
    expect(screen.getByText(/sin cuenta/i)).toBeDefined();
  });

  it('RegisterPage renders prominent Omitir button and triggers onSkip callback', () => {
    const handleSkip = vi.fn();
    const handleBack = vi.fn();

    render(
      <RegisterPage
        onSuccess={vi.fn()}
        onNavigateLogin={vi.fn()}
        onBack={handleBack}
        onSkip={handleSkip}
        onRegister={vi.fn()}
        onVerifyEmail={vi.fn()}
        onResendCode={vi.fn()}
      />
    );

    const skipButtons = screen.getAllByRole('button', { name: /omitir/i });
    expect(skipButtons.length).toBeGreaterThanOrEqual(1);

    fireEvent.click(skipButtons[0]);
    expect(handleSkip).toHaveBeenCalledTimes(1);

    expect(screen.getByText(/continuar como invitado/i)).toBeDefined();
    expect(screen.getByText(/sin registrarte/i)).toBeDefined();
  });
});
