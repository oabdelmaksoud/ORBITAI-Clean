/**
 * Project Completion Component
 * UI for completing projects and viewing completion status
 */

import React, { useState } from 'react';
import { CheckCircle2, XCircle, Loader2, Download, AlertCircle, Rocket, FileText, Package } from 'lucide-react';
import { showAlert } from '../utils/browserUtils';

interface ProjectCompletionProps {
  projectId: string;
  projectStatus?: 'draft' | 'in-progress' | 'completed' | 'deployed';
  onComplete?: () => void;
  onPackage?: () => void;
}

interface CompletionResult {
  success: boolean;
  completion: {
    qualityGate: {
      passed: boolean;
      score: number;
    };
    documentation: {
      generated: boolean;
      files: string[];
    };
    packaging: {
      generated: boolean;
      packageSize: number;
    };
    deploymentReady: boolean;
    errors: string[];
    warnings: string[];
  };
  message: string;
}

const ProjectCompletion: React.FC<ProjectCompletionProps> = ({
  projectId,
  projectStatus = 'draft',
  onComplete,
  onPackage
}) => {
  const [isCompleting, setIsCompleting] = useState(false);
  const [completionResult, setCompletionResult] = useState<CompletionResult | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  const handleComplete = async () => {
    if (!projectId) {
      showAlert('Project ID is required', 'error');
      return;
    }

    setIsCompleting(true);
    setCompletionResult(null);

    try {
      const authToken = localStorage.getItem('authToken');
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3002'}/api/projects/${projectId}/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          runQualityGates: true,
          generateDocumentation: true,
          generatePackage: true,
          refineCode: true,
          generateTests: true,
          qualityThreshold: 85
        })
      });

      const data = await response.json();

      if (data.success) {
        setCompletionResult(data);
        showAlert(data.message, 'success');
        if (onComplete) {
          onComplete();
        }
      } else {
        throw new Error(data.message || 'Project completion failed');
      }
    } catch (error: any) {
      showAlert(`Failed to complete project: ${error.message}`, 'error');
      setCompletionResult(null);
    } finally {
      setIsCompleting(false);
    }
  };

  const handleDownloadPackage = async () => {
    if (!projectId) {
      showAlert('Project ID is required', 'error');
      return;
    }

    try {
      const authToken = localStorage.getItem('authToken');
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3002'}/api/projects/${projectId}/package`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to download package');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `project-package-${projectId}.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      showAlert('Project package downloaded successfully', 'success');
      if (onPackage) {
        onPackage();
      }
    } catch (error: any) {
      showAlert(`Failed to download package: ${error.message}`, 'error');
    }
  };

  const getStatusBadge = () => {
    switch (projectStatus) {
      case 'completed':
        return (
          <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
            <CheckCircle2 size={10} />
            Completed
          </span>
        );
      case 'deployed':
        return (
          <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
            <Rocket size={10} />
            Deployed
          </span>
        );
      case 'in-progress':
        return (
          <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
            <Loader2 size={10} className="animate-spin" />
            In Progress
          </span>
        );
      default:
        return (
          <span className="px-2 py-1 bg-slate-100 text-slate-700 rounded text-[10px] font-bold uppercase tracking-wider">
            Draft
          </span>
        );
    }
  };

  if (projectStatus === 'completed' || projectStatus === 'deployed') {
    return (
      <div className="bg-white border border-slate-200 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-green-600" />
            <h3 className="text-sm font-semibold text-slate-800">Project Completed</h3>
          </div>
          {getStatusBadge()}
        </div>
        {completionResult && (
          <div className="space-y-2 text-xs text-slate-600">
            <div className="flex items-center gap-2">
              <span className="font-semibold">Quality Score:</span>
              <span className={completionResult.completion.qualityGate.passed ? 'text-green-600' : 'text-red-600'}>
                {completionResult.completion.qualityGate.score}/100
              </span>
            </div>
            {completionResult.completion.deploymentReady && (
              <div className="flex items-center gap-2 text-green-600">
                <Rocket size={12} />
                <span>Ready for deployment</span>
              </div>
            )}
          </div>
        )}
        <button
          onClick={handleDownloadPackage}
          className="mt-3 w-full px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
        >
          <Download size={14} />
          Download Project Package
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
          <FileText size={16} />
          Project Completion
        </h3>
        {getStatusBadge()}
      </div>

      {completionResult ? (
        <div className="space-y-3">
          <div className={`p-3 rounded-lg ${completionResult.completion.deploymentReady ? 'bg-green-50 border border-green-200' : 'bg-yellow-50 border border-yellow-200'}`}>
            <div className="flex items-center gap-2 mb-2">
              {completionResult.completion.deploymentReady ? (
                <CheckCircle2 size={16} className="text-green-600" />
              ) : (
                <AlertCircle size={16} className="text-yellow-600" />
              )}
              <span className="text-sm font-semibold">
                {completionResult.completion.deploymentReady ? 'Ready for Deployment' : 'Completion Finished with Warnings'}
              </span>
            </div>
            <div className="text-xs text-slate-600 space-y-1">
              <div>Quality Score: {completionResult.completion.qualityGate.score}/100</div>
              <div>Documentation: {completionResult.completion.documentation.files.length} files generated</div>
              <div>Package Size: {(completionResult.completion.packaging.packageSize / 1024).toFixed(2)} KB</div>
            </div>
          </div>

          {completionResult.completion.errors.length > 0 && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <div className="text-xs font-semibold text-red-800 mb-1">Errors:</div>
              <ul className="text-xs text-red-700 space-y-1">
                {completionResult.completion.errors.map((error, idx) => (
                  <li key={idx}>• {error}</li>
                ))}
              </ul>
            </div>
          )}

          {completionResult.completion.warnings.length > 0 && (
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="text-xs font-semibold text-yellow-800 mb-1">Warnings:</div>
              <ul className="text-xs text-yellow-700 space-y-1">
                {completionResult.completion.warnings.map((warning, idx) => (
                  <li key={idx}>• {warning}</li>
                ))}
              </ul>
            </div>
          )}

          {completionResult.completion.deploymentReady && (
            <button
              onClick={handleDownloadPackage}
              className="w-full px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
            >
              <Package size={14} />
              Download Project Package
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-slate-600">
            Complete your project to generate documentation, run quality checks, and create a deployment-ready package.
          </p>
          <button
            onClick={handleComplete}
            disabled={isCompleting}
            className="w-full px-3 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isCompleting ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Completing Project...
              </>
            ) : (
              <>
                <CheckCircle2 size={14} />
                Complete Project
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
};

export default ProjectCompletion;




