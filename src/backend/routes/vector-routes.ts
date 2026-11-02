/**
 * KuraScroll Hybrid Semantic Vector Search Routes
 * Sprint 47 - Fastify Endpoints for Hybrid Search and Vector Admin Ingestion
 */

import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { DatabaseInstance } from '../db/database.js';
import { VectorSearchService, SeriesEmbeddingInput } from '../services/vector-search-service.js';

export interface VectorRoutesOptions {
  db: DatabaseInstance;
  vectorService?: VectorSearchService;
}

export const vectorRoutes: FastifyPluginAsync<VectorRoutesOptions> = async (
  fastify: FastifyInstance,
  opts: VectorRoutesOptions
) => {
  const service = opts.vectorService ?? new VectorSearchService(opts.db);

  // Hybrid Search: Lexical (FTS5) + Semantic (Int8 Vector) via RRF
  fastify.post<{
    Body: {
      query?: string;
      vector?: number[];
      limit?: number;
      minSimilarity?: number;
      lexicalWeight?: number;
      semanticWeight?: number;
    };
  }>('/api/v1/search/hybrid', async (request, reply) => {
    const {
      query,
      vector,
      limit = 20,
      minSimilarity = 0.25,
      lexicalWeight = 1.0,
      semanticWeight = 1.0
    } = request.body || {};

    if (!query && (!vector || vector.length === 0)) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Must provide either query text or query vector'
      });
    }

    const response = service.searchHybrid({
      queryText: query,
      queryVector: vector,
      limit,
      minSimilarity,
      lexicalWeight,
      semanticWeight
    });

    return reply.send(response);
  });

  // Admin Ingestion: Bulk Upsert Embeddings
  fastify.post<{
    Body: {
      items: SeriesEmbeddingInput[];
    };
  }>('/api/v1/admin/embeddings/batch', async (request, reply) => {
    const items = request.body?.items;
    if (!Array.isArray(items) || items.length === 0) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Request body must contain an array of items'
      });
    }

    const count = service.upsertEmbeddingsBatch(items);
    return reply.send({
      success: true,
      count
    });
  });

  // Vector Index Telemetry & Stats
  fastify.get('/api/v1/admin/embeddings/stats', async (_request, reply) => {
    const count = service.getVectorCount();
    return reply.send({
      success: true,
      totalEmbeddings: count,
      dimensions: 384,
      quantization: 'int8',
      memoryFootprintBytes: count * 384
    });
  });
};
