/**
 * GitHub Integration Routes
 * OAuth and API integration with GitHub
 */

import express from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

/**
 * GET /api/integrations/github/health
 * Health check endpoint
 */
router.get('/health', (_req, res) => {
  res.json({ status: 'ok', message: 'GitHub integration service is running' });
});

/**
 * GET /api/integrations/github/auth
 * Initiate GitHub OAuth flow
 */
router.get('/auth', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const redirectUri = `${process.env.APP_URL || 'http://localhost:5173'}/integrations/github/callback`;
    
    const clientId = process.env.GITHUB_CLIENT_ID;
    if (!clientId) {
      return res.status(400).json({
        success: false,
        message: 'GitHub integration not configured. Please set GITHUB_CLIENT_ID environment variable.'
      });
    }

    const scopes = ['repo', 'read:user', 'user:email'];
    const state = Buffer.from(JSON.stringify({ userId })).toString('base64');
    
    const authUrl = `https://github.com/login/oauth/authorize?` +
      `client_id=${clientId}&` +
      `scope=${scopes.join(' ')}&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `state=${state}`;

    res.json({
      success: true,
      data: {
        authUrl,
        state
      }
    });
  } catch (error: unknown) {
    logger.error('Failed to initiate GitHub OAuth:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to initiate GitHub OAuth'
    });
  }
});

/**
 * GET /api/integrations/github/callback
 * Handle GitHub OAuth callback
 */
router.get('/callback', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { code, state } = req.query;

    if (!code) {
      return res.status(400).json({
        success: false,
        message: 'Authorization code is required'
      });
    }

    const clientId = process.env.GITHUB_CLIENT_ID;
    const clientSecret = process.env.GITHUB_CLIENT_SECRET;
    const redirectUri = `${process.env.APP_URL || 'http://localhost:5173'}/integrations/github/callback`;

    if (!clientId || !clientSecret) {
      return res.status(400).json({
        success: false,
        message: 'GitHub integration not configured'
      });
    }

    // Exchange code for token
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code: code as string,
        redirect_uri: redirectUri
      })
    });

    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      throw new Error(tokenData.error_description || 'Failed to exchange code for token');
    }

    // Get user info
    const userResponse = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    const userData = await userResponse.json();

    // Store token (in production, save to database)
    logger.info(`GitHub OAuth successful for user ${req.user!.id}`);

    res.json({
      success: true,
      message: 'GitHub integration connected successfully',
      data: {
        username: userData.login,
        name: userData.name,
        email: userData.email
      }
    });
  } catch (error: unknown) {
    logger.error('Failed to handle GitHub OAuth callback:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to complete GitHub OAuth'
    });
  }
});

/**
 * GET /api/integrations/github/repos
 * List user repositories
 */
router.get('/repos', authenticateToken, async (req: AuthRequest, res) => {
  try {
    // In production, retrieve stored token from database
    const accessToken = process.env.GITHUB_ACCESS_TOKEN;

    if (!accessToken) {
      return res.status(400).json({
        success: false,
        message: 'GitHub not connected. Please authenticate first.'
      });
    }

    const response = await fetch('https://api.github.com/user/repos?per_page=10&sort=updated', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    const data = await response.json();

    if (data.message && data.message.includes('Bad credentials')) {
      throw new Error('Invalid GitHub token');
    }

    res.json({
      success: true,
      data: {
        repos: data || []
      }
    });
  } catch (error: unknown) {
    logger.error('Failed to list GitHub repositories:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to list repositories'
    });
  }
});

/**
 * POST /api/integrations/github/create-repo
 * Create a new repository
 */
router.post('/create-repo', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { name, description, private: isPrivate } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Repository name is required'
      });
    }

    // In production, retrieve stored token from database
    const accessToken = process.env.GITHUB_ACCESS_TOKEN;

    if (!accessToken) {
      return res.status(400).json({
        success: false,
        message: 'GitHub not connected'
      });
    }

    const response = await fetch('https://api.github.com/user/repos', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name,
        description: description || '',
        private: isPrivate || false
      })
    });

    const data = await response.json();

    if (data.message) {
      throw new Error(data.message);
    }

    res.json({
      success: true,
      data: {
        repo: data
      }
    });
  } catch (error: unknown) {
    logger.error('Failed to create GitHub repository:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create repository'
    });
  }
});

/**
 * POST /api/integrations/github/create-workflow
 * Create a GitHub Actions workflow
 */
router.post('/create-workflow', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { owner, repo, workflowName, platform } = req.body;

    if (!owner || !repo) {
      return res.status(400).json({
        success: false,
        message: 'Owner and repo are required'
      });
    }

    const accessToken = process.env.GITHUB_ACCESS_TOKEN;

    if (!accessToken) {
      return res.status(400).json({
        success: false,
        message: 'GitHub not connected'
      });
    }

    // Import github service dynamically
    const { githubService } = await import('../services/github.service.js');
    
    // Generate workflow config based on platform
    const workflowConfig = githubService.generateDeploymentWorkflow(platform || 'vercel');
    
    // Create workflow file
    const result = await githubService.createWorkflow(
      accessToken,
      owner,
      repo,
      workflowName || 'deploy',
      workflowConfig
    );

    res.json({
      success: true,
      data: {
        path: result.path,
        sha: result.sha,
        message: `Workflow created at ${result.path}`
      }
    });
  } catch (error: unknown) {
    logger.error('Failed to create GitHub workflow:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create workflow'
    });
  }
});

/**
 * POST /api/integrations/github/push-project
 * Push generated project to GitHub
 */
router.post('/push-project', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { projectId, owner, repo, branch, createRepo } = req.body;

    if (!projectId) {
      return res.status(400).json({
        success: false,
        message: 'Project ID is required'
      });
    }

    const accessToken = process.env.GITHUB_ACCESS_TOKEN;

    if (!accessToken) {
      return res.status(400).json({
        success: false,
        message: 'GitHub not connected'
      });
    }

    // Import services
    const { githubService } = await import('../services/github.service.js');
    const { Project } = await import('../models/Project.model.js');
    
    const project = await Project.findById(projectId).lean();
    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }

    // Get generated files from project artifacts
    const codeArtifacts = project.artifacts?.filter(
      (a: any) => a.type === 'code'
    ) || [];

    if (codeArtifacts.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No generated code found. Generate code first.'
      });
    }

    // Parse the code artifacts to get files
    let files: Array<{ path: string; content: string }> = [];
    for (const artifact of codeArtifacts) {
      try {
        const content = JSON.parse(artifact.content);
        if (content.files) {
          files = files.concat(content.files);
        }
      } catch (e) {
        // Not JSON, treat as raw file
        files.push({
          path: artifact.title || 'untitled.ts',
          content: artifact.content
        });
      }
    }

    // Create repo if requested
    const repoName = repo || project.name.toLowerCase().replace(/\s+/g, '-');
    const repoOwner = owner || 'user';

    if (createRepo) {
      try {
        await githubService.createRepository(accessToken, {
          name: repoName,
          description: project.description || `Generated by ORBITAI`,
          private: true
        });
      } catch (e: any) {
        // Repo might already exist
        logger.warn('Repo creation failed (might already exist):', e.message);
      }
    }

    // Push files to repository
    const result = await githubService.pushGeneratedProject(
      accessToken,
      repoOwner,
      repoName,
      files,
      branch || 'main',
      `feat: Push generated project from ORBITAI`
    );

    res.json({
      success: true,
      data: {
        repoUrl: `https://github.com/${repoOwner}/${repoName}`,
        commitSha: result.sha,
        filesCount: files.length,
        branch: branch || 'main'
      }
    });
  } catch (error: unknown) {
    logger.error('Failed to push project to GitHub:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to push project'
    });
  }
});

/**
 * GET /api/integrations/github/workflow-templates
 * Get available workflow templates
 */
router.get('/workflow-templates', authenticateToken, async (_req, res) => {
  res.json({
    success: true,
    data: {
      templates: [
        {
          id: 'vercel',
          name: 'Vercel Deployment',
          description: 'Auto-deploy to Vercel on push to main',
          secrets: ['VERCEL_TOKEN', 'VERCEL_ORG_ID', 'VERCEL_PROJECT_ID']
        },
        {
          id: 'railway',
          name: 'Railway Deployment',
          description: 'Auto-deploy to Railway on push to main',
          secrets: ['RAILWAY_TOKEN', 'RAILWAY_SERVICE']
        },
        {
          id: 'netlify',
          name: 'Netlify Deployment',
          description: 'Auto-deploy to Netlify on push to main',
          secrets: ['NETLIFY_AUTH_TOKEN', 'NETLIFY_SITE_ID']
        },
        {
          id: 'render',
          name: 'Render Deployment',
          description: 'Auto-deploy to Render on push to main',
          secrets: ['RENDER_API_KEY', 'RENDER_SERVICE_ID']
        },
        {
          id: 'aws',
          name: 'AWS ECS Deployment',
          description: 'Auto-deploy to AWS ECS on push to main',
          secrets: ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_REGION', 'ECR_REPOSITORY', 'ECR_REGISTRY']
        },
        {
          id: 'gcp',
          name: 'Google Cloud Run Deployment',
          description: 'Auto-deploy to Cloud Run on push to main',
          secrets: ['GCP_PROJECT_ID', 'GCP_SA_KEY']
        },
        {
          id: 'azure',
          name: 'Azure Container Apps Deployment',
          description: 'Auto-deploy to Azure Container Apps on push to main',
          secrets: ['AZURE_CREDENTIALS', 'AZURE_RG', 'AZURE_APP']
        }
      ]
    }
  });
});

export default router;
