import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { CatalogFilters } from '../../src/components/catalog/CatalogFilters';

describe('CatalogFilters Component', () => {
  const defaultProps = {
    selectedType: 'all',
    onSelectType: vi.fn(),
    selectedStatus: 'all',
    onSelectStatus: vi.fn(),
    selectedGenre: 'all',
    onSelectGenre: vi.fn(),
    filteredCount: 12,
    totalCount: 45,
    onResetFilters: vi.fn(),
  };

  it('renders all filter groups and pill options', () => {
    render(<CatalogFilters {...defaultProps} />);

    // Check main container
    expect(screen.getByTestId('catalog-filters')).toBeDefined();

    // Check Type options
    expect(screen.getByTestId('filter-type-all')).toBeDefined();
    expect(screen.getByTestId('filter-type-manga')).toBeDefined();
    expect(screen.getByTestId('filter-type-manhwa')).toBeDefined();
    expect(screen.getByTestId('filter-type-manhua')).toBeDefined();

    // Check Status options
    expect(screen.getByTestId('filter-status-all')).toBeDefined();
    expect(screen.getByTestId('filter-status-ongoing')).toBeDefined();
    expect(screen.getByTestId('filter-status-completed')).toBeDefined();

    // Check Popular Genre options
    expect(screen.getByTestId('filter-genre-all')).toBeDefined();
    expect(screen.getByTestId('filter-genre-acción')).toBeDefined();
    expect(screen.getByTestId('filter-genre-fantasía')).toBeDefined();
    expect(screen.getByTestId('filter-genre-romance')).toBeDefined();
    expect(screen.getByTestId('filter-genre-isekai')).toBeDefined();
    expect(screen.getByTestId('filter-genre-shonen')).toBeDefined();
    expect(screen.getByTestId('filter-genre-slice-of-life')).toBeDefined();
  });

  it('displays the filtered results counter accurately', () => {
    render(<CatalogFilters {...defaultProps} filteredCount={12} totalCount={45} />);

    const counter = screen.getByTestId('filter-results-counter');
    expect(counter.textContent).toContain('12');
    expect(counter.textContent).toContain('45');
    expect(counter.textContent).toContain('Mostrando');
    expect(counter.textContent).toContain('series');
  });

  it('visually highlights active pills with crimson accent (#dc2626)', () => {
    render(
      <CatalogFilters
        {...defaultProps}
        selectedType="manhwa"
        selectedStatus="ongoing"
        selectedGenre="Isekai"
      />
    );

    const activeType = screen.getByTestId('filter-type-manhwa');
    const inactiveType = screen.getByTestId('filter-type-manga');

    expect(activeType.getAttribute('aria-pressed')).toBe('true');
    expect(inactiveType.getAttribute('aria-pressed')).toBe('false');

    // Verify crimson border class
    expect(activeType.className).toContain('border-[#dc2626]');
    expect(activeType.className).toContain('bg-[#dc2626]/20');

    const activeStatus = screen.getByTestId('filter-status-ongoing');
    expect(activeStatus.className).toContain('border-[#dc2626]');

    const activeGenre = screen.getByTestId('filter-genre-isekai');
    expect(activeGenre.className).toContain('border-[#dc2626]');
  });

  it('calls onSelectType, onSelectStatus, and onSelectGenre when pills are clicked', () => {
    const handleSelectType = vi.fn();
    const handleSelectStatus = vi.fn();
    const handleSelectGenre = vi.fn();

    render(
      <CatalogFilters
        {...defaultProps}
        onSelectType={handleSelectType}
        onSelectStatus={handleSelectStatus}
        onSelectGenre={handleSelectGenre}
      />
    );

    fireEvent.click(screen.getByTestId('filter-type-manga'));
    expect(handleSelectType).toHaveBeenCalledWith('manga');

    fireEvent.click(screen.getByTestId('filter-status-completed'));
    expect(handleSelectStatus).toHaveBeenCalledWith('completed');

    fireEvent.click(screen.getByTestId('filter-genre-fantasía'));
    expect(handleSelectGenre).toHaveBeenCalledWith('Fantasía');
  });

  it('shows reset button when filters are active and calls onResetFilters', () => {
    const handleReset = vi.fn();

    const { rerender } = render(
      <CatalogFilters
        {...defaultProps}
        selectedType="all"
        selectedStatus="all"
        selectedGenre="all"
        onResetFilters={handleReset}
      />
    );

    // No reset button when all filters are default
    expect(screen.queryByTestId('reset-filters-btn')).toBeNull();

    // Rerender with active filter
    rerender(
      <CatalogFilters
        {...defaultProps}
        selectedType="manhwa"
        onResetFilters={handleReset}
      />
    );

    const resetBtn = screen.getByTestId('reset-filters-btn');
    expect(resetBtn).toBeDefined();

    fireEvent.click(resetBtn);
    expect(handleReset).toHaveBeenCalledTimes(1);
  });
});
