import React, { useState } from 'react';

export type WorkflowPhase = 'exploration' | 'definition' | 'suggestion' | 'prototyping' | 'launch';

interface WorkflowContainerProps {
    activePhase: WorkflowPhase;
    onPhaseChange: (phase: WorkflowPhase) => void;
    children: React.ReactNode;
}

export const WorkflowContainer: React.FC<WorkflowContainerProps> = ({
    activePhase,
    onPhaseChange,
    children
}) => {
    return (
        <div className="w-full h-full flex flex-col bg-slate-50 relative overflow-hidden transition-colors duration-500">
            {/* Cards Container */}
            <div className="flex-1 w-full h-full relative p-6 overflow-hidden">
                {children}
            </div>
        </div>
    );
};
