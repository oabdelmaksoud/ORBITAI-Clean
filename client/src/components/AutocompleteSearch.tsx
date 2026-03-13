import React, { useState, useRef, useEffect } from 'react';
import { Search, X, Command } from 'lucide-react';

export interface SearchResult {
  id: string;
  label: string;
  category?: string;
  icon?: React.ReactNode;
  action: () => void;
}

interface AutocompleteSearchProps {
  placeholder?: string;
  onSearch: (query: string) => SearchResult[];
  onSelect?: (result: SearchResult) => void;
  className?: string;
  showKeyboardShortcut?: boolean;
}

const AutocompleteSearch: React.FC<AutocompleteSearchProps> = ({
  placeholder = "Search...",
  onSearch,
  onSelect,
  className = "",
  showKeyboardShortcut = true
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (query.trim()) {
      const searchResults = onSearch(query);
      setResults(searchResults);
      setIsOpen(searchResults.length > 0);
      setSelectedIndex(-1);
    } else {
      setResults([]);
      setIsOpen(false);
    }
  }, [query, onSearch]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + K to focus search
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }

      // Escape to close
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
        setQuery('');
        inputRef.current?.blur();
      }

      // Arrow keys navigation
      if (isOpen && results.length > 0) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setSelectedIndex(prev => (prev < results.length - 1 ? prev + 1 : prev));
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          setSelectedIndex(prev => (prev > 0 ? prev - 1 : -1));
        } else if (e.key === 'Enter' && selectedIndex >= 0) {
          e.preventDefault();
          handleSelect(results[selectedIndex]);
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, results, selectedIndex]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handleSelect = (result: SearchResult) => {
    result.action();
    if (onSelect) {
      onSelect(result);
    }
    setQuery('');
    setIsOpen(false);
    inputRef.current?.blur();
  };

  const handleClear = () => {
    setQuery('');
    setResults([]);
    setIsOpen(false);
    inputRef.current?.focus();
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => query.trim() && results.length > 0 && setIsOpen(true)}
          placeholder={placeholder}
          className="w-full pl-10 pr-20 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent bg-white"
        />
        {query && (
          <button
            onClick={handleClear}
            className="absolute right-10 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X size={14} />
          </button>
        )}
        {showKeyboardShortcut && !query && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-[10px] text-slate-400">
            <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-200 rounded text-slate-500 font-mono">
              {navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'}
            </kbd>
            <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-200 rounded text-slate-500 font-mono">K</kbd>
          </div>
        )}
      </div>

      {isOpen && results.length > 0 && (
        <div className="absolute z-[9999] w-full mt-2 bg-white border border-slate-200 rounded-lg shadow-xl max-h-96 overflow-y-auto custom-scrollbar">
          {results.map((result, index) => (
            <button
              key={result.id}
              onClick={() => handleSelect(result)}
              onMouseEnter={() => setSelectedIndex(index)}
              className={`w-full px-4 py-3 text-left hover:bg-slate-50 transition-colors flex items-center gap-3 ${
                index === selectedIndex ? 'bg-slate-50' : ''
              } ${index === 0 ? 'rounded-t-lg' : ''} ${index === results.length - 1 ? 'rounded-b-lg' : ''}`}
            >
              {result.icon && <div className="text-slate-400 shrink-0">{result.icon}</div>}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-slate-800 truncate">{result.label}</div>
                {result.category && (
                  <div className="text-[10px] text-slate-500 uppercase tracking-wider mt-0.5">{result.category}</div>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default AutocompleteSearch;

