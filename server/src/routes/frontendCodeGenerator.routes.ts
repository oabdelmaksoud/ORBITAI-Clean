/**
 * Frontend Code Generator Routes
 * Endpoints for generating React, Vue, Angular, and Svelte frontends
 */

import express, { Response } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { checkFeatureAccess, FeatureRequest } from '../middleware/featureCheck.js';
import { frontendCodeGeneratorService } from '../services/frontendCodeGenerator.service.js';
import { Project } from '../models/Project.model.js';
import { Artifact } from '../models/Artifact.model.js';
import { AppError } from '../middleware/errorHandler.js';
import { logger } from '../utils/logger.js';
import { webSocketService } from '../services/websocket.service.js';

const router = express.Router();

// Protected routes - require authentication
router.use(authenticateToken);

/**
 * POST /api/frontend-generation/generate
 * Generate frontend code from design specifications
 */
router.post(
  '/generate',
  checkFeatureAccess('code_generation'),
  async (req: AuthRequest & FeatureRequest, res: Response, next) => {
    try {
      const userId = req.user!.id;
      const {
        projectId,
        framework,
        pages,
        components,
        stateManagement,
        styling,
        apiIntegration,
        authentication
      } = req.body;

      // Validate input
      if (!projectId) throw new AppError('Project ID is required', 400);
      if (!framework) throw new AppError('Framework is required (react, vue, angular, svelte)', 400);

      // Fetch project
      const project = await Project.findOne({ _id: projectId, userId });
      if (!project) throw new AppError('Project not found', 404);

      logger.info(`🎨 Generating frontend for project: ${project.name} (${projectId})`);

      // Emit progress update via WebSocket
      webSocketService.broadcast(userId, {
        type: 'frontend_generation_started',
        projectId,
        message: 'Frontend code generation started...',
      });

      // Generate frontend code
      const result = await frontendCodeGeneratorService.generateFrontendCode({
        projectName: project.name,
        description: project.description || '',
        framework,
        pages: pages || [],
        components: components || [],
        stateManagement: stateManagement || 'context',
        styling: styling || 'tailwind',
        apiIntegration: apiIntegration || { baseUrl: '/api', endpoints: [] },
        authentication: authentication || { enabled: false }
      });

      if (!result.success) {
        webSocketService.broadcast(userId, {
          type: 'frontend_generation_failed',
          projectId,
          error: result.error
        });

        throw new AppError(`Frontend generation failed: ${result.error}`, 400);
      }

      // Store generated files as artifact
      const artifactContent = JSON.stringify({
        framework: result.framework,
        files: result.files.map(f => ({
          path: f.path,
          type: f.fileType,
          linesOfCode: f.content.split('\n').length
        })),
        fileCount: result.files.length
      });

      const frontendArtifact = new Artifact({
        projectId,
        title: `Frontend Code - ${result.framework}`,
        type: 'code',
        content: artifactContent,
        createdBy: 'UI/UX Agent',
        phase: 'Implementation',
        metadata: {
          generatedAt: new Date(),
          framework: result.framework,
          fileCount: result.files.length
        }
      });

      await frontendArtifact.save();

      // Emit success event
      webSocketService.broadcast(userId, {
        type: 'frontend_generation_completed',
        projectId,
        artifactId: frontendArtifact._id,
        fileCount: result.files.length
      });

      logger.info(`✅ Frontend generated successfully: ${result.files.length} files`);

      res.json({
        success: true,
        data: {
          framework: result.framework,
          files: result.files.map(f => ({
            path: f.path,
            type: f.fileType,
            preview: f.content.substring(0, 500) + (f.content.length > 500 ? '...' : '')
          })),
          fullFiles: result.files,
          artifactId: frontendArtifact._id,
          fileCount: result.files.length
        }
      });
    } catch (error: unknown) {
      logger.error('Frontend generation route error:', error);
      next(error);
    }
  }
);

/**
 * POST /api/frontend-generation/generate-component
 * Generate a single component
 */
router.post(
  '/generate-component',
  checkFeatureAccess('code_generation'),
  async (req: AuthRequest & FeatureRequest, res: Response, next) => {
    try {
      const {
        projectId,
        framework,
        componentName,
        componentType,
        props,
        styling
      } = req.body;

      if (!projectId) throw new AppError('Project ID is required', 400);
      if (!framework) throw new AppError('Framework is required', 400);
      if (!componentName) throw new AppError('Component name is required', 400);

      // Verify project ownership
      const project = await Project.findOne({ _id: projectId, userId: req.user!.id });
      if (!project) throw new AppError('Project not found', 404);

      // Generate single component based on framework
      let component;

      if (framework === 'react') {
        component = (frontendCodeGeneratorService as any).generateReactComponent({
          name: componentName,
          type: componentType || 'functional',
          props: props || [],
          styling: styling || 'tailwind'
        });
      } else if (framework === 'vue') {
        component = (frontendCodeGeneratorService as any).generateVueComponent({
          name: componentName,
          props: props || [],
          styling: styling || 'tailwind'
        });
      } else if (framework === 'angular') {
        component = (frontendCodeGeneratorService as any).generateAngularComponent({
          name: componentName,
          props: props || []
        });
      } else if (framework === 'svelte') {
        component = (frontendCodeGeneratorService as any).generateSvelteComponent({
          name: componentName,
          props: props || []
        });
      }

      res.json({
        success: true,
        data: {
          componentName,
          framework,
          code: component
        }
      });
    } catch (error: unknown) {
      next(error);
    }
  }
);

/**
 * GET /api/frontend-generation/frameworks
 * Get available frontend frameworks and their configurations
 */
router.get('/frameworks', async (_req, res) => {
  res.json({
    success: true,
    data: {
      frameworks: [
        {
          id: 'react',
          name: 'React',
          version: '18.x',
          stateManagement: ['context', 'redux', 'zustand', 'jotai', 'recoil'],
          styling: ['tailwind', 'styled-components', 'emotion', 'css-modules', 'sass'],
          features: ['TypeScript', 'React Router', 'React Query', 'Form handling', 'Authentication']
        },
        {
          id: 'vue',
          name: 'Vue.js',
          version: '3.x',
          stateManagement: ['pinia', 'vuex'],
          styling: ['tailwind', 'scss', 'css-modules'],
          features: ['TypeScript', 'Vue Router', 'Composition API', 'Form handling']
        },
        {
          id: 'angular',
          name: 'Angular',
          version: '17.x',
          stateManagement: ['ngrx', 'akita', 'ngxs'],
          styling: ['scss', 'tailwind', 'angular-material'],
          features: ['TypeScript', 'Angular Router', 'Reactive Forms', 'HTTP Client']
        },
        {
          id: 'svelte',
          name: 'Svelte',
          version: '5.x',
          stateManagement: ['stores', 'context'],
          styling: ['tailwind', 'scss', 'css'],
          features: ['TypeScript', 'SvelteKit', 'Form handling', 'Transitions']
        }
      ]
    }
  });
});

/**
 * POST /api/frontend-generation/preview
 * Generate a preview of the frontend without saving
 */
router.post(
  '/preview',
  checkFeatureAccess('code_generation'),
  async (req: AuthRequest & FeatureRequest, res: Response, next) => {
    try {
      const {
        framework,
        projectName,
        pages,
        components,
        stateManagement,
        styling
      } = req.body;

      if (!framework) throw new AppError('Framework is required', 400);

      // Generate preview (limited files)
      const result = await frontendCodeGeneratorService.generateFrontendCode({
        projectName: projectName || 'Preview Project',
        description: 'Preview generation',
        framework,
        pages: pages?.slice(0, 3) || [], // Limit for preview
        components: components?.slice(0, 5) || [],
        stateManagement: stateManagement || 'context',
        styling: styling || 'tailwind',
        apiIntegration: { baseUrl: '/api', endpoints: [] },
        authentication: { enabled: false }
      });

      res.json({
        success: true,
        data: {
          framework: result.framework,
          fileCount: result.files.length,
          files: result.files.slice(0, 10).map(f => ({
            path: f.path,
            type: f.fileType,
            preview: f.content.substring(0, 300)
          }))
        }
      });
    } catch (error: unknown) {
      next(error);
    }
  }
);

export const frontendCodeGeneratorRoutes = router;
