
import React from 'react';
import { Idea } from '../../OrbGraph';
import ViewToggle, { IdeationViewType } from '../../ViewToggle';
import IdeaTreeGraph from '../../IdeaTreeGraph';
import MindMapGraph from '../../MindMapGraph';
import ResearchView from '../../ResearchView';
import OrbGraph3D from '../../OrbGraph3D';
import { ProjectPreview } from '../../../services/geminiService';
import { ChatMessage } from '@orbitai/shared';
import OrbGraph from '../../OrbGraph';

interface IdeaVisualizationProps {
    viewMode: IdeationViewType;
    ideas: Idea[];
    activeIdeaId: string | null;
    onIdeaClick: (id: string | null) => void;
    topic: string;
    projectPreview: ProjectPreview | null;
    messages: ChatMessage[];
    keyInsights: string[];
    nextSteps: string[];
    selectedIdeaIds: Set<string>;
    onIdeaDelete: (id: string) => Promise<void>;
    onViewChange: (mode: IdeationViewType) => void;
    showViewToggle?: boolean;
}

export const IdeaVisualization: React.FC<IdeaVisualizationProps> = ({
    viewMode,
    ideas,
    activeIdeaId,
    onIdeaClick,
    topic,
    projectPreview,
    messages,
    keyInsights,
    nextSteps,
    selectedIdeaIds,
    onIdeaDelete,
    onViewChange,
    showViewToggle = true,
}) => {
    return (
        <div className="flex-1 bg-slate-50 relative overflow-hidden flex flex-col">
            {/* View Toggle - Top Center */}
            {showViewToggle && (
                <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30">
                    <ViewToggle currentView={viewMode} onViewChange={onViewChange} />
                </div>
            )}

            {viewMode === 'bubble' && (
                <OrbGraph
                    topic={topic}
                    ideas={ideas}
                    activeIdeaId={activeIdeaId}
                    selectedIdeaIds={selectedIdeaIds}
                    onIdeaClick={onIdeaClick}
                    onIdeaDelete={onIdeaDelete}
                />
            )}

            {viewMode === 'tree' && (
                <IdeaTreeGraph
                    ideas={ideas}
                    activeIdeaId={activeIdeaId}
                    onIdeaClick={onIdeaClick}
                />
            )}

            {viewMode === 'mindmap' && (
                <MindMapGraph
                    ideas={ideas}
                    activeIdeaId={activeIdeaId}
                    onIdeaClick={onIdeaClick}
                    centralTopic={topic}
                />
            )}

            {viewMode === 'research' && (
                <ResearchView
                    topic={topic}
                    ideas={ideas}
                    messages={messages}
                    projectPreview={projectPreview} // Pass project preview if available
                    activeIdeaId={activeIdeaId}
                />
            )}

            {viewMode === '3d' && (
                <div className="w-full h-full">
                    <OrbGraph3D
                        ideas={ideas}
                        activeIdeaId={activeIdeaId}
                        onIdeaClick={onIdeaClick}
                        keyInsights={keyInsights}
                        nextSteps={nextSteps}
                    />
                </div>
            )}
        </div>
    );
};
