/**
 * Neo4j Knowledge Graph Routes
 * API endpoints for enhanced knowledge graph operations
 */

import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { requireAdmin, AdminRequest } from '../middleware/adminAuth.js';
import { neo4jService } from '../services/neo4j.service.js';
import { logger } from '../utils/logger.js';
import { AppError } from '../middleware/errorHandler.js';

const router = express.Router();

// All routes require authentication + admin role
router.use(authenticateToken);
router.use(requireAdmin);

/**
 * GET /api/admin/neo4j/stats
 * Get graph statistics
 */
router.get('/stats', async (_req: AdminRequest, res, next) => {
  try {
    if (!neo4jService.isAvailable()) {
      throw new AppError('Neo4j service not available', 503);
    }

    const stats = await neo4jService.getGraphStats();
    res.json({
      success: true,
      data: stats
    });
  } catch (error: unknown) {
    next(error);
  }
});

/**
 * POST /api/admin/neo4j/node
 * Create or update a node
 */
router.post('/node', async (req: AdminRequest, res, next) => {
  try {
    if (!neo4jService.isAvailable()) {
      throw new AppError('Neo4j service not available', 503);
    }

    const { labels, properties } = req.body;
    
    if (!labels || !Array.isArray(labels) || labels.length === 0) {
      throw new AppError('Labels array is required', 400);
    }
    if (!properties || !properties.id) {
      throw new AppError('Properties with id is required', 400);
    }

    const node = await neo4jService.createNode(labels, properties);
    
    res.json({
      success: true,
      data: node
    });
  } catch (error: unknown) {
    next(error);
  }
});

/**
 * POST /api/admin/neo4j/relationship
 * Create a relationship
 */
router.post('/relationship', async (req: AdminRequest, res, next) => {
  try {
    if (!neo4jService.isAvailable()) {
      throw new AppError('Neo4j service not available', 503);
    }

    const {
      startNodeId,
      startNodeLabel,
      endNodeId,
      endNodeLabel,
      relationshipType,
      properties
    } = req.body;

    if (!startNodeId || !startNodeLabel || !endNodeId || !endNodeLabel || !relationshipType) {
      throw new AppError('All relationship parameters are required', 400);
    }

    const relationship = await neo4jService.createRelationship(
      startNodeId,
      startNodeLabel,
      endNodeId,
      endNodeLabel,
      relationshipType,
      properties || {}
    );

    res.json({
      success: true,
      data: relationship
    });
  } catch (error: unknown) {
    next(error);
  }
});

/**
 * GET /api/admin/neo4j/nodes
 * Find nodes
 */
router.get('/nodes', async (req: AdminRequest, res, next) => {
  try {
    if (!neo4jService.isAvailable()) {
      throw new AppError('Neo4j service not available', 503);
    }

    const { label, properties, limit } = req.query;

    if (!label) {
      throw new AppError('Label is required', 400);
    }

    const nodes = await neo4jService.findNodes(
      label as string,
      properties ? JSON.parse(properties as string) : {},
      limit ? parseInt(limit as string) : 100
    );

    res.json({
      success: true,
      data: nodes
    });
  } catch (error: unknown) {
    next(error);
  }
});

/**
 * POST /api/admin/neo4j/traverse
 * Traverse graph from a node
 */
router.post('/traverse', async (req: AdminRequest, res, next) => {
  try {
    if (!neo4jService.isAvailable()) {
      throw new AppError('Neo4j service not available', 503);
    }

    const {
      startNodeId,
      startNodeLabel,
      relationshipTypes,
      depth,
      direction
    } = req.body;

    if (!startNodeId || !startNodeLabel) {
      throw new AppError('Start node ID and label are required', 400);
    }

    const paths = await neo4jService.traverseGraph(
      startNodeId,
      startNodeLabel,
      relationshipTypes || [],
      depth || 2,
      direction || 'both'
    );

    res.json({
      success: true,
      data: paths
    });
  } catch (error: unknown) {
    next(error);
  }
});

/**
 * POST /api/admin/neo4j/shortest-path
 * Find shortest path between nodes
 */
router.post('/shortest-path', async (req: AdminRequest, res, next) => {
  try {
    if (!neo4jService.isAvailable()) {
      throw new AppError('Neo4j service not available', 503);
    }

    const {
      startNodeId,
      startNodeLabel,
      endNodeId,
      endNodeLabel,
      relationshipTypes
    } = req.body;

    if (!startNodeId || !startNodeLabel || !endNodeId || !endNodeLabel) {
      throw new AppError('All node parameters are required', 400);
    }

    const path = await neo4jService.findShortestPath(
      startNodeId,
      startNodeLabel,
      endNodeId,
      endNodeLabel,
      relationshipTypes || []
    );

    res.json({
      success: true,
      data: path
    });
  } catch (error: unknown) {
    next(error);
  }
});

/**
 * POST /api/admin/neo4j/query
 * Execute custom Cypher query
 */
router.post('/query', async (req: AdminRequest, res, next) => {
  try {
    if (!neo4jService.isAvailable()) {
      throw new AppError('Neo4j service not available', 503);
    }

    const { cypher, parameters } = req.body;

    if (!cypher) {
      throw new AppError('Cypher query is required', 400);
    }

    const result = await neo4jService.executeQuery(cypher, parameters || {});

    res.json({
      success: true,
      data: result
    });
  } catch (error: unknown) {
    next(error);
  }
});

export default router;
















