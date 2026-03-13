// SuggestionSelector Component
// Extracted from NeuralStreamChat.tsx

import React, { useState } from 'react';
import { SuggestionSelectorProps } from '@orbitai/shared';

/**
 * A component for selecting suggestions from a list
 * Allows multi-select with select all/none functionality
 */
const SuggestionSelector: React.FC<SuggestionSelectorProps> = ({
    suggestions,
    onSelect,
    onClose
}) => {
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    const toggleSelection = (id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    };

    const handleAdd = () => {
        onSelect(Array.from(selectedIds));
    };

    const selectAll = () => {
        setSelectedIds(new Set(suggestions.map(s => s.id)));
    };

    const deselectAll = () => {
        setSelectedIds(new Set());
    };

    return (
        <>
            <div className="flex items-center justify-between mb-2">
                <div className="flex gap-1.5">
                    <button
                        onClick={selectAll}
                        className="text-[10px] px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded transition-colors"
                    >
                        All
                    </button>
                    <button
                        onClick={deselectAll}
                        className="text-[10px] px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded transition-colors"
                    >
                        None
                    </button>
                </div>
                <span className="text-[10px] text-slate-500">
                    {selectedIds.size}/{suggestions.length}
                </span>
            </div>

            <div className="space-y-1.5">
                {suggestions.map((suggestion) => {
                    const isSelected = selectedIds.has(suggestion.id);
                    return (
                        <div
                            key={suggestion.id}
                            onClick={() => toggleSelection(suggestion.id)}
                            className={`p-2 rounded-lg border cursor-pointer transition-all ${isSelected
                                ? 'border-purple-500 bg-purple-50 shadow-sm'
                                : 'border-slate-200 bg-white hover:border-purple-300 hover:bg-purple-50/50'
                                }`}
                        >
                            <div className="flex items-start gap-2">
                                <div className={`mt-0.5 w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${isSelected
                                    ? 'border-purple-500 bg-purple-500'
                                    : 'border-slate-300'
                                    }`}>
                                    {isSelected && (
                                        <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                        </svg>
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h3 className="font-medium text-xs text-slate-800 mb-0.5 truncate">{suggestion.label}</h3>
                                    <p className="text-[10px] text-slate-600 line-clamp-2">{suggestion.description}</p>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Footer Actions */}
            <div className="mt-3 pt-2 border-t border-slate-200 flex gap-2 justify-end">
                <button
                    onClick={onClose}
                    className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded transition-colors"
                >
                    Cancel
                </button>
                <button
                    onClick={handleAdd}
                    disabled={selectedIds.size === 0}
                    className="px-4 py-1.5 text-xs bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded font-medium hover:from-purple-600 hover:to-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm hover:shadow"
                >
                    Add ({selectedIds.size})
                </button>
            </div>
        </>
    );
};

export default SuggestionSelector;
