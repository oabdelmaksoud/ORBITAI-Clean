/**
 * Infrastructure as Code Viewer Component
 * Displays and manages IaC templates (Terraform, CloudFormation, Pulumi)
 */

import React, { useState, useEffect } from 'react';
import { Code, Download, RefreshCw, FileText, Cloud } from 'lucide-react';
import { projectsApi } from '@src/services/api';

interface InfrastructureAsCodeViewerProps {
  projectId: string;
  deploymentId?: string;
}

interface IaCTemplate {
  id: string;
  tool: 'terraform' | 'cloudformation' | 'pulumi';
  platform: 'aws' | 'gcp' | 'azure' | 'multi-cloud';
  content: string;
  resources: Array<{
    type: string;
    name: string;
  }>;
  generatedAt: Date;
}

const InfrastructureAsCodeViewer: React.FC<InfrastructureAsCodeViewerProps> = ({ projectId, deploymentId }) => {
  const [loading, setLoading] = useState(false);
  const [templates, setTemplates] = useState<IaCTemplate[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);

  useEffect(() => {
    loadTemplates();
  }, [projectId, deploymentId]);

  const loadTemplates = async () => {
    setLoading(true);
    try {
      // In real implementation, fetch from backend
      setTemplates([]);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to load IaC templates');
    } finally {
      setLoading(false);
    }
  };

  const getToolColor = (tool: string) => {
    switch (tool) {
      case 'terraform': return 'bg-purple-100 text-purple-800';
      case 'cloudformation': return 'bg-orange-100 text-orange-800';
      case 'pulumi': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const selected = templates.find(t => t.id === selectedTemplate);

  return (
    <div className="p-6 bg-white rounded-lg shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Code className="w-6 h-6 text-blue-500" />
          <h2 className="text-2xl font-bold text-gray-900">Infrastructure as Code</h2>
        </div>
        <button
          onClick={loadTemplates}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg mb-4">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="text-center py-8">
          <RefreshCw className="w-8 h-8 animate-spin text-gray-400 mx-auto mb-2" />
          <p className="text-gray-600">Loading IaC templates...</p>
        </div>
      ) : templates.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <Cloud className="w-12 h-12 text-gray-400 mx-auto mb-2" />
          <p>No IaC templates available.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-3">
            {templates.map((template, index) => (
              <div
                key={index}
                className={`p-4 border-2 rounded-lg cursor-pointer ${
                  selectedTemplate === template.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 bg-white hover:bg-gray-50'
                }`}
                onClick={() => setSelectedTemplate(template.id === selectedTemplate ? null : template.id)}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    <span className="font-semibold">{template.tool.toUpperCase()}</span>
                  </div>
                  <span className={`px-2 py-1 text-xs font-medium rounded ${getToolColor(template.tool)}`}>
                    {template.platform}
                  </span>
                </div>
                <div className="text-sm text-gray-600">
                  {template.resources.length} resources
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {new Date(template.generatedAt).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
          {selected && (
            <div className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="font-semibold">{selected.tool.toUpperCase()} Template</div>
                <button
                  onClick={() => {
                    const blob = new Blob([selected.content], { type: 'text/plain' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `${selected.tool}-${selected.platform}-${Date.now()}.${selected.tool === 'terraform' ? 'tf' : selected.tool === 'cloudformation' ? 'yaml' : 'ts'}`;
                    a.click();
                  }}
                  className="flex items-center gap-2 px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  <Download className="w-3 h-3" />
                  Download
                </button>
              </div>
              <pre className="bg-gray-900 text-green-400 p-4 rounded text-xs overflow-x-auto max-h-96">
                {selected.content}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default InfrastructureAsCodeViewer;



