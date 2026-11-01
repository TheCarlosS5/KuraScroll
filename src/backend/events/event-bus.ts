import { EventEmitter } from 'node:events';
import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

export interface KuraEvent<T = any> {
  type: string;
  timestamp: string;
  data: T;
}

export type EventListener = (event: KuraEvent) => void;

/**
 * High-performance In-Memory Event Bus for real-time KuraScroll & KuraStream companion updates.
 */
export class EventBus {
  private emitter: EventEmitter;
  private maxHistory: number;
  private history: KuraEvent[] = [];

  constructor(maxHistory = 50) {
    this.emitter = new EventEmitter();
    this.emitter.setMaxListeners(100);
    this.maxHistory = maxHistory;
  }

  /**
   * Broadcast an event across all connected listeners and SSE clients.
   */
  public emit<T = any>(type: string, data: T): KuraEvent<T> {
    const event: KuraEvent<T> = {
      type,
      timestamp: new Date().toISOString(),
      data,
    };

    this.history.unshift(event);
    if (this.history.length > this.maxHistory) {
      this.history.pop();
    }

    this.emitter.emit('event', event);
    this.emitter.emit(type, event);
    return event;
  }

  /**
   * Subscribe to all events or a specific event type. Returns unsubscribe function.
   */
  public subscribe(listener: EventListener, eventType?: string): () => void {
    const channel = eventType || 'event';
    this.emitter.on(channel, listener);
    return () => {
      this.emitter.off(channel, listener);
    };
  }

  /**
   * Retrieve recent event history for newly connected clients.
   */
  public getHistory(limit = 20): KuraEvent[] {
    return this.history.slice(0, limit);
  }

  /**
   * Clear event history.
   */
  public clear(): void {
    this.history = [];
    this.emitter.removeAllListeners();
  }
}

// Global Singleton for easy cross-module dispatching
export const globalEventBus = new EventBus();

/**
 * Registers Server-Sent Events (SSE) routes on Fastify.
 */
export function registerEventRoutes(app: FastifyInstance, bus: EventBus = globalEventBus): void {
  // GET /api/v1/events - Server-Sent Events (SSE) Stream
  app.get('/api/v1/events', (req: FastifyRequest, reply: FastifyReply) => {
    reply.raw.setHeader('Content-Type', 'text/event-stream');
    reply.raw.setHeader('Cache-Control', 'no-cache, no-transform');
    reply.raw.setHeader('Connection', 'keep-alive');
    reply.raw.setHeader('Access-Control-Allow-Origin', '*');
    reply.raw.flushHeaders?.();

    // Send initial handshake
    reply.raw.write(`event: connected\ndata: ${JSON.stringify({ status: 'connected', time: new Date().toISOString() })}\n\n`);

    // Stream recent events
    const recent = bus.getHistory(5);
    for (const evt of recent.reverse()) {
      reply.raw.write(`event: ${evt.type}\ndata: ${JSON.stringify(evt)}\n\n`);
    }

    // Subscribe to new events
    const unsubscribe = bus.subscribe((evt) => {
      if (!reply.raw.writableEnded) {
        reply.raw.write(`event: ${evt.type}\ndata: ${JSON.stringify(evt)}\n\n`);
      }
    });

    // Send periodic ping comment to prevent socket timeout
    const pingInterval = setInterval(() => {
      if (!reply.raw.writableEnded) {
        reply.raw.write(':ping\n\n');
      }
    }, 15000);

    req.raw.on('close', () => {
      clearInterval(pingInterval);
      unsubscribe();
    });

    // In unit test / mock injection mode (e.g. lightMyRequest), flush initial state and close
    if (req.headers['user-agent'] === 'lightMyRequest' || (req.query as any)?.stream === 'false') {
      clearInterval(pingInterval);
      unsubscribe();
      reply.raw.end();
    }
  });

  // GET /api/v1/events/history - Recent event logs
  app.get('/api/v1/events/history', async (req) => {
    const query = req.query as { limit?: string };
    const limit = query?.limit ? Number.parseInt(query.limit, 10) : 20;
    return {
      success: true,
      events: bus.getHistory(limit),
    };
  });
}
