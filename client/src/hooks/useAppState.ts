import { useState, useCallback, useRef, useEffect } from 'react';
import {
    ProjectState, Phase, AgentRole, TaskStatus, Task, LogEntry, Artifact, Agent, ChatMessage, AppSettings, MCPServer, DialogueEvent, ProjectBudget, TokenUsage, EvaluationResult, UserProfile, PlanTier, Methodology, ProjectMetadata, APIHealth, APIMetrics
} from '@orbitai/shared';
// @ts-ignore
import { toastService, Toast } from '../services/toastService';
import { apiMonitor } from '../services/geminiService';

export type ViewMode = 'landing' | 'setup' | 'workspace' | 'admin' | 'shared';

export function useAppState() {
    // View State
    const [viewMode, setViewMode] = useState<ViewMode>(() => {
        const hash = window.location.hash;
        if (hash.startsWith('#admin')) return 'admin';
        // Hub removed
        if (hash === '#setup') return 'setup';
        if (hash === '#workspace') return 'workspace';
        return 'landing';
    });

    const [isRestoring, setIsRestoring] = useState(false);
    const [isViewOnly, setIsViewOnly] = useState(false);
    const [sharedProjectToken, setSharedProjectToken] = useState<string | null>(null);

    // Modern View
    const [isModernView, setIsModernView] = useState<boolean>(() => {
        try { return localStorage.getItem('orbitai_modern_view') === 'true'; } catch { return false; }
    });
    const toggleModernView = useCallback(() => {
        setIsModernView(prev => {
            const val = !prev;
            localStorage.setItem('orbitai_modern_view', String(val));
            return val;
        });
    }, []);

    // Tabs
    const [activeTab, setActiveTab] = useState('kanban');

    // UI Overlays & Modals
    const [showSubscription, setShowSubscription] = useState(false);
    const [subscriptionMode, setSubscriptionMode] = useState<'login' | 'pricing'>('login');
    const [showUserLogin, setShowUserLogin] = useState(false);
    const [showUserSignup, setShowUserSignup] = useState(false);
    const [showPackageSelection, setShowPackageSelection] = useState(false);
    const [selectedPackage, setSelectedPackage] = useState<any>(null);
    const [pendingUser, setPendingUser] = useState<any>(null);
    const [showPayment, setShowPayment] = useState(false);
    const [adminToken, setAdminToken] = useState<string | null>(null);
    const [adminUser, setAdminUser] = useState<any>(null);

    const [showHITLPrompt, setShowHITLPrompt] = useState(false);
    const [hitlPreference, setHITLPreference] = useState<'always' | 'critical' | 'off'>('always');
    const [showAdminLogin, setShowAdminLogin] = useState(false);
    const [showFeedbackModal, setShowFeedbackModal] = useState(false);
    const [showUserProfile, setShowUserProfile] = useState(false);
    const [showShareModal, setShowShareModal] = useState(false);

    // Layout State
    const [isLeftCollapsed, setIsLeftCollapsed] = useState(false);
    const [leftWidth, setLeftWidth] = useState(320);
    const [isResizingLeft, setIsResizingLeft] = useState(false);
    const [isLogsCollapsed, setIsLogsCollapsed] = useState(false);
    const [logHeight, setLogHeight] = useState(200);
    const [isResizingLogs, setIsResizingLogs] = useState(false);

    // Right Sidebar
    const [rightSidebarView, setRightSidebarView] = useState<'chat' | 'history' | 'activity' | 'agents'>('chat');
    const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(true);

    // Chat State
    const [globalChatInput, setGlobalChatInput] = useState("");
    const [globalMessages, setGlobalMessages] = useState<ChatMessage[]>([]);
    const [isChatThinking, setIsChatThinking] = useState(false);
    const [activeChatAgent, setActiveChatAgent] = useState<Agent | null>(null);
    const [chatHistory, setChatHistory] = useState<Record<string, ChatMessage[]>>({});
    const [isEnhancingChat, setIsEnhancingChat] = useState(false);
    const [isResearchingChat, setIsResearchingChat] = useState(false);

    // Setup/Wizard State
    const [setupInput, setSetupInput] = useState("");
    const [setupMessages, setSetupMessages] = useState<ChatMessage[]>([]);
    const [isEnhancingInput, setIsEnhancingInput] = useState(false);
    const [isResearching, setIsResearching] = useState(false);
    const setupInputRef = useRef<HTMLTextAreaElement>(null);
    const setupEndRef = useRef<HTMLDivElement>(null);
    const globalChatEndRef = useRef<HTMLDivElement>(null);
    const globalFileInputRef = useRef<HTMLInputElement>(null);
    const globalChatInputRef = useRef<HTMLInputElement>(null);

    // AutoPilot State
    const [autoPilotStatus, setAutoPilotStatus] = useState<'idle' | 'running' | 'paused'>('idle');
    const autoPilotStatusRef = useRef<'idle' | 'running' | 'paused'>('idle');
    const isStoppingRef = useRef(false);
    const isBatchingRef = useRef(false);
    const activeTaskControllersRef = useRef<Map<string, AbortController>>(new Map());
    const batchIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const pendingActionRef = useRef<(() => void) | null>(null);

    // Processing Overlay State
    const [processingLabel, setProcessingLabel] = useState<string | null>(null);
    const [processingProgress, setProcessingProgress] = useState<number>(0);
    const [processingStatusText, setProcessingStatusText] = useState<string | undefined>(undefined);
    const [processingEstimatedTime, setProcessingEstimatedTime] = useState<number | undefined>(undefined);
    const [processingTaskCount, setProcessingTaskCount] = useState<number | undefined>(undefined);
    const processingStartTimeRef = useRef<number | null>(null);

    // App Settings
    const [appSettings, setAppSettings] = useState<AppSettings>({
        executionSpeed: 'normal',
        maxRetries: 2,
        autoScrollLogs: true,
        maxTasksPerPhase: 20,
        maxParallelTasks: 5,
        enableHumanInTheLoop: false
    });
    const settingsRef = useRef(appSettings);
    useEffect(() => { settingsRef.current = appSettings; }, [appSettings]);

    // Renaming & Confirmation State
    const [tempName, setTempName] = useState("");
    const [isRenaming, setIsRenaming] = useState(false);
    const [showConfirmation, setShowConfirmation] = useState(false);
    const [confirmationModal, setConfirmationModal] = useState<{
        isOpen: boolean;
        type?: 'confirm' | 'alert' | 'success' | 'error' | 'info';
        title: string;
        message: string;
        confirmText?: string;
        cancelText?: string;
        onConfirm?: () => void;
        onCancel?: () => void;
    }>({
        isOpen: false,
        title: '',
        message: ''
    });

    // Edits & Modals
    const [editingTask, setEditingTask] = useState<Task | null>(null);
    const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
    const [selectedAgentDetail, setSelectedAgentDetail] = useState<Agent | null>(null);
    const [isCreatingNewAgent, setIsCreatingNewAgent] = useState(false);
    const [showWorkspaceTutorial, setShowWorkspaceTutorial] = useState(false);

    // Left Sidebar Tabs
    const [leftTab, setLeftTab] = useState<'agents' | 'chat'>('chat');

    // Themes & Templates (already partly here, ensuring coverage)
    const [showTemplateSelector, setShowTemplateSelector] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [showThemeStudio, setShowThemeStudio] = useState(false);
    const [showProjectImport, setShowProjectImport] = useState(false);
    const [showExportDataMenu, setShowExportDataMenu] = useState(false);
    const [showShareProject, setShowShareProject] = useState(false);
    const [showReportExport, setShowReportExport] = useState(false);
    const [showTerminal, setShowTerminal] = useState(false);
    const [showMobileDeploymentWizard, setShowMobileDeploymentWizard] = useState(false);
    const [previewTab, setPreviewTab] = useState('brief');
    const [showStandards, setShowStandards] = useState(false);
    const [isDraggingSetup, setIsDraggingSetup] = useState(false);
    const [isGeneratingSuggestions, setIsGeneratingSuggestions] = useState(false);
    const [displayedSuggestions, setDisplayedSuggestions] = useState<any[]>([]);
    const [dynamicSuggestions, setDynamicSuggestions] = useState<any[]>([]);
    const [isGeneratingTheme, setIsGeneratingTheme] = useState(false);
    const [dismissedGuestBanner, setDismissedGuestBanner] = useState(false);

    // API Health
    const [apiHealth, setApiHealth] = useState<{ status: APIHealth, metrics: APIMetrics }>({
        status: 'healthy',
        metrics: { requests: 0, lastLatency: 0, errors: 0, latencyHistory: [], usageHistory: [] }
    });

    // API Monitor Subscription
    useEffect(() => {
        const unsubscribe = apiMonitor.subscribe((status, metrics) => { setApiHealth({ status, metrics }); });
        return () => { unsubscribe(); };
    }, []);

    // Toast State
    const [toasts, setToasts] = useState<Toast[]>([]);
    const [currentError, setCurrentError] = useState<Error | null>(null);
    useEffect(() => {
        const unsubscribe = toastService.subscribe(setToasts);
        return unsubscribe;
    }, []);

    // UI Refs & Misc (globalFileInputRef already defined above)
    const [isProcessingFile, setIsProcessingFile] = useState(false);
    const [taskToDelete, setTaskToDelete] = useState<string | null>(null);
    const [projectToDelete, setProjectToDelete] = useState<string | null>(null);

    // Sync Ref
    useEffect(() => { autoPilotStatusRef.current = autoPilotStatus; }, [autoPilotStatus]);

    // Resizable panel mouse tracking (extracted from App.tsx — all state lives here)
    useEffect(() => {
      const handleMouseMove = (e: MouseEvent) => {
        if (isResizingLeft) setLeftWidth(Math.min(Math.max(e.clientX, 220), 500));
        if (isResizingLogs) {
          setIsLogsCollapsed(false);
          setLogHeight(Math.min(Math.max(document.body.clientHeight - e.clientY, 36), 600));
        }
      };
      const handleMouseUp = () => { setIsResizingLeft(false); setIsResizingLogs(false); };
      if (isResizingLeft || isResizingLogs) {
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
        document.body.style.cursor = isResizingLogs ? 'row-resize' : 'col-resize';
        document.body.style.userSelect = 'none';
      } else {
        document.body.style.cursor = 'default';
        document.body.style.userSelect = 'auto';
      }
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.body.style.cursor = 'default';
        document.body.style.userSelect = 'auto';
      };
    }, [isResizingLeft, isResizingLogs]);


    // Wizard / Setup State
    const [setupProjectName, setSetupProjectName] = useState("");
    const [hasManuallyEditedProjectName, setHasManuallyEditedProjectName] = useState(false);
    const [setupFiles, setSetupFiles] = useState<File[]>([]);
    const [tempSelectedStandards, setTempSelectedStandards] = useState<string[]>([]);
    const [setupStage, setSetupStage] = useState<'input' | 'refining' | 'blueprint' | 'complete' | 'preview'>('input');
    const [projectPreview, setProjectPreview] = useState<any>(null);

    // Theme & Template State
    const [selectedTheme, setSelectedTheme] = useState<string>('modern');
    const [availableThemes, setAvailableThemes] = useState<any[]>([]); // Using any for Theme to avoid dep issues
    const [themeInput, setThemeInput] = useState('');
    const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
    const [selectedTemplateName, setSelectedTemplateName] = useState<string | null>(null);

    return {
        // View
        viewMode, setViewMode,
        isModernView, toggleModernView,
        activeTab, setActiveTab,
        isRestoring, setIsRestoring,
        isViewOnly, setIsViewOnly,
        sharedProjectToken, setSharedProjectToken,


        // Modals
        showSubscription, setShowSubscription, subscriptionMode, setSubscriptionMode,
        showUserLogin, setShowUserLogin,
        showUserSignup, setShowUserSignup,
        showPackageSelection, setShowPackageSelection,
        selectedPackage, setSelectedPackage,
        pendingUser, setPendingUser,
        showPayment, setShowPayment,
        adminToken, setAdminToken,
        adminUser, setAdminUser,

        showHITLPrompt, setShowHITLPrompt,
        hitlPreference, setHITLPreference,
        showAdminLogin, setShowAdminLogin,
        showFeedbackModal, setShowFeedbackModal,
        showUserProfile, setShowUserProfile,
        showShareModal, setShowShareModal,

        // Layout
        isLeftCollapsed, setIsLeftCollapsed,
        leftWidth, setLeftWidth,
        isResizingLeft, setIsResizingLeft,
        isLogsCollapsed, setIsLogsCollapsed,
        logHeight, setLogHeight,
        isResizingLogs, setIsResizingLogs,

        // Right Sidebar
        rightSidebarView, setRightSidebarView,
        isRightSidebarOpen, setIsRightSidebarOpen,


        // Chat
        globalChatInput, setGlobalChatInput,
        globalMessages, setGlobalMessages,
        isChatThinking, setIsChatThinking,
        activeChatAgent, setActiveChatAgent,
        chatHistory, setChatHistory,
        isEnhancingChat, setIsEnhancingChat,
        isResearchingChat, setIsResearchingChat,

        // Setup - Chat/Input
        setupInput, setSetupInput,
        setupMessages, setSetupMessages,
        isEnhancingInput, setIsEnhancingInput,
        isResearching, setIsResearching,
        setupInputRef,
        setupEndRef,
        globalChatEndRef,
        globalFileInputRef,
        globalChatInputRef,

        // Setup - Wizard Data
        setupProjectName, setSetupProjectName,
        hasManuallyEditedProjectName, setHasManuallyEditedProjectName,
        setupFiles, setSetupFiles,
        tempSelectedStandards, setTempSelectedStandards,
        setupStage, setSetupStage,
        projectPreview, setProjectPreview,

        // Theme & Templates
        selectedTheme, setSelectedTheme,
        availableThemes, setAvailableThemes,
        themeInput, setThemeInput,
        selectedTemplateId, setSelectedTemplateId,
        selectedTemplateName, setSelectedTemplateName,

        // AutoPilot
        autoPilotStatus, setAutoPilotStatus, autoPilotStatusRef,
        isStoppingRef, isBatchingRef, activeTaskControllersRef, batchIntervalRef, pendingActionRef,

        // Processing Overlay
        processingLabel, setProcessingLabel,
        processingProgress, setProcessingProgress,
        processingStatusText, setProcessingStatusText,
        processingEstimatedTime, setProcessingEstimatedTime,
        processingTaskCount, setProcessingTaskCount,
        processingStartTimeRef,

        // Toasts
        toasts, setToasts,
        currentError, setCurrentError,

        // Renaming & Confirmation
        tempName, setTempName,
        isRenaming, setIsRenaming,
        showConfirmation, setShowConfirmation,
        confirmationModal, setConfirmationModal,

        // Edits & Modals
        editingTask, setEditingTask,
        editingAgent, setEditingAgent,
        selectedAgentDetail, setSelectedAgentDetail,
        isCreatingNewAgent, setIsCreatingNewAgent,
        showWorkspaceTutorial, setShowWorkspaceTutorial,

        // Left Tab
        leftTab, setLeftTab,

        // Toggles & Views
        showTemplateSelector, setShowTemplateSelector,
        showSettings, setShowSettings,
        showThemeStudio, setShowThemeStudio,
        showProjectImport, setShowProjectImport,
        showExportDataMenu, setShowExportDataMenu,
        showShareProject, setShowShareProject,
        showReportExport, setShowReportExport,
        showTerminal, setShowTerminal,
        showMobileDeploymentWizard, setShowMobileDeploymentWizard,
        previewTab, setPreviewTab,
        showStandards, setShowStandards,
        isDraggingSetup, setIsDraggingSetup,
        isGeneratingSuggestions, setIsGeneratingSuggestions,
        displayedSuggestions, setDisplayedSuggestions,
        dynamicSuggestions, setDynamicSuggestions,
        isGeneratingTheme, setIsGeneratingTheme,
        dismissedGuestBanner, setDismissedGuestBanner,

        // API Health
        apiHealth, setApiHealth,

        // App Settings
        appSettings, setAppSettings, settingsRef,

        // Misc
        isProcessingFile, setIsProcessingFile,
        taskToDelete, setTaskToDelete,
        projectToDelete, setProjectToDelete
    };
}
