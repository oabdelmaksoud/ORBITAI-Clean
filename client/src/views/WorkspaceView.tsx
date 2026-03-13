import React, { useRef, Suspense, startTransition } from 'react';
import { ProjectState, Phase, AgentRole, TaskStatus, ChatMessage } from '@orbitai/shared';
import { ProjectAction } from '@orbitai/shared';
import { UserProfile } from '@orbitai/shared';
import { AGENTS, INITIAL_PROJECT_NAME, GLOBAL_QUICK_ACTIONS } from '@orbitai/shared';
import Logo from '../components/Logo';
import { Tooltip } from '../components/Tooltip';
import AgentCard from '../components/AgentCard';
import MCPStatus from '../components/MCPStatus';
import VModelVisualizer from '../components/VModelVisualizer';
import MilestoneTracker from '../components/MilestoneTracker';
import KanbanBoard from '../components/KanbanBoard';
import NetworkVisualizer from '../components/NetworkVisualizer';
import RequirementsDashboard from '../components/RequirementsDashboard';
import CodeEditor from '../components/CodeEditor';
import ArtifactViewer from '../components/ArtifactViewer';
import KnowledgeBase from '../components/KnowledgeBase';
import ComplianceDashboard from '../components/ComplianceDashboard';
import CostEstimator from '../components/CostEstimator';
import PreviewFrame from '../components/PreviewFrame';
import LogConsole from '../components/LogConsole';
import WorkspaceTutorial from '../components/WorkspaceTutorial';
import ProjectCompletion from '../components/ProjectCompletion';
import GitHubIntegrationPanel from '../components/GitHubIntegrationPanel';
import MobileDeploymentWizard from '../components/MobileDeploymentWizard';
import WebTerminal from '../components/WebTerminal';
import { webContainerService } from '../services/WebContainerService';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Lock, User, Eye, Edit2, Repeat, ShieldCheck, Undo2, Redo2, Gauge, Folder,
  Share2, FileText, Download, FileJson, TerminalIcon, Zap, Square, LogOut,
  Settings, RotateCw, ChevronLeft, ChevronRight, Users, MessageSquare, Activity,
  ArrowDown, Trash2, Bot, Paperclip, Microscope, Wand2, Send, MessageSquarePlus,
  Loader2, Layout, Network, Layers, Code, Book, ShieldCheck as ShieldCheckIcon,
  CreditCard, CheckCircle2, Cpu, CheckSquare, Cloud, GitBranch, Smartphone, Rocket, XCircle, AlertCircle
} from 'lucide-react';

// TabButton component (defined inline in App.tsx)
const TabButton = ({ id, label, icon: Icon, active, onClick, count, className = '', isModernView }: {
  id: string;
  label: string;
  icon: any;
  active: boolean;
  onClick: () => void;
  count?: number;
  className?: string;
  isModernView?: boolean;
}) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all flex-1 min-w-0 ${active
      ? 'bg-primary text-white shadow-sm'
      : isModernView
        ? 'bg-transparent text-slate-400 hover:bg-slate-800 hover:text-slate-200'
        : 'bg-transparent text-slate-500 hover:bg-slate-200/50'} ${className}`}
  >
    <Icon size={12} className="shrink-0" />
    <span className="truncate">{label}</span>
    {count !== undefined && count > 0 && (
      <span className="bg-primary/20 text-primary px-1.5 py-0.5 rounded-full text-[9px] font-bold shrink-0">
        {count}
      </span>
    )}
  </button>
);

interface WorkspaceViewProps {
  // Core state
  state: ProjectState;
  dispatch: React.Dispatch<ProjectAction>;

  // User & UI state
  user: UserProfile | null;
  isViewOnly?: boolean;
  dismissedGuestBanner: boolean;
  isRestoring: boolean;
  showWorkspaceTutorial: boolean;

  // Workspace UI state
  isRenaming: boolean;
  tempName: string;
  activeTab: 'board' | 'artifacts' | 'ide' | 'prototype' | 'network' | 'compliance' | 'knowledge' | 'budget' | 'requirements' | 'completion' | 'dev-tools';
  leftTab: 'agents' | 'chat';
  leftWidth: number;
  logHeight: number;
  isResizingLeft: boolean;
  isResizingLogs: boolean;
  isLogsCollapsed: boolean;

  // Chat state
  globalMessages: ChatMessage[];
  globalChatInput: string;
  isChatThinking: boolean;
  isProcessingFile: boolean;
  isEnhancingChat: boolean;
  isResearchingChat: boolean;

  // Auto-pilot state
  autoPilotStatus: 'idle' | 'running' | 'paused';

  // API Health
  apiHealth: { status: 'healthy' | 'degraded' | 'paused'; metrics: { lastLatency: number; requests: number } };

  // Settings
  appSettings: any;

  // Theme state
  availableThemes: any[];
  selectedTheme: string;

  // Feature flags
  canSwitchEnvironment: boolean;
  canShareProjects: { enabled: boolean; loading: boolean };
  canExportReports: { enabled: boolean; loading: boolean };
  canExportData: { enabled: boolean; loading: boolean };
  canAccessTerminal: { enabled: boolean; loading: boolean };
  canUseAICodeGeneration: { enabled: boolean; loading: boolean };
  canUseAITaskAutomation: { enabled: boolean; loading: boolean };
  canUseAIChat: { enabled: boolean; loading: boolean };
  canUseCodeEditor: { enabled: boolean; loading: boolean };
  canUseArtifactViewer: { enabled: boolean; loading: boolean };
  canDeleteAgents: { enabled: boolean; loading: boolean };
  canCustomizeAgents: { enabled: boolean; loading: boolean };

  // Modal state
  showExportDataMenu: boolean;
  showShareProject: boolean;
  showReportExport: boolean;
  showTerminal: boolean;
  showSettings: boolean;
  showThemeStudio: boolean;
  showUserSignup: boolean;
  showUserLogin: boolean;
  showMobileDeploymentWizard: boolean; // New: Mobile deployment wizard
  editingTask: any;
  selectedAgentDetail: any;

  // Refs
  globalChatEndRef: React.RefObject<HTMLDivElement>;
  globalFileInputRef: React.RefObject<HTMLInputElement>;
  globalChatInputRef: React.RefObject<HTMLInputElement>;
  isProgrammaticHashChangeRef: React.MutableRefObject<boolean>;

  // Missing handlers
  handleUserLogout: () => void;
  addLog: (message: string, role?: AgentRole, type?: 'info' | 'warning' | 'error' | 'success' | 'action') => void;
  handleSendMessage: (text: string) => Promise<void>;
  isFeatureEnabled: (feature: string) => boolean;
  isModernView?: boolean;

  // Handlers
  setIsRenaming: (value: boolean) => void;
  setTempName: (value: string) => void;
  setActiveTab: (tab: 'board' | 'artifacts' | 'ide' | 'prototype' | 'network' | 'compliance' | 'knowledge' | 'budget' | 'requirements' | 'completion' | 'dev-tools') => void;
  setLeftTab: (tab: 'agents' | 'chat') => void;
  setIsResizingLeft: (value: boolean) => void;
  setIsResizingLogs: (value: boolean) => void;
  setIsLogsCollapsed: (value: boolean) => void;
  setGlobalMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  setGlobalChatInput: (value: string) => void;
  setIsChatThinking: (value: boolean) => void;
  setIsProcessingFile: (value: boolean) => void;
  setIsEnhancingChat: (value: boolean) => void;
  setIsResearchingChat: (value: boolean) => void;
  setShowExportDataMenu: (value: boolean) => void;
  setShowShareProject: (value: boolean) => void;
  setShowReportExport: (value: boolean) => void;
  setShowTerminal: (value: boolean) => void;
  setShowSettings: (value: boolean) => void;
  setShowThemeStudio: (value: boolean) => void;
  setShowUserSignup: (value: boolean) => void;
  setShowUserLogin: (value: boolean) => void;
  setShowWorkspaceTutorial: (value: boolean) => void;
  setShowMobileDeploymentWizard: (value: boolean) => void; // New: Mobile deployment wizard
  setEditingTask: (task: any) => void;
  setSelectedAgentDetail: (agent: any) => void;
  setViewMode: (mode: 'landing' | 'setup' | 'workspace' | 'admin' | 'shared') => void;

  // Action handlers
  handleUndo: () => void;
  handleAutoPilotClick: () => void;
  stopExecution: () => void;
  handleExportProjectData: (format: 'json' | 'csv') => Promise<void>;
}

const WorkspaceView: React.FC<WorkspaceViewProps> = (props) => {
  const {
    state, dispatch, user, isViewOnly, dismissedGuestBanner, isRestoring, showWorkspaceTutorial,
    isRenaming, tempName, activeTab, leftTab, leftWidth, logHeight, isResizingLeft, isResizingLogs, isLogsCollapsed,
    globalMessages, globalChatInput, isChatThinking, isProcessingFile, isEnhancingChat, isResearchingChat,
    autoPilotStatus, apiHealth, appSettings, availableThemes, selectedTheme,
    canSwitchEnvironment, canShareProjects, canExportReports, canExportData, canAccessTerminal, canUseAICodeGeneration, canUseAITaskAutomation, canUseAIChat, canUseCodeEditor, canUseArtifactViewer, canDeleteAgents, canCustomizeAgents,
    showExportDataMenu, showShareProject, showReportExport, showTerminal, showSettings, showThemeStudio, showUserSignup, showUserLogin, showMobileDeploymentWizard, editingTask, selectedAgentDetail,
    globalChatEndRef, globalFileInputRef, globalChatInputRef, isProgrammaticHashChangeRef,
    setIsRenaming, setTempName, setActiveTab, setLeftTab, setIsResizingLeft, setIsResizingLogs, setIsLogsCollapsed,
    setGlobalMessages, setGlobalChatInput, setIsChatThinking, setIsProcessingFile, setIsEnhancingChat, setIsResearchingChat,
    setShowExportDataMenu, setShowShareProject, setShowReportExport, setShowTerminal, setShowSettings, setShowThemeStudio, setShowUserSignup, setShowUserLogin, setShowWorkspaceTutorial, setShowMobileDeploymentWizard,
    setEditingTask, setSelectedAgentDetail, setViewMode,
    handleUndo, handleAutoPilotClick, stopExecution, handleExportProjectData,
    handleUserLogout, addLog, handleSendMessage, isFeatureEnabled, isModernView
  } = props;

  // Local Helpers
  const handleProfileClick = () => setShowUserProfile(true);
  const handleOpenChat = () => setLeftTab('chat');
  const handleGlobalChatSend = handleSendMessage;

  // Safe helper that handles both string keys (if isFeatureEnabled passed) 
  // or checks .enabled property if an object is passed (legacy pattern in this view)
  const shouldShowFeature = (feature: any) => {
    if (typeof feature === 'string') return isFeatureEnabled ? isFeatureEnabled(feature) : false;
    return feature?.enabled === true;
  };

  const handleGlobalFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Placeholder for global file selection logic
    console.log('Global file selected:', e.target.files);
  };

  const handleDeepResearch = () => {
    // Placeholder for deep research trigger
    console.log('Deep Research triggered');
    setIsResearchingChat(true);
  };

  const startNextSprint = () => {
    dispatch({ type: 'START_NEXT_SPRINT' });
  };

  const advancePhase = () => {
    const phases = [Phase.INITIATION, Phase.REQUIREMENTS, Phase.ARCHITECTURE, Phase.IMPLEMENTATION, Phase.TEST_PLANNING, Phase.VERIFICATION, Phase.DEPLOYMENT];
    const currentIndex = phases.indexOf(state.currentPhase);
    if (currentIndex < phases.length - 1) {
      dispatch({ type: 'SET_PHASE', payload: phases[currentIndex + 1] });
    }
  };

  const regressPhase = () => {
    const phases = [Phase.INITIATION, Phase.REQUIREMENTS, Phase.ARCHITECTURE, Phase.IMPLEMENTATION, Phase.TEST_PLANNING, Phase.VERIFICATION, Phase.DEPLOYMENT];
    const currentIndex = phases.indexOf(state.currentPhase);
    if (currentIndex > 0) {
      dispatch({ type: 'SET_PHASE', payload: phases[currentIndex - 1] });
    }
  };

  const isDemoMode = !user;

  // Local State
  const [devToolTab, setDevToolTab] = React.useState<string>('github-integration');
  const authToken = user?.token;
  const userRole = user?.role;

  // Additional Handlers
  const handleEnhanceInput = () => setIsEnhancingChat(true);

  const executeTask = (taskId: string) => {
    console.log('Execute task via WorkspaceView:', taskId);
    // Logic to trigger execution
  };

  const handleRunAllTasks = () => {
    console.log('Run all tasks');
  };

  const handleDeleteTask = (taskId: string) => {
    dispatch({ type: 'DELETE_TASK', payload: taskId });
  };

  const handleApproveTask = (taskId: string) => {
    dispatch({ type: 'UPDATE_TASK_STATUS', payload: { id: taskId, status: TaskStatus.COMPLETED } });
  };

  const handleRejectTask = (taskId: string) => {
    dispatch({ type: 'UPDATE_TASK_STATUS', payload: { id: taskId, status: TaskStatus.FAILED } });
  };

  const handleSaveArtifact = (id: string, content: string) => {
    dispatch({ type: 'UPDATE_ARTIFACT', payload: { id, content } });
  };

  const handleArtifactUpload = (file: File) => {
    console.log('Artifact upload:', file.name);
  };

  const handleAddStandard = (standard: string) => {
    dispatch({ type: 'SET_STANDARDS', payload: [...state.selectedStandards, standard] });
  };

  const handleRemoveStandard = (standard: string) => {
    dispatch({ type: 'SET_STANDARDS', payload: state.selectedStandards.filter(s => s !== standard) });
  };

  const handleRunAudit = () => {
    console.log('Run audit');
  };

  const getGuestPrototypeArtifact = () => {
    return state.artifacts.find(a => a.type === 'protype' || a.title?.includes('Prototype'));
  };

  const handleForceBuild = () => {
    console.log('Force build triggered');
  };

  const orchestratePhase = (phase: Phase, desc: string) => {
    console.log('Orchestrate phase:', phase);
  };

  const handleToggleLogsCollapse = () => {
    setIsLogsCollapsed(!isLogsCollapsed);
  };

  return (
    <div className="flex h-screen w-full bg-slate-50 overflow-hidden">
      <div className="flex-1 flex flex-col min-w-0">
        <div className="h-12 bg-white border-b border-slate-200 flex items-center px-4 justify-between shrink-0 z-10">
          <div className="flex items-center gap-3">
            <Logo />
            <div className="h-8 w-px bg-slate-200 hidden sm:block shrink-0"></div>
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                // Force navigation to setup
                isProgrammaticHashChangeRef.current = true;
                setViewMode('setup');
                setTimeout(() => {
                  window.location.hash = '#setup';
                  window.dispatchEvent(new HashChangeEvent('hashchange'));
                }, 0);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors border border-slate-200 shrink-0"
            >
              <Folder size={14} /> <span className="hidden sm:inline">Projects</span>
            </button>
            {/* Action Buttons - Always show buttons, control disabled state */}
            <>
              {/* Share, Report, Data, Terminal buttons */}
              <button
                onClick={() => {
                  if (isViewOnly) return;
                  user ? setShowShareProject(true) : setShowUserLogin(true);
                }}
                disabled={isViewOnly || !user || !isFeatureEnabled(canShareProjects)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors border border-blue-200 disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                title={isViewOnly ? 'Editing disabled in view-only mode' : !user ? 'Login required to share projects' : !isFeatureEnabled(canShareProjects) ? 'Project sharing is disabled for your role' : 'Share project'}
              >
                <Share2 size={14} className="shrink-0" /> <span className="hidden sm:inline">Share</span>
              </button>
              <button
                onClick={() => {
                  if (isViewOnly) return;
                  user ? setShowReportExport(true) : setShowUserLogin(true);
                }}
                disabled={isViewOnly || !user || !isFeatureEnabled(canExportReports)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors border border-emerald-200 disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                title={isViewOnly ? 'Editing disabled in view-only mode' : !user ? 'Login required to export reports' : !isFeatureEnabled(canExportReports) ? 'Report export is disabled for your role' : 'Export report'}
              >
                <FileText size={14} className="shrink-0" /> <span className="hidden sm:inline">Report</span>
              </button>
              <div className="relative shrink-0">
                <button
                  onClick={() => {
                    if (isViewOnly) return;
                    user ? setShowExportDataMenu(!showExportDataMenu) : setShowUserLogin(true);
                  }}
                  disabled={isViewOnly || !user || !isFeatureEnabled(canExportData)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-600 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors border border-purple-200 disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                  title={isViewOnly ? 'Editing disabled in view-only mode' : !user ? 'Login required to export data' : !isFeatureEnabled(canExportData) ? 'Data export is disabled for your role' : 'Export project data'}
                >
                  <Download size={14} className="shrink-0" /> <span className="hidden sm:inline">Data</span>
                </button>
                {showExportDataMenu && (
                  <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl z-50 min-w-[160px]">
                    <button
                      onClick={async () => {
                        setShowExportDataMenu(false);
                        await handleExportProjectData('json');
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                    >
                      <FileJson size={14} /> Export as JSON
                    </button>
                    <button
                      onClick={async () => {
                        setShowExportDataMenu(false);
                        await handleExportProjectData('csv');
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2 border-t border-slate-100"
                    >
                      <FileText size={14} /> Export as CSV
                    </button>
                  </div>
                )}
              </div>
              <button
                onClick={() => {
                  if (isViewOnly) return;
                  user ? setShowTerminal(true) : setShowUserLogin(true);
                }}
                disabled={isViewOnly || !user || !isFeatureEnabled(canAccessTerminal)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-green-400 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors border border-slate-700 disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                title={isViewOnly ? 'Editing disabled in view-only mode' : !user ? 'Login required to access terminal' : !isFeatureEnabled(canAccessTerminal) ? 'Terminal access is disabled for your role' : 'Open terminal'}
              >
                <TerminalIcon size={14} className="shrink-0" /> <span className="hidden sm:inline">Terminal</span>
              </button>
              <div className="h-8 w-px bg-slate-200 hidden sm:block shrink-0"></div>
            </>
            {
              isViewOnly && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-lg">
                  <Eye size={14} className="text-amber-600" />
                  <span className="text-xs font-bold text-amber-700 uppercase tracking-wider hidden sm:inline">
                    View Only
                  </span>
                </div>
              )
            }
            <div className="h-8 w-px bg-slate-200 hidden sm:block"></div>
            <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-full p-1 shadow-sm">
              <button
                onClick={isDemoMode ? () => setShowUserSignup(true) : handleAutoPilotClick}
                disabled={isViewOnly || isDemoMode || autoPilotStatus === 'running' || state.isProcessing || (!isFeatureEnabled(canUseAICodeGeneration) && !isFeatureEnabled(canUseAITaskAutomation))}
                className={`px-2 sm:px-3 py-1.5 rounded-full flex items-center gap-1 sm:gap-2 transition-all ${isViewOnly || isDemoMode || autoPilotStatus === 'running' || state.isProcessing || (!isFeatureEnabled(canUseAICodeGeneration) && !isFeatureEnabled(canUseAITaskAutomation)) ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-accent text-white hover:bg-pink-600 shadow-md'}`}
                title={isDemoMode ? 'Sign up to use AI features' : (!isFeatureEnabled(canUseAICodeGeneration) && !isFeatureEnabled(canUseAITaskAutomation)) ? 'AI features are disabled for your role' : (autoPilotStatus === 'running' ? 'HAND-OFF AI is running' : 'Start HAND-OFF AI')}
              >
                <Zap size={14} className={autoPilotStatus === 'running' || state.isProcessing ? "" : "fill-current"} />
                <span className="text-[10px] font-bold uppercase tracking-wider hidden sm:inline">
                  {autoPilotStatus === 'paused' ? "Resume AI" : autoPilotStatus === 'running' ? "Running..." : "Hand-off AI"}
                </span>
              </button>
              <button
                onClick={isDemoMode ? () => setShowUserSignup(true) : stopExecution}
                disabled={isViewOnly || isDemoMode || (autoPilotStatus === 'idle' && !state.isProcessing)}
                className={`p-2 rounded-full transition-all ${(isViewOnly || isDemoMode || (autoPilotStatus === 'idle' && !state.isProcessing)) ? 'text-slate-300' : 'text-error hover:bg-error/10'}`}
                title={isDemoMode ? 'Sign up to use features' : ''}
              >
                <Square size={14} className="fill-current" />
              </button>
            </div>
            <div className="h-8 w-px bg-slate-200 hidden sm:block"></div>
            {
              user ? (
                <>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleProfileClick();
                    }}
                    className="flex items-center gap-1 sm:gap-2 px-2 py-1 hover:bg-slate-100 rounded-lg transition-colors border border-transparent hover:border-slate-200 cursor-pointer bg-transparent"
                  >
                    <img src={user.avatar} className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-slate-100 shrink-0" alt={user.name} />
                    <div className="flex flex-col items-start hidden sm:flex">
                      <span className="text-[10px] font-bold text-slate-700 leading-none">{user.name.split(' ')[0]}</span>
                      <span className={`text-[9px] font-bold uppercase ${user.plan === 'Pro' ? 'text-primary' : user.plan === 'Enterprise' ? 'text-purple-600' : 'text-slate-400'}`}>
                        {user.plan}
                      </span>
                    </div>
                  </button>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleUserLogout();
                    }}
                    className="p-2 rounded-full hover:bg-slate-100 text-slate-400 hover:text-red-600 transition-colors"
                    title="Sign Out"
                  >
                    <LogOut size={18} />
                  </button>
                </>
              ) : (
                <button onClick={() => setShowUserLogin(true)} className="p-2 rounded-full hover:bg-slate-100 text-slate-400 hover:text-primary transition-colors">
                  <User size={18} />
                </button>
              )
            }
            <button
              onClick={isDemoMode ? () => setShowUserSignup(true) : () => setShowSettings(true)}
              className="p-2 rounded-full hover:bg-slate-100 text-slate-400 hover:text-primary transition-colors"
              title={isDemoMode ? 'Sign up to access settings' : ''}
            >
              <Settings size={18} />
            </button>
            {
              state.isProcessing && (
                <div className="flex items-center gap-2 text-primary text-[10px] font-mono uppercase tracking-widest bg-primary/5 px-2 sm:px-3 py-1.5 rounded-full border border-primary/10 shrink-0">
                  <RotateCw size={12} className="animate-spin" /> <span className="hidden sm:inline">Processing</span>
                </div>
              )
            }
            <div className="flex items-center gap-1 sm:gap-2 bg-slate-50 rounded-full p-1 border border-slate-200 shadow-sm shrink-0 whitespace-nowrap">
              <button
                onClick={isDemoMode ? () => setShowUserSignup(true) : regressPhase}
                disabled={isViewOnly || isDemoMode || state.isProcessing || autoPilotStatus === 'running' || state.currentPhase === Phase.INITIATION}
                className="px-2 sm:px-2.5 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition-colors disabled:opacity-30 flex items-center gap-1 text-slate-500 hover:text-primary hover:bg-white shrink-0"
                title={isDemoMode ? 'Sign up to navigate phases' : ''}
              >
                <ChevronLeft size={10} className="shrink-0" /> <span className="hidden sm:inline">Back</span>
              </button>
              <div className="px-2 sm:px-2.5 py-1 rounded-full bg-white text-xs font-bold text-slate-600 border border-slate-200 shrink-0 whitespace-nowrap">
                <span className="hidden sm:inline">Phase: </span>
                <span className="text-primary">{state.currentPhase}</span>
              </div>
              {state.currentPhase === Phase.POST_RELEASE ? (
                <button
                  onClick={isDemoMode ? () => setShowUserSignup(true) : startNextSprint}
                  disabled={isViewOnly || isDemoMode || state.isProcessing || autoPilotStatus === 'running'}
                  className="bg-success hover:bg-emerald-600 text-white px-2.5 sm:px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition-colors disabled:opacity-50 flex items-center gap-1 shadow-sm shrink-0"
                  title={isDemoMode ? 'Sign up to use features' : ''}
                >
                  <span className="hidden sm:inline">Next Sprint </span>
                  <Repeat size={10} className="shrink-0" />
                </button>
              ) : (
                <button
                  onClick={isDemoMode ? () => setShowUserSignup(true) : () => advancePhase()}
                  disabled={isViewOnly || isDemoMode || state.isProcessing || autoPilotStatus === 'running'}
                  className="bg-primary hover:bg-blue-600 text-white px-2.5 sm:px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition-colors disabled:opacity-50 flex items-center gap-1 shadow-sm shrink-0"
                  title={isDemoMode ? 'Sign up to advance phases' : ''}
                >
                  <span className="hidden sm:inline">Next </span>
                  <ChevronRight size={10} className="shrink-0" />
                </button>
              )}
            </div>
          </div>
        </div>
        <main id="main-content" className="flex-1 overflow-hidden flex flex-row relative" tabIndex={-1}>
          <div style={{ width: leftWidth }} className={`flex flex-col border-r shrink-0 z-10 relative ${isModernView ? 'bg-slate-900/50 backdrop-blur-md border-slate-800' : 'bg-white/50 backdrop-blur-md border-slate-200'}`}>
            <div>
              <VModelVisualizer
                currentPhase={state.currentPhase}
                currentSprint={state.currentSprint}
                methodology={state.methodology}
                estimatedSprints={state.estimatedSprints}
              />
            </div>
            <div className="flex items-center gap-1 p-1 border-b border-slate-200 bg-slate-50/50">
              <button
                onClick={() => setLeftTab('agents')}
                className={`flex-1 flex items-center justify-center gap-1 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all ${leftTab === 'agents' ? 'bg-white text-primary shadow-sm ring-1 ring-slate-200' : 'text-slate-400 hover:bg-slate-200/50'}`}
              >
                <Users size={12} /> Agents
              </button>
              {shouldShowFeature(canUseAIChat) && (
                <button
                  onClick={() => setLeftTab('chat')}
                  className={`flex-1 flex items-center justify-center gap-1 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all ${leftTab === 'chat' ? 'bg-white text-primary shadow-sm ring-1 ring-slate-200' : 'text-slate-400 hover:bg-slate-200/50'}`}
                >
                  <MessageSquare size={12} /> Global Chat
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar bg-slate-50/30">
              {leftTab === 'agents' && (
                <div className="p-3">
                  {/* Project Progress Indicator */}
                  {state.tasks.length > 0 && (
                    <div className="mb-4 p-3 bg-white rounded-lg border border-slate-200 shadow-sm">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Project Progress</h4>
                        <span className="text-[10px] font-bold text-slate-600">
                          {state.tasks.filter(t => t.status === TaskStatus.COMPLETED).length} / {state.tasks.length}
                        </span>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-primary to-blue-500 transition-all duration-500 rounded-full"
                          style={{
                            width: `${state.tasks.length > 0 ? Math.round((state.tasks.filter(t => t.status === TaskStatus.COMPLETED).length / state.tasks.length) * 100) : 0}%`
                          }}
                        />
                      </div>
                      <div className="mt-1.5 text-[9px] text-slate-500 font-mono text-center">
                        {state.tasks.length > 0 ? Math.round((state.tasks.filter(t => t.status === TaskStatus.COMPLETED).length / state.tasks.length) * 100) : 0}% Complete
                      </div>
                    </div>
                  )}
                  <div className="flex items-center justify-between mb-3 px-2">
                    <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Active Agents</h3>
                    <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded-full text-slate-500 font-bold border border-slate-200">
                      {state.agents.length}
                    </span>
                  </div>
                  <div className="space-y-3 px-1">
                    {state.agents.map(agent => (
                      <AgentCard
                        key={agent.id}
                        agent={agent}
                        isActive={state.tasks.some(t => t.assignedTo === agent.role && t.status === TaskStatus.IN_PROGRESS)}
                        onChat={handleOpenChat}
                        onSelect={setSelectedAgentDetail}
                        onEdit={(agent) => {
                          setSelectedAgentDetail(agent);
                        }}
                        onDelete={(agentId) => {
                          if (isFeatureEnabled(canDeleteAgents)) {
                            dispatch({ type: 'DELETE_AGENT', payload: agentId });
                            addLog(`Agent deleted: ${state.agents.find(a => a.id === agentId)?.name || agentId}`, AgentRole.ORCHESTRATOR, 'info');
                          }
                        }}
                        canCustomize={isFeatureEnabled(canCustomizeAgents)}
                        canDelete={isFeatureEnabled(canDeleteAgents)}
                        useInternet={state.useInternet}
                      />
                    ))}
                  </div>
                  <div className="px-1 mt-4">
                    <MCPStatus servers={state.mcpServers} />
                  </div>
                </div>
              )}

              {leftTab === 'chat' && shouldShowFeature(canUseAIChat) && (
                <div className="flex flex-col h-full relative">
                  <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100 bg-white/50 backdrop-blur-sm z-10">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                      <Activity size={10} className="text-success" /> Live Feed
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => globalChatEndRef.current?.scrollIntoView({ behavior: 'smooth' })}
                        className="p-1 text-slate-400 hover:text-slate-600 rounded transition-colors"
                        title="Scroll to Bottom"
                      >
                        <ArrowDown size={14} />
                      </button>
                      <button
                        onClick={() => setGlobalMessages([])}
                        className="p-1 text-slate-400 hover:text-error rounded transition-colors"
                        title="Clear Chat History"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  <div className="flex-1 p-4 space-y-4 overflow-y-auto custom-scrollbar pb-48">
                    {globalMessages.map((msg) => {
                      const agent = msg.agentId ? state.agents.find(a => a.id === msg.agentId) || AGENTS.find(a => a.id === msg.agentId) : null;
                      const isSystem = msg.sender === 'system';
                      if (msg.isLogEvent) {
                        return (
                          <div key={msg.id} className="animate-in fade-in slide-in-from-left-2 duration-300">
                            <div className="flex items-start gap-3 pl-1 pr-4 py-1.5 hover:bg-slate-100/50 rounded-lg transition-colors group">
                              <div className="shrink-0 mt-0.5">
                                {agent ? (
                                  <div className="w-5 h-5 rounded overflow-hidden opacity-80 group-hover:opacity-100 transition-opacity">
                                    <img src={agent.avatar} alt={agent.name} className="w-full h-full object-cover" />
                                  </div>
                                ) : (
                                  <div className="w-5 h-5 rounded bg-slate-200 flex items-center justify-center">
                                    <Activity size={10} className="text-slate-500" />
                                  </div>
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 mb-0.5">
                                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                    {agent?.name || 'System'}
                                  </span>
                                  <span className="text-[9px] text-slate-300 font-mono">
                                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                  </span>
                                </div>
                                <div className="text-[11px] text-slate-600 leading-snug">{msg.text}</div>
                              </div>
                            </div>
                          </div>
                        );
                      }
                      return (
                        <div key={msg.id} className={`flex gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300 ${msg.sender === 'user' ? 'flex-row-reverse' : ''}`}>
                          <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border shadow-sm ${msg.sender === 'user' ? 'bg-primary text-white' : 'bg-white border-slate-100'}`}>
                            {msg.sender === 'user' ? (
                              <User size={14} className="text-white" />
                            ) : agent ? (
                              <img src={agent.avatar} alt={agent.name} className="w-full h-full object-cover rounded-xl" />
                            ) : (
                              <Bot size={14} className="text-primary" />
                            )}
                          </div>
                          <div className={`max-w-[85%] p-3.5 rounded-2xl text-xs leading-relaxed shadow-sm ${msg.sender === 'user' ? 'bg-primary text-white rounded-tr-sm shadow-primary/20' : isSystem ? 'bg-slate-100 text-slate-600 font-mono border border-slate-200' : 'bg-white text-slate-700 border border-slate-200 rounded-tl-sm'}`}>
                            {msg.sender !== 'user' && !isSystem && (
                              <div className="text-[10px] font-bold text-slate-400 mb-1.5 uppercase tracking-wider flex items-center gap-1.5">
                                {agent?.name || 'System'}
                                <span className="w-1 h-1 rounded-full bg-success"></span>
                              </div>
                            )}
                            <div className={`prose prose-sm max-w-none ${msg.sender === 'user' ? 'prose-invert prose-p:text-white prose-a:text-white/90 prose-headings:text-white prose-strong:text-white' : 'prose-slate prose-p:text-slate-700 prose-headings:text-slate-900 prose-pre:bg-slate-900 prose-pre:text-slate-50 prose-code:bg-slate-100 prose-code:text-primary prose-code:px-1 prose-code:rounded prose-code:before:content-none prose-code:after:content-none prose-blockquote:border-l-4 prose-blockquote:border-primary prose-blockquote:bg-slate-50 prose-blockquote:py-2 prose-blockquote:px-4 prose-blockquote:rounded-r-lg prose-table:border prose-table:border-slate-200 prose-th:bg-slate-50 prose-th:p-2 prose-td:p-2'}`}>
                              <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.text}</ReactMarkdown>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    {isChatThinking && (
                      <div className="flex gap-3 px-2">
                        <div className="w-8 h-8 rounded-xl bg-white border border-slate-200 flex items-center justify-center shrink-0 shadow-sm">
                          <Bot size={14} className="text-primary" />
                        </div>
                        <div className="bg-white border border-slate-200 px-4 py-3 rounded-2xl rounded-tl-sm flex items-center gap-1 shadow-sm">
                          <div className="w-1.5 h-1.5 bg-primary/50 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                          <div className="w-1.5 h-1.5 bg-primary/50 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                          <div className="w-1.5 h-1.5 bg-primary/50 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                        </div>
                      </div>
                    )}
                    <div ref={globalChatEndRef} />
                  </div>
                  {!globalChatInput.trim() && !isChatThinking && (
                    <div className="absolute bottom-[140px] left-8 right-8 px-0 flex gap-2 overflow-x-auto scrollbar-hide z-10 mask-linear-fade opacity-30 hover:opacity-100 transition-opacity duration-300">
                      {GLOBAL_QUICK_ACTIONS.map((action, idx) => (
                        <button
                          key={idx}
                          onClick={() => {
                            setGlobalChatInput(action.prompt);
                            globalChatInputRef.current?.focus();
                          }}
                          className="shrink-0 px-3 py-1.5 bg-white/90 backdrop-blur-sm border border-slate-200 hover:border-primary hover:text-primary text-slate-500 text-[10px] font-bold uppercase tracking-wider rounded-full shadow-sm transition-all whitespace-nowrap flex items-center gap-1.5 group"
                        >
                          <MessageSquarePlus size={12} className="text-slate-400 group-hover:text-primary transition-colors" />
                          {action.label}
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="absolute bottom-0 left-0 right-0 p-3 bg-white border-t border-slate-200 z-20" onFocus={(e) => e.stopPropagation()} onBlur={(e) => e.stopPropagation()}>
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 px-3 py-0.5 bg-slate-50 border border-slate-200 rounded-full text-[9px] font-bold text-slate-400 uppercase tracking-widest shadow-sm z-10 pointer-events-none">
                      Orchestrator Uplink
                    </div>
                    {isDemoMode ? (
                      <div className="relative flex flex-col gap-2 pt-2">
                        <div className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-3 pr-10 py-2.5 text-xs font-medium text-slate-400 cursor-not-allowed">
                          Sign up to chat with the Orchestrator...
                        </div>
                        <button
                          onClick={() => setShowUserSignup(true)}
                          className="absolute right-2 top-2 p-1 bg-primary text-white rounded-lg hover:bg-blue-600 transition-colors shadow-sm"
                          title="Sign up to use chat"
                        >
                          <User size={12} />
                        </button>
                      </div>
                    ) : (
                      <form onSubmit={handleGlobalChatSend} className="relative flex flex-col gap-2 pt-2" onFocus={(e) => e.stopPropagation()}>
                        <input type="file" ref={globalFileInputRef} className="hidden" onChange={handleGlobalFileSelect} />
                        <div className="flex items-center gap-2 pl-1">
                          <button
                            type="button"
                            onClick={() => globalFileInputRef.current?.click()}
                            className={`p-1.5 hover:bg-slate-50 rounded-lg transition-colors flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider border border-transparent hover:border-slate-200 ${isProcessingFile ? 'text-primary animate-pulse' : 'text-slate-400 hover:text-primary'}`}
                            title="Attach File"
                            disabled={isChatThinking || isProcessingFile}
                          >
                            {isProcessingFile ? <Loader2 size={14} className="animate-spin" /> : <Paperclip size={14} />}
                            {leftWidth > 340 && <span>Attach</span>}
                          </button>
                          <div className="h-4 w-px bg-slate-200 mx-1"></div>
                          <button
                            type="button"
                            onClick={() => handleDeepResearch(true)}
                            className={`p-1.5 hover:bg-slate-50 rounded-lg transition-colors flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider border border-transparent hover:border-slate-200 ${isResearchingChat ? 'text-purple-600 animate-pulse' : 'text-slate-400 hover:text-purple-600'}`}
                            title="Deep Research (Internet)"
                            disabled={isChatThinking || isProcessingFile || !globalChatInput.trim() || !state.useInternet}
                          >
                            {isResearchingChat ? <Loader2 size={14} className="animate-spin" /> : <Microscope size={14} />}
                            {leftWidth > 340 && <span>Research</span>}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleEnhanceInput(true)}
                            className={`p-1.5 hover:bg-slate-50 rounded-lg transition-colors flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider border border-transparent hover:border-slate-200 ${isEnhancingChat ? 'text-primary animate-pulse' : 'text-slate-400 hover:text-primary'}`}
                            title="Enhance Prompt"
                            disabled={isChatThinking || isProcessingFile || !globalChatInput.trim()}
                          >
                            {isEnhancingChat ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
                            {leftWidth > 340 && <span>Polish</span>}
                          </button>
                        </div>
                        <div className="relative w-full">
                          <input
                            ref={globalChatInputRef}
                            type="text"
                            value={globalChatInput}
                            onChange={(e) => setGlobalChatInput(e.target.value)}
                            onKeyDown={(e) => {
                              e.stopPropagation();
                            }}
                            placeholder={isProcessingFile ? "Reading archive..." : "Message Raed (Orchestrator)..."}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-3 pr-10 py-2.5 text-xs focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all font-medium text-slate-700 placeholder-slate-400 disabled:opacity-50"
                            disabled={isChatThinking || isProcessingFile || isResearchingChat}
                          />
                          <button
                            type="submit"
                            disabled={!globalChatInput.trim() || isChatThinking || isProcessingFile || isResearchingChat}
                            className="absolute right-2 top-2 p-1 bg-primary text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 transition-colors shadow-sm"
                          >
                            <Send size={12} />
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                </div>
              )}
            </div>
            <div
              onMouseDown={() => setIsResizingLeft(true)}
              className={`absolute right-0 top-0 bottom-0 w-1 hover:w-1.5 z-50 cursor-col-resize transition-all flex items-center justify-center group ${isResizingLeft ? 'bg-primary' : 'bg-transparent hover:bg-primary/20'}`}
            >
              <div className={`h-8 w-1 rounded-full transition-colors ${isResizingLeft ? 'bg-white' : 'bg-slate-300 group-hover:bg-primary'}`} />
            </div>
          </div>
          <div className="flex-1 flex flex-col overflow-hidden relative min-w-0">
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden relative">
              <MilestoneTracker
                currentSprint={state.currentSprint}
                tasks={state.tasks}
                settings={appSettings}
                methodology={state.methodology}
                estimatedSprints={state.estimatedSprints}
              />
              <div className="h-auto sm:h-10 border-b border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-center px-2 sm:px-3 py-1 sm:py-0 bg-white/80 backdrop-blur-md shrink-0 z-20 gap-1 sm:gap-0">
                <div className="flex p-0.5 bg-slate-100 rounded-lg border border-slate-200 flex-wrap sm:flex-nowrap gap-1 flex-1 min-w-0">
                  <TabButton isModernView={isModernView} id="board" label="Board" icon={Layout} active={activeTab === 'board'} onClick={() => startTransition(() => setActiveTab('board'))} />
                  <TabButton isModernView={isModernView} id="network" label="Network" icon={Network} active={activeTab === 'network'} onClick={() => startTransition(() => setActiveTab('network'))} />
                  <TabButton isModernView={isModernView} id="requirements" label="Requirements" icon={Layers} active={activeTab === 'requirements'} onClick={() => startTransition(() => setActiveTab('requirements'))} />
                  <TabButton isModernView={isModernView}
                    id="ide"
                    label="Code"
                    icon={Code}
                    active={activeTab === 'ide'}
                    onClick={() => {
                      // Always allow clicking, but check permission when actually accessing
                      startTransition(() => {
                        if (shouldShowFeature(canUseCodeEditor)) {
                          setActiveTab('ide');
                        } else {
                          // Disabled - switch to board instead
                          setActiveTab('board');
                        }
                      });
                    }}
                    className={!shouldShowFeature(canUseCodeEditor) ? 'opacity-50 cursor-not-allowed' : ''}
                  />
                  <TabButton isModernView={isModernView}
                    id="artifacts"
                    label="Docs"
                    icon={FileText}
                    active={activeTab === 'artifacts'}
                    onClick={() => {
                      // Always allow clicking, but check permission when actually accessing
                      startTransition(() => {
                        if (canUseArtifactViewer.loading) {
                          // Still loading, allow optimistic access
                          setActiveTab('artifacts');
                        } else if (shouldShowFeature(canUseArtifactViewer)) {
                          setActiveTab('artifacts');
                        } else {
                          // Disabled - switch to board instead
                          setActiveTab('board');
                        }
                      });
                    }}
                    count={state.artifacts.length}
                    className={!shouldShowFeature(canUseArtifactViewer) ? 'opacity-50 cursor-not-allowed' : ''}
                  />
                  <TabButton isModernView={isModernView} id="knowledge" label="Knowledge" icon={Book} active={activeTab === 'knowledge'} onClick={() => startTransition(() => setActiveTab('knowledge'))} />
                  <TabButton isModernView={isModernView} id="compliance" label="Audits" icon={ShieldCheckIcon} active={activeTab === 'compliance'} onClick={() => startTransition(() => setActiveTab('compliance'))} count={state.selectedStandards.length} />
                  <TabButton isModernView={isModernView} id="budget" label="Budget" icon={CreditCard} active={activeTab === 'budget'} onClick={() => startTransition(() => setActiveTab('budget'))} />
                  <TabButton isModernView={isModernView}
                    id="completion"
                    label="Completion"
                    icon={CheckCircle2}
                    active={activeTab === 'completion'}
                    onClick={() => startTransition(() => setActiveTab('completion'))}
                  />
                  <TabButton isModernView={isModernView}
                    id="prototype"
                    label="Prototype"
                    icon={Eye}
                    active={activeTab === 'prototype'}
                    onClick={() => startTransition(() => setActiveTab('prototype'))}
                  />
                  <TabButton isModernView={isModernView}
                    id="dev-tools"
                    label="Dev Tools"
                    icon={Cpu}
                    active={activeTab === 'dev-tools'}
                    onClick={() => {
                      startTransition(() => {
                        if (shouldShowFeature(canUseAICodeGeneration)) {
                          setActiveTab('dev-tools');
                        } else {
                          setActiveTab('board');
                        }
                      });
                    }}
                    className={!shouldShowFeature(canUseAICodeGeneration) ? 'opacity-50 cursor-not-allowed' : ''}
                  />
                </div>
                <Tooltip content={isDemoMode ? "Sign up to sync project plan" : "Synchronize project plan with current phase"}>
                  <button
                    onClick={isDemoMode ? () => setShowUserSignup(true) : () => orchestratePhase(state.currentPhase, state.description)}
                    disabled={isViewOnly || isDemoMode || state.isProcessing || autoPilotStatus === 'running'}
                    className="text-[10px] font-mono text-primary hover:text-blue-600 transition-colors flex items-center gap-2 px-2 sm:px-3 py-1.5 hover:bg-primary/5 rounded-lg border border-transparent hover:border-primary/20 disabled:opacity-50 font-bold shrink-0 whitespace-nowrap"
                  >
                    <RotateCw size={12} /> <span className="hidden sm:inline">SYNC PLAN</span>
                    <span className="sm:hidden">SYNC</span>
                  </button>
                </Tooltip>
              </div>

              <div className="flex-1 overflow-hidden relative p-0 bg-transparent">
                <div className={`absolute inset-0 p-6 overflow-auto scrollbar-hide ${activeTab === 'board' ? 'block' : 'hidden'} z-0`}>
                  <KanbanBoard
                    tasks={state.tasks}
                    currentSprint={state.currentSprint}
                    onExecuteTask={(id) => !isViewOnly && !isDemoMode && executeTask(id, 0)}
                    isProcessing={state.isProcessing || autoPilotStatus === 'running'}
                    onRunAll={!isViewOnly && !isDemoMode ? handleRunAllTasks : undefined}
                    onDeleteTask={!isViewOnly && !isDemoMode ? handleDeleteTask : undefined}
                    onEditTask={!isViewOnly && !isDemoMode ? setEditingTask : undefined}
                    onApproveTask={!isViewOnly && !isDemoMode ? handleApproveTask : undefined}
                    onRejectTask={!isViewOnly && !isDemoMode ? handleRejectTask : undefined}
                    mcpServers={state.mcpServers}
                  />
                </div>
                <div className={`absolute inset-0 ${activeTab === 'network' ? 'block' : 'hidden'} z-0`}>
                  <NetworkVisualizer
                    agents={state.agents}
                    tasks={state.tasks}
                    isProcessing={state.isProcessing || autoPilotStatus === 'running'}
                    useInternet={state.useInternet}
                  />
                </div>
                <div className={`absolute inset-0 ${activeTab === 'requirements' ? 'block' : 'hidden'} z-0`}>
                  <RequirementsDashboard
                    artifacts={state.artifacts}
                    onCreateTask={!isViewOnly && !isDemoMode ? (task) => {
                      dispatch({ type: 'ADD_TASK', payload: task });
                      addLog(`Task scheduled: ${task.title}`, AgentRole.ORCHESTRATOR, 'action');
                    } : undefined}
                  />
                </div>
                {/* Code Editor - Always render, show message if disabled */}
                <div className={`absolute inset-0 ${activeTab === 'ide' ? 'block' : 'hidden'} z-0`}>
                  {canUseCodeEditor.loading ? (
                    <div className="flex items-center justify-center h-full">
                      <Loader2 className="animate-spin text-primary" size={32} />
                    </div>
                  ) : shouldShowFeature(canUseCodeEditor) ? (
                    <CodeEditor
                      artifacts={state.artifacts}
                      onSave={!isViewOnly && !isDemoMode ? handleSaveArtifact : undefined}
                      onUpload={!isViewOnly && !isDemoMode ? handleArtifactUpload : undefined}
                      currentPhase={state.currentPhase}
                      readOnly={isViewOnly || isDemoMode}
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full bg-slate-50">
                      <div className="text-center p-6">
                        <p className="text-slate-600 font-semibold mb-2">Code Editor is not available for your role</p>
                        <p className="text-sm text-slate-500">Please contact an administrator to enable this feature.</p>
                      </div>
                    </div>
                  )}
                </div>
                {/* Artifact Viewer - Always render, show message if disabled */}
                <div className={`absolute inset-0 ${activeTab === 'artifacts' ? 'block' : 'hidden'} z-0`}>
                  {canUseArtifactViewer.loading ? (
                    <div className="flex items-center justify-center h-full">
                      <Loader2 className="animate-spin text-primary" size={32} />
                    </div>
                  ) : shouldShowFeature(canUseArtifactViewer) ? (
                    <ArtifactViewer artifacts={state.artifacts} currentPhase={state.currentPhase} />
                  ) : (
                    <div className="flex items-center justify-center h-full bg-slate-50">
                      <div className="text-center p-6">
                        <p className="text-slate-600 font-semibold mb-2">Artifact Viewer is not available for your role</p>
                        <p className="text-sm text-slate-500">Please contact an administrator to enable this feature.</p>
                      </div>
                    </div>
                  )}
                </div>
                <div className={`absolute inset-0 ${activeTab === 'knowledge' ? 'block' : 'hidden'} z-0`}>
                  <KnowledgeBase
                    projectDescription={state.description}
                    artifacts={state.artifacts}
                    tasks={state.tasks}
                    onUpload={!isDemoMode ? handleArtifactUpload : undefined}
                  />
                </div>
                <div className={`absolute inset-0 ${activeTab === 'compliance' ? 'block' : 'hidden'} z-0`}>
                  <Suspense fallback={<div className="flex items-center justify-center h-full"><Loader2 className="animate-spin text-primary" /></div>}>
                    <ComplianceDashboard
                      activeStandards={state.selectedStandards}
                      artifacts={state.artifacts}
                      tasks={state.tasks}
                      onAddStandard={!isViewOnly && !isDemoMode ? handleAddStandard : undefined}
                      onRemoveStandard={!isViewOnly && !isDemoMode ? handleRemoveStandard : undefined}
                      onRunAudit={!isViewOnly && !isDemoMode ? handleRunAudit : undefined}
                      isProcessing={state.isProcessing || autoPilotStatus === 'running'}
                    />
                  </Suspense>
                </div>
                <div className={`absolute inset-0 ${activeTab === 'budget' ? 'block' : 'hidden'} z-0`}>
                  <CostEstimator
                    agents={state.agents}
                    tasks={state.tasks}
                    budget={state.budget}
                    projectId={state.id}
                    onUpdateBudget={!isDemoMode ? (val) => dispatch({ type: 'UPDATE_BUDGET_CAP', payload: val }) : undefined}
                  />
                </div>
                <div className={`absolute inset-0 p-6 overflow-auto ${activeTab === 'completion' ? 'block' : 'hidden'} z-0`}>
                  <ProjectCompletion
                    projectId={state.id}
                    projectStatus={state.status as any}
                    onComplete={async () => {
                      // Refresh project state from API instead of reloading page
                      if (state.id) {
                        try {
                          const { getProject } = await import('../services/projectStorage');
                          // Add a small delay to ensure backend has processed the completion
                          await new Promise(resolve => setTimeout(resolve, 500));
                          const updatedProject = await getProject(state.id);
                          if (updatedProject) {
                            // Update project state with new data
                            dispatch({ type: 'RESET_PROJECT', payload: updatedProject });
                            addLog('Project completed successfully', AgentRole.ORCHESTRATOR, 'success');
                          } else {
                            // Project not found, but don't reload - just show message
                            addLog('Project completion finished. Refresh to see updates.', AgentRole.ORCHESTRATOR, 'info');
                          }
                        } catch (error: any) {
                          console.error('Failed to refresh project after completion:', error);
                          addLog('Project completed, but failed to refresh state. Please refresh the page.', AgentRole.ORCHESTRATOR, 'warning');
                        }
                      }
                    }}
                    onPackage={() => {
                      addLog('Project package downloaded', AgentRole.ORCHESTRATOR, 'success');
                    }}
                  />
                </div>
                {/* Prototype Tab - Inherited from wizard, shows build artifact with applied theme */}
                <div className={`absolute inset-0 ${activeTab === 'prototype' ? 'block' : 'hidden'} z-0 relative`} style={{ height: '100%', width: '100%' }}>
                  {(() => {
                    // Find build artifact (prototype) - with sessionStorage fallback for guest users
                    const buildArtifact = (() => {
                      // Try to get from state (database-backed projects)
                      const artifact = state.artifacts.find(a => a.type === 'build');
                      if (artifact) return artifact;

                      // Fallback: Check sessionStorage for guest users
                      if (user?.role === 'guest' && state.artifacts.length === 0) {
                        return getGuestPrototypeArtifact();
                      }

                      return null;
                    })();
                    const currentTheme = availableThemes.find(t => t.id === (state.selectedTheme || selectedTheme));

                    if (!buildArtifact) {
                      return (
                        <div className="flex items-center justify-center h-full bg-gradient-to-br from-slate-50 via-white to-slate-50">
                          <div className="text-center p-6 max-w-md">
                            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/10 to-purple-500/10 flex items-center justify-center mb-6 border border-primary/20 mx-auto">
                              <Eye size={40} className="text-primary/60" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-700 mb-2">No Prototype Available</h3>
                            <p className="text-sm text-slate-500 text-center mb-6">
                              The prototype will appear here once the build agent generates the final HTML5 build artifact.
                            </p>
                            {!isDemoMode && !isViewOnly && (
                              <button
                                onClick={handleForceBuild}
                                className="px-6 py-3 bg-gradient-to-r from-primary to-blue-600 text-white rounded-xl text-xs font-bold uppercase tracking-wider hover:from-blue-600 hover:to-primary transition-all shadow-lg flex items-center gap-2 mx-auto"
                              >
                                <Zap size={14} /> Force Build
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div className="h-full w-full relative" style={{ height: '100%', width: '100%' }}>
                        {/* Guest Session Indicator */}
                        {user?.role === 'guest' && (buildArtifact as any)?._isGuestPrototype && (
                          <div className="absolute top-4 right-4 z-10">
                            <div className="px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2 text-xs text-amber-700 font-bold shadow-sm">
                              <AlertCircle size={14} />
                              <span>Guest Session - Not Saved</span>
                            </div>
                          </div>
                        )}
                        <PreviewFrame
                          artifact={buildArtifact}
                          theme={currentTheme}
                          onForceBuild={!isDemoMode && !isViewOnly ? handleForceBuild : undefined}
                          onOpenThemeStudio={!isDemoMode ? () => setShowThemeStudio(true) : undefined}
                        />
                      </div>
                    );
                  })()}
                </div>
                {/* Developer Tools Tab */}
                <div className={`absolute inset-0 ${activeTab === 'dev-tools' ? 'block' : 'hidden'} z-0 flex flex-col`}>
                  {canUseAICodeGeneration.loading ? (
                    <div className="flex items-center justify-center h-full">
                      <Loader2 className="animate-spin text-primary" size={32} />
                    </div>
                  ) : shouldShowFeature(canUseAICodeGeneration) ? (
                    <div className="flex flex-col h-full">
                      {/* Sub-tabs for Developer Tools */}
                      <div className="flex items-center gap-1 p-2 border-b border-slate-200 bg-white/80 backdrop-blur-md shrink-0">
                        <button
                          onClick={() => setDevToolTab('github-integration')}
                          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all ${devToolTab === 'github-integration'
                            ? 'bg-primary text-white shadow-sm'
                            : 'text-slate-600 hover:bg-slate-100'
                            }`}
                        >
                          <GitBranch size={14} />
                          GitHub Integration
                        </button>
                        {/* Show Mobile Deployment only if project needs mobile app */}
                        {state.architecture?.needsMobileApp && (
                          <button
                            onClick={() => setDevToolTab('mobile-deployment')}
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all ${devToolTab === 'mobile-deployment'
                              ? 'bg-primary text-white shadow-sm'
                              : 'text-slate-600 hover:bg-slate-100'
                              }`}
                          >
                            <Smartphone size={14} />
                            Mobile Deployment
                          </button>
                        )}
                      </div>
                      {/* Developer Tools Content */}
                      <div className="flex-1 overflow-auto p-6">
                        {devToolTab === 'github-integration' && (
                          <GitHubIntegrationPanel
                            projectId={state.id}
                            token={authToken}
                            userRole={userRole}
                          />
                        )}
                        {devToolTab === 'mobile-deployment' && state.architecture?.needsMobileApp && (
                          <MobileDeploymentWizard
                            projectId={state.id}
                            projectName={state.name}
                            token={authToken}
                            userRole={userRole}
                            agentRecommendedFramework={state.architecture?.mobileAppType}
                            agentRecommendedPlatform={state.architecture?.recommendations?.mobileApp?.platform}
                            agentReasoning={state.architecture?.recommendations?.mobileApp?.reasoning || state.architecture?.reasoning}
                          />
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-full bg-slate-50">
                      <div className="text-center p-6">
                        <p className="text-slate-600 font-semibold mb-2">Developer Tools are not available for your role</p>
                        <p className="text-sm text-slate-500">Please contact an administrator to enable this feature.</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Mobile Deployment Wizard Modal */}
            {showMobileDeploymentWizard && (
              <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setShowMobileDeploymentWizard(false)}>
                <div className="bg-gray-900 rounded-lg border border-gray-700 w-full max-w-4xl max-h-[90vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
                  <MobileDeploymentWizard
                    projectId={state.id}
                    projectName={state.name}
                    token={authToken}
                    userRole={userRole}
                    onClose={() => setShowMobileDeploymentWizard(false)}
                    agentRecommendedFramework={state.architecture?.mobileAppType}
                    agentRecommendedPlatform={state.architecture?.recommendations?.mobileApp?.platform}
                    agentReasoning={state.architecture?.recommendations?.mobileApp?.reasoning || state.architecture?.reasoning}
                  />
                </div>
              </div>
            )}

            {/* WebTerminal Modal */}
            {showTerminal && (
              <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setShowTerminal(false)}>
                <div className="bg-gray-900 rounded-lg border border-gray-700 w-full max-w-4xl h-[80vh] overflow-hidden flex flex-col shadow-2xl" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-between p-3 border-b border-gray-700 bg-gray-800">
                    <h3 className="text-white font-medium flex items-center gap-2 text-sm tracking-wide">
                      <TerminalIcon size={16} className="text-primary" />
                      WebContainer Terminal
                      <span className="text-xs text-gray-500 font-normal ml-2">(Shared Session)</span>
                    </h3>
                    <button onClick={() => setShowTerminal(false)} className="text-gray-400 hover:text-white transition-colors p-1 hover:bg-white/10 rounded">
                      <XCircle size={18} />
                    </button>
                  </div>
                  <div className="flex-1 overflow-hidden relative bg-black">
                    <WebTerminal webContainerInstance={webContainerService.getInstance()} />
                  </div>
                </div>
              </div>
            )}

            <div
              onMouseDown={(e) => {
                e.stopPropagation();
                setIsResizingLogs(true);
              }}
              className={`h-1.5 w-full cursor-row-resize transition-all flex items-center justify-center group z-30 border-t border-slate-200 ${isResizingLogs ? 'bg-primary/20' : 'bg-white hover:bg-primary/5'}`}
            >
              <div className={`w-12 h-1 rounded-full transition-colors ${isResizingLogs ? 'bg-primary' : 'bg-slate-300 group-hover:bg-primary/50'}`} />
            </div>
            <div
              style={{ height: isLogsCollapsed ? 36 : logHeight }}
              className="shrink-0 bg-slate-50 overflow-hidden flex flex-col shadow-inner transition-all duration-300"
              onFocus={(e) => e.stopPropagation()}
              onBlur={(e) => e.stopPropagation()}
            >
              <LogConsole
                logs={state.logs}
                isCollapsed={isLogsCollapsed}
                onToggleCollapse={handleToggleLogsCollapse}
              />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default WorkspaceView;
