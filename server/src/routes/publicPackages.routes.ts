import express from 'express';
import mongoose from 'mongoose';
import { Package } from '../models/Package.model.js';

const router = express.Router();

/**
 * GET /api/packages/public
 * Get public packages (for frontend signup/landing page display)
 * No authentication required
 */
router.get('/', async (_req, res, next) => {
  try {
    // Check if MongoDB is connected
    if (mongoose.connection.readyState !== 1) {
      // MongoDB not connected - return empty array
      return res.json({
        success: true,
        data: {
          packages: []
        }
      });
    }
    
    const packages = await Package.find({ isActive: true })
      .sort({ sortOrder: 1, createdAt: 1 })
      .select('-createdAt -updatedAt -__v')
      .lean();

    res.json({
      success: true,
      data: {
        packages: packages.map(p => {
          const { _id, ...rest } = p as any;
          return {
            id: _id.toString(),
            displayName: rest.displayName,
            description: rest.description || '',
            price: rest.price,
            billingCycle: rest.billingCycle,
            features: rest.features || [],
            limits: rest.limits || {},
            metadata: rest.metadata || {},
            isDefault: rest.isDefault || false
          };
        })
      }
    });
  } catch (error: any) {
    next(error);
  }
});

/**
 * GET /api/packages/public/:id
 * Get a specific public package by id
 * No authentication required
 */
router.get('/:id', async (req, res, next) => {
  try {
    // Check if MongoDB is connected
    if (mongoose.connection.readyState !== 1) {
      return res.status(404).json({
        success: false,
        message: 'MongoDB not connected'
      });
    }
    
    const packageDoc = await Package.findOne({ 
      $or: [
        { _id: req.params.id },
        { displayName: req.params.id }
      ],
      isActive: true
    })
      .select('-createdAt -updatedAt -__v')
      .lean();

    if (!packageDoc) {
      return res.status(404).json({
        success: false,
        message: 'Package not found'
      });
    }

    const { _id, ...rest } = packageDoc as any;
    res.json({
      success: true,
      data: {
        package: {
          id: _id.toString(),
          displayName: rest.displayName,
          description: rest.description || '',
          price: rest.price,
          billingCycle: rest.billingCycle,
          features: rest.features || [],
          limits: rest.limits || {},
          metadata: rest.metadata || {},
          isDefault: rest.isDefault || false
        }
      }
    });
  } catch (error: any) {
    next(error);
  }
});

export default router;

