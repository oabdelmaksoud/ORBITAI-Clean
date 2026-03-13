import React, { useState, useEffect, useMemo } from 'react';
import { X, CheckSquare, Square, ChevronDown, ChevronRight, Sparkles, Rocket, Filter } from 'lucide-react';

interface Idea {
    id: string;
    label: string;
    description?: string;
    category?: string;
    parentId?: string;
    priority?: number;
}

interface FeatureSelectionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (selectedFeatures: Idea[]) => void;
    ideas: Idea[];
}

// Category display configuration
// isImplementation: true means this category represents actual software features to be built
const CATEGORY_CONFIG: Record<string, { label: string; icon: string; color: string; isImplementation: boolean }> = {
    // Implementation categories - pre-selected by default
    feature: { label: 'Features', icon: '✨', color: 'indigo', isImplementation: true },
    technology: { label: 'Technology', icon: '⚙️', color: 'blue', isImplementation: true },
    design: { label: 'Design', icon: '🎨', color: 'purple', isImplementation: true },
    architecture: { label: 'Architecture', icon: '🏗️', color: 'slate', isImplementation: true },
    integration: { label: 'Integrations', icon: '🔌', color: 'orange', isImplementation: true },
    security: { label: 'Security', icon: '🔒', color: 'red', isImplementation: true },
    performance: { label: 'Performance', icon: '⚡', color: 'yellow', isImplementation: true },
    ux: { label: 'UX/UI', icon: '📱', color: 'pink', isImplementation: true },
    data: { label: 'Data', icon: '📊', color: 'cyan', isImplementation: true },
    platform: { label: 'Platform', icon: '🖥️', color: 'violet', isImplementation: true },

    // Non-implementation categories - NOT selected by default (context/strategy)
    business: { label: 'Business', icon: '💼', color: 'emerald', isImplementation: false },
    risk: { label: 'Risks', icon: '⚠️', color: 'red', isImplementation: false },
    opportunity: { label: 'Opportunities', icon: '🎯', color: 'green', isImplementation: false },
    constraint: { label: 'Constraints', icon: '🚧', color: 'amber', isImplementation: false },
    community: { label: 'Community', icon: '👥', color: 'purple', isImplementation: false },
    requirement: { label: 'Requirements', icon: '📋', color: 'blue', isImplementation: false },
    improvement: { label: 'Improvements', icon: '📈', color: 'teal', isImplementation: false },

    // Fallback
    idea: { label: 'Ideas', icon: '💡', color: 'amber', isImplementation: true },
    other: { label: 'Other', icon: '📦', color: 'gray', isImplementation: false },
};

/**
 * FeatureSelectionModal - Modal for selecting which brainstormed features to include in the prototype
 * 
 * Appears after clicking "Prototype" button and before PathChoiceModal.
 * Features are grouped by category with select all / deselect all per group.
 */
const FeatureSelectionModal: React.FC<FeatureSelectionModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    ideas
}) => {
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
    const [isAnimating, setIsAnimating] = useState(false);

    // Filter out welcome bubble and non-implementation ideas (only show buildable features)
    const filteredIdeas = useMemo(() => {
        return ideas.filter(idea => {
            if (idea.id === 'welcome-bubble' || !idea.label) return false;
            // Only include implementation categories
            const category = idea.category || 'other';
            const config = CATEGORY_CONFIG[category] || CATEGORY_CONFIG.other;
            return config.isImplementation;
        });
    }, [ideas]);

    // Group ideas by category (only implementation categories will be included)
    const groupedIdeas = useMemo(() => {
        const groups: Record<string, Idea[]> = {};

        filteredIdeas.forEach(idea => {
            const category = idea.category || 'idea';
            if (!groups[category]) {
                groups[category] = [];
            }
            groups[category].push(idea);
        });

        // Sort groups by size (largest first) and alphabetically
        return Object.entries(groups)
            .sort(([a, aIdeas], [b, bIdeas]) => {
                // Prioritize 'feature' category
                if (a === 'feature') return -1;
                if (b === 'feature') return 1;
                // Then by count
                return bIdeas.length - aIdeas.length;
            });
    }, [filteredIdeas]);

    // Initialize: select only implementation features by default and expand all groups
    useEffect(() => {
        if (isOpen) {
            // Only pre-select ideas from implementation categories
            const implementationIds = filteredIdeas
                .filter(idea => {
                    const category = idea.category || 'other';
                    const config = CATEGORY_CONFIG[category] || CATEGORY_CONFIG.other;
                    return config.isImplementation;
                })
                .map(i => i.id);

            setSelectedIds(new Set(implementationIds));
            setExpandedGroups(new Set(groupedIdeas.map(([category]) => category)));
            setIsAnimating(true);
        }
    }, [isOpen, filteredIdeas, groupedIdeas]);

    // Toggle individual feature selection
    const toggleFeature = (id: string) => {
        setSelectedIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(id)) {
                newSet.delete(id);
            } else {
                newSet.add(id);
            }
            return newSet;
        });
    };

    // Select all features in a category
    const selectAllInCategory = (category: string) => {
        const categoryIdeas = groupedIdeas.find(([cat]) => cat === category)?.[1] || [];
        setSelectedIds(prev => {
            const newSet = new Set(prev);
            categoryIdeas.forEach(idea => newSet.add(idea.id));
            return newSet;
        });
    };

    // Deselect all features in a category
    const deselectAllInCategory = (category: string) => {
        const categoryIdeas = groupedIdeas.find(([cat]) => cat === category)?.[1] || [];
        setSelectedIds(prev => {
            const newSet = new Set(prev);
            categoryIdeas.forEach(idea => newSet.delete(idea.id));
            return newSet;
        });
    };

    // Toggle group expansion
    const toggleGroup = (category: string) => {
        setExpandedGroups(prev => {
            const newSet = new Set(prev);
            if (newSet.has(category)) {
                newSet.delete(category);
            } else {
                newSet.add(category);
            }
            return newSet;
        });
    };

    // Check if all features in a category are selected
    const isAllSelectedInCategory = (category: string) => {
        const categoryIdeas = groupedIdeas.find(([cat]) => cat === category)?.[1] || [];
        return categoryIdeas.every(idea => selectedIds.has(idea.id));
    };

    // Check if some (but not all) features in a category are selected
    const isSomeSelectedInCategory = (category: string) => {
        const categoryIdeas = groupedIdeas.find(([cat]) => cat === category)?.[1] || [];
        const selectedCount = categoryIdeas.filter(idea => selectedIds.has(idea.id)).length;
        return selectedCount > 0 && selectedCount < categoryIdeas.length;
    };

    // Get count of selected features in a category
    const getSelectedCountInCategory = (category: string) => {
        const categoryIdeas = groupedIdeas.find(([cat]) => cat === category)?.[1] || [];
        return categoryIdeas.filter(idea => selectedIds.has(idea.id)).length;
    };

    // Select all features
    const selectAll = () => {
        setSelectedIds(new Set(filteredIdeas.map(i => i.id)));
    };

    // Deselect all features
    const deselectAll = () => {
        setSelectedIds(new Set());
    };

    // Handle confirmation
    const handleConfirm = () => {
        const selectedFeatures = filteredIdeas.filter(idea => selectedIds.has(idea.id));
        onConfirm(selectedFeatures);
    };

    // Get category config
    const getCategoryConfig = (category: string) => {
        return CATEGORY_CONFIG[category] || CATEGORY_CONFIG.other;
    };

    if (!isOpen) return null;

    const totalSelected = selectedIds.size;
    const totalFeatures = filteredIdeas.length;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300"
                onClick={onClose}
            />

            {/* Modal */}
            <div
                className={`relative w-full max-w-3xl max-h-[85vh] bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/60 overflow-hidden flex flex-col transform transition-all duration-300 ${isAnimating ? 'animate-in zoom-in-95 fade-in' : ''
                    }`}
            >
                {/* Header */}
                <div className="relative px-6 pt-6 pb-4 border-b border-slate-200/60 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary via-indigo-500 to-purple-600 flex items-center justify-center shadow-lg">
                            <Filter size={20} className="text-white" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-slate-800">Select Features to Include</h2>
                            <p className="text-sm text-slate-500">
                                {totalSelected} of {totalFeatures} features selected
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-700 transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Global Controls */}
                <div className="px-6 py-3 bg-slate-50/80 border-b border-slate-200/60 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-2">
                        <button
                            onClick={selectAll}
                            className="px-3 py-1.5 text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 rounded-lg transition-colors flex items-center gap-1"
                        >
                            <CheckSquare size={14} />
                            Select All
                        </button>
                        <button
                            onClick={deselectAll}
                            className="px-3 py-1.5 text-xs font-medium bg-slate-200 text-slate-600 hover:bg-slate-300 rounded-lg transition-colors flex items-center gap-1"
                        >
                            <Square size={14} />
                            Deselect All
                        </button>
                    </div>
                    <div className="text-xs text-slate-500">
                        {groupedIdeas.length} categories
                    </div>
                </div>

                {/* Feature Groups */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                    {groupedIdeas.length === 0 ? (
                        <div className="text-center py-12 text-slate-500">
                            <Sparkles size={48} className="mx-auto mb-4 opacity-50" />
                            <p>No features to select. Add some ideas first!</p>
                        </div>
                    ) : (
                        groupedIdeas.map(([category, categoryIdeas]) => {
                            const config = getCategoryConfig(category);
                            const isExpanded = expandedGroups.has(category);
                            const allSelected = isAllSelectedInCategory(category);
                            const someSelected = isSomeSelectedInCategory(category);
                            const selectedCount = getSelectedCountInCategory(category);

                            return (
                                <div
                                    key={category}
                                    className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden"
                                >
                                    {/* Category Header */}
                                    <div
                                        className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-slate-50 transition-colors"
                                        onClick={() => toggleGroup(category)}
                                    >
                                        <div className="flex items-center gap-3">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    toggleGroup(category);
                                                }}
                                                className="text-slate-400 hover:text-slate-600"
                                            >
                                                {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                                            </button>
                                            <span className="text-lg">{config.icon}</span>
                                            <div>
                                                <h3 className="font-semibold text-slate-800">{config.label}</h3>
                                                <p className="text-xs text-slate-500">
                                                    {selectedCount} of {categoryIdeas.length} selected
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    selectAllInCategory(category);
                                                }}
                                                className={`px-2 py-1 text-xs font-medium rounded transition-colors ${allSelected
                                                    ? 'bg-primary/20 text-primary'
                                                    : 'bg-slate-100 text-slate-500 hover:bg-primary/10 hover:text-primary'
                                                    }`}
                                            >
                                                All
                                            </button>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    deselectAllInCategory(category);
                                                }}
                                                className={`px-2 py-1 text-xs font-medium rounded transition-colors ${selectedCount === 0
                                                    ? 'bg-slate-200 text-slate-400'
                                                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                                                    }`}
                                            >
                                                None
                                            </button>

                                            {/* Category checkbox */}
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (allSelected) {
                                                        deselectAllInCategory(category);
                                                    } else {
                                                        selectAllInCategory(category);
                                                    }
                                                }}
                                                className={`w-5 h-5 rounded flex items-center justify-center transition-colors ${allSelected
                                                    ? 'bg-primary text-white'
                                                    : someSelected
                                                        ? 'bg-primary/50 text-white'
                                                        : 'border-2 border-slate-300 hover:border-primary'
                                                    }`}
                                            >
                                                {(allSelected || someSelected) && <CheckSquare size={14} />}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Category Items */}
                                    {isExpanded && (
                                        <div className="border-t border-slate-100 divide-y divide-slate-100">
                                            {categoryIdeas.map((idea) => {
                                                const isSelected = selectedIds.has(idea.id);
                                                return (
                                                    <div
                                                        key={idea.id}
                                                        onClick={() => toggleFeature(idea.id)}
                                                        className={`flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors ${isSelected ? 'bg-primary/5' : 'hover:bg-slate-50'
                                                            }`}
                                                    >
                                                        <button
                                                            className={`shrink-0 w-5 h-5 mt-0.5 rounded flex items-center justify-center transition-colors ${isSelected
                                                                ? 'bg-primary text-white'
                                                                : 'border-2 border-slate-300 hover:border-primary'
                                                                }`}
                                                        >
                                                            {isSelected && (
                                                                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                                                    <path
                                                                        fillRule="evenodd"
                                                                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                                                        clipRule="evenodd"
                                                                    />
                                                                </svg>
                                                            )}
                                                        </button>
                                                        <div className="flex-1 min-w-0">
                                                            <p className={`font-medium text-sm ${isSelected ? 'text-slate-800' : 'text-slate-600'}`}>
                                                                {idea.label}
                                                            </p>
                                                            {idea.description && (
                                                                <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">
                                                                    {idea.description}
                                                                </p>
                                                            )}
                                                        </div>
                                                        {idea.priority && idea.priority > 3 && (
                                                            <span className="shrink-0 px-1.5 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-bold rounded">
                                                                HIGH
                                                            </span>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 bg-slate-50/80 border-t border-slate-200/60 flex items-center justify-between shrink-0">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 hover:bg-slate-200 rounded-lg transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={totalSelected === 0}
                        className={`px-6 py-2.5 rounded-xl font-semibold text-sm flex items-center gap-2 transition-all ${totalSelected > 0
                            ? 'bg-gradient-to-r from-primary to-indigo-600 text-white hover:from-primary/90 hover:to-indigo-700 shadow-lg shadow-primary/25'
                            : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                            }`}
                    >
                        <Rocket size={16} />
                        Continue with {totalSelected} Feature{totalSelected !== 1 ? 's' : ''}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default FeatureSelectionModal;
