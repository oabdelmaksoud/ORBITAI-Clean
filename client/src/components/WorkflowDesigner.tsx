import React, { useState, useEffect } from 'react';
import { showAlert, showConfirm } from '../utils/browserUtils';
import {
  Workflow, Plus, Save, Play, Trash2, Edit, Eye, Loader2,
  AlertCircle, CheckCircle, Clock, Users, FileText
} from 'lucide-react';
import {
  getWorkflowDefinitions,
  createWorkflowDefinition,
  updateWorkflowDefinition,
  deleteWorkflowDefinition,
  startWorkflowInstance,
  getWorkflowInstances,
  WorkflowDefinition,
  WorkflowInstance
} from '../services/workflowApi';

interface WorkflowDesignerProps {
  token: string;
}

const WorkflowDesigner: React.FC<WorkflowDesignerProps> = ({ token }) => {
  const [definitions, setDefinitions] = useState<WorkflowDefinition[]>([]);
  const [instances, setInstances] = useState<WorkflowInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDefinition, setSelectedDefinition] = useState<WorkflowDefinition | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showInstanceModal, setShowInstanceModal] = useState(false);
  const [editingBpmn, setEditingBpmn] = useState(false);
  const [newDefinition, setNewDefinition] = useState({
    name: '',
    description: '',
    bpmnXml: `<?xml version="1.0" encoding="UTF-8"?>
<bpmn2:definitions xmlns:bpmn2="http://www.omg.org/spec/BPMN/20100524/MODEL">
  <bpmn2:process id="Process_1" name="New Process">
    <bpmn2:startEvent id="StartEvent_1"/>
    <bpmn2:endEvent id="EndEvent_1"/>
  </bpmn2:process>
</bpmn2:definitions>`
  });

  useEffect(() => {
    loadData();
  }, [token]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [defs, insts] = await Promise.all([
        getWorkflowDefinitions(token),
        getWorkflowInstances(token)
      ]);
      setDefinitions(defs);
      setInstances(insts);
    } catch (err: any) {
      setError(err.message || 'Failed to load workflows');
      console.error('Failed to load workflows:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    try {
      await createWorkflowDefinition(token, {
        ...newDefinition,
        status: 'draft'
      });
      setShowCreateModal(false);
      setNewDefinition({
        name: '',
        description: '',
        bpmnXml: `<?xml version="1.0" encoding="UTF-8"?>
<bpmn2:definitions xmlns:bpmn2="http://www.omg.org/spec/BPMN/20100524/MODEL">
  <bpmn2:process id="Process_1" name="New Process">
    <bpmn2:startEvent id="StartEvent_1"/>
    <bpmn2:endEvent id="EndEvent_1"/>
  </bpmn2:process>
</bpmn2:definitions>`
      });
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to create workflow');
    }
  };

  const handleUpdate = async (id: string, updates: Partial<WorkflowDefinition>) => {
    try {
      await updateWorkflowDefinition(token, id, updates);
      await loadData();
      if (selectedDefinition?.id === id) {
        setSelectedDefinition({ ...selectedDefinition, ...updates });
      }
    } catch (err: any) {
      setError(err.message || 'Failed to update workflow');
    }
  };

  const handleDelete = async (id: string) => {
    if (!(await showConfirm('Are you sure you want to delete this workflow definition?'))) return;
    try {
      await deleteWorkflowDefinition(token, id);
      if (selectedDefinition?.id === id) {
        setSelectedDefinition(null);
      }
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to delete workflow');
    }
  };

  const handleStartInstance = async (definitionId: string) => {
    try {
      await startWorkflowInstance(token, definitionId);
      await loadData();
      setShowInstanceModal(false);
    } catch (err: any) {
      setError(err.message || 'Failed to start workflow instance');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="animate-spin text-blue-600" size={32} />
      </div>
    );
  }

  if (error && definitions.length === 0) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
        <AlertCircle className="mx-auto mb-2 text-red-600" size={32} />
        <p className="text-red-700 font-medium">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Workflow Designer</h2>
          <p className="text-sm text-slate-500 mt-1">
            Design and manage BPMN 2.0 workflows
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors flex items-center gap-2"
        >
          <Plus size={16} /> Create Workflow
        </button>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-yellow-700 text-sm">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Workflow Definitions List */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <h3 className="font-bold text-slate-800 mb-4">Workflow Definitions</h3>
            <div className="space-y-2">
              {definitions.map((def) => (
                <div
                  key={def.id}
                  onClick={() => setSelectedDefinition(def)}
                  className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedDefinition?.id === def.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="font-semibold text-slate-800">{def.name}</h4>
                      <p className="text-xs text-slate-500 mt-1 line-clamp-2">{def.description}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className={`px-2 py-1 text-xs rounded ${
                          def.status === 'active' ? 'bg-green-100 text-green-700' :
                          def.status === 'draft' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-slate-100 text-slate-700'
                        }`}>
                          {def.status}
                        </span>
                        {def.version && (
                          <span className="text-xs text-slate-500">v{def.version}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1 ml-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStartInstance(def.id!);
                        }}
                        className="p-1 text-green-600 hover:bg-green-50 rounded"
                        title="Start Instance"
                      >
                        <Play size={14} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(def.id!);
                        }}
                        className="p-1 text-red-600 hover:bg-red-50 rounded"
                        title="Delete"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Active Instances */}
          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <h3 className="font-bold text-slate-800 mb-4">Active Instances</h3>
            <div className="space-y-2">
              {instances.filter(i => i.status === 'running').map((instance) => (
                <div key={instance.id} className="p-3 bg-slate-50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-700">
                        {definitions.find(d => d.id === instance.workflowDefinitionId)?.name || 'Unknown'}
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        Started: {new Date(instance.startTime).toLocaleString()}
                      </p>
                    </div>
                    <span className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded">
                      {instance.status}
                    </span>
                  </div>
                </div>
              ))}
              {instances.filter(i => i.status === 'running').length === 0 && (
                <p className="text-sm text-slate-500 text-center py-4">No active instances</p>
              )}
            </div>
          </div>
        </div>

        {/* Workflow Editor */}
        <div className="lg:col-span-2">
          {selectedDefinition ? (
            <div className="bg-white rounded-lg border border-slate-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-800">{selectedDefinition.name}</h3>
                  <p className="text-sm text-slate-500 mt-1">{selectedDefinition.description}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setEditingBpmn(!editingBpmn)}
                    className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg font-semibold hover:bg-slate-200 transition-colors flex items-center gap-2"
                  >
                    {editingBpmn ? <Eye size={16} /> : <Edit size={16} />}
                    {editingBpmn ? 'View' : 'Edit'}
                  </button>
                  <button
                    onClick={() => handleUpdate(selectedDefinition.id!, { status: 'active' })}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-colors"
                  >
                    Activate
                  </button>
                </div>
              </div>

              {editingBpmn ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      BPMN XML
                    </label>
                    <textarea
                      value={selectedDefinition.bpmnXml}
                      onChange={(e) => setSelectedDefinition({ ...selectedDefinition, bpmnXml: e.target.value })}
                      rows={20}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-xs"
                    />
                  </div>
                  <button
                    onClick={() => handleUpdate(selectedDefinition.id!, { bpmnXml: selectedDefinition.bpmnXml })}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors flex items-center gap-2"
                  >
                    <Save size={16} /> Save Changes
                  </button>
                </div>
              ) : (
                <div className="bg-slate-50 rounded-lg p-6 border border-slate-200">
                  <div className="flex items-center justify-center py-12">
                    <div className="text-center">
                      <Workflow size={48} className="mx-auto mb-4 text-slate-400" />
                      <p className="text-slate-600 font-medium">BPMN Visual Editor</p>
                      <p className="text-sm text-slate-500 mt-1">
                        Click "Edit" to modify the BPMN XML. For visual editing, integrate a BPMN editor library like bpmn-js.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-lg border border-slate-200 p-12 text-center">
              <Workflow size={48} className="mx-auto mb-4 text-slate-400" />
              <p className="text-slate-600 font-medium">No workflow selected</p>
              <p className="text-sm text-slate-500 mt-1">
                Select a workflow from the list or create a new one
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-slate-800 mb-4">Create Workflow</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Name
                </label>
                <input
                  type="text"
                  value={newDefinition.name}
                  onChange={(e) => setNewDefinition({ ...newDefinition, name: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Description
                </label>
                <textarea
                  value={newDefinition.description}
                  onChange={(e) => setNewDefinition({ ...newDefinition, description: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  BPMN XML
                </label>
                <textarea
                  value={newDefinition.bpmnXml}
                  onChange={(e) => setNewDefinition({ ...newDefinition, bpmnXml: e.target.value })}
                  rows={15}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-xs"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleCreate}
                  disabled={!newDefinition.name}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  Create
                </button>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg font-semibold hover:bg-slate-200 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkflowDesigner;
















