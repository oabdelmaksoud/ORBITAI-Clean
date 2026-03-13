import React, { useState, useEffect } from 'react';
import { Palette, Save, Plus, Trash2, Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import { listThemes, createTheme, updateTheme, deleteTheme } from '@src/services/pageBuilderApi';
import { PageTheme } from '@orbitai/shared';

interface ThemeManagerProps {
  token: string;
  onThemeSelect?: (themeId: string) => void;
}

export function ThemeManager({ token, onThemeSelect }: ThemeManagerProps) {
  const [themes, setThemes] = useState<PageTheme[]>([]);
  const [selectedTheme, setSelectedTheme] = useState<PageTheme | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newThemeName, setNewThemeName] = useState('');
  const [newThemeSlug, setNewThemeSlug] = useState('');

  useEffect(() => {
    loadThemes();
  }, []);

  const loadThemes = async () => {
    try {
      setLoading(true);
      const { themes: themesList } = await listThemes(token);
      setThemes(themesList);
      if (themesList.length > 0 && !selectedTheme) {
        const defaultTheme = themesList.find(t => t.isDefault) || themesList[0];
        setSelectedTheme(defaultTheme);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load themes');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTheme = async () => {
    if (!newThemeName || !newThemeSlug) {
      setError('Name and slug are required');
      return;
    }

    try {
      setSaving(true);
      const { theme } = await createTheme(token, {
        name: newThemeName,
        slug: newThemeSlug,
        designTokens: {
          colors: {
            primary: '#3b82f6',
            secondary: '#8b5cf6',
            accent: '#10b981',
            background: '#ffffff',
            surface: '#f9fafb',
            text: '#111827',
            textSecondary: '#6b7280',
            border: '#e5e7eb'
          },
          typography: {
            fontFamily: 'system-ui, -apple-system, sans-serif',
            fontSizeBase: '16px',
            lineHeight: 1.5
          },
          spacing: {
            unit: 8
          }
        }
      });
      setThemes([...themes, theme]);
      setShowCreateModal(false);
      setNewThemeName('');
      setNewThemeSlug('');
      setSuccess('Theme created successfully!');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to create theme');
      setTimeout(() => setError(null), 5000);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateTheme = async () => {
    if (!selectedTheme) return;

    try {
      setSaving(true);
      const { theme } = await updateTheme(token, selectedTheme.id, {
        designTokens: selectedTheme.designTokens,
        customCss: selectedTheme.customCss
      });
      setThemes(themes.map(t => t.id === theme.id ? theme : t));
      setSelectedTheme(theme);
      setSuccess('Theme updated successfully!');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to update theme');
      setTimeout(() => setError(null), 5000);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTheme = async (themeId: string) => {
    if (!confirm('Are you sure you want to delete this theme?')) return;

    try {
      await deleteTheme(token, themeId);
      setThemes(themes.filter(t => t.id !== themeId));
      if (selectedTheme?.id === themeId) {
        setSelectedTheme(themes.find(t => t.id !== themeId) || null);
      }
      setSuccess('Theme deleted successfully!');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to delete theme');
      setTimeout(() => setError(null), 5000);
    }
  };

  const updateDesignToken = (path: string[], value: any) => {
    if (!selectedTheme) return;

    const updated = { ...selectedTheme };
    let current: any = updated.designTokens;
    
    for (let i = 0; i < path.length - 1; i++) {
      if (!current[path[i]]) current[path[i]] = {};
      current = current[path[i]];
    }
    
    current[path[path.length - 1]] = value;
    setSelectedTheme(updated);
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
      <div className="border-b border-slate-200 p-4 flex items-center justify-between">
        <h3 className="font-bold text-slate-800 flex items-center gap-2">
          <Palette size={20} />
          Themes
        </h3>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium flex items-center gap-2"
        >
          <Plus size={16} />
          New Theme
        </button>
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

      <div className="flex-1 flex overflow-hidden">
        <div className="w-64 border-r border-slate-200 overflow-y-auto">
          <div className="p-4 space-y-2">
            {themes.map(theme => (
              <div
                key={theme.id}
                onClick={() => {
                  setSelectedTheme(theme);
                  onThemeSelect?.(theme.id);
                }}
                className={`p-3 rounded-lg cursor-pointer transition-colors ${
                  selectedTheme?.id === theme.id
                    ? 'bg-blue-50 border border-blue-200'
                    : 'hover:bg-slate-50 border border-transparent'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-sm text-slate-800">{theme.name}</div>
                    {theme.isDefault && (
                      <span className="text-xs text-blue-600">Default</span>
                    )}
                  </div>
                  {!theme.isSystem && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteTheme(theme.id);
                      }}
                      className="p-1 text-red-400 hover:text-red-600"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {selectedTheme && (
          <div className="flex-1 overflow-y-auto p-6">
            <div className="max-w-2xl space-y-6">
              <div>
                <h4 className="font-bold text-slate-800 mb-4">Colors</h4>
                <div className="grid grid-cols-2 gap-4">
                  {Object.entries(selectedTheme.designTokens.colors || {}).map(([key, value]) => (
                    <div key={key}>
                      <label className="block text-sm font-medium text-slate-700 mb-1 capitalize">
                        {key.replace(/([A-Z])/g, ' $1').trim()}
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="color"
                          value={value as string}
                          onChange={(e) => updateDesignToken(['colors', key], e.target.value)}
                          className="h-10 w-20 border border-slate-300 rounded-lg"
                        />
                        <input
                          type="text"
                          value={value as string}
                          onChange={(e) => updateDesignToken(['colors', key], e.target.value)}
                          className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="font-bold text-slate-800 mb-4">Typography</h4>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Font Family</label>
                    <input
                      type="text"
                      value={selectedTheme.designTokens.typography?.fontFamily || ''}
                      onChange={(e) => updateDesignToken(['typography', 'fontFamily'], e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Base Font Size</label>
                    <input
                      type="text"
                      value={selectedTheme.designTokens.typography?.fontSizeBase || ''}
                      onChange={(e) => updateDesignToken(['typography', 'fontSizeBase'], e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    />
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-bold text-slate-800 mb-4">Custom CSS</h4>
                <textarea
                  value={selectedTheme.customCss || ''}
                  onChange={(e) => setSelectedTheme({ ...selectedTheme, customCss: e.target.value })}
                  rows={10}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono"
                  placeholder="/* Custom CSS */"
                />
              </div>

              <div className="flex justify-end">
                <button
                  onClick={handleUpdateTheme}
                  disabled={saving}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium flex items-center gap-2 disabled:opacity-50"
                >
                  {saving ? (
                    <>
                      <Loader2 className="animate-spin" size={16} />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save size={16} />
                      Save Theme
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Create Theme Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-bold mb-4">Create New Theme</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
                <input
                  type="text"
                  value={newThemeName}
                  onChange={(e) => setNewThemeName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  placeholder="My Theme"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Slug</label>
                <input
                  type="text"
                  value={newThemeSlug}
                  onChange={(e) => setNewThemeSlug(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  placeholder="my-theme"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateTheme}
                  disabled={saving}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium disabled:opacity-50"
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

