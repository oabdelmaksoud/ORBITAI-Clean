/**
 * Requirement Dependency Graph Component
 * Visualizes requirement dependencies and detects circular dependencies
 */

import React, { useState, useEffect, useRef } from 'react';
import { GitBranch, AlertTriangle, RefreshCw, Download, ZoomIn, ZoomOut, Maximize2, X } from 'lucide-react';
import { projectsApi } from '@src/services/api';

interface RequirementDependencyGraphProps {
  projectId: string;
}

interface RequirementDependency {
  requirementId: string;
  requirementTitle: string;
  dependsOn: string[];
  dependedBy: string[];
  level: number;
}

interface DependencyAnalysis {
  dependencies: RequirementDependency[];
  circularDependencies: Array<{
    cycle: string[];
    requirements: string[];
  }>;
  dependencyGraph: {
    nodes: Array<{
      id: string;
      label: string;
      level: number;
    }>;
    edges: Array<{
      from: string;
      to: string;
      type: 'depends_on' | 'depended_by';
    }>;
  };
  summary: {
    totalDependencies: number;
    circularCount: number;
    maxLevel: number;
  };
}

const RequirementDependencyGraph: React.FC<RequirementDependencyGraphProps> = ({ projectId }) => {
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<DependencyAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadDependencies();
  }, [projectId]);

  const loadDependencies = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await projectsApi.get(`/requirements/${projectId}/dependencies`);
      if (response.data?.success) {
        setAnalysis(response.data.data);
      } else {
        setError(response.data?.error || 'Failed to load dependencies');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to load dependencies');
    } finally {
      setLoading(false);
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom(prev => Math.max(0.5, Math.min(3, prev * delta)));
  };

  const renderGraph = () => {
    if (!analysis) return null;

    const { nodes, edges } = analysis.dependencyGraph;
    const nodePositions = new Map<string, { x: number; y: number }>();

    // Simple layout: hierarchical by level
    const nodesByLevel = new Map<number, typeof nodes>();
    nodes.forEach(node => {
      const level = node.level || 0;
      if (!nodesByLevel.has(level)) {
        nodesByLevel.set(level, []);
      }
      nodesByLevel.get(level)!.push(node);
    });

    const maxLevel = Math.max(...Array.from(nodesByLevel.keys()));
    const levelHeight = 150;
    const nodeWidth = 200;
    const nodeHeight = 60;

    // Calculate positions
    nodesByLevel.forEach((levelNodes, level) => {
      const y = level * levelHeight + 100;
      const totalWidth = levelNodes.length * (nodeWidth + 20);
      const startX = -totalWidth / 2;

      levelNodes.forEach((node, index) => {
        nodePositions.set(node.id, {
          x: startX + index * (nodeWidth + 20) + nodeWidth / 2,
          y: y
        });
      });
    });

    return (
      <svg
        width="100%"
        height="100%"
        style={{ overflow: 'visible' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      >
        <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
          {/* Edges */}
          {edges.map((edge, index) => {
            const from = nodePositions.get(edge.from);
            const to = nodePositions.get(edge.to);
            if (!from || !to) return null;

            const isCircular = analysis.circularDependencies.some(c => 
              c.cycle.includes(edge.from) && c.cycle.includes(edge.to)
            );

            return (
              <line
                key={index}
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                stroke={isCircular ? '#ef4444' : '#3b82f6'}
                strokeWidth={isCircular ? 3 : 2}
                strokeDasharray={isCircular ? '5,5' : '0'}
                markerEnd="url(#arrowhead)"
              />
            );
          })}

          {/* Arrow marker */}
          <defs>
            <marker
              id="arrowhead"
              markerWidth="10"
              markerHeight="10"
              refX="9"
              refY="3"
              orient="auto"
            >
              <polygon points="0 0, 10 3, 0 6" fill="#3b82f6" />
            </marker>
          </defs>

          {/* Nodes */}
          {nodes.map(node => {
            const pos = nodePositions.get(node.id);
            if (!pos) return null;

            const isSelected = selectedNode === node.id;
            const isCircular = analysis.circularDependencies.some(c => 
              c.requirements.includes(node.id)
            );

            return (
              <g key={node.id}>
                <rect
                  x={pos.x - nodeWidth / 2}
                  y={pos.y - nodeHeight / 2}
                  width={nodeWidth}
                  height={nodeHeight}
                  fill={isCircular ? '#fee2e2' : isSelected ? '#dbeafe' : '#f3f4f6'}
                  stroke={isCircular ? '#ef4444' : isSelected ? '#3b82f6' : '#9ca3af'}
                  strokeWidth={isSelected ? 3 : 2}
                  rx="8"
                  onClick={() => setSelectedNode(node.id === selectedNode ? null : node.id)}
                  style={{ cursor: 'pointer' }}
                />
                <text
                  x={pos.x}
                  y={pos.y - 10}
                  textAnchor="middle"
                  fontSize="12"
                  fontWeight="600"
                  fill="#111827"
                >
                  {node.label.length > 20 ? node.label.substring(0, 20) + '...' : node.label}
                </text>
                <text
                  x={pos.x}
                  y={pos.y + 10}
                  textAnchor="middle"
                  fontSize="10"
                  fill="#6b7280"
                >
                  Level {node.level}
                </text>
              </g>
            );
          })}
        </g>
      </svg>
    );
  };

  return (
    <div className={`p-6 bg-white rounded-lg shadow-sm ${isFullscreen ? 'fixed inset-0 z-50' : ''}`}>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <GitBranch className="w-6 h-6 text-blue-500" />
          <h2 className="text-2xl font-bold text-gray-900">Requirement Dependencies</h2>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setZoom(prev => Math.min(3, prev + 0.1))}
            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
            title="Zoom In"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={() => setZoom(prev => Math.max(0.5, prev - 0.1))}
            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
            title="Zoom Out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              setZoom(1);
              setPan({ x: 0, y: 0 });
            }}
            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
            title="Reset View"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
            title="Toggle Fullscreen"
          >
            {isFullscreen ? <X className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
          {analysis && (
            <button
              onClick={() => {
                const dataStr = JSON.stringify(analysis, null, 2);
                const blob = new Blob([dataStr], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `requirement-dependencies-${projectId}-${Date.now()}.json`;
                a.click();
              }}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              <Download className="w-4 h-4" />
              Export
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg mb-4">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="text-center py-8">
          <RefreshCw className="w-8 h-8 animate-spin text-gray-400 mx-auto mb-2" />
          <p className="text-gray-600">Loading dependencies...</p>
        </div>
      ) : analysis ? (
        <div className="space-y-4">
          {/* Summary */}
          <div className="grid grid-cols-4 gap-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-gray-900">{analysis.summary.totalDependencies}</div>
              <div className="text-sm text-gray-600">Total Dependencies</div>
            </div>
            <div className="p-4 bg-red-50 rounded-lg">
              <div className="text-2xl font-bold text-red-600">{analysis.summary.circularCount}</div>
              <div className="text-sm text-red-600">Circular Dependencies</div>
            </div>
            <div className="p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{analysis.summary.maxLevel}</div>
              <div className="text-sm text-blue-600">Max Level</div>
            </div>
            <div className="p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">{analysis.dependencies.length}</div>
              <div className="text-sm text-green-600">Requirements</div>
            </div>
          </div>

          {/* Circular Dependencies Warning */}
          {analysis.circularDependencies.length > 0 && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-5 h-5 text-red-600" />
                <span className="font-semibold text-red-800">Circular Dependencies Detected</span>
              </div>
              <div className="space-y-2">
                {analysis.circularDependencies.map((circular, index) => (
                  <div key={index} className="text-sm text-red-700">
                    Cycle {index + 1}: {circular.cycle.join(' → ')} → {circular.cycle[0]}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Graph Visualization */}
          <div
            ref={canvasRef}
            className="border border-gray-200 rounded-lg bg-gray-50"
            style={{ height: '600px', position: 'relative', overflow: 'hidden' }}
          >
            {renderGraph()}
          </div>

          {/* Selected Node Details */}
          {selectedNode && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h3 className="font-semibold mb-2">Requirement Details</h3>
              {analysis.dependencies
                .filter(d => d.requirementId === selectedNode)
                .map((dep, index) => (
                  <div key={index} className="space-y-2 text-sm">
                    <div>
                      <span className="font-medium">Title:</span> {dep.requirementTitle}
                    </div>
                    <div>
                      <span className="font-medium">Level:</span> {dep.level}
                    </div>
                    {dep.dependsOn.length > 0 && (
                      <div>
                        <span className="font-medium">Depends On:</span> {dep.dependsOn.length} requirements
                      </div>
                    )}
                    {dep.dependedBy.length > 0 && (
                      <div>
                        <span className="font-medium">Depended By:</span> {dep.dependedBy.length} requirements
                      </div>
                    )}
                  </div>
                ))}
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500">
          No dependency data available. Dependencies will be analyzed automatically.
        </div>
      )}
    </div>
  );
};

export default RequirementDependencyGraph;



