import React, { useState, useEffect } from 'react';
import { X, Keyboard } from 'lucide-react';

interface KeyboardShortcut {
  key: string;
  description: string;
  category: string;
}

const shortcuts: KeyboardShortcut[] = [
  { key: '?', description: 'Show keyboard shortcuts', category: 'General' },
  { key: 'Esc', description: 'Close modal/dialog', category: 'General' },
  { key: 'Ctrl/Cmd + S', description: 'Save project', category: 'General' },
  { key: 'Ctrl/Cmd + K', description: 'Open command palette', category: 'Navigation' },
  { key: 'Tab', description: 'Navigate to next element', category: 'Navigation' },
  { key: 'Shift + Tab', description: 'Navigate to previous element', category: 'Navigation' },
  { key: 'Enter', description: 'Activate button/link', category: 'Navigation' },
  { key: 'Space', description: 'Activate button/checkbox', category: 'Navigation' },
  { key: 'Arrow Keys', description: 'Navigate lists/menus', category: 'Navigation' },
];

export const KeyboardShortcutsModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const shortcutsByCategory = shortcuts.reduce((acc, shortcut) => {
    if (!acc[shortcut.category]) {
      acc[shortcut.category] = [];
    }
    acc[shortcut.category].push(shortcut);
    return acc;
  }, {} as Record<string, KeyboardShortcut[]>);

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="keyboard-shortcuts-title"
    >
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Keyboard className="w-6 h-6 text-primary" />
            <h2 id="keyboard-shortcuts-title" className="text-xl font-bold text-slate-800">
              Keyboard Shortcuts
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            aria-label="Close keyboard shortcuts"
            style={{ minWidth: '44px', minHeight: '44px' }}
          >
            <X size={20} />
          </button>
        </div>
        <div className="p-6 space-y-6">
          {Object.entries(shortcutsByCategory).map(([category, categoryShortcuts]) => (
            <div key={category}>
              <h3 className="text-sm font-semibold text-slate-600 mb-3 uppercase tracking-wider">
                {category}
              </h3>
              <div className="space-y-2">
                {categoryShortcuts.map((shortcut, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
                  >
                    <span className="text-sm text-slate-700">{shortcut.description}</span>
                    <kbd className="px-2 py-1 bg-white border border-slate-300 rounded text-xs font-mono text-slate-700 shadow-sm">
                      {shortcut.key}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="p-6 border-t border-slate-200 bg-slate-50">
          <p className="text-xs text-slate-500 text-center">
            Press <kbd className="px-1.5 py-0.5 bg-white border border-slate-300 rounded text-xs font-mono">Esc</kbd> to close
          </p>
        </div>
      </div>
    </div>
  );
};

// Hook to show keyboard shortcuts on ? key
export function useKeyboardShortcuts() {
  const [showShortcuts, setShowShortcuts] = useState(false);

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Show shortcuts on ? key (when not typing in input/textarea)
      if (e.key === '?' && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
        setShowShortcuts(true);
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, []);

  return { showShortcuts, setShowShortcuts };
}






