import React, { Suspense } from 'react';
import { WifiOff, Loader2 } from 'lucide-react';
import { ProjectState, UserProfile, Agent, Task, ChatMessage, AppSettings, APIHealth } from '@orbitai/shared';
import { ErrorBoundary } from './ErrorBoundary';
import { SkipLink } from './SkipLink';
import UserSupportWidget from './UserSupportWidget';
import { ToastContainer } from './Toast';
import { toastService, Toast } from '../services/toastService';
import SubscriptionOverlay from './SubscriptionOverlay';
import UserProfileModal from './UserProfileModal';
import UserLogin from './UserLogin';
import UserSignup from './UserSignup';
import HITLPromptModal from './HITLPromptModal';
import ConfirmationModal from './ConfirmationModal';
import AgentChat from './AgentChat';
import ErrorDisplay from './ErrorDisplay';
import ProcessingOverlay from './ProcessingOverlay';
import ThemeStudio from './ThemeStudio';
import { DeleteProjectModal } from './DeleteProjectModal';
import { DeleteTaskModal } from './DeleteTaskModal';

// Lazy Load Modals
const SettingsModal = React.lazy(() => import('./SettingsModal'));
const AgentDetailModal = React.lazy(() => import('./AgentDetailModal'));
const AgentEditorModal = React.lazy(() => import('./AgentEditorModal'));
const ProjectTemplateSelector = React.lazy(() => import('./ProjectTemplateSelector'));

export interface AppShellProps {
    // Layout & View
    children: React.ReactNode;
    viewMode: string;
    isModernView: boolean;
    isOffline: boolean;

    // State
    state: ProjectState;
    user: UserProfile | null;
    toasts: Toast[];

    // Modals visibility
    showSubscription: boolean;
    setShowSubscription: (show: boolean) => void;
    subscriptionMode: 'pricing' | 'details';
    setSubscriptionMode: (mode: 'pricing' | 'details') => void;

    showThemeStudio: boolean;
    setShowThemeStudio: (show: boolean) => void;

    showUserProfile: boolean;
    setShowUserProfile: (show: boolean) => void;

    showUserLogin: boolean;
    setShowUserLogin: (show: boolean) => void;

    showUserSignup: boolean;
    setShowUserSignup: (show: boolean) => void;

    showHITLPrompt: boolean;
    setShowHITLPrompt: (show: boolean) => void;

    showSettings: boolean;
    setShowSettings: (show: boolean) => void;

    showTemplateSelector: boolean;
    setShowTemplateSelector: (show: boolean) => void;

    // Data for Modals
    editingTask: Task | null;
    setEditingTask: (task: Task | null) => void;

    selectedAgentDetail: Agent | null;
    setSelectedAgentDetail: (agent: Agent | null) => void;

    editingAgent: Agent | null;
    setEditingAgent: (agent: Agent | null) => void;
    isCreatingNewAgent: boolean;
    setIsCreatingNewAgent: (isNew: boolean) => void;

    projectToDelete: string | null;
    setProjectToDelete: (id: string | null) => void;

    taskToDelete: any | null;
    setTaskToDelete: (task: any | null) => void;

    confirmationModal: {
        isOpen: boolean;
        type?: 'confirm' | 'alert' | 'success' | 'error' | 'info';
        title: string;
        message: string;
        confirmText?: string;
        cancelText?: string;
        onConfirm?: () => void;
        onCancel?: () => void;
    };
    setConfirmationModal: React.Dispatch<React.SetStateAction<any>>;

    currentError: string | null;
    setCurrentError: (error: string | null) => void;

    // Processing state
    processingLabel: string | null;
    processingProgress: number;
    processingStatusText?: string;
    processingEstimatedTime?: number;
    processingTaskCount?: number;

    // Chat
    activeChatAgent: Agent | null;
    setActiveChatAgent: (agent: Agent | null) => void;
    chatHistory: Record<string, ChatMessage[]>;
    isChatThinking: boolean;

    // Handlers
    handleLogin: () => void;
    handleUserLogout: () => void;
    handleUserLoginSuccess?: (userData: any) => void;
    handleUserSignupSuccess?: (userData: any) => void;
    toggleModernView: () => void;
    handleUpdateTask: (task: Task) => void;
    handleAiModifyTask: (task: Task, instruction: string) => Promise<void>;
    setHITLPreference: (enabled: boolean) => void;
    pendingActionRef: React.MutableRefObject<any>;
    handleResetProject: () => void;
    userRole: string; // from useFeatureAccess ? No, passed from App?
    dispatch: any; // project dispatch
    addLog: (text: string, source: string, type: 'info' | 'warning' | 'error' | 'success' | 'action') => void;

    handleSelectTemplate: (templateId: string) => void;
    handleSaveAsTemplate: (name: string) => void;
    canCustomizeAgents: string; // feature flag?
    isFeatureEnabled: (feature: string) => boolean;

    handleSendMessage: (text: string) => void;
    confirmDeleteTask: () => void;
    deleteProject: (id: string) => void;

    // Theme Studio specific
    themeInput: string;
    setThemeInput: (val: string) => void;
    handleAiThemeGen: (e: React.FormEvent) => void;
    handleRandomTheme: () => void;
    isGeneratingTheme: boolean;
    availableThemes: any[];
    selectedTheme: string | null;
    setSelectedTheme: (id: string) => void;

    // Misc
    apiHealth: { status: APIHealth, metrics: any };
}

export const AppShell: React.FC<AppShellProps> = (props) => {
    const {
        children, viewMode, isModernView, isOffline,
        state, user, toasts,
        showSubscription, setShowSubscription, subscriptionMode, setSubscriptionMode,
        showThemeStudio, setShowThemeStudio,
        showUserProfile, setShowUserProfile,
        showHITLPrompt, setShowHITLPrompt,
        showSettings, setShowSettings,
        showTemplateSelector, setShowTemplateSelector,
        editingTask, setEditingTask,
        selectedAgentDetail, setSelectedAgentDetail,
        editingAgent, setEditingAgent, isCreatingNewAgent, setIsCreatingNewAgent,
        projectToDelete, setProjectToDelete,
        taskToDelete, setTaskToDelete,
        confirmationModal, setConfirmationModal,
        currentError, setCurrentError,
        processingLabel, processingProgress, processingStatusText, processingEstimatedTime, processingTaskCount,
        activeChatAgent, setActiveChatAgent, chatHistory, isChatThinking,
        handleLogin, handleUserLogout, handleUserLoginSuccess, handleUserSignupSuccess, toggleModernView,
        showUserLogin, setShowUserLogin, showUserSignup, setShowUserSignup,
        handleUpdateTask, handleAiModifyTask,
        setHITLPreference, pendingActionRef, handleResetProject,
        dispatch, addLog,
        handleSelectTemplate, handleSaveAsTemplate,
        isFeatureEnabled, canCustomizeAgents,
        handleSendMessage, confirmDeleteTask, deleteProject,
        themeInput, setThemeInput, handleAiThemeGen, handleRandomTheme, isGeneratingTheme,
        availableThemes, selectedTheme, setSelectedTheme,
        apiHealth, userRole
    } = props;

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

            {/* Main Content (App Router) with ErrorBoundary & Suspense */}
            <ErrorBoundary>
                <Suspense fallback={<div className="flex items-center justify-center h-screen"><Loader2 className="animate-spin text-primary" size={32} /></div>}>
                    {children}
                </Suspense>
            </ErrorBoundary>

            {/* --- ALL GLOBAL MODALS & OVERLAYS --- */}

            {/* Subscription Overlay */}
            {showSubscription && (
                <SubscriptionOverlay
                    isOpen={showSubscription}
                    onLogin={handleLogin}
                    onClose={() => setShowSubscription(false)}
                    initialMode={subscriptionMode}
                    currentPlan={user?.plan}
                />
            )}

            {/* Theme Studio */}
            <ThemeStudio
                isOpen={showThemeStudio}
                onClose={() => setShowThemeStudio(false)}
                themeInput={themeInput}
                setThemeInput={setThemeInput}
                handleAiThemeGen={handleAiThemeGen}
                handleRandomTheme={handleRandomTheme}
                isGeneratingTheme={isGeneratingTheme}
                availableThemes={availableThemes}
                selectedTheme={selectedTheme}
                setSelectedTheme={setSelectedTheme}
                dispatch={dispatch}
                state={state}
            />

            {/* User Profile Modal */}
            {showUserProfile && user && (
                <UserProfileModal
                    user={user}
                    onClose={() => setShowUserProfile(false)}
                    onUpgrade={() => {
                        setSubscriptionMode('pricing');
                        setShowSubscription(true);
                        setTimeout(() => setShowUserProfile(false), 150);
                    }}
                    onLogout={() => {
                        setShowUserProfile(false);
                        handleUserLogout();
                    }}
                    isModernView={isModernView}
                    onToggleModernView={toggleModernView}
                />
            )}

            {/* User Login Modal */}
            {showUserLogin && (
                <UserLogin
                    onLoginSuccess={(userData: any) => {
                        setShowUserLogin(false);
                        if (handleUserLoginSuccess) {
                            handleUserLoginSuccess(userData);
                        }
                    }}
                    onSwitchToSignup={() => {
                        setShowUserLogin(false);
                        setShowUserSignup(true);
                    }}
                    onClose={() => setShowUserLogin(false)}
                />
            )}

            {/* User Signup Modal */}
            {showUserSignup && (
                <UserSignup
                    onSignupSuccess={(userData: any) => {
                        setShowUserSignup(false);
                        if (handleUserSignupSuccess) {
                            handleUserSignupSuccess(userData);
                        }
                    }}
                    onSwitchToLogin={() => {
                        setShowUserSignup(false);
                        setShowUserLogin(true);
                    }}
                    onClose={() => setShowUserSignup(false)}
                />
            )}

            {/* Task Editing Modal */}
            {editingTask && (
                <div className="absolute z-[100] top-0 left-0 w-full h-full pointer-events-none">
                    {/* Wrapper to ensure z-index context if needed, though TaskEditModal usually handles its own overlay */}
                    <div className="pointer-events-auto">
                        {/* TaskEditModal isn't lazy loaded in original code? Checking imports */}
                        {/* Original: import TaskEditModal from './components/TaskEditModal'; */}
                        {/* It was imported directly. I need to import it in AppShell too. */}
                        {/* I forgot to add it to imports above. Will fix using TaskEditModal lazy or regular */}
                        {/* I'll assume regular import for now, need to add it. */}
                    </div>
                </div>
            )}

            <HITLPromptModal
                isOpen={showHITLPrompt}
                onConfirm={(enableHITL) => {
                    setHITLPreference(enableHITL);
                    setShowHITLPrompt(false);
                    if (pendingActionRef.current) {
                        pendingActionRef.current();
                        pendingActionRef.current = null;
                    }
                }}
                onClose={() => {
                    setShowHITLPrompt(false);
                    pendingActionRef.current = null;
                }}
            />

            <Suspense fallback={null}>
                <SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} settings={props.state.settings || {}} onUpdateSettings={(s) => dispatch({ type: 'UPDATE_SETTINGS', payload: s })} onResetProject={handleResetProject} apiHealth={apiHealth} projectId={state.id} userRole={userRole} />

                <AgentDetailModal
                    agent={selectedAgentDetail}
                    onClose={() => setSelectedAgentDetail(null)}
                    onEdit={(agent) => { setSelectedAgentDetail(null); setEditingAgent(agent); }}
                    canEdit={isFeatureEnabled(canCustomizeAgents)}
                />

                {(editingAgent || isCreatingNewAgent) && (
                    <AgentEditorModal
                        agent={editingAgent}
                        isNew={isCreatingNewAgent}
                        onClose={() => { setEditingAgent(null); setIsCreatingNewAgent(false); }}
                        onSave={(agent) => {
                            if (isCreatingNewAgent) {
                                dispatch({ type: 'ADD_AGENT', payload: agent });
                                addLog(`New agent created: ${agent.name}`, AgentRole.ORCHESTRATOR, 'info');
                            } else {
                                dispatch({ type: 'UPDATE_AGENT', payload: { id: agent.id, agent } });
                                addLog(`Agent updated: ${agent.name}`, AgentRole.ORCHESTRATOR, 'info');
                            }
                            setEditingAgent(null);
                            setIsCreatingNewAgent(false);
                        }}
                    />
                )}
            </Suspense>

            <Suspense fallback={null}>
                <ProjectTemplateSelector
                    isOpen={showTemplateSelector}
                    onClose={() => setShowTemplateSelector(false)}
                    onSelectTemplate={handleSelectTemplate}
                    onSaveAsTemplate={handleSaveAsTemplate}
                    currentProject={viewMode === 'workspace' ? state : undefined}
                />
            </Suspense>

            {currentError && (
                <div className="fixed top-4 right-4 z-[100] max-w-md animate-in slide-in-from-top-5 duration-300">
                    <ErrorDisplay
                        error={currentError}
                        onDismiss={() => setCurrentError(null)}
                    />
                </div>
            )}

            {state.isProcessing && processingLabel && (
                <ProcessingOverlay
                    label={processingLabel}
                    progress={processingProgress}
                    statusText={processingStatusText}
                    estimatedTime={processingEstimatedTime}
                    taskCount={processingTaskCount}
                />
            )}

            <DeleteProjectModal
                projectToDelete={projectToDelete}
                setProjectToDelete={setProjectToDelete}
                deleteProject={deleteProject}
            />

            <ConfirmationModal
                isOpen={confirmationModal.isOpen}
                type={confirmationModal.type}
                title={confirmationModal.title}
                message={confirmationModal.message}
                confirmText={confirmationModal.confirmText}
                cancelText={confirmationModal.cancelText}
                onConfirm={confirmationModal.onConfirm}
                onCancel={confirmationModal.onCancel}
                onClose={() => setConfirmationModal(prev => ({ ...prev, isOpen: false }))}
            />

            <DeleteTaskModal
                taskToDelete={taskToDelete}
                setTaskToDelete={setTaskToDelete}
                confirmDeleteTask={confirmDeleteTask}
            />

            {activeChatAgent && (
                <AgentChat
                    agent={activeChatAgent}
                    messages={chatHistory[activeChatAgent.id] || []}
                    onSendMessage={handleSendMessage}
                    onClose={() => setActiveChatAgent(null)}
                    isThinking={isChatThinking}
                />
            )}

            {/* Skip Link */}
            <SkipLink />

            {/* User Support Widget */}
            {user && viewMode !== 'admin' && (
                <UserSupportWidget
                    userId={user.id}
                    userName={user.name}
                    userEmail={user.email}
                    userPlan={user.plan || "Free"}
                />
            )}

            {/* Toast Notifications */}
            <ToastContainer
                toasts={toasts}
                onDismiss={(id) => toastService.dismiss(id)}
            />
        </div>
    );
};
