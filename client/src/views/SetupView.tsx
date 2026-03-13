import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import { ProjectState } from '@orbitai/shared';
import { ProjectAction } from '@orbitai/shared';
import { ChatMessage, ProjectPreview } from '@orbitai/shared';
import { QUALITY_STANDARDS, PROJECT_THEMES } from '@orbitai/shared';

// Workflow Components
import { WorkflowContainer, WorkflowPhase } from '../components/workflow/WorkflowContainer';
import { ExplorationCard } from '../components/workflow/ExplorationCard';
import { DefinitionCard } from '../components/workflow/DefinitionCard';
import { SuggestionCard } from '../components/workflow/SuggestionCard';
import { PrototypingCard } from '../components/workflow/PrototypingCard';
import { LaunchCard } from '../components/workflow/LaunchCard';

// Original services/types imports needed for handlers
import { calculateMaturityAssessment, calculateHybridMaturityAssessment } from '@src/utils/maturityAssessment';
import { generateProjectPreview } from '../services/geminiService';

interface SetupViewProps {
    // Core state
    state: ProjectState;
    dispatch: React.Dispatch<ProjectAction>;

    // User & UI state
    user: any;
    dismissedGuestBanner: boolean;
    setDismissedGuestBanner: (dismissed: boolean) => void;
    setShowUserSignup: (show: boolean) => void;
    setViewMode: (mode: 'setup' | 'workspace' | 'landing' | 'admin' | 'shared') => void;

    // Setup state (Existing props maintained for compatibility)
    setupMessages: ChatMessage[];
    setSetupMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
    setupInput: string;
    setSetupInput: React.Dispatch<React.SetStateAction<string>>;
    setupFiles: File[];
    setSetupFiles: React.Dispatch<React.SetStateAction<File[]>>;
    isDraggingSetup: boolean;
    setIsDraggingSetup: React.Dispatch<React.SetStateAction<boolean>>;
    setupProjectName: string;
    setSetupProjectName: React.Dispatch<React.SetStateAction<string>>;
    hasManuallyEditedProjectName: boolean;
    setHasManuallyEditedProjectName: React.Dispatch<React.SetStateAction<boolean>>;
    setupStage: 'input' | 'preview';
    setSetupStage: React.Dispatch<React.SetStateAction<'input' | 'preview'>>;
    projectPreview: ProjectPreview | null;
    setProjectPreview: React.Dispatch<React.SetStateAction<ProjectPreview | null>>;
    previewTab: 'summary' | 'wireframe' | 'architecture' | 'theme';
    setPreviewTab: React.Dispatch<React.SetStateAction<'summary' | 'wireframe' | 'architecture' | 'theme'>>;
    selectedTheme: string;
    setSelectedTheme: React.Dispatch<React.SetStateAction<string>>;
    availableThemes: any[];
    setAvailableThemes: React.Dispatch<React.SetStateAction<any[]>>;
    themeInput: string;
    setThemeInput: React.Dispatch<React.SetStateAction<string>>;
    isGeneratingTheme: boolean;
    setIsGeneratingTheme: React.Dispatch<React.SetStateAction<boolean>>;
    showStandards: boolean;
    setShowStandards: React.Dispatch<React.SetStateAction<boolean>>;
    tempSelectedStandards: string[];
    setTempSelectedStandards: React.Dispatch<React.SetStateAction<string[]>>;
    isResearching: boolean;
    setIsResearching: React.Dispatch<React.SetStateAction<boolean>>;
    isEnhancingInput: boolean;
    setIsEnhancingInput: React.Dispatch<React.SetStateAction<boolean>>;
    isGeneratingSuggestions: boolean;
    setIsGeneratingSuggestions: React.Dispatch<React.SetStateAction<boolean>>;
    displayedSuggestions: any[];
    setDisplayedSuggestions: React.Dispatch<React.SetStateAction<any[]>>;
    processingLabel: string | null;

    // Refs
    setupInputRef: React.RefObject<HTMLTextAreaElement>;
    setupEndRef: React.RefObject<HTMLDivElement>;

    // Computed values
    architectureArtifact: any;
    wireframeArtifact: any;

    // Handlers
    handleSetupSend: (e: React.SyntheticEvent, stageContext?: string) => void;
    handleDeepResearch: (isChat: boolean, query?: string) => void;
    handleEnhanceInput: (isChat: boolean) => void;
    handleManualLaunch: (e?: React.MouseEvent) => void;
    handleLaunchFromBrainstorming?: (brainstormingData: {
        topic: string;
        ideas: any[];
        keyInsights: string[];
        nextSteps: string[];
        projectPreview: ProjectPreview | null;
        selectedStandards: string[];
        messages: ChatMessage[];
        useInternet: boolean;
        conversationId: string | null;
    }) => Promise<void> | void;
    handleSetupDragOver: (e: React.DragEvent) => void;
    handleSetupDragLeave: (e: React.DragEvent) => void;
    handleSetupDrop: (e: React.DragEvent) => void;
    removeSetupFile: (index: number) => void;
    handleSuggestionClick: (prompt: string) => void;
    toggleStandard: (id: string) => void;
    handleRandomTheme: () => void;
    handleAiThemeGen: (e?: React.FormEvent) => void;
    canProceedToPreview: (messages: ChatMessage[]) => { canProceed: boolean; reason?: string };
    handleJumpToPreview: () => Promise<void>;

    // Callback for syncing projectPreview changes to parent
    onProjectPreviewChange?: (preview: ProjectPreview | null) => void;
}

export const SetupView: React.FC<SetupViewProps> = React.memo((props) => {
    // Only log in development and throttle logs
    if (import.meta.env.DEV) {
        const lastLog = sessionStorage.getItem('setupview_last_log') || '0';
        const now = Date.now();
        if ((now - parseInt(lastLog)) > 1000) { // Log max once per second
            console.log('🚀 [SetupView] RENDER. ActivePhase:', props.initialPhase || 'default');
            sessionStorage.setItem('setupview_last_log', now.toString());
        }
    }
    // Workflow State
    const [activePhase, setActivePhase] = useState<WorkflowPhase>('exploration');
    const [generationProgress, setGenerationProgress] = useState(0);

    // Suggestions Mock Data (In reality this would come from AI analysis)
    // We can derive this from projectPreview if available or just mock for now
    const suggestions = useMemo(() => {
        if (props.projectPreview?.recommendedMethodology) {
            // If we have a preview, we can show what was generated
            return [];
        }
        return [
            { id: 'webapp', type: 'web-app' as const, title: 'Web Application', description: 'Modern React + Node.js full stack application', confidence: 0.95 },
            { id: 'mobile', type: 'mobile-app' as const, title: 'Mobile App', description: 'Cross-platform mobile experience with React Native', confidence: 0.8 },
            { id: 'site', type: 'website' as const, title: 'Website', description: 'High-performance marketing website', confidence: 0.7 }
        ];
    }, [props.projectPreview]);

    // Handle Phase Transitions
    const goToDefinition = () => setActivePhase('definition');
    const goToSuggestion = () => {
        // Before going to suggestion, ensure we have a project preview or trigger generation if appropriate
        // For now, simple transition
        setActivePhase('suggestion');
    };
    const goToPrototyping = () => setActivePhase('prototyping');
    const goToLaunch = () => setActivePhase('launch');

    // Handle Prototype Generation
    const handleGeneratePrototype = async () => {
        // Determine if we need to call handleJumpToPreview or if it's already done
        if (!props.projectPreview) {
            // Simulate progress for UX
            let prog = 0;
            const interval = setInterval(() => {
                prog += 5;
                if (prog > 90) clearInterval(interval);
                setGenerationProgress(prog);
            }, 300);

            await props.handleJumpToPreview();

            clearInterval(interval);
            setGenerationProgress(100);
        }
    };

    const handleProjectSelect = (id: string) => {
        // In a real scenario, this would configure the project type
        // For now, we skip straight to prototyping
        goToPrototyping();
    };

    const onLaunchWorkspace = () => {
        props.handleManualLaunch();
    };

    // Memoize callbacks at the top level (hooks must be called unconditionally)
    const handleSendMessage = useCallback((msg: string, ctx?: string) => {
        // Create synthetic event
        const syntheticEvent = {
            preventDefault: () => { },
            stopPropagation: () => { },
            currentTarget: { value: msg || '' }
        } as unknown as React.SyntheticEvent;
        props.handleSetupSend(syntheticEvent, ctx);
        if (msg) props.setSetupInput('');
    }, [props.handleSetupSend, props.setSetupInput]);

    const handleToggleInternet = useCallback(() => {
        props.dispatch({ type: 'TOGGLE_INTERNET', payload: !props.state.useInternet });
    }, [props.dispatch, props.state.useInternet]);

    const handleDeepResearchCallback = useCallback((q?: string) => {
        props.handleDeepResearch(false, q);
    }, [props.handleDeepResearch]);

    return (
        <div className="fixed inset-0 z-50 bg-slate-50">
            <WorkflowContainer activePhase={activePhase} onPhaseChange={setActivePhase}>
                {activePhase === 'exploration' && (
                    <ExplorationCard
                        onStartChat={goToDefinition}
                        isProcessing={false}
                    />
                )}

                {activePhase === 'definition' && (
                    <DefinitionCard
                        // Pass all NeuralStreamChat props
                        messages={props.setupMessages}
                        onSendMessage={handleSendMessage}
                        input={props.setupInput}
                        setInput={props.setSetupInput}
                        isProcessing={props.state.isProcessing || props.isResearching || props.isEnhancingInput}
                        processingLabel={props.processingLabel}
                        useInternet={props.state.useInternet}
                        onToggleInternet={handleToggleInternet}
                        selectedStandards={props.tempSelectedStandards}
                        onToggleStandard={props.toggleStandard}
                        onDeepResearch={handleDeepResearchCallback}
                        onLaunchProject={props.handleLaunchFromBrainstorming}
                        onLoadConversation={props.setSetupMessages}
                        onProjectPreviewChange={props.onProjectPreviewChange}
                        // Transition
                        onNext={goToSuggestion}
                    />
                )}

                {activePhase === 'suggestion' && (
                    <SuggestionCard
                        suggestions={suggestions}
                        onSelectProject={handleProjectSelect}
                        onBack={() => setActivePhase('definition')}
                    />
                )}

                {activePhase === 'prototyping' && (
                    <PrototypingCard
                        projectPreview={props.projectPreview}
                        isGenerating={props.state.isProcessing || props.isResearching} // Simple check
                        progress={generationProgress}
                        onGenerate={handleGeneratePrototype}
                        onLaunch={goToLaunch}
                        onBack={() => setActivePhase('suggestion')}
                    />
                )}

                {activePhase === 'launch' && (
                    <LaunchCard
                        projectName={props.setupProjectName}
                        onLaunch={onLaunchWorkspace}
                    />
                )}
            </WorkflowContainer>
        </div>
    );
}, (prevProps, nextProps) => {
    // Custom comparison function for React.memo
    // Returns true if props are equal (skip re-render), false if different (re-render)
    const propsEqual = (
        prevProps.state.id === nextProps.state.id &&
        prevProps.state.isProcessing === nextProps.state.isProcessing &&
        prevProps.state.useInternet === nextProps.state.useInternet &&
        prevProps.setupMessages.length === nextProps.setupMessages.length &&
        prevProps.setupInput === nextProps.setupInput &&
        prevProps.projectPreview === nextProps.projectPreview &&
        prevProps.selectedTheme === nextProps.selectedTheme &&
        prevProps.user?.id === nextProps.user?.id &&
        prevProps.isResearching === nextProps.isResearching &&
        prevProps.isEnhancingInput === nextProps.isEnhancingInput &&
        prevProps.isGeneratingSuggestions === nextProps.isGeneratingSuggestions &&
        prevProps.processingLabel === nextProps.processingLabel &&
        prevProps.tempSelectedStandards.length === nextProps.tempSelectedStandards.length &&
        prevProps.handleSetupSend === nextProps.handleSetupSend &&
        prevProps.handleDeepResearch === nextProps.handleDeepResearch &&
        prevProps.toggleStandard === nextProps.toggleStandard
    );
    return propsEqual; // true = skip re-render, false = re-render
});

export default SetupView;
