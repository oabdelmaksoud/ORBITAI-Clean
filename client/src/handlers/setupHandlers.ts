/**
 * Setup Handlers - File drag/drop and setup stage handling
 * 
 * Extracted from App.tsx to reduce component size and improve maintainability.
 * 
 * @module handlers/setupHandlers
 */

import type React from 'react';
import { Phase, Methodology, ProjectState } from '@orbitai/shared';
import { ChatMessage } from '@orbitai/shared';
import { ProjectPreview } from '../services/geminiService';
import { cleanMermaidCode } from '../utils/mermaidUtils';
import { toastService } from '../services/toastService';

/**
 * Dependencies required for setup handlers
 */
export interface SetupHandlerDeps {
    // Setters
    setIsDraggingSetup: (value: boolean) => void;
    setSetupFiles: React.Dispatch<React.SetStateAction<File[]>>;
    dispatch: React.Dispatch<any>;
    stateRef: React.MutableRefObject<any>;
    state: any;
    user: any;
    setProcessingLabel: (l: string | null) => void;
    setProcessingProgress: (p: number) => void;
    setViewMode: (m: any) => void;
    saveProject: () => Promise<void>;
    addLog: (msg: string, agent: any, type?: any) => void;
    orchestratePhase: (phase: any, description: string) => Promise<void>;
}

/**
 * Returns setup handler functions for drag and drop
 */
export function createSetupHandlers(deps: SetupHandlerDeps) {
    const { setIsDraggingSetup, setSetupFiles } = deps;
    const { dispatch, stateRef, state, user, setProcessingLabel, setProcessingProgress, setViewMode, saveProject, addLog, orchestratePhase } = deps;

    /**
     * Handle drag over event in setup area
     */
    const handleSetupDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDraggingSetup(true);
    };

    /**
     * Handle drag leave event in setup area
     */
    const handleSetupDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDraggingSetup(false);
    };

    /**
     * Handle file drop in setup area
     */
    const handleSetupDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDraggingSetup(false);
        const files = Array.from(e.dataTransfer.files);
        if (files.length > 0) {
            setSetupFiles(prev => [...prev, ...files]);
        }
    };

    /**
     * Remove a file from the setup files list
     */
    const removeSetupFile = (index: number) => {
        setSetupFiles(prev => prev.filter((_, i) => i !== index));
    };

    /**
     * Handle launching project from brainstorming view
     */
    const handleLaunchFromBrainstorming = async (brainstormingData: {
        topic: string;
        ideas: any[];
        keyInsights: string[];
        nextSteps: string[];
        projectPreview: ProjectPreview | null;
        selectedStandards: string[];
        messages: ChatMessage[];
        useInternet: boolean;
        conversationId: string | null;
        buildPlatform?: string;
        buildFeatures?: string[];
        workspaceId?: string;
    }) => {
        try {
            const { topic, ideas, keyInsights, nextSteps, projectPreview, selectedStandards, messages, useInternet, conversationId, buildPlatform, buildFeatures, workspaceId } = brainstormingData;

            if (!projectPreview) {
                if (toastService) {
                    toastService.error('Launch Failed: Project preview is required to launch. Please generate a prototype first.');
                }
                return;
            }

            dispatch({ type: 'SET_PROCESSING', payload: true });
            setProcessingLabel("Initializing Project from Brainstorming...");
            setProcessingProgress(0);

            // Construct structured description from brainstorming data
            let structuredDescription = `# PROJECT: ${projectPreview.projectName || topic || 'New Project'}\n\n`;

            if (topic) {
                structuredDescription += `## PROJECT TOPIC\n${topic}\n\n`;
            }

            // Add Build Configuration from User Selection
            if (buildPlatform || (buildFeatures && buildFeatures.length > 0)) {
                structuredDescription += `## BUILD CONFIGURATION\n`;
                if (buildPlatform) {
                    // Map platform codenames to display names
                    const platformName = buildPlatform === 'mobile' ? 'Mobile App (React Native)' :
                        buildPlatform === 'web' ? 'Web Application (React/Next.js)' :
                            buildPlatform === 'desktop' ? 'Desktop App (Electron/Tauri)' :
                                buildPlatform === 'api' ? 'Backend API' :
                                    buildPlatform === 'fullstack' ? 'Full Stack Application' : buildPlatform;
                    structuredDescription += `- **Target Platform**: ${platformName}\n`;
                }
                if (buildFeatures && buildFeatures.length > 0) {
                    structuredDescription += `- **Prioritized Features**: ${buildFeatures.join(', ')}\n`;
                }
                structuredDescription += `\n`;
            }

            if (projectPreview) {
                structuredDescription += `## EXECUTIVE SUMMARY\n${projectPreview.summary}\n\n`;
                structuredDescription += `## TECH STACK\n${projectPreview.techStack.map(t => `- ${t}`).join('\n')}\n\n`;

                // Embed the architecture diagram
                const cleanArch = cleanMermaidCode(projectPreview.architectureDiagram);
                structuredDescription += `## ARCHITECTURE DIAGRAM\n\`\`\`mermaid\n${cleanArch}\n\`\`\`\n\n`;
                structuredDescription += `## UI PROTOTYPE\n(See 'Wireframe Prototype.html' artifact for the visual mockups. Agents should refer to this artifact for UI tasks.)\n\n`;
                structuredDescription += `## IDENTIFIED RISKS\n${projectPreview.risks.map(r => `- ${r}`).join('\n')}\n\n`;

                // Add Full Architecture Analysis if available
                if (projectPreview.backendArchitecture || projectPreview.adminConsole || projectPreview.infrastructure ||
                    projectPreview.securityArchitecture || projectPreview.databaseArchitecture || projectPreview.apiDesign) {
                    structuredDescription += `## COMPLETE PROJECT ARCHITECTURE\n\n`;
                    structuredDescription += `**This section contains the complete architecture breakdown for all project components. Agents MUST reference this when implementing backend, admin, infrastructure, security, database, and API components.**\n\n`;

                    // Backend Architecture
                    if (projectPreview.backendArchitecture) {
                        structuredDescription += `### Backend Architecture\n`;
                        structuredDescription += `- **API Server**: ${projectPreview.backendArchitecture.apiServer}\n`;
                        structuredDescription += `- **Architecture Pattern**: ${projectPreview.backendArchitecture.architecture}\n`;
                        structuredDescription += `- **Framework**: ${projectPreview.backendArchitecture.framework}\n`;
                        structuredDescription += `- **Business Logic**: ${projectPreview.backendArchitecture.businessLogic}\n`;
                        structuredDescription += `- **Data Access**: ${projectPreview.backendArchitecture.dataAccess}\n`;
                        structuredDescription += `- **Background Jobs**: ${projectPreview.backendArchitecture.backgroundJobs}\n`;
                        if (projectPreview.backendArchitecture.realTimeServices) {
                            structuredDescription += `- **Real-time Services**: ${projectPreview.backendArchitecture.realTimeServices}\n`;
                        }
                        structuredDescription += `- **Description**: ${projectPreview.backendArchitecture.description}\n\n`;
                    }

                    // Admin Console
                    if (projectPreview.adminConsole && projectPreview.adminConsole.required) {
                        structuredDescription += `### Admin Console (REQUIRED)\n`;
                        structuredDescription += `- **Required**: Yes\n`;
                        structuredDescription += `- **Features**: ${projectPreview.adminConsole.features.join(', ')}\n`;
                        structuredDescription += `- **User Management**: ${projectPreview.adminConsole.userManagement ? 'Yes' : 'No'}\n`;
                        structuredDescription += `- **Content Management**: ${projectPreview.adminConsole.contentManagement ? 'Yes' : 'No'}\n`;
                        structuredDescription += `- **Analytics**: ${projectPreview.adminConsole.analytics ? 'Yes' : 'No'}\n`;
                        structuredDescription += `- **System Configuration**: ${projectPreview.adminConsole.systemConfiguration ? 'Yes' : 'No'}\n`;
                        structuredDescription += `- **Monitoring**: ${projectPreview.adminConsole.monitoring ? 'Yes' : 'No'}\n`;
                        structuredDescription += `- **Description**: ${projectPreview.adminConsole.description}\n\n`;
                    }

                    // Infrastructure
                    if (projectPreview.infrastructure) {
                        structuredDescription += `### Infrastructure\n`;
                        structuredDescription += `- **Application Servers**: ${projectPreview.infrastructure.applicationServers}\n`;
                        structuredDescription += `- **Database Servers**: ${projectPreview.infrastructure.databaseServers}\n`;
                        structuredDescription += `- **Caching**: ${projectPreview.infrastructure.caching}\n`;
                        structuredDescription += `- **Message Queues**: ${projectPreview.infrastructure.messageQueues}\n`;
                        structuredDescription += `- **CDN**: ${projectPreview.infrastructure.cdn}\n`;
                        structuredDescription += `- **Monitoring**: ${projectPreview.infrastructure.monitoring}\n`;
                        structuredDescription += `- **Logging**: ${projectPreview.infrastructure.logging}\n`;
                        structuredDescription += `- **Deployment**: ${projectPreview.infrastructure.deployment}\n`;
                        structuredDescription += `- **Description**: ${projectPreview.infrastructure.description}\n\n`;
                    }

                    // Security Architecture
                    if (projectPreview.securityArchitecture) {
                        structuredDescription += `### Security Architecture\n`;
                        structuredDescription += `- **Authentication**: ${projectPreview.securityArchitecture.authentication}\n`;
                        structuredDescription += `- **Authorization**: ${projectPreview.securityArchitecture.authorization}\n`;
                        structuredDescription += `- **Data Encryption**: ${projectPreview.securityArchitecture.dataEncryption}\n`;
                        structuredDescription += `- **API Security**: ${projectPreview.securityArchitecture.apiSecurity}\n`;
                        structuredDescription += `- **Rate Limiting**: ${projectPreview.securityArchitecture.rateLimiting ? 'Yes' : 'No'}\n`;
                        structuredDescription += `- **Security Monitoring**: ${projectPreview.securityArchitecture.securityMonitoring ? 'Yes' : 'No'}\n`;
                        if (projectPreview.securityArchitecture.compliance.length > 0) {
                            structuredDescription += `- **Compliance Requirements**: ${projectPreview.securityArchitecture.compliance.join(', ')}\n`;
                        }
                        structuredDescription += `- **Description**: ${projectPreview.securityArchitecture.description}\n\n`;
                    }

                    // Database Architecture
                    if (projectPreview.databaseArchitecture) {
                        structuredDescription += `### Database Architecture\n`;
                        structuredDescription += `- **Primary Database**: ${projectPreview.databaseArchitecture.primaryDatabase}\n`;
                        structuredDescription += `- **Database Type**: ${projectPreview.databaseArchitecture.databaseType.toUpperCase()}\n`;
                        structuredDescription += `- **Schema Design**: ${projectPreview.databaseArchitecture.schemaDesign}\n`;
                        structuredDescription += `- **Caching Strategy**: ${projectPreview.databaseArchitecture.cachingStrategy}\n`;
                        structuredDescription += `- **Backup & Recovery**: ${projectPreview.databaseArchitecture.backupRecovery}\n`;
                        structuredDescription += `- **Migrations**: ${projectPreview.databaseArchitecture.migrations}\n`;
                        structuredDescription += `- **Description**: ${projectPreview.databaseArchitecture.description}\n\n`;
                    }

                    // API Design
                    if (projectPreview.apiDesign) {
                        structuredDescription += `### API Design\n`;
                        structuredDescription += `- **API Style**: ${projectPreview.apiDesign.apiStyle}\n`;
                        if (projectPreview.apiDesign.endpoints.length > 0) {
                            structuredDescription += `- **Key Endpoints**:\n${projectPreview.apiDesign.endpoints.map(e => `  - ${e}`).join('\n')}\n`;
                        }
                        if (projectPreview.apiDesign.externalIntegrations.length > 0) {
                            structuredDescription += `- **External Integrations**: ${projectPreview.apiDesign.externalIntegrations.join(', ')}\n`;
                        }
                        if (projectPreview.apiDesign.thirdPartyServices.length > 0) {
                            structuredDescription += `- **Third-party Services**: ${projectPreview.apiDesign.thirdPartyServices.join(', ')}\n`;
                        }
                        if (projectPreview.apiDesign.webhooks.length > 0) {
                            structuredDescription += `- **Webhooks**: ${projectPreview.apiDesign.webhooks.join(', ')}\n`;
                        }
                        structuredDescription += `- **Documentation**: ${projectPreview.apiDesign.documentation}\n`;
                        structuredDescription += `- **Description**: ${projectPreview.apiDesign.description}\n\n`;
                    }

                    structuredDescription += `**IMPORTANT FOR AGENTS**: When implementing tasks, refer to the appropriate architecture section above. For example:\n`;
                    structuredDescription += `- Backend tasks → Reference "Backend Architecture" section\n`;
                    structuredDescription += `- Admin panel tasks → Reference "Admin Console" section\n`;
                    structuredDescription += `- Database tasks → Reference "Database Architecture" section\n`;
                    structuredDescription += `- API tasks → Reference "API Design" section\n`;
                    structuredDescription += `- Security tasks → Reference "Security Architecture" section\n`;
                    structuredDescription += `- Infrastructure/deployment tasks → Reference "Infrastructure" section\n\n`;
                }
            }

            // Add ideas as requirements
            if (ideas && ideas.length > 0) {
                structuredDescription += `## KEY IDEAS & REQUIREMENTS\n`;
                ideas.forEach(idea => {
                    structuredDescription += `### ${idea.label}\n`;
                    if (idea.description) structuredDescription += `${idea.description}\n`;
                    if (idea.notes) structuredDescription += `\n**Notes:** ${idea.notes}\n`;
                    structuredDescription += `\n`;
                });
            }

            // Add key insights
            if (keyInsights && keyInsights.length > 0) {
                structuredDescription += `## KEY INSIGHTS\n${keyInsights.map(insight => `- ${insight}`).join('\n')}\n\n`;
            }

            // Add next steps
            if (nextSteps && nextSteps.length > 0) {
                structuredDescription += `## RECOMMENDED NEXT STEPS\n${nextSteps.map(step => `- ${step}`).join('\n')}\n\n`;
            }

            // Add conversation history
            if (messages && messages.length > 0) {
                structuredDescription += `## BRAINSTORMING CONVERSATION\n`;
                structuredDescription += messages.map(m => `**${m.sender.toUpperCase()}**: ${m.text}`).join('\n\n');
            }

            const finalProjectName = projectPreview.projectName || topic || 'New Project';

            // Initialize project state
            dispatch({
                type: 'SET_PROJECT_DETAILS',
                payload: {
                    name: finalProjectName,
                    description: structuredDescription,
                    methodology: (projectPreview.recommendedMethodology as Methodology) || 'V-Model',
                    estimatedSprints: projectPreview.estimatedSprints
                }
            });

            // Set standards
            const standardsToUse = projectPreview.recommendedStandards && projectPreview.recommendedStandards.length > 0
                ? projectPreview.recommendedStandards
                : (selectedStandards || []);
            dispatch({ type: 'SET_STANDARDS', payload: standardsToUse });

            // Set internet usage
            dispatch({ type: 'TOGGLE_INTERNET', payload: useInternet });

            setProcessingLabel("Creating project artifacts...");
            setProcessingProgress(20);

            // Create artifacts from project preview
            if (projectPreview.wireframeCode) {
                dispatch({
                    type: 'ADD_ARTIFACT',
                    payload: {
                        id: `wireframe-${Date.now()}`,
                        title: 'Wireframe Prototype.html',
                        content: projectPreview.wireframeCode,
                        type: 'build',
                        phase: Phase.ARCHITECTURE,
                        timestamp: Date.now(),
                        createdBy: 'Project Manager',
                        tags: ['prototype', 'wireframe']
                    }
                });
            }

            if (projectPreview.architectureDiagram) {
                dispatch({
                    type: 'ADD_ARTIFACT',
                    payload: {
                        id: `architecture-${Date.now()}`,
                        title: 'Architecture Diagram.mmd',
                        content: projectPreview.architectureDiagram,
                        type: 'design',
                        phase: Phase.ARCHITECTURE,
                        timestamp: Date.now(),
                        createdBy: 'Architect',
                        tags: ['architecture', 'diagram']
                    }
                });
            }

            // NEW: Create Project Brief artifact
            dispatch({
                type: 'ADD_ARTIFACT',
                payload: {
                    id: `project-brief-${Date.now()}`,
                    title: 'Project Brief.md',
                    content: structuredDescription,
                    type: 'requirement',
                    phase: Phase.INITIATION,
                    timestamp: Date.now(),
                    createdBy: 'Project Manager',
                    tags: ['brief', 'requirements']
                }
            });

            setProcessingProgress(40);
            setProcessingLabel("Saving project...");

            // Store full project preview (including architecture analysis) in wizardMetadata
            const currentState = deps.stateRef.current;
            if (currentState) {
                const updatedState: ProjectState = {
                    ...currentState,
                    wizardMetadata: {
                        ...currentState.wizardMetadata,
                        projectPreview: projectPreview,
                        conversationId: conversationId || undefined,
                        data: {
                            ...(currentState.wizardMetadata?.data || {}),
                            brainstormingContext: {
                                concept: topic,
                                ideas: ideas,
                                keyInsights: keyInsights,
                                audience: 'General',
                                style: 'Standard',
                                coreLoop: 'Standard gameplay'
                            }
                        }
                    },
                    folderId: workspaceId || currentState.folderId
                };
                dispatch({ type: 'RESET_PROJECT', payload: updatedState });
            }

            // Save project first to get the project ID
            await deps.saveProject();

            // Link conversation to project after project is saved (so we have the project ID)
            if (conversationId && deps.user) {
                try {
                    const { chatApi } = await import('@src/services/chatApi');
                    const projectId = deps.stateRef.current?.id;
                    if (projectId) {
                        await chatApi.updateNeuralChat(conversationId, {
                            projectId: projectId
                        });
                        if (import.meta.env.DEV) {
                            console.log('[Launch Project] Linked conversation to project:', { conversationId, projectId });
                        }
                    }
                } catch (linkError) {
                    console.warn('[Launch Project] Failed to link conversation to project:', linkError);
                    // Don't fail the launch if linking fails
                }
            }

            setProcessingProgress(60);
            setProcessingLabel("Initializing workspace...");

            // Navigate to workspace
            setViewMode('workspace');
            window.location.hash = '#workspace';

            setProcessingProgress(80);

            // Orchestrate initiation phase
            await orchestratePhase(Phase.INITIATION, structuredDescription);

            setProcessingProgress(100);

            // Save again after orchestration
            await deps.saveProject();

            // Update URL with project ID
            const currentProjectId = deps.state.id;
            if (currentProjectId) {
                const url = new URL(window.location.href);
                url.searchParams.set('project', currentProjectId);
                window.history.replaceState({}, '', url.toString());
            }

            if (toastService) {
                toastService.success('Project Launched: Your project has been created and is ready to start!', 3000);
            }

            dispatch({ type: 'SET_PROCESSING', payload: false });
            setProcessingProgress(0);
            setProcessingLabel(null);

        } catch (error: any) {
            console.error('[Launch from Brainstorming] Failed:', error);
            if (toastService) {
                toastService.error('Launch Failed: ' + (error.message || 'Failed to launch project. Please try again.'));
            }
            dispatch({ type: 'SET_PROCESSING', payload: false });
            setProcessingProgress(0);
            setProcessingLabel(null);
        }
    };

    return {
        handleSetupDragOver,
        handleSetupDragLeave,
        handleSetupDrop,
        removeSetupFile,
        handleLaunchFromBrainstorming
    };
}
