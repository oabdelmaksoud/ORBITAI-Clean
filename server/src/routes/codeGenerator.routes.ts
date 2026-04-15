/**
 * Code Generator Routes
 * Endpoints for generating code from agent-provided architecture and requirements
 */

import express, { Response } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { checkFeatureAccess, FeatureRequest } from '../middleware/featureCheck.js';
import { codeGeneratorService, CodeGenerationRequest, GeneratedFile } from '../services/codeGenerator.service.js';
import { Project } from '../models/Project.model.js';
import { Artifact } from '../models/Artifact.model.js';
import { AppError } from '../middleware/errorHandler.js';
import { logger } from '../utils/logger.js';
import { webSocketService } from '../services/websocket.service.js';
import * as JSZip from 'jszip';
import * as path from 'path';

const router = express.Router();

// Protected routes - require authentication
router.use(authenticateToken);

/**
 * POST /api/code-generation/generate
 * Generate code from architecture and requirements
 * Called by Implementation Agent
 */
router.post(
  '/generate',
  checkFeatureAccess('code_generation'),
  async (req: AuthRequest & FeatureRequest, res: Response, next) => {
    try {
      const userId = req.user!.id;
      const { projectId, dataModels, apiEndpoints, features, framework, methodology } = req.body;

      // Validate input
      if (!projectId) throw new AppError('Project ID is required', 400);
      if (!dataModels || !Array.isArray(dataModels)) throw new AppError('Data models are required', 400);
      if (!apiEndpoints || !Array.isArray(apiEndpoints)) throw new AppError('API endpoints are required', 400);
      if (!framework) throw new AppError('Framework is required', 400);

      // Fetch project
      const project = await Project.findOne({ _id: projectId, userId });
      if (!project) throw new AppError('Project not found', 404);

      logger.info(`🔧 Generating code for project: ${project.name} (${projectId})`);

      // Emit progress update via WebSocket
      webSocketService.broadcast(userId, {
        type: 'code_generation_started',
        projectId,
        message: 'Code generation started...',
      });

      // Create code generation request
      const generationRequest: CodeGenerationRequest = {
        projectName: project.name,
        description: project.description || '',
        framework: framework as any,
        dataModels,
        apiEndpoints,
        features: features || [],
        methodology: methodology || project.methodology,
        language: detectLanguage(framework),
      };

      // Generate code
      const result = await codeGeneratorService.generateBackendCode(generationRequest);

      if (!result.success) {
        webSocketService.broadcast(userId, {
          type: 'code_generation_failed',
          projectId,
          errors: result.validationReport?.errors,
        });

        throw new AppError(
          `Code generation failed: ${result.validationReport?.errors?.join(', ')}`,
          400
        );
      }

      // Store generated files as artifact
      const artifactContent = JSON.stringify({
        projectId: result.projectId,
        files: result.files.map(f => ({
          path: f.path,
          type: f.fileType,
          linesOfCode: f.content.split('\n').length,
        })),
        statistics: result.statistics,
      });

      const codeArtifact = new Artifact({
        projectId: new mongoose.Types.ObjectId(projectId),
        userId: new mongoose.Types.ObjectId(userId),
        title: `Generated Code - ${result.projectName}`,
        type: 'code',
        content: artifactContent,
        createdBy: 'Implementation Agent',
        phase: 'Implementation',
        fileCount: result.files.length,
        totalLines: result.statistics.totalLines,
      });

      await codeArtifact.save();

      // Update project
      project.artifacts.push(codeArtifact._id);
      project.currentPhase = 'Implementation';
      project.lastModified = new Date();
      await project.save();

      webSocketService.broadcast(userId, {
        type: 'code_generation_completed',
        projectId,
        message: `Generated ${result.statistics.totalFiles} files with ${result.statistics.totalLines} lines of code`,
        statistics: result.statistics,
        artifactId: codeArtifact._id,
      });

      logger.info(`✅ Code generation completed: ${result.statistics.totalFiles} files, ${result.statistics.totalLines} LOC`);

      res.json({
        success: true,
        data: {
          projectId: result.projectId,
          statistics: result.statistics,
          artifactId: codeArtifact._id,
          fileCount: result.files.length,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/code-generation/files/:projectId
 * Get all generated files for a project
 */
router.get(
  '/files/:projectId',
  async (req: AuthRequest, res: Response, next) => {
    try {
      const userId = req.user!.id;
      const { projectId } = req.params;

      const project = await Project.findOne({ _id: projectId, userId });
      if (!project) throw new AppError('Project not found', 404);

      const artifact = await Artifact.findOne({
        projectId,
        type: 'code',
      }).sort({ createdAt: -1 });

      if (!artifact) throw new AppError('No generated code found', 404);

      const data = JSON.parse(artifact.content);

      res.json({
        success: true,
        data: {
          projectId,
          generatedAt: artifact.createdAt,
          statistics: data.statistics,
          files: data.files,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/code-generation/download/:projectId
 * Download all generated files as ZIP
 */
router.get(
  '/download/:projectId',
  async (req: AuthRequest, res: Response, next) => {
    try {
      const userId = req.user!.id;
      const { projectId } = req.params;

      const project = await Project.findOne({ _id: projectId, userId });
      if (!project) throw new AppError('Project not found', 404);

      // Fetch generated code from storage
      // This would typically fetch from a code storage service
      // For now, we'll create a ZIP with metadata
      const zip = new JSZip();

      const artifact = await Artifact.findOne({
        projectId,
        type: 'code',
      }).sort({ createdAt: -1 });

      if (!artifact) throw new AppError('No generated code found', 404);

      const data = JSON.parse(artifact.content);

      // Add README
      zip.file(
        'README.md',
        `# ${project.name}\n\nGenerated code from ORBIT-AI\n\nFramework: ${data.statistics.framework || 'Unknown'}\nGenerated: ${new Date().toISOString()}`
      );

      // Add file manifest
      zip.file('MANIFEST.json', JSON.stringify(data, null, 2));

      // Generate ZIP
      const zipped = await zip.generateAsync({ type: 'nodebuffer' });

      res.setHeader('Content-Type', 'application/zip');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${project.name.toLowerCase().replace(/\\s+/g, '-')}-generated.zip"`
      );
      res.send(zipped);

      logger.info(`📦 Downloaded generated code for project: ${project.name}`);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/code-generation/validate
 * Validate generated code before deployment
 */
router.post(
  '/validate',
  async (req: AuthRequest, res: Response, next) => {
    try {
      const userId = req.user!.id;
      const { projectId, files } = req.body;

      if (!projectId) throw new AppError('Project ID is required', 400);
      if (!files || !Array.isArray(files)) throw new AppError('Files are required', 400);

      const project = await Project.findOne({ _id: projectId, userId });
      if (!project) throw new AppError('Project not found', 404);

      // Validate syntax, imports, and structure
      const validationResults = await validateFiles(files);

      const allValid = validationResults.every(r => r.isValid);

      res.json({
        success: true,
        data: {
          projectId,
          allValid,
          results: validationResults,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/code-generation/preview/:projectId
 * Get a preview of a specific generated file
 */
router.post(
  '/preview/:projectId',
  async (req: AuthRequest, res: Response, next) => {
    try {
      const userId = req.user!.id;
      const { projectId } = req.params;
      const { filePath } = req.body;

      if (!filePath) throw new AppError('File path is required', 400);

      const project = await Project.findOne({ _id: projectId, userId });
      if (!project) throw new AppError('Project not found', 404);

      // In production, would fetch from code storage service
      // For now, return mock preview
      const lines = 100;
      const mockContent = generateMockFileContent(filePath);

      res.json({
        success: true,
        data: {
          projectId,
          filePath,
          language: this.detectLanguageFromPath(filePath),
          content: mockContent,
          totalLines: mockContent.split('\n').length,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Helper methods
 */

function detectLanguage(framework: string): 'typescript' | 'python' | 'go' | 'java' {
  switch (framework) {
    case 'express':
    case 'nest':
      return 'typescript';
    case 'fastapi':
    case 'django':
      return 'python';
    case 'gin':
      return 'go';
    default:
      return 'typescript';
  }
}

function detectLanguageFromPath(filePath: string): string {
  const ext = path.extname(filePath);
  const map: Record<string, string> = {
    '.ts': 'typescript',
    '.js': 'javascript',
    '.py': 'python',
    '.go': 'go',
    '.json': 'json',
    '.yaml': 'yaml',
    '.yml': 'yaml',
    '.dockerfile': 'dockerfile',
    '.md': 'markdown',
  };
  return map[ext] || 'text';
}

async function validateFiles(
  files: GeneratedFile[]
): Promise<Array<{ filePath: string; isValid: boolean; errors: string[] }>> {
  return files.map(file => ({
    filePath: file.path,
    isValid: validateFileSyntax(file),
    errors: extractErrors(file),
  }));
}

function validateFileSyntax(file: GeneratedFile): boolean {
  // Basic validation - check for matching braces, parentheses
  const openBraces = (file.content.match(/\{/g) || []).length;
  const closeBraces = (file.content.match(/\}/g) || []).length;
  const openParens = (file.content.match(/\(/g) || []).length;
  const closeParens = (file.content.match(/\)/g) || []).length;

  return openBraces === closeBraces && openParens === closeParens;
}

function extractErrors(file: GeneratedFile): string[] {
  const errors: string[] = [];

  // Check for syntax errors in TypeScript/JavaScript
  if (file.fileType === 'typescript' || file.fileType === 'javascript') {
    if (file.content.includes('TODO:')) {
      errors.push('Contains TODO comments - implementation incomplete');
    }
  }

  return errors;
}

function generateMockFileContent(filePath: string): string {
  return `// Generated file: ${filePath}
// This is a preview of generated code

export const mockFunction = () => {
  // Implementation here
  return { status: 'ok' };
};

// ... (showing first 50 lines of generated file)`;
}

export const codeGeneratorRoutes = router;
