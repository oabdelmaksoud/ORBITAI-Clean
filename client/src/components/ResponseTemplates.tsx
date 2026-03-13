import React, { useState, useEffect, useCallback } from 'react';
import {
  Search,
  Plus,
  Edit,
  Trash2,
  Copy,
  Check,
  X,
  Loader2,
  FileText,
  Tag,
  Zap,
  RefreshCw,
  AlertCircle,
  Hash
} from 'lucide-react';
import {
  getResponseTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  trackTemplateUsage,
  ResponseTemplate
} from '../services/supportApi';

interface ResponseTemplatesProps {
  onSelectTemplate?: (content: string) => void;
  mode?: 'manage' | 'select';
}

const CATEGORIES = [
  'greeting',
  'billing',
  'technical',
  'account',
  'closing',
  'apology',
  'escalation',
  'general'
];

const ResponseTemplates: React.FC<ResponseTemplatesProps> = ({ 
  onSelectTemplate, 
  mode = 'manage' 
}) => {
  const [templates, setTemplates] = useState<ResponseTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filters
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  
  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ResponseTemplate | null>(null);
  const [saving, setSaving] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    category: 'general',
    shortcut: '',
    content: '',
    variables: [] as string[]
  });

  // Copied state
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchTemplates = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params: any = {};
      if (search) params.search = search;
      if (categoryFilter) params.category = categoryFilter;
      const data = await getResponseTemplates(params);
      setTemplates(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load templates');
    } finally {
      setLoading(false);
    }
  }, [search, categoryFilter]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const handleOpenModal = (template?: ResponseTemplate) => {
    if (template) {
      setEditingTemplate(template);
      setFormData({
        name: template.name,
        category: template.category,
        shortcut: template.shortcut,
        content: template.content,
        variables: template.variables || []
      });
    } else {
      setEditingTemplate(null);
      setFormData({
        name: '',
        category: 'general',
        shortcut: '',
        content: '',
        variables: []
      });
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingTemplate(null);
    setFormData({
      name: '',
      category: 'general',
      shortcut: '',
      content: '',
      variables: []
    });
  };

  const handleSave = async () => {
    if (!formData.name || !formData.shortcut || !formData.content) {
      setError('Please fill in all required fields');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      // Extract variables from content
      const variableMatches = formData.content.match(/\{\{(\w+)\}\}/g);
      const variables = variableMatches 
        ? [...new Set(variableMatches.map(v => v.replace(/\{\{|\}\}/g, '')))]
        : [];

      if (editingTemplate) {
        await updateTemplate(editingTemplate._id, { ...formData, variables });
      } else {
        await createTemplate({ ...formData, variables });
      }

      handleCloseModal();
      fetchTemplates();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save template');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (templateId: string) => {
    if (!confirm('Are you sure you want to delete this template?')) return;

    try {
      await deleteTemplate(templateId);
      fetchTemplates();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete template');
    }
  };

  const handleUseTemplate = async (template: ResponseTemplate) => {
    if (onSelectTemplate) {
      onSelectTemplate(template.content);
      await trackTemplateUsage(template._id);
    }
  };

  const handleCopy = async (template: ResponseTemplate) => {
    await navigator.clipboard.writeText(template.content);
    setCopiedId(template._id);
    await trackTemplateUsage(template._id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const groupedTemplates = templates.reduce((acc, template) => {
    const category = template.category;
    if (!acc[category]) acc[category] = [];
    acc[category].push(template);
    return acc;
  }, {} as Record<string, ResponseTemplate[]>);

  return (
    <div className="flex flex-col h-full bg-gray-900">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-700">
        <h2 className="text-lg font-semibold text-white">Response Templates</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchTemplates}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          {mode === 'manage' && (
            <button
              onClick={() => handleOpenModal()}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              New Template
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="p-4 border-b border-gray-700 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search templates..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setCategoryFilter('')}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
              categoryFilter === ''
                ? 'bg-blue-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:text-white'
            }`}
          >
            All
          </button>
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors capitalize ${
                categoryFilter === cat
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:text-white'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-64 text-red-400">
            <AlertCircle className="w-8 h-8 mb-2" />
            <p>{error}</p>
            <button
              onClick={fetchTemplates}
              className="mt-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
            >
              Retry
            </button>
          </div>
        ) : templates.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-400">
            <FileText className="w-12 h-12 mb-2" />
            <p>No templates found</p>
            {mode === 'manage' && (
              <button
                onClick={() => handleOpenModal()}
                className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                Create First Template
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedTemplates).map(([category, categoryTemplates]) => (
              <div key={category}>
                <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Tag className="w-4 h-4" />
                  {category}
                </h3>
                <div className="grid gap-3">
                  {categoryTemplates.map((template) => (
                    <div
                      key={template._id}
                      className="bg-gray-800 border border-gray-700 rounded-lg p-4 hover:border-gray-600 transition-colors"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h4 className="font-medium text-white">{template.name}</h4>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="flex items-center gap-1 text-xs text-gray-500">
                              <Hash className="w-3 h-3" />
                              {template.shortcut}
                            </span>
                            {template.usageCount > 0 && (
                              <span className="text-xs text-gray-500">
                                Used {template.usageCount} times
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          {mode === 'select' && onSelectTemplate && (
                            <button
                              onClick={() => handleUseTemplate(template)}
                              className="p-2 text-green-400 hover:text-green-300 hover:bg-gray-700 rounded-lg transition-colors"
                              title="Use Template"
                            >
                              <Zap className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => handleCopy(template)}
                            className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
                            title="Copy"
                          >
                            {copiedId === template._id ? (
                              <Check className="w-4 h-4 text-green-400" />
                            ) : (
                              <Copy className="w-4 h-4" />
                            )}
                          </button>
                          {mode === 'manage' && (
                            <>
                              <button
                                onClick={() => handleOpenModal(template)}
                                className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
                                title="Edit"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDelete(template._id)}
                                className="p-2 text-gray-400 hover:text-red-400 hover:bg-gray-700 rounded-lg transition-colors"
                                title="Delete"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                      <p className="text-sm text-gray-400 whitespace-pre-wrap line-clamp-3">
                        {template.content}
                      </p>
                      {template.variables && template.variables.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {template.variables.map((v) => (
                            <span
                              key={v}
                              className="px-2 py-0.5 text-xs bg-purple-900/50 text-purple-300 rounded"
                            >
                              {`{{${v}}}`}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-gray-800 rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-gray-700">
              <h3 className="text-lg font-semibold text-white">
                {editingTemplate ? 'Edit Template' : 'New Template'}
              </h3>
              <button
                onClick={handleCloseModal}
                className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-4 space-y-4 overflow-y-auto max-h-[calc(90vh-140px)]">
              {error && (
                <div className="p-3 bg-red-900/50 border border-red-700 rounded-lg text-red-300 text-sm">
                  {error}
                </div>
              )}
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Greeting - Standard"
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Category <span className="text-red-400">*</span>
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {CATEGORIES.map(cat => (
                      <option key={cat} value={cat} className="capitalize">{cat}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Shortcut <span className="text-red-400">*</span>
                  </label>
                  <div className="relative">
                    <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      value={formData.shortcut}
                      onChange={(e) => setFormData({ ...formData, shortcut: e.target.value.toLowerCase().replace(/\s/g, '-') })}
                      placeholder="e.g., greet-std"
                      className="w-full pl-10 pr-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Content <span className="text-red-400">*</span>
                </label>
                <textarea
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  placeholder="Enter the template content. Use {{variable}} for dynamic values."
                  rows={8}
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Use {`{{customerName}}`}, {`{{ticketNumber}}`}, etc. for dynamic values
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 p-4 border-t border-gray-700">
              <button
                onClick={handleCloseModal}
                className="px-4 py-2 text-gray-300 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                {editingTemplate ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ResponseTemplates;




