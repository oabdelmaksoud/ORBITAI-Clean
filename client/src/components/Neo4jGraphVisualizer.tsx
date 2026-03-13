import React, { useState, useEffect, useRef } from 'react';
import {
  Network, Database, Search, Plus, Trash2, Link, Loader2,
  AlertCircle, CheckCircle, XCircle, Filter, RefreshCw, ZoomIn, ZoomOut
} from 'lucide-react';
import { getGraphStats, createGraphNode, createRelationship, traverseGraph, findShortestPath, GraphNode, GraphRelationship, GraphStats } from '../services/neo4jApi';

interface Neo4jGraphVisualizerProps {
  token: string;
}

const Neo4jGraphVisualizer: React.FC<Neo4jGraphVisualizerProps> = ({ token }) => {
  const [stats, setStats] = useState<GraphStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [showCreateNode, setShowCreateNode] = useState(false);
  const [showCreateRelationship, setShowCreateRelationship] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [traversalResults, setTraversalResults] = useState<any[]>([]);
  const [newNodeData, setNewNodeData] = useState({ labels: '', properties: '{}' });
  const [newRelationshipData, setNewRelationshipData] = useState({
    startNodeId: '',
    startNodeLabel: '',
    endNodeId: '',
    endNodeLabel: '',
    relationshipType: '',
    properties: '{}'
  });

  useEffect(() => {
    loadStats();
  }, [token]);

  const loadStats = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getGraphStats(token);
      setStats(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load graph statistics');
      console.error('Failed to load graph stats:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNode = async () => {
    try {
      const labels = newNodeData.labels.split(',').map(l => l.trim()).filter(Boolean);
      const properties = JSON.parse(newNodeData.properties);
      
      await createGraphNode(token, labels, properties);
      setShowCreateNode(false);
      setNewNodeData({ labels: '', properties: '{}' });
      await loadStats();
    } catch (err: any) {
      setError(err.message || 'Failed to create node');
    }
  };

  const handleCreateRelationship = async () => {
    try {
      const properties = JSON.parse(newRelationshipData.properties);
      
      await createRelationship(
        token,
        newRelationshipData.startNodeId,
        newRelationshipData.startNodeLabel,
        newRelationshipData.endNodeId,
        newRelationshipData.endNodeLabel,
        newRelationshipData.relationshipType,
        properties
      );
      setShowCreateRelationship(false);
      setNewRelationshipData({
        startNodeId: '',
        startNodeLabel: '',
        endNodeId: '',
        endNodeLabel: '',
        relationshipType: '',
        properties: '{}'
      });
      await loadStats();
    } catch (err: any) {
      setError(err.message || 'Failed to create relationship');
    }
  };

  const handleTraverse = async () => {
    if (!selectedNode) {
      setError('Please select a node first');
      return;
    }

    try {
      const results = await traverseGraph(token, selectedNode, 'Node', [], 2, 'both');
      setTraversalResults(results);
    } catch (err: any) {
      setError(err.message || 'Failed to traverse graph');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="animate-spin text-blue-600" size={32} />
      </div>
    );
  }

  if (error && !stats) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
        <AlertCircle className="mx-auto mb-2 text-red-600" size={32} />
        <p className="text-red-700 font-medium">{error}</p>
        <p className="text-sm text-red-600 mt-2">
          Make sure Neo4j is configured and running. Check NEO4J_URI, NEO4J_USER, and NEO4J_PASSWORD in your environment variables.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Neo4j Knowledge Graph</h2>
          <p className="text-sm text-slate-500 mt-1">
            Visualize and manage knowledge relationships
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={loadStats}
            className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg font-semibold hover:bg-slate-200 transition-colors flex items-center gap-2"
          >
            <RefreshCw size={16} /> Refresh
          </button>
          <button
            onClick={() => setShowCreateNode(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <Plus size={16} /> Create Node
          </button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-yellow-700 text-sm">{error}</p>
        </div>
      )}

      {/* Statistics */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Database size={20} className="text-blue-600" />
              <p className="text-sm text-slate-500">Total Nodes</p>
            </div>
            <h3 className="text-2xl font-bold text-slate-800">{stats.nodeCount.toLocaleString()}</h3>
          </div>
          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Link size={20} className="text-green-600" />
              <p className="text-sm text-slate-500">Total Relationships</p>
            </div>
            <h3 className="text-2xl font-bold text-slate-800">{stats.relationshipCount.toLocaleString()}</h3>
          </div>
          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Filter size={20} className="text-purple-600" />
              <p className="text-sm text-slate-500">Node Labels</p>
            </div>
            <h3 className="text-2xl font-bold text-slate-800">{stats.nodeLabels.length}</h3>
          </div>
          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Network size={20} className="text-orange-600" />
              <p className="text-sm text-slate-500">Relationship Types</p>
            </div>
            <h3 className="text-2xl font-bold text-slate-800">{stats.relationshipTypes.length}</h3>
          </div>
        </div>
      )}

      {/* Node Labels Breakdown */}
      {stats && stats.nodeLabels.length > 0 && (
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <h3 className="text-lg font-bold text-slate-800 mb-4">Node Labels</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {stats.nodeLabels.map((label, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <span className="font-medium text-slate-700">{label.label}</span>
                <span className="text-sm font-bold text-blue-600">{label.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Relationship Types Breakdown */}
      {stats && stats.relationshipTypes.length > 0 && (
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <h3 className="text-lg font-bold text-slate-800 mb-4">Relationship Types</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {stats.relationshipTypes.map((type, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <span className="font-medium text-slate-700">{type.type}</span>
                <span className="text-sm font-bold text-green-600">{type.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Graph Operations */}
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <h3 className="text-lg font-bold text-slate-800 mb-4">Graph Operations</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Node ID for Traversal
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={selectedNode || ''}
                onChange={(e) => setSelectedNode(e.target.value)}
                placeholder="Enter node ID"
                className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={handleTraverse}
                disabled={!selectedNode}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Traverse
              </button>
            </div>
          </div>

          {traversalResults.length > 0 && (
            <div className="mt-4 p-4 bg-slate-50 rounded-lg">
              <h4 className="font-semibold text-slate-800 mb-2">Traversal Results</h4>
              <div className="space-y-2">
                {traversalResults.map((path, idx) => (
                  <div key={idx} className="text-sm text-slate-600">
                    Path {idx + 1}: {path.length} steps
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Create Node Modal */}
      {showCreateNode && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-bold text-slate-800 mb-4">Create Node</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Labels (comma-separated)
                </label>
                <input
                  type="text"
                  value={newNodeData.labels}
                  onChange={(e) => setNewNodeData({ ...newNodeData, labels: e.target.value })}
                  placeholder="e.g., Person, Agent"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Properties (JSON)
                </label>
                <textarea
                  value={newNodeData.properties}
                  onChange={(e) => setNewNodeData({ ...newNodeData, properties: e.target.value })}
                  placeholder='{"name": "Example", "type": "agent"}'
                  rows={4}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleCreateNode}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
                >
                  Create
                </button>
                <button
                  onClick={() => setShowCreateNode(false)}
                  className="flex-1 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg font-semibold hover:bg-slate-200 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Relationship Modal */}
      {showCreateRelationship && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-bold text-slate-800 mb-4">Create Relationship</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Start Node ID
                </label>
                <input
                  type="text"
                  value={newRelationshipData.startNodeId}
                  onChange={(e) => setNewRelationshipData({ ...newRelationshipData, startNodeId: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Start Node Label
                </label>
                <input
                  type="text"
                  value={newRelationshipData.startNodeLabel}
                  onChange={(e) => setNewRelationshipData({ ...newRelationshipData, startNodeLabel: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  End Node ID
                </label>
                <input
                  type="text"
                  value={newRelationshipData.endNodeId}
                  onChange={(e) => setNewRelationshipData({ ...newRelationshipData, endNodeId: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  End Node Label
                </label>
                <input
                  type="text"
                  value={newRelationshipData.endNodeLabel}
                  onChange={(e) => setNewRelationshipData({ ...newRelationshipData, endNodeLabel: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Relationship Type
                </label>
                <input
                  type="text"
                  value={newRelationshipData.relationshipType}
                  onChange={(e) => setNewRelationshipData({ ...newRelationshipData, relationshipType: e.target.value })}
                  placeholder="e.g., CONNECTED_TO, DEPENDS_ON"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Properties (JSON)
                </label>
                <textarea
                  value={newRelationshipData.properties}
                  onChange={(e) => setNewRelationshipData({ ...newRelationshipData, properties: e.target.value })}
                  placeholder='{"weight": 1, "created": "2024-01-01"}'
                  rows={3}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleCreateRelationship}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
                >
                  Create
                </button>
                <button
                  onClick={() => setShowCreateRelationship(false)}
                  className="flex-1 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg font-semibold hover:bg-slate-200 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {stats && stats.nodeCount === 0 && (
        <div className="bg-white rounded-lg border border-slate-200 p-12 text-center">
          <Network size={48} className="mx-auto mb-4 text-slate-400" />
          <p className="text-slate-600 font-medium">No nodes in the graph</p>
          <p className="text-sm text-slate-500 mt-1">
            Create your first node to start building the knowledge graph
          </p>
          <button
            onClick={() => setShowCreateNode(true)}
            className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
          >
            Create First Node
          </button>
        </div>
      )}
    </div>
  );
};

export default Neo4jGraphVisualizer;
















