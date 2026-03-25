/**
 * LangChain Routes
 * API endpoints for chain orchestration
 */

import express from 'express';
import { langchainService } from '../services/langchain.service.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

/**
 * Initialize LangChain service
 * POST /api/langchain/initialize
 */
router.post('/initialize', async (req, res, _next) => {
  try {
    await langchainService.initialize();
    res.json({
      success: true,
      message: 'LangChain service initialized',
    });
  } catch (error: any) {
    logger.error('LangChain initialization failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to initialize LangChain service',
      error: error.message,
    });
  }
});

/**
 * Create a chain
 * POST /api/langchain/chains
 */
router.post('/chains', async (req, res, _next) => {
  try {
    const { config } = req.body;

    // Note: In a real implementation, you'd store chains and return a chain ID
    // For now, we'll create and execute in one step
    res.json({
      success: true,
      message: 'Chain creation endpoint - use /execute endpoint with config',
    });
  } catch (error: any) {
    logger.error('Chain creation failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create chain',
      error: error.message,
    });
  }
});

/**
 * Execute a simple chain
 * POST /api/langchain/execute
 */
router.post('/execute', async (req, res, _next) => {
  try {
    const { input, config, history } = req.body;

    if (!input) {
      res.status(400).json({
        success: false,
        message: 'input is required',
      });
      return;
    }

    const chain = await langchainService.createChain(config || {});
    const result = await langchainService.runChain(chain, { input, history });

    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    logger.error('Chain execution failed:', error);
    res.status(500).json({
      success: false,
      message: 'Chain execution failed',
      error: error.message,
    });
  }
});

/**
 * Execute RAG chain
 * POST /api/langchain/rag
 */
router.post('/rag', async (req, res, _next) => {
  try {
    const { input, config } = req.body;

    if (!input) {
      res.status(400).json({
        success: false,
        message: 'input is required',
      });
      return;
    }

    const chain = await langchainService.createRAGChain(config || {});
    const result = await langchainService.runChain(chain, { input });

    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    logger.error('RAG chain execution failed:', error);
    res.status(500).json({
      success: false,
      message: 'RAG chain execution failed',
      error: error.message,
    });
  }
});

/**
 * Stream chain execution
 * POST /api/langchain/stream
 */
router.post('/stream', async (req, res, _next) => {
  try {
    const { input, config, history } = req.body;

    if (!input) {
      res.status(400).json({
        success: false,
        message: 'input is required',
      });
      return;
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const chain = await langchainService.createChain(config || {});
    const stream = langchainService.streamChain(chain, { input, history });

    for await (const chunk of stream) {
      res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error: any) {
    logger.error('Chain streaming failed:', error);
    res.status(500).json({
      success: false,
      message: 'Chain streaming failed',
      error: error.message,
    });
  }
});

/**
 * Add documents to vector store
 * POST /api/langchain/documents
 */
router.post('/documents', async (req, res, _next) => {
  try {
    const { documents } = req.body;

    if (!documents || !Array.isArray(documents)) {
      res.status(400).json({
        success: false,
        message: 'documents array is required',
      });
      return;
    }

    await langchainService.addDocuments(documents);
    res.json({
      success: true,
      message: `Added ${documents.length} documents`,
    });
  } catch (error: any) {
    logger.error('Failed to add documents:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add documents',
      error: error.message,
    });
  }
});

/**
 * Execute sequential chain
 * POST /api/langchain/sequential
 */
router.post('/sequential', async (req, res, _next) => {
  try {
    const { input, steps, config } = req.body;

    if (!input || !steps || !Array.isArray(steps)) {
      res.status(400).json({
        success: false,
        message: 'input and steps array are required',
      });
      return;
    }

    const chain = await langchainService.createSequentialChain(steps, config || {});
    const result = await langchainService.runChain(chain, { input });

    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    logger.error('Sequential chain execution failed:', error);
    res.status(500).json({
      success: false,
      message: 'Sequential chain execution failed',
      error: error.message,
    });
  }
});

export default router;
















