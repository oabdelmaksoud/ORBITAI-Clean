import React, { useState, useRef } from 'react';
import { Upload, FileJson, FileArchive, X, Loader2, CheckCircle, AlertCircle, Info } from 'lucide-react';
import { projectsApi } from '@src/services/api';
import { useFeatureAccess } from '../hooks/useFeatureAccess';

interface ProjectImportProps {
  onImportSuccess: (projectId: string) => void;
  onClose: () => void;
  userRole?: string;
}

type ImportMode = 'create' | 'merge' | 'overwrite';

const ProjectImport: React.FC<ProjectImportProps> = ({ onImportSuccess, onClose, userRole = 'user' }) => {
  const [file, setFile] = useState<File | null>(null);
  const [importMode, setImportMode] = useState<ImportMode>('create');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [projectData, setProjectData] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canImportProjects = useFeatureAccess('project_import', userRole);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setError(null);
    setSuccess(null);
    setProjectData(null);

    // Validate file type
    const isJson = selectedFile.name.endsWith('.json') || selectedFile.type === 'application/json';
    const isZip = selectedFile.name.endsWith('.zip') || selectedFile.type === 'application/zip';

    if (!isJson && !isZip) {
      setError('Please select a JSON or ZIP file');
      return;
    }

    try {
      setLoading(true);

      if (isJson) {
        // Read JSON file
        const text = await selectedFile.text();
        const data = JSON.parse(text);
        
        // Handle different JSON formats
        if (data.project) {
          setProjectData(data.project);
        } else if (data.projects && Array.isArray(data.projects) && data.projects.length > 0) {
          setProjectData(data.projects[0]); // Use first project if multiple
        } else if (data.name || data.id) {
          setProjectData(data); // Direct project object
        } else {
          throw new Error('Invalid project file format');
        }
      } else if (isZip) {
        // For ZIP files, we'd need to extract and find project.json
        // For now, show error - ZIP support can be added later
        throw new Error('ZIP file import not yet supported. Please use JSON format.');
      }

      // Validate project structure
      if (!projectData?.name) {
        throw new Error('Invalid project file: name is required');
      }

    } catch (err: any) {
      setError(err.message || 'Failed to read file');
      setFile(null);
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (!projectData || !canImportProjects.enabled) {
      setError('Project import is not enabled for your role');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const importedProject = await projectsApi.import(projectData, importMode);
      
      setSuccess(`Project "${importedProject.name}" imported successfully!`);
      
      // Wait a moment to show success message, then close and reload
      setTimeout(() => {
        onImportSuccess(importedProject._id || importedProject.id);
        onClose();
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Failed to import project');
    } finally {
      setLoading(false);
    }
  };

  if (!canImportProjects.enabled && !canImportProjects.loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
        <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md m-4 border border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-slate-800">Import Project</h3>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
              <X size={20} />
            </button>
          </div>
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
            <AlertCircle size={32} className="mx-auto mb-2 text-yellow-600" />
            <h4 className="font-bold text-yellow-800 mb-1">Feature Disabled</h4>
            <p className="text-sm text-yellow-700">
              Project import is not enabled for your role. Contact an administrator to enable this feature.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-lg m-4 border border-slate-200" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold text-slate-800">Import Project</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>

        {success && (
          <div className="mb-4 bg-emerald-50 border border-emerald-200 rounded-lg p-4 flex items-center gap-3">
            <CheckCircle size={20} className="text-emerald-600" />
            <p className="text-sm text-emerald-800">{success}</p>
          </div>
        )}

        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
            <AlertCircle size={20} className="text-red-600" />
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {/* File Upload */}
        <div className="mb-6">
          <label className="block text-sm font-bold text-slate-700 mb-2">
            Select Project File
          </label>
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center cursor-pointer hover:border-primary transition-colors"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              onChange={handleFileSelect}
              className="hidden"
            />
            {loading ? (
              <div className="flex flex-col items-center gap-3">
                <Loader2 size={32} className="text-primary animate-spin" />
                <p className="text-sm text-slate-600">Reading file...</p>
              </div>
            ) : file ? (
              <div className="flex flex-col items-center gap-3">
                <FileJson size={32} className="text-primary" />
                <div>
                  <p className="text-sm font-bold text-slate-800">{file.name}</p>
                  {projectData && (
                    <p className="text-xs text-slate-500 mt-1">
                      Project: {projectData.name}
                    </p>
                  )}
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setFile(null);
                    setProjectData(null);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                  className="text-xs text-red-600 hover:text-red-700"
                >
                  Remove
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <Upload size={32} className="text-slate-400" />
                <div>
                  <p className="text-sm font-bold text-slate-700">Click to select file</p>
                  <p className="text-xs text-slate-500 mt-1">JSON format only</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Import Mode Selection */}
        {projectData && (
          <div className="mb-6">
            <label className="block text-sm font-bold text-slate-700 mb-2">
              Import Mode
            </label>
            <div className="space-y-2">
              <label className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50">
                <input
                  type="radio"
                  name="importMode"
                  value="create"
                  checked={importMode === 'create'}
                  onChange={(e) => setImportMode(e.target.value as ImportMode)}
                  className="text-primary"
                />
                <div>
                  <div className="text-sm font-bold text-slate-800">Create New Project</div>
                  <div className="text-xs text-slate-500">Import as a new project</div>
                </div>
              </label>
              {projectData.id && (
                <>
                  <label className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50">
                    <input
                      type="radio"
                      name="importMode"
                      value="merge"
                      checked={importMode === 'merge'}
                      onChange={(e) => setImportMode(e.target.value as ImportMode)}
                      className="text-primary"
                    />
                    <div>
                      <div className="text-sm font-bold text-slate-800">Merge with Existing</div>
                      <div className="text-xs text-slate-500">Add items to existing project (if found)</div>
                    </div>
                  </label>
                  <label className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50">
                    <input
                      type="radio"
                      name="importMode"
                      value="overwrite"
                      checked={importMode === 'overwrite'}
                      onChange={(e) => setImportMode(e.target.value as ImportMode)}
                      className="text-primary"
                    />
                    <div>
                      <div className="text-sm font-bold text-slate-800">Overwrite Existing</div>
                      <div className="text-xs text-slate-500">Replace existing project completely</div>
                    </div>
                  </label>
                </>
              )}
            </div>
          </div>
        )}

        {/* Info Box */}
        <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start gap-3">
          <Info size={16} className="text-blue-600 mt-0.5 shrink-0" />
          <div className="text-xs text-blue-800">
            <p className="font-bold mb-1">Import Tips:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Export projects from the admin console or use project export feature</li>
              <li>JSON format is supported</li>
              <li>ZIP format support coming soon</li>
            </ul>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-white border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleImport}
            disabled={!projectData || loading || !canImportProjects.enabled}
            className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Importing...
              </>
            ) : (
              <>
                <Upload size={16} />
                Import Project
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProjectImport;




