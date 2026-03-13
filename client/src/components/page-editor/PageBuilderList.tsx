import React, { useState, useEffect } from 'react';
import { Plus, Search, Edit, Trash2, Eye, Loader2, AlertCircle } from 'lucide-react';
import { listPages, createPage, PageData } from '@src/services/pageBuilderApi';
import { PageBuilder } from './PageBuilder';

interface PageBuilderListProps {
  token: string;
}

export function PageBuilderList({ token }: PageBuilderListProps) {
  const [pages, setPages] = useState<PageData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPage, setSelectedPage] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newPageKey, setNewPageKey] = useState('');
  const [newPageTitle, setNewPageTitle] = useState('');
  const [newPageSlug, setNewPageSlug] = useState('');

  useEffect(() => {
    if (!selectedPage) {
      loadPages();
    }
  }, [selectedPage]);

  const loadPages = async () => {
    try {
      setLoading(true);
      const { pages: pagesList } = await listPages(token);
      setPages(pagesList);
    } catch (err: any) {
      setError(err.message || 'Failed to load pages');
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePage = async () => {
    if (!newPageKey || !newPageTitle || !newPageSlug) {
      setError('Please fill in all fields');
      return;
    }

    try {
      const { page } = await createPage(token, {
        pageKey: newPageKey,
        title: newPageTitle,
        slug: newPageSlug,
        blocks: {}
      });
      setPages([...pages, page]);
      setShowCreateModal(false);
      setNewPageKey('');
      setNewPageTitle('');
      setNewPageSlug('');
      setSelectedPage(page.pageKey);
    } catch (err: any) {
      setError(err.message || 'Failed to create page');
    }
  };

  const filteredPages = pages.filter(page =>
    page.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    page.pageKey.toLowerCase().includes(searchQuery.toLowerCase()) ||
    page.slug.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (selectedPage) {
    return (
      <div className="h-full flex flex-col">
        <div className="bg-white border-b border-slate-200 p-4 flex items-center justify-between">
          <button
            onClick={() => setSelectedPage(null)}
            className="text-blue-600 hover:text-blue-700 text-sm font-medium"
          >
            ← Back to Pages
          </button>
          <span className="text-sm text-slate-600">Editing: {selectedPage}</span>
        </div>
        <div className="flex-1 overflow-hidden">
          <PageBuilder token={token} pageKey={selectedPage} />
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="animate-spin text-blue-600" size={32} />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white">
      <div className="border-b border-slate-200 p-4 flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-800">Page Builder</h2>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium flex items-center gap-2"
        >
          <Plus size={16} />
          New Page
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-4 flex items-center gap-2">
          <AlertCircle size={18} />
          {error}
        </div>
      )}

      <div className="p-4">
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search pages..."
            className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-sm"
          />
        </div>

        {filteredPages.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <p>No pages found</p>
            {pages.length === 0 && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium"
              >
                Create Your First Page
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredPages.map(page => (
              <div
                key={page.pageKey}
                className="border border-slate-200 rounded-lg p-4 hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => setSelectedPage(page.pageKey)}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <h3 className="font-bold text-slate-800 mb-1">{page.title}</h3>
                    <p className="text-sm text-slate-500">{page.pageKey}</p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded ${
                    page.status === 'published' ? 'bg-green-100 text-green-700' :
                    page.status === 'draft' ? 'bg-slate-100 text-slate-700' :
                    'bg-red-100 text-red-700'
                  }`}>
                    {page.status}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-4">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedPage(page.pageKey);
                    }}
                    className="flex-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm font-medium flex items-center justify-center gap-1"
                  >
                    <Edit size={14} />
                    Edit
                  </button>
                  {page.status === 'published' && (
                    <a
                      href={`/${page.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded text-sm font-medium flex items-center gap-1"
                    >
                      <Eye size={14} />
                      View
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Page Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-bold mb-4">Create New Page</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Page Key</label>
                <input
                  type="text"
                  value={newPageKey}
                  onChange={(e) => setNewPageKey(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  placeholder="my-page"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Page Title</label>
                <input
                  type="text"
                  value={newPageTitle}
                  onChange={(e) => {
                    setNewPageTitle(e.target.value);
                    if (!newPageSlug) {
                      setNewPageSlug(e.target.value.toLowerCase().replace(/\s+/g, '-'));
                    }
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  placeholder="My Page"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Slug</label>
                <input
                  type="text"
                  value={newPageSlug}
                  onChange={(e) => setNewPageSlug(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  placeholder="my-page"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    setNewPageKey('');
                    setNewPageTitle('');
                    setNewPageSlug('');
                  }}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreatePage}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium"
                >
                  Create
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}




