import React from 'react';

export type IdeationViewType = 'bubble' | 'tree' | 'research' | '3d' | 'mindmap';

interface ViewToggleProps {
    currentView: IdeationViewType;
    onViewChange: (view: IdeationViewType) => void;
}

const ViewToggle: React.FC<ViewToggleProps> = ({ currentView, onViewChange }) => {
    return (
        <div className="flex items-center gap-1 bg-white/90 backdrop-blur-sm rounded-lg p-1 shadow-md border border-slate-200/50">
            {/* Bubble View */}
            <button
                onClick={() => onViewChange('bubble')}
                className={`
          flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200
          ${currentView === 'bubble'
                        ? 'bg-indigo-500 text-white shadow-sm'
                        : 'text-slate-600 hover:bg-slate-100'
                    }
        `}
                title="Bubble View - Organic force-directed layout"
            >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="3" />
                    <circle cx="5" cy="8" r="2" />
                    <circle cx="19" cy="8" r="2" />
                    <circle cx="7" cy="18" r="2" />
                    <circle cx="17" cy="18" r="2" />
                    <line x1="12" y1="9" x2="6.5" y2="9" />
                    <line x1="12" y1="9" x2="17.5" y2="9" />
                    <line x1="11" y1="14.5" x2="8" y2="16.5" />
                    <line x1="13" y1="14.5" x2="16" y2="16.5" />
                </svg>
                <span>Bubbles</span>
            </button>

            {/* Tree View */}
            <button
                onClick={() => onViewChange('tree')}
                className={`
          flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200
          ${currentView === 'tree'
                        ? 'bg-indigo-500 text-white shadow-sm'
                        : 'text-slate-600 hover:bg-slate-100'
                    }
        `}
                title="Tree View - Structured horizontal layout"
            >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="2" y="10" width="6" height="4" rx="1" />
                    <rect x="14" y="4" width="8" height="3" rx="1" />
                    <rect x="14" y="10.5" width="8" height="3" rx="1" />
                    <rect x="14" y="17" width="8" height="3" rx="1" />
                    <path d="M8 12 L11 12 L11 5.5 L14 5.5" />
                    <path d="M11 12 L14 12" />
                    <path d="M11 12 L11 18.5 L14 18.5" />
                </svg>
                <span>Tree</span>
            </button>
            {/* Research View */}
            <button
                onClick={() => onViewChange('research')}
                className={`
          flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200
          ${currentView === 'research'
                        ? 'bg-indigo-500 text-white shadow-sm'
                        : 'text-slate-600 hover:bg-slate-100'
                    }
        `}
                title="Research View - AI Feasibility & Market Analysis"
            >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                    <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
                </svg>
                <span>Research</span>
            </button>

            {/* 3D View Removed */}

            {/* Mind Map View */}
            <button
                onClick={() => onViewChange('mindmap')}
                className={`
          flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200
          ${currentView === 'mindmap'
                        ? 'bg-indigo-500 text-white shadow-sm'
                        : 'text-slate-600 hover:bg-slate-100'
                    }
        `}
                title="Mind Map View - Structured horizontal layout"
            >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="10" width="4" height="4" rx="1" />
                    <path d="M7 12h3" />
                    <rect x="10" y="6" width="4" height="4" rx="1" />
                    <path d="M10 8h-1v4h1" />
                    <rect x="10" y="14" width="4" height="4" rx="1" />
                    <path d="M14 8h2" />
                    <path d="M14 16h2" />
                </svg>
                <span>Mind Map</span>
            </button>
        </div>
    );
};

export default ViewToggle;
