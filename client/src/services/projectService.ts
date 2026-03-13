import { ProjectState } from '@orbitai/shared';
import { ProjectMetadata } from '@orbitai/shared';
import { projectsApi } from '@src/services/api';
import { projectStorage, isValidObjectId, generateObjectId } from './projectStorage';
import { INITIAL_BUDGET } from '@orbitai/shared';
import { Phase } from '@orbitai/shared';

/**
 * Project Service - Handles all project CRUD operations
 * Extracted from App.tsx to centralize project management logic
 */
export const projectService = {
  /**
   * Load a project by ID
   */
  async loadProject(projectId: string, userId?: string): Promise<ProjectState | null> {
    const hasValidMongoId = /^[0-9a-fA-F]{24}$/.test(projectId);

    // Try to load from database first if user is logged in and ID is valid
    if (userId && hasValidMongoId) {
      try {
        const dbProject = await projectsApi.getById(projectId);
        if (dbProject) {
          // Convert database project to ProjectState format
          const loadedState: ProjectState = {
            id: dbProject._id || dbProject.id,
            name: dbProject.name,
            description: dbProject.description || '',
            created: new Date(dbProject.createdAt || Date.now()).getTime(),
            lastModified: new Date(dbProject.lastModified || Date.now()).getTime(),
            userId: dbProject.userId,
            currentPhase: dbProject.currentPhase || Phase.INITIATION,
            currentSprint: dbProject.currentSprint || 1,
            methodology: dbProject.methodology || 'V-Model',
            estimatedSprints: dbProject.estimatedSprints,
            agents: dbProject.agents || [],
            tasks: dbProject.tasks || [],
            artifacts: dbProject.artifacts || [],
            logs: dbProject.logs || [],
            isProcessing: false,
            useInternet: dbProject.useInternet || false,
            folderId: dbProject.folderId,
            selectedStandards: dbProject.selectedStandards || [],
            mcpServers: dbProject.mcpServers || [],
            budget: dbProject.budget || {
              total: INITIAL_BUDGET,
              used: 0,
              currency: 'USD',
              totalTokens: 0,
              lastUpdated: Date.now()
            },
            techStack: dbProject.techStack || [],
            selectedTheme: dbProject.selectedTheme || 'modern'
          };

          // Update cache immediately to prevent duplicate API calls
          // This ensures if projectStorage.getProject is called, it will use cache
          projectStorage.updateProjectCache(loadedState.id, loadedState);

          // Save to database asynchronously (non-blocking - fire and forget)
          projectStorage.saveProject(loadedState.id, loadedState).catch(err => {
            if (import.meta.env?.DEV) {
              console.warn('Failed to save project to database (non-critical):', err);
            }
          });
          return loadedState;
        }
      } catch (dbError: any) {
        // If project not found in database (404), try localStorage
        if (!dbError.message?.includes('404') && !dbError.message?.includes('not found')) {
          console.error('Database error loading project:', dbError);
        }
      }
    }

    // Fallback to projectStorage service
    return await projectStorage.getProject(projectId);
  },

  /**
   * Save a project
   */
  async saveProject(
    project: ProjectState,
    userId: string,
    userToken?: string
  ): Promise<string> {
    // Validate project ID
    if (!isValidObjectId(project.id)) {
      const newId = generateObjectId();
      project.id = newId;
    }

    // Ensure project has userId
    if (!project.userId) {
      project.userId = userId;
    }

    // Prepare project data for database
    const projectToSave = {
      ...project,
      tasks: Array.isArray(project.tasks) ? project.tasks : [],
      artifacts: Array.isArray(project.artifacts) ? project.artifacts : [],
      logs: Array.isArray(project.logs) ? project.logs : [],
      agents: Array.isArray(project.agents) ? project.agents : []
    };

    const hasValidMongoId = /^[0-9a-fA-F]{24}$/.test(project.id);
    const existingProject = await projectStorage.getProject(project.id);

    let savedProject;
    let newProjectId = project.id;

    if (navigator.onLine) {
      if (existingProject && hasValidMongoId) {
        // Update existing project
        try {
          savedProject = await projectsApi.update(project.id, {
            ...projectToSave,
            lastModified: new Date(projectToSave.lastModified || Date.now())
          });
        } catch (dbError: any) {
          if (dbError.status === 404) {
            // Project was deleted - create it instead
            savedProject = await projectsApi.create({
              ...projectToSave,
              lastModified: new Date(projectToSave.lastModified || Date.now())
            });
            newProjectId = savedProject._id || savedProject.id;
          } else {
            throw dbError;
          }
        }
      } else {
        // Create new project
        savedProject = await projectsApi.create({
          ...projectToSave,
          lastModified: new Date(projectToSave.lastModified || Date.now())
        });
        newProjectId = savedProject._id || savedProject.id;
      }
    }

    // Save to projectStorage as backup/cache
    await projectStorage.saveProject(newProjectId, projectToSave);

    return newProjectId;
  },

  /**
   * Delete a project
   */
  async deleteProject(projectId: string, userId: string): Promise<void> {
    const hasValidMongoId = /^[0-9a-fA-F]{24}$/.test(projectId);

    if (hasValidMongoId && navigator.onLine) {
      try {
        await projectsApi.delete(projectId);
      } catch (dbError: any) {
        if (dbError.status !== 404) {
          throw dbError;
        }
      }
    }

    // Always clean up from projectStorage
    await projectStorage.deleteProject(projectId);
  },

  /**
   * Get all projects for a user
   */
  async getAllProjects(userId: string): Promise<ProjectMetadata[]> {
    try {
      const dbProjects = await projectsApi.getAll();
      return dbProjects
        .filter((p: any) => p.userId === userId)
        .map((p: any) => ({
          id: p._id?.toString() || p.id,
          name: p.name,
          lastModified: p.lastModified ? new Date(p.lastModified).getTime() : Date.now(),
          description: (p.description || '').substring(0, 100),
          phase: p.currentPhase || Phase.INITIATION,
          userId: p.userId
        }))
        .sort((a, b) => b.lastModified - a.lastModified);
    } catch (error) {
      console.error('Failed to load projects from database:', error);
      // Fallback to projectStorage
      const metas = await projectStorage.getMetadataList();
      return metas
        .filter(p => p.userId === userId)
        .sort((a, b) => b.lastModified - a.lastModified);
    }
  }
};



