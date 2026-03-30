import express from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { notebookService } from '../services/notebook.service.js';
import { AppError } from '../middleware/errorHandler.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

router.use(authenticateToken);

/**
 * POST /api/notebook/execute-cell
 * Execute a single notebook cell
 */
router.post('/execute-cell', async (req: AuthRequest, res, next) => {
  try {
    const { code, language = 'python' } = req.body;

    if (!code || typeof code !== 'string') {
      throw new AppError('Code is required', 400);
    }

    const result = await notebookService.executeCell(code, language);

    res.json({
      success: result.success,
      output: result.output,
      error: result.error,
      images: result.images,
      data: result.data,
      executionTime: result.executionTime
    });
  } catch (error: any) {
    logger.error('Failed to execute notebook cell:', error);
    next(error);
  }
});

/**
 * POST /api/notebook/export
 * Export notebook to Jupyter format (.ipynb)
 */
router.post('/export', async (req: AuthRequest, res, next) => {
  try {
    const { cells } = req.body;

    if (!cells || !Array.isArray(cells)) {
      throw new AppError('Cells array is required', 400);
    }

    const jupyterNotebook = notebookService.convertToJupyterNotebook(cells);

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="notebook.ipynb"');
    res.json(jupyterNotebook);
  } catch (error: any) {
    logger.error('Failed to export notebook:', error);
    next(error);
  }
});

/**
 * POST /api/notebook/parse
 * Parse Jupyter notebook format to internal format
 */
router.post('/parse', async (req: AuthRequest, res, next) => {
  try {
    const { jupyterNotebook } = req.body;

    if (!jupyterNotebook) {
      throw new AppError('Jupyter notebook is required', 400);
    }

    const cells = notebookService.parseFromJupyterNotebook(jupyterNotebook);

    res.json({
      success: true,
      cells
    });
  } catch (error: any) {
    logger.error('Failed to parse notebook:', error);
    next(error);
  }
});

/**
 * POST /api/notebook/execute
 * Execute a full notebook and return updated cells
 */
router.post('/execute', async (req: AuthRequest, res, next) => {
  try {
    const { cells } = req.body;

    if (!cells || !Array.isArray(cells)) {
      throw new AppError('Cells array is required', 400);
    }

    const updatedCells = await notebookService.executeNotebook(cells);

    res.json({
      success: true,
      cells: updatedCells
    });
  } catch (error: any) {
    logger.error('Failed to execute notebook:', error);
    next(error);
  }
});

export default router;




