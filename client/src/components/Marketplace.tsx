import React, { useState, useEffect } from 'react';
import {
  Store, Star, Download, GitFork, Search, Filter, Plus,
  Loader2, AlertCircle, TrendingUp, Eye, Tag
} from 'lucide-react';
import {
  getMarketplaceItems,
  getMarketplaceItem,
  createMarketplaceItem,
  rateMarketplaceItem,
  forkMarketplaceItem,
  MarketplaceItem
} from '../services/communitySharingApi';

interface MarketplaceProps {
  token: string;
}

const Marketplace: React.FC<MarketplaceProps> = ({ token }) => {
  const [items, setItems] = useState<MarketplaceItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<MarketplaceItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [newItem, setNewItem] = useState({
    title: '',
    description: '',
    category: '',
    content: '',
    tags: [] as string[],
    status: 'draft' as 'draft' | 'published' | 'featured'
  });

  useEffect(() => {
    loadItems();
  }, [token, categoryFilter, searchQuery]);

  const loadItems = async () => {
    setLoading(true);
    setError(null);
    try {
      const filters: any = {};
      if (categoryFilter !== 'all') filters.category = categoryFilter;
      if (searchQuery) filters.search = searchQuery;
      const data = await getMarketplaceItems(token, filters);
      setItems(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load marketplace items');
      console.error('Failed to load marketplace items:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectItem = async (id: string) => {
    try {
      const item = await getMarketplaceItem(token, id);
      setSelectedItem(item);
    } catch (err: any) {
      setError(err.message || 'Failed to load marketplace item');
    }
  };

  const handleCreate = async () => {
    try {
      await createMarketplaceItem(token, newItem);
      setShowCreateModal(false);
      setNewItem({
        title: '',
        description: '',
        category: '',
        content: '',
        tags: [],
        status: 'draft'
      });
      await loadItems();
    } catch (err: any) {
      setError(err.message || 'Failed to create marketplace item');
    }
  };

  const handleRate = async (itemId: string, rating: number) => {
    try {
      await rateMarketplaceItem(token, itemId, rating);
      await loadItems();
      if (selectedItem?.id === itemId) {
        const updated = await getMarketplaceItem(token, itemId);
        setSelectedItem(updated);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to rate item');
    }
  };

  const handleFork = async (itemId: string) => {
    try {
      await forkMarketplaceItem(token, itemId);
      await loadItems();
    } catch (err: any) {
      setError(err.message || 'Failed to fork item');
    }
  };

  if (loading && items.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="animate-spin text-blue-600" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Marketplace</h2>
          <p className="text-sm text-slate-500 mt-1">
            Share and discover process improvements
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors flex items-center gap-2"
        >
          <Plus size={16} /> Share Improvement
        </button>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-yellow-700 text-sm">{error}</p>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg border border-slate-200 p-4">
        <div className="flex gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search improvements..."
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Categories</option>
            <option value="guideline">Guideline</option>
            <option value="template">Template</option>
            <option value="best-practice">Best Practice</option>
            <option value="workflow">Workflow</option>
            <option value="checklist">Checklist</option>
            <option value="standard">Standard</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Items List */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <h3 className="font-bold text-slate-800 mb-4">Items ({items.length})</h3>
            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {items.map((item) => (
                <div
                  key={item.id}
                  onClick={() => handleSelectItem(item.id!)}
                  className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedItem?.id === item.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="font-semibold text-slate-800">{item.title}</h4>
                      <p className="text-xs text-slate-500 mt-1 line-clamp-2">{item.description}</p>
                      <div className="flex items-center gap-2 mt-2">
                        {item.rating && (
                          <div className="flex items-center gap-1">
                            <Star size={12} className="text-yellow-500 fill-yellow-500" />
                            <span className="text-xs font-bold text-slate-700">{item.rating.toFixed(1)}</span>
                            {item.ratingsCount && (
                              <span className="text-xs text-slate-500">({item.ratingsCount})</span>
                            )}
                          </div>
                        )}
                        <span className="text-xs text-slate-500">{item.category}</span>
                      </div>
                      <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                        {item.downloads !== undefined && (
                          <span className="flex items-center gap-1">
                            <Download size={12} /> {item.downloads}
                          </span>
                        )}
                        {item.forks !== undefined && (
                          <span className="flex items-center gap-1">
                            <GitFork size={12} /> {item.forks}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {items.length === 0 && (
                <p className="text-sm text-slate-500 text-center py-8">No items found</p>
              )}
            </div>
          </div>
        </div>

        {/* Item Details */}
        <div className="lg:col-span-2">
          {selectedItem ? (
            <div className="bg-white rounded-lg border border-slate-200 p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-slate-800">{selectedItem.title}</h3>
                  <p className="text-sm text-slate-500 mt-1">{selectedItem.description}</p>
                </div>
                {selectedItem.status === 'featured' && (
                  <span className="px-3 py-1 bg-yellow-100 text-yellow-700 text-xs font-bold rounded">
                    Featured
                  </span>
                )}
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  {selectedItem.rating && (
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            onClick={() => handleRate(selectedItem.id!, star)}
                            className="text-yellow-400 hover:text-yellow-500"
                          >
                            <Star
                              size={20}
                              className={star <= selectedItem.rating! ? 'fill-current' : ''}
                            />
                          </button>
                        ))}
                      </div>
                      <span className="text-sm font-bold text-slate-700">
                        {selectedItem.rating.toFixed(1)}
                      </span>
                      {selectedItem.ratingsCount && (
                        <span className="text-sm text-slate-500">
                          ({selectedItem.ratingsCount} ratings)
                        </span>
                      )}
                    </div>
                  )}
                  <div className="flex items-center gap-4 text-sm text-slate-500">
                    {selectedItem.downloads !== undefined && (
                      <span className="flex items-center gap-1">
                        <Download size={16} /> {selectedItem.downloads} downloads
                      </span>
                    )}
                    {selectedItem.forks !== undefined && (
                      <span className="flex items-center gap-1">
                        <GitFork size={16} /> {selectedItem.forks} forks
                      </span>
                    )}
                  </div>
                </div>

                {selectedItem.tags && selectedItem.tags.length > 0 && (
                  <div className="flex items-center gap-2">
                    <Tag size={16} className="text-slate-400" />
                    {selectedItem.tags.map((tag, idx) => (
                      <span key={idx} className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                <div className="prose max-w-none">
                  <pre className="whitespace-pre-wrap bg-slate-50 p-4 rounded-lg border border-slate-200">
                    {selectedItem.content}
                  </pre>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => handleFork(selectedItem.id!)}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-colors flex items-center gap-2"
                  >
                    <GitFork size={16} /> Fork
                  </button>
                  {selectedItem.authorName && (
                    <span className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm">
                      By {selectedItem.authorName}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-lg border border-slate-200 p-12 text-center">
              <Store size={48} className="mx-auto mb-4 text-slate-400" />
              <p className="text-slate-600 font-medium">No item selected</p>
              <p className="text-sm text-slate-500 mt-1">
                Select an item from the list or share a new improvement
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-slate-800 mb-4">Share Improvement</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Title
                </label>
                <input
                  type="text"
                  value={newItem.title}
                  onChange={(e) => setNewItem({ ...newItem, title: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Description
                </label>
                <textarea
                  value={newItem.description}
                  onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Category
                </label>
                <select
                  value={newItem.category}
                  onChange={(e) => setNewItem({ ...newItem, category: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select category</option>
                  <option value="guideline">Guideline</option>
                  <option value="template">Template</option>
                  <option value="best-practice">Best Practice</option>
                  <option value="workflow">Workflow</option>
                  <option value="checklist">Checklist</option>
                  <option value="standard">Standard</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Content
                </label>
                <textarea
                  value={newItem.content}
                  onChange={(e) => setNewItem({ ...newItem, content: e.target.value })}
                  rows={10}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleCreate}
                  disabled={!newItem.title || !newItem.category}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  Share
                </button>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg font-semibold hover:bg-slate-200 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Marketplace;
















