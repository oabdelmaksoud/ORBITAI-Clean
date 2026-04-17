/**
 * Project Management Handlers
 * Extracted from App.tsx to reduce component size
 * 
 * @module handlers/projectHandlers
 */

import { ProjectState, UserProfile, Agent, ChatMessage, INITIAL_BUDGET, ProjectMetadata, Phase, TaskStatus, AgentRole, QUALITY_STANDARDS } from '@orbitai/shared';
import { projectStorage, generateObjectId, isValidObjectId, cleanupProjectIdFromAllSources, isProjectNotFound } from '../services/projectStorage';
import { projectsApi } from '../services/api';
import { getSampleProjects } from '../services/sampleProjectsApi';
import { markProjectAsSample, unmarkProjectAsSample } from '../services/adminApi';
import { toast } from '../services/toastService';
import { INITIAL_PROJECT_NAME, INITIAL_PROJECT_DESC } from '@orbitai/shared';
import { secureSetItem, secureGetItem } from '../utils/secureStorage';

// Define dependencies required by project handlers
export interface ProjectHandlerDeps {
    // State refs 
    stateRef: React.MutableRefObject<ProjectState>;
    autoPilotStatusRef: React.MutableRefObject<string>;
    isStoppingRef: React.MutableRefObject<boolean>;
    isBatchingRef: React.MutableRefObject<boolean>;
    batchIntervalRef: React.MutableRefObject<NodeJS.Timeout | null>;
    activeTaskControllersRef: React.MutableRefObject<Map<string, AbortController>>;
    fixingInvalidIdRef: React.MutableRefObject<string | null>;

    // State setters & dispatchers
    dispatch: (action: any) => void;
    setViewMode: (mode: any) => void;
    setIsViewOnly: (isViewOnly: boolean) => void;
    setSharedProjectToken: (token: string | null) => void;
    setAutoPilotStatus: (status: any) => void;
    setGlobalMessages: (updater: (prev: ChatMessage[]) => ChatMessage[]) => void;
    setShowUserLogin: (show: boolean) => void;
    setProjectToDelete: (id: string | null) => void;
    setProjectList: (list: any[]) => void;
    setSampleProjects: (list: any[]) => void;
    setIsRenaming: (isRenaming: boolean) => void;
    addLog: (message: string, agentRole?: AgentRole, type?: 'info' | 'warning' | 'error' | 'success' | 'action', taskId?: string) => void;

    // Current state values
    user: UserProfile | null;
    viewMode: string;
    autoPilotStatus: string;
    projectList: any[];
    sampleProjects: any[];
    adminToken: string | null;
    tempName: string;
    canExportData: any; // FeatureAccessResult

    // Functions/Helpers
    isAdminUser: (user: UserProfile | null) => boolean;
    isFeatureEnabled: (feature: any) => boolean;
    showConfirmation: (title: string, message: string, type?: 'info' | 'confirm' | 'error' | 'success' | 'warning', confirmText?: string, cancelText?: string, confirmLabel?: string, cancelLabel?: string) => Promise<boolean>;

    // React utilities
    startTransition: (callback: () => void) => void;

    // Other handlers
    handleCreateNewProject: () => void;
}

/**
 * Create project handlers with provided dependencies
 */
export const createProjectHandlers = (deps: ProjectHandlerDeps) => {
    const {
        stateRef,
        dispatch,
        user,
        viewMode,
        setViewMode,
        startTransition,
        setIsViewOnly,
        setSharedProjectToken,
        setAutoPilotStatus,
        autoPilotStatusRef,
        isStoppingRef,
        isBatchingRef,
        batchIntervalRef,
        activeTaskControllersRef,
        setGlobalMessages,
        setShowUserLogin,
        projectList,
        handleCreateNewProject,
        fixingInvalidIdRef,
        setProjectToDelete,
        adminToken,
        isAdminUser,
        setProjectList,
        sampleProjects,
        setSampleProjects,
        canExportData,
        isFeatureEnabled,
        tempName,
        setIsRenaming,
        showConfirmation,
        addLog
    } = deps;

    /**
     * Save current project state to database or localStorage
     */
    const saveProject = async () => {
        const s = stateRef.current;
        if (!s) return;

        // Don't save demo projects (projects with demo- prefix in ID)
        if (s.id && s.id.startsWith('demo-')) {
            return; // Don't save demo projects
        }

        // Validate project ID before any async operations
        // Use ref to prevent multiple simultaneous fixes of the same invalid ID
        if (!isValidObjectId(s.id)) {
            // If we're already fixing this ID, skip (prevents duplicate warnings in StrictMode)
            if (fixingInvalidIdRef.current === s.id) {
                return; // Already fixing this ID, skip this call
            }

            // Mark that we're fixing this ID
            fixingInvalidIdRef.current = s.id;
            // Silently fix invalid project ID

            // Generate a new valid ID for the project
            const newId = generateObjectId();
            dispatch({ type: 'UPDATE_PROJECT_ID', payload: newId });

            // Clear the fixing flag after a short delay to allow state to update
            setTimeout(() => {
                if (fixingInvalidIdRef.current === s.id) {
                    fixingInvalidIdRef.current = null;
                }
            }, 100);

            // Skip this save cycle, will save on next cycle with valid ID
            return;
        }

        // Clear fixing flag if ID is now valid
        if (fixingInvalidIdRef.current) {
            fixingInvalidIdRef.current = null;
        }

        // Don't save uninitialized projects (projects that haven't been created by the user)
        // Check if this is just the default initial state that hasn't been modified
        const isUninitialized = s.name === INITIAL_PROJECT_NAME &&
            s.description === INITIAL_PROJECT_DESC &&
            s.tasks.length === 0 &&
            s.artifacts.length === 0 &&
            s.logs.length === 0;

        // Only save if project has been initialized (user has started working on it)
        // OR if it already exists (meaning it was previously saved)
        // Use project ID from URL if available (most reliable), otherwise use state.id
        const urlParams = new URLSearchParams(window.location.search);
        const urlProjectId = urlParams.get('project');
        const projectIdToUse = (urlProjectId && isValidObjectId(urlProjectId)) ? urlProjectId : s.id;

        // CRITICAL: Skip saving if project ID is known to not exist (prevents repeated 404s)
        // Check this BEFORE calling getProject to prevent any API calls
        if (projectIdToUse && isProjectNotFound(projectIdToUse)) {
            console.warn('[App] Project not found, but skipping cleanup to prevent reset during mock debugging:', projectIdToUse);
            return; // Skip save entirely - don't even try to get the project
        }

        // If URL has a different project ID than state, update state to match URL
        if (urlProjectId && isValidObjectId(urlProjectId) && urlProjectId !== s.id && viewMode === 'workspace') {
            // But only if the project actually exists (not in "not found" cache)
            if (!isProjectNotFound(urlProjectId)) {
                console.warn('[Save Project] URL project ID differs from state.id, updating state:', {
                    urlProjectId,
                    stateId: s.id
                });
                // Update state.id to match URL using UPDATE_PROJECT_ID action
                dispatch({ type: 'UPDATE_PROJECT_ID', payload: urlProjectId });
                s.id = urlProjectId;
            } else {
                // URL has invalid project ID - clean it up
                await cleanupProjectIdFromAllSources(urlProjectId);
                const url = new URL(window.location.href);
                url.searchParams.delete('project');
                window.history.replaceState({}, '', url.toString());
                return; // Skip save
            }
        }

        // Check "not found" cache before attempting to load project
        if (projectIdToUse && isProjectNotFound(projectIdToUse)) {
            // Project was recently confirmed as not found - skip save
            console.warn('[Save Project] Project in "not found" cache, skipping save:', projectIdToUse);
            return;
        }

        // Check if project is known to not exist before making API call
        if (projectIdToUse && isProjectNotFound(projectIdToUse)) {
            // Project is confirmed as not found - skip save and cleanup
            if (import.meta.env.DEV) {
                console.log('[App] Skipping save - project not found:', projectIdToUse);
            }
            return;
        }

        const existingProject = await projectStorage.getProject(projectIdToUse);
        if (isUninitialized && !existingProject) {
            return; // Don't save uninitialized projects
        }

        // Ensure project has userId from current user
        const currentUserId = user?.id;

        // Load existing project to preserve shareTokens if they exist
        let shareTokens = undefined;
        if (existingProject) {
            if ((existingProject as any).shareTokens) {
                shareTokens = (existingProject as any).shareTokens;
            }
            if ((existingProject as any).userId && !s.userId) {
                s.userId = (existingProject as any).userId;
            }
        }

        if (!currentUserId) {
            // User must be authenticated to save projects - all saves go to database
            console.warn("Cannot save project: User not authenticated. Please log in to save projects.");
            toast.error("Please log in to save projects", 4000);
            return;
        }

        // User is logged in - continue with database save

        try {
            // User is logged in - save to database
            if (!s.userId) {
                s.userId = currentUserId;
            }

            // Store current project ID for restoration on refresh (will be saved to database via userSettings)
            // Keep localStorage as fallback for guest users
            if (s.id && viewMode === 'workspace') {
                // Ensure state.id matches URL project ID if URL has one
                const urlParams = new URLSearchParams(window.location.search);
                const urlProjectId = urlParams.get('project');
                if (urlProjectId && isValidObjectId(urlProjectId) && urlProjectId !== s.id) {
                    // URL has a different project ID - update state to match URL
                    console.warn('[Project ID Sync] URL project ID differs from state, updating state:', {
                        urlProjectId,
                        stateId: s.id
                    });
                    dispatch({ type: 'UPDATE_PROJECT_ID', payload: urlProjectId });
                    s.id = urlProjectId;
                }

                // Update URL with project ID (ensures URL is always in sync)
                const url = new URL(window.location.href);
                url.hash = '#workspace';
                url.searchParams.set('project', s.id);
                window.history.replaceState({}, '', url.toString());

                // Save to database immediately if user is logged in
                if (currentUserId && user?.token) {
                    try {
                        const { updateUserSettings } = await import('../services/userSettingsApi');
                        await updateUserSettings(user.token, { currentProjectId: s.id });
                    } catch (settingsError) {
                        console.warn('Failed to save currentProjectId to database:', settingsError);
                    }
                }
                // Always save to localStorage as backup
                projectStorage.setCurrentProjectId(s.id);
            }

            // Also update userId from existing project data if needed
            if (existingProject && (existingProject as any).userId && !s.userId) {
                s.userId = (existingProject as any).userId;
            }

            // Prepare project data for database - ensure tasks and artifacts are always arrays
            // Ensure project name meets minimum length requirement (3 characters)
            let projectName = s.name?.trim() || '';
            if (projectName.length < 3) {
                // Use a meaningful default name if name is too short or empty
                projectName = 'Untitled Project';
                // Update state to reflect the corrected name
                if (s.name !== projectName) {
                    dispatch({ type: 'SET_PROJECT_DETAILS', payload: { name: projectName, description: s.description || '' } });
                }
            }

            const projectToSave = {
                ...s,
                name: projectName,
                tasks: Array.isArray(s.tasks) ? s.tasks : [],
                artifacts: Array.isArray(s.artifacts) ? s.artifacts : [],
                logs: Array.isArray(s.logs) ? s.logs : [],
                agents: Array.isArray(s.agents) ? s.agents : [],
                ...(shareTokens ? { shareTokens } : {})
            };

            // Check if project ID is a MongoDB ObjectId (already in database)
            const hasValidMongoId = /^[0-9a-fA-F]{24}$/.test(s.id);
            let savedProject;

            // Check if we're online (for offline support)
            const isOnline = navigator.onLine;

            if (isOnline) {
                // If project doesn't exist in database (existingProject is null), create it
                // Otherwise, update it if it exists
                if (existingProject && hasValidMongoId) {
                    // Project exists in database - update it
                    // But first verify it still exists (cache might be stale)
                    try {
                        // Try to verify project exists by fetching it first (this will use cache if available)
                        const verifyProject = await projectStorage.getProject(s.id);
                        if (!verifyProject) {
                            // Project doesn't exist - create it instead
                            if (import.meta.env?.DEV) {
                                console.log('[Save Project] Project not found in database (stale cache), creating new project');
                            }
                            savedProject = await projectsApi.create({
                                ...projectToSave,
                                lastModified: new Date(projectToSave.lastModified || Date.now())
                            });
                            // Note: we don't need to update s.id because we'll reload it later if needed? 
                            // Actually we should probably just treat it as updated.
                        } else {
                            // Project exists - update it
                            savedProject = await projectsApi.update(s.id, {
                                ...projectToSave,
                                lastModified: new Date(projectToSave.lastModified || Date.now())
                            });
                        }
                    } catch (dbError: any) {
                        // If update fails with 404, project was deleted - create it instead
                        if (dbError.status === 404) {
                            if (import.meta.env?.DEV) {
                                console.log('[Save Project] Project not found during update, creating new project');
                            }
                            savedProject = await projectsApi.create({
                                ...projectToSave,
                                lastModified: new Date(projectToSave.lastModified || Date.now())
                            });
                        } else {
                            console.warn('Database update failed:', dbError);
                            throw dbError;
                        }
                    }
                } else {
                    // Project doesn't exist or has invalid ID - create/overwrite it
                    savedProject = await projectsApi.create({
                        ...projectToSave,
                        lastModified: new Date(projectToSave.lastModified || Date.now())
                    });
                }

                // Update local project object with saved version (to get updated timestamps/IDs)
                if (savedProject) {
                    // We typically rely on the next fetch to update state, but could update local cache here if needed
                }

            } else {
                // Offline - save to secure storage as backup
                console.warn('Offline: Saving to local backup');
                try {
                    secureSetItem(`orbitai_project_${s.id}`, JSON.stringify(projectToSave));
                } catch (e) {
                    console.error('Failed to save local backup', e);
                }
            }
        } catch (err: any) {
            console.error('Failed to save project:', err);
            // On error, also try to save local backup
            try {
                secureSetItem(`orbitai_project_${s.id}`, JSON.stringify({
                    ...s,
                    name: s.name || 'Untitled Project',
                    tasks: Array.isArray(s.tasks) ? s.tasks : [],
                    artifacts: Array.isArray(s.artifacts) ? s.artifacts : [],
                    logs: Array.isArray(s.logs) ? s.logs : [],
                    agents: Array.isArray(s.agents) ? s.agents : [],
                }));
            } catch (e) {
                console.error('Failed to save local backup on error', e);
            }
            // Don't show toast for auto-saves to avoid spamming user
        }
    };

    /**
     * Handle loading a shared project from a link
     */
    const handleLoadSharedProject = (projectId: string, token: string) => {
        try {
            console.log('=== Loading Shared Project ===');
            console.log('Project ID:', projectId);
            console.log('Token:', token);
            console.log('Current URL:', window.location.href);

            // Try to load from shared project snapshot first (this works for recipients)
            const snapshotKey = `shared_project_${token}`;
            let projectData = secureGetItem(snapshotKey);
            let loadedState: any = null;
            let tokenInfo: any = null;

            console.log('Snapshot key:', snapshotKey);
            console.log('Snapshot found:', !!projectData);

            if (projectData) {
                console.log('Found shared project snapshot, parsing...');
                try {
                    // Load from shared snapshot
                    loadedState = JSON.parse(projectData);
                    console.log('Snapshot parsed successfully');
                    console.log('Project name:', loadedState.name);
                    console.log('Has shareTokens:', !!loadedState.shareTokens);
                    console.log('sharedVia:', loadedState.sharedVia);

                    // Verify token matches - check shareTokens array
                    if (loadedState.shareTokens && Array.isArray(loadedState.shareTokens)) {
                        console.log('shareTokens array length:', loadedState.shareTokens.length);
                        tokenInfo = loadedState.shareTokens.find((t: any) => t.token === token);
                        console.log('Token found in shareTokens:', !!tokenInfo);
                    }

                    // Also check sharedVia field as fallback
                    if (!tokenInfo && loadedState.sharedVia === token) {
                        console.log('Token matches sharedVia field - accepting');
                        // If sharedVia matches, create a tokenInfo from the snapshot
                        tokenInfo = {
                            token,
                            createdAt: loadedState.sharedAt || Date.now(),
                            expiresAt: undefined, // If not in shareTokens, assume no expiration
                        };

                        // Try to find in shareTokens for expiration info
                        if (loadedState.shareTokens && Array.isArray(loadedState.shareTokens)) {
                            const foundToken = loadedState.shareTokens.find((t: any) => t.token === token);
                            if (foundToken) {
                                tokenInfo = foundToken;
                            }
                        }
                    }
                } catch (parseError) {
                    console.error('Failed to parse snapshot:', parseError);
                    projectData = null; // Reset to try fallback
                }
            }

            // Fallback: Try to load from owner's project data (if snapshot not found)
            if (!projectData || !tokenInfo) {
                console.log('Trying fallback: owner project data');
                const ownerKey = `orbitai_project_${projectId}`;
                projectData = secureGetItem(ownerKey);
                console.log('Owner project found:', !!projectData);

                if (projectData) {
                    try {
                        loadedState = JSON.parse(projectData);

                        // Check if token exists in project's shareTokens array
                        if (loadedState.shareTokens && Array.isArray(loadedState.shareTokens)) {
                            tokenInfo = loadedState.shareTokens.find((t: any) => t.token === token);
                        }

                        // Fallback: Check localStorage (for backward compatibility)
                        if (!tokenInfo) {
                            const tokenData = secureGetItem(`share_token_${token}`);
                            if (tokenData) {
                                const storedTokenInfo = JSON.parse(tokenData);
                                if (storedTokenInfo.projectId === projectId) {
                                    tokenInfo = storedTokenInfo;
                                }
                            }
                        }
                    } catch (parseError) {
                        console.error('Failed to parse owner project:', parseError);
                    }
                }
            }

            if (!loadedState) {
                console.error('=== ERROR: No project data found ===');
                console.log('Checked keys:');
                console.log('  - shared_project_' + token);
                console.log('  - orbitai_project_' + projectId);

                // List all localStorage keys for debugging
                const allKeys = Object.keys(localStorage);
                const relevantKeys = allKeys.filter(k => k.includes('project') || k.includes('share'));
                console.log('Relevant localStorage keys:', relevantKeys);

                alert('Project not found. The share link may have been revoked or the project deleted.\n\nPlease ask the project owner to create a new share link.');
                window.location.href = '/';
                return;
            }

            if (!tokenInfo) {
                console.error('=== ERROR: Token validation failed ===');
                console.log('Token not found in shareTokens array');
                console.log('sharedVia value:', loadedState.sharedVia);
                console.log('Expected token:', token);

                // If sharedVia matches, accept it even without tokenInfo
                if (loadedState.sharedVia === token) {
                    console.log('Accepting via sharedVia match');
                    tokenInfo = {
                        token,
                        createdAt: loadedState.sharedAt || Date.now(),
                        expiresAt: undefined,
                    };
                } else {
                    alert('Invalid or expired share link.\n\nThe token in the URL does not match the project\'s share tokens.');
                    window.location.href = '/';
                    return;
                }
            }

            // Check expiration
            if (tokenInfo.expiresAt && Date.now() > tokenInfo.expiresAt) {
                console.error('Token expired');
                alert('This share link has expired.');
                window.location.href = '/';
                return;
            }

            console.log('=== Token validated successfully ===');
            console.log('Loading project state...');

            // Clean up the loaded state (remove shareTokens and shared metadata from the state)
            const { shareTokens, sharedVia, sharedAt, ...cleanState } = loadedState;
            const projectState = cleanState as ProjectState;

            if (!projectState.id) projectState.id = projectId;
            if (!projectState.currentSprint) projectState.currentSprint = 1;
            if (!projectState.methodology) projectState.methodology = 'V-Model';

            // Set view-only mode - NO AUTH REQUIRED
            setIsViewOnly(true);
            setSharedProjectToken(token);
            // Reset HAND-OFF AI state when loading shared project
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

            dispatch({ type: 'RESET_PROJECT', payload: projectState });

            // Note: Share link access count is automatically tracked in database
            // when the share token endpoint is accessed (handled by backend)

            setGlobalMessages(prev => {
                const filtered = prev.filter(m => m.id !== 'welcome');
                return [{
                    id: `shared-project-${Date.now()}`,
                    sender: 'system',
                    text: `**Shared Project: ${projectState.name}**\n\nYou are viewing this project in read-only mode. All editing features are disabled.`,
                    timestamp: Date.now(),
                    isLogEvent: false
                }, ...filtered];
            });

            // Set view mode to workspace - this allows non-registered users to view
            startTransition(() => {
                setViewMode('workspace');
            });
            console.log('=== Shared project loaded successfully ===');
            console.log('View mode set to:', 'workspace');
            console.log('Is view only:', true);
        } catch (e) {
            console.error("=== ERROR: Failed to load shared project ===", e);
            console.error('Error details:', e);
            toast.error(`Failed to load shared project: ${e instanceof Error ? e.message : 'Unknown error'}`, 8000);
            alert("Failed to load shared project: " + (e instanceof Error ? e.message : 'Unknown error') + '\n\nCheck the browser console for more details.');
            // Don't redirect immediately, give user a chance to see the error
            setTimeout(() => {
                window.location.href = '/';
            }, 3000);
        }
    };

    /**
     * Handle Launch App click
     */
    const handleLaunchApp = () => {
        // Require authentication before launching console
        if (!user) {
            setShowUserLogin(true);
            return;
        }

        // User is authenticated, proceed to console
        if (projectList.length > 0) {
            setViewMode('setup');
        } else {
            // Use setTimeout to ensure handleCreateNewProject is defined
            setTimeout(() => {
                if (typeof handleCreateNewProject === 'function') {
                    handleCreateNewProject();
                } else {
                    // Fallback: navigate to setup view directly
                    setViewMode('setup');
                    window.location.hash = '#setup';
                }
            }, 0);
        }
    };

    /**
     * Handle Delete Project
     */
    const handleDeleteProject = (projectId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        setProjectToDelete(projectId);
    };

    /**
     * Handle Toggle Sample Project
     */
    const handleToggleSampleProject = async (projectId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        if (!adminToken || !isAdminUser(user)) return;

        // Find project name for better confirmation message
        const project = projectList.find(p => p.id === projectId);
        const projectName = project?.name || 'this project';

        // Check if project ID is a valid MongoDB ObjectId (24 hex characters)
        // Projects stored only in localStorage have short random IDs and cannot be marked as samples
        const hasValidMongoId = /^[0-9a-fA-F]{24}$/.test(projectId);
        let actualProjectId = projectId;

        // If project is only stored locally, save it to database first
        if (!hasValidMongoId) {
            try {
                // Load project from projectStorage
                const localProject = await projectStorage.getProject(projectId);
                if (!localProject) {
                    await showConfirmation(
                        'Cannot Mark as Sample',
                        `"${projectName}" could not be found in local storage.`,
                        'error'
                    );
                    return;
                }

                const projectData = localProject;

                // Confirm with user that we'll save to database
                const shouldSave = await showConfirmation(
                    'Save Project to Database',
                    `"${projectName}" is stored locally only.\n\nTo mark it as a sample project, it needs to be saved to the database first.\n\nWould you like to save it to the database now?`,
                    'confirm',
                    undefined,
                    undefined,
                    'Save to Database',
                    'Cancel'
                );

                if (!shouldSave) return;

                // Prepare project data for database (exclude local-only fields)
                const { shareTokens, ...dbProjectData } = projectData;

                // Save to database
                const savedProject = await projectsApi.create({
                    ...dbProjectData,
                    userId: user?.id || (projectData as any).userId,
                    name: projectData.name,
                    description: projectData.description || '',
                    currentPhase: projectData.currentPhase || 'Initiation',
                    currentSprint: projectData.currentSprint || 1,
                    methodology: projectData.methodology || 'V-Model',
                    agents: projectData.agents || [],
                    tasks: projectData.tasks || [],
                    artifacts: projectData.artifacts || [],
                    logs: projectData.logs || [],
                    selectedStandards: (projectData as any).selectedStandards || [],
                    useInternet: (projectData as any).useInternet || false,
                    budget: (projectData as any).budget || INITIAL_BUDGET,
                    mcpServers: (projectData as any).mcpServers || [],
                    lastModified: new Date(projectData.lastModified || Date.now())
                });

                // Update project ID to the database ID
                actualProjectId = savedProject._id || savedProject.id;

                // Update projectStorage with new ID
                const updatedProjectData = { ...projectData, id: actualProjectId, _id: actualProjectId };
                await projectStorage.saveProject(actualProjectId, updatedProjectData);

                // Refresh project list from projectStorage
                const metas = await projectStorage.getMetadataList();
                const updatedMetas = metas.map((p: any) =>
                    p.id === projectId
                        ? { ...p, id: actualProjectId, lastModified: savedProject.lastModified || Date.now() }
                        : p
                );

                // Update project list state
                setProjectList(updatedMetas);

                await showConfirmation(
                    'Project Saved',
                    `Project "${projectName}" has been saved to the database.\n\nNow marking it as a sample project...`,
                    'success'
                );
            } catch (err: any) {
                console.error('Failed to save project to database:', err);
                await showConfirmation(
                    'Save Failed',
                    `Failed to save project to database: ${err.message || 'Unknown error'}\n\nCannot mark project as sample without saving it first.`,
                    'error'
                );
                return;
            }
        }

        const isCurrentlySample = sampleProjects.some(p => p.id === actualProjectId);
        const action = isCurrentlySample ? 'remove from' : 'add to';
        const actionVerb = isCurrentlySample ? 'Remove' : 'Add';

        // Enhanced confirmation message with project name
        const confirmMessage = `${actionVerb} "${projectName}" ${action} sample projects?\n\n${isCurrentlySample ? 'This project will no longer appear in the sample projects section.' : 'This project will be visible to all users in the sample projects section.'}`;

        const shouldProceed = await showConfirmation(
            `${actionVerb} Sample Project`,
            confirmMessage,
            'confirm',
            undefined,
            undefined,
            actionVerb,
            'Cancel'
        );

        if (!shouldProceed) return;

        try {
            if (isCurrentlySample) {
                await unmarkProjectAsSample(adminToken, actualProjectId);
                await showConfirmation(
                    'Sample Project Removed',
                    `"${projectName}" has been removed from sample projects.`,
                    'success'
                );
            } else {
                await markProjectAsSample(adminToken, actualProjectId);
                await showConfirmation(
                    'Sample Project Added',
                    `"${projectName}" has been added to sample projects.\n\nIt will now appear in the sample projects section for all users.`,
                    'success'
                );
            }
            // Refresh sample projects list FIRST
            const samples = await getSampleProjects();
            setSampleProjects(samples);

            // Small delay to ensure state updates before reloading project list
            await new Promise(resolve => setTimeout(resolve, 100));

            // Reload project list to ensure consistency
            // This ensures the project appears correctly in either the regular list or sample list
            if (user && user.id) {
                try {
                    const dbProjects = await projectsApi.getAll();
                    const dbMetas: ProjectMetadata[] = dbProjects
                        .filter(p => p.userId === user.id)
                        .map(p => ({
                            id: p._id?.toString() || p.id,
                            name: p.name,
                            lastModified: p.lastModified ? new Date(p.lastModified).getTime() : Date.now(),
                            description: (p.description || '').substring(0, 100),
                            phase: p.currentPhase as Phase,
                            userId: p.userId
                        }));
                    dbMetas.sort((a, b) => b.lastModified - a.lastModified);
                    setProjectList(dbMetas);
                } catch (dbError) {
                    console.error('Failed to reload projects from database:', dbError);
                    // Database-only: Show error instead of falling back to localStorage
                    // User should refresh or check their connection
                    setGlobalMessages(prev => [...prev, {
                        id: `db-error-${Date.now()}`,
                        sender: 'system',
                        text: 'Failed to reload projects. Please refresh the page.',
                        timestamp: Date.now(),
                        isLogEvent: false
                    }]);
                }
            }
        } catch (err: any) {
            console.error('Failed to toggle sample project:', err);
            // Provide more helpful error messages
            let errorMessage = err.message || 'Unknown error';
            if (errorMessage.includes('ObjectId') || errorMessage.includes('Cast to')) {
                errorMessage = 'This project is not saved in the database. Only projects saved to the database can be marked as samples.';
            }
            await showConfirmation(
                'Operation Failed',
                `Failed to ${action} sample projects: ${errorMessage}`,
                'error'
            );
        }
    };

    /**
     * Handle Export Project Data
     */
    const handleExportProjectData = async (format: 'json' | 'csv') => {
        const state = stateRef.current;
        if (!state.id || !isFeatureEnabled(canExportData)) {
            toast.error('Export data is not enabled for your role');
            return;
        }

        try {
            const projectData = {
                id: state.id,
                name: state.name,
                description: state.description,
                currentPhase: state.currentPhase,
                currentSprint: state.currentSprint,
                methodology: state.methodology,
                estimatedSprints: state.estimatedSprints,
                created: state.created,
                lastModified: state.lastModified,
                tasks: state.tasks.map(t => ({
                    id: t.id,
                    title: t.title,
                    description: t.description,
                    status: t.status,
                    phase: t.phase,
                    assignedTo: t.assignedTo,
                    progress: t.progress,
                    cost: t.cost,
                    tokenUsage: t.tokenUsage
                })),
                artifacts: state.artifacts.map(a => ({
                    id: a.id,
                    title: a.title,
                    type: a.type,
                    phase: a.phase,
                    createdBy: a.createdBy,
                    timestamp: a.timestamp,
                    tags: a.tags
                })),
                agents: state.agents.map(a => ({
                    id: a.id,
                    name: a.name,
                    role: a.role,
                    mode: a.mode,
                    description: a.description
                })),
                budget: state.budget,
                selectedStandards: state.selectedStandards,
                useInternet: state.useInternet
            };

            if (format === 'json') {
                const jsonStr = JSON.stringify(projectData, null, 2);
                const blob = new Blob([jsonStr], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${state.name || 'project'}-${Date.now()}.json`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                toast.success('Project data exported as JSON');
            } else if (format === 'csv') {
                // Convert to CSV format
                const csvRows: string[] = [];
                csvRows.push('Type,ID,Name,Description,Status,Phase,Assigned To,Progress');

                // Add project info
                csvRows.push(`Project,${state.id},"${state.name}","${state.description || ''}",${state.currentPhase},${state.currentPhase},N/A,${state.currentSprint}`);

                // Add tasks
                state.tasks.forEach(task => {
                    csvRows.push(`Task,${task.id},"${task.title}","${task.description || ''}",${task.status},${task.phase || ''},${task.assignedTo || ''},${task.progress || 0}`);
                });

                // Add artifacts
                state.artifacts.forEach(artifact => {
                    csvRows.push(`Artifact,${artifact.id},"${artifact.title}","${artifact.type}",N/A,${artifact.phase || ''},${artifact.createdBy || ''},N/A`);
                });

                const csvStr = csvRows.join('\n');
                const blob = new Blob([csvStr], { type: 'text/csv' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${state.name || 'project'}-${Date.now()}.csv`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                toast.success('Project data exported as CSV');
            }
        } catch (error: any) {
            console.error('Failed to export project data:', error);
            toast.error(`Failed to export project data: ${error.message || 'Unknown error'}`);
        }
    };

    /**
     * Handle Rename Project
     */
    const handleRenameProject = () => {
        if (tempName.trim()) {
            dispatch({ type: 'SET_PROJECT_DETAILS', payload: { name: tempName, description: stateRef.current.description } });
            addLog(`Project renamed to: ${tempName}`, AgentRole.ORCHESTRATOR, 'info');
        }
        setIsRenaming(false);
    };

    return {
        saveProject,
        handleLoadSharedProject,
        handleLaunchApp,
        handleDeleteProject,
        handleToggleSampleProject,
        handleExportProjectData,
        handleRenameProject
    };
};

export type ProjectHandlers = ReturnType<typeof createProjectHandlers>;
