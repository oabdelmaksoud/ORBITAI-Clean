import React, { useState, useEffect } from 'react';
import { Clock, RotateCcw, Copy, Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import { getPageRevisions, rollbackToRevision, PageRevision } from '@src/services/pageBuilderApi';
import { usePageBuilder } from '@src/contexts/PageBuilderContext';

interface RevisionTimelineProps {
  token: string;
  pageKey: string;
}

export function RevisionTimeline({ token, pageKey }: RevisionTimelineProps) {
  const { setPage } = usePageBuilder();
  const [revisions, setRevisions] = useState<PageRevision[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [selectedRevision, setSelectedRevision] = useState<PageRevision | null>(null);
  const [showRollbackConfirm, setShowRollbackConfirm] = useState<string | null>(null);

  useEffect(() => {
    loadRevisions();
  }, [pageKey]);

  const loadRevisions = async () => {
    try {
      setLoading(true);
      const { revisions: revisionsList } = await getPageRevisions(token, pageKey, 50);
      setRevisions(revisionsList);
    } catch (err: any) {
      setError(err.message || 'Failed to load revisions');
    } finally {
      setLoading(false);
    }
  };

  const handleRollback = async (revisionId: string) => {
    try {
      const { page } = await rollbackToRevision(token, pageKey, revisionId);
      setPage(page);
      setShowRollbackConfirm(null);
      setSuccess('Page rolled back successfully!');
      setTimeout(() => setSuccess(null), 3000);
      loadRevisions();
    } catch (err: any) {
      setError(err.message || 'Failed to rollback page');
      setTimeout(() => setError(null), 5000);
    }
  };

  const formatDate = (date: Date | string) => {
    const d = new Date(date);
    return d.toLocaleString();
  };

  const getStatusBadge = (status: string) => {
    const badges = {
      published: 'bg-green-100 text-green-700',
      draft: 'bg-slate-100 text-slate-700',
      archived: 'bg-red-100 text-red-700'
    };
    return badges[status as keyof typeof badges] || badges.draft;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="animate-spin text-blue-600" size={32} />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white">
      <div className="border-b border-slate-200 p-4 flex items-center justify-between">
        <h3 className="font-bold text-slate-800 flex items-center gap-2">
          <Clock size={20} />
          Revision History
        </h3>
        <button
          onClick={loadRevisions}
          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm font-medium"
        >
          Refresh
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-4 flex items-center gap-2">
          <AlertCircle size={18} />
          {error}
        </div>
      )}
      {success && (
        <div className="bg-emerald-50 border-l-4 border-emerald-500 text-emerald-700 p-4 flex items-center gap-2">
          <CheckCircle size={18} />
          {success}
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-6">
        {revisions.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <Clock size={48} className="mx-auto mb-4 opacity-50" />
            <p>No revisions found</p>
          </div>
        ) : (
          <div className="space-y-4">
            {revisions.map((revision, index) => (
              <div
                key={revision.id}
                className={`border rounded-lg p-4 transition-colors ${
                  selectedRevision?.id === revision.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
                onClick={() => setSelectedRevision(revision)}
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-800">
                        Revision {revision.revisionNumber}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded ${getStatusBadge(revision.status)}`}>
                        {revision.status}
                      </span>
                      {revision.metadata.isAutoSave && (
                        <span className="text-xs text-slate-500">Auto-saved</span>
                      )}
                    </div>
                    <div className="text-sm text-slate-600 mt-1">
                      {formatDate(revision.metadata.createdAt)}
                    </div>
                    {revision.metadata.note && (
                      <div className="text-sm text-slate-500 mt-1 italic">
                        "{revision.metadata.note}"
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowRollbackConfirm(revision.id);
                      }}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Rollback to this revision"
                    >
                      <RotateCcw size={16} />
                    </button>
                  </div>
                </div>
                <div className="text-xs text-slate-500">
                  By {revision.metadata.createdBy}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Rollback Confirmation Modal */}
      {showRollbackConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-bold mb-4">Rollback to Revision?</h3>
            <p className="text-slate-600 mb-4">
              This will restore the page to this revision. A new revision will be created with the current state.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowRollbackConfirm(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={() => handleRollback(showRollbackConfirm)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium"
              >
                Rollback
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}




