import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { requireAdmin, AdminRequest } from '../middleware/adminAuth.js';
import { Package } from '../models/Package.model.js';
import { User } from '../models/User.model.js';
import { logger } from '../utils/logger.js';
import { AppError } from '../middleware/errorHandler.js';
import { logAudit } from '../middleware/auditLogger.js';

const router = express.Router();

// All routes require authentication + admin role
router.use(authenticateToken);
router.use(requireAdmin);

/**
 * GET /api/admin/packages
 * List all packages
 */
router.get('/', async (req: AdminRequest, res, next) => {
  try {
    const packages = await Package.find()
      .sort({ sortOrder: 1, createdAt: 1 })
      .lean();

    await logAudit(req, {
      action: 'packages.list',
      entityType: 'package',
      status: 'success'
    });

    res.json({
      success: true,
      data: {
        packages: packages.map(p => {
          const { _id, ...rest } = p;
          return {
            id: _id.toString(),
            ...rest
          };
        })
      }
    });
  } catch (error: any) {
    next(error);
  }
});

/**
 * GET /api/admin/packages/:id
 * Get package details
 */
router.get('/:id', async (req: AdminRequest, res, next) => {
  try {
    const packageDoc = await Package.findOne({ 
      $or: [
        { _id: req.params.id },
        { displayName: req.params.id }
      ]
    }).lean();

    if (!packageDoc) {
      throw new AppError('Package not found', 404);
    }

    const packageObj = packageDoc as any;
    const { _id, ...rest } = packageObj;
    res.json({
      success: true,
      data: {
        package: {
          id: _id.toString(),
          ...rest
        }
      }
    });
  } catch (error: any) {
    next(error);
  }
});

/**
 * POST /api/admin/packages
 * Create new package
 */
router.post('/', async (req: AdminRequest, res, next) => {
  try {
    const packageData = req.body;

    // Validate required fields
    if (!packageData.displayName) {
      throw new AppError('Package displayName is required', 400);
    }

    // Check if package with same displayName already exists
    const existing = await Package.findOne({
      displayName: packageData.displayName
    });

    if (existing) {
      throw new AppError('Package with this display name already exists', 400);
    }

    const newPackage = new Package({
      ...packageData
    });

    await newPackage.save();

    await logAudit(req, {
      action: 'package.created',
      entityType: 'package',
      entityId: newPackage._id.toString(),
      details: { displayName: newPackage.displayName }
    });

    logger.info(`Admin ${req.admin?.email} created package ${newPackage.displayName}`);

    const packageObj = newPackage.toObject();
    const { _id, ...rest } = packageObj;
    res.status(201).json({
      success: true,
      data: {
        package: {
          id: _id.toString(),
          ...rest
        }
      }
    });
  } catch (error: any) {
    await logAudit(req, {
      action: 'package.create',
      entityType: 'package',
      status: 'failed',
      errorMessage: error.message
    });
    next(error);
  }
});

/**
 * PUT /api/admin/packages/:id
 * Update package
 */
router.put('/:id', async (req: AdminRequest, res, next) => {
  try {
    const packageDoc = await Package.findOne({
      $or: [
        { _id: req.params.id },
        { displayName: req.params.id }
      ]
    });

    if (!packageDoc) {
      throw new AppError('Package not found', 404);
    }

    const oldData = {
      displayName: packageDoc.displayName,
      price: packageDoc.price,
      features: packageDoc.features,
      limits: packageDoc.limits
    };

    // Update fields
    const updateData = req.body;
    Object.keys(updateData).forEach(key => {
      if (key !== '_id' && key !== 'id') {
        (packageDoc as any)[key] = updateData[key];
      }
    });

    await packageDoc.save();

    await logAudit(req, {
      action: 'package.updated',
      entityType: 'package',
      entityId: packageDoc._id.toString(),
      details: {
        old: oldData,
        new: {
          displayName: packageDoc.displayName,
          price: packageDoc.price,
          features: packageDoc.features,
          limits: packageDoc.limits
        }
      }
    });

    logger.info(`Admin ${req.admin?.email} updated package ${packageDoc.displayName}`);

    const packageObj = packageDoc.toObject();
    const { _id: pkgId, ...rest } = packageObj;
    res.json({
      success: true,
      data: {
        package: {
          id: pkgId.toString(),
          ...rest
        }
      }
    });
  } catch (error: any) {
    await logAudit(req, {
      action: 'package.update',
      entityType: 'package',
      entityId: req.params.id,
      status: 'failed',
      errorMessage: error.message
    });
    next(error);
  }
});

/**
 * DELETE /api/admin/packages/:id
 * Delete package (only if no users are on it)
 */
router.delete('/:id', async (req: AdminRequest, res, next) => {
  try {
    const packageDoc = await Package.findOne({
      $or: [
        { _id: req.params.id },
        { displayName: req.params.id }
      ]
    });

    if (!packageDoc) {
      throw new AppError('Package not found', 404);
    }

    // Check if any users are on this package
    const userCount = await User.countDocuments({ plan: packageDoc.displayName });
    if (userCount > 0) {
      throw new AppError(
        `Cannot delete package: ${userCount} user(s) are currently on this plan. Please migrate them first.`,
        400
      );
    }

    await packageDoc.deleteOne();

    await logAudit(req, {
      action: 'package.deleted',
      entityType: 'package',
      entityId: packageDoc._id.toString(),
      details: { displayName: packageDoc.displayName }
    });

    logger.info(`Admin ${req.admin?.email} deleted package ${packageDoc.displayName}`);

    res.json({
      success: true,
      message: 'Package deleted successfully'
    });
  } catch (error: any) {
    await logAudit(req, {
      action: 'package.delete',
      entityType: 'package',
      entityId: req.params.id,
      status: 'failed',
      errorMessage: error.message
    });
    next(error);
  }
});

/**
 * GET /api/admin/packages/public
 * Get public packages (for frontend display)
 */
router.get('/public/list', async (_req, res, next) => {
  try {
    const packages = await Package.find({ isActive: true })
      .sort({ sortOrder: 1, createdAt: 1 })
      .select('-createdAt -updatedAt')
      .lean();

    res.json({
      success: true,
      data: {
        packages: packages.map(p => ({
          id: p.id || p._id.toString(),
          name: p.name,
          displayName: p.displayName,
          description: p.description,
          price: p.price,
          billingCycle: p.billingCycle,
          features: p.features,
          limits: p.limits,
          metadata: p.metadata
        }))
      }
    });
  } catch (error: any) {
    next(error);
  }
});

export default router;

