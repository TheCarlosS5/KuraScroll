/**
 * KuraScroll Reader Page Annotation Routes
 * Sprint 52 - Fastify Endpoints for Interactive Sticky Notes & Annotations
 */

import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { DatabaseInstance } from '../db/database.js';
import {
  AnnotationColor,
  AnnotationType,
  PageAnnotationService,
} from '../services/page-annotation-service.js';

export interface AnnotationRoutesOptions {
  db: DatabaseInstance;
  annotationService?: PageAnnotationService;
}

export const annotationRoutes: FastifyPluginAsync<AnnotationRoutesOptions> = async (
  fastify: FastifyInstance,
  opts: AnnotationRoutesOptions
) => {
  const service = opts.annotationService ?? new PageAnnotationService(opts.db);

  /**
   * GET /api/v1/chapters/:chapterId/pages/:pageNumber/annotations
   * Fetches all annotations for a specific page.
   */
  fastify.get<{
    Params: { chapterId: string; pageNumber: string };
  }>('/api/v1/chapters/:chapterId/pages/:pageNumber/annotations', async (request, reply) => {
    const { chapterId, pageNumber } = request.params;
    const pageNum = parseInt(pageNumber, 10);

    if (!chapterId || isNaN(pageNum) || pageNum < 1) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Valid chapterId and pageNumber (>= 1) are required',
      });
    }

    const annotations = service.getAnnotationsForPage(chapterId, pageNum);
    return reply.send({
      success: true,
      chapterId,
      pageNumber: pageNum,
      annotations,
      total: annotations.length,
    });
  });

  /**
   * GET /api/v1/chapters/:chapterId/annotations
   * Fetches all annotations for a full chapter (for the Annotation Deck drawer).
   */
  fastify.get<{
    Params: { chapterId: string };
  }>('/api/v1/chapters/:chapterId/annotations', async (request, reply) => {
    const { chapterId } = request.params;

    if (!chapterId) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'chapterId is required',
      });
    }

    const annotations = service.getAnnotationsForChapter(chapterId);
    return reply.send({
      success: true,
      chapterId,
      annotations,
      total: annotations.length,
    });
  });

  /**
   * POST /api/v1/annotations
   * Creates a new page annotation or sticky note.
   */
  fastify.post<{
    Body: {
      chapterId: string;
      pageNumber: number;
      userId: string;
      anchorX: number;
      anchorY: number;
      annotationType?: AnnotationType;
      contentText: string;
      colorPreset?: AnnotationColor;
      isSpoiler?: boolean;
    };
  }>('/api/v1/annotations', async (request, reply) => {
    const body = request.body;

    if (!body || !body.chapterId || !body.pageNumber || !body.userId || !body.contentText) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'chapterId, pageNumber, userId, and contentText are required',
      });
    }

    if (body.anchorX === undefined || body.anchorY === undefined) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'anchorX and anchorY coordinates are required',
      });
    }

    try {
      const created = service.createAnnotation({
        chapterId: body.chapterId,
        pageNumber: Number(body.pageNumber),
        userId: body.userId,
        anchorX: Number(body.anchorX),
        anchorY: Number(body.anchorY),
        annotationType: body.annotationType,
        contentText: body.contentText,
        colorPreset: body.colorPreset,
        isSpoiler: body.isSpoiler,
      });

      return reply.status(201).send({
        success: true,
        annotation: created,
      });
    } catch (err: any) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: err.message || 'Failed to create annotation',
      });
    }
  });

  /**
   * PATCH /api/v1/annotations/:id/spoiler
   * Toggles the spoiler status of an annotation.
   */
  fastify.patch<{
    Params: { id: string };
    Body: { isSpoiler: boolean };
  }>('/api/v1/annotations/:id/spoiler', async (request, reply) => {
    const id = parseInt(request.params.id, 10);
    const { isSpoiler } = request.body || {};

    if (isNaN(id) || isSpoiler === undefined) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Valid annotation id and boolean isSpoiler are required',
      });
    }

    const updated = service.toggleSpoiler(id, Boolean(isSpoiler));
    if (!updated) {
      return reply.status(404).send({
        statusCode: 404,
        error: 'Not Found',
        message: `Annotation with id ${id} not found`,
      });
    }

    return reply.send({
      success: true,
      annotation: updated,
    });
  });

  /**
   * DELETE /api/v1/annotations/:id
   * Deletes an annotation by ID.
   */
  fastify.delete<{
    Params: { id: string };
    Querystring: { userId?: string };
  }>('/api/v1/annotations/:id', async (request, reply) => {
    const id = parseInt(request.params.id, 10);
    const userId = request.query?.userId;

    if (isNaN(id)) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Valid annotation id is required',
      });
    }

    try {
      const deleted = service.deleteAnnotation(id, userId);
      if (!deleted) {
        return reply.status(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: `Annotation with id ${id} not found`,
        });
      }

      return reply.send({
        success: true,
        message: `Annotation ${id} deleted successfully`,
      });
    } catch (err: any) {
      return reply.status(403).send({
        statusCode: 403,
        error: 'Forbidden',
        message: err.message,
      });
    }
  });
};
