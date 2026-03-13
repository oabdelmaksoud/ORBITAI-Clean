import React, { useState, useMemo } from 'react';
import { Search, Filter, X, Clock, Save } from 'lucide-react';
import { ProjectMetadata } from '../services/projectStorage';

interface AdvancedSearchProps {
  projects: ProjectMetadata[];
  onSearch: (results: ProjectMetadata[]) => void;
  onClose: () => void;
}

interface SearchFilters {
  query: string;
  phase?: string;
  dateRange?: { start?: Date; end?: Date };
  sortBy: 'name' | 'lastModified' | 'phase';
  sortOrder: 'asc' | 'desc';
}

export const AdvancedSearch: React.FC<AdvancedSearchProps> = ({
  projects,
  onSearch,
  onClose
}) => {
  const [filters, setFilters] = useState<SearchFilters>({
    query: '',
    sortBy: 'lastModified',
    sortOrder: 'desc'
  });
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [savedSearches, setSavedSearches] = useState<SearchFilters[]>([]);

  const results = useMemo(() => {
    let filtered = [...projects];

    // Text search
    if (filters.query) {
      const query = filters.query.toLowerCase();
      filtered = filtered.filter(p => 
        p.name.toLowerCase().includes(query) ||
        p.description.toLowerCase().includes(query) ||
        p.phase.toLowerCase().includes(query)
      );
    }

    // Phase filter
    if (filters.phase) {
      filtered = filtered.filter(p => p.phase === filters.phase);
    }

    // Date range filter
    if (filters.dateRange?.start) {
      filtered = filtered.filter(p => p.lastModified >= filters.dateRange!.start!.getTime());
    }
    if (filters.dateRange?.end) {
      filtered = filtered.filter(p => p.lastModified <= filters.dateRange!.end!.getTime());
    }

    // Sort
    filtered.sort((a, b) => {
      let comparison = 0;
      switch (filters.sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'lastModified':
          comparison = a.lastModified - b.lastModified;
          break;
        case 'phase':
          comparison = a.phase.localeCompare(b.phase);
          break;
      }
      return filters.sortOrder === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [projects, filters]);

  const handleSearch = () => {
    if (filters.query && !searchHistory.includes(filters.query)) {
      setSearchHistory(prev => [filters.query, ...prev.slice(0, 9)]);
    }
    onSearch(results);
  };

  const handleSaveSearch = () => {
    if (!savedSearches.find(s => s.query === filters.query && s.phase === filters.phase)) {
      setSavedSearches(prev => [...prev, { ...filters }]);
      // Save to localStorage
      localStorage.setItem('savedSearches', JSON.stringify([...savedSearches, filters]));
    }
  };

  const handleLoadSavedSearch = (saved: SearchFilters) => {
    setFilters(saved);
    handleSearch();
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Search className="w-6 h-6 text-primary" />
            <h2 className="text-xl font-bold text-slate-800">Advanced Search</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            aria-label="Close search"
            style={{ minWidth: '44px', minHeight: '44px' }}
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Search Query */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Search Query
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={20} />
              <input
                type="text"
                value={filters.query}
                onChange={(e) => setFilters(prev => ({ ...prev, query: e.target.value }))}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Search projects by name, description, or phase..."
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                aria-label="Search query"
              />
            </div>
          </div>

          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Phase
              </label>
              <select
                value={filters.phase || ''}
                onChange={(e) => setFilters(prev => ({ ...prev, phase: e.target.value || undefined }))}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary"
                aria-label="Filter by phase"
              >
                <option value="">All Phases</option>
                <option value="Initiation">Initiation</option>
                <option value="Requirements">Requirements</option>
                <option value="Design">Design</option>
                <option value="Implementation">Implementation</option>
                <option value="Testing">Testing</option>
                <option value="Deployment">Deployment</option>
                <option value="Maintenance">Maintenance</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Sort By
              </label>
              <select
                value={filters.sortBy}
                onChange={(e) => setFilters(prev => ({ ...prev, sortBy: e.target.value as any }))}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary"
                aria-label="Sort by"
              >
                <option value="lastModified">Last Modified</option>
                <option value="name">Name</option>
                <option value="phase">Phase</option>
              </select>
            </div>
          </div>

          {/* Search History */}
          {searchHistory.length > 0 && (
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                <Clock size={16} />
                Recent Searches
              </label>
              <div className="flex flex-wrap gap-2">
                {searchHistory.map((term, index) => (
                  <button
                    key={index}
                    onClick={() => {
                      setFilters(prev => ({ ...prev, query: term }));
                      handleSearch();
                    }}
                    className="px-3 py-1 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm text-slate-700 transition-colors"
                  >
                    {term}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Saved Searches */}
          {savedSearches.length > 0 && (
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                <Save size={16} />
                Saved Searches
              </label>
              <div className="space-y-2">
                {savedSearches.map((saved, index) => (
                  <button
                    key={index}
                    onClick={() => handleLoadSavedSearch(saved)}
                    className="w-full text-left px-4 py-2 bg-slate-50 hover:bg-slate-100 rounded-lg text-sm text-slate-700 transition-colors"
                  >
                    {saved.query || 'No query'} {saved.phase && `• ${saved.phase}`}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Results Count */}
          <div className="text-sm text-slate-600">
            Found {results.length} project{results.length !== 1 ? 's' : ''}
          </div>
        </div>

        <div className="p-6 border-t border-slate-200 flex items-center justify-between">
          <button
            onClick={handleSaveSearch}
            className="flex items-center gap-2 px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            disabled={!filters.query}
          >
            <Save size={16} />
            Save Search
          </button>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSearch}
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Search
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};






