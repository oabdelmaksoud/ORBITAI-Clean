/**
 * LlamaIndex RAG Routes
 * API endpoints for advanced RAG operations
 */

import express from 'express';
import { llamaindexService } from '../services/llamaindex.service.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

/**
 * Initialize LlamaIndex service
 * POST /api/llamaindex/initialize
 */
router.post('/initialize', async (req, res, _next) => {
  try {
    await llamaindexService.initialize();
    res.json({
      success: true,
      message: 'LlamaIndex service initialized',
    });
  } catch (error: any) {
    logger.error('LlamaIndex initialization failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to initialize LlamaIndex service',
      error: error.message,
    });
  }
});

/**
 * Index documents
 * POST /api/llamaindex/index
 */
router.post('/index', async (req, res, _next) => {
  try {
    const { documents, config } = req.body;

    if (!documents || !Array.isArray(documents)) {
      res.status(400).json({
        success: false,
        message: 'documents array is required',
      });
      return;
    }

    await llamaindexService.indexDocuments(documents, config);
    res.json({
      success: true,
      message: `Indexed ${documents.length} documents`,
    });
  } catch (error: any) {
    logger.error('Document indexing failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to index documents',
      error: error.message,
    });
  }
});

/**
 * Query RAG system
 * POST /api/llamaindex/query
 */
router.post('/query', async (req, res, _next) => {
  try {
    const { query, topK, filters, useHybridSearch, rerank } = req.body;

    if (!query) {
      res.status(400).json({
        success: false,
        message: 'query is required',
      });
      return;
    }

    const result = await llamaindexService.query({
      query,
      topK,
      filters,
      useHybridSearch,
      rerank,
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    logger.error('RAG query failed:', error);
    res.status(500).json({
      success: false,
      message: 'RAG query failed',
      error: error.message,
    });
  }
});

/**
 * Stream RAG query
 * POST /api/llamaindex/query/stream
 */
router.post('/query/stream', async (req, res, _next) => {
  try {
    const { query, topK, filters, useHybridSearch } = req.body;

    if (!query) {
      res.status(400).json({
        success: false,
        message: 'query is required',
      });
      return;
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const stream = llamaindexService.queryStream({
      query,
      topK,
      filters,
      useHybridSearch,
    });

    for await (const chunk of stream) {
      res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error: any) {
    logger.error('Streaming RAG query failed:', error);
    res.status(500).json({
      success: false,
      message: 'Streaming query failed',
      error: error.message,
    });
  }
});

/**
 * Delete documents
 * POST /api/llamaindex/delete
 */
router.post('/delete', async (req, res, _next) => {
  try {
    const { documentIds } = req.body;

    if (!documentIds || !Array.isArray(documentIds)) {
      res.status(400).json({
        success: false,
        message: 'documentIds array is required',
      });
      return;
    }

    await llamaindexService.deleteDocuments(documentIds);
    res.json({
      success: true,
      message: `Deleted ${documentIds.length} documents`,
    });
  } catch (error: any) {
    logger.error('Document deletion failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete documents',
      error: error.message,
    });
  }
});

/**
 * Get index statistics
 * GET /api/llamaindex/stats
 */
router.get('/stats', async (req, res, _next) => {
  try {
    const stats = await llamaindexService.getIndexStats();
    res.json({
      success: true,
      data: stats,
    });
  } catch (error: any) {
    logger.error('Failed to get index stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get index statistics',
      error: error.message,
    });
  }
});

export default router;
















