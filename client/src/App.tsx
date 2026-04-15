import React, { useState, useEffect, useRef, useCallback, Suspense, useMemo, startTransition } from 'react';
import {
  ProjectState, Phase, AgentRole, TaskStatus, LogEntry, Artifact, Agent, ChatMessage, UserProfile, Methodology, ProjectMetadata
} from '@orbitai/shared';
import { AGENTS, INITIAL_PROJECT_NAME, QUALITY_STANDARDS, PROJECT_THEMES } from '@orbitai/shared';
import { orchestrateNextSteps, generateAgentProfile, generateProjectPreview, ProjectPreview, generateQuickSuggestions, generateAppTheme } from './services/geminiService';
import { unmarkProjectAsSample } from './services/adminApi';
import { projectsApi, setAuthToken } from '@src/services/api';
import { createAuthHandlers } from './handlers/authHandlers';
import { createUIHandlers } from './handlers/uiHandlers';
import { createProjectHandlers } from './handlers/projectHandlers';
import { createTaskHandlers } from './handlers/taskHandlers';
import { createAiHandlers } from './handlers/aiHandlers';
import { createThemeHandlers } from './handlers/themeHandlers';
import { createSetupHandlers } from './handlers/setupHandlers';
import { createArtifactHandlers } from './handlers/artifactHandlers';
import { projectStorage, generateObjectId, isValidObjectId, cleanupInvalidProjectIds, cleanupProjectIdFromAllSources, isProjectNotFound } from './services/projectStorage';
import { agentAssignmentService } from './services/agentAssignment.service';
import AgentCard from './components/AgentCard';
import { hasCompletedTutorial } from './components/WorkspaceTutorial';
import { initializeBrowserUtils } from './utils/browserUtils';
import Logo from './components/Logo';
import Payment from './components/Payment';
import { Tooltip, HelpIcon } from './components/Tooltip';
import { useHistory } from './hooks/useHistory';
import { useFeatureAccessContext, FeatureAccessProvider } from './contexts/FeatureAccessContext';
import { useUserSettings } from './hooks/useUserSettings';
import { useProjectState } from './hooks/useProjectState';
import { useProjectManagement } from './hooks/useProjectManagement';
import { useAppState, ViewMode } from './hooks/useAppState';
import { useAuth } from './contexts/AuthContext';
import { SkipLink } from './components/SkipLink';
import { ProjectTemplate } from '@orbitai/shared';
import { AppShell } from './components/AppShell';
import { AppRouter } from './components/AppRouter';
import { toastService, Toast } from './services/toastService';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Settings, RotateCw, Layout, FileText, ChevronRight, ChevronLeft, Hexagon, Activity, GripVertical, Code, Zap, StopCircle, Bot, Globe, Network, MessageSquare, Users, Send, Sparkles, User, Paperclip, Trash2, ArrowDown, Wand2, MessageSquarePlus, ShieldCheck, CheckSquare, Pause, Square, Terminal as TerminalIcon, Microscope, Book, CreditCard, Layers, Plus, Folder, LayoutGrid, Clock, Calendar, Gauge, Signal, Repeat, FilePlus, X, Save, Edit2, ShoppingCart, Gamepad2, Database, Smartphone, Server, Shield, Crown, Lock, Eye, GitGraph, FileCode, Play, Cpu, ShieldAlert, Palette, Dices, Undo2, Redo2, LogOut, Share2, Rocket, Heart, Ticket, Download, FileJson, Upload, Loader2, WifiOff } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import JSZip from 'jszip';
// @ts-ignore
import remarkGfm from 'remark-gfm';
import { cleanMermaidCode } from './utils/mermaidUtils';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { v4 as uuidv4 } from 'uuid';
import { useAppEffects } from './hooks/useAppEffects';
import { useSetupChat } from './hooks/useSetupChat';

const generateMessageId = () => uuidv4();

/**
 * AppContent - Main application component that uses feature flags
 * This is wrapped by App component which provides FeatureAccessProvider
 */
const AppContent: React.FC = () => {
  const isAuthCallback = window.location.pathname === '/auth/callback';
  const [OAuthCallbackComponent, setOAuthCallbackComponent] = useState<React.FC | null>(null);

  useEffect(() => {
    if (isAuthCallback) {
      import('./views/OAuthCallback').then(module => {
        setOAuthCallbackComponent(() => module.default);
      });
    }
  }, [isAuthCallback]);

  // --- CORE STATE ---
  const { state, dispatch, actions } = useProjectState();
  const stateRef = useRef(state);
  stateRef.current = state;

  const appState = useAppState();
  const {
    viewMode, setViewMode, isModernView, toggleModernView, activeTab, setActiveTab,
    isRestoring, setIsRestoring, isViewOnly, setIsViewOnly,
    sharedProjectToken, setSharedProjectToken,
    showSubscription, setShowSubscription, subscriptionMode, setSubscriptionMode,
    showUserLogin, setShowUserLogin, showUserSignup, setShowUserSignup,
    showPackageSelection, setShowPackageSelection, selectedPackage, setSelectedPackage,
    pendingUser, setPendingUser, showPayment, setShowPayment,
    adminToken, setAdminToken, adminUser, setAdminUser,
    editingTask, setEditingTask, editingAgent, setEditingAgent,
    selectedAgentDetail, setSelectedAgentDetail, isCreatingNewAgent, setIsCreatingNewAgent,
    showWorkspaceTutorial, setShowWorkspaceTutorial, leftTab, setLeftTab,
    showHITLPrompt, setShowHITLPrompt, hitlPreference, setHITLPreference,
    showAdminLogin, setShowAdminLogin, showFeedbackModal, setShowFeedbackModal,
    showUserProfile, setShowUserProfile, showShareModal, setShowShareModal,
    isLeftCollapsed, setIsLeftCollapsed, leftWidth, setLeftWidth,
    isResizingLeft, setIsResizingLeft, isLogsCollapsed, setIsLogsCollapsed,
    logHeight, setLogHeight, isResizingLogs, setIsResizingLogs,
    rightSidebarView, setRightSidebarView, isRightSidebarOpen, setIsRightSidebarOpen,
    globalChatInput, setGlobalChatInput, globalMessages, setGlobalMessages,
    isChatThinking, setIsChatThinking, activeChatAgent, setActiveChatAgent,
    chatHistory, setChatHistory, isEnhancingChat, setIsEnhancingChat,
    isResearchingChat, setIsResearchingChat,
    setupInput, setSetupInput, setupMessages, setSetupMessages,
    isEnhancingInput, setIsEnhancingInput, isResearching, setIsResearching,
    setupInputRef, setupEndRef, globalChatEndRef, globalFileInputRef, globalChatInputRef,
    setupProjectName, setSetupProjectName,
    hasManuallyEditedProjectName, setHasManuallyEditedProjectName,
    setupFiles, setSetupFiles, tempSelectedStandards, setTempSelectedStandards,
    setupStage, setSetupStage, projectPreview, setProjectPreview,
    showTemplateSelector, setShowTemplateSelector, showSettings, setShowSettings,
    showThemeStudio, setShowThemeStudio, showProjectImport, setShowProjectImport,
    showExportDataMenu, setShowExportDataMenu, showShareProject, setShowShareProject,
    showReportExport, setShowReportExport, showTerminal, setShowTerminal,
    showMobileDeploymentWizard, setShowMobileDeploymentWizard,
    previewTab, setPreviewTab, showStandards, setShowStandards,
    isDraggingSetup, setIsDraggingSetup,
    isGeneratingSuggestions, setIsGeneratingSuggestions,
    displayedSuggestions, setDisplayedSuggestions,
    dynamicSuggestions, setDynamicSuggestions,
    isGeneratingTheme, setIsGeneratingTheme,
    dismissedGuestBanner, setDismissedGuestBanner,
    apiHealth, setApiHealth,
    selectedTheme, setSelectedTheme, availableThemes, setAvailableThemes,
    themeInput, setThemeInput, selectedTemplateId, setSelectedTemplateId,
    selectedTemplateName, setSelectedTemplateName,
    autoPilotStatus, setAutoPilotStatus, autoPilotStatusRef,
    isStoppingRef, isBatchingRef, activeTaskControllersRef, batchIntervalRef, pendingActionRef,
    processingLabel, setProcessingLabel, processingProgress, setProcessingProgress,
    processingStatusText, setProcessingStatusText,
    processingEstimatedTime, setProcessingEstimatedTime,
    processingTaskCount, setProcessingTaskCount, processingStartTimeRef,
    toasts, setToasts, currentError, setCurrentError,
    tempName, setTempName, isRenaming, setIsRenaming, showConfirmation, setShowConfirmation,
    appSettings, setAppSettings, settingsRef,
    globalFileInputRef: _ignoredGlobalFileInputRef, isProcessingFile, setIsProcessingFile,
    taskToDelete, setTaskToDelete, projectToDelete, setProjectToDelete,
  } = appState;

  // --- HISTORY ---
  const history = useHistory(state);
  const historyRef = useRef(history);
  useEffect(() => { historyRef.current = history; }, [history]);
  const confirmationResolverRef = useRef<((value: boolean) => void) | null>(null);

  // --- AUTH ---
  const { user, loading: authLoading, updateUser, logout: authLogout } = useAuth();
  const { settings: userSettings, updateSettings, updatePreference, loading: settingsLoading } = useUserSettings(user?.token || null);

  const isAdminUser = useCallback((u: UserProfile | null): boolean => {
    if (!u) return false;
    let role = u.role?.toLowerCase()?.trim();
    if (!role) {
      try {
        const s = localStorage.getItem('orbitai_user');
        if (s) role = JSON.parse(s)?.role?.toLowerCase()?.trim();
      } catch (e) { console.error('Failed to check localStorage for role', e); }
    }
    return role === 'admin' || role === 'superadmin';
  }, []);

  const userEmailRef = useRef<string | undefined>(user?.email);
  const hasRefreshedRoleRef = useRef(false);
  const previousUserRoleRef = useRef<string>('public');
  const hasClearedCacheRef = useRef<boolean>(false);

  const userRole = useMemo(() => {
    return user?.role ? user.role.toLowerCase().trim() : 'public';
  }, [user?.role]);

  // --- FEATURE FLAGS (simplified — all enabled by default) ---
  const defaultFeature = { enabled: true, loading: false };
  const canViewSamples = defaultFeature, canCreateProjects = defaultFeature;
  const canDeleteProjects = defaultFeature, canSwitchEnvironment = defaultFeature;
  const canExportProjects = defaultFeature, canShareProjects = defaultFeature;
  const canImportProjects = defaultFeature, canExportReports = defaultFeature;
  const canExportData = defaultFeature, canAccessTerminal = defaultFeature;
  const canUseTemplates = defaultFeature, canViewAllProjects = defaultFeature;
  const canUseCodeEditor = defaultFeature, canUseArtifactViewer = defaultFeature;
  const canUsePreviewMode = defaultFeature, canUseAIChat = defaultFeature;
  const canUseAICodeGeneration = defaultFeature, canUseAITaskAutomation = defaultFeature;
  const canUseAISuggestions = defaultFeature, canCustomizeAgents = defaultFeature;
  const canDeleteAgents = defaultFeature, canAutomateAgents = defaultFeature;

  const isFeatureEnabled = (feature: { enabled: boolean; loading: boolean } | undefined) =>
    !feature?.loading && (feature?.enabled ?? true);
  const shouldShowFeature = (feature: { enabled: boolean; loading: boolean } | undefined) =>
    !feature?.loading && (feature?.enabled ?? true);
  const isButtonDisabled = (feature: { enabled: boolean; loading: boolean } | undefined) =>
    feature?.loading || !(feature?.enabled ?? true);

  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  const safeDispatch = dispatch || (() => {});
  const safeSetGlobalMessages = setGlobalMessages || (() => {});

  const addLog = useCallback((message: string, agentRole: string | any = AgentRole.ORCHESTRATOR, type: LogEntry['type'] = 'info', taskId?: string) => {
    if (!dispatch) return;
    dispatch({ type: 'ADD_LOG', payload: { id: Math.random().toString(36).substring(7), timestamp: Date.now(), agent: agentRole, message, type } });
    if (taskId) {
      const timestamp = new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
      dispatch({ type: 'ADD_TASK_LOG', payload: { id: taskId, message: `[${timestamp}] ${message}` } });
    }
    if (type === 'action' || type === 'error' || type === 'success' || (agentRole === AgentRole.ORCHESTRATOR && type === 'info')) {
      const agentObj = (stateRef.current?.agents || []).find((a: Agent) => a.role === agentRole) || AGENTS.find(a => a.role === agentRole);
      if (agentObj && setGlobalMessages) {
        setGlobalMessages(prev => [...prev, { id: Math.random().toString(36), sender: 'agent', text: message, timestamp: Date.now(), agentId: agentObj.id, isLogEvent: true }]);
      }
    }
  }, [safeDispatch, safeSetGlobalMessages]);

  const stopAutoPilotRef = useRef<() => void>(() => setAutoPilotStatus('idle'));
  const stopAutoPilot = useCallback(() => stopAutoPilotRef.current(), []);
  const uiHelpers = useMemo(() => ({ setGlobalMessages: safeSetGlobalMessages, addLog }), [safeSetGlobalMessages, addLog]);

  // --- PROJECT MANAGEMENT ---
  const pm = useProjectManagement({
    user, state, dispatch,
    viewModeHelpers: { viewMode, setViewMode },
    featureFlags: { canCreateProjects, canViewSamples, isFeatureEnabled: (f: any) => isFeatureEnabled(f), shouldShowFeature: (f: any) => shouldShowFeature(f) },
    autoPilot: { stop: stopAutoPilot },
    uiHelpers,
    setupHelpers: { setSetupMessages, setSetupInput, setSetupProjectName, setHasManuallyEditedProjectName, setSetupFiles, setTempSelectedStandards, setSetupStage, setProjectPreview },
    themeHelpers: { setSelectedTheme, setAvailableThemes, setThemeInput },
    templateHelpers: { setSelectedTemplateId, setSelectedTemplateName },
  });
  const { projectList, sampleProjects, loadingSamples, hasLoaded } = pm.state;
  const { setHasLoaded, setProjectList, setSampleProjects, setLoadingSamples,
    handleCreateNewProject, handleLoadProject, handleLoadDemoProject,
    handleSelectTemplate, handleSaveAsTemplate, deleteProject } = pm.actions;

  // --- UI HANDLERS ---
  const {
    showConfirmation: showConfirmationUi, handleUndo, handleRedo,
    toggleRightSidebar, handleOpenSettings,
  } = React.useMemo(() => createUIHandlers({
    setShowConfirmation: (show: boolean) => { appState.setConfirmationModal((prev: any) => ({ ...prev, isOpen: show })); },
    setConfirmationConfig: (config: any) => { appState.setConfirmationModal((prev: any) => ({ ...prev, ...config })); },
    setRightSidebarView, setIsRightSidebarOpen, setShowSettings,
    confirmationResolverRef, historyRef,
  }), [setRightSidebarView, setIsRightSidebarOpen, setShowSettings, historyRef, confirmationResolverRef]);

  const stopExecution = React.useCallback(() => {
    isStoppingRef.current = true; isBatchingRef.current = false;
    setAutoPilotStatus('idle'); autoPilotStatusRef.current = 'idle';
    if (batchIntervalRef.current) { clearInterval(batchIntervalRef.current); batchIntervalRef.current = null; }
    activeTaskControllersRef.current.forEach((c: AbortController) => c.abort());
    activeTaskControllersRef.current.clear();
    dispatch({ type: 'SET_PROCESSING', payload: false });
  }, [setAutoPilotStatus, dispatch]);

  // --- REFS ---
  const userLoadedRef = useRef(false);
  const viewModeRef = useRef(viewMode);
  const userRef = useRef(user);
  const isManuallyLoadingProjectRef = useRef(false);
  const isProgrammaticHashChangeRef = useRef(false);
  const prevViewModeRef = useRef<ViewMode | null>(null);

  // --- AUTH HANDLERS ---
  const {
    handleLaunchDemo, handleSignup, handleLogin,
    handleUserLoginSuccess, handleUserSignupSuccess,
    handlePackageSelect, handlePaymentSuccess, completeSignup,
    handleUpgradeClick, handleProfileClick, handleAdminClick,
    handleAdminLoginSuccess, handleAdminLogout, handleUserLogout,
  } = React.useMemo(() => createAuthHandlers({
    setViewMode, setShowUserLogin, setShowUserSignup, setShowSubscription,
    setShowPackageSelection, setShowPayment, setShowUserProfile,
    setSelectedPackage, setPendingUser, setSubscriptionMode,
    setAdminToken, setAdminUser, isProgrammaticHashChangeRef,
    user, projectList, selectedPackage, pendingUser,
    handleCreateNewProject, authLogout,
  }), [
    setViewMode, setShowUserLogin, setShowUserSignup, setShowSubscription,
    setShowPackageSelection, setShowPayment, setShowUserProfile,
    setSelectedPackage, setPendingUser, setSubscriptionMode,
    setAdminToken, setAdminUser, isProgrammaticHashChangeRef,
    user, projectList, selectedPackage, pendingUser,
    handleCreateNewProject, authLogout,
  ]);

  const handleToggleLogsCollapse = useCallback(() => { setIsLogsCollapsed(prev => !prev); }, []);

  // --- SAVE PROJECT REFS ---
  const saveProjectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSaveTimeRef = useRef<number>(0);
  const pendingSaveRef = useRef<boolean>(false);
  const fixingInvalidIdRef = useRef<string | null>(null);
  const MIN_SAVE_INTERVAL = 2000;
  const DEBOUNCE_DELAY = 1000;

  // --- PROJECT HANDLERS ---
  const {
    saveProject, handleLoadSharedProject: loadSharedProject,
    handleLaunchApp: launchApp, handleDeleteProject,
    handleToggleSampleProject, handleExportProjectData, handleRenameProject,
  } = React.useMemo(() => createProjectHandlers({
    stateRef, dispatch, user, viewMode, startTransition, setIsViewOnly, setSharedProjectToken,
    setAutoPilotStatus, autoPilotStatusRef, isStoppingRef, isBatchingRef, batchIntervalRef,
    activeTaskControllersRef, setGlobalMessages, setShowUserLogin, projectList,
    handleCreateNewProject, fixingInvalidIdRef, setProjectToDelete, adminToken, isAdminUser,
    setProjectList, sampleProjects, setSampleProjects, canExportData, isFeatureEnabled,
    tempName, setIsRenaming, showConfirmation, addLog,
  }), [
    stateRef, dispatch, user, viewMode, setIsViewOnly, setSharedProjectToken,
    setAutoPilotStatus, autoPilotStatusRef, isStoppingRef, isBatchingRef, batchIntervalRef,
    activeTaskControllersRef, setGlobalMessages, setShowUserLogin, projectList,
    handleCreateNewProject, fixingInvalidIdRef, setProjectToDelete, adminToken, isAdminUser,
    setProjectList, sampleProjects, setSampleProjects, canExportData, isFeatureEnabled,
    tempName, setIsRenaming, showConfirmation, addLog,
  ]);

  // --- TASK HANDLERS ---
  const {
    handleDeleteTask, confirmDeleteTask, handleUpdateTask, handleAiModifyTask,
    handleRunAudit, executeTask, handleApproveTask, handleRejectTask,
  } = React.useMemo(() => createTaskHandlers({
    stateRef, dispatch, addLog, setTaskToDelete, taskToDelete,
    activeTaskControllersRef, settingsRef, setGlobalMessages: safeSetGlobalMessages,
  }), [stateRef, dispatch, addLog, setTaskToDelete, taskToDelete, activeTaskControllersRef, settingsRef, safeSetGlobalMessages]);

  const handleLaunchApp = launchApp;
  const handleLoadSharedProject = loadSharedProject;

  // --- AI HANDLERS ---
  const {
    startAutoPilot: aiStartAutoPilot, stopAutoPilot: aiStopAutoPilot,
    handleAutoPilotClick, handleEnhanceInput, handleDeepResearch, handleSuggestionClick,
    handleOpenChat, handleSendMessage, handleGlobalChatSend, handleRunAllTasks,
    advancePhase, startNextSprint, regressPhase, handleForceBuild, handleGlobalFileSelect,
  } = React.useMemo(() => createAiHandlers({
    stateRef, dispatch, addLog, autoPilotStatus, autoPilotStatusRef, setAutoPilotStatus,
    isStoppingRef, isBatchingRef, activeTaskControllersRef,
    setGlobalMessages: safeSetGlobalMessages, globalMessages, setGlobalChatInput, globalChatInput,
    setSetupMessages, setSetupInput, setupInputRef, setupInput,
    setIsEnhancingChat, setIsEnhancingInput, setIsResearchingChat, setIsResearching,
    activeChatAgent, setActiveChatAgent, chatHistory, setChatHistory, setIsChatThinking, isChatThinking,
    user, handleUpgradeClick, pendingActionRef, setShowHITLPrompt, setAppSettings,
    startTransition, setActiveTab, executeTask, settingsRef, batchIntervalRef,
    setIsProcessingFile, globalFileInputRef,
  }), [
    stateRef, dispatch, addLog, autoPilotStatus, autoPilotStatusRef, setAutoPilotStatus,
    isStoppingRef, isBatchingRef, activeTaskControllersRef,
    safeSetGlobalMessages, globalMessages, setGlobalChatInput, globalChatInput,
    setSetupMessages, setSetupInput, setupInputRef, setupInput,
    setIsEnhancingChat, setIsEnhancingInput, setIsResearchingChat, setIsResearching,
    activeChatAgent, setActiveChatAgent, chatHistory, setChatHistory, setIsChatThinking, isChatThinking,
    user, handleUpgradeClick, pendingActionRef, setShowHITLPrompt, setAppSettings,
    startTransition, setActiveTab, executeTask, settingsRef, batchIntervalRef,
    setIsProcessingFile, globalFileInputRef,
  ]);

  React.useEffect(() => { if (aiStopAutoPilot) stopAutoPilotRef.current = aiStopAutoPilot; }, [aiStopAutoPilot]);

  const debouncedSaveProject = useCallback(() => {
    if (saveProjectTimeoutRef.current) clearTimeout(saveProjectTimeoutRef.current);
    const now = Date.now();
    const timeSinceLastSave = now - lastSaveTimeRef.current;
    if (timeSinceLastSave < MIN_SAVE_INTERVAL && !pendingSaveRef.current) {
      saveProjectTimeoutRef.current = setTimeout(() => {
        pendingSaveRef.current = true;
        lastSaveTimeRef.current = Date.now();
        saveProject().finally(() => { pendingSaveRef.current = false; });
      }, MIN_SAVE_INTERVAL - timeSinceLastSave);
    } else if (!pendingSaveRef.current) {
      saveProjectTimeoutRef.current = setTimeout(() => {
        pendingSaveRef.current = true;
        lastSaveTimeRef.current = Date.now();
        saveProject().finally(() => { pendingSaveRef.current = false; });
      }, DEBOUNCE_DELAY);
    }
  }, [saveProject]);

  // --- ALL EFFECTS (extracted to useAppEffects) ---
  useAppEffects({
    user, userRole, state, stateRef, dispatch, appSettings, settingsRef,
    autoPilotStatus, autoPilotStatusRef, isStoppingRef, isBatchingRef, batchIntervalRef,
    activeTaskControllersRef, previousUserRoleRef, hasClearedCacheRef, hasRefreshedRoleRef,
    viewModeRef, userRef, isManuallyLoadingProjectRef, prevViewModeRef,
    setIsOffline, setAutoPilotStatus, setIsRestoring, setViewMode, setSelectedTheme,
    setIsLogsCollapsed, setLogHeight, setIsResizingLeft, setIsResizingLogs, setLeftWidth,
    setActiveTab, setLeftTab, setDynamicSuggestions, setDisplayedSuggestions,
    setIsGeneratingSuggestions, setSetupMessages, setShowWorkspaceTutorial,
    canUseAISuggestions, canUseCodeEditor, canUseArtifactViewer, canUseAIChat, shouldShowFeature,
    isResizingLeft, isResizingLogs, leftTab, activeTab, setupInput, setupMessages,
    viewMode, setupStage, globalMessages, setupEndRef, globalChatEndRef, dynamicSuggestions,
    saveProject, handleLoadSharedProject, debouncedSaveProject, addLog, updateUser, updatePreference,
    hasLoaded, showWorkspaceTutorial, saveProjectTimeoutRef, setupInputRef,
  });

  // --- SETUP CHAT HANDLERS (extracted to useSetupChat) ---
  const { handleSetupSend, handleJumpToPreview, handleManualLaunch, orchestratePhase, canProceedToPreview } = useSetupChat({
    setupInput, setupFiles, state, stateRef, setupMessages, projectPreview,
    setupStage, setupProjectName, hasManuallyEditedProjectName, tempSelectedStandards,
    selectedTheme, availableThemes, selectedTemplateId, selectedTemplateName, user,
    setSetupInput, setSetupMessages, setProjectPreview, setSetupStage, setSetupProjectName,
    setTempSelectedStandards, setProcessingLabel, setProcessingProgress, setProcessingStatusText,
    setProcessingEstimatedTime, setProcessingTaskCount, processingStartTimeRef,
    setIsResearching, setDynamicSuggestions, setViewMode, setGlobalMessages, setSetupFiles,
    dispatch, saveProject, addLog, setupInputRef, settingsRef,
    isStoppingRef, isBatchingRef, batchIntervalRef, activeTaskControllersRef, autoPilotStatusRef,
    setAutoPilotStatus,
  });

  // --- SETUP / BRAINSTORMING HANDLERS ---
  const { handleSetupDragOver, handleSetupDragLeave, handleSetupDrop, removeSetupFile,
    handleLaunchFromBrainstorming } = createSetupHandlers({
    setIsDraggingSetup, setSetupFiles, dispatch, stateRef, state, user,
    setProcessingLabel, setProcessingProgress, setViewMode, saveProject, addLog, orchestratePhase,
  });

  // --- THEME HANDLERS ---
  const { handleAiThemeGen, handleRandomTheme } = React.useMemo(() => createThemeHandlers({
    themeInput, setThemeInput, setIsGeneratingTheme, setAvailableThemes,
    setSelectedTheme, availableThemes, state, dispatch,
  }), [themeInput, setThemeInput, setIsGeneratingTheme, setAvailableThemes,
    setSelectedTheme, availableThemes, state, dispatch]);

  // --- SMALL INLINE HANDLERS ---
  const toggleStandard = useCallback((id: string) => {
    setTempSelectedStandards(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]);
  }, [setTempSelectedStandards]);

  const handleAddStandard = (id: string) => {
    const current = state.selectedStandards;
    if (!current.includes(id)) {
      dispatch({ type: 'SET_STANDARDS', payload: [...current, id] });
      const stdName = QUALITY_STANDARDS.find(s => s.id === id)?.name;
      addLog(`Compliance Protocol Added: ${stdName}`, AgentRole.QA_AUDIT_AGENT, 'action');
    }
  };
  const handleRemoveStandard = (id: string) => {
    dispatch({ type: 'SET_STANDARDS', payload: state.selectedStandards.filter(s => s !== id) });
    const stdName = QUALITY_STANDARDS.find(s => s.id === id)?.name;
    addLog(`Compliance Protocol Removed: ${stdName}`, AgentRole.QA_AUDIT_AGENT, 'info');
  };
  const handleResetProject = () => { setViewMode('setup'); };
  const handleSaveArtifact = (id: string, content: string) => { dispatch({ type: 'UPDATE_ARTIFACT', payload: { id, content } }); addLog(`Artifact manually updated via IDE`, AgentRole.IMPLEMENTATION_AGENT, 'info'); };
  const handleArtifactUpload = (file: File, content: string | ArrayBuffer) => {
    let type: Artifact['type'] = 'code';
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    if (file.type.startsWith('image/')) type = 'image';
    else if (file.type.startsWith('audio/')) type = 'audio';
    else if (ext === 'md' || ext === 'txt') type = 'requirement';
    else if (ext === 'json') type = 'design';
    else if (ext === 'html') type = 'build';
    const newArtifact: Artifact = { id: Math.random().toString(36).substring(7), title: file.name, content: content as string, type, phase: stateRef.current.currentPhase, createdBy: AgentRole.IMPLEMENTATION_AGENT, timestamp: Date.now(), tags: ['uploaded', stateRef.current.currentPhase] };
    dispatch({ type: 'ADD_ARTIFACT', payload: newArtifact });
    addLog(`File uploaded: ${file.name}`, AgentRole.ORCHESTRATOR, 'info');
  };

  const TabButton = ({ id, label, icon: Icon, active, onClick, count, className = '' }: { id: string, label: string, icon: any, active: boolean, onClick: () => void, count?: number, className?: string }) => (
    <button onClick={onClick} className={`relative px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all duration-300 flex items-center gap-1 shrink-0 ${active ? 'bg-primary text-white shadow-md shadow-primary/20' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200'} ${className}`}>
      <Icon size={12} /> <span className="whitespace-nowrap">{label}</span> {count !== undefined && count > 0 && <span className={`ml-1 px-1 py-0.5 rounded-full text-[8px] font-mono ${active ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-500'}`}>{count}</span>}
    </button>
  );

  const hasFrontend = useMemo(() => {
    if (!projectPreview?.techStack) return true;
    return projectPreview.techStack.some((t: string) => /react|vue|angular|svelte|html|css|web|ui|frontend|mobile|app/i.test(t));
  }, [projectPreview]);

  const architectureDiagramContent = projectPreview?.architectureDiagram;
  const lastValidArtifactRef = useRef<{ id: string; title: string; type: 'design'; content: string; phase: Phase; createdBy: typeof AgentRole[keyof typeof AgentRole]; timestamp: number; tags: string[]; } | null>(null);

  const architectureArtifact = useMemo(() => {
    if (!architectureDiagramContent) { return lastValidArtifactRef.current; }
    const cleaned = cleanMermaidCode(architectureDiagramContent);
    if (!cleaned || cleaned.trim().length === 0) { return lastValidArtifactRef.current; }
    const newArtifact = { id: 'preview-arch', title: 'Architecture.mermaid', type: 'design' as const, content: cleaned, phase: Phase.INITIATION, createdBy: AgentRole.DESIGN_ARCH_AGENT, timestamp: Date.now(), tags: ['preview'] };
    lastValidArtifactRef.current = newArtifact;
    return newArtifact;
  }, [architectureDiagramContent]);

  const wireframeArtifact = useMemo(() => {
    if (!projectPreview?.wireframeCode) return null;
    return { id: 'preview-wireframe', title: 'Prototype.html', type: 'build' as const, content: projectPreview.wireframeCode, phase: Phase.INITIATION, createdBy: AgentRole.UX_DESIGNER, timestamp: Date.now(), tags: ['preview'] };
  }, [projectPreview?.wireframeCode]);

  const isDemoMode = !user && !isViewOnly && viewMode === 'workspace';

  // --- RENDER ---
  if (isAuthCallback) {
    if (!OAuthCallbackComponent) return <div className="fixed inset-0 flex items-center justify-center bg-slate-900 text-white">Loading Auth...</div>;
    return <OAuthCallbackComponent />;
  }

  return (
    <div className={`flex flex-col font-sans selection:bg-primary selection:text-white relative ${isModernView && viewMode === 'workspace' ? 'bg-slate-900 text-slate-50' : 'bg-slate-50 text-slate-900'} ${viewMode === 'landing' ? '' : 'h-screen overflow-hidden'}`}>

      {/* Offline Banner */}
      {isOffline && (
        <div className="fixed top-0 left-0 right-0 z-[300] bg-red-600 text-white px-4 py-3 flex items-center justify-center gap-3 animate-in slide-in-from-top duration-300 shadow-lg">
          <WifiOff size={20} />
          <p className="text-sm font-bold">
            Platform cannot be used offline. Please connect to the internet.
          </p>
        </div>
      )}

      {/* App Router - Handles all view routing */}




      <AppShell
        viewMode={viewMode}
        isModernView={isModernView}
        isOffline={isOffline}
        state={state}
        user={user}
        toasts={appState.toasts}

        // Modals
        showSubscription={appState.showSubscription}
        setShowSubscription={appState.setShowSubscription}
        subscriptionMode={appState.subscriptionMode}
        setSubscriptionMode={appState.setSubscriptionMode}
        showThemeStudio={appState.showThemeStudio}
        setShowThemeStudio={appState.setShowThemeStudio}
        showUserProfile={appState.showUserProfile}
        setShowUserProfile={appState.setShowUserProfile}
        showUserLogin={appState.showUserLogin}
        setShowUserLogin={appState.setShowUserLogin}
        showUserSignup={appState.showUserSignup}
        setShowUserSignup={appState.setShowUserSignup}
        handleUserLoginSuccess={handleUserLoginSuccess}
        handleUserSignupSuccess={handleUserSignupSuccess}
        showHITLPrompt={appState.showHITLPrompt}
        setShowHITLPrompt={appState.setShowHITLPrompt}
        showSettings={appState.showSettings}
        setShowSettings={appState.setShowSettings}
        showTemplateSelector={appState.showTemplateSelector}
        setShowTemplateSelector={appState.setShowTemplateSelector}

        // Modal Data
        editingTask={appState.editingTask}
        setEditingTask={appState.setEditingTask}
        selectedAgentDetail={appState.selectedAgentDetail}
        setSelectedAgentDetail={appState.setSelectedAgentDetail}
        editingAgent={appState.editingAgent}
        setEditingAgent={appState.setEditingAgent}
        isCreatingNewAgent={appState.isCreatingNewAgent}
        setIsCreatingNewAgent={appState.setIsCreatingNewAgent}

        projectToDelete={appState.projectToDelete}
        setProjectToDelete={appState.setProjectToDelete}
        taskToDelete={appState.taskToDelete}
        setTaskToDelete={appState.setTaskToDelete}

        confirmationModal={appState.confirmationModal}
        setConfirmationModal={appState.setConfirmationModal}

        currentError={currentError}
        setCurrentError={setCurrentError}

        // Processing
        processingLabel={appState.processingLabel}
        processingProgress={appState.processingProgress}
        processingStatusText={appState.processingStatusText}
        processingEstimatedTime={appState.processingEstimatedTime}
        processingTaskCount={appState.processingTaskCount}

        // Chat
        activeChatAgent={appState.activeChatAgent}
        setActiveChatAgent={appState.setActiveChatAgent}
        chatHistory={appState.chatHistory}
        isChatThinking={appState.isChatThinking}

        // Handlers
        handleLogin={handleLogin}
        handleUserLogout={handleUserLogout}
        toggleModernView={toggleModernView}
        handleUpdateTask={handleUpdateTask}
        handleAiModifyTask={handleAiModifyTask}
        setHITLPreference={setHITLPreference}
        pendingActionRef={pendingActionRef}
        handleResetProject={handleResetProject}
        userRole={userRole}
        dispatch={dispatch}
        addLog={addLog}
        handleSelectTemplate={handleSelectTemplate}
        handleSaveAsTemplate={handleSaveAsTemplate}
        canCustomizeAgents={canCustomizeAgents}
        isFeatureEnabled={isFeatureEnabled}
        handleSendMessage={handleSendMessage}
        confirmDeleteTask={confirmDeleteTask}
        deleteProject={handleDeleteProject}

        // Theme Studio
        themeInput={appState.themeInput}
        setThemeInput={appState.setThemeInput}
        handleAiThemeGen={handleAiThemeGen}
        handleRandomTheme={handleRandomTheme}
        isGeneratingTheme={appState.isGeneratingTheme}
        availableThemes={appState.availableThemes}
        selectedTheme={appState.selectedTheme}
        setSelectedTheme={appState.setSelectedTheme}

        apiHealth={appState.apiHealth}
      >
        <ErrorBoundary>
          <Suspense fallback={<div className="flex items-center justify-center h-screen"><Loader2 className="animate-spin text-primary" size={32} /></div>}>
            <AppRouter
              isModernView={isModernView}
              viewMode={viewMode}
              // Landing view props
              onLaunch={handleLaunchApp}
              onLaunchDemo={handleLaunchDemo}
              onSignup={handleSignup}
              // Core state
              state={state}
              dispatch={dispatch}
              // User & Auth
              user={user}
              isViewOnly={isViewOnly}
              dismissedGuestBanner={appState.dismissedGuestBanner}
              setDismissedGuestBanner={appState.setDismissedGuestBanner}
              isRestoring={appState.isRestoring as any} // Cast if type mismatch from isRestoring definition? (boolean vs helper?) It's boolean now.
              showWorkspaceTutorial={appState.showWorkspaceTutorial}
              // Hub view props
              projectList={projectList}
              sampleProjects={sampleProjects}
              loadingSamples={loadingSamples}
              projectToDelete={appState.projectToDelete} // AppRouter uses this? No, AppShell uses DeleteModal. But HubView might use it to show modal? HubView calls setProjectToDelete.
              // HubView props: projectToDelete={projectToDelete} (to disable buttons or show?)
              // Let's pass it anyway if it expects it.
              canViewSamples={canViewSamples}
              canCreateProjects={canCreateProjects}
              canDeleteProjects={canDeleteProjects}
              canViewAllProjects={canViewAllProjects}
              canUseTemplates={canUseTemplates}
              canImportProjects={canImportProjects}
              handleAdminClick={handleAdminClick}
              handleProfileClick={handleProfileClick}
              handleUserLogout={handleUserLogout}
              handleToggleSampleProject={handleToggleSampleProject}
              handleCreateNewProject={handleCreateNewProject}
              handleLoadProject={handleLoadProject}
              handleLoadDemoProject={handleLoadDemoProject}
              handleDeleteProject={handleDeleteProject}
              setShowUserSignup={setShowUserSignup}
              setShowUserLogin={setShowUserLogin}
              setShowTemplateSelector={appState.setShowTemplateSelector}
              setShowProjectImport={appState.setShowProjectImport}
              isFeatureEnabled={isFeatureEnabled}
              isButtonDisabled={isButtonDisabled}
              shouldShowFeature={shouldShowFeature}
              // Setup view props
              setupMessages={setupMessages}
              setSetupMessages={setSetupMessages}
              setupInput={setupInput}
              setSetupInput={setSetupInput}
              setupFiles={setupFiles}
              setSetupFiles={setSetupFiles}
              setupProjectName={setupProjectName}
              setSetupProjectName={setSetupProjectName}
              hasManuallyEditedProjectName={hasManuallyEditedProjectName}
              setHasManuallyEditedProjectName={setHasManuallyEditedProjectName}
              setupStage={setupStage}
              setSetupStage={setSetupStage}
              projectPreview={projectPreview} // Need to pass projectPreview from pm.state? No, it's local in App or from pm?
              // Wait, setup state is in App.tsx locally (lines 2800+)?
              // I haven't extracted SetupHandlers or SetupState yet?
              // SetupState is in useAppState!
              setProjectPreview={pm.setProjectPreview} // Wait, useProjectManagement has setProjectPreview? Or useAppState?
              // useAppState has projectPreview and setProjectPreview
              previewTab={appState.previewTab}
              setPreviewTab={appState.setPreviewTab}
              tempSelectedStandards={appState.tempSelectedStandards}
              setTempSelectedStandards={appState.setTempSelectedStandards}
              showStandards={appState.showStandards}
              setShowStandards={appState.setShowStandards}
              isDraggingSetup={appState.isDraggingSetup}
              setIsDraggingSetup={appState.setIsDraggingSetup}
              isResearching={appState.isResearching}
              setIsResearching={appState.setIsResearching}
              isEnhancingInput={appState.isEnhancingInput}
              setIsEnhancingInput={appState.setIsEnhancingInput}
              isGeneratingSuggestions={appState.isGeneratingSuggestions} // Boolean? or array? useAppState had array?
              // useAppState: isGeneratingSuggestions is array?
              // const [isGeneratingSuggestions, setIsGeneratingSuggestions] = useState<any[]>([]); // I pasted this in Step 1140
              // Wait, isGeneratingSuggestions usually boolean. displayedSuggestions is array.
              // Let's check my paste in Step 1140.
              // "const [isGeneratingSuggestions, setIsGeneratingSuggestions] = useState<any[]>([]);"
              // This looks like a mistake in my paste?
              // Line 171 of App.tsx (original): "const [isGeneratingSuggestions, setIsGeneratingSuggestions] = useState(false);" (implied)
              // I should check useAppState.ts again.
              setIsGeneratingSuggestions={appState.setIsGeneratingSuggestions as any}
              displayedSuggestions={appState.displayedSuggestions}
              setDisplayedSuggestions={appState.setDisplayedSuggestions}
              selectedTheme={appState.selectedTheme}
              setSelectedTheme={appState.setSelectedTheme}
              availableThemes={appState.availableThemes}
              setAvailableThemes={appState.setAvailableThemes}
              themeInput={appState.themeInput}
              setThemeInput={appState.setThemeInput}
              isGeneratingTheme={appState.isGeneratingTheme}
              setIsGeneratingTheme={appState.setIsGeneratingTheme}
              setupInputRef={setupInputRef}
              setupEndRef={setupEndRef}
              // Workspace view props
              isRenaming={appState.isRenaming}
              tempName={appState.tempName}
              activeTab={appState.activeTab}
              leftTab={appState.leftTab}
              leftWidth={appState.leftWidth}
              logHeight={appState.logHeight}
              isResizingLeft={appState.isResizingLeft}
              isResizingLogs={appState.isResizingLogs}
              isLogsCollapsed={appState.isLogsCollapsed}
              globalMessages={appState.globalMessages}
              globalChatInput={appState.globalChatInput}
              isChatThinking={appState.isChatThinking}
              isProcessingFile={appState.isProcessingFile}
              isEnhancingChat={appState.isEnhancingChat}
              isResearchingChat={appState.isResearchingChat}
              autoPilotStatus={appState.autoPilotStatus}
              apiHealth={appState.apiHealth}
              appSettings={appState.appSettings}
              showExportDataMenu={appState.showExportDataMenu}
              showShareProject={appState.showShareProject}
              showReportExport={appState.showReportExport}
              showTerminal={appState.showTerminal}
              showSettings={appState.showSettings}
              showThemeStudio={appState.showThemeStudio}
              showUserSignup={showUserSignup} // uiHandlers overrides? No, State.
              showUserLogin={showUserLogin}
              handleUserLoginSuccess={handleUserLoginSuccess}
              handleUserSignupSuccess={handleUserSignupSuccess}
              showMobileDeploymentWizard={appState.showMobileDeploymentWizard}
              editingTask={appState.editingTask}
              selectedAgentDetail={appState.selectedAgentDetail}
              globalChatEndRef={globalChatEndRef}
              globalFileInputRef={globalFileInputRef}
              globalChatInputRef={globalChatInputRef}
              isProgrammaticHashChangeRef={isProgrammaticHashChangeRef}
              // State setters
              setIsRenaming={appState.setIsRenaming}
              setTempName={appState.setTempName}
              setActiveTab={appState.setActiveTab}
              setLeftTab={appState.setLeftTab}
              setIsResizingLeft={appState.setIsResizingLeft}
              setIsResizingLogs={appState.setIsResizingLogs}
              setIsLogsCollapsed={appState.setIsLogsCollapsed}
              setGlobalMessages={appState.setGlobalMessages}
              setGlobalChatInput={appState.setGlobalChatInput}
              setIsChatThinking={appState.setIsChatThinking}
              setIsProcessingFile={appState.setIsProcessingFile}
              setIsEnhancingChat={appState.setIsEnhancingChat}
              setIsResearchingChat={appState.setIsResearchingChat}
              setShowExportDataMenu={appState.setShowExportDataMenu}
              setShowShareProject={appState.setShowShareProject}
              setShowReportExport={appState.setShowReportExport}
              setShowTerminal={appState.setShowTerminal}
              setShowSettings={appState.setShowSettings}
              setShowThemeStudio={appState.setShowThemeStudio}
              setShowWorkspaceTutorial={appState.setShowWorkspaceTutorial}
              setShowMobileDeploymentWizard={appState.setShowMobileDeploymentWizard}
              setEditingTask={appState.setEditingTask}
              setSelectedAgentDetail={appState.setSelectedAgentDetail}
              setViewMode={setViewMode}
              // Handlers
              handleUndo={handleUndo}
              handleRedo={handleRedo}
              handleRenameProject={handleRenameProject}
              handleAutoPilotClick={handleAutoPilotClick}
              stopExecution={stopExecution}
              handleOpenChat={handleOpenChat}
              handleGlobalChatSend={handleGlobalChatSend}
              handleGlobalFileSelect={handleGlobalFileSelect}
              handleDeepResearch={handleDeepResearch}
              handleEnhanceInput={handleEnhanceInput}
              handleExportProjectData={handleExportProjectData}
              regressPhase={regressPhase}
              advancePhase={advancePhase}
              startNextSprint={startNextSprint}
              orchestratePhase={orchestratePhase}
              executeTask={executeTask}
              handleRunAllTasks={handleRunAllTasks}
              handleDeleteTask={handleDeleteTask}
              handleApproveTask={handleApproveTask}
              handleRejectTask={handleRejectTask}
              handleSaveArtifact={handleSaveArtifact}
              handleArtifactUpload={handleArtifactUpload}
              handleForceBuild={handleForceBuild}
              handleAddStandard={handleAddStandard}
              handleRemoveStandard={handleRemoveStandard}
              handleRunAudit={handleRunAudit}
              handleToggleLogsCollapse={handleToggleLogsCollapse}
              addLog={addLog}
              handleSetupSend={handleSetupSend}
              handleManualLaunch={handleManualLaunch}
              handleLaunchFromBrainstorming={handleLaunchFromBrainstorming}
              handleSuggestionClick={handleSuggestionClick}
              toggleStandard={toggleStandard}
              handleRandomTheme={handleRandomTheme}
              handleAiThemeGen={handleAiThemeGen}
              removeSetupFile={removeSetupFile}
              handleSetupDragOver={handleSetupDragOver}
              handleSetupDragLeave={handleSetupDragLeave}
              handleSetupDrop={handleSetupDrop}
              canProceedToPreview={canProceedToPreview}
              handleJumpToPreview={handleJumpToPreview}
              // Feature flags
              canSwitchEnvironment={canSwitchEnvironment}
              canShareProjects={canShareProjects}
              canExportReports={canExportReports}
              canExportData={canExportData}
              canAccessTerminal={canAccessTerminal}
              canUseAICodeGeneration={canUseAICodeGeneration}
              canUseAITaskAutomation={canUseAITaskAutomation}
              canUseAIChat={canUseAIChat}
              canUseCodeEditor={canUseCodeEditor}
              canUseArtifactViewer={canUseArtifactViewer}
              canDeleteAgents={canDeleteAgents}
              canCustomizeAgents={canCustomizeAgents}
              // Demo mode
              isDemoMode={isDemoMode}
              // Admin props
              adminToken={adminToken}
              adminUser={adminUser}
              isAdminUser={isAdminUser}
              handleAdminLoginSuccess={handleAdminLoginSuccess}
              handleAdminLogout={handleAdminLogout}
            />
          </Suspense>
        </ErrorBoundary>
      </AppShell>
    </div>
  );
};

/**
 * App - Wrapper component that provides FeatureAccessProvider
 * This ensures useFeatureFlag hooks in AppContent have access to the context
 */
const App: React.FC = () => {
  const { user } = useAuth();

  // Compute userRole for FeatureAccessProvider
  const userRole = useMemo(() => {
    return user?.role ? user.role.toLowerCase().trim() : 'public';
  }, [user?.role]);

  return (
    <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID || ''}>
      <FeatureAccessProvider userRole={userRole}>
        <AppContent />
      </FeatureAccessProvider>
    </GoogleOAuthProvider>
  );
};

export default App;
