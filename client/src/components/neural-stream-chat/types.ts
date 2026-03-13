// NeuralStreamChat Types
// Extracted from NeuralStreamChat.tsx for modularity

import { ChatMessage, ProjectFolder } from '@orbitai/shared';
import { Idea } from '../OrbGraph';
import { ProjectPreview } from '@src/services/geminiService';

// Category types for idea categorization
export type IdeaCategory =
    | 'feature'
    | 'technology'
    | 'ux'
    | 'data'
    | 'business'
    | 'community'
    | 'platform'
    | 'constraint'
    | 'opportunity'
    | 'risk'
    | 'requirement'
    | 'improvement'
    | 'idea'
    | 'other';

// Visualization-specific categories (subset without 'idea' and 'other')
export type VisualizationCategory =
    | 'feature'
    | 'technology'
    | 'ux'
    | 'data'
    | 'business'
    | 'community'
    | 'platform'
    | 'risk'
    | 'opportunity'
    | 'constraint'
    | 'requirement'
    | 'improvement';

export const VALID_VIZ_CATEGORIES: VisualizationCategory[] = [
    'feature',
    'technology',
    'ux',
    'data',
    'business',
    'community',
    'platform',
    'risk',
    'opportunity',
    'constraint',
    'requirement',
    'improvement'
];

// Valid SDLC methodologies
export type ValidMethodology =
    | 'V-Model'
    | 'Agile'
    | 'Waterfall'
    | 'Spiral'
    | 'DevOps'
    | 'Iterative'
    | 'Prototyping'
    | 'RAD'
    | 'Scrum'
    | 'Lean'
    | 'ASD';

// Props for the SuggestionSelector component
export interface SuggestionSelectorProps {
    suggestions: Array<{ id: string; label: string; description: string }>;
    onSelect: (selectedIds: string[]) => void;
    onClose: () => void;
}

// Agent voice mapping for voice conversations
export type AgentVoice = 'Puck' | 'Charon' | 'Kore' | 'Fenrir' | 'Zephyr';

export const AGENT_VOICE_MAP: Record<string, AgentVoice> = {
    'Orchestrator Agent': 'Puck',    // Raed - default, warm and professional
    'Requirements Agent': 'Charon',   // Nour - deeper, analytical
    'UI/UX Designer': 'Kore',         // Design agent - friendly, creative
    'Design/Architecture Agent': 'Fenrir', // Tarek - technical, authoritative
    'Test Requirements Engineer': 'Zephyr', // Test agent - clear, precise
    'Implementation Agent': 'Charon', // Code agent - technical
    'Integration Agent': 'Fenrir',    // Integration - technical
    'Test Agent': 'Zephyr',           // Testing - clear
    'QA/Audit Agent': 'Kore',         // QA - friendly but thorough
    'Remediation/Bug Agent': 'Charon', // Bug fixing - analytical
    'Notebook Agent': 'Puck',         // Documentation - warm
};

// Saved conversation structure
export interface SavedConversation {
    id: string;
    title: string;
    preview: string;
    timestamp: number;
    messages: ChatMessage[];
    topic: string;
    ideas: Idea[];
    keyInsights: string[];
    nextSteps: string[];
    prototypingStage?: 'ideation' | 'prototyping';
    projectPreview?: ProjectPreview | null;
    activeIdeaId?: string | null;
    glassPanelActiveView?: 'context' | 'history' | 'maturity';
    folderId?: string;
}

// System message for inbox
export interface SystemMessage {
    id: string;
    type: 'info' | 'success' | 'warning' | 'error';
    title: string;
    message: string;
    timestamp: number;
    read: boolean;
}

// Merge dialog state
export interface MergeDialogState {
    ideaIds: string[];
    ideaLabels: string[];
}

// Context menu state
export interface ContextMenuState {
    ideaId: string;
    x: number;
    y: number;
}

// Link dialog state
export interface LinkDialogState {
    sourceId: string;
    targetId?: string;
}

// Suggestion modal state
export interface SuggestionModalState {
    ideaId: string;
    ideaLabel: string;
    suggestions: Array<{ id: string; label: string; description: string }>;
    position?: { x: number; y: number };
}

// Active agent info
export interface ActiveAgent {
    id: string;
    name: string;
    role: string;
}

// NeuralStreamChat main props
export interface NeuralStreamChatProps {
    messages: ChatMessage[];
    onSendMessage: (message: string, stageContext?: string) => void;
    input: string;
    setInput: (input: string) => void;
    isProcessing?: boolean;
    processingLabel?: string | null;
    useInternet?: boolean;
    onToggleInternet?: () => void;
    selectedStandards?: string[];
    onToggleStandard?: (id: string) => void;
    onDeepResearch?: (query: string) => void;
    onSwitchToSetupView?: () => void;
    onLoadConversation?: (messages: ChatMessage[]) => void;
    projectName?: string;
    onLaunchProject?: (brainstormingData: BrainstormingData) => Promise<void> | void;
    onProjectPreviewChange?: (preview: ProjectPreview | null) => void;
}

// Brainstorming data passed to onLaunchProject
export interface BrainstormingData {
    topic: string;
    ideas: Idea[];
    keyInsights: string[];
    nextSteps: string[];
    projectPreview: ProjectPreview | null;
    selectedStandards: string[];
    messages: ChatMessage[];
    useInternet: boolean;
    conversationId: string | null;
}

// Folder editing state
export interface EditingFolder {
    id: string;
    name: string;
    description?: string;
    platforms?: ('web' | 'android' | 'ios' | 'desktop' | 'api' | 'other')[];
}

// Layout mode for chat interface
export type LayoutMode = 'rest' | 'chat';

// Glass panel view types
export type GlassPanelView = 'context' | 'history' | 'maturity';

// Default system messages for new users
export const DEFAULT_SYSTEM_MESSAGES: SystemMessage[] = [
    {
        id: 'welcome-1',
        type: 'info',
        title: 'Welcome to OrbitAI',
        message: 'Start by typing your project idea below to begin brainstorming.',
        timestamp: Date.now() - 60000,
        read: false
    },
    {
        id: 'tip-1',
        type: 'info',
        title: 'Quick Tip',
        message: 'Click "AI Brainstorming" to get AI agents involved in your ideation.',
        timestamp: Date.now() - 120000,
        read: false
    }
];
