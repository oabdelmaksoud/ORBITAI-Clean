import express from 'express';
import { Project } from '../models/Project.model.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import { checkFeatureAccess, requireFeatureAccess, FeatureRequest } from '../middleware/featureCheck.js';
import { validateArtifactsArray } from '../utils/packageLimits.js';
import { validate } from '../middleware/validate.js';
import { createProjectSchema, updateProjectSchema } from '../validators/project.validator.js';
import { logger } from '../utils/logger.js';
import { projectPackagerService } from '../services/projectPackager.service.js';
import { projectCompletionService } from '../services/projectCompletion.service.js';
import { autoCompletionService } from '../services/autoCompletion.service.js';

const router = express.Router();

/**
 * @swagger
 * /api/projects:
 *   post:
 *     summary: Create a new project
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               methodology:
 *                 type: string
 *     responses:
 *       201:
 *         description: Project created successfully
 *       400:
 *         description: Validation error
 */
// Get sample projects - checks feature flag based on user role
router.get('/samples', async (req, res, next) => {
  try {
    // Determine user role (from auth token if present, otherwise 'public')
    let userRole = 'public';
    let userId: string | undefined;
    
    // Try to get user from auth token (optional auth)
    try {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        const jwt = await import('jsonwebtoken');
        const { JWT_SECRET } = await import('../config/env.js');
        const decoded = jwt.default.verify(token, JWT_SECRET || 'your-secret-key') as any;
        userRole = decoded.role?.toLowerCase().trim() || 'public';
        userId = decoded.id || decoded.email;
      }
    } catch (authError) {
      // Auth is optional for this endpoint - continue as public
    }

    // Check feature flag for viewing sample projects
    const { isFeatureEnabled } = await import('../services/featureFlags.service.js');
    const canViewSamples = await isFeatureEnabled('viewing_sample_projects', userRole);

    if (!canViewSamples) {
      // User doesn't have permission - return empty array
      res.json({
        success: true,
        data: {
          projects: []
        }
      });
      return;
    }

    // Fetch sample projects
    const sampleProjects = await Project.find({ isSample: true })
      .select('name description currentPhase methodology createdAt userId')
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    res.json({
      success: true,
      data: {
        projects: sampleProjects.map(p => ({
          id: p._id.toString(),
          name: p.name,
          description: p.description,
          phase: p.currentPhase,
          methodology: p.methodology,
          createdAt: p.createdAt,
          userId: p.userId, // Include userId so frontend can check ownership
          isOwner: userId ? p.userId === userId : false
        }))
      }
    });
  } catch (error) {
    next(error);
  }
});

// All other routes require authentication
router.use(authenticateToken);

// Get all projects for user (or all projects if user has view_all_projects permission)
router.get('/', async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.id;
    const userRole = (req.user as any)?.role?.toLowerCase().trim() || 'user';
    
    // Check if user has permission to view all projects
    const { isFeatureEnabled } = await import('../services/featureFlags.service.js');
    const canViewAllProjects = await isFeatureEnabled('view_all_projects', userRole);
    
    let projects;
    
    if (canViewAllProjects) {
      // User has permission to view all projects - return all projects
      projects = await Project.find({})
        .sort({ lastModified: -1 })
        .select('name description currentPhase currentSprint methodology lastModified createdAt userId')
        .lean();
      
      // Add isOwner flag for each project
      projects = projects.map((p: any) => ({
        ...p,
        _id: p._id.toString(),
        isOwner: p.userId === userId
      }));
    } else {
      // User can only view their own projects
      projects = await Project.find({ userId: userId })
        .sort({ lastModified: -1 })
        .select('name description currentPhase currentSprint methodology lastModified createdAt userId')
        .lean();
      
      // Add isOwner flag (always true for own projects)
      projects = projects.map((p: any) => ({
        ...p,
        _id: p._id.toString(),
        isOwner: true
      }));
    }

    res.json({
      success: true,
      data: { projects }
    });
  } catch (error) {
    next(error);
  }
});

// Get single project - allows viewing own projects, sample projects (if user has permission), or any project (if user has view_all_projects permission)
router.get('/:id', async (req: AuthRequest, res, next) => {
  try {
    const projectId = req.params.id;
    const userId = req.user!.id;
    const userRole = (req.user as any)?.role?.toLowerCase().trim() || 'user';
    
    // Validate ObjectId format
    const mongoose = await import('mongoose');
    if (!mongoose.default.Types.ObjectId.isValid(projectId)) {
      logger.warn(`Invalid project ID format: ${projectId}`);
      throw new AppError('Invalid project ID format', 400);
    }
    
    // Check if user has permission to view all projects
    const { isFeatureEnabled } = await import('../services/featureFlags.service.js');
    const canViewAllProjects = await isFeatureEnabled('view_all_projects', userRole);
    
    let project;
    
    if (canViewAllProjects) {
      // User has permission to view all projects - find any project
      project = await Project.findById(projectId);
    } else {
      // First, try to find project owned by user
      project = await Project.findOne({
        _id: projectId,
        userId: userId
      });

      // If not found and it's a sample project, check if user has permission to view samples
      if (!project) {
        const sampleProject = await Project.findOne({
          _id: projectId,
          isSample: true
        });

        if (sampleProject) {
          const canViewSamples = await isFeatureEnabled('viewing_sample_projects', userRole);

          if (canViewSamples) {
            project = sampleProject;
          }
        }
      }
    }

    if (!project) {
      // Debug: Check if project exists at all (for troubleshooting)
      const anyProject = await Project.findById(projectId).select('_id userId isSample').lean();
      
      if (anyProject) {
        // Project exists but user doesn't have access
        logger.warn(`Project access denied: ${projectId} (exists: yes, owner: ${anyProject.userId}, requester: ${userId}, role: ${userRole}, canViewAll: ${canViewAllProjects}, isSample: ${anyProject.isSample})`);
        throw new AppError('Project not found or access denied', 404);
      } else {
        // Project doesn't exist at all
        logger.warn(`Project not found: ${projectId} (user: ${userId}, role: ${userRole}, canViewAll: ${canViewAllProjects}) - Project does not exist in database`);
        throw new AppError('Project not found', 404);
      }
    }

    res.json({
      success: true,
      data: { project }
    });
  } catch (error) {
    next(error);
  }
});

// Create new project - protected by feature flag
router.post('/', checkFeatureAccess('project_creation'), validate(createProjectSchema), async (req: FeatureRequest, res, next) => {
  try {
    let projectData = {
      ...req.body,
      userId: req.user!.id,
      lastModified: new Date()
    };

    // RESEARCH-BASED: Auto-configure SDLC methodology and sprints based on project description
    // Always assign methodology and sprint estimates based on project characteristics
    // This ensures projects are assigned to the most relevant methodology automatically
    if (projectData.description && projectData.description.trim().length > 0) {
      try {
        const { sdlcMatchingService } = await import('../services/sdlcMatching.service.js');
        await sdlcMatchingService.initialize();
        
        const sdlcConfig = await sdlcMatchingService.autoConfigureSDLC({
          name: projectData.name || '',
          description: projectData.description || '',
          category: projectData.category,
          projectType: projectData.projectType,
          industry: projectData.industry,
          standards: projectData.selectedStandards,
          complexity: projectData.complexity,
          teamSize: projectData.teamSize,
          timeline: projectData.timeline,
          requirements: projectData.requirements,
        });
        
        // RESEARCH-BASED: Always assign methodology and sprint estimates based on project description
        // System automatically determines the best methodology based on project characteristics
        // This ensures projects are assigned to the most relevant methodology (V-Model, Agile, Waterfall)
        // Note: LangGraph is NOT an SDLC methodology - it's a framework for agent workflows
        // User-provided methodology is respected, but sprint estimates are always updated based on description
        
        // Always use system-recommended methodology if not explicitly provided
        if (!projectData.methodology) {
          projectData.methodology = sdlcConfig.methodology;
        }
        
        // Always update sprint estimates based on description analysis (research-based)
        projectData.estimatedSprints = sdlcConfig.estimatedSprints;
        
        // Always set initial sprint to 1
        if (!projectData.currentSprint) {
          projectData.currentSprint = 1;
        }
        
        // Ensure estimatedSprints is set if not provided
        if (!projectData.estimatedSprints) {
          projectData.estimatedSprints = sdlcConfig.estimatedSprints;
        }
        
        logger.info(`Auto-assigned methodology: ${projectData.methodology} (${projectData.estimatedSprints} sprints) for project: ${projectData.name}`);
      } catch (sdlcError: any) {
        // Don't fail project creation if SDLC configuration fails, but log warning
        logger.warn('SDLC auto-configuration failed for new project:', sdlcError.message);
        // Set defaults if auto-configuration fails
        if (!projectData.methodology) {
          projectData.methodology = 'V-Model'; // Default fallback
        }
        if (!projectData.estimatedSprints) {
          projectData.estimatedSprints = 7; // Research: Industry average 6.8 sprints (rounded to 7)
        }
        if (!projectData.currentSprint) {
          projectData.currentSprint = 1;
        }
      }
    } else {
      // If no description provided, set defaults
      if (!projectData.methodology) {
        projectData.methodology = 'V-Model';
      }
      if (!projectData.estimatedSprints) {
        projectData.estimatedSprints = 7; // Research: Industry average
      }
      if (!projectData.currentSprint) {
        projectData.currentSprint = 1;
      }
    }

    // RESEARCH-BASED: Auto-enroll quality standards based on project description
    // Always assign relevant standards based on project characteristics (industry, type, complexity)
    // This ensures projects are executed and audited according to appropriate compliance standards
    if (projectData.description && projectData.description.trim().length > 0) {
      try {
        const { standardsMatchingService } = await import('../services/standardsMatching.service.js');
        await standardsMatchingService.initialize();
        
        const enrolled = await standardsMatchingService.autoEnrollStandards({
          name: projectData.name || '',
          description: projectData.description || '',
          methodology: projectData.methodology,
          category: projectData.category,
          projectType: projectData.projectType,
          industry: projectData.industry,
          region: projectData.region,
          tags: projectData.tags,
          complexity: projectData.complexity, // Pass complexity for security/safety detection
        }, {
          autoEnrollRequired: true,
          autoEnrollRecommended: true,
          maxStandards: 8, // Increased to allow more comprehensive standard coverage
        });
        
        // RESEARCH-BASED: Always assign standards based on description analysis
        // Override user-provided standards only if description suggests different ones
        if (!projectData.selectedStandards || projectData.selectedStandards.length === 0) {
          projectData.selectedStandards = enrolled;
        } else {
          // Merge user-provided standards with auto-enrolled ones (avoid duplicates)
          const merged = [...new Set([...projectData.selectedStandards, ...enrolled])];
          projectData.selectedStandards = merged;
        }
        
        logger.info(`Auto-assigned ${enrolled.length} standards for project: ${projectData.name}`, {
          standards: enrolled,
          total: projectData.selectedStandards.length
        });
      } catch (standardsError: any) {
        // Don't fail project creation if standards enrollment fails, but log warning
        logger.warn('Standards auto-enrollment failed for new project:', standardsError.message);
        // Set empty array if auto-enrollment fails
        if (!projectData.selectedStandards) {
          projectData.selectedStandards = [];
        }
      }
    } else {
      // If no description provided, set empty array
      if (!projectData.selectedStandards) {
        projectData.selectedStandards = [];
      }
    }

    // RESEARCH-BASED: Auto-analyze project architecture to determine backend/admin panel needs
    // Automatically detects if project needs backend API and admin control panel
    // This ensures complete software development service with all necessary components
    if (projectData.description && projectData.description.trim().length > 0) {
      try {
        const { projectArchitectureAnalyzer } = await import('../services/projectArchitectureAnalyzer.service.js');
        await projectArchitectureAnalyzer.initialize();
        
        const architecture = await projectArchitectureAnalyzer.analyzeArchitecture({
          name: projectData.name || '',
          description: projectData.description || '',
          category: projectData.category,
          projectType: projectData.projectType,
          industry: projectData.industry,
          requirements: projectData.requirements,
          complexity: projectData.complexity
        });
        
        // Store architecture analysis in project
        projectData.architecture = architecture;
        
        logger.info(`Architecture analysis complete for project: ${projectData.name}`, {
          needsBackend: architecture.needsBackend,
          needsAdminPanel: architecture.needsAdminPanel,
          needsMobileApp: architecture.needsMobileApp,
          backendType: architecture.backendType,
          adminPanelType: architecture.adminPanelType,
          mobileAppType: architecture.mobileAppType,
          confidence: architecture.confidence
        });
      } catch (archError: any) {
        // Don't fail project creation if architecture analysis fails
        logger.warn('Architecture analysis failed for new project:', archError.message);
        // Set default architecture
        projectData.architecture = {
          needsBackend: false,
          needsAdminPanel: false,
          needsMobileApp: false,
          backendType: 'REST',
          adminPanelType: 'Web Dashboard',
          mobileAppType: 'react-native',
          reasoning: 'Analysis unavailable',
          confidence: 0.5
        };
      }
    } else {
      // If no description provided, set default architecture
      projectData.architecture = {
        needsBackend: false,
        needsAdminPanel: false,
        needsMobileApp: false,
        backendType: 'REST',
        adminPanelType: 'Web Dashboard',
        mobileAppType: 'react-native',
        reasoning: 'No description provided',
        confidence: 0.5
      };
    }

    const project = await Project.create(projectData);

    // Auto-discover agents from new project
    try {
      const { agentDiscovery } = await import('../services/agentDiscovery.service.js');
      await agentDiscovery.processProject(project._id.toString());
    } catch (discoveryError: any) {
      // Don't fail project creation if discovery fails
      logger.warn('Agent discovery failed for new project:', discoveryError.message);
    }

    // Auto-create backend and admin panel tasks if needed
    if (project.architecture?.needsBackend || project.architecture?.needsAdminPanel) {
      try {
        await createArchitectureTasks(project);
      } catch (taskError: any) {
        // Don't fail project creation if task creation fails
        logger.warn('Failed to create architecture tasks:', taskError.message);
      }
    }

    res.status(201).json({
      success: true,
      data: { project }
    });
  } catch (error) {
    next(error);
  }
});

// Update project
router.put('/:id', validate(updateProjectSchema), async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.id;
    const projectId = req.params.id;
    
    // ENFORCEMENT: Check artifact limits if artifacts are being added
    if (req.body.artifacts && Array.isArray(req.body.artifacts)) {
      const project = await Project.findById(projectId);
      if (project && project.userId === userId) {
        const currentArtifacts = project.artifacts || [];
        const newArtifacts = req.body.artifacts;
        const additionalCount = newArtifacts.length - currentArtifacts.length;
        
        if (additionalCount > 0) {
          // Get only the new artifacts (those not in current list)
          const artifactsToAdd = newArtifacts.slice(currentArtifacts.length);
          await validateArtifactsArray(userId, projectId, artifactsToAdd);
        }
      }
    }
    
    const updateData: any = {
      ...req.body,
      lastModified: new Date()
    };

    // Remove legacy 'phase' field if present (use currentPhase instead)
    if ('phase' in updateData) {
      delete updateData.phase;
    }

    // RESEARCH-BASED: Auto-update SDLC if description changed significantly
    // Re-evaluate methodology and sprint estimates when project description is updated
    if (req.body.description && req.body.description.trim().length > 0) {
      try {
        const project = await Project.findOne({
          _id: req.params.id,
          userId: req.user!.id
        });

        if (project) {
          const { sdlcMatchingService } = await import('../services/sdlcMatching.service.js');
          await sdlcMatchingService.initialize();
          
          const sdlcConfig = await sdlcMatchingService.autoConfigureSDLC({
            name: req.body.name || project.name,
            description: req.body.description || project.description,
            category: req.body.category || project.category,
            projectType: req.body.projectType,
            industry: req.body.industry,
            standards: req.body.selectedStandards || project.selectedStandards,
            complexity: req.body.complexity,
            teamSize: req.body.teamSize,
            timeline: req.body.timeline,
            requirements: req.body.requirements,
          });
          
          // RESEARCH-BASED: Always update methodology and sprint estimates when description changes
          // System automatically re-evaluates project characteristics based on updated description
          // This ensures projects stay aligned with best practices as they evolve
          
          // Update methodology if not explicitly provided in update request
          if (!req.body.methodology) {
            updateData.methodology = sdlcConfig.methodology;
          }
          
          // Always update sprint estimates based on description analysis (research-based)
          updateData.estimatedSprints = sdlcConfig.estimatedSprints;
          
          if (!updateData.currentSprint) {
            updateData.currentSprint = project.currentSprint || 1;
          }
          
          logger.info(`Auto-updated methodology: ${updateData.methodology} (${updateData.estimatedSprints} sprints) for project: ${project.name}`);
        }
      } catch (sdlcError: any) {
        logger.warn('SDLC auto-configuration failed for project update:', sdlcError.message);
        // Don't fail update if SDLC configuration fails
      }
    }

    // RESEARCH-BASED: Auto-update standards when description changes significantly
    // Re-evaluate and assign relevant standards based on updated project description
    if (req.body.description && req.body.description.trim().length > 0) {
      try {
        const project = await Project.findOne({
          _id: req.params.id,
          userId: req.user!.id
        });

        if (project) {
          const { standardsMatchingService } = await import('../services/standardsMatching.service.js');
          await standardsMatchingService.initialize();
          
          const enrolled = await standardsMatchingService.autoEnrollStandards({
            name: req.body.name || project.name,
            description: req.body.description || project.description,
            methodology: req.body.methodology || project.methodology,
            category: req.body.category || project.category,
            projectType: req.body.projectType,
            industry: req.body.industry,
            region: req.body.region,
            tags: req.body.tags,
            complexity: req.body.complexity, // Pass complexity for security/safety detection
          }, {
            autoEnrollRequired: true,
            autoEnrollRecommended: true,
            maxStandards: 8, // Increased for comprehensive coverage
          });
          
          // RESEARCH-BASED: Update standards if not explicitly set in update request
          // Merge with existing standards to preserve user selections
          if (!req.body.selectedStandards) {
            // Merge existing standards with newly enrolled ones (avoid duplicates)
            const existingStandards = project.selectedStandards || [];
            const merged = [...new Set([...existingStandards, ...enrolled])];
            updateData.selectedStandards = merged;
          } else {
            // User explicitly set standards, but still merge with auto-enrolled for completeness
            const merged = [...new Set([...req.body.selectedStandards, ...enrolled])];
            updateData.selectedStandards = merged;
          }
          
          logger.info(`Auto-updated standards: ${enrolled.length} new standards for project: ${project.name}`, {
            newStandards: enrolled,
            total: updateData.selectedStandards.length
          });
        }
      } catch (standardsError: any) {
        // Don't fail project update if standards enrollment fails
        logger.warn('Standards auto-enrollment failed for project update:', standardsError.message);
      }
    }

    // ENFORCEMENT: Validate artifact limits before updating if artifacts are being modified
    if (updateData.artifacts && Array.isArray(updateData.artifacts)) {
      const currentProject = await Project.findById(req.params.id);
      if (currentProject && currentProject.userId === req.user!.id) {
        const currentArtifacts = currentProject.artifacts || [];
        const newArtifacts = updateData.artifacts;
        const additionalCount = newArtifacts.length - currentArtifacts.length;
        
        if (additionalCount > 0) {
          // Get only the new artifacts (those not in current list)
          const artifactsToAdd = newArtifacts.slice(currentArtifacts.length);
          await validateArtifactsArray(req.user!.id, req.params.id, artifactsToAdd);
        }
      }
    }

    const project = await Project.findOneAndUpdate(
      {
        _id: req.params.id,
        userId: req.user!.id
      },
      updateData,
      { new: true, runValidators: true }
    );

    if (!project) {
      throw new AppError('Project not found', 404);
    }

    // Auto-discover new agents if agents array was updated
    if (req.body.agents && Array.isArray(req.body.agents)) {
      try {
        const { agentDiscovery } = await import('../services/agentDiscovery.service.js');
        await agentDiscovery.processProject(project._id.toString());
      } catch (discoveryError: any) {
        // Don't fail project update if discovery fails
        logger.warn('Agent discovery failed for project update:', discoveryError.message);
      }
    }

    res.json({
      success: true,
      data: { project }
    });
  } catch (error) {
    next(error);
  }
});

// Delete project - protected by feature flag
// Allows owner to delete their own projects, or admin with view_all_projects to delete any project
// Superadmin can delete any project
router.delete('/:id', async (req: FeatureRequest, res, next) => {
  try {
    // Inline feature check - alternative to middleware approach
    await requireFeatureAccess(req, 'project_deletion');

    const projectId = req.params.id;
    const userId = req.user!.id;
    const userRole = (req.user as any)?.role?.toLowerCase().trim() || 'user';
    const isSuperadmin = userRole === 'superadmin';

    // Check if user has permission to view all projects (admin privilege)
    const { isFeatureEnabled } = await import('../services/featureFlags.service.js');
    const canViewAllProjects = await isFeatureEnabled('view_all_projects', userRole);

    // Find project - check if owned by user or if user has admin privilege
    let project = await Project.findOne({
      _id: projectId,
      userId: userId
    });

    // If not found and (user has view_all_projects permission OR is superadmin), try to find any project
    if (!project && (canViewAllProjects || isSuperadmin)) {
      project = await Project.findOne({
        _id: projectId
      });
    }

    if (!project) {
      throw new AppError('Project not found or you do not have permission to delete it', 404);
    }

    // Delete the project
    // Owner can always delete their own projects
    // Admin with view_all_projects can delete any project
    // Superadmin can delete any project
    await Project.findByIdAndDelete(projectId);

    res.json({
      success: true,
      message: 'Project deleted successfully'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/projects/:id/share
 * Create a share link for a project
 */
router.post('/:id/share', async (req: FeatureRequest, res, next) => {
  try {
    const projectId = req.params.id;
    const userId = req.user!.id;
    const { expiresInDays } = req.body; // Optional: expiration in days

    const project = await Project.findOne({ _id: projectId, userId });

    if (!project) {
      throw new AppError('Project not found', 404);
    }

    // Generate unique token
    const token = require('crypto').randomBytes(32).toString('hex');
    const expiresAt = expiresInDays 
      ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
      : null;

    // Initialize shareTokens array if it doesn't exist
    if (!project.shareTokens) {
      project.shareTokens = [];
    }

    const shareLink = {
      token,
      createdAt: new Date(),
      expiresAt,
      accessCount: 0
    };

    project.shareTokens.push(shareLink);
    await project.save();

    res.json({
      success: true,
      data: {
        shareLink: {
          token,
          url: `${req.protocol}://${req.get('host')}/share/${token}`,
          expiresAt: expiresAt ? expiresAt.toISOString() : null,
          createdAt: shareLink.createdAt.toISOString()
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/projects/:id/share
 * Get all share links for a project
 */
router.get('/:id/share', async (req: FeatureRequest, res, next) => {
  try {
    const projectId = req.params.id;
    const userId = req.user!.id;

    const project = await Project.findOne({ _id: projectId, userId }).select('shareTokens');

    if (!project) {
      throw new AppError('Project not found', 404);
    }

    const shareLinks = (project.shareTokens || []).map((link: any) => ({
      token: link.token,
      url: `${req.protocol}://${req.get('host')}/share/${link.token}`,
      createdAt: link.createdAt,
      expiresAt: link.expiresAt,
      accessCount: link.accessCount || 0,
      isExpired: link.expiresAt ? new Date(link.expiresAt) < new Date() : false
    }));

    res.json({
      success: true,
      data: { shareLinks }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/projects/:id/share/:token
 * Delete a share link
 */
router.delete('/:id/share/:token', async (req: FeatureRequest, res, next) => {
  try {
    const projectId = req.params.id;
    const userId = req.user!.id;
    const token = req.params.token;

    const project = await Project.findOne({ _id: projectId, userId });

    if (!project) {
      throw new AppError('Project not found', 404);
    }

    if (!project.shareTokens || project.shareTokens.length === 0) {
      throw new AppError('No share links found', 404);
    }

    project.shareTokens = project.shareTokens.filter((link: any) => link.token !== token);
    await project.save();

    res.json({
      success: true,
      message: 'Share link deleted successfully'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/projects/share/:token
 * Get a project by share token (public endpoint)
 */
router.get('/share/:token', async (req, res, next) => {
  try {
    const token = req.params.token;

    const project = await Project.findOne({
      'shareTokens.token': token
    }).lean();

    if (!project) {
      throw new AppError('Share link not found or invalid', 404);
    }

    // Find the specific share token
    const shareToken = project.shareTokens?.find((link: any) => link.token === token);

    if (!shareToken) {
      throw new AppError('Share link not found', 404);
    }

    // Check if expired
    if (shareToken.expiresAt && new Date(shareToken.expiresAt) < new Date()) {
      throw new AppError('Share link has expired', 410);
    }

    // Increment access count
    await Project.updateOne(
      { _id: project._id, 'shareTokens.token': token },
      { $inc: { 'shareTokens.$.accessCount': 1 } }
    );

    res.json({
      success: true,
      data: { project }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/projects/import
 * Import a project from JSON or ZIP file - protected by project_import feature flag
 */
router.post('/import', checkFeatureAccess('project_import'), async (req: FeatureRequest, res, next) => {
  try {
    const userId = req.user!.id;
    const { projectData, importMode } = req.body; // importMode: 'create' | 'merge' | 'overwrite'
    
    if (!projectData) {
      throw new AppError('Project data is required', 400);
    }

    // Validate project structure
    if (!projectData.name || typeof projectData.name !== 'string') {
      throw new AppError('Invalid project data: name is required', 400);
    }

    // Prepare project data for import
    const importData: any = {
      userId: userId,
      name: projectData.name,
      description: projectData.description || '',
      currentPhase: projectData.currentPhase || projectData.phase || 'Initiation',
      currentSprint: projectData.currentSprint || 1,
      methodology: projectData.methodology || 'V-Model',
      estimatedSprints: projectData.estimatedSprints || projectData.estimatedSprints || 7,
      agents: Array.isArray(projectData.agents) ? projectData.agents : [],
      tasks: Array.isArray(projectData.tasks) ? projectData.tasks : [],
      artifacts: Array.isArray(projectData.artifacts) ? projectData.artifacts : [],
      logs: Array.isArray(projectData.logs) ? projectData.logs : [],
      selectedStandards: Array.isArray(projectData.selectedStandards) ? projectData.selectedStandards : [],
      useInternet: projectData.useInternet || false,
      budget: projectData.budget || { cap: 1000, spent: 0 },
      mcpServers: Array.isArray(projectData.mcpServers) ? projectData.mcpServers : [],
      lastModified: new Date(),
      isSample: false, // Imported projects are never samples
      shareTokens: [] // Clear share tokens on import
    };

    // Handle import mode
    let project;
    if (importMode === 'merge' && projectData.id) {
      // Merge with existing project
      const existingProject = await Project.findOne({
        _id: projectData.id,
        userId: userId
      });

      if (!existingProject) {
        throw new AppError('Project not found for merge', 404);
      }

      // Merge data (prefer existing data, add new items)
      project = await Project.findOneAndUpdate(
        { _id: projectData.id, userId: userId },
        {
          name: importData.name, // Update name
          description: importData.description || existingProject.description,
          currentPhase: importData.currentPhase,
          currentSprint: importData.currentSprint,
          methodology: importData.methodology || existingProject.methodology,
          estimatedSprints: importData.estimatedSprints || existingProject.estimatedSprints,
          agents: [...(existingProject.agents || []), ...importData.agents.filter((a: any) => 
            !existingProject.agents.some((ea: any) => ea.id === a.id || ea.role === a.role)
          )],
          tasks: [...(existingProject.tasks || []), ...importData.tasks.filter((t: any) => 
            !existingProject.tasks.some((et: any) => et.id === t.id)
          )],
          artifacts: [...(existingProject.artifacts || []), ...importData.artifacts.filter((a: any) => 
            !existingProject.artifacts.some((ea: any) => ea.id === a.id)
          )],
          logs: [...(existingProject.logs || []), ...importData.logs],
          selectedStandards: [...new Set([...(existingProject.selectedStandards || []), ...importData.selectedStandards])],
          useInternet: importData.useInternet || existingProject.useInternet,
          budget: {
            cap: Math.max(importData.budget.cap, existingProject.budget.cap),
            spent: existingProject.budget.spent + importData.budget.spent
          },
          mcpServers: [...(existingProject.mcpServers || []), ...importData.mcpServers.filter((m: any) => 
            !existingProject.mcpServers.some((em: any) => em.id === m.id)
          )],
          lastModified: new Date()
        },
        { new: true, runValidators: true }
      );
    } else if (importMode === 'overwrite' && projectData.id) {
      // Overwrite existing project
      const existingProject = await Project.findOne({
        _id: projectData.id,
        userId: userId
      });

      if (!existingProject) {
        throw new AppError('Project not found for overwrite', 404);
      }

      project = await Project.findOneAndUpdate(
        { _id: projectData.id, userId: userId },
        importData,
        { new: true, runValidators: true }
      );
    } else {
      // Create new project (default)
      project = await Project.create(importData);
    }

    // Auto-discover agents from imported project
    try {
      const { agentDiscovery } = await import('../services/agentDiscovery.service.js');
      await agentDiscovery.processProject(project._id.toString());
    } catch (discoveryError: any) {
      // Don't fail import if discovery fails
      logger.warn('Agent discovery failed for imported project:', discoveryError.message);
    }

    res.status(201).json({
      success: true,
      data: { project },
      message: importMode === 'merge' ? 'Project merged successfully' : 
               importMode === 'overwrite' ? 'Project overwritten successfully' : 
               'Project imported successfully'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Helper function to create backend and admin panel tasks
 */
async function createArchitectureTasks(project: any): Promise<void> {
  const tasks: any[] = [];
  const architecture = project.architecture;

  if (!architecture) return;

  // Create backend task if needed
  if (architecture.needsBackend) {
    const backendTaskId = `backend-${Date.now()}`;
    const backendTask = {
      id: backendTaskId,
      title: `Develop ${architecture.backendType || 'REST'} Backend API`,
      description: `Create backend API for ${project.name}. ${architecture.reasoning || ''}`,
      phase: 'Design', // Backend design typically happens in Design phase
      status: 'pending',
      priority: 'high',
      assignedAgent: 'Implementation Agent',
      estimatedHours: architecture.detectedFeatures?.apiEndpoints ? 40 : 20,
      dependencies: [],
      logs: [],
      progress: 0,
      tags: ['backend', 'api', architecture.backendType?.toLowerCase() || 'rest'],
      // Initialize evaluation with pending status (will be calculated when task is executed)
      evaluation: {
        score: 0,
        reasoning: 'Quality score will be calculated when task is executed.',
        criteria: [],
        timestamp: Date.now()
      },
      metadata: {
        architectureType: 'backend',
        backendType: architecture.backendType,
        framework: architecture.recommendations?.backend?.framework,
        database: architecture.recommendations?.backend?.database,
        authentication: architecture.recommendations?.backend?.authentication,
        deployment: architecture.recommendations?.backend?.deployment,
        features: Object.entries(architecture.detectedFeatures || {})
          .filter(([_, needed]) => needed)
          .map(([feature]) => feature)
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };
    tasks.push(backendTask);

    // Create admin panel task if needed (depends on backend)
    if (architecture.needsAdminPanel) {
      const adminTask = {
        id: `admin-${Date.now()}`,
        title: `Develop ${architecture.adminPanelType || 'Web Dashboard'} Admin Panel`,
        description: `Create admin control panel for ${project.name}. ${architecture.reasoning || ''}`,
        phase: 'Design',
        status: 'pending',
        priority: 'high',
        assignedAgent: 'UX Designer',
        estimatedHours: 30,
        dependencies: [backendTaskId], // Admin panel depends on backend
        logs: [],
        progress: 0,
        tags: ['admin', 'dashboard', 'control-panel', architecture.adminPanelType?.toLowerCase().replace(' ', '-') || 'web-dashboard'],
        // Initialize evaluation with pending status (will be calculated when task is executed)
        evaluation: {
          score: 0,
          reasoning: 'Quality score will be calculated when task is executed.',
          criteria: [],
          timestamp: Date.now()
        },
        metadata: {
          architectureType: 'admin-panel',
          adminPanelType: architecture.adminPanelType,
          framework: architecture.recommendations?.adminPanel?.framework,
          features: architecture.recommendations?.adminPanel?.features || []
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };
      tasks.push(adminTask);
    }
  } else if (architecture.needsAdminPanel) {
    // Admin panel without backend (standalone)
    const adminTask = {
      id: `admin-${Date.now()}`,
      title: `Develop ${architecture.adminPanelType || 'Web Dashboard'} Admin Panel`,
      description: `Create admin control panel for ${project.name}. ${architecture.reasoning || ''}`,
      phase: 'Design',
      status: 'pending',
      priority: 'medium',
      assignedAgent: 'UX Designer',
      estimatedHours: 30,
      dependencies: [],
      logs: [],
      progress: 0,
      tags: ['admin', 'dashboard', 'control-panel', architecture.adminPanelType?.toLowerCase().replace(' ', '-') || 'web-dashboard'],
      // Initialize evaluation with pending status (will be calculated when task is executed)
      evaluation: {
        score: 0,
        reasoning: 'Quality score will be calculated when task is executed.',
        criteria: [],
        timestamp: Date.now()
      },
      metadata: {
        architectureType: 'admin-panel',
        adminPanelType: architecture.adminPanelType,
        framework: architecture.recommendations?.adminPanel?.framework,
        features: architecture.recommendations?.adminPanel?.features || []
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };
    tasks.push(adminTask);
  }

    // Add tasks to project if any were created
    if (tasks.length > 0) {
      const updatedTasks = [...(project.tasks || []), ...tasks];
      await Project.findByIdAndUpdate(
        project._id,
        { 
          tasks: updatedTasks,
          status: 'in-progress', // Update status when tasks are created
          lastModified: new Date()
        },
        { new: true }
      );

      logger.info(`Created ${tasks.length} architecture task(s) for project: ${project.name}`, {
        backendTask: architecture.needsBackend,
        adminTask: architecture.needsAdminPanel
      });

      // Check if all tasks are already completed (edge case)
      try {
        await autoCompletionService.checkAndCompleteProject(project._id.toString());
      } catch (completionError: any) {
        logger.warn(`Auto-completion check failed after task creation: ${completionError.message}`);
      }
    }
}

/**
 * POST /api/projects/:id/export-report
 * Export project report in PDF or Word format - protected by export_reports feature flag
 */
router.post('/:id/export-report', checkFeatureAccess('export_reports'), async (req: FeatureRequest, res, next) => {
  try {
    const projectId = req.params.id;
    const userId = req.user!.id;
    const { format, includeTasks, includeArtifacts, includeLogs, includeAgents, title } = req.body;

    if (!format || !['pdf', 'docx'].includes(format)) {
      throw new AppError('Format must be either "pdf" or "docx"', 400);
    }

    const { generateProjectReport } = await import('../services/reportService.js');
    
    const reportBuffer = await generateProjectReport(projectId, userId, {
      format: format as 'pdf' | 'docx',
      includeTasks: includeTasks !== false, // Default to true
      includeArtifacts: includeArtifacts !== false,
      includeLogs: includeLogs !== false,
      includeAgents: includeAgents !== false,
      title: title,
    });

    const project = await Project.findById(projectId).select('name').lean();
    const projectName = project?.name || 'project';
    const sanitizedName = projectName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const filename = `${sanitizedName}_report_${Date.now()}.${format}`;

    res.setHeader('Content-Type', format === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(reportBuffer);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/projects/:id/package
 * Package project with all deployment configs, build scripts, and documentation
 */
router.post('/:id/package', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const projectId = req.params.id;
    const userId = req.user?.id || '';

    // Verify project exists and user has access
    const project = await Project.findOne({ _id: projectId, userId });
    if (!project) {
      throw new AppError('Project not found or access denied', 404);
    }

    logger.info(`Packaging project: ${projectId}`);

    // Package project
    const packageResult = await projectPackagerService.packageProject(projectId);

    // Send ZIP file
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${packageResult.metadata.projectName.replace(/\s+/g, '-')}-package.zip"`);
    res.send(packageResult.zipBuffer);
  } catch (error: any) {
    logger.error('Project packaging failed:', error);
    next(error);
  }
});

/**
 * POST /api/projects/:id/complete
 * Complete a project - finalize with documentation, packaging, and quality checks
 */
router.post('/:id/complete', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const projectId = req.params.id;
    const userId = req.user?.id || '';
    const { 
      runQualityGates = true,
      generateDocumentation = true,
      generatePackage = true,
      refineCode = true,
      generateTests = true,
      qualityThreshold = 85
    } = req.body;

    // Verify project exists and user has access
    const project = await Project.findOne({ _id: projectId, userId });
    if (!project) {
      throw new AppError('Project not found or access denied', 404);
    }

    logger.info(`Completing project: ${projectId} for user: ${userId}`);

    // Complete project
    const completionResult = await projectCompletionService.completeProject(projectId, {
      runQualityGates,
      generateDocumentation,
      generatePackage,
      refineCode,
      generateTests,
      qualityThreshold
    });

    // Update project status
    await Project.findByIdAndUpdate(projectId, {
      status: completionResult.deploymentReady ? 'completed' : 'in-progress',
      completedAt: completionResult.success ? new Date() : undefined,
      lastModified: new Date()
    });

    res.json({
      success: completionResult.success,
      completion: completionResult,
      message: completionResult.deploymentReady 
        ? 'Project completed successfully and ready for deployment'
        : 'Project completion finished with warnings'
    });
  } catch (error: any) {
    logger.error('Project completion failed:', error);
    next(error);
  }
});

export default router;

