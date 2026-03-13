import React, { useState, useEffect } from 'react';
import { showAlert, showConfirm } from '../utils/browserUtils';
import {
  BookOpen, FileText, CheckSquare, Workflow, Shield, AlertCircle,
  Plus, Edit, Trash2, Search, Filter, Save, X, CheckCircle, XCircle,
  TrendingUp, Eye, EyeOff, Star, Clock, Users, Tag, Loader2,
  ChevronDown, ChevronRight, RefreshCw, Download, Upload, Archive, Brain
} from 'lucide-react';
import {
  getProcessImprovements,
  createProcessImprovement,
  updateProcessImprovement,
  deleteProcessImprovement,
  approveProcessImprovement,
  rejectProcessImprovement,
  assessAllPendingImprovements,
  assessProcessImprovement,
  getStuckImprovements,
  cleanupStuckImprovements,
  ProcessImprovement
} from '../services/processImprovementApi';

interface ProcessImprovementManagerProps {
  token: string;
}

const CATEGORY_ICONS: Record<string, any> = {
  'guideline': FileText,
  'template': FileText,
  'best-practice': Star,
  'workflow': Workflow,
  'checklist': CheckSquare,
  'standard': Shield
};

const CATEGORY_COLORS: Record<string, string> = {
  'guideline': 'bg-blue-50 text-blue-700 border-blue-200',
  'template': 'bg-purple-50 text-purple-700 border-purple-200',
  'best-practice': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'workflow': 'bg-orange-50 text-orange-700 border-orange-200',
  'checklist': 'bg-cyan-50 text-cyan-700 border-cyan-200',
  'standard': 'bg-red-50 text-red-700 border-red-200'
};

const STATUS_COLORS: Record<string, string> = {
  'draft': 'bg-slate-100 text-slate-700',
  'active': 'bg-green-100 text-green-700',
  'deprecated': 'bg-yellow-100 text-yellow-700',
  'archived': 'bg-gray-100 text-gray-700'
};

const ProcessImprovementManager: React.FC<ProcessImprovementManagerProps> = ({ token }) => {
  // Knowledge Base view has been moved to a separate tab in ProcessManagementTab
  const [improvements, setImprovements] = useState<ProcessImprovement[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  
  // Editing state
  const [editingItem, setEditingItem] = useState<ProcessImprovement | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [viewingItem, setViewingItem] = useState<ProcessImprovement | null>(null);
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const itemsPerPage = 20;

  useEffect(() => {
    loadData();
  }, [currentPage, selectedCategory, selectedStatus, selectedType, searchTerm]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getProcessImprovements(token, {
        search: searchTerm || undefined,
        category: selectedCategory !== 'all' ? selectedCategory : undefined,
        type: selectedType !== 'all' ? selectedType : undefined,
        status: selectedStatus !== 'all' ? selectedStatus : undefined,
        limit: itemsPerPage,
        offset: (currentPage - 1) * itemsPerPage
      });
      setImprovements(response.improvements);
      setTotalItems(response.total);
      setTotalPages(Math.ceil(response.total / itemsPerPage));
    } catch (err: any) {
      // Don't show "Process improvement not found" error if it's a 404 for a list request
      // This error typically occurs when trying to fetch a specific item that doesn't exist
      const errorMessage = err.message || 'Failed to load data';
      if (errorMessage.includes('not found') && !errorMessage.includes('Process improvement not found')) {
        // This is likely a different error, show it
        setError(errorMessage);
      } else if (!errorMessage.includes('Process improvement not found')) {
        // Only show errors that aren't the generic "not found" message
        setError(errorMessage);
      }
      console.error('Failed to load:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (data: any) => {
    setLoading(true);
    setError(null);
    try {
      await createProcessImprovement(token, data);
      setSuccess('Process improvement created successfully');
      setShowCreateModal(false);
      await loadData();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to create');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (id: string, updates: any, changeReason?: string) => {
    setLoading(true);
    setError(null);
    try {
      await updateProcessImprovement(token, id, updates, changeReason);
      setSuccess('Process improvement updated successfully');
      setShowEditModal(false);
      setEditingItem(null);
      await loadData();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to update');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!(await showConfirm('Are you sure you want to archive this item?'))) return;
    setLoading(true);
    setError(null);
    try {
      await deleteProcessImprovement(token, id);
      setSuccess('Process improvement archived');
      await loadData();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to delete');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id: string) => {
    setLoading(true);
    try {
      await approveProcessImprovement(token, id);
      setSuccess('Item approved successfully');
      await loadData();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to approve');
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async (id: string, reason?: string) => {
    setLoading(true);
    try {
      await rejectProcessImprovement(token, id, reason);
      setSuccess('Item rejected');
      await loadData();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to reject');
    } finally {
      setLoading(false);
    }
  };

  const filteredItems = improvements;

  if (loading && improvements.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="animate-spin text-blue-600" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Process Improvements</h2>
          <p className="text-sm text-slate-500 mt-1">
            Manage guidelines, templates, and best practices
          </p>
        </div>
      </div>

      {/* Success/Error Messages */}
      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-green-700">
            <CheckCircle size={20} />
            <span className="font-medium">{success}</span>
          </div>
          <button onClick={() => setSuccess(null)} className="text-green-600 hover:text-green-800">
            <X size={16} />
          </button>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-red-700">
            <AlertCircle size={20} />
            <span className="font-medium">{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-red-600 hover:text-red-800">
            <X size={16} />
          </button>
        </div>
      )}

      {/* Filters and Search */}
      <div className="bg-white rounded-lg border border-slate-200 p-4 space-y-4">
        <div className="flex gap-4 flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          
          <select
            value={selectedCategory}
            onChange={(e) => {
              setSelectedCategory(e.target.value);
              setCurrentPage(1);
            }}
            className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Categories</option>
            <option value="guideline">Guidelines</option>
            <option value="template">Templates</option>
            <option value="best-practice">Best Practices</option>
            <option value="workflow">Workflows</option>
            <option value="checklist">Checklists</option>
            <option value="standard">Standards</option>
          </select>
          
          <select
            value={selectedType}
            onChange={(e) => {
              setSelectedType(e.target.value);
              setCurrentPage(1);
            }}
            className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Types</option>
            <option value="process">Process</option>
            <option value="technical">Technical</option>
            <option value="quality">Quality</option>
            <option value="security">Security</option>
            <option value="compliance">Compliance</option>
            <option value="general">General</option>
          </select>
          
          <select
            value={selectedStatus}
            onChange={(e) => {
              setSelectedStatus(e.target.value);
              setCurrentPage(1);
            }}
            className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Status</option>
            <option value="draft">Draft</option>
            <option value="active">Active</option>
            <option value="deprecated">Deprecated</option>
            <option value="archived">Archived</option>
          </select>
          
          <button
            onClick={async () => {
              try {
                setLoading(true);
                await assessAllPendingImprovements(token);
                setSuccess('Agent assessment initiated for all pending improvements. This will run in the background.');
                setTimeout(() => {
                  setSuccess(null);
                  loadData();
                }, 3000);
              } catch (err: any) {
                setError(err.message || 'Failed to trigger assessment');
              } finally {
                setLoading(false);
              }
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors flex items-center gap-2"
            title="Trigger agent assessment for all pending improvements"
          >
            <Brain size={16} /> Assess Pending
          </button>
          <button
            onClick={async () => {
              try {
                setLoading(true);
                // First check for stuck improvements
                const stuck = await getStuckImprovements(token, 5);
                if (stuck.count === 0) {
                  setSuccess('No stuck improvements found.');
                  setTimeout(() => setSuccess(null), 3000);
                  return;
                }
                
                if (!(await showConfirm(`Found ${stuck.count} stuck improvements. Clean them up?`))) {
                  return;
                }
                
                const result = await cleanupStuckImprovements(token, 5);
                setSuccess(`Cleaned up ${result.cleaned} stuck improvements.`);
                await loadData();
                setTimeout(() => setSuccess(null), 3000);
              } catch (err: any) {
                setError(err.message || 'Failed to cleanup stuck improvements');
              } finally {
                setLoading(false);
              }
            }}
            className="px-4 py-2 bg-amber-600 text-white rounded-lg font-semibold hover:bg-amber-700 transition-colors flex items-center gap-2"
            title="Clean up stuck improvements that are in agent-assessing or agent-refining status"
          >
            <RefreshCw size={16} /> Cleanup Stuck
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-slate-600 text-white rounded-lg font-semibold hover:bg-slate-700 transition-colors flex items-center gap-2"
          >
            <Plus size={16} /> Create New
          </button>
        </div>
      </div>

      {/* Items List */}
      <div className="bg-white rounded-lg border border-slate-200">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="animate-spin text-blue-600" size={24} />
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="p-8 text-center text-slate-400">
            <BookOpen size={48} className="mx-auto mb-4 opacity-50" />
            <p>No items found. Create your first process improvement!</p>
          </div>
        ) : (
          <>
            <div className="divide-y divide-slate-200">
              {filteredItems.map((item) => {
                const CategoryIcon = CATEGORY_ICONS[(item as ProcessImprovement).category] || FileText;
                const categoryColor = CATEGORY_COLORS[(item as ProcessImprovement).category] || 'bg-slate-50 text-slate-700';
                
                return (
                  <div key={item.id} className="p-4 hover:bg-slate-50 transition-colors">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2">
                          <div className={`p-2 rounded-lg ${categoryColor} border`}>
                            <CategoryIcon size={18} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-slate-800 truncate">
                              {(item as ProcessImprovement).title}
                            </h3>
                            <p className="text-sm text-slate-500 line-clamp-2 mt-1">
                              {item.description}
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-4 flex-wrap mt-3">
                          <span className={`px-2 py-1 rounded text-xs font-semibold ${STATUS_COLORS[item.status]}`}>
                            {item.status}
                          </span>
                          <span className="text-xs text-slate-500 flex items-center gap-1">
                            <Tag size={12} />
                            {(item as ProcessImprovement).category}
                          </span>
                          <span className="text-xs text-slate-500 flex items-center gap-1">
                            <TrendingUp size={12} />
                            Used {(item as ProcessImprovement).usage.timesUsed} times
                          </span>
                          {item.autoGenerated && (
                            <span className="text-xs text-blue-600 font-semibold">
                              Auto-generated
                            </span>
                          )}
                          {item.approval?.status === 'agent-assessing' && (
                            <span className="text-xs text-blue-600 font-semibold flex items-center gap-1">
                              <Loader2 size={12} className="animate-spin" />
                              Agent Assessing...
                            </span>
                          )}
                          {item.approval?.status === 'agent-refining' && (
                            <span className="text-xs text-purple-600 font-semibold flex items-center gap-1">
                              <Loader2 size={12} className="animate-spin" />
                              Agent Refining...
                            </span>
                          )}
                          {item.approval?.status === 'pending' && (
                            <span className="text-xs text-yellow-600 font-semibold">
                              Pending Review
                            </span>
                          )}
                          {item.approval?.status === 'approved' && item.approval.approvedBy === 'agent' && (
                            <span className="text-xs text-green-600 font-semibold">
                              Approved by Agent
                            </span>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setViewingItem(item)}
                          className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="View Details"
                        >
                          <Eye size={16} />
                        </button>
                        <button
                          onClick={() => {
                            setEditingItem(item);
                            setShowEditModal(true);
                          }}
                          className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Edit size={16} />
                        </button>
                        {/* Agent assessment status - no manual approval buttons needed */}
                        {item.approval?.status === 'agent-assessing' && (
                          <div className="px-3 py-1 bg-blue-50 text-blue-600 rounded-lg text-xs font-medium flex items-center gap-1">
                            <Loader2 size={12} className="animate-spin" />
                            Agent assessing...
                          </div>
                        )}
                        {item.approval?.status === 'agent-refining' && (
                          <div className="px-3 py-1 bg-purple-50 text-purple-600 rounded-lg text-xs font-medium flex items-center gap-1">
                            <Loader2 size={12} className="animate-spin" />
                            Agent refining...
                          </div>
                        )}
                        {/* Show trigger assessment button for pending improvements */}
                        {item.approval?.status === 'pending' && (
                          <button
                            onClick={async () => {
                              try {
                                setLoading(true);
                                await assessProcessImprovement(token, item.id);
                                setSuccess('Agent assessment initiated for this improvement');
                                setTimeout(() => {
                                  setSuccess(null);
                                  loadData();
                                }, 2000);
                              } catch (err: any) {
                                setError(err.message || 'Failed to trigger assessment');
                              } finally {
                                setLoading(false);
                              }
                            }}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Trigger Agent Assessment"
                          >
                            <Brain size={16} />
                          </button>
                        )}
                        {/* Only show manual approval for pending (non-agent) status - legacy support */}
                        {item.approval?.status === 'pending' && item.approval.approvedBy !== 'agent' && (
                          <>
                            <button
                              onClick={() => handleApprove(item.id)}
                              className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                              title="Approve (Manual)"
                            >
                              <CheckCircle size={16} />
                            </button>
                            <button
                              onClick={() => handleReject(item.id)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Reject"
                            >
                              <XCircle size={16} />
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Archive"
                        >
                          <Archive size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            
            {/* Pagination */}
            {totalPages > 1 && (
              <div className="p-4 border-t border-slate-200 flex items-center justify-between">
                <div className="text-sm text-slate-600">
                  Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, totalItems)} of {totalItems}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1 border border-slate-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1 border border-slate-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Create/Edit Modals would go here - simplified for now */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
            <h3 className="text-xl font-bold mb-4">Create New Process Improvement</h3>
            <p className="text-sm text-slate-500 mb-4">
              Full create/edit form would be implemented here with all fields
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  // Handle create with form data
                  setShowCreateModal(false);
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Modal */}
      {viewingItem && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-xl font-bold">
                {(viewingItem as ProcessImprovement).title}
              </h3>
              <button
                onClick={() => setViewingItem(null)}
                className="p-2 hover:bg-slate-100 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>
            <div className="prose max-w-none">
              <div className="mb-4">
                <p className="text-slate-600">{viewingItem.description}</p>
              </div>
              
              {/* Agent Assessment Info */}
              {(viewingItem as ProcessImprovement).approval?.agentAssessment && (
                <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <h4 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
                    <Brain size={16} />
                    Agent Assessment
                  </h4>
                  <div className="text-sm text-blue-800 space-y-1">
                    <p><strong>Decision:</strong> {(viewingItem as ProcessImprovement).approval?.agentAssessment?.decision === 'approve' ? 'Approved' : 'Refined & Approved'}</p>
                    <p><strong>Confidence:</strong> {(viewingItem as ProcessImprovement).approval?.agentAssessment?.confidence}%</p>
                    <p><strong>Reasoning:</strong></p>
                    <p className="text-blue-700 pl-4">{(viewingItem as ProcessImprovement).approval?.agentAssessment?.reasoning}</p>
                    {(viewingItem as ProcessImprovement).approval?.agentAssessment?.assessedAt && (
                      <p className="text-xs text-blue-600 mt-2">
                        Assessed: {new Date((viewingItem as ProcessImprovement).approval!.agentAssessment!.assessedAt).toLocaleString()}
                      </p>
                    )}
                  </div>
                </div>
              )}
              
              <div className="border-t border-slate-200 pt-4">
                <div className="text-sm text-slate-500 whitespace-pre-wrap">
                  {(viewingItem as ProcessImprovement).content}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProcessImprovementManager;




