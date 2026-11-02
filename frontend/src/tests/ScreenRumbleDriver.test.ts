import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ScreenRumbleDriver } from '../reader/ScreenRumbleDriver.js';

describe('Sprint 56 - ScreenRumbleDriver Unit Tests', () => {
  let stageElement: HTMLDivElement;
  let driver: ScreenRumbleDriver;

  beforeEach(() => {
    vi.useFakeTimers();
    stageElement = document.createElement('div');
    stageElement.className = 'reader-stage';
    document.body.appendChild(stageElement);
    driver = new ScreenRumbleDriver(stageElement);
  });

  afterEach(() => {
    driver.cancel();
    stageElement.remove();
    vi.useRealTimers();
  });

  it('adds rumble-light class and removes it after 45ms', () => {
    const ok = driver.trigger(0); // LIGERO (45ms)
    expect(ok).toBe(true);
    expect(stageElement.classList.contains('rumble-light')).toBe(true);

    vi.advanceTimersByTime(44);
    expect(stageElement.classList.contains('rumble-light')).toBe(true);

    vi.advanceTimersByTime(2);
    expect(stageElement.classList.contains('rumble-light')).toBe(false);
  });

  it('adds rumble-medium class and removes it after 60ms', () => {
    const ok = driver.trigger(1); // MEDIO (60ms)
    expect(ok).toBe(true);
    expect(stageElement.classList.contains('rumble-medium')).toBe(true);

    vi.advanceTimersByTime(60);
    expect(stageElement.classList.contains('rumble-medium')).toBe(false);
  });

  it('adds rumble-heavy class and removes it after 80ms', () => {
    const ok = driver.trigger(2); // PESADO (80ms)
    expect(ok).toBe(true);
    expect(stageElement.classList.contains('rumble-heavy')).toBe(true);

    vi.advanceTimersByTime(80);
    expect(stageElement.classList.contains('rumble-heavy')).toBe(false);
  });

  it('cancel removes all active rumble classes immediately', () => {
    driver.trigger(2);
    expect(stageElement.classList.contains('rumble-heavy')).toBe(true);

    driver.cancel();
    expect(stageElement.classList.contains('rumble-heavy')).toBe(false);
  });
});
