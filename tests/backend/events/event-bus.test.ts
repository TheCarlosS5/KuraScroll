import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventBus, registerEventRoutes } from '../../../src/backend/events/event-bus.js';
import Fastify, { FastifyInstance } from 'fastify';

describe('EventBus & Real-Time SSE Event Stream Suite', () => {
  let bus: EventBus;
  let app: FastifyInstance;

  beforeEach(async () => {
    bus = new EventBus(10);
    app = Fastify({ logger: false });
    registerEventRoutes(app, bus);
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    bus.clear();
  });

  it('1. emits events and notifies subscribers synchronously', () => {
    const received: any[] = [];
    const unsubscribe = bus.subscribe((evt) => {
      received.push(evt);
    });

    bus.emit('chapter:ingested', { seriesSlug: 'chainsaw-man', chapterNumber: 1 });
    bus.emit('progress:updated', { seriesSlug: 'chainsaw-man', pageNumber: 15 });

    expect(received.length).toBe(2);
    expect(received[0].type).toBe('chapter:ingested');
    expect(received[0].data.seriesSlug).toBe('chainsaw-man');
    expect(received[1].type).toBe('progress:updated');

    // Unsubscribe verification
    unsubscribe();
    bus.emit('chapter:ingested', { seriesSlug: 'solo-leveling' });
    expect(received.length).toBe(2);
  });

  it('2. filters subscription by specific eventType channel', () => {
    const chapterEvents: any[] = [];
    bus.subscribe((evt) => {
      chapterEvents.push(evt);
    }, 'chapter:ingested');

    bus.emit('chapter:ingested', { chapterNumber: 10 });
    bus.emit('system:backup', { status: 'ok' });
    bus.emit('chapter:ingested', { chapterNumber: 11 });

    expect(chapterEvents.length).toBe(2);
    expect(chapterEvents[0].data.chapterNumber).toBe(10);
    expect(chapterEvents[1].data.chapterNumber).toBe(11);
  });

  it('3. maintains bounded event history and truncates beyond max limit', () => {
    const boundedBus = new EventBus(3);
    boundedBus.emit('event:1', {});
    boundedBus.emit('event:2', {});
    boundedBus.emit('event:3', {});
    boundedBus.emit('event:4', {});

    const history = boundedBus.getHistory();
    expect(history.length).toBe(3);
    expect(history[0].type).toBe('event:4');
    expect(history[2].type).toBe('event:2');
  });

  it('4. GET /api/v1/events/history returns recent events over HTTP', async () => {
    bus.emit('series:created', { slug: 'one-piece' });
    bus.emit('chapter:ingested', { slug: 'one-piece', chapter: 1000 });

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/events/history?limit=5',
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.events.length).toBe(2);
    expect(body.events[0].type).toBe('chapter:ingested');
  });

  it('5. GET /api/v1/events initiates valid Server-Sent Events stream with handshake headers', async () => {
    bus.emit('seed:event', { ok: true });

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/events',
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('text/event-stream');
    expect(response.headers['cache-control']).toContain('no-cache');
    expect(response.headers['connection']).toContain('keep-alive');
    expect(response.payload).toContain('event: connected');
    expect(response.payload).toContain('event: seed:event');
  });
});
