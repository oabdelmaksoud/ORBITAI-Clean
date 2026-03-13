import React, { useState, useEffect } from 'react';
import { X, Folder, Globe, Smartphone, Monitor, Server, Code, FolderPlus, Edit2, Trash2, Save } from 'lucide-react';
import { ProjectFolder } from '@orbitai/shared';
import { projectFolderApi } from '@src/services/projectFolderApi';
import { showAlert, showConfirm } from '../utils/browserUtils';

export interface CreateFolderRequest {
  name: string;
  description?: string;
  platforms?: ('web' | 'android' | 'ios' | 'desktop' | 'api' | 'other')[];
  metadata?: Record<string, any>;
}

export interface UpdateFolderRequest {
  name?: string;
  description?: string;
  platforms?: ('web' | 'android' | 'ios' | 'desktop' | 'api' | 'other')[];
  metadata?: Record<string, any>;
}

interface ProjectFolderManagerProps {
  isOpen: boolean;
  onClose: () => void;
  onFolderCreated?: (folder: ProjectFolder) => void;
  onFolderUpdated?: (folder: ProjectFolder) => void;
  onFolderDeleted?: (folderId: string) => void;
  existingFolder?: ProjectFolder | null;
  mode?: 'create' | 'edit';
}

const ProjectFolderManager: React.FC<ProjectFolderManagerProps> = ({
  isOpen,
  onClose,
  onFolderCreated,
  onFolderUpdated,
  onFolderDeleted,
  existingFolder = null,
  mode = 'create'
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [platforms, setPlatforms] = useState<('web' | 'android' | 'ios' | 'desktop' | 'api' | 'other')[]>(['other']);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (mode === 'edit' && existingFolder) {
        setName(existingFolder.name);
        setDescription(existingFolder.description || '');
        setPlatforms(existingFolder.platforms && existingFolder.platforms.length > 0 ? existingFolder.platforms : ['other']);
      } else {
        setName('');
        setDescription('');
        setPlatforms(['other']);
      }
    }
  }, [isOpen, mode, existingFolder]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      showAlert('Folder name is required', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      if (mode === 'edit' && existingFolder) {
        const updatedFolder = await projectFolderApi.updateFolder(existingFolder.id, {
          name: name.trim(),
          description: description.trim() || undefined,
          platforms
        });
        onFolderUpdated?.(updatedFolder);
        showAlert('Folder updated successfully', 'success');
      } else {
        const newFolder = await projectFolderApi.createFolder({
          name: name.trim(),
          description: description.trim() || undefined,
          platforms
        });
        onFolderCreated?.(newFolder);
        showAlert('Folder created successfully', 'success');
      }
      onClose();
    } catch (error: any) {
      console.error('Error saving folder:', error);
      const errorMessage = error.message || error.toString() || 'Failed to save folder';
      // Check if it's a connection error
      if (errorMessage.includes('Failed to fetch') || errorMessage.includes('ERR_CONNECTION_REFUSED')) {
        showAlert('Cannot connect to server. Please make sure the backend server is running.', 'error');
      } else {
        showAlert(errorMessage, 'error');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!existingFolder) return;

    const confirmed = await showConfirm(
      `Delete folder "${existingFolder.name}"? All conversations in this folder will be unassigned.`
    );

    if (!confirmed) return;

    try {
      await projectFolderApi.deleteFolder(existingFolder.id);
      onFolderDeleted?.(existingFolder.id);
      showAlert('Folder deleted successfully', 'success');
      onClose();
    } catch (error: any) {
      console.error('Error deleting folder:', error);
      showAlert(error.message || 'Failed to delete folder', 'error');
    }
  };

  if (!isOpen) return null;

  const platformOptions = [
    { value: 'web' as const, label: 'Web Platform', icon: Globe },
    { value: 'android' as const, label: 'Android App', icon: Smartphone },
    { value: 'ios' as const, label: 'iOS App', icon: Smartphone },
    { value: 'desktop' as const, label: 'Desktop App', icon: Monitor },
    { value: 'api' as const, label: 'API/Backend', icon: Server },
    { value: 'other' as const, label: 'Other', icon: Code },
  ];

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-primary to-indigo-600 p-4 text-white relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 hover:bg-white/20 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center">
              {mode === 'edit' ? <Edit2 size={20} /> : <FolderPlus size={20} />}
            </div>
            <div>
              <h2 className="text-lg font-bold">
                {mode === 'edit' ? 'Edit Project Folder' : 'Create Project Folder'}
              </h2>
              <p className="text-white/80 text-sm">
                {mode === 'edit' ? 'Update folder details' : 'Organize your conversations by project'}
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Folder Name */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Folder Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., E-commerce Platform, Mobile Banking App"
              className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              required
              autoFocus
            />
          </div>

          {/* Platform Selection */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Platform Types <span className="text-slate-400 font-normal text-xs">(Select multiple)</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              {platformOptions.map((option) => {
                const Icon = option.icon;
                const isSelected = platforms.includes(option.value);
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      if (isSelected) {
                        // Remove if already selected (but keep at least one)
                        if (platforms.length > 1) {
                          setPlatforms(platforms.filter(p => p !== option.value));
                        }
                      } else {
                        // Add if not selected
                        setPlatforms([...platforms, option.value]);
                      }
                    }}
                    className={`p-3 rounded-lg border-2 transition-all flex items-center gap-2 ${isSelected
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-slate-200 hover:border-slate-300 text-slate-600'
                      }`}
                  >
                    <Icon size={18} />
                    <span className="text-xs font-medium">{option.label}</span>
                    {isSelected && (
                      <span className="ml-auto text-primary">✓</span>
                    )}
                  </button>
                );
              })}
            </div>
            {platforms.length > 0 && (
              <p className="text-xs text-slate-500 mt-2">
                Selected: {platforms.join(', ')}
              </p>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Description (Optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of this project..."
              rows={3}
              className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-4 border-t border-slate-200">
            {mode === 'edit' && existingFolder && (
              <button
                type="button"
                onClick={handleDelete}
                className="px-4 py-2.5 bg-red-50 hover:bg-red-100 text-red-600 font-bold rounded-lg transition-colors flex items-center justify-center gap-2 flex-1"
              >
                <Trash2 size={16} />
                Delete
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !name.trim()}
              className="px-4 py-2.5 bg-primary hover:bg-primary/90 text-white font-bold rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save size={16} />
                  {mode === 'edit' ? 'Update' : 'Create'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProjectFolderManager;

