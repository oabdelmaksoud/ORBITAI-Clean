import express, { Response, NextFunction } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { checkFeatureAccess, FeatureRequest } from '../middleware/featureCheck.js';
import { Project } from '../models/Project.model.js';
import { AppError } from '../middleware/errorHandler.js';
import multer from 'multer';
import { validateFileUpload } from '../middleware/fileUploadValidation.js';
import { validateArtifactCreation, getMaxFileSizeBytes } from '../utils/packageLimits.js';
import { requirementsValidationService } from '../services/requirementsValidation.service.js';
import { Artifact } from '../models/Artifact.model.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

router.use(authenticateToken);

// Middleware to create dynamic multer instance based on user's package
const createDynamicMulter = () => {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      // Get user's max file size limit
      const maxFileSizeBytes = await getMaxFileSizeBytes(userId);
      
      // Create multer instance with user's file size limit
      const limits: { fileSize?: number } = {};
      if (maxFileSizeBytes !== undefined) {
        limits.fileSize = maxFileSizeBytes;
      }
      
      const upload = multer({
        storage: multer.memoryStorage(),
        limits
      });

      // Apply multer middleware
      upload.single('file')(req, res, (err) => {
        if (err) {
          if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
            return next(new AppError(
              `File size exceeds limit. Maximum file size: ${maxFileSizeBytes ? `${(maxFileSizeBytes / (1024 * 1024)).toFixed(2)} MB` : '10 MB'}`,
              413
            ));
          }
          return next(err);
        }
        next();
      });
    } catch (error) {
      next(error);
    }
  };
};

// Upload artifact - protected by artifact_viewer feature flag
// SECURITY: Added file upload validation (MIME type, extension, size, filename)
// ENFORCEMENT: Added package limit validation
router.post('/upload/:projectId', 
  checkFeatureAccess('artifact_viewer'),
  createDynamicMulter(),
  validateFileUpload,
  async (req: AuthRequest & FeatureRequest, res, next) => {
    try {
      const { projectId } = req.params;
      const userId = req.user!.id;
      const file = req.file;

      if (!file) {
        throw new AppError('No file uploaded', 400);
      }

      const project = await Project.findOne({
        _id: projectId,
        userId: userId
      });

      if (!project) {
        throw new AppError('Project not found', 404);
      }

      // ENFORCEMENT: Check artifact and storage limits
      const fileSizeMB = file.size / (1024 * 1024);
      await validateArtifactCreation(userId, projectId, fileSizeMB, 1);

      // Create artifact object
      const artifact = {
        id: `artifact-${Date.now()}`,
        title: file.originalname,
        type: 'document',
        content: file.buffer.toString('base64'),
        uploadedAt: new Date()
      };

      project.artifacts.push(artifact);
      project.lastModified = new Date();
      await project.save();

      // Auto-link to requirements if this is a code or test artifact
      let suggestedLinks: Array<{ requirementId: string; confidence: number; reason: string }> = [];
      try {
        // Create IArtifact-like object for suggestion service
        const artifactForLinking = {
          _id: artifact.id,
          title: artifact.title,
          content: typeof artifact.content === 'string' ? artifact.content : '',
          type: artifact.type,
          projectId: project._id,
          userId: userId
        } as any;

        suggestedLinks = await requirementsValidationService.suggestRequirementLinks(
          projectId,
          artifactForLinking
        );

        // If high confidence suggestions exist, log them (can be used to auto-populate traceRefs)
        if (suggestedLinks.length > 0 && suggestedLinks[0].confidence >= 0.8) {
          logger.info(`High confidence requirement links suggested for artifact ${artifact.id}:`, 
            suggestedLinks.filter(l => l.confidence >= 0.8).map(l => l.requirementId));
        }
      } catch (linkError: any) {
        // Don't fail artifact creation if auto-linking fails
        logger.warn('Auto-linking failed for artifact:', linkError.message);
      }

      res.json({
        success: true,
        data: { 
          artifact,
          suggestedRequirementLinks: suggestedLinks.filter(l => l.confidence >= 0.7) // Only return high confidence suggestions
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;

