import React, { useState, useEffect } from 'react';
import { Database, Download, Trash2, CheckCircle, XCircle, Clock, Loader2, Plus, Shield, X } from 'lucide-react';
import { getBackups, createBackup, verifyBackup, restoreBackup, deleteBackup, DatabaseBackup } from '../services/backupApi';

import { showAlert, showConfirm } from '../utils/browserUtils';
interface BackupManagementProps {
  token: string;
}

const BackupManagement: React.FC<BackupManagementProps> = ({ token }) => {
  const [backups, setBackups] = useState<DatabaseBackup[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [backupOptions, setBackupOptions] = useState({
    collections: [] as string[],
    retentionDays: 30
  });
  const [restoreBackupId, setRestoreBackupId] = useState<string | null>(null);
  const [restoreOptions, setRestoreOptions] = useState({ clearExisting: false });

  useEffect(() => {
    loadBackups();
    const interval = setInterval(loadBackups, 10000); // Refresh every 10 seconds
    return () => clearInterval(interval);
  }, []);

  const loadBackups = async () => {
    if (!token) return;
    try {
      const data = await getBackups(token);
      setBackups(data);
    } catch (err: any) {
      console.error('Failed to load backups:', err);
    }
  };

  const handleCreateBackup = async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      await createBackup(token, backupOptions);
      setShowCreateModal(false);
      setBackupOptions({ collections: [], retentionDays: 30 });
      await loadBackups();
    } catch (err: any) {
      setError(err.message || 'Failed to create backup');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyBackup = async (backupId: string) => {
    if (!token) return;
    try {
      await verifyBackup(token, backupId);
      await loadBackups();
    } catch (err: any) {
      setError(err.message || 'Failed to verify backup');
    }
  };

  const handleRestoreBackup = async () => {
    if (!token || !restoreBackupId) return;
    if (!(await showConfirm('Are you sure you want to restore from this backup? This will overwrite current data.'))) return;
    
    setLoading(true);
    setError(null);
    try {
      await restoreBackup(token, restoreBackupId, restoreOptions);
      setRestoreBackupId(null);
      showAlert('Backup restored successfully');
    } catch (err: any) {
      setError(err.message || 'Failed to restore backup');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteBackup = async (backupId: string) => {
    if (!token) return;
    if (!(await showConfirm('Are you sure you want to delete this backup?'))) return;
    
    try {
      await deleteBackup(token, backupId);
      await loadBackups();
    } catch (err: any) {
      setError(err.message || 'Failed to delete backup');
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-emerald-600';
      case 'failed': return 'text-red-600';
      case 'in_progress': return 'text-blue-600';
      default: return 'text-slate-600';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Database Backup Management</h2>
          <p className="text-sm text-slate-500 mt-1">Create, verify, and restore database backups</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 transition-colors flex items-center gap-2"
        >
          <Plus size={16} /> Create Backup
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-slate-200">
          <h3 className="font-bold text-slate-800">Backup History</h3>
        </div>
        <div className="divide-y divide-slate-100">
          {backups.length === 0 ? (
            <div className="p-8 text-center">
              <Database size={48} className="mx-auto mb-4 text-slate-300" />
              <p className="text-slate-400 font-semibold mb-2">No backups found</p>
              <p className="text-xs text-slate-500 mb-4">Create your first backup to protect your data. Backups are essential for disaster recovery.</p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors"
              >
                Create Your First Backup
              </button>
            </div>
          ) : (
            backups.map((backup) => (
              <div key={backup.id} className="p-4 hover:bg-slate-50 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <Database size={20} className="text-blue-600" />
                      <span className="font-semibold text-slate-800">{backup.filename}</span>
                      <span className={`px-2 py-1 rounded text-xs font-bold ${getStatusColor(backup.status)}`}>
                        {backup.status.toUpperCase()}
                      </span>
                      {backup.verified && (
                        <span className="px-2 py-1 bg-emerald-100 text-emerald-700 text-xs font-bold rounded flex items-center gap-1">
                          <CheckCircle size={12} /> Verified
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-slate-600 space-y-1">
                      <div>Type: {backup.backupType}</div>
                      <div>Size: {formatFileSize(backup.fileSize)}</div>
                      {backup.collections.length > 0 && (
                        <div>Collections: {backup.collections.join(', ', 'error')}</div>
                      )}
                      <div className="text-xs text-slate-400">
                        Created: {new Date(backup.createdAt).toLocaleString()}
                        {backup.completedAt && ` • Completed: ${new Date(backup.completedAt).toLocaleString()}`}
                      </div>
                      {backup.error && (
                        <div className="text-red-600 text-xs">Error: {backup.error}</div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {backup.status === 'completed' && !backup.verified && (
                      <button
                        onClick={() => handleVerifyBackup(backup.id)}
                        className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition-colors flex items-center gap-1"
                      >
                        <Shield size={14} /> Verify
                      </button>
                    )}
                    {backup.status === 'completed' && (
                      <button
                        onClick={() => setRestoreBackupId(backup.id)}
                        className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 transition-colors flex items-center gap-1"
                      >
                        <Download size={14} /> Restore
                      </button>
                    )}
                    <button
                      onClick={() => handleDeleteBackup(backup.id)}
                      className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-bold hover:bg-red-700 transition-colors flex items-center gap-1"
                    >
                      <Trash2 size={14} /> Delete
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Create Backup Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-[200] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowCreateModal(false)}>
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-slate-200 flex justify-between items-center">
              <h2 className="text-xl font-bold text-slate-800">Create Backup</h2>
              <button onClick={() => setShowCreateModal(false)} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Retention Days</label>
                <input
                  type="number"
                  value={backupOptions.retentionDays}
                  onChange={(e) => setBackupOptions({ ...backupOptions, retentionDays: parseInt(e.target.value) || 30 })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  min="1"
                />
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-700">
                <strong>Note:</strong> Leave collections empty to backup all collections. Backup will be created in the background.
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg font-semibold hover:bg-slate-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateBackup}
                  disabled={loading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {loading ? <Loader2 size={16} className="animate-spin" /> : null}
                  Create Backup
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Restore Backup Modal */}
      {restoreBackupId && (
        <div className="fixed inset-0 z-[200] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setRestoreBackupId(null)}>
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-slate-200 flex justify-between items-center">
              <h2 className="text-xl font-bold text-slate-800">Restore Backup</h2>
              <button onClick={() => setRestoreBackupId(null)} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
                <strong>Warning:</strong> Restoring from backup will overwrite current data. This action cannot be undone.
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={restoreOptions.clearExisting}
                  onChange={(e) => setRestoreOptions({ clearExisting: e.target.checked })}
                  className="rounded"
                />
                <label className="text-sm text-slate-700">Clear existing data before restore</label>
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button
                  onClick={() => setRestoreBackupId(null)}
                  className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg font-semibold hover:bg-slate-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRestoreBackup}
                  disabled={loading}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {loading ? <Loader2 size={16} className="animate-spin" /> : null}
                  Restore Backup
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BackupManagement;

