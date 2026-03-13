import React, { useState } from 'react';
import { FileText, Download, Loader2, X, CheckCircle, AlertCircle, FileJson } from 'lucide-react';
import { projectsApi } from '@src/services/api';
import { useFeatureAccess } from '../hooks/useFeatureAccess';

interface ProjectReportExportProps {
  projectId: string;
  projectName: string;
  onClose: () => void;
  userRole?: string;
}

const ProjectReportExport: React.FC<ProjectReportExportProps> = ({ projectId, projectName, onClose, userRole = 'user' }) => {
  const [format, setFormat] = useState<'pdf' | 'docx'>('pdf');
  const [includeTasks, setIncludeTasks] = useState(true);
  const [includeArtifacts, setIncludeArtifacts] = useState(true);
  const [includeLogs, setIncludeLogs] = useState(false);
  const [includeAgents, setIncludeAgents] = useState(true);
  const [customTitle, setCustomTitle] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const canExportReports = useFeatureAccess('export_reports', userRole);

  const handleExport = async () => {
    if (!canExportReports.enabled) {
      setError('Export reports feature is not enabled for your role');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const blob = await projectsApi.exportReport(projectId, format, {
        includeTasks,
        includeArtifacts,
        includeLogs,
        includeAgents,
        title: customTitle || undefined,
      });

      // Download the file
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${projectName.replace(/[^a-z0-9]/gi, '_')}_report_${Date.now()}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      setSuccess(true);
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Failed to export report');
    } finally {
      setLoading(false);
    }
  };

  if (!canExportReports.enabled && !canExportReports.loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
        <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md m-4 border border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-slate-800">Export Report</h3>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
              <X size={20} />
            </button>
          </div>
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
            <AlertCircle size={32} className="mx-auto mb-2 text-yellow-600" />
            <h4 className="font-bold text-yellow-800 mb-1">Feature Disabled</h4>
            <p className="text-sm text-yellow-700">
              Export reports is not enabled for your role. Contact an administrator to enable this feature.
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
          <h3 className="text-lg font-bold text-slate-800">Export Project Report</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>

        {success && (
          <div className="mb-4 bg-emerald-50 border border-emerald-200 rounded-lg p-4 flex items-center gap-3">
            <CheckCircle size={20} className="text-emerald-600" />
            <p className="text-sm text-emerald-800">Report exported successfully!</p>
          </div>
        )}

        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
            <AlertCircle size={20} className="text-red-600" />
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {/* Format Selection */}
        <div className="mb-6">
          <label className="block text-sm font-bold text-slate-700 mb-2">
            Format
          </label>
          <div className="flex gap-3">
            <label className="flex-1 flex items-center gap-3 p-3 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50">
              <input
                type="radio"
                name="format"
                value="pdf"
                checked={format === 'pdf'}
                onChange={(e) => setFormat(e.target.value as 'pdf' | 'docx')}
                className="text-primary"
              />
              <FileText size={20} className="text-red-600" />
              <div>
                <div className="text-sm font-bold text-slate-800">PDF</div>
                <div className="text-xs text-slate-500">Portable Document Format</div>
              </div>
            </label>
            <label className="flex-1 flex items-center gap-3 p-3 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50">
              <input
                type="radio"
                name="format"
                value="docx"
                checked={format === 'docx'}
                onChange={(e) => setFormat(e.target.value as 'pdf' | 'docx')}
                className="text-primary"
              />
              <FileText size={20} className="text-blue-600" />
              <div>
                <div className="text-sm font-bold text-slate-800">Word</div>
                <div className="text-xs text-slate-500">Microsoft Word Document</div>
              </div>
            </label>
          </div>
        </div>

        {/* Custom Title */}
        <div className="mb-6">
          <label className="block text-sm font-bold text-slate-700 mb-2">
            Report Title (Optional)
          </label>
          <input
            type="text"
            value={customTitle}
            onChange={(e) => setCustomTitle(e.target.value)}
            placeholder={`Default: Project Report: ${projectName}`}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-primary"
          />
        </div>

        {/* Include Options */}
        <div className="mb-6">
          <label className="block text-sm font-bold text-slate-700 mb-2">
            Include Sections
          </label>
          <div className="space-y-2">
            <label className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded-lg cursor-pointer">
              <input
                type="checkbox"
                checked={includeTasks}
                onChange={(e) => setIncludeTasks(e.target.checked)}
                className="text-primary"
              />
              <span className="text-sm text-slate-700">Tasks</span>
            </label>
            <label className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded-lg cursor-pointer">
              <input
                type="checkbox"
                checked={includeArtifacts}
                onChange={(e) => setIncludeArtifacts(e.target.checked)}
                className="text-primary"
              />
              <span className="text-sm text-slate-700">Artifacts</span>
            </label>
            <label className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded-lg cursor-pointer">
              <input
                type="checkbox"
                checked={includeAgents}
                onChange={(e) => setIncludeAgents(e.target.checked)}
                className="text-primary"
              />
              <span className="text-sm text-slate-700">Agents</span>
            </label>
            <label className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded-lg cursor-pointer">
              <input
                type="checkbox"
                checked={includeLogs}
                onChange={(e) => setIncludeLogs(e.target.checked)}
                className="text-primary"
              />
              <span className="text-sm text-slate-700">Activity Logs</span>
            </label>
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
            onClick={handleExport}
            disabled={loading || !canExportReports.enabled}
            className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Download size={16} />
                Export Report
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProjectReportExport;




