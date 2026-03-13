/**
 * Content Moderation Component
 * Admin interface for moderating content (projects, artifacts, users, comments, templates)
 */

import React, { useState, useEffect } from 'react';
import {
  Shield, CheckCircle, XCircle, Flag, AlertTriangle, RefreshCw,
  Filter, Search, MoreVertical, Eye, Clock, User, FileText, Folder, MessageSquare,
  CheckSquare, X, Loader2
} from 'lucide-react';
import {
  getPendingModeration,
  approveContent,
  rejectContent,
  flagContent,
  bulkModerationAction,
  getModerationStats,
  ModerationItem,
  ModerationStats
} from '../services/adminModerationApi';

interface ContentModerationProps {
  token?: string;
}

const ContentModeration: React.FC<ContentModerationProps> = ({ token }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<ModerationStats | null>(null);
  const [items, setItems] = useState<ModerationItem[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    pages: 0
  });

  // Filters
  const [statusFilter, setStatusFilter] = useState<'pending' | 'approved' | 'rejected' | 'flagged' | 'all'>('pending');
  const [entityTypeFilter, setEntityTypeFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Selection
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Modals
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectingItemId, setRejectingItemId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [statusFilter, entityTypeFilter, pagination.page]);

  const loadData = async () => {
    if (!token) return;

    try {
      setLoading(true);
      setError(null);

      const [statsData, itemsData] = await Promise.all([
        getModerationStats(token),
        getPendingModeration(token, {
          page: pagination.page,
          limit: pagination.limit,
          entityType: entityTypeFilter !== 'all' ? entityTypeFilter : undefined,
          status: statusFilter !== 'all' ? statusFilter : undefined
        })
      ]);

      setStats(statsData);
      setItems(itemsData.items);
      setPagination(itemsData.pagination);
    } catch (err: any) {
      setError(err.message || 'Failed to load moderation data');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (itemId: string) => {
    if (!token) return;

    try {
      setActionLoading(itemId);
      await approveContent(token, itemId);
      await loadData();
      setSelectedItems(prev => {
        const next = new Set(prev);
        next.delete(itemId);
        return next;
      });
    } catch (err: any) {
      setError(err.message || 'Failed to approve content');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (itemId: string, reason: string) => {
    if (!token || !reason.trim()) return;

    try {
      setActionLoading(itemId);
      await rejectContent(token, itemId, reason);
      setShowRejectModal(false);
      setRejectReason('');
      setRejectingItemId(null);
      await loadData();
      setSelectedItems(prev => {
        const next = new Set(prev);
        next.delete(itemId);
        return next;
      });
    } catch (err: any) {
      setError(err.message || 'Failed to reject content');
    } finally {
      setActionLoading(null);
    }
  };

  const handleBulkAction = async (action: 'approve' | 'reject') => {
    if (!token || selectedItems.size === 0) return;

    try {
      setActionLoading('bulk');
      const reason = action === 'reject' ? prompt('Rejection reason:') : undefined;
      if (action === 'reject' && !reason) {
        setActionLoading(null);
        return;
      }

      await bulkModerationAction(token, {
        action,
        itemIds: Array.from(selectedItems),
        reason
      });

      setSelectedItems(new Set());
      await loadData();
    } catch (err: any) {
      setError(err.message || `Failed to ${action} items`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleSelectAll = () => {
    if (selectedItems.size === items.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(items.map(item => item._id)));
    }
  };

  const toggleSelect = (itemId: string) => {
    setSelectedItems(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  };

  const getEntityIcon = (entityType: string) => {
    switch (entityType) {
      case 'project':
        return <Folder className="w-4 h-4" />;
      case 'artifact':
        return <FileText className="w-4 h-4" />;
      case 'user':
        return <User className="w-4 h-4" />;
      case 'comment':
        return <MessageSquare className="w-4 h-4" />;
      case 'template':
        return <FileText className="w-4 h-4" />;
      default:
        return <FileText className="w-4 h-4" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      pending: 'bg-yellow-100 text-yellow-100 text-yellow-800',
      approved: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
      flagged: 'bg-orange-100 text-orange-800'
    };

    return (
      <span className={`px-2 py-1 rounded text-xs font-medium ${styles[status as keyof typeof styles] || styles.pending}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const filteredItems = items.filter(item => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      item.entityId.toLowerCase().includes(search) ||
      item.entityType.toLowerCase().includes(search) ||
      item.flaggedReason?.toLowerCase().includes(search) ||
      item.rejectionReason?.toLowerCase().includes(search)
    );
  });

  if (loading && !stats) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Content Moderation</h2>
          <p className="text-sm text-gray-600 mt-1">
            Review and moderate user-generated content
          </p>
        </div>
        <button
          onClick={loadData}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-red-800">Error</p>
            <p className="text-sm text-red-700 mt-1">{error}</p>
          </div>
          <button onClick={() => setError(null)} className="text-red-600 hover:text-red-800">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Pending</p>
                <p className="text-2xl font-bold text-yellow-600">{stats.totals.pending}</p>
              </div>
              <Clock className="w-8 h-8 text-yellow-500" />
            </div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Flagged</p>
                <p className="text-2xl font-bold text-orange-600">{stats.totals.flagged}</p>
              </div>
              <Flag className="w-8 h-8 text-orange-500" />
            </div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Approved</p>
                <p className="text-2xl font-bold text-green-600">{stats.totals.approved}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-500" />
            </div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Rejected</p>
                <p className="text-2xl font-bold text-red-600">{stats.totals.rejected}</p>
              </div>
              <XCircle className="w-8 h-8 text-red-500" />
            </div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totals.total}</p>
              </div>
              <Shield className="w-8 h-8 text-gray-500" />
            </div>
          </div>
        </div>
      )}

      {/* Filters and Actions */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by ID, type, or reason..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as any);
              setPagination(prev => ({ ...prev, page: 1 }));
            }}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="flagged">Flagged</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>

          {/* Entity Type Filter */}
          <select
            value={entityTypeFilter}
            onChange={(e) => {
              setEntityTypeFilter(e.target.value);
              setPagination(prev => ({ ...prev, page: 1 }));
            }}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">All Types</option>
            <option value="project">Projects</option>
            <option value="artifact">Artifacts</option>
            <option value="user">Users</option>
            <option value="comment">Comments</option>
            <option value="template">Templates</option>
          </select>
        </div>

        {/* Bulk Actions */}
        {selectedItems.size > 0 && (
          <div className="mt-4 flex items-center gap-2 pt-4 border-t border-gray-200">
            <span className="text-sm text-gray-700">
              {selectedItems.size} item{selectedItems.size !== 1 ? 's' : ''} selected
            </span>
            <button
              onClick={() => handleBulkAction('approve')}
              disabled={actionLoading === 'bulk'}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              {actionLoading === 'bulk' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle className="w-4 h-4" />
              )}
              Approve Selected
            </button>
            <button
              onClick={() => handleBulkAction('reject')}
              disabled={actionLoading === 'bulk'}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
            >
              {actionLoading === 'bulk' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <XCircle className="w-4 h-4" />
              )}
              Reject Selected
            </button>
            <button
              onClick={() => setSelectedItems(new Set())}
              className="px-4 py-2 text-sm text-gray-700 hover:text-gray-900"
            >
              Clear Selection
            </button>
          </div>
        )}
      </div>

      {/* Items List */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={selectedItems.size === items.length && items.length > 0}
                    onChange={handleSelectAll}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                  Entity ID
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                  Reason
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                  Created
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-gray-500">
                    <Shield className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                    <p>No moderation items found</p>
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => (
                  <tr key={item._id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedItems.has(item._id)}
                        onChange={() => toggleSelect(item._id)}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {getEntityIcon(item.entityType)}
                        <span className="text-sm font-medium text-gray-900 capitalize">
                          {item.entityType}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <code className="text-xs bg-gray-100 px-2 py-1 rounded text-gray-800">
                        {item.entityId.substring(0, 20)}...
                      </code>
                    </td>
                    <td className="px-4 py-3">
                      {getStatusBadge(item.status)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-gray-600 max-w-xs truncate">
                        {item.flaggedReason || item.rejectionReason || '-'}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-gray-600">
                        {new Date(item.createdAt).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {item.status === 'pending' || item.status === 'flagged' ? (
                          <>
                            <button
                              onClick={() => handleApprove(item._id)}
                              disabled={actionLoading === item._id}
                              className="p-2 text-green-600 hover:bg-green-50 rounded disabled:opacity-50"
                              title="Approve"
                            >
                              {actionLoading === item._id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <CheckCircle className="w-4 h-4" />
                              )}
                            </button>
                            <button
                              onClick={() => {
                                setRejectingItemId(item._id);
                                setShowRejectModal(true);
                              }}
                              disabled={actionLoading === item._id}
                              className="p-2 text-red-600 hover:bg-red-50 rounded disabled:opacity-50"
                              title="Reject"
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                          </>
                        ) : (
                          <span className="text-xs text-gray-400">
                            {item.reviewedAt
                              ? `Reviewed ${new Date(item.reviewedAt).toLocaleDateString()}`
                              : 'N/A'}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between">
            <div className="text-sm text-gray-700">
              Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
              {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
              {pagination.total} items
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                disabled={pagination.page === 1}
                className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <button
                onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                disabled={pagination.page === pagination.pages}
                className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Reject Content</h3>
            <p className="text-sm text-gray-600 mb-4">
              Please provide a reason for rejecting this content:
            </p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Enter rejection reason..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 mb-4"
              rows={4}
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectReason('');
                  setRejectingItemId(null);
                }}
                className="px-4 py-2 text-sm text-gray-700 hover:text-gray-900"
              >
                Cancel
              </button>
              <button
                onClick={() => rejectingItemId && handleReject(rejectingItemId, rejectReason)}
                disabled={!rejectReason.trim() || actionLoading === rejectingItemId}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {actionLoading === rejectingItemId ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  'Reject'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ContentModeration;

