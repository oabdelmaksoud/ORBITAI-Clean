import React, { useState, useEffect } from 'react';
import { Workflow, Plus, Play, Download, Trash2, Edit, Eye, Loader2, FileCode, X } from 'lucide-react';

import { showAlert, showConfirm } from '../utils/browserUtils';
interface WorkflowEngineDashboardProps {
  token: string;
}

interface Workflow {
  id: string;
  name: string;
  description: string;
  status: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  statistics?: {
    timesExecuted: number;
  };
}

const WorkflowEngineDashboard: React.FC<WorkflowEngineDashboardProps> = ({ token }) => {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [executing, setExecuting] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newWorkflow, setNewWorkflow] = useState({
    name: '',
    description: '',
    bpmnDefinition: `<?xml version="1.0" encoding="UTF-8"?>
<bpmn2:definitions xmlns:bpmn2="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn2:process id="Process_1" name="New Process" isExecutable="true">
    <bpmn2:startEvent id="StartEvent_1" name="Start"/>
    <bpmn2:endEvent id="EndEvent_1" name="End"/>
    <bpmn2:sequenceFlow id="Flow_1" sourceRef="StartEvent_1" targetRef="EndEvent_1"/>
  </bpmn2:process>
</bpmn2:definitions>`
  });

  const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3002';

  useEffect(() => {
    loadWorkflows();
  }, []);

  const loadWorkflows = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/workflows`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) throw new Error('Failed to load workflows');

      const result = await response.json();
      setWorkflows(result.data || []);
    } catch (error: any) {
      console.error('Failed to load workflows:', error);
      alert(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleExecute = async (workflowId: string) => {
    setExecuting(workflowId);
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/workflows/${workflowId}/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ variables: {}, context: {} }),
      });

      if (!response.ok) throw new Error('Failed to execute workflow');

      const result = await response.json();
      alert(`Workflow executed successfully!\n\nResult: ${JSON.stringify(result.data, null, 2)}`);
    } catch (error: any) {
      console.error('Failed to execute workflow:', error);
      alert(`Error: ${error.message}`);
    } finally {
      setExecuting(null);
    }
  };

  const handleExport = async (workflowId: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/workflows/${workflowId}/export/bpmn`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) throw new Error('Failed to export workflow');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `workflow-${workflowId}.bpmn`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error: any) {
      console.error('Failed to export workflow:', error);
      alert(`Error: ${error.message}`);
    }
  };

  const handleCreateWorkflow = async () => {
    if (!newWorkflow.name.trim() || !newWorkflow.description.trim()) {
      alert('Name and description are required');
      return;
    }

    setCreating(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/workflows`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: newWorkflow.name,
          description: newWorkflow.description,
          bpmnDefinition: newWorkflow.bpmnDefinition
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create workflow');
      }

      setShowCreateModal(false);
      setNewWorkflow({
        name: '',
        description: '',
        bpmnDefinition: `<?xml version="1.0" encoding="UTF-8"?>
<bpmn2:definitions xmlns:bpmn2="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn2:process id="Process_1" name="New Process" isExecutable="true">
    <bpmn2:startEvent id="StartEvent_1" name="Start"/>
    <bpmn2:endEvent id="EndEvent_1" name="End"/>
    <bpmn2:sequenceFlow id="Flow_1" sourceRef="StartEvent_1" targetRef="EndEvent_1"/>
  </bpmn2:process>
</bpmn2:definitions>`
      });
      await loadWorkflows();
      showAlert('Workflow created successfully');
    } catch (error: any) {
      console.error('Failed to create workflow:', error);
      alert(`Error: ${error.message}`);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Workflow Engine</h2>
          <p className="text-sm text-slate-500 mt-1">Manage BPMN workflows and executions</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
        >
          <Plus size={16} />
          Create Workflow
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      ) : workflows.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-12 text-center">
          <Workflow className="w-16 h-16 mx-auto mb-4 text-slate-300" />
          <h3 className="text-lg font-semibold text-slate-700 mb-2">No Workflows</h3>
          <p className="text-slate-500 mb-4">Create your first workflow to get started</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Create Workflow
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {workflows.map((workflow) => (
            <div key={workflow.id} className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="font-semibold text-slate-800 mb-1">{workflow.name}</h3>
                  <p className="text-sm text-slate-500 line-clamp-2">{workflow.description}</p>
                </div>
                <span className={`px-2 py-1 text-xs rounded ${
                  workflow.status === 'active' ? 'bg-green-100 text-green-700' :
                  workflow.status === 'draft' ? 'bg-yellow-100 text-yellow-700' :
                  'bg-slate-100 text-slate-700'
                }`}>
                  {workflow.status}
                </span>
              </div>

              <div className="flex items-center gap-2 text-xs text-slate-500 mb-4">
                <span>v{workflow.version}</span>
                <span>•</span>
                <span>{workflow.statistics?.timesExecuted || 0} executions</span>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => handleExecute(workflow.id)}
                  disabled={executing === workflow.id}
                  className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
                >
                  {executing === workflow.id ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Play size={14} />
                  )}
                  Execute
                </button>
                <button
                  onClick={() => handleExport(workflow.id)}
                  className="px-3 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors"
                  title="Export BPMN"
                >
                  <Download size={14} />
                </button>
                <button
                  onClick={() => setSelectedWorkflow(workflow)}
                  className="px-3 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors"
                  title="View Details"
                >
                  <Eye size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-slate-800">Create New Workflow</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Workflow Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newWorkflow.name}
                  onChange={(e) => setNewWorkflow({ ...newWorkflow, name: e.target.value })}
                  placeholder="Enter workflow name"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Description <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={newWorkflow.description}
                  onChange={(e) => setNewWorkflow({ ...newWorkflow, description: e.target.value })}
                  placeholder="Enter workflow description"
                  rows={3}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  BPMN XML Definition <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={newWorkflow.bpmnDefinition}
                  onChange={(e) => setNewWorkflow({ ...newWorkflow, bpmnDefinition: e.target.value })}
                  rows={15}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-xs"
                  placeholder="Paste or edit BPMN XML definition"
                />
                <p className="text-xs text-slate-500 mt-1">
                  You can use a BPMN editor like bpmn.io to create visual workflows and export the XML.
                </p>
              </div>

              <div className="flex gap-2 justify-end pt-4 border-t border-slate-200">
                <button
                  onClick={() => setShowCreateModal(false)}
                  disabled={creating}
                  className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateWorkflow}
                  disabled={creating || !newWorkflow.name.trim() || !newWorkflow.description.trim() || !newWorkflow.bpmnDefinition.trim()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {creating ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Plus size={16} />
                      Create Workflow
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedWorkflow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
            <h3 className="text-xl font-bold text-slate-800 mb-4">{selectedWorkflow.name}</h3>
            <div className="space-y-2 text-sm">
              <p><strong>Description:</strong> {selectedWorkflow.description}</p>
              <p><strong>Status:</strong> {selectedWorkflow.status}</p>
              <p><strong>Version:</strong> {selectedWorkflow.version}</p>
              <p><strong>Executions:</strong> {selectedWorkflow.statistics?.timesExecuted || 0}</p>
              <p><strong>Created:</strong> {new Date(selectedWorkflow.createdAt).toLocaleString()}</p>
              <p><strong>Updated:</strong> {new Date(selectedWorkflow.updatedAt).toLocaleString()}</p>
            </div>
            <div className="mt-4 flex gap-2 justify-end">
              <button
                onClick={() => setSelectedWorkflow(null)}
                className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkflowEngineDashboard;













