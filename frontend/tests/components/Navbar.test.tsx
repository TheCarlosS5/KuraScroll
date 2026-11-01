import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
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
});
