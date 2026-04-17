/**
 * useProjectManagement Hook
 * 
 * Manages Project CRUD operations, Template selection, and Setup Wizard state.
 * Refactored to delegate UI state to useAppState.
 */

import { useState, useRef, useEffect, useCallback, startTransition } from 'react';
import {
    ProjectState,
    Phase,
    ProjectTemplate,
    TaskStatus,
    ChatMessage,
    AgentRole,
    AgentRoleType
} from '@orbitai/shared';
import { projectStorage } from '../services/projectStorage';
import { projectsApi } from '@src/services/api';
import { getSampleProjects } from '../services/sampleProjectsApi';
import { AppAction as Action, createInitialState } from '../state/appReducer';
import { ProjectMetadata } from '@orbitai/shared';
import { PROJECT_THEMES, INITIAL_BUDGET } from '@orbitai/shared';

// Helper types
export interface Theme {
    id: string;
    label: string;
    primary: string;
    background: string;
}

interface UseProjectManagementProps {
    user: any;
    state: ProjectState;
    dispatch: React.Dispatch<Action>;
    viewModeHelpers: {
        viewMode: string;
        setViewMode: (mode: any) => void;
    };
    featureFlags: {
        canCreateProjects: any;
        canViewSamples: any;
        isFeatureEnabled: (flag: any) => boolean;
        shouldShowFeature: (flag: any) => boolean;
    };
    autoPilot: {
        stop: () => void;
    };
    uiHelpers: {
        setGlobalMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
        addLog: (message: string, agent: AgentRoleType, status?: 'info' | 'success' | 'warning' | 'error') => void;
    };
    setupHelpers: {
        setSetupMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
        setSetupInput: React.Dispatch<React.SetStateAction<string>>;
        setSetupProjectName: React.Dispatch<React.SetStateAction<string>>;
        setHasManuallyEditedProjectName: React.Dispatch<React.SetStateAction<boolean>>;
        setSetupFiles: React.Dispatch<React.SetStateAction<File[]>>;
        setTempSelectedStandards: React.Dispatch<React.SetStateAction<string[]>>;
        setSetupStage: React.Dispatch<React.SetStateAction<any>>;
        setProjectPreview: React.Dispatch<React.SetStateAction<any>>;
    };
    themeHelpers: {
        setSelectedTheme: React.Dispatch<React.SetStateAction<string>>;
        setAvailableThemes: React.Dispatch<React.SetStateAction<any[]>>;
        setThemeInput: React.Dispatch<React.SetStateAction<string>>;
    };
    templateHelpers: {
        setSelectedTemplateId: React.Dispatch<React.SetStateAction<string | null>>;
        setSelectedTemplateName: React.Dispatch<React.SetStateAction<string | null>>;
    };
}

export const useProjectManagement = ({
    user,
    state,
    dispatch,
    viewModeHelpers,
    featureFlags,
    autoPilot,
    uiHelpers,
    setupHelpers,
    themeHelpers,
    templateHelpers
}: UseProjectManagementProps) => {
    const { viewMode, setViewMode } = viewModeHelpers;
    const { canCreateProjects, canViewSamples, isFeatureEnabled, shouldShowFeature } = featureFlags;
    const { setGlobalMessages, addLog } = uiHelpers;
    const {
        setSetupMessages, setSetupInput, setSetupProjectName, setHasManuallyEditedProjectName,
        setSetupFiles, setTempSelectedStandards, setSetupStage, setProjectPreview
    } = setupHelpers;
    const { setSelectedTheme, setAvailableThemes, setThemeInput } = themeHelpers;
    const { setSelectedTemplateId, setSelectedTemplateName } = templateHelpers;

    // --- State ---

    // Project Lists
    const [projectList, setProjectList] = useState<ProjectMetadata[]>([]);
    const [sampleProjects, setSampleProjects] = useState<any[]>([]);
    const [loadingSamples, setLoadingSamples] = useState(false);
    const [hasLoaded, setHasLoaded] = useState(false);

    // Refs
    const loadingSamplesRef = useRef(false);
    const previousCanViewSamplesRef = useRef(canViewSamples?.enabled);
    const isManuallyLoadingProjectRef = useRef(false);
    const isProgrammaticHashChangeRef = useRef(false);

    // --- Loaders ---

    // Load User Projects
    const loadProjects = useCallback(async () => {
        try {
            const metas = await projectStorage.getMetadataList();
            const currentUserId = user?.id;
            const filteredMetas = currentUserId
                ? metas.filter(p => p.userId === currentUserId)
                : metas.filter(p => !p.userId);

            filteredMetas.sort((a, b) => b.lastModified - a.lastModified);
            setProjectList(filteredMetas);
        } catch (e: any) {
            const isConnectionError = e.message?.includes('Failed to fetch') || e.message?.includes('ERR_CONNECTION_REFUSED');
            if (!isConnectionError && import.meta.env?.DEV) {
                console.debug("Failed to load project list", e);
            }
            setProjectList([]);
        } finally {
            setHasLoaded(true);
        }
    }, [user?.id]);

    // Load on mount/user change
    useEffect(() => {
        loadProjects();
    }, [loadProjects]);

    // Load Sample Projects
    useEffect(() => {
        const loadSamples = async () => {
            if (loadingSamplesRef.current) return;

            if (!shouldShowFeature(canViewSamples)) {
                if (sampleProjects.length > 0) {
                    setSampleProjects([]);
                }
                previousCanViewSamplesRef.current = canViewSamples?.enabled;
                return;
            }

            if (previousCanViewSamplesRef.current === canViewSamples?.enabled && sampleProjects.length > 0) {
                return;
            }

            loadingSamplesRef.current = true;
            previousCanViewSamplesRef.current = canViewSamples?.enabled;
            setLoadingSamples(true);

            try {
                const samples = await getSampleProjects();
                setSampleProjects(samples);
            } catch (error) {
                console.error('Failed to load sample projects:', error);
                setSampleProjects([]);
            } finally {
                setLoadingSamples(false);
                loadingSamplesRef.current = false;
            }
        };
        loadSamples();
    }, [canViewSamples?.enabled, viewMode, user?.id, shouldShowFeature]);


    // --- Actions ---

    const handleCreateNewProject = useCallback(() => {
        if (!isFeatureEnabled(canCreateProjects)) {
            if (!canCreateProjects.loading) {
                alert("You don't have permission to create projects. This feature is disabled for your role.");
            }
            return;
        }

        // Clear local storage / URL
        if (typeof window !== 'undefined') {
            try {
                localStorage.removeItem('neuralChat_lastConversationId');
                const url = new URL(window.location.href);
                url.searchParams.delete('conversation');
                window.history.replaceState({}, '', url.toString());
            } catch (e) {
                // Ignore
            }
        }

        // Reset AutoPilot
        autoPilot.stop();
        dispatch({ type: 'SET_PROCESSING', payload: false });

        // Reset Project State
        dispatch({ type: 'RESET_PROJECT', payload: createInitialState(user?.id) });

        // Reset Wizard State (using helpers)
        setSetupMessages([{
            id: '1',
            sender: 'system',
            text: "Hello, I am Raed, your Orchestrator. What would you like to build today?\n\nYou can drag and drop requirement documents (PDF, Word, Text) directly here to get started.",
            timestamp: Date.now()
        }]);
        setSetupInput("");
        setSetupProjectName("");
        setHasManuallyEditedProjectName(false);
        setSetupFiles([]);
        setTempSelectedStandards([]);
        setSetupStage('input');
        setProjectPreview(null);
        setSelectedTheme('modern');
        setAvailableThemes(PROJECT_THEMES);
        setThemeInput('');
        setSelectedTemplateId(null);
        setSelectedTemplateName(null);

        setViewMode('setup');
    }, [
        user?.id, canCreateProjects, isFeatureEnabled, autoPilot, dispatch, setViewMode,
        setSetupMessages, setSetupInput, setSetupProjectName, setHasManuallyEditedProjectName,
        setSetupFiles, setTempSelectedStandards, setSetupStage, setProjectPreview,
        setSelectedTheme, setAvailableThemes, setThemeInput, setSelectedTemplateId, setSelectedTemplateName
    ]);

    const handleLoadProject = useCallback(async (projectId: string) => {
        try {
            isManuallyLoadingProjectRef.current = true;

            startTransition(() => {
                setViewMode('workspace');
            });

            const currentUserId = user?.id;
            let loadedState: ProjectState | null = null;

            // Try DB
            const hasValidMongoId = /^[0-9a-fA-F]{24}$/.test(projectId);
            if (currentUserId && hasValidMongoId) {
                try {
                    const dbProject = await projectsApi.getById(projectId);
                    if (dbProject) {
                        loadedState = {
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
                            selectedStandards: dbProject.selectedStandards || [],
                            mcpServers: dbProject.mcpServers || [],
                            budget: dbProject.budget || { total: INITIAL_BUDGET, used: 0, currency: 'USD', totalTokens: 0, lastUpdated: Date.now() },
                            selectedTheme: dbProject.selectedTheme || 'modern',
                            techStack: dbProject.techStack || [] // Ensure techStack exists
                        };
                        // Cache it
                        projectStorage.saveProject(loadedState.id, loadedState).catch(err => {
                            if (import.meta.env?.DEV) console.warn('Failed to cache project:', err);
                        });
                    }
                } catch (dbError: any) {
                    if (!dbError.message?.includes('404')) {
                        console.error('Database error loading project:', dbError);
                    }
                }
            }

            // Fallback to Storage
            if (!loadedState) {
                loadedState = await projectStorage.getProject(projectId);
            }

            if (loadedState) {
                // Ownership check
                if (loadedState.userId && currentUserId && loadedState.userId !== currentUserId) {
                    alert("You don't have permission to access this project.");
                    return;
                }
                if (currentUserId && !loadedState.userId) {
                    loadedState.userId = currentUserId;
                }

                // Defaults
                if (!loadedState.id) loadedState.id = projectId;
                if (!loadedState.currentSprint) loadedState.currentSprint = 1;
                if (!loadedState.methodology) loadedState.methodology = 'V-Model';
                if (!loadedState.selectedTheme) loadedState.selectedTheme = 'modern';
                if (!Array.isArray(loadedState.tasks)) loadedState.tasks = [];
                if (!Array.isArray(loadedState.artifacts)) loadedState.artifacts = [];

                // Pause Tasks
                loadedState.tasks = loadedState.tasks.map(t => {
                    if (t.status === TaskStatus.IN_PROGRESS) {
                        return { ...t, status: TaskStatus.PAUSED, logs: [...(t.logs || []), "[System] Session restored. Task paused due to interruption."] };
                    }
                    return t;
                });

                // Reset AutoPilot
                autoPilot.stop();
                dispatch({ type: 'SET_PROCESSING', payload: false });

                // Dispatch & UI Updates
                dispatch({ type: 'RESET_PROJECT', payload: loadedState });
                setSelectedTheme(loadedState.selectedTheme || 'modern');

                // URL Update
                isProgrammaticHashChangeRef.current = true;
                startTransition(() => {
                    const url = new URL(window.location.href);
                    url.hash = '#workspace';
                    url.searchParams.set('project', projectId);
                    window.history.replaceState({}, '', url.toString());
                });

                projectStorage.setCurrentProjectId(projectId);

                // Update User Settings
                if (user?.token && currentUserId) {
                    import('../services/userSettingsApi').then(({ updateUserSettings }) => {
                        updateUserSettings(user.token!, { currentProjectId: projectId }).catch(() => { });
                    });
                }

                // Global Message
                startTransition(() => {
                    setGlobalMessages(prev => {
                        const filtered = prev.filter(m => m.id !== 'welcome');
                        return [{
                            id: `project-loaded-${Date.now()}`,
                            sender: 'system',
                            text: `**Project Loaded: ${loadedState?.name}**\nRestored state from ${new Date(loadedState!.lastModified).toLocaleString()}.`,
                            timestamp: Date.now(),
                            isLogEvent: false
                        }, ...filtered];
                    });
                });

            } else {
                // Not Found
                addLog(`Project ${projectId} not found.`, AgentRole.ORCHESTRATOR, 'error');
                setViewMode('landing');
            }
        } catch (error) {
            console.error('Failed to load project:', error);
            addLog('Failed to load project.', AgentRole.ORCHESTRATOR, 'error');
            setViewMode('landing');
        }
    }, [user?.id, user?.token, dispatch, setViewMode, autoPilot, setGlobalMessages, addLog, setSelectedTheme]);


    const handleLoadDemoProject = useCallback(async (sample: { name: string; description: string; phase: Phase; id?: string }) => {
        isManuallyLoadingProjectRef.current = true;

        // Reset AutoPilot
        autoPilot.stop();
        dispatch({ type: 'SET_PROCESSING', payload: false });

        let loadedState: ProjectState | null = null;

        if (sample.id) {
            try {
                const dbProject = await projectsApi.getById(sample.id);
                if (dbProject) {
                    loadedState = {
                        id: dbProject._id || dbProject.id,
                        name: dbProject.name,
                        userId: dbProject.userId,
                        description: dbProject.description || '',
                        created: new Date(dbProject.createdAt || Date.now()).getTime(),
                        lastModified: new Date(dbProject.lastModified || Date.now()).getTime(),
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
                        selectedStandards: dbProject.selectedStandards || [],
                        mcpServers: dbProject.mcpServers || [],
                        budget: dbProject.budget || { total: INITIAL_BUDGET, used: 0, currency: 'USD', totalTokens: 0, lastUpdated: Date.now() },
                        selectedTheme: dbProject.selectedTheme || 'modern',
                        techStack: dbProject.techStack || []
                    };
                    projectStorage.saveProject(loadedState.id, loadedState);
                }
            } catch (dbError) {
                console.warn('Failed to load sample from DB', dbError);
            }
        }

        // Fallback: Create Demo
        if (!loadedState) {
            const demoId = `demo-${sample.id || Math.random().toString(36).substring(7)}`;
            loadedState = {
                ...createInitialState(user?.id),
                id: demoId,
                name: sample.name,
                description: sample.description,
                currentPhase: sample.phase,
                selectedTheme: 'modern',
                created: Date.now() - (sample.id === 'sample-1' ? 86400000 : 259200000),
                lastModified: Date.now()
            };
        }

        // Ensure fields
        if (!loadedState.id) loadedState.id = sample.id || 'demo-' + Math.random().toString(36);
        if (!loadedState.currentSprint) loadedState.currentSprint = 1;

        // Pause tasks
        loadedState.tasks = (loadedState.tasks || []).map(t => {
            if (t.status === TaskStatus.IN_PROGRESS) return { ...t, status: TaskStatus.PAUSED };
            return t;
        });

        dispatch({ type: 'RESET_PROJECT', payload: loadedState });
        setSelectedTheme(loadedState.selectedTheme || 'modern');

        isProgrammaticHashChangeRef.current = true;
        const url = new URL(window.location.href);
        url.hash = '#workspace';
        url.searchParams.set('project', loadedState.id);
        window.history.replaceState({}, '', url.toString());

        projectStorage.setCurrentProjectId(loadedState.id);
        if (user?.token && user?.id) {
            import('../services/userSettingsApi').then(({ updateUserSettings }) => {
                updateUserSettings(user.token!, { currentProjectId: loadedState.id });
            });
        }

        setGlobalMessages([{
            id: 'demo-welcome',
            sender: 'system',
            text: `**Sample Project: ${loadedState.name}**\n\n${loadedState.tasks?.length > 0 || loadedState.artifacts?.length > 0 ? 'Project loaded.' : 'Sample workspace.'}`,
            timestamp: Date.now()
        }]);

        setViewMode('workspace');

    }, [user?.id, user?.token, dispatch, autoPilot, setViewMode, setGlobalMessages, setSelectedTheme]);

    const handleSelectTemplate = useCallback((template: ProjectTemplate) => {
        const templateStandards = Array.isArray(template.selectedStandards) ? template.selectedStandards : [];

        const newState: ProjectState = {
            ...createInitialState(user?.id),
            methodology: template.methodology,
            agents: template.agents,
            selectedStandards: templateStandards,
            mcpServers: template.mcpServers,
            budget: template.budget,
            name: template.name,
            description: template.description
        };

        setSelectedTemplateId(template.id);
        setSelectedTemplateName(template.name);

        // Reset AutoPilot
        autoPilot.stop();
        dispatch({ type: 'SET_PROCESSING', payload: false });

        dispatch({ type: 'RESET_PROJECT', payload: newState });
        if (templateStandards.length > 0) {
            dispatch({ type: 'SET_STANDARDS', payload: templateStandards });
        }

        setSetupMessages([{
            id: '1',
            sender: 'system',
            text: `Template "${template.name}" loaded. ${template.description}\n\nWhat would you like to customize?`,
            timestamp: Date.now()
        }]);
        setSetupInput("");
        setSetupProjectName(template.name);
        setHasManuallyEditedProjectName(true);
        setTempSelectedStandards(templateStandards);
        setSelectedTheme('modern');
        setSetupStage('input');
        setProjectPreview(null);
        setViewMode('setup');

    }, [
        user?.id, dispatch, autoPilot, setViewMode,
        setSelectedTemplateId, setSelectedTemplateName, setSetupMessages, setSetupInput,
        setSetupProjectName, setHasManuallyEditedProjectName, setTempSelectedStandards,
        setSelectedTheme, setSetupStage, setProjectPreview
    ]);

    const handleSaveAsTemplate = useCallback((template: Partial<ProjectTemplate>) => {
        addLog(`Template "${template.name}" saved successfully.`, AgentRole.ORCHESTRATOR, 'success');
    }, [addLog]);

    const deleteProject = useCallback(async (projectId: string) => {
        if (!projectId) return;

        try {
            const currentUserId = user?.id;
            if (currentUserId) {
                // Try Delete from DB
                try {
                    await projectsApi.delete(projectId);
                } catch (e: any) {
                    if (!e.message?.includes('404')) {
                        console.error("DB Delete failed", e);
                    }
                }
            }

            await projectStorage.deleteProject(projectId);
            setProjectList(prev => prev.filter(p => p.id !== projectId));

            // If current project
            if (projectId === state.id) {
                handleCreateNewProject();
            }

            addLog(`Project deleted successfully.`, AgentRole.ORCHESTRATOR, 'success');

        } catch (e) {
            console.error("Delete failed", e);
            alert("Failed to delete project");
        }
    }, [user?.id, state.id, handleCreateNewProject, addLog]);

    return {
        // Logic/Actions
        actions: {
            loadProjects,
            handleCreateNewProject,
            handleLoadProject,
            handleLoadDemoProject,
            handleSelectTemplate,
            handleSaveAsTemplate,
            deleteProject,
            // Setters
            setProjectList,
            setSampleProjects,
            setLoadingSamples,
            setHasLoaded,
        },
        // State Expositions
        state: {
            projectList,
            sampleProjects,
            loadingSamples,
            hasLoaded,
        },
        // Refs
        refs: {
            isManuallyLoadingProjectRef,
            isProgrammaticHashChangeRef
        }
    };
};
