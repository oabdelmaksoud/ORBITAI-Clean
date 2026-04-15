import express from 'express';
import mongoose from 'mongoose';
import { PageContent } from '../models/PageContent.model.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

/**
 * GET /api/page-content/public/:pageKey
 * Get public page content (no authentication required)
 */
router.get('/:pageKey', async (req, res, next) => {
  try {
    const { pageKey } = req.params;
    
    // Check if MongoDB is connected
    if (mongoose.connection.readyState !== 1) {
      // MongoDB not connected - return empty sections
      res.json({
        success: true,
        data: {
          pageKey,
          sections: {}
        }
      });
      return;
    }
    
    const sections = await PageContent.find({ 
      pageKey,
      isActive: true 
    })
      .sort({ sortOrder: 1 })
      .lean();
    
    // Convert to object format keyed by sectionKey
    const sectionsMap: Record<string, any> = {};
    sections.forEach(section => {
      sectionsMap[section.sectionKey] = {
        content: section.content
      };
    });
    
    res.json({
      success: true,
      data: {
        pageKey,
        sections: sectionsMap
      }
    });
  } catch (error: unknown) {
    logger.error('Failed to get public page content:', error);
    next(error);
  }
});

export default router;

