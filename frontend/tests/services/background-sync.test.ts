import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BackgroundSyncManager } from '../../src/services/background-sync';

describe('BackgroundSyncManager Suite', () => {
  let manager: BackgroundSyncManager;

  beforeEach(() => {
    localStorage.clear();
    manager = new BackgroundSyncManager();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('enqueues mutations into localStorage outbox store', () => {
    const mutation = manager.enqueue('PROGRESS', '/api/v1/progress', {
      seriesId: 's-1',
      chapterId: 'ch-1',
      page: 15,
    });

    expect(mutation.id).toBeDefined();
    expect(mutation.type).toBe('PROGRESS');
    expect(manager.getQueue().length).toBe(1);
    expect(manager.getQueue()[0].url).toBe('/api/v1/progress');
  });

  it('flushes pending mutations on successful API response and clears queue', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true }), { status: 200 }))
    );

    manager.enqueue('PROGRESS', '/api/v1/progress', { chapterId: 'ch-1', page: 20 });
    manager.enqueue('BOOKMARK', '/api/v1/bookmarks', { seriesId: 's-1' });

    expect(manager.getQueue().length).toBe(2);

    const result = await manager.flush();
    expect(result.flushedCount).toBe(2);
    expect(result.remainingCount).toBe(0);
    expect(manager.getQueue().length).toBe(0);
  });

  it('retains mutations in outbox when fetch encounters network error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Failed to fetch (offline)')));

    manager.enqueue('PROGRESS', '/api/v1/progress', { chapterId: 'ch-2', page: 5 });

    const result = await manager.flush();
    expect(result.flushedCount).toBe(0);
    expect(result.remainingCount).toBe(1);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(manager.getQueue().length).toBe(1);
    expect(manager.getQueue()[0].retryCount).toBe(1);
  });

  it('drops client 4xx errors to avoid infinite bad request loops', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('Bad Request', { status: 400 })));

    manager.enqueue('SETTINGS', '/api/v1/invalid', { bad: true });

    const result = await manager.flush();
    expect(result.flushedCount).toBe(0);
    expect(result.remainingCount).toBe(0);
    expect(manager.getQueue().length).toBe(0);
  });
});
