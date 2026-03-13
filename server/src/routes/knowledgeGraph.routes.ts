/**
 * Knowledge Graph Routes
 * API endpoints for knowledge graph operations
 */

import express from 'express';
import { knowledgeGraphService } from '../services/knowledgeGraph.service.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

/**
 * Initialize knowledge graph service
 * POST /api/knowledge-graph/initialize
 */
router.post('/initialize', async (req, res, _next) => {
  try {
    await knowledgeGraphService.initialize();
    res.json({
      success: true,
      message: 'Knowledge Graph service initialized',
    });
  } catch (error: unknown) {
    logger.error('Knowledge Graph initialization failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to initialize Knowledge Graph service',
      error: error.message,
    });
  }
});

/**
 * Add entity
 * POST /api/knowledge-graph/entities
 */
router.post('/entities', async (req, res, _next) => {
  try {
    const { id, name, type, properties, embedding } = req.body;

    if (!id || !name || !type) {
      res.status(400).json({
        success: false,
        message: 'id, name, and type are required',
      });
      return;
    }

    await knowledgeGraphService.addEntity({
      id,
      name,
      type,
      properties,
      embedding,
    });

    res.json({
      success: true,
      message: 'Entity added',
    });
  } catch (error: unknown) {
    logger.error('Failed to add entity:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add entity',
      error: error.message,
    });
  }
});

/**
 * Add relationship
 * POST /api/knowledge-graph/relationships
 */
router.post('/relationships', async (req, res, _next) => {
  try {
    const { id, sourceId, targetId, type, properties, strength } = req.body;

    if (!sourceId || !targetId || !type) {
      res.status(400).json({
        success: false,
        message: 'sourceId, targetId, and type are required',
      });
      return;
    }

    await knowledgeGraphService.addRelationship({
      id,
      sourceId,
      targetId,
      type,
      properties,
      strength,
    });

    res.json({
      success: true,
      message: 'Relationship added',
    });
  } catch (error: unknown) {
    logger.error('Failed to add relationship:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add relationship',
      error: error.message,
    });
  }
});

/**
 * Find entities
 * POST /api/knowledge-graph/entities/search
 */
router.post('/entities/search', async (req, res, _next) => {
  try {
    const { query, limit } = req.body;

    if (!query) {
      res.status(400).json({
        success: false,
        message: 'query is required',
      });
      return;
    }

    const entities = await knowledgeGraphService.findEntities(query, limit || 10);
    res.json({
      success: true,
      data: entities,
    });
  } catch (error: unknown) {
    logger.error('Entity search failed:', error);
    res.status(500).json({
      success: false,
      message: 'Entity search failed',
      error: error.message,
    });
  }
});

/**
 * Get entity by ID
 * GET /api/knowledge-graph/entities/:id
 */
router.get('/entities/:id', async (req, res, _next) => {
  try {
    const { id } = req.params;
    const entity = await knowledgeGraphService.getEntity(id);

    if (!entity) {
      res.status(404).json({
        success: false,
        message: 'Entity not found',
      });
      return;
    }

    res.json({
      success: true,
      data: entity,
    });
  } catch (error: unknown) {
    logger.error('Failed to get entity:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get entity',
      error: error.message,
    });
  }
});

/**
 * Get entity relationships
 * GET /api/knowledge-graph/entities/:id/relationships
 */
router.get('/entities/:id/relationships', async (req, res, _next) => {
  try {
    const { id } = req.params;
    const { type } = req.query;

    const relationships = await knowledgeGraphService.getEntityRelationships(
      id,
      type as string | undefined
    );

    res.json({
      success: true,
      data: relationships,
    });
  } catch (error: unknown) {
    logger.error('Failed to get relationships:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get relationships',
      error: error.message,
    });
  }
});

/**
 * Find path between entities
 * GET /api/knowledge-graph/path
 */
router.get('/path', async (req, res, _next) => {
  try {
    const { sourceId, targetId, maxDepth } = req.query;

    if (!sourceId || !targetId) {
      res.status(400).json({
        success: false,
        message: 'sourceId and targetId are required',
      });
      return;
    }

    const path = await knowledgeGraphService.findPath(
      sourceId as string,
      targetId as string,
      maxDepth ? parseInt(maxDepth as string) : 3
    );

    if (!path) {
      res.status(404).json({
        success: false,
        message: 'No path found',
      });
      return;
    }

    res.json({
      success: true,
      data: path,
    });
  } catch (error: unknown) {
    logger.error('Path finding failed:', error);
    res.status(500).json({
      success: false,
      message: 'Path finding failed',
      error: error.message,
    });
  }
});

/**
 * Extract entities and relationships from text
 * POST /api/knowledge-graph/extract
 */
router.post('/extract', async (req, res, _next) => {
  try {
    const { text } = req.body;

    if (!text) {
      res.status(400).json({
        success: false,
        message: 'text is required',
      });
      return;
    }

    const result = await knowledgeGraphService.extractFromText(text);
    res.json({
      success: true,
      data: result,
    });
  } catch (error: unknown) {
    logger.error('Extraction failed:', error);
    res.status(500).json({
      success: false,
      message: 'Extraction failed',
      error: error.message,
    });
  }
});

/**
 * Get graph statistics
 * GET /api/knowledge-graph/stats
 */
router.get('/stats', async (req, res, _next) => {
  try {
    const stats = await knowledgeGraphService.getGraphStats();
    res.json({
      success: true,
      data: stats,
    });
  } catch (error: unknown) {
    logger.error('Failed to get graph stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get graph statistics',
      error: error.message,
    });
  }
});

export default router;
















