import React, { useRef, useEffect } from 'react';
import NeuralStreamChat from '../NeuralStreamChat';
import { ChatMessage, ProjectPreview } from '@orbitai/shared';
import { Idea } from '../OrbGraph';

interface DefinitionCardProps {
    // NeuralStreamChat props
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
    onLaunchProject?: (brainstormingData: {
        topic: string;
        ideas: Idea[];
        keyInsights: string[];
        nextSteps: string[];
        projectPreview: ProjectPreview | null;
        selectedStandards: string[];
        messages: ChatMessage[];
        useInternet: boolean;
        conversationId: string | null;
    }) => Promise<void> | void;
    projectName?: string; // Project name to show as Central Idea from kickoff
    onProjectPreviewChange?: (preview: ProjectPreview | null) => void; // Callback when projectPreview changes

    // Transition props
    onNext: () => void;
    // Callback to load/clear conversation messages in parent state
    onLoadConversation?: (messages: ChatMessage[]) => void;
}

export const DefinitionCard: React.FC<DefinitionCardProps> = (props) => {
    return (
        <div className="w-full h-full bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden relative animate-in slide-in-from-right-8 duration-500">
            {/* We use NeuralStreamChat which now includes Mindmap and Glass Panel internally */}
            <NeuralStreamChat
                messages={props.messages}
                onSendMessage={props.onSendMessage}
                input={props.input}
                setInput={props.setInput}
                isProcessing={props.isProcessing}
                processingLabel={props.processingLabel}
                useInternet={props.useInternet}
                onToggleInternet={props.onToggleInternet}
                selectedStandards={props.selectedStandards}
                onToggleStandard={props.onToggleStandard}
                onDeepResearch={props.onDeepResearch}
                onLaunchProject={props.onLaunchProject}
                onLoadConversation={props.onLoadConversation}
                projectName={props.projectName}
                onProjectPreviewChange={props.onProjectPreviewChange}
            />

            {/* Continue to Suggestions Button - REMOVED */}
        </div>
    );
};

