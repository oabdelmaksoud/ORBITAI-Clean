import React, { useState } from 'react';
import { Download, Upload, FileText, FileJson, Archive, X } from 'lucide-react';
import { ProjectState } from '@orbitai/shared';
import { exportProjectToJSON, exportProjectToPDF, exportProjectAsZIP, importProjectFromJSON, downloadFile, readFileAsText } from '../services/exportImport';

interface ExportImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: ProjectState;
  onImport: (project: ProjectState) => void;
}

export const ExportImportModal: React.FC<ExportImportModalProps> = ({
  isOpen,
  onClose,
  project,
  onImport
}) => {
  const [importError, setImportError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  if (!isOpen) return null;

  const handleExportJSON = () => {
    try {
      const json = exportProjectToJSON(project);
      const blob = new Blob([json], { type: 'application/json' });
      downloadFile(blob, `${project.name.replace(/\s+/g, '_')}_export.json`);
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  const handleExportPDF = async () => {
    setIsExporting(true);
    try {
      const blob = await exportProjectToPDF(project);
      downloadFile(blob, `${project.name.replace(/\s+/g, '_')}_export.html`);
    } catch (error) {
      console.error('PDF export failed:', error);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportZIP = async () => {
    setIsExporting(true);
    try {
      const blob = await exportProjectAsZIP(project);
      downloadFile(blob, `${project.name.replace(/\s+/g, '_')}_export.zip`);
    } catch (error) {
      console.error('ZIP export failed:', error);
    } finally {
      setIsExporting(false);
    }
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImportError(null);

    try {
      const text = await readFileAsText(file);
      const importedProject = importProjectFromJSON(text);
      onImport(importedProject);
      onClose();
    } catch (error) {
      setImportError(error instanceof Error ? error.message : 'Failed to import project');
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full mx-4">
        <div className="p-6 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-800">Export / Import Project</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            aria-label="Close modal"
            style={{ minWidth: '44px', minHeight: '44px' }}
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Export Section */}
          <div>
            <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <Download size={20} />
              Export Project
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <button
                onClick={handleExportJSON}
                disabled={isExporting}
                className="flex flex-col items-center gap-2 p-4 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
                aria-label="Export as JSON"
              >
                <FileJson size={24} className="text-primary" />
                <span className="text-sm font-medium">JSON</span>
              </button>
              <button
                onClick={handleExportPDF}
                disabled={isExporting}
                className="flex flex-col items-center gap-2 p-4 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
                aria-label="Export as PDF"
              >
                <FileText size={24} className="text-primary" />
                <span className="text-sm font-medium">PDF/HTML</span>
              </button>
              <button
                onClick={handleExportZIP}
                disabled={isExporting}
                className="flex flex-col items-center gap-2 p-4 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
                aria-label="Export as ZIP"
              >
                <Archive size={24} className="text-primary" />
                <span className="text-sm font-medium">ZIP</span>
              </button>
            </div>
          </div>

          {/* Import Section */}
          <div>
            <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <Upload size={20} />
              Import Project
            </h3>
            <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center">
              <input
                type="file"
                accept=".json"
                onChange={handleFileSelect}
                className="hidden"
                id="import-file-input"
                aria-label="Select JSON file to import"
              />
              <label
                htmlFor="import-file-input"
                className="cursor-pointer flex flex-col items-center gap-2"
              >
                <Upload size={32} className="text-slate-400" />
                <span className="text-sm text-slate-600">
                  Click to select JSON file
                </span>
                <span className="text-xs text-slate-500">
                  Supported format: JSON export
                </span>
              </label>
            </div>
            {importError && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                {importError}
              </div>
            )}
          </div>
        </div>

        <div className="p-6 border-t border-slate-200">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};






