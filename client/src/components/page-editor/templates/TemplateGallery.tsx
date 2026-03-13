import React, { useState, useEffect } from 'react';
import { Layout, Search, Plus, Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import { listTemplates, useTemplate } from '@src/services/pageBuilderApi';
import { PageTemplate } from '@orbitai/shared';

interface TemplateGalleryProps {
  token: string;
  onTemplateSelect?: (templateId: string) => void;
  onTemplateUse?: (pageKey: string) => void;
}

export function TemplateGallery({ token, onTemplateSelect, onTemplateUse }: TemplateGalleryProps) {
  const [templates, setTemplates] = useState<PageTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showUseModal, setShowUseModal] = useState<{ template: PageTemplate | null }>({ template: null });
  const [newPageKey, setNewPageKey] = useState('');
  const [newPageTitle, setNewPageTitle] = useState('');
  const [newPageSlug, setNewPageSlug] = useState('');

  const categories: Array<{ value: string; label: string }> = [
    { value: 'all', label: 'All Templates' },
    { value: 'landing', label: 'Landing Pages' },
    { value: 'blog', label: 'Blog' },
    { value: 'product', label: 'Product' },
    { value: 'portfolio', label: 'Portfolio' },
    { value: 'ecommerce', label: 'E-commerce' },
    { value: 'custom', label: 'Custom' }
  ];

  useEffect(() => {
    loadTemplates();
  }, [selectedCategory, searchQuery]);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const { templates: templatesList } = await listTemplates(token, {
        category: selectedCategory !== 'all' ? selectedCategory : undefined,
        search: searchQuery || undefined
      });
      setTemplates(templatesList);
    } catch (err: any) {
      setError(err.message || 'Failed to load templates');
    } finally {
      setLoading(false);
    }
  };

  const handleUseTemplate = async () => {
    if (!showUseModal.template || !newPageKey || !newPageTitle || !newPageSlug) {
      setError('Please fill in all fields');
      return;
    }

    try {
      const { page } = await useTemplate(token, showUseModal.template.id, {
        pageKey: newPageKey,
        title: newPageTitle,
        slug: newPageSlug
      });
      setShowUseModal({ template: null });
      setNewPageKey('');
      setNewPageTitle('');
      setNewPageSlug('');
      setSuccess('Page created from template!');
      onTemplateUse?.(page.pageKey);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to use template');
      setTimeout(() => setError(null), 5000);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="animate-spin text-blue-600" size={32} />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white">
      <div className="border-b border-slate-200 p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-slate-800 flex items-center gap-2">
            <Layout size={20} />
            Templates
          </h3>
        </div>
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search templates..."
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-sm"
            />
          </div>
        </div>
        <div className="flex gap-2 mt-2 overflow-x-auto">
          {categories.map(cat => (
            <button
              key={cat.value}
              onClick={() => setSelectedCategory(cat.value)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                selectedCategory === cat.value
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-4 flex items-center gap-2">
          <AlertCircle size={18} />
          {error}
        </div>
      )}
      {success && (
        <div className="bg-emerald-50 border-l-4 border-emerald-500 text-emerald-700 p-4 flex items-center gap-2">
          <CheckCircle size={18} />
          {success}
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-6">
        {templates.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <Layout size={48} className="mx-auto mb-4 opacity-50" />
            <p>No templates found</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {templates.map(template => (
              <div
                key={template.id}
                className="border border-slate-200 rounded-lg overflow-hidden hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => {
                  onTemplateSelect?.(template.id);
                  setShowUseModal({ template });
                }}
              >
                {template.thumbnail ? (
                  <img
                    src={template.thumbnail}
                    alt={template.name}
                    className="w-full h-48 object-cover"
                  />
                ) : (
                  <div className="w-full h-48 bg-slate-100 flex items-center justify-center">
                    <Layout size={48} className="text-slate-400" />
                  </div>
                )}
                <div className="p-4">
                  <h4 className="font-bold text-slate-800 mb-1">{template.name}</h4>
                  {template.description && (
                    <p className="text-sm text-slate-600 mb-2">{template.description}</p>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500 capitalize">{template.category}</span>
                    {template.metadata?.usageCount !== undefined && (
                      <span className="text-xs text-slate-500">
                        {template.metadata.usageCount} uses
                      </span>
                    )}
                  </div>
                  {template.tags && template.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {template.tags.slice(0, 3).map(tag => (
                        <span
                          key={tag}
                          className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Use Template Modal */}
      {showUseModal.template && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-bold mb-4">Use Template: {showUseModal.template.name}</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Page Key</label>
                <input
                  type="text"
                  value={newPageKey}
                  onChange={(e) => setNewPageKey(e.target.value)}
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
                    setShowUseModal({ template: null });
                    setNewPageKey('');
                    setNewPageTitle('');
                    setNewPageSlug('');
                  }}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUseTemplate}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium"
                >
                  Create Page
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

