import { useCallback, useRef } from 'react';
import { ProjectState, ProjectAction } from '@orbitai/shared';
import { ProjectMetadata } from '@orbitai/shared';
import { projectService } from '../services/projectService';
import { createInitialProjectState } from '../reducers/projectReducer';
import { isValidObjectId } from '../services/projectStorage';
import { INITIAL_PROJECT_NAME, Phase, TaskStatus } from '@orbitai/shared';
import { toast } from '../services/toastService';

/**
 * Hook for project operations (load, save, delete, create)
 * Extracted from App.tsx to centralize project management
 */
export const useProjectOperations = (
  state: ProjectState,
  dispatch: React.Dispatch<ProjectAction>,
  user: { id: string; token?: string } | null,
  setViewMode: (mode: 'setup' | 'workspace') => void,
  setProjectList: React.Dispatch<React.SetStateAction<ProjectMetadata[]>>,
  setGlobalMessages: React.Dispatch<React.SetStateAction<any[]>>,
  setAutoPilotStatus: (status: 'idle' | 'running' | 'paused') => void,
  autoPilotStatusRef: React.MutableRefObject<'idle' | 'running' | 'paused'>,
  isStoppingRef: React.MutableRefObject<boolean>,
  isBatchingRef: React.MutableRefObject<boolean>,
  batchIntervalRef: React.MutableRefObject<ReturnType<typeof setInterval> | null>,
  activeTaskControllersRef: React.MutableRefObject<Map<string, AbortController>>,
  setSelectedTheme: (theme: string) => void,
  isProgrammaticHashChangeRef: React.MutableRefObject<boolean>
) => {
  const stateRef = useRef(state);
  const isManuallyLoadingProjectRef = useRef(false);

  // Update ref when state changes
  stateRef.current = state;

  const handleCreateNewProject = useCallback(() => {
    // Clear conversation state when starting a new project
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem('neuralChat_lastConversationId');
        // Remove conversation from URL
        const url = new URL(window.location.href);
        url.searchParams.delete('conversation');
        window.history.replaceState({}, '', url.toString());
      } catch (e) {
        // Ignore localStorage/URL errors
      }
    }

    // Reset HAND-OFF AI state when creating new project
    setAutoPilotStatus('idle');
    autoPilotStatusRef.current = 'idle';
    isStoppingRef.current = true;
    isBatchingRef.current = false;
    if (batchIntervalRef.current) {
      clearInterval(batchIntervalRef.current);
      batchIntervalRef.current = null;
    }
    activeTaskControllersRef.current.forEach(c => c.abort());
    activeTaskControllersRef.current.clear();
    dispatch({ type: 'SET_PROCESSING', payload: false });

    dispatch({ type: 'RESET_PROJECT', payload: createInitialProjectState(user?.id) });
    // P1 FIX: Removed redundant hash update - useViewMode handles hash sync
    setViewMode('setup');
  }, [user?.id, dispatch, setViewMode, setAutoPilotStatus, autoPilotStatusRef, isStoppingRef, isBatchingRef, batchIntervalRef, activeTaskControllersRef]);

  const handleLoadProject = useCallback(async (projectId: string) => {
    try {
      isManuallyLoadingProjectRef.current = true;

      const currentUserId = user?.id;
      const loadedState = await projectService.loadProject(projectId, currentUserId);

      if (loadedState) {
        // Verify project ownership
        if (loadedState.userId && currentUserId && loadedState.userId !== currentUserId) {
          toast.error("You don't have permission to access this project.");
          return;
        }

        // Ensure project has userId if user is logged in
        if (currentUserId && !loadedState.userId) {
          loadedState.userId = currentUserId;
        }

        // Ensure all required fields exist
        if (!loadedState.id) loadedState.id = projectId;
        if (!loadedState.currentSprint) loadedState.currentSprint = 1;
        if (!loadedState.methodology) loadedState.methodology = 'V-Model';
        if (!loadedState.selectedTheme) loadedState.selectedTheme = 'modern';

        // Ensure tasks and artifacts arrays exist
        if (!Array.isArray(loadedState.tasks)) loadedState.tasks = [];
        if (!Array.isArray(loadedState.artifacts)) loadedState.artifacts = [];

        // Map tasks to pause any in-progress ones
        loadedState.tasks = loadedState.tasks.map(t => {
          if (t.status === TaskStatus.IN_PROGRESS) {
            return {
              ...t,
              status: TaskStatus.PAUSED,
              logs: [...(t.logs || []), "[System] Session restored. Task paused due to interruption."]
            };
          }
          return t;
        });

        // Reset HAND-OFF AI state when loading a project
        setAutoPilotStatus('idle');
        autoPilotStatusRef.current = 'idle';
        isStoppingRef.current = true;
        isBatchingRef.current = false;
        if (batchIntervalRef.current) {
          clearInterval(batchIntervalRef.current);
          batchIntervalRef.current = null;
        }
        activeTaskControllersRef.current.forEach(c => c.abort());
        activeTaskControllersRef.current.clear();
        dispatch({ type: 'SET_PROCESSING', payload: false });

        // Update project state
        dispatch({ type: 'RESET_PROJECT', payload: loadedState });
        setSelectedTheme(loadedState.selectedTheme || 'modern');

        // Update URL with project ID
        isProgrammaticHashChangeRef.current = true;
        const url = new URL(window.location.href);
        url.hash = '#workspace';
        url.searchParams.set('project', projectId);
        window.history.replaceState({}, '', url.toString());

        // Store current project ID
        const { projectStorage } = await import('../services/projectStorage');
        projectStorage.setCurrentProjectId(projectId);

        if (user?.token && currentUserId) {
          try {
            const { updateUserSettings } = await import('../services/userSettingsApi');
            await updateUserSettings(user.token, { currentProjectId: projectId });
          } catch (settingsError) {
            console.warn('Failed to save currentProjectId to database:', settingsError);
          }
        }

        // Set global messages
        setGlobalMessages(prev => {
          const filtered = prev.filter(m => m.id !== 'welcome');
          return [{
            id: `project-loaded-${Date.now()}`,
            sender: 'system',
            text: `**Project Loaded: ${loadedState.name}**\nRestored state from ${new Date(loadedState.lastModified).toLocaleString()}.`,
            timestamp: Date.now(),
            isLogEvent: false
          }, ...filtered];
        });

        // Set workspace mode
        await new Promise(resolve => setTimeout(resolve, 50));
        setViewMode('workspace');

        // Clear the manual loading flag
        setTimeout(() => {
          isManuallyLoadingProjectRef.current = false;
          isProgrammaticHashChangeRef.current = false;
        }, 500);
      } else {
        toast.error("Project data not found!");
        isManuallyLoadingProjectRef.current = false;
      }
    } catch (e) {
      const isConnectionError = (e as any)?.message?.includes('Failed to fetch') || (e as any)?.message?.includes('ERR_CONNECTION_REFUSED');
      if (!isConnectionError && import.meta.env?.DEV) {
        console.debug("Failed to load project", e);
      }
      toast.error("Failed to load project file.");
      isManuallyLoadingProjectRef.current = false;
    }
  }, [user, dispatch, setViewMode, setAutoPilotStatus, autoPilotStatusRef, isStoppingRef, isBatchingRef, batchIntervalRef, activeTaskControllersRef, setSelectedTheme, isProgrammaticHashChangeRef, setGlobalMessages]);

  const handleDeleteProject = useCallback(async (projectId: string) => {
    if (!user?.id) {
      toast.error("You must be logged in to delete projects.");
      return;
    }

    try {
      await projectService.deleteProject(projectId, user.id);

      // Refresh project list
      const projects = await projectService.getAllProjects(user.id);
      setProjectList(projects);

      // If deleted project was current, navigate to hub
      if (state.id === projectId) {
        dispatch({ type: 'RESET_PROJECT', payload: createInitialProjectState(user.id) });
        // P1 FIX: Removed redundant hash update - useViewMode handles hash sync
        setViewMode('setup');
      }

      toast.success("Project deleted successfully");
    } catch (e) {
      console.error("Failed to delete project", e);
      toast.error("Failed to delete project. Please try again.");
    }
  }, [user, state.id, dispatch, setViewMode, setProjectList]);

  return {
    handleCreateNewProject,
    handleLoadProject,
    handleDeleteProject,
    isManuallyLoadingProjectRef
  };
};





