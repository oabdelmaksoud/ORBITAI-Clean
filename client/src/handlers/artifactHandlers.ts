/**
 * Artifact Handlers - Save and upload artifact handling
 * 
 * Extracted from App.tsx to reduce component size and improve maintainability.
 * 
 * @module handlers/artifactHandlers
 */

import { Artifact, AgentRole, ProjectState } from '@orbitai/shared';

/**
 * Dependencies required for artifact handlers
 */
export interface ArtifactHandlerDeps {
    stateRef: React.MutableRefObject<ProjectState>;
    dispatch: React.Dispatch<any>;
    addLog: (message: string, agentRole?: string | typeof AgentRole[keyof typeof AgentRole], type?: 'info' | 'action' | 'error' | 'success' | 'warning', taskId?: string) => void;
}

/**
 * Returns artifact handler functions
 */
export function createArtifactHandlers(deps: ArtifactHandlerDeps) {
    const { stateRef, dispatch, addLog } = deps;

    /**
     * Save an artifact with updated content
     */
    const handleSaveArtifact = (id: string, content: string) => {
        dispatch({ type: 'UPDATE_ARTIFACT', payload: { id, content } });
        addLog(`Artifact manually updated via IDE`, AgentRole.IMPLEMENTATION_AGENT, 'info');
    };

    /**
     * Handle file upload as artifact
     */
    const handleArtifactUpload = (file: File, content: string | ArrayBuffer) => {
        let type: Artifact['type'] = 'code';
        const ext = (file.name.split('.').pop() || "").toLowerCase();

        if (file.type.startsWith('image/')) {
            type = 'image';
        } else if (file.type.startsWith('audio/')) {
            type = 'audio';
        } else if (ext === 'md' || ext === 'txt') {
            type = 'requirement';
        } else if (ext === 'json') {
            type = 'design';
        } else if (ext === 'html') {
            type = 'build';
        }

        const newArtifact: Artifact = {
            id: Math.random().toString(36).substring(7),
            title: file.name,
            content: content as string,
            type: type,
            phase: stateRef.current.currentPhase,
            createdBy: AgentRole.IMPLEMENTATION_AGENT,
            timestamp: Date.now(),
            tags: ['uploaded', stateRef.current.currentPhase]
        };

        dispatch({ type: 'ADD_ARTIFACT', payload: newArtifact });
        addLog(`File uploaded: ${file.name}`, AgentRole.ORCHESTRATOR, 'info');
    };

    return {
        handleSaveArtifact,
        handleArtifactUpload
    };
}
