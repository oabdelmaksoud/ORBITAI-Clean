/**
 * Project Export Routes
 * Endpoints for exporting and downloading complete projects
 */

import express, { Response } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { checkFeatureAccess, FeatureRequest } from '../middleware/featureCheck.js';
import { projectExportService, ExportOptions } from '../services/projectExport.service.js';
import { Project } from '../models/Project.model.js';
import { AppError } from '../middleware/errorHandler.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * POST /api/projects/:projectId/export
 * Export a project as a downloadable ZIP
 */
router.post(
  '/:projectId/export',
  checkFeatureAccess('project_export'),
  async (req: AuthRequest & FeatureRequest, res: Response, next) => {
    try {
      const userId = req.user!.id;
      const { projectId } = req.params;
      const options: ExportOptions = req.body || {};

      // Verify project ownership
      const project = await Project.findOne({ _id: projectId, userId });
      if (!project) {
        throw new AppError('Project not found', 404);
      }

      logger.info(`📦 Exporting project: ${project.name} for user ${userId}`);

      // Generate export
      const result = await projectExportService.exportProject(projectId, {
        includeTests: options.includeTests ?? true,
        includeDocumentation: options.includeDocumentation ?? true,
        includeDocker: options.includeDocker ?? true,
        includeCICD: options.includeCICD ?? true,
        includeEnvTemplate: options.includeEnvTemplate ?? true,
        validateCode: options.validateCode ?? false,
      });

      // Set response headers for file download
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
      res.setHeader('Content-Length', result.zipBuffer.length);
      res.setHeader('X-Export-Id', result.exportId);
      res.setHeader('X-Total-Files', result.statistics.totalFiles.toString());

      // Send ZIP buffer
      res.send(result.zipBuffer);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/projects/:projectId/export/preview
 * Preview what will be exported (file list without actual content)
 */
router.get(
  '/:projectId/export/preview',
  async (req: AuthRequest, res: Response, next) => {
    try {
      const userId = req.user!.id;
      const { projectId } = req.params;

      const project = await Project.findOne({ _id: projectId, userId })
        .populate('artifacts')
        .lean();

      if (!project) {
        throw new AppError('Project not found', 404);
      }

      // Build preview of export
      const preview = {
        projectName: project.name,
        estimatedFiles: 0,
        structure: {
          hasBackend: false,
          hasFrontend: false,
          hasMobile: false,
        },
        sections: [] as Array<{ name: string; files: string[] }>,
      };

      // Analyze artifacts to determine structure
      const artifacts = project.artifacts || [];
      const codeArtifacts = artifacts.filter((a: any) => 
        a.type === 'code' || a.type === 'generated'
      );

      for (const artifact of codeArtifacts) {
        try {
          const data = JSON.parse((artifact as any).content || '{}');
          if (data.files) {
            preview.estimatedFiles += data.files.length;
            
            const backendFiles = data.files.filter((f: any) => 
              f.path.includes('routes') || f.path.includes('controllers')
            );
            const frontendFiles = data.files.filter((f: any) => 
              f.path.includes('components') || f.path.includes('.tsx')
            );

            if (backendFiles.length > 0) preview.structure.hasBackend = true;
            if (frontendFiles.length > 0) preview.structure.hasFrontend = true;
          }
        } catch (e) {
          // Not JSON
        }
      }

      // Add infrastructure files count
      preview.estimatedFiles += 10; // Docker, Makefile, etc.
      
      // Add documentation files count
      preview.estimatedFiles += 5; // README, API docs, etc.

      preview.sections = [
        {
          name: 'Backend',
          files: preview.structure.hasBackend ? [
            'backend/src/index.ts',
            'backend/src/routes/*',
            'backend/src/models/*',
            'backend/src/middleware/*',
            'backend/package.json',
            'backend/Dockerfile',
          ] : [],
        },
        {
          name: 'Frontend',
          files: preview.structure.hasFrontend ? [
            'frontend/src/App.tsx',
            'frontend/src/components/*',
            'frontend/src/pages/*',
            'frontend/src/services/*',
            'frontend/package.json',
            'frontend/Dockerfile',
          ] : [],
        },
        {
          name: 'Infrastructure',
          files: [
            'docker-compose.yml',
            'Makefile',
            'nginx.conf',
            '.github/workflows/ci.yml',
            '.github/workflows/deploy.yml',
          ],
        },
        {
          name: 'Documentation',
          files: [
            'README.md',
            'docs/API.md',
            'docs/ARCHITECTURE.md',
            'docs/DEPLOYMENT.md',
            'docs/CONTRIBUTING.md',
          ],
        },
      ];

      res.json({
        success: true,
        data: preview,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/projects/:projectId/export/github
 * Export project directly to GitHub
 */
router.post(
  '/:projectId/export/github',
  checkFeatureAccess('github_integration'),
  async (req: AuthRequest & FeatureRequest, res: Response, next) => {
    try {
      const userId = req.user!.id;
      const { projectId } = req.params;
      const { repoName, private: isPrivate, description, createNew } = req.body;

      const project = await Project.findOne({ _id: projectId, userId });
      if (!project) {
        throw new AppError('Project not found', 404);
      }

      // Get GitHub token from user
      const { githubService } = await import('../services/github.service.js');
      const accessToken = await githubService.getUserGitHubToken(userId);
      
      if (!accessToken) {
        throw new AppError('GitHub not connected. Please connect your GitHub account first.', 400);
      }

      // Export project
      const exportResult = await projectExportService.exportProject(projectId, {
        includeTests: true,
        includeDocumentation: true,
        includeDocker: true,
        includeCICD: true,
      });

      // Extract files from ZIP for GitHub push
      const JSZip = (await import('jszip')).default;
      const zip = await JSZip.loadAsync(exportResult.zipBuffer);
      
      const files: Array<{ path: string; content: string }> = [];
      for (const [path, file] of Object.entries(zip.files)) {
        if (!file.dir) {
          const content = await file.async('string');
          files.push({ path, content });
        }
      }

      // Push to GitHub
      const result = await githubService.pushGeneratedProject(
        accessToken,
        project.name || 'project',
        files as any,
        {
          createRepo: createNew !== false,
          repoName: repoName || project.name,
          private: isPrivate ?? true,
          description: description || project.description,
        }
      );

      res.json({
        success: true,
        data: {
          repo: result.repo,
          commitSha: result.commitSha,
          commitUrl: result.commitUrl,
          filesUploaded: files.length,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/projects/:projectId/export/status/:exportId
 * Get status of an export (for async exports)
 */
router.get(
  '/:projectId/export/status/:exportId',
  async (req: AuthRequest, res: Response, next) => {
    try {
      const { projectId, exportId } = req.params;

      // For now, exports are synchronous
      // This endpoint is for future async export support
      res.json({
        success: true,
        data: {
          exportId,
          projectId,
          status: 'completed',
          message: 'Export completed',
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
