import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { SearchBar } from '../../src/components/catalog/SearchBar';
import React from 'react';

describe('SearchBar Component', () => {
  it('calls onSearch callback after debounce delay', async () => {
    vi.useFakeTimers();
    const handleSearch = vi.fn();
    render(<SearchBar onSearch={handleSearch} debounceMs={300} />);

    const input = screen.getByPlaceholderText(/buscar por título/i);
    fireEvent.change(input, { target: { value: 'Demon Slayer' } });

    expect(handleSearch).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(350);
    });

    expect(handleSearch).toHaveBeenCalledWith('Demon Slayer');
    vi.useRealTimers();
  });

  it('renders quick language pills indicating multilingual support', () => {
    render(<SearchBar onSearch={() => {}} />);
    expect(screen.getByText(/Romaji/i)).toBeDefined();
    expect(screen.getByText(/Kanji/i)).toBeDefined();
    expect(screen.getByText(/Español/i)).toBeDefined();
  });
});
