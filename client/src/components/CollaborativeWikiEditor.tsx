import React, { useState, useEffect } from 'react';
import { showAlert, showConfirm } from '../utils/browserUtils';
import {
  FileText, Plus, Save, Trash2, Edit, Eye, Loader2,
  AlertCircle, Users, MessageSquare, Tag, Search, Filter
} from 'lucide-react';
import {
  getDocuments,
  createDocument,
  updateDocument,
  deleteDocument,
  getDocument,
  CollaborativeDocument
} from '../services/collaborativeWikiApi';

interface CollaborativeWikiEditorProps {
  token: string;
}

const CollaborativeWikiEditor: React.FC<CollaborativeWikiEditorProps> = ({ token }) => {
  const [documents, setDocuments] = useState<CollaborativeDocument[]>([]);
  const [selectedDocument, setSelectedDocument] = useState<CollaborativeDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editing, setEditing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [newDocument, setNewDocument] = useState({
    title: '',
    content: '',
    category: '',
    tags: [] as string[],
    status: 'draft' as 'draft' | 'published' | 'archived'
  });

  useEffect(() => {
    loadDocuments();
  }, [token, statusFilter, searchQuery]);

  const loadDocuments = async () => {
    setLoading(true);
    setError(null);
    try {
      const filters: any = {};
      if (statusFilter !== 'all') filters.status = statusFilter;
      if (searchQuery) filters.search = searchQuery;
      const data = await getDocuments(token, filters);
      setDocuments(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load documents');
      console.error('Failed to load documents:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectDocument = async (id: string) => {
    try {
      const doc = await getDocument(token, id);
      setSelectedDocument(doc);
      setEditing(false);
    } catch (err: any) {
      setError(err.message || 'Failed to load document');
    }
  };

  const handleCreate = async () => {
    try {
      await createDocument(token, newDocument);
      setShowCreateModal(false);
      setNewDocument({
        title: '',
        content: '',
        category: '',
        tags: [],
        status: 'draft'
      });
      await loadDocuments();
    } catch (err: any) {
      setError(err.message || 'Failed to create document');
    }
  };

  const handleUpdate = async () => {
    if (!selectedDocument?.id) return;
    try {
      await updateDocument(token, selectedDocument.id, {
        title: selectedDocument.title,
        content: selectedDocument.content,
        category: selectedDocument.category,
        tags: selectedDocument.tags,
        status: selectedDocument.status
      });
      setEditing(false);
      await loadDocuments();
    } catch (err: any) {
      setError(err.message || 'Failed to update document');
    }
  };

  const handleDelete = async (id: string) => {
    if (!(await showConfirm('Are you sure you want to delete this document?'))) return;
    try {
      await deleteDocument(token, id);
      if (selectedDocument?.id === id) {
        setSelectedDocument(null);
      }
      await loadDocuments();
    } catch (err: any) {
      setError(err.message || 'Failed to delete document');
    }
  };

  if (loading && documents.length === 0) {
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
          <h2 className="text-2xl font-bold text-slate-800">Collaborative Wiki</h2>
          <p className="text-sm text-slate-500 mt-1">
            Create and manage collaborative documents
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors flex items-center gap-2"
        >
          <Plus size={16} /> New Document
        </button>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-yellow-700 text-sm">{error}</p>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg border border-slate-200 p-4">
        <div className="flex gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search documents..."
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Status</option>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="archived">Archived</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Documents List */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <h3 className="font-bold text-slate-800 mb-4">Documents ({documents.length})</h3>
            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  onClick={() => handleSelectDocument(doc.id!)}
                  className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedDocument?.id === doc.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="font-semibold text-slate-800">{doc.title}</h4>
                      <p className="text-xs text-slate-500 mt-1 line-clamp-2">{doc.content.substring(0, 100)}...</p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className={`px-2 py-1 text-xs rounded ${
                          doc.status === 'published' ? 'bg-green-100 text-green-700' :
                          doc.status === 'draft' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-slate-100 text-slate-700'
                        }`}>
                          {doc.status}
                        </span>
                        {doc.category && (
                          <span className="text-xs text-slate-500">{doc.category}</span>
                        )}
                      </div>
                      {doc.statistics && (
                        <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                          <span>{doc.statistics.views} views</span>
                          <span>{doc.statistics.edits} edits</span>
                        </div>
                      )}
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(doc.id!);
                      }}
                      className="p-1 text-red-600 hover:bg-red-50 rounded ml-2"
                      title="Delete"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
              {documents.length === 0 && (
                <p className="text-sm text-slate-500 text-center py-8">No documents found</p>
              )}
            </div>
          </div>
        </div>

        {/* Document Editor */}
        <div className="lg:col-span-2">
          {selectedDocument ? (
            <div className="bg-white rounded-lg border border-slate-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex-1">
                  {editing ? (
                    <input
                      type="text"
                      value={selectedDocument.title}
                      onChange={(e) => setSelectedDocument({ ...selectedDocument, title: e.target.value })}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold text-lg"
                    />
                  ) : (
                    <h3 className="text-lg font-bold text-slate-800">{selectedDocument.title}</h3>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      if (editing) {
                        handleUpdate();
                      } else {
                        setEditing(true);
                      }
                    }}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors flex items-center gap-2"
                  >
                    {editing ? <Save size={16} /> : <Edit size={16} />}
                    {editing ? 'Save' : 'Edit'}
                  </button>
                </div>
              </div>

              {editing ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Category
                    </label>
                    <input
                      type="text"
                      value={selectedDocument.category}
                      onChange={(e) => setSelectedDocument({ ...selectedDocument, category: e.target.value })}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Content (Markdown)
                    </label>
                    <textarea
                      value={selectedDocument.content}
                      onChange={(e) => setSelectedDocument({ ...selectedDocument, content: e.target.value })}
                      rows={20}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Status
                    </label>
                    <select
                      value={selectedDocument.status}
                      onChange={(e) => setSelectedDocument({ ...selectedDocument, status: e.target.value as any })}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="draft">Draft</option>
                      <option value="published">Published</option>
                      <option value="archived">Archived</option>
                    </select>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="prose max-w-none">
                    <pre className="whitespace-pre-wrap bg-slate-50 p-4 rounded-lg border border-slate-200">
                      {selectedDocument.content}
                    </pre>
                  </div>
                  {selectedDocument.tags && selectedDocument.tags.length > 0 && (
                    <div className="flex items-center gap-2">
                      <Tag size={16} className="text-slate-400" />
                      {selectedDocument.tags.map((tag, idx) => (
                        <span key={idx} className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-lg border border-slate-200 p-12 text-center">
              <FileText size={48} className="mx-auto mb-4 text-slate-400" />
              <p className="text-slate-600 font-medium">No document selected</p>
              <p className="text-sm text-slate-500 mt-1">
                Select a document from the list or create a new one
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-slate-800 mb-4">Create Document</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Title
                </label>
                <input
                  type="text"
                  value={newDocument.title}
                  onChange={(e) => setNewDocument({ ...newDocument, title: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Category
                </label>
                <input
                  type="text"
                  value={newDocument.category}
                  onChange={(e) => setNewDocument({ ...newDocument, category: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Content (Markdown)
                </label>
                <textarea
                  value={newDocument.content}
                  onChange={(e) => setNewDocument({ ...newDocument, content: e.target.value })}
                  rows={15}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleCreate}
                  disabled={!newDocument.title}
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

export default CollaborativeWikiEditor;
















