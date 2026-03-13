/**
 * Code Validation Routes
 * Endpoints for validating generated code
 */

import express, { Response } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { checkFeatureAccess, FeatureRequest } from '../middleware/featureCheck.js';
import { codeValidationService } from '../services/codeValidation.service.js';
import { Project } from '../models/Project.model.js';
import { AppError } from '../middleware/errorHandler.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

// Protected routes - require authentication
router.use(authenticateToken);

/**
 * POST /api/code-validation/validate
 * Validate code files
 */
router.post(
  '/validate',
  checkFeatureAccess('code_generation'),
  async (req: AuthRequest & FeatureRequest, res: Response, next) => {
    try {
      const { projectId, files, language } = req.body;

      // Validate input
      if (!files || !Array.isArray(files) || files.length === 0) {
        throw new AppError('Files are required for validation', 400);
      }

      // Optional project verification
      if (projectId) {
        const project = await Project.findOne({ _id: projectId, userId: req.user!.id });
        if (!project) throw new AppError('Project not found', 404);
      }

      logger.info(`🔍 Validating ${files.length} files`);

      // Validate all files
      const results = await Promise.all(
        files.map(async (file: any) => {
          const lang = file.language || language || codeValidationService.detectLanguage(file.path);
          const validation = await codeValidationService.validateCode(
            file.content,
            lang,
            file.path
          );
          return {
            path: file.path,
            language: lang,
            ...validation
          };
        })
      );

      // Calculate summary
      const summary = {
        totalFiles: results.length,
        validFiles: results.filter(r => r.isValid).length,
        filesWithWarnings: results.filter(r => r.warnings && r.warnings.length > 0).length,
        filesWithErrors: results.filter(r => !r.isValid).length,
        totalErrors: results.reduce((sum, r) => sum + (r.errors?.length || 0), 0),
        totalWarnings: results.reduce((sum, r) => sum + (r.warnings?.length || 0), 0)
      };

      res.json({
        success: true,
        data: {
          summary,
          results
        }
      });
    } catch (error: unknown) {
      logger.error('Code validation error:', error);
      next(error);
    }
  }
);

/**
 * POST /api/code-validation/validate-single
 * Validate a single code file
 */
router.post(
  '/validate-single',
  checkFeatureAccess('code_generation'),
  async (req: AuthRequest & FeatureRequest, res: Response, next) => {
    try {
      const { code, language, fileName } = req.body;

      if (!code) throw new AppError('Code is required', 400);

      const lang = language || codeValidationService.detectLanguage(fileName || 'file.ts');
      const validation = await codeValidationService.validateCode(code, lang, fileName);

      res.json({
        success: true,
        data: {
          fileName,
          language: lang,
          ...validation
        }
      });
    } catch (error: unknown) {
      next(error);
    }
  }
);

/**
 * POST /api/code-validation/lint
 * Run linting on code
 */
router.post(
  '/lint',
  checkFeatureAccess('code_generation'),
  async (req: AuthRequest & FeatureRequest, res: Response, next) => {
    try {
      const { code, language, rules } = req.body;

      if (!code) throw new AppError('Code is required', 400);

      const lintResults = await codeValidationService.lintCode(code, language, rules);

      res.json({
        success: true,
        data: lintResults
      });
    } catch (error: unknown) {
      next(error);
    }
  }
);

/**
 * POST /api/code-validation/best-practices
 * Check code for best practices
 */
router.post(
  '/best-practices',
  checkFeatureAccess('code_generation'),
  async (req: AuthRequest & FeatureRequest, res: Response, next) => {
    try {
      const { code, language, framework } = req.body;

      if (!code) throw new AppError('Code is required', 400);

      const practiceCheck = await codeValidationService.checkBestPractices(code, language, framework);

      res.json({
        success: true,
        data: practiceCheck
      });
    } catch (error: unknown) {
      next(error);
    }
  }
);

/**
 * POST /api/code-validation/security-scan
 * Scan code for security vulnerabilities
 */
router.post(
  '/security-scan',
  checkFeatureAccess('code_generation'),
  async (req: AuthRequest & FeatureRequest, res: Response, next) => {
    try {
      const { code, language, files } = req.body;

      if (!code && (!files || files.length === 0)) {
        throw new AppError('Code or files are required', 400);
      }

      let securityResults;

      if (files && files.length > 0) {
        // Scan multiple files
        securityResults = await Promise.all(
          files.map(async (file: any) => {
            const scan = await codeValidationService.securityScan(
              file.content,
              file.language || codeValidationService.detectLanguage(file.path)
            );
            return {
              path: file.path,
              ...scan
            };
          })
        );
      } else {
        // Single code scan
        securityResults = await codeValidationService.securityScan(code, language);
      }

      res.json({
        success: true,
        data: securityResults
      });
    } catch (error: unknown) {
      next(error);
    }
  }
);

/**
 * GET /api/code-validation/supported-languages
 * Get list of supported languages for validation
 */
router.get('/supported-languages', (_req, res) => {
  res.json({
    success: true,
    data: {
      languages: [
        { id: 'typescript', name: 'TypeScript', extensions: ['.ts', '.tsx'] },
        { id: 'javascript', name: 'JavaScript', extensions: ['.js', '.jsx'] },
        { id: 'python', name: 'Python', extensions: ['.py'] },
        { id: 'go', name: 'Go', extensions: ['.go'] },
        { id: 'rust', name: 'Rust', extensions: ['.rs'] },
        { id: 'java', name: 'Java', extensions: ['.java'] },
        { id: 'csharp', name: 'C#', extensions: ['.cs'] },
        { id: 'ruby', name: 'Ruby', extensions: ['.rb'] },
        { id: 'php', name: 'PHP', extensions: ['.php'] },
        { id: 'swift', name: 'Swift', extensions: ['.swift'] },
        { id: 'kotlin', name: 'Kotlin', extensions: ['.kt'] },
        { id: 'html', name: 'HTML', extensions: ['.html'] },
        { id: 'css', name: 'CSS', extensions: ['.css', '.scss', '.sass'] },
        { id: 'sql', name: 'SQL', extensions: ['.sql'] }
      ]
    }
  });
});

export const codeValidationRoutes = router;
