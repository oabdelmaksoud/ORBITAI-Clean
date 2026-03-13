import { useState, useRef, useEffect } from 'react';
import { ChatMessage, ProjectFolder } from '@orbitai/shared';
import { Idea } from '@src/components/OrbGraph';
import { ProjectPreview } from '../types';
import { useAuth } from '@src/contexts/AuthContext';

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

export const useNeuralStreamState = (initialProjectName: string = '', messages: ChatMessage[] = []) => {
    const { user } = useAuth();

    // Topic & Ideas
    const [topic, setTopic] = useState<string>(initialProjectName);
    const [ideas, setIdeas] = useState<Idea[]>([]);
    const hasInitializedRef = useRef<boolean>(false);
    const isExtractingIdeasRef = useRef<boolean>(false);
    const hasUserInteractedRef = useRef<boolean>(false);
    const [activeIdeaId, setActiveIdeaId] = useState<string | null>(null);
    const [keyInsights, setKeyInsights] = useState<string[]>([]);
    const [nextSteps, setNextSteps] = useState<string[]>([]);

    // UI Panels & Layout
    const [glassPanelActiveView, setGlassPanelActiveView] = useState<'context' | 'history' | 'maturity'>('history');
    const [showChatHistorySidebar, setShowChatHistorySidebar] = useState(false);
    const [showTemplateSelector, setShowTemplateSelector] = useState(false);
    const [layoutMode, setLayoutMode] = useState<'rest' | 'chat'>('rest');

    // Conversations
    const [savedConversations, setSavedConversations] = useState<SavedConversation[]>([]);
    const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
    const [conversationToRestore, setConversationToRestore] = useState<string | null>(null);
    const [showMoveConversationDialog, setShowMoveConversationDialog] = useState(false);
    const [conversationToMove, setConversationToMove] = useState<string | null>(null);

    // AI & Processing
    const [generatingSuggestions, setGeneratingSuggestions] = useState<string | null>(null);
    const [isExtractingIdeas, setIsExtractingIdeas] = useState(false);
    const [extractionAgent, setExtractionAgent] = useState<string | null>(null);
    const [isGettingAgentsInvolved, setIsGettingAgentsInvolved] = useState(false);
    const [loadingStatusText, setLoadingStatusText] = useState<string>("Generating Prototype...");
    const [activeAgents, setActiveAgents] = useState<Array<{ id: string; name: string; role: string }>>([]);

    // Refs for processing
    const isLoadingConversationRef = useRef<boolean>(false);
    const lastLoadedConversationIdRef = useRef<string | null>(null);
    const isReloadingMessagesRef = useRef<boolean>(false);
    const messagesRef = useRef<ChatMessage[]>(messages);
    const [debugLastParsed, setDebugLastParsed] = useState<any>(null);
    const deepenMapRef = useRef<Map<string, string>>(new Map());
    const lastMessageCountRef = useRef<number>(0);
    const extractionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const extractionAbortControllerRef = useRef<AbortController | null>(null);

    // Prototyping
    const [prototypingStage, setPrototypingStage] = useState<'ideation' | 'prototyping'>('ideation');
    const [projectPreview, setProjectPreview] = useState<ProjectPreview | null>(null);
    const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);
    const [generationProgress, setGenerationProgress] = useState(0);
    const [isLaunchingProject, setIsLaunchingProject] = useState(false);
    const [showPathChoice, setShowPathChoice] = useState(false);
    const [showFeatureSelection, setShowFeatureSelection] = useState(false);
    const [statusLogs, setStatusLogs] = useState<string[]>([]);

    // Interactivity (Context Menus, Modals)
    const [suggestionModal, setSuggestionModal] = useState<{
        ideaId: string;
        ideaLabel: string;
        suggestions: Array<{ id: string; label: string; description: string }>;
        position?: { x: number; y: number };
    } | null>(null);
    const [selectedIdeas, setSelectedIdeas] = useState<Set<string>>(new Set());
    const [mergeDialog, setMergeDialog] = useState<{
        ideaId: string[];
        ideaLabels: string[];
    } | null>(null);
    const [contextMenu, setContextMenu] = useState<{
        ideaId: string;
        x: number;
        y: number;
    } | null>(null);
    const [linkingMode, setLinkingMode] = useState<string | null>(null);
    const [linkDialog, setLinkDialog] = useState<{
        sourceId: string;
        targetId?: string;
    } | null>(null);

    // AI Chat Suggestions (Quick Replies)
    const [aiSuggestions, setAiSuggestions] = useState<Array<{ id: string; text: string }>>([]);
    const [isFetchingAiSuggestions, setIsFetchingAiSuggestions] = useState(false);
    const [suggestionSetIndex, setSuggestionSetIndex] = useState(0);
    const aiSuggestionDebounceRef = useRef<NodeJS.Timeout | null>(null);

    // User & System
    const [showNewChatConfirm, setShowNewChatConfirm] = useState(false);
    const [isResetting, setIsResetting] = useState(false);
    const [showUserProfile, setShowUserProfile] = useState(false);
    const [showUserLogin, setShowUserLogin] = useState(false);

    // Folders
    const [projectFolders, setProjectFolders] = useState<ProjectFolder[]>([]);
    const [folderToDelete, setFolderToDelete] = useState<{ id: string; name: string; count: number } | null>(null);
    const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
    const [editingFolderName, setEditingFolderName] = useState<string>('');
    const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
    const [showFolderManager, setShowFolderManager] = useState(false);
    const [folderManagerMode, setFolderManagerMode] = useState<'create' | 'edit'>('create');
    const [editingFolder, setEditingFolder] = useState<{ id: string; name: string; description?: string; platforms?: ('web' | 'android' | 'ios' | 'desktop' | 'api' | 'other')[] } | null>(null);

    // Deepening
    const [currentWorkspaceId, setCurrentWorkspaceId] = useState<string | null>(null);
    const [deepenLevel, setDeepenLevel] = useState(0);
    const [isDeepeningIdeas, setIsDeepeningIdeas] = useState(false);

    // System Messages
    const [systemMessages, setSystemMessages] = useState<Array<{
        id: string;
        type: 'info' | 'success' | 'warning' | 'error';
        title: string;
        message: string;
        timestamp: number;
        read: boolean;
    }>>([
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
            timestamp: Date.now() - 50000,
            read: false
        }
    ]);

    // Sync messages ref
    useEffect(() => {
        messagesRef.current = messages;
    }, [messages]);

    // Sync Topic from props
    useEffect(() => {
        if (initialProjectName && !topic) {
            setTopic(initialProjectName);
        }
    }, [initialProjectName, topic]);

    // Extract Topic from user message if empty
    useEffect(() => {
        if (!topic && messages.length > 0) {
            const firstUserMessage = messages.find(m => m.sender === 'user');
            if (firstUserMessage?.text) {
                let extractedTopic = firstUserMessage.text.replace(/[\n\r]+/g, ' ').trim();
                if (extractedTopic.length > 50) {
                    extractedTopic = extractedTopic.substring(0, 50).replace(/\s+\S*$/, '').trim();
                    if (extractedTopic.length < 20) {
                        extractedTopic = firstUserMessage.text.substring(0, 47).trim() + '...';
                    }
                }
                console.log('[Central Idea] Set from first user message:', extractedTopic);
                setTopic(extractedTopic);
            }
        }
    }, [messages, topic]);

    return {
        // Topic & Ideas
        topic, setTopic,
        ideas, setIdeas,
        activeIdeaId, setActiveIdeaId,
        keyInsights, setKeyInsights,
        nextSteps, setNextSteps,
        hasInitializedRef,
        isExtractingIdeasRef,
        hasUserInteractedRef,
        deepenMapRef,

        // UI & Layout
        glassPanelActiveView, setGlassPanelActiveView,
        showChatHistorySidebar, setShowChatHistorySidebar,
        showTemplateSelector, setShowTemplateSelector,
        layoutMode, setLayoutMode,

        // Conversations
        savedConversations, setSavedConversations,
        currentConversationId, setCurrentConversationId,
        conversationToRestore, setConversationToRestore,
        showMoveConversationDialog, setShowMoveConversationDialog,
        conversationToMove, setConversationToMove,

        // AI & Processing
        generatingSuggestions, setGeneratingSuggestions,
        isExtractingIdeas, setIsExtractingIdeas,
        extractionAgent, setExtractionAgent,
        isGettingAgentsInvolved, setIsGettingAgentsInvolved,
        loadingStatusText, setLoadingStatusText,
        activeAgents, setActiveAgents,

        // Prototyping
        prototypingStage, setPrototypingStage,
        projectPreview, setProjectPreview,
        isGeneratingPreview, setIsGeneratingPreview,
        generationProgress, setGenerationProgress,
        isLaunchingProject, setIsLaunchingProject,
        showPathChoice, setShowPathChoice,
        showFeatureSelection, setShowFeatureSelection,
        statusLogs, setStatusLogs,

        // Interactvity
        suggestionModal, setSuggestionModal,
        selectedIdeas, setSelectedIdeas,
        mergeDialog, setMergeDialog,
        contextMenu, setContextMenu,
        linkingMode, setLinkingMode,
        linkDialog, setLinkDialog,

        // AI Suggestions
        aiSuggestions, setAiSuggestions,
        isFetchingAiSuggestions, setIsFetchingAiSuggestions,
        suggestionSetIndex, setSuggestionSetIndex,
        aiSuggestionDebounceRef,

        // User/System
        showNewChatConfirm, setShowNewChatConfirm,
        isResetting, setIsResetting,
        showUserProfile, setShowUserProfile,
        showUserLogin, setShowUserLogin,
        systemMessages, setSystemMessages,

        // Folders
        projectFolders, setProjectFolders,
        folderToDelete, setFolderToDelete,
        editingFolderId, setEditingFolderId,
        editingFolderName, setEditingFolderName,
        expandedFolders, setExpandedFolders,
        showFolderManager, setShowFolderManager,
        folderManagerMode, setFolderManagerMode,
        editingFolder, setEditingFolder,

        // Deepening
        currentWorkspaceId, setCurrentWorkspaceId,
        deepenLevel, setDeepenLevel,
        isDeepeningIdeas, setIsDeepeningIdeas,

        // Refs
        isLoadingConversationRef,
        lastLoadedConversationIdRef,
        isReloadingMessagesRef,
        messagesRef,
        debugLastParsed, setDebugLastParsed,
        lastMessageCountRef,
        extractionTimeoutRef,
        extractionAbortControllerRef
    };
};
