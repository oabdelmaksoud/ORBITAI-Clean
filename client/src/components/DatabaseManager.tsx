/**
 * Database Manager Component
 * Admin interface for database management
 */

import React, { useState, useEffect } from 'react';
import { Database, Search, Trash2, Edit2, Download, RefreshCw, AlertTriangle, CheckCircle2 } from 'lucide-react';
import {
  getCollections,
  getCollectionStats,
  getCollectionSchema,
  executeQuery,
  updateRecords,
  deleteRecords,
  backupCollection,
  CollectionStats,
  CollectionSchema,
  QueryResult
} from '../services/adminDatabaseApi';

interface DatabaseManagerProps {
  token: string;
}

const DatabaseManager: React.FC<DatabaseManagerProps> = ({ token }) => {
  const [collections, setCollections] = useState<string[]>([]);
  const [selectedCollection, setSelectedCollection] = useState<string | null>(null);
  const [stats, setStats] = useState<CollectionStats | null>(null);
  const [schema, setSchema] = useState<CollectionSchema | null>(null);
  const [queryResults, setQueryResults] = useState<QueryResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [queryText, setQueryText] = useState('{}');
  const [limit, setLimit] = useState(10);
  const [skip, setSkip] = useState(0);

  useEffect(() => {
    loadCollections();
  }, []);

  useEffect(() => {
    if (selectedCollection) {
      loadCollectionData();
    }
  }, [selectedCollection]);

  const loadCollections = async () => {
    try {
      setLoading(true);
      const cols = await getCollections(token);
      setCollections(cols);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load collections');
    } finally {
      setLoading(false);
    }
  };

  const loadCollectionData = async () => {
    if (!selectedCollection) return;
    try {
      setLoading(true);
      const [collectionStats, collectionSchema] = await Promise.all([
        getCollectionStats(token, selectedCollection),
        getCollectionSchema(token, selectedCollection)
      ]);
      setStats(collectionStats);
      setSchema(collectionSchema);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load collection data');
    } finally {
      setLoading(false);
    }
  };

  const handleQuery = async () => {
    if (!selectedCollection) return;
    try {
      setLoading(true);
      let queryObj = {};
      try {
        queryObj = JSON.parse(queryText);
      } catch {
        throw new Error('Invalid JSON query');
      }

      const result = await executeQuery(token, {
        collection: selectedCollection,
        query: queryObj,
        limit,
        skip
      });
      setQueryResults(result);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to execute query');
    } finally {
      setLoading(false);
    }
  };

  const handleBackup = async () => {
    if (!selectedCollection) return;
    try {
      setLoading(true);
      const backup = await backupCollection(token, selectedCollection);
      // Download backup as JSON
      const blob = new Blob([JSON.stringify(backup.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${selectedCollection}_backup_${new Date().toISOString()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to backup collection');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Database className="w-5 h-5" />
            Database Manager
          </h2>
          <button
            onClick={loadCollections}
            className="px-4 py-2 text-sm bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
            <AlertTriangle className="w-4 h-4" />
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Collections List */}
          <div className="lg:col-span-1">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Collections</h3>
            <div className="border border-slate-200 rounded-lg max-h-96 overflow-y-auto">
              {loading && !collections.length ? (
                <div className="p-4 text-center text-slate-500">Loading...</div>
              ) : collections.length === 0 ? (
                <div className="p-4 text-center text-slate-500">No collections found</div>
              ) : (
                <div className="divide-y divide-slate-200">
                  {collections.map((collection) => (
                    <button
                      key={collection}
                      onClick={() => setSelectedCollection(collection)}
                      className={`w-full p-3 text-left hover:bg-slate-50 transition-colors ${
                        selectedCollection === collection ? 'bg-blue-50 border-l-4 border-blue-500' : ''
                      }`}
                    >
                      <div className="font-medium text-slate-800">{collection}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Collection Details */}
          <div className="lg:col-span-2 space-y-4">
            {selectedCollection ? (
              <>
                {/* Stats */}
                {stats && (
                  <div className="bg-slate-50 rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-slate-700 mb-3">Statistics</h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      <div>
                        <div className="text-xs text-slate-500">Documents</div>
                        <div className="text-lg font-bold text-slate-800">{stats.count.toLocaleString()}</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-500">Size</div>
                        <div className="text-lg font-bold text-slate-800">
                          {(stats.size / 1024 / 1024).toFixed(2)} MB
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-500">Indexes</div>
                        <div className="text-lg font-bold text-slate-800">{stats.indexes}</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Schema */}
                {schema && (
                  <div className="bg-slate-50 rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-slate-700 mb-3">Schema</h3>
                    <div className="space-y-2">
                      {schema.fields.slice(0, 10).map((field, idx) => (
                        <div key={idx} className="flex items-center justify-between text-sm">
                          <span className="font-mono text-slate-700">{field.name}</span>
                          <span className="text-slate-500">{field.type}</span>
                        </div>
                      ))}
                      {schema.fields.length > 10 && (
                        <div className="text-xs text-slate-500">+{schema.fields.length - 10} more fields</div>
                      )}
                    </div>
                  </div>
                )}

                {/* Query Interface */}
                <div className="bg-white border border-slate-200 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                    <Search className="w-4 h-4" />
                    Query Collection
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs text-slate-600 mb-1">MongoDB Query (JSON)</label>
                      <textarea
                        value={queryText}
                        onChange={(e) => setQueryText(e.target.value)}
                        className="w-full p-2 border border-slate-300 rounded-lg font-mono text-sm"
                        rows={3}
                        placeholder='{"status": "active"}'
                      />
                    </div>
                    <div className="flex gap-3">
                      <div className="flex-1">
                        <label className="block text-xs text-slate-600 mb-1">Limit</label>
                        <input
                          type="number"
                          value={limit}
                          onChange={(e) => setLimit(parseInt(e.target.value) || 10)}
                          className="w-full p-2 border border-slate-300 rounded-lg"
                          min={1}
                          max={100}
                        />
                      </div>
                      <div className="flex-1">
                        <label className="block text-xs text-slate-600 mb-1">Skip</label>
                        <input
                          type="number"
                          value={skip}
                          onChange={(e) => setSkip(parseInt(e.target.value) || 0)}
                          className="w-full p-2 border border-slate-300 rounded-lg"
                          min={0}
                        />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={handleQuery}
                        disabled={loading}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                      >
                        <Search className="w-4 h-4" />
                        Execute Query
                      </button>
                      <button
                        onClick={handleBackup}
                        disabled={loading}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
                      >
                        <Download className="w-4 h-4" />
                        Backup
                      </button>
                    </div>
                  </div>
                </div>

                {/* Query Results */}
                {queryResults && (
                  <div className="bg-white border border-slate-200 rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-slate-700 mb-3">
                      Results ({queryResults.pagination.total} total)
                    </h3>
                    <div className="max-h-96 overflow-y-auto">
                      <pre className="text-xs bg-slate-50 p-3 rounded-lg overflow-x-auto">
                        {JSON.stringify(queryResults.results, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-12 text-slate-500">
                Select a collection to view details and run queries
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DatabaseManager;




