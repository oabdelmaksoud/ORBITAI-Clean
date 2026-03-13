/**
 * Compliance Checklist Manager Component
 * Manages compliance checklists for GDPR, HIPAA, SOC2, PCI DSS, ISO 27001
 */

import React, { useState, useEffect } from 'react';
import { Shield, CheckCircle, XCircle, AlertTriangle, Download, RefreshCw, FileText, Search } from 'lucide-react';
import { projectsApi } from '@src/services/api';

interface ComplianceChecklistManagerProps {
  projectId: string;
}

interface ChecklistItem {
  id: string;
  requirement: string;
  description: string;
  category: string;
  status: 'compliant' | 'partial' | 'non_compliant' | 'not_assessed';
  evidence?: string;
  notes?: string;
}

interface ComplianceChecklist {
  _id: string;
  projectId: string;
  standard: 'gdpr' | 'hipaa' | 'soc2' | 'pci_dss' | 'iso27001' | 'aspice' | 'custom';
  checklistItems: ChecklistItem[];
  overallCompliance: number;
  lastValidated: Date;
  validatedBy?: string;
}

const ComplianceChecklistManager: React.FC<ComplianceChecklistManagerProps> = ({ projectId }) => {
  const [loading, setLoading] = useState(false);
  const [checklists, setChecklists] = useState<ComplianceChecklist[]>([]);
  const [selectedStandard, setSelectedStandard] = useState<'gdpr' | 'hipaa' | 'soc2' | 'pci_dss' | 'iso27001' | 'aspice' | 'custom'>('gdpr');
  const [selectedChecklist, setSelectedChecklist] = useState<ComplianceChecklist | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadChecklists();
  }, [projectId]);

  const loadChecklists = async () => {
    setLoading(true);
    try {
      // Load all checklists for the project
      const standards: Array<'gdpr' | 'hipaa' | 'soc2' | 'pci_dss' | 'iso27001'> = ['gdpr', 'hipaa', 'soc2', 'pci_dss', 'iso27001'];
      const results = await Promise.all(
        standards.map(async (standard) => {
          try {
            const response = await projectsApi.get(`/compliance/${projectId}/${standard}/validate`);
            if (response.data?.success) {
              return response.data.data;
            }
          } catch (err) {
            return null;
          }
        })
      );
      setChecklists(results.filter(Boolean) as ComplianceChecklist[]);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to load checklists');
    } finally {
      setLoading(false);
    }
  };

  const generateChecklist = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await projectsApi.post(`/compliance/${projectId}/${selectedStandard}/generate`);
      if (response.data?.success) {
        await loadChecklists();
        setSelectedChecklist(response.data.data);
      } else {
        setError(response.data?.error || 'Failed to generate checklist');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to generate checklist');
    } finally {
      setLoading(false);
    }
  };

  const validateChecklist = async (checklistId: string) => {
    setLoading(true);
    try {
      const response = await projectsApi.get(`/compliance/${projectId}/${selectedStandard}/validate`);
      if (response.data?.success) {
        await loadChecklists();
        setSelectedChecklist(response.data.data);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to validate checklist');
    } finally {
      setLoading(false);
    }
  };

  const updateItemStatus = async (itemId: string, status: ChecklistItem['status'], notes?: string) => {
    // In a real implementation, this would call an API to update the item
    if (selectedChecklist) {
      const updated = {
        ...selectedChecklist,
        checklistItems: selectedChecklist.checklistItems.map(item =>
          item.id === itemId ? { ...item, status, notes } : item
        )
      };
      setSelectedChecklist(updated);
    }
  };

  const getStandardName = (standard: string) => {
    const names: Record<string, string> = {
      gdpr: 'GDPR',
      hipaa: 'HIPAA',
      soc2: 'SOC 2',
      pci_dss: 'PCI DSS',
      iso27001: 'ISO 27001',
      aspice: 'ASPICE',
      custom: 'Custom'
    };
    return names[standard] || standard;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'compliant': return 'text-green-600 bg-green-50 border-green-200';
      case 'partial': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'non_compliant': return 'text-red-600 bg-red-50 border-red-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'compliant': return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'partial': return <AlertTriangle className="w-4 h-4 text-yellow-600" />;
      case 'non_compliant': return <XCircle className="w-4 h-4 text-red-600" />;
      default: return <FileText className="w-4 h-4 text-gray-400" />;
    }
  };

  const filteredItems = selectedChecklist?.checklistItems.filter(item =>
    item.requirement.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.description.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const currentChecklist = checklists.find(c => c.standard === selectedStandard);

  return (
    <div className="p-6 bg-white rounded-lg shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Shield className="w-6 h-6 text-blue-500" />
          <h2 className="text-2xl font-bold text-gray-900">Compliance Checklist Manager</h2>
        </div>
        <div className="flex gap-2">
          <select
            value={selectedStandard}
            onChange={(e) => {
              setSelectedStandard(e.target.value as any);
              setSelectedChecklist(null);
            }}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          >
            <option value="gdpr">GDPR</option>
            <option value="hipaa">HIPAA</option>
            <option value="soc2">SOC 2</option>
            <option value="pci_dss">PCI DSS</option>
            <option value="iso27001">ISO 27001</option>
            <option value="aspice">ASPICE</option>
          </select>
          <button
            onClick={generateChecklist}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <FileText className="w-4 h-4" />
                Generate Checklist
              </>
            )}
          </button>
          {currentChecklist && (
            <button
              onClick={() => validateChecklist(currentChecklist._id)}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              <RefreshCw className="w-4 h-4" />
              Re-validate
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg mb-4">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {currentChecklist ? (
        <div className="space-y-4">
          {/* Summary */}
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-blue-800">{getStandardName(selectedStandard)} Compliance</div>
                <div className="text-2xl font-bold text-blue-900">{currentChecklist.overallCompliance.toFixed(1)}%</div>
              </div>
              <div className="text-right text-sm text-blue-700">
                <div>{currentChecklist.checklistItems.filter(i => i.status === 'compliant').length} / {currentChecklist.checklistItems.length} Compliant</div>
                <div className="text-xs mt-1">
                  Last validated: {new Date(currentChecklist.lastValidated).toLocaleDateString()}
                </div>
              </div>
            </div>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search checklist items..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>

          {/* Checklist Items */}
          <div className="space-y-2">
            {filteredItems.map((item) => (
              <div
                key={item.id}
                className={`p-4 border-2 rounded-lg ${getStatusColor(item.status)}`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      {getStatusIcon(item.status)}
                      <span className="font-medium">{item.requirement}</span>
                    </div>
                    <p className="text-sm text-gray-700">{item.description}</p>
                    {item.evidence && (
                      <div className="mt-2 text-xs text-gray-600">
                        <span className="font-medium">Evidence:</span> {item.evidence}
                      </div>
                    )}
                    {item.notes && (
                      <div className="mt-2 text-xs text-gray-600">
                        <span className="font-medium">Notes:</span> {item.notes}
                      </div>
                    )}
                  </div>
                  <select
                    value={item.status}
                    onChange={(e) => updateItemStatus(item.id, e.target.value as ChecklistItem['status'])}
                    className={`ml-4 px-2 py-1 text-xs border rounded ${getStatusColor(item.status)}`}
                  >
                    <option value="not_assessed">Not Assessed</option>
                    <option value="compliant">Compliant</option>
                    <option value="partial">Partial</option>
                    <option value="non_compliant">Non-Compliant</option>
                  </select>
                </div>
                <div className="text-xs text-gray-500 mt-2">Category: {item.category}</div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500">
          <p>No {getStandardName(selectedStandard)} checklist available.</p>
          <p className="text-sm mt-2">Click "Generate Checklist" to create one.</p>
        </div>
      )}
    </div>
  );
};

export default ComplianceChecklistManager;



