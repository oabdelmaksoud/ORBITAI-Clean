
import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { Task, TaskStatus } from '@orbitai/shared';
import { AGENTS } from '@orbitai/shared'; // Import for avatars
import { ChevronRight, ZoomIn, ZoomOut, Maximize, Play, CheckCircle2, AlertCircle, Clock, Lock, ArrowRight, User, MousePointer2 } from 'lucide-react';

interface TaskDependencyGraphProps {
  tasks: Task[];
  onSelectTask: (task: Task) => void;
  onExecuteTask: (taskId: string) => void;
}

interface Node {
  task: Task;
  x: number;
  y: number;
  depth: number;
  width: number;
  height: number;
}

interface Edge {
  source: Node;
  target: Node;
  id: string;
}

const CARD_WIDTH = 200;
const CARD_HEIGHT = 90;
const X_SPACING = 360;
const Y_SPACING = 160;

const TaskDependencyGraph: React.FC<TaskDependencyGraphProps> = ({ tasks, onSelectTask, onExecuteTask }) => {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 50, y: 50 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // --- Layout Algorithm ---
  const { nodes, edges, layers, width: graphWidth, height: graphHeight } = useMemo(() => {
    const nodeMap = new Map<string, Node>();
    const calculatedNodes: Node[] = [];
    const calculatedEdges: Edge[] = [];

    // 1. Calculate Depth (Topological Sort approximation)
    const getDepth = (taskId: string, visited = new Set<string>()): number => {
        if (visited.has(taskId)) return 0; // Handle cycles
        visited.add(taskId);
        
        const task = tasks.find(t => t.id === taskId);
        if (!task || !task.dependencies || task.dependencies.length === 0) return 0;
        
        // Only consider dependencies that are actually in the current view/sprint list
        const validDeps = task.dependencies.filter(dId => tasks.some(t => t.id === dId));
        if (validDeps.length === 0) return 0;

        return Math.max(...validDeps.map(dId => getDepth(dId, new Set(visited)))) + 1;
    };

    // 2. Assign Depths
    const tasksWithDepth = tasks.map(t => ({ task: t, depth: getDepth(t.id) }));
    const maxDepth = Math.max(...tasksWithDepth.map(t => t.depth), 0);
    const layers: Node[][] = Array.from({ length: maxDepth + 1 }, () => []);

    // 3. Populate Layers
    tasksWithDepth.forEach(({ task, depth }) => {
        const node: Node = {
            task,
            depth,
            x: depth * X_SPACING,
            y: 0, // Calculated later
            width: CARD_WIDTH,
            height: CARD_HEIGHT
        };
        layers[depth].push(node);
        nodeMap.set(task.id, node);
        calculatedNodes.push(node);
    });

    // 4. Assign Y Coordinates (Center vertically based on layer size)
    const maxLayerSize = Math.max(...layers.map(l => l.length));
    
    layers.forEach(layer => {
        const layerHeight = layer.length * Y_SPACING;
        const startY = ((maxLayerSize * Y_SPACING) - layerHeight) / 2;
        
        layer.forEach((node, index) => {
            node.y = startY + (index * Y_SPACING);
        });
    });

    // 5. Generate Edges
    tasks.forEach(task => {
        if (task.dependencies) {
            task.dependencies.forEach(depId => {
                const source = nodeMap.get(depId);
                const target = nodeMap.get(task.id);
                if (source && target) {
                    calculatedEdges.push({
                        id: `${source.task.id}-${target.task.id}`,
                        source,
                        target
                    });
                }
            });
        }
    });

    return { 
        nodes: calculatedNodes, 
        edges: calculatedEdges, 
        layers,
        width: (maxDepth + 1) * X_SPACING,
        height: maxLayerSize * Y_SPACING
    };
  }, [tasks]);

  // --- Recursive Path Finding ---
  const { ancestors, descendants } = useMemo(() => {
      if (!hoveredNode) return { ancestors: new Set<string>(), descendants: new Set<string>() };

      const anc = new Set<string>();
      const queueA = [hoveredNode];
      while(queueA.length > 0) {
          const curr = queueA.pop()!;
          const task = tasks.find(t => t.id === curr);
          if (task && task.dependencies) {
              task.dependencies.forEach(d => {
                  if (tasks.some(t => t.id === d) && !anc.has(d)) {
                      anc.add(d);
                      queueA.push(d);
                  }
              });
          }
      }

      const desc = new Set<string>();
      const queueD = [hoveredNode];
      while(queueD.length > 0) {
          const curr = queueD.pop()!;
          const children = tasks.filter(t => t.dependencies?.includes(curr));
          children.forEach(c => {
              if (!desc.has(c.id)) {
                  desc.add(c.id);
                  queueD.push(c.id);
              }
          });
      }

      return { ancestors: anc, descendants: desc };
  }, [hoveredNode, tasks]);

  // --- Interaction Handlers ---
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
    }
  };

  const handleMouseUp = () => setIsDragging(false);

  // Zoom to Cursor Logic
  const handleWheel = (e: React.WheelEvent) => {
      e.preventDefault();
      if (!containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const zoomFactor = 0.001;
      const delta = -e.deltaY * zoomFactor;
      
      const newZoom = Math.min(Math.max(zoom + delta, 0.2), 3);
      
      // Calculate new pan so mouse position stays constant
      // (mouseX - panX) / zoom = worldX
      // (mouseX - newPanX) / newZoom = worldX
      // => newPanX = mouseX - (mouseX - panX) * (newZoom / zoom)
      
      const newPanX = mouseX - (mouseX - pan.x) * (newZoom / zoom);
      const newPanY = mouseY - (mouseY - pan.y) * (newZoom / zoom);

      setZoom(newZoom);
      setPan({ x: newPanX, y: newPanY });
  };

  // Zoom Button Logic (Zooms to Center)
  const handleZoomButton = (direction: 'in' | 'out') => {
      if (!containerRef.current) return;
      
      const rect = containerRef.current.getBoundingClientRect();
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      
      const factor = direction === 'in' ? 1.2 : 0.833; // 1/1.2 = 0.833
      const newZoom = Math.min(Math.max(zoom * factor, 0.2), 3);

      const newPanX = centerX - (centerX - pan.x) * (newZoom / zoom);
      const newPanY = centerY - (centerY - pan.y) * (newZoom / zoom);

      setZoom(newZoom);
      setPan({ x: newPanX, y: newPanY });
  };

  const handleFit = useCallback(() => {
      if (containerRef.current && nodes.length > 0) {
          const { width, height } = containerRef.current.getBoundingClientRect();
          // Add some padding
          const PADDING_X = 120;
          const PADDING_Y = 120;
          
          const scaleX = (width - PADDING_X) / graphWidth;
          const scaleY = (height - PADDING_Y) / graphHeight;
          const fitScale = Math.min(scaleX, scaleY, 1.2); 
          
          const finalScale = Math.max(fitScale, 0.3);
          setZoom(finalScale);
          
          // Center content
          const scaledWidth = graphWidth * finalScale;
          const scaledHeight = graphHeight * finalScale;
          
          // Calculate pan to center the content
          const minY = Math.min(...nodes.map(n => n.y));
          const maxY = Math.max(...nodes.map(n => n.y + n.height));
          const contentHeight = (maxY - minY) * finalScale;
          
          setPan({
              x: (width - scaledWidth) / 2,
              y: (height - contentHeight) / 2 - (minY * finalScale)
          });
      }
  }, [nodes, graphWidth, graphHeight]);

  // Center on load and handle resize
  useEffect(() => {
      handleFit();
  }, [nodes.length, handleFit]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      const timer = setTimeout(() => {
        handleFit();
      }, 150);
      return () => clearTimeout(timer);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [handleFit]);

  const getStatusColor = (status: TaskStatus) => {
      switch(status) {
          case TaskStatus.COMPLETED: return '#10b981'; 
          case TaskStatus.IN_PROGRESS: return '#2563eb'; 
          case TaskStatus.FAILED: return '#ef4444'; 
          case TaskStatus.REVIEW: return '#f59e0b'; 
          default: return '#94a3b8'; 
      }
  };

  const getStatusBg = (status: TaskStatus) => {
      switch(status) {
          case TaskStatus.COMPLETED: return '#ecfdf5'; 
          case TaskStatus.IN_PROGRESS: return '#eff6ff'; 
          case TaskStatus.FAILED: return '#fef2f2'; 
          case TaskStatus.REVIEW: return '#fffbeb'; 
          default: return '#ffffff'; 
      }
  };

  const isNodeDimmed = (nodeId: string) => {
      if (!hoveredNode) return false;
      if (nodeId === hoveredNode) return false;
      return !ancestors.has(nodeId) && !descendants.has(nodeId);
  };

  const isEdgeDimmed = (edge: Edge) => {
      if (!hoveredNode) return false;
      // Edge is relevant if it connects two relevant nodes
      
      const isPath = (ancestors.has(edge.source.task.id) && (edge.target.task.id === hoveredNode || ancestors.has(edge.target.task.id))) ||
                     ((edge.source.task.id === hoveredNode || descendants.has(edge.source.task.id)) && descendants.has(edge.target.task.id));
      
      return !isPath;
  };

  return (
    <div className="flex-1 h-full bg-slate-50 relative overflow-hidden flex flex-col group/canvas">
        
        {/* Toolbar */}
        <div className="absolute bottom-6 right-6 z-30 flex flex-col gap-2">
            <div className="bg-white border border-slate-200 rounded-xl p-1 shadow-lg flex flex-col">
                <button onClick={() => handleZoomButton('in')} className="p-2.5 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors" title="Zoom In"><ZoomIn size={18} /></button>
                <button onClick={() => handleZoomButton('out')} className="p-2.5 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors" title="Zoom Out"><ZoomOut size={18} /></button>
                <div className="h-px bg-slate-100 my-1 mx-2"></div>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    handleFit();
                  }} 
                  className="p-2.5 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors z-[100] pointer-events-auto" 
                  title="Fit to View"
                >
                  <Maximize size={18} />
                </button>
            </div>
        </div>

        {/* Legend */}
        <div className="absolute top-6 left-6 z-30 bg-white/90 backdrop-blur border border-slate-200 rounded-xl p-3 shadow-sm text-[10px] font-medium text-slate-500 space-y-2 pointer-events-none">
            <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-slate-300"></div> Pending</div>
            <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-primary animate-pulse"></div> In Progress</div>
            <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-emerald-500"></div> Completed</div>
            <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-amber-500"></div> Review</div>
        </div>

        {/* Graph Surface */}
        <div 
            ref={containerRef}
            className={`flex-1 w-full h-full cursor-grab active:cursor-grabbing`}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onWheel={handleWheel}
        >
            {/* Dynamic Grid Background */}
            <div className="absolute inset-0 pointer-events-none opacity-30" 
                style={{ 
                    backgroundImage: 'radial-gradient(#94a3b8 1px, transparent 1px)', 
                    backgroundSize: `${30 * zoom}px ${30 * zoom}px`,
                    backgroundPosition: `${pan.x}px ${pan.y}px`
                }} 
            />

            <div style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: '0 0' }} className="relative transition-transform duration-75 ease-out will-change-transform">
                <svg className="overflow-visible pointer-events-none absolute top-0 left-0 w-full h-full">
                    <defs>
                        <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                            <polygon points="0 0, 10 3.5, 0 7" fill="#cbd5e1" />
                        </marker>
                        <marker id="arrowhead-active" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                            <polygon points="0 0, 10 3.5, 0 7" fill="#2563eb" />
                        </marker>
                        <marker id="arrowhead-dim" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                            <polygon points="0 0, 10 3.5, 0 7" fill="#e2e8f0" />
                        </marker>
                    </defs>
                    
                    {/* Edges */}
                    {edges.map(edge => {
                        const isDone = edge.source.task.status === TaskStatus.COMPLETED;
                        const isActive = edge.target.task.status === TaskStatus.IN_PROGRESS;
                        const isDimmed = isEdgeDimmed(edge);
                        
                        const color = isDimmed ? '#e2e8f0' : (isActive ? '#2563eb' : (isDone ? '#10b981' : '#cbd5e1'));
                        const opacity = isDimmed ? 0.3 : 1;
                        const width = isActive && !isDimmed ? 3 : 2;
                        
                        // Bezier Logic
                        const startX = edge.source.x + CARD_WIDTH;
                        const startY = edge.source.y + CARD_HEIGHT / 2;
                        const endX = edge.target.x;
                        const endY = edge.target.y + CARD_HEIGHT / 2;
                        const controlX1 = startX + (X_SPACING - CARD_WIDTH) / 2;
                        const controlX2 = endX - (X_SPACING - CARD_WIDTH) / 2;

                        return (
                            <path 
                                key={edge.id}
                                d={`M ${startX} ${startY} C ${controlX1} ${startY}, ${controlX2} ${endY}, ${endX} ${endY}`}
                                fill="none"
                                stroke={color}
                                strokeWidth={width}
                                strokeOpacity={opacity}
                                strokeDasharray={isActive && !isDimmed ? "8,4" : "none"}
                                markerEnd={isDimmed ? "url(#arrowhead-dim)" : (isActive ? "url(#arrowhead-active)" : "url(#arrowhead)")}
                                className={`transition-all duration-300 ${isActive && !isDimmed ? 'animate-flow' : ''}`}
                            />
                        );
                    })}
                </svg>

                {/* Nodes */}
                {nodes.map(node => {
                    const statusColor = getStatusColor(node.task.status);
                    const bg = getStatusBg(node.task.status);
                    const isDimmed = isNodeDimmed(node.task.id);
                    const isHovered = hoveredNode === node.task.id;
                    const isBlocked = node.task.dependencies.some(depId => tasks.find(t => t.id === depId)?.status !== TaskStatus.COMPLETED);
                    
                    // Find Agent Avatar
                    const agentRoleName = node.task.assignedTo;
                    const agent = AGENTS.find(a => a.role === agentRoleName || a.name === agentRoleName);
                    const avatarUrl = agent?.avatar || `https://api.dicebear.com/9.x/bottts-neutral/svg?seed=${node.task.assignedTo}`;

                    return (
                        <div
                            key={node.task.id}
                            className={`absolute flex flex-col p-0 rounded-lg border shadow-sm transition-all duration-300 group hover:shadow-xl hover:-translate-y-1 cursor-pointer pointer-events-auto select-none bg-white overflow-hidden ${
                                isDimmed ? 'opacity-30 blur-[1px]' : 'opacity-100'
                            } ${isHovered ? 'ring-2 ring-primary/50 z-[9999] scale-105' : node.task.status === TaskStatus.IN_PROGRESS || node.task.status === TaskStatus.REVIEW ? 'z-[9999]' : 'z-[9999]'}`}
                            style={{
                                left: node.x,
                                top: node.y,
                                width: node.width,
                                height: node.height,
                                maxWidth: node.width,
                                minHeight: node.height,
                                borderColor: isHovered ? statusColor : '#e2e8f0'
                            }}
                            onMouseEnter={() => setHoveredNode(node.task.id)}
                            onMouseLeave={() => setHoveredNode(null)}
                            onClick={(e) => { e.stopPropagation(); onSelectTask(node.task); }}
                        >
                            {/* Status Bar */}
                            <div className="absolute left-0 top-0 bottom-0 w-1.5 transition-colors" style={{ backgroundColor: statusColor }}></div>
                            
                            <div className="flex h-full pl-2.5 pr-2.5 py-2.5 items-start gap-2">
                                {/* Agent Avatar */}
                                <div className="relative shrink-0 mt-0.5">
                                    <div className="w-7 h-7 rounded-md border border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden">
                                        <img src={avatarUrl} alt={node.task.assignedTo} className="w-full h-full object-cover opacity-90" />
                                    </div>
                                    {node.task.status === TaskStatus.IN_PROGRESS && (
                                        <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-white rounded-full flex items-center justify-center border border-slate-100 shadow-sm">
                                            <Clock size={8} className="text-primary animate-pulse" />
                                        </div>
                                    )}
                                </div>

                                <div className="flex-1 min-w-0 flex flex-col h-full justify-between">
                                    <div>
                                        <div className="flex items-center justify-between mb-0.5">
                                            <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider truncate">{node.task.id}</span>
                                            {isBlocked && node.task.status === TaskStatus.PENDING && (
                                                <Lock size={10} className="text-amber-400" />
                                            )}
                                        </div>
                                        <div className="font-bold text-xs text-slate-800 leading-tight line-clamp-2" title={node.task.title}>
                                            {node.task.title}
                                        </div>
                                    </div>
                                    
                                    <div className="flex items-center justify-between pt-2">
                                        <div className="text-[9px] text-slate-600 font-medium truncate max-w-[80px]" title={node.task.assignedTo}>
                                            {node.task.assignedTo.split(' ')[0]}
                                        </div>
                                        
                                        {/* Action / State */}
                                        {node.task.status === TaskStatus.COMPLETED ? (
                                            <CheckCircle2 size={12} className="text-emerald-500" />
                                        ) : node.task.status === TaskStatus.FAILED ? (
                                            <AlertCircle size={12} className="text-red-500" />
                                        ) : node.task.status === TaskStatus.PENDING && !isBlocked ? (
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); onExecuteTask(node.task.id); }}
                                                className="p-1 bg-slate-100 hover:bg-primary hover:text-white text-slate-400 rounded-md transition-colors"
                                                title="Run Task"
                                            >
                                                <Play size={8} className="fill-current" />
                                            </button>
                                        ) : null}
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
        
        <style>{`
            @keyframes flow {
                to { stroke-dashoffset: -12; }
            }
            .animate-flow {
                animation: flow 1s linear infinite;
            }
        `}</style>
    </div>
  );
};

export default TaskDependencyGraph;
