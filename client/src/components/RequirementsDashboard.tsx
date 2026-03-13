
import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Artifact, Phase, Task, TaskStatus, AgentRole } from '@orbitai/shared';
import { ProjectPreview } from '../services/geminiService';
import { FileText, Code, CheckSquare, Link, AlertCircle, CheckCircle, Search, Table, Grid, Layers, ArrowRight, Activity, PieChart, ShieldCheck, Database, FileQuestion, PlusCircle, Terminal, Cpu, Play, PenTool, GitGraph, Clock, Maximize2, X, ZoomIn, ZoomOut, Maximize, Lightbulb, Workflow, AlertTriangle, ChevronRight, FileJson, Split, Box, Hexagon, Layout, Move, RefreshCw, TrendingUp, Target, BarChart3 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { projectsApi } from '@src/services/api';
import RequirementsCoverageReport from './RequirementsCoverageReport';

interface RequirementsDashboardProps {
  artifacts: Artifact[];
  onCreateTask?: (task: Task) => void;
  projectPreview?: ProjectPreview | null;
  currentSprint?: number; // Current sprint number for task assignment
  projectId?: string; // Project ID for compliance reporting
}

interface ParsedRequirement {
  id: string;
  type: string;
  description: string;
  priority: string;
  status: string;
  sourceArtifactId: string;
  linkedCode: Artifact[];
  linkedTests: Artifact[];
  linkedDesigns: Artifact[];
}

// ... DiagramViewer Component ...
const DiagramViewer: React.FC<{ code: string; title?: string }> = ({ code, title }) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const viewportRef = useRef<HTMLDivElement>(null);

  // Effect to handle ESC key and body scroll lock for fullscreen
  useEffect(() => {
    if (isFullscreen) {
      // Lock body scroll when fullscreen
      const originalOverflow = document.body.style.overflow;
      const originalPosition = document.body.style.position;
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
      
      // Handle ESC key to exit fullscreen
      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === 'Escape' && isFullscreen) {
          setIsFullscreen(false);
        }
      };
      
      window.addEventListener('keydown', handleEscape);
      
      return () => {
        // Restore body scroll
        document.body.style.overflow = originalOverflow;
        document.body.style.position = originalPosition;
        document.body.style.width = '';
        window.removeEventListener('keydown', handleEscape);
      };
    }
  }, [isFullscreen]);

  // Zoom controls
  const handleZoomIn = () => {
    setZoomLevel(prev => Math.min(prev + 0.25, 3));
  };

  const handleZoomOut = () => {
    setZoomLevel(prev => Math.max(prev - 0.25, 0.25));
  };


  const handleFitToScreen = useCallback(() => {
    // Calculate zoom to fit diagram content - enable overzoom for smaller diagrams
    const viewport = viewportRef.current;
    const iframe = iframeRef.current;
    if (viewport && iframe) {
      try {
        const iframeDoc = iframe.contentDocument;
        if (iframeDoc) {
          const svg = iframeDoc.querySelector('svg');
          if (svg && svg.getBBox) {
            const svgBox = svg.getBBox();
            const viewportWidth = viewport.clientWidth - 40; // Account for padding
            const viewportHeight = viewport.clientHeight - 40;
            
            if (svgBox.width > 0 && svgBox.height > 0) {
              const scaleX = viewportWidth / svgBox.width;
              const scaleY = viewportHeight / svgBox.height;
              // Enable overzoom: use Math.min to fit, but allow values > 1 for smaller diagrams
              // This allows zooming in beyond 100% when diagram is smaller than viewport
              const scale = Math.min(scaleX, scaleY);
              
              setZoomLevel(scale);
              
              // Center the diagram properly
              // Calculate SVG center in its coordinate system
              const svgCenterX = svgBox.x + svgBox.width / 2;
              const svgCenterY = svgBox.y + svgBox.height / 2;
              
              // Viewport center
              const viewportCenterX = viewportWidth / 2;
              const viewportCenterY = viewportHeight / 2;
              
              // Calculate pan to center the SVG in the viewport
              // With transformOrigin 'center center', we need to offset by the difference
              const panX = viewportCenterX - (svgCenterX * scale);
              const panY = viewportCenterY - (svgCenterY * scale);
              
              setPanX(panX);
              setPanY(panY);
              return;
            }
          }
        }
      } catch (e) {
        // Ignore cross-origin or other errors
      }
      // Fallback if SVG not found or error
      setZoomLevel(1);
      setPanX(0);
      setPanY(0);
    }
  }, []);

  // Auto-fit diagram when it first loads
  useEffect(() => {
    if (!hasError && iframeRef.current) {
      // Wait for iframe to load content
      const iframe = iframeRef.current;
      const checkAndFit = () => {
        try {
          const iframeDoc = iframe.contentDocument;
          if (iframeDoc) {
            const svg = iframeDoc.querySelector('svg');
            if (svg && svg.getBBox) {
              // SVG is loaded, fit to screen
              handleFitToScreen();
              return true;
            }
          }
        } catch (e) {
          // Cross-origin or not ready yet
        }
        return false;
      };

      // Try immediately
      if (checkAndFit()) return;

      // If not ready, wait for load event
      const handleLoad = () => {
        // Give it a small delay to ensure SVG is rendered
        setTimeout(() => {
          checkAndFit();
        }, 100);
      };

      iframe.addEventListener('load', handleLoad);
      
      // Also try periodically in case load event doesn't fire
      const intervalId = setInterval(() => {
        if (checkAndFit()) {
          clearInterval(intervalId);
        }
      }, 200);

      // Cleanup after 5 seconds max
      const timeoutId = setTimeout(() => {
        clearInterval(intervalId);
      }, 5000);

      return () => {
        iframe.removeEventListener('load', handleLoad);
        clearInterval(intervalId);
        clearTimeout(timeoutId);
      };
    }
  }, [code, hasError, handleFitToScreen]);

  // Keyboard shortcuts for zoom
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === '=') {
        e.preventDefault();
        handleZoomIn();
      } else if ((e.ctrlKey || e.metaKey) && e.key === '-') {
        e.preventDefault();
        handleZoomOut();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Mouse wheel zoom
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        if (e.deltaY < 0) {
          handleZoomIn();
        } else {
          handleZoomOut();
        }
      }
    };

    const viewport = viewportRef.current;
    if (viewport) {
      viewport.addEventListener('wheel', handleWheel, { passive: false });
      return () => viewport.removeEventListener('wheel', handleWheel);
    }
  }, []);

  // Pan functionality - Allow regular mouse drag to pan
  const handleMouseDown = (e: React.MouseEvent) => {
    // Allow panning with regular left-click drag (most intuitive)
    // Also support: Middle mouse, Ctrl/Cmd + Left, Shift + Left, Right click
    if (e.button === 0 || e.button === 1 || e.button === 2) {
      // Check if clicking on a button or control - don't pan in that case
      const target = e.target as HTMLElement;
      if (target.closest('button') || target.closest('[role="button"]')) {
        return;
      }
      e.preventDefault();
      setIsPanning(true);
      setPanStart({ x: e.clientX - panX, y: e.clientY - panY });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      setPanX(e.clientX - panStart.x);
      setPanY(e.clientY - panStart.y);
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  useEffect(() => {
    setHasError(false);
    const renderFrame = () => {
        if (iframeRef.current) {
        const doc = iframeRef.current.contentDocument;
        if (doc) {
            doc.open();
            let cleanCode = code.replace(/```(?:mermaid|mmd)?/gi, '').replace(/```/g, '').trim();
            cleanCode = cleanCode.replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&amp;/g, '&');
            
            doc.write(`
            <!DOCTYPE html>
            <html style="overflow: visible; height: auto; width: 100%;">
            <head>
                <meta charset="utf-8">
                <style>
                    html { margin: 0; padding: 0; overflow: visible; height: auto; width: 100%; box-sizing: border-box; }
                    body { margin: 0; padding: 40px; overflow: visible; height: auto; min-height: 100%; width: 100%; box-sizing: border-box; background: transparent; display: flex; justify-content: center; align-items: flex-start; font-family: 'Inter', system-ui, sans-serif; }
                    .mermaid { width: 100%; display: flex; justify-content: center; min-height: 100%; }
                    svg { max-width: 100% !important; width: auto !important; height: auto !important; filter: drop-shadow(0 10px 15px -3px rgba(0, 0, 0, 0.1)); }
                </style>
            </head>
            <body>
                <div id="diagram" class="mermaid">${cleanCode}</div>
                <script type="module">
                import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.esm.min.mjs';
                mermaid.initialize({ startOnLoad: true, look: 'handDrawn', theme: 'base' });
                // Ensure SVG is fully visible
                mermaid.run().then(() => {
                  const svg = document.querySelector('svg');
                  if (svg) {
                    const bbox = svg.getBBox();
                    if (bbox.height > 0) {
                      document.body.style.minHeight = (bbox.height + 80) + 'px';
                      svg.style.maxHeight = 'none';
                      svg.style.height = 'auto';
                    }
                  }
                });
                </script>
            </body>
            </html>
            `);
            doc.close();
        }
        }
    };
    const timer = setTimeout(renderFrame, 100);
    return () => clearTimeout(timer);
  }, [code, isFullscreen]);

  // Auto-fit diagram to screen when it loads and ensure full content is visible
  useEffect(() => {
    const iframe = iframeRef.current;
    if (iframe) {
      const checkAndFit = () => {
        try {
          const iframeDoc = iframe.contentDocument;
          if (iframeDoc) {
            const svg = iframeDoc.querySelector('svg');
            if (svg && svg.getBBox) {
              // Wait a bit for rendering to complete
              setTimeout(() => {
                const bbox = svg.getBBox();
                // Ensure body is tall enough to show full SVG, especially in fullscreen
                if (bbox.height > 0) {
                  const body = iframeDoc.body;
                  if (body) {
                    // In fullscreen, ensure body can accommodate the full diagram
                    const minHeight = isFullscreen 
                      ? Math.max(bbox.height + 200, window.innerHeight * 0.9)
                      : Math.max(bbox.height + 100, iframeDoc.documentElement.clientHeight);
                    body.style.minHeight = minHeight + 'px';
                    body.style.height = 'auto';
                  }
                }
                handleFitToScreen();
              }, 800);
            } else {
              // Retry if SVG not ready yet
              setTimeout(checkAndFit, 200);
            }
          }
        } catch (e) {
          // Ignore cross-origin errors
        }
      };
      // Check after iframe loads
      iframe.onload = () => {
        setTimeout(checkAndFit, 300);
      };
      // Also check immediately in case already loaded
      setTimeout(checkAndFit, 500);
    }
  }, [code, handleFitToScreen, isFullscreen]);

  // Refit diagram when entering fullscreen mode
  useEffect(() => {
    if (isFullscreen) {
      // Wait for fullscreen transition to complete, then refit
      const timer = setTimeout(() => {
        handleFitToScreen();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isFullscreen, handleFitToScreen]);

  // Content to render
  const content = (
    <>
      {/* Backdrop for maximized mode */}
      {isFullscreen && <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" style={{ zIndex: 99998 }} onClick={() => setIsFullscreen(false)} />}
      
      <div 
        className={`bg-white ${isFullscreen ? 'fixed rounded-xl shadow-2xl border border-slate-200' : 'border border-slate-200 rounded-2xl shadow-sm'} overflow-hidden group ring-1 ring-slate-100 transition-all hover:shadow-lg relative`} 
        style={isFullscreen ? { 
          zIndex: 999999, 
          width: '95vw', 
          height: '95vh', 
          top: '50%', 
          left: '50%', 
          transform: 'translate(-50%, -50%)',
          position: 'fixed',
          maxWidth: '1600px',
          maxHeight: '95vh'
        } : {}}
      >
        <div className="bg-slate-50/50 px-5 py-3 border-b border-slate-100 flex justify-between items-center backdrop-blur-sm">
          <div className="text-xs font-bold text-slate-600 uppercase tracking-widest flex items-center gap-2"><GitGraph size={14} className="text-primary" /> {title || 'System Flow'}</div>
        </div>
        <div 
          ref={viewportRef}
          className={`relative w-full bg-white overflow-hidden cursor-grab active:cursor-grabbing ${isFullscreen ? 'h-[calc(95vh-60px)]' : 'h-[700px] min-h-[700px]'}`}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onContextMenu={(e) => e.preventDefault()}
        >
          {/* Zoom Controls - Left Side, Centered, Vertical, Smaller */}
          <div className="absolute top-1/2 left-4 -translate-y-1/2 z-50 bg-white/60 backdrop-blur border border-slate-200/60 rounded-md p-1.5 flex flex-col items-center gap-1.5 shadow-lg pointer-events-auto">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleZoomIn();
              }}
              className="p-1 hover:bg-white/40 rounded text-slate-600 hover:text-slate-800 transition-all"
              title="Zoom In (Ctrl/Cmd + +)"
            >
              <ZoomIn size={12} />
            </button>
            <span className="text-[10px] font-mono text-slate-700 py-0.5 text-center">
              {Math.round(zoomLevel * 100)}%
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleZoomOut();
              }}
              className="p-1 hover:bg-white/40 rounded text-slate-600 hover:text-slate-800 transition-all"
              title="Zoom Out (Ctrl/Cmd + -)"
            >
              <ZoomOut size={12} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleFitToScreen();
              }}
              className="p-1 hover:bg-white/40 rounded text-slate-600 hover:text-slate-800 transition-all"
              title="Fit to Screen"
            >
              <Maximize size={12} />
            </button>
          </div>

          {/* Maximize/Close Button - Top Right on Canvas */}
          {isFullscreen ? (
            <div className="absolute top-4 right-4 z-50 flex gap-2 pointer-events-auto">
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setIsFullscreen(false);
                }} 
                className="p-2 bg-white/90 backdrop-blur border border-slate-200 rounded-full shadow-sm hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition-all"
                title="Exit Fullscreen (Esc)"
              >
                <X size={16} />
              </button>
            </div>
          ) : (
            <div className="absolute top-4 right-4 z-50 flex gap-2 pointer-events-auto">
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setIsFullscreen(true);
                }} 
                className="p-2 bg-white/90 backdrop-blur border border-slate-200 rounded-full shadow-sm hover:bg-slate-100 text-slate-500 hover:text-primary transition-all"
                title="Maximize to Fullscreen"
              >
                <Maximize2 size={16} />
              </button>
            </div>
          )}

          {/* Viewport Container with Zoom and Pan */}
          <div
            className="absolute inset-0 overflow-hidden"
          >
            {/* Diagram container with transform - larger than viewport to accommodate full diagram */}
            <div
              className="absolute"
              style={{
                transform: `translate(${panX}px, ${panY}px) scale(${zoomLevel})`,
                transformOrigin: 'center center',
                transition: isPanning ? 'none' : 'transform 0.1s ease-out',
                userSelect: 'none',
                width: '100%',
                height: '100%',
                left: '0',
                top: '0'
              }}
            >
              <iframe 
                ref={iframeRef} 
                className="w-full h-full border-0 relative z-10" 
                sandbox="allow-same-origin allow-scripts" 
                scrolling="no"
                style={{ 
                  width: '100%', 
                  height: '100%',
                  pointerEvents: isPanning ? 'none' : 'auto'
                }} 
              />
            </div>
            
            {/* Transparent overlay to capture pan gestures - above iframe but below buttons */}
            <div
              className="absolute inset-0 z-30"
              style={{
                cursor: isPanning ? 'grabbing' : 'grab',
                pointerEvents: 'auto'
              }}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onContextMenu={(e) => e.preventDefault()}
            />
          </div>
        </div>
      </div>
    </>
  );

  // When maximized, render in a portal to document.body
  if (isFullscreen) {
    return createPortal(content, document.body);
  }

  // Normal rendering when not maximized
  return content;
};

// ... VModelTraceability Component ...
const VModelTraceability: React.FC<{ requirements: ParsedRequirement[] }> = ({ requirements }) => {
  const [selectedReqId, setSelectedReqId] = useState<string | null>(null);
  const activeReq = requirements.find(r => r.id === selectedReqId) || requirements[0];
  
  // Canvas State
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  // Calculate Global Counts for the Model Layers
  const stats = useMemo(() => {
      const designIds = new Set<string>();
      const codeIds = new Set<string>();
      const testIds = new Set<string>();
      
      requirements.forEach(r => {
          r.linkedDesigns.forEach(d => designIds.add(d.id));
          r.linkedCode.forEach(c => codeIds.add(c.id));
          r.linkedTests.forEach(t => testIds.add(t.id));
      });

      return {
          reqCount: requirements.length,
          designCount: designIds.size,
          codeCount: codeIds.size,
          testCount: testIds.size,
          valCount: requirements.filter(r => r.status === 'Verified').length // Proxy for Validation
      };
  }, [requirements]);

  // Initial Fit and Resize Handler
  const handleFit = useCallback(() => {
      if (containerRef.current) {
        const { width, height } = containerRef.current.getBoundingClientRect();
        const contentW = 1000;
        const contentH = 650;
        const padding = 80;
        const scaleX = (width - padding) / contentW;
        const scaleY = (height - padding) / contentH;
        const scale = Math.min(scaleX, scaleY, 1.2);
        
        const finalScale = Math.max(scale, 0.3);
        setZoom(finalScale);
        
        // Center the content
        const scaledWidth = contentW * finalScale;
        const scaledHeight = contentH * finalScale;
        setPan({
            x: (width - scaledWidth) / 2,
            y: (height - scaledHeight) / 2
        });
      }
  }, []);

  // Initial Fit on mount
  useEffect(() => {
    handleFit();
  }, [handleFit]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      // Debounce resize
      const timer = setTimeout(() => {
        handleFit();
      }, 150);
      return () => clearTimeout(timer);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [handleFit]);

  const handleZoomIn = () => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    
    const newZoom = Math.min(zoom * 1.2, 3);
    const newPanX = centerX - (centerX - pan.x) * (newZoom / zoom);
    const newPanY = centerY - (centerY - pan.y) * (newZoom / zoom);
    
    setZoom(newZoom);
    setPan({ x: newPanX, y: newPanY });
  };

  const handleZoomOut = () => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    
    const newZoom = Math.max(zoom / 1.2, 0.2);
    const newPanX = centerX - (centerX - pan.x) * (newZoom / zoom);
    const newPanY = centerY - (centerY - pan.y) * (newZoom / zoom);
    
    setZoom(newZoom);
    setPan({ x: newPanX, y: newPanY });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault(); 
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
    }
  };

  const handleMouseUp = () => setIsDragging(false);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (!containerRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    const zoomFactor = 0.001;
    const delta = -e.deltaY * zoomFactor;
    const newZoom = Math.min(Math.max(zoom + delta, 0.2), 3);
    
    // Zoom to cursor position
    const newPanX = mouseX - (mouseX - pan.x) * (newZoom / zoom);
    const newPanY = mouseY - (mouseY - pan.y) * (newZoom / zoom);
    
    setZoom(newZoom);
    setPan({ x: newPanX, y: newPanY });
  };

  const NodeCard = ({ title, type, items, side, totalCount }: { title: string, type: string, items: Artifact[] | string[], side: 'left' | 'right' | 'center', totalCount: number }) => (
      <div 
        className={`relative p-4 rounded-xl border bg-white shadow-xl transition-all duration-300 hover:scale-105 z-20 w-64 flex flex-col cursor-default select-none ${
            type === 'req' ? 'border-l-4 border-l-primary' : 
            type === 'code' ? 'border-b-4 border-b-blue-500' : 
            type === 'test' ? 'border-r-4 border-r-green-500' :
            type === 'val' ? 'border-r-4 border-r-orange-500' :
            'border-l-4 border-l-purple-500'
        }`}
        onMouseDown={e => e.stopPropagation()} // Prevent drag when clicking a card
      >
          <div className="flex justify-between items-start mb-2">
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                  {type === 'req' && <FileText size={12} className="text-primary" />}
                  {type === 'design' && <Hexagon size={12} className="text-purple-500" />}
                  {type === 'code' && <Terminal size={12} className="text-blue-500" />}
                  {type === 'test' && <CheckSquare size={12} className="text-green-500" />}
                  {type === 'val' && <ShieldCheck size={12} className="text-orange-500" />}
                  {title}
              </div>
              <span className="text-[9px] font-mono font-bold bg-slate-100 px-2 py-0.5 rounded-full text-slate-600 border border-slate-200">
                  {totalCount} Items
              </span>
          </div>
          
          <div className="space-y-1.5 max-h-32 overflow-y-auto custom-scrollbar bg-slate-50/50 rounded-lg p-1.5 min-h-[60px]">
              {selectedReqId ? (
                  Array.isArray(items) && items.length > 0 ? items.map((item, i) => (
                      <div key={i} className="flex items-center gap-2 text-[10px] font-medium text-slate-700 bg-white px-2 py-1.5 rounded border border-slate-100 shadow-sm animate-in slide-in-from-left-2 fade-in">
                          {typeof item === 'string' ? <span>{item}</span> : <span className="truncate flex-1" title={item.title}>{item.title}</span>}
                      </div>
                  )) : <div className="text-[10px] text-slate-400 italic py-2 text-center">No trace for selected req</div>
              ) : (
                  <div className="flex items-center justify-center h-full text-[10px] text-slate-400 italic opacity-70">Select a requirement to trace</div>
              )}
          </div>
      </div>
  );

  if (!activeReq && requirements.length === 0) return (
      <div className="flex flex-col items-center justify-center h-full text-slate-400 p-12">
          <Workflow size={48} className="mb-4 opacity-50" />
          <p className="text-sm font-bold">No Requirements Found</p>
          <p className="text-xs opacity-70">Add requirements to enable traceability.</p>
      </div>
  );

  return (
      <div className="flex h-full bg-slate-50 relative overflow-hidden">
          {/* Sidebar List */}
          <div className="w-80 bg-white border-r border-slate-200 flex flex-col shrink-0 z-20 shadow-xl">
              <div className="p-4 border-b border-slate-100 bg-slate-50/80 backdrop-blur">
                  <h3 className="text-xs font-bold text-slate-600 uppercase tracking-widest flex items-center gap-2">
                      <FileText size={14} className="text-primary" /> Trace Requirements
                  </h3>
              </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
                  {requirements.map((req, index) => (
                      <button 
                        key={`${req.sourceArtifactId}-${req.id}-${index}`} 
                        onClick={() => setSelectedReqId(req.id === selectedReqId ? null : req.id)} 
                        className={`w-full text-left p-3 rounded-xl border transition-all group relative overflow-hidden ${activeReq.id === req.id && selectedReqId ? 'bg-primary/5 border-primary/30 shadow-md ring-1 ring-primary/20' : 'bg-white border-transparent hover:bg-slate-50 hover:border-slate-200'}`}
                      >
                          {activeReq.id === req.id && selectedReqId && <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary"></div>}
                          <div className="flex justify-between items-center mb-1">
                              <span className={`text-[10px] font-bold font-mono ${activeReq.id === req.id && selectedReqId ? 'text-primary' : 'text-slate-500'}`}>{req.id}</span>
                              <div className="flex gap-1">
                                  {req.linkedDesigns.length > 0 && <div className="w-1.5 h-1.5 rounded-full bg-purple-400"></div>}
                                  {req.linkedCode.length > 0 && <div className="w-1.5 h-1.5 rounded-full bg-blue-400"></div>}
                                  {req.linkedTests.length > 0 && <div className="w-1.5 h-1.5 rounded-full bg-green-400"></div>}
                              </div>
                          </div>
                          <div className="text-xs text-slate-700 line-clamp-2 leading-relaxed opacity-90 font-medium">{req.description}</div>
                      </button>
                  ))}
              </div>
          </div>

          {/* V-Model Visualizer Canvas */}
          <div 
            className={`flex-1 relative overflow-hidden bg-slate-50 min-h-0 ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`} 
            ref={containerRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onWheel={handleWheel}
            style={{ height: '100%' }}
          >
              
              {/* Background Grid - Moves with Pan */}
              <div className="absolute inset-0 opacity-20 pointer-events-none" 
                   style={{ 
                       backgroundImage: 'radial-gradient(#94a3b8 1px, transparent 1px)', 
                       backgroundSize: `${20 * zoom}px ${20 * zoom}px`,
                       backgroundPosition: `${pan.x}px ${pan.y}px`
                   }}>
              </div>

              {/* Floating Controls */}
              <div className="absolute top-4 right-4 z-50 flex flex-col gap-2 bg-white/90 backdrop-blur rounded-lg p-1 shadow-md border border-slate-200">
                  <button onClick={handleZoomIn} className="p-2 hover:bg-slate-100 rounded text-slate-600 transition-colors" title="Zoom In"><ZoomIn size={16} /></button>
                  <button onClick={handleZoomOut} className="p-2 hover:bg-slate-100 rounded text-slate-600 transition-colors" title="Zoom Out"><ZoomOut size={16} /></button>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      handleFit();
                    }} 
                    className="p-2 hover:bg-slate-100 rounded text-slate-600 transition-colors z-[100] pointer-events-auto" 
                    title="Fit to View"
                  >
                    <Maximize size={16} />
                  </button>
                  <div className="h-px bg-slate-200 my-1 mx-2"></div>
                  <div className="flex items-center justify-center p-2 text-slate-400" title="Pan Mode"><Move size={16} /></div>
              </div>

              {/* Transformable Canvas Content */}
              <div 
                style={{ 
                    transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, 
                    width: '1000px', 
                    height: '650px', 
                    transformOrigin: '0 0',
                    transition: isDragging ? 'none' : 'transform 0.1s ease-out' 
                }}
                className="absolute top-0 left-0 bg-white/60 backdrop-blur-sm rounded-[3rem] border border-white/50 shadow-[0_20px_50px_rgba(0,0,0,0.1)] flex-shrink-0"
              >
                  {/* V-Model Lines SVG */}
                  <svg className="absolute inset-0 w-full h-full pointer-events-none z-0 rounded-[3rem]">
                      <defs>
                          <marker id="arrow" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto" markerUnits="strokeWidth">
                              <path d="M0,0 L0,6 L9,3 z" fill="#cbd5e1" />
                          </marker>
                          <marker id="arrow-active" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto" markerUnits="strokeWidth">
                              <path d="M0,0 L0,6 L9,3 z" fill="#2563eb" />
                          </marker>
                      </defs>
                      
                      {/* Connecting Lines - Adjusted for layout */}
                      {/* Descent */}
                      <line x1="25%" y1="15%" x2="40%" y2="40%" stroke="#cbd5e1" strokeWidth="2" strokeDasharray="5,5" markerEnd="url(#arrow)" />
                      <line x1="40%" y1="48%" x2="50%" y2="78%" stroke="#cbd5e1" strokeWidth="2" strokeDasharray="5,5" markerEnd="url(#arrow)" />
                      
                      {/* Ascent */}
                      <line x1="50%" y1="78%" x2="60%" y2="48%" stroke="#cbd5e1" strokeWidth="2" strokeDasharray="5,5" markerEnd="url(#arrow)" />
                      <line x1="60%" y1="40%" x2="75%" y2="15%" stroke="#cbd5e1" strokeWidth="2" strokeDasharray="5,5" markerEnd="url(#arrow)" />

                      {/* Horizontal Verification Lines */}
                      <line x1="25%" y1="15%" x2="75%" y2="15%" stroke="#94a3b8" strokeWidth="1" strokeDasharray="2,2" opacity="0.2" />
                      <line x1="40%" y1="40%" x2="60%" y2="40%" stroke="#94a3b8" strokeWidth="1" strokeDasharray="2,2" opacity="0.2" />

                      {/* Active Requirement Path Highlight */}
                      {selectedReqId && (
                          <>
                              {/* Req -> Design */}
                              <line x1="25%" y1="15%" x2="40%" y2="40%" stroke="#2563eb" strokeWidth="3" strokeOpacity={activeReq.linkedDesigns.length ? 1 : 0.1} />
                              {/* Design -> Code */}
                              <line x1="40%" y1="48%" x2="50%" y2="78%" stroke="#2563eb" strokeWidth="3" strokeOpacity={activeReq.linkedCode.length ? 1 : 0.1} />
                              {/* Code -> Test */}
                              <line x1="50%" y1="78%" x2="60%" y2="48%" stroke="#10b981" strokeWidth="3" strokeOpacity={activeReq.linkedTests.length ? 1 : 0.1} />
                              {/* Test -> Val */}
                              <line x1="60%" y1="40%" x2="75%" y2="15%" stroke="#10b981" strokeWidth="3" strokeOpacity={activeReq.status === 'Verified' ? 1 : 0.1} />
                          </>
                      )}
                  </svg>

                  {/* Nodes - Absolute positions within the fixed 1000x650 container */}
                  <div className="absolute inset-0 z-10">
                      {/* Left Side (Descent) */}
                      <div className="absolute top-[5%] left-[15%] transform -translate-x-1/2">
                          <NodeCard title="Requirements" type="req" items={[activeReq?.description || ""]} side="right" totalCount={stats.reqCount} />
                      </div>
                      <div className="absolute top-[40%] left-[30%] transform -translate-x-1/2">
                          <NodeCard title="Architecture" type="design" items={activeReq?.linkedDesigns || []} side="right" totalCount={stats.designCount} />
                      </div>

                      {/* Bottom (Pivot) */}
                      <div className="absolute bottom-[10%] left-1/2 transform -translate-x-1/2">
                          <NodeCard title="Implementation" type="code" items={activeReq?.linkedCode || []} side="center" totalCount={stats.codeCount} />
                      </div>

                      {/* Right Side (Ascent) */}
                      <div className="absolute top-[40%] right-[30%] transform translate-x-1/2">
                          <NodeCard title="Verification" type="test" items={activeReq?.linkedTests || []} side="left" totalCount={stats.testCount} />
                      </div>
                      <div className="absolute top-[5%] right-[15%] transform translate-x-1/2">
                          <NodeCard title="Validation" type="val" items={activeReq?.linkedTests.length > 0 ? ["User Acceptance Verified"] : []} side="left" totalCount={stats.valCount} />
                      </div>
                  </div>
              </div>
          </div>
      </div>
  );
};

const RequirementsDashboard: React.FC<RequirementsDashboardProps> = ({ artifacts, onCreateTask, projectPreview, currentSprint = 1, projectId }) => {
  const [activeTab, setActiveTab] = useState<'traceability' | 'architecture' | 'vmodel'>('traceability');
  const [viewMode, setViewMode] = useState<'list' | 'matrix'>('list');
  const [filter, setFilter] = useState('');
  const [isGeneratingDiagram, setIsGeneratingDiagram] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [complianceScore, setComplianceScore] = useState<number | null>(null);
  const [loadingCompliance, setLoadingCompliance] = useState(false);
  const [showCoverageReport, setShowCoverageReport] = useState(false);
  const [missingRequirements, setMissingRequirements] = useState<number>(0);

  // Load compliance data
  useEffect(() => {
    if (projectId) {
      loadComplianceData();
    }
  }, [projectId, artifacts]);

  const loadComplianceData = async () => {
    if (!projectId) return;
    
    try {
      setLoadingCompliance(true);
      const [complianceRes, missingRes] = await Promise.all([
        projectsApi.get(`/requirements/${projectId}/compliance`).catch(() => null),
        projectsApi.get(`/requirements/${projectId}/missing`).catch(() => null)
      ]);

      if (complianceRes?.data?.success) {
        setComplianceScore(complianceRes.data.data?.overallScore || null);
      }

      if (missingRes?.data?.success) {
        setMissingRequirements(missingRes.data.data?.total || 0);
      }
    } catch (error) {
      console.error('Failed to load compliance data:', error);
    } finally {
      setLoadingCompliance(false);
    }
  };

  // --- PARSING ENGINE ---
  const { requirements } = useMemo(() => {
    const parsedReqs: ParsedRequirement[] = [];
    const reqArtifacts = artifacts.filter(a => a.type === 'requirement' || a.type === 'mcp' || (a.type === 'design' && a.content.includes('| ID |')));

    // Helper to find links
    const codeArtifacts = artifacts.filter(a => a.type === 'code' || a.type === 'build' || a.type === 'mcp');
    const testArtifacts = artifacts.filter(a => a.type === 'test-plan' || a.type === 'audit-report');
    const designArtifacts = artifacts.filter(a => a.type === 'design' || a.type === 'image');

    const findLinks = (reqId: string) => {
        if (!reqId) return { code: [], tests: [], designs: [] };
        
        // Normalize the requirement ID for matching
        const normalizeId = (id: string) => id.replace(/[-\s_]/g, '').toUpperCase();
        const normalizedReqId = normalizeId(reqId);
        
        // Create multiple matching patterns
        const exactMatch = new RegExp(`\\b${reqId.replace(/[-\s]/g, '[-\\s]?')}\\b`, 'i');
        const normalizedMatch = (text: string) => {
            // Try to find requirement ID patterns in text
            const idPatterns = [
                new RegExp(`\\b${reqId}\\b`, 'i'),
                new RegExp(`\\b${reqId.replace(/[-]/g, '[-\\s_]?')}\\b`, 'i'),
                new RegExp(`\\b${normalizedReqId}\\b`, 'i'),
            ];
            return idPatterns.some(pattern => pattern.test(text));
        };
        
        // Check if artifact matches requirement ID
        const matchesRequirement = (artifact: Artifact): boolean => {
            // 1. Check traceRefs (primary linking mechanism)
            if (artifact.traceRefs && artifact.traceRefs.length > 0) {
                const matchesTraceRef = artifact.traceRefs.some(ref => {
                    const normalizedRef = normalizeId(ref);
                    return normalizedRef === normalizedReqId || 
                           normalizedRef.includes(normalizedReqId) ||
                           normalizedReqId.includes(normalizedRef) ||
                           exactMatch.test(ref);
                });
                if (matchesTraceRef) return true;
            }
            
            // 2. Check artifact title
            if (artifact.title && (exactMatch.test(artifact.title) || normalizedMatch(artifact.title))) {
                return true;
            }
            
            // 3. Check artifact content
            const content = artifact.content || "";
            if (exactMatch.test(content) || normalizedMatch(content)) {
                return true;
            }
            
            // 4. Check artifact tags
            if (artifact.tags && artifact.tags.some(tag => exactMatch.test(tag) || normalizedMatch(tag))) {
                return true;
            }
            
            return false;
        };
        
        return {
            code: codeArtifacts.filter(matchesRequirement),
            tests: testArtifacts.filter(matchesRequirement),
            designs: designArtifacts.filter(matchesRequirement)
        };
    };

    reqArtifacts.forEach(art => {
        const content = art.content || "";
        const lines = content.split('\n');
        let inTable = false;
        let headers: string[] = [];
        let tableParsedCount = 0;
        
        lines.forEach(line => {
            const trimmedLine = line.trim();
            if (trimmedLine.startsWith('|')) {
                const cols = trimmedLine.split('|').map(c => c.trim()).filter(c => c !== '');
                
                if (!inTable) {
                    const headerStr = cols.join(' ').toLowerCase();
                    if (headerStr.includes('id') && (headerStr.includes('desc') || headerStr.includes('req') || headerStr.includes('feature'))) {
                        headers = cols.map(c => c.toLowerCase());
                        inTable = true;
                        return; 
                    }
                }

                if (inTable && trimmedLine.includes('---')) return;

                if (inTable && cols.length >= 2) {
                    const idIdx = headers.findIndex(h => h.includes('id') || h.includes('ref') || h.includes('key'));
                    const descIdx = headers.findIndex(h => h.includes('desc') || h.includes('requirement') || h.includes('feature') || h.includes('definition'));
                    const typeIdx = headers.findIndex(h => h.includes('type') || h.includes('category') || h.includes('kind') || h.includes('area'));
                    const prioIdx = headers.findIndex(h => h.includes('prio') || h.includes('level') || h.includes('sev'));

                    const id = (idIdx > -1 ? cols[idIdx] : cols[0]) || "";
                    const desc = (descIdx > -1 ? cols[descIdx] : cols[1]) || "";
                    
                    const cleanId = id.replace(/\*/g, '').replace(/`/g, '').trim();

                    if (cleanId && cleanId.length < 20 && (cleanId.match(/\d/) || cleanId.toUpperCase().startsWith('REQ') || cleanId.toUpperCase().startsWith('F-'))) {
                        const links = findLinks(cleanId);
                        
                        // Debug logging for empty links
                        if (process.env.NODE_ENV === 'development' && links.code.length === 0 && links.tests.length === 0 && links.designs.length === 0) {
                            console.log(`[RequirementsDashboard] No links found for requirement ${cleanId}. Available artifacts:`, {
                                code: codeArtifacts.length,
                                tests: testArtifacts.length,
                                designs: designArtifacts.length,
                                sampleTraceRefs: codeArtifacts.slice(0, 3).map(a => a.traceRefs)
                            });
                        }
                        
                        let status = 'Defined';
                        if (links.code.length > 0 && links.tests.length > 0) status = 'Verified';
                        else if (links.code.length > 0) status = 'Implemented';

                        parsedReqs.push({
                            id: cleanId,
                            type: typeIdx > -1 ? cols[typeIdx] : 'Functional',
                            description: desc || 'No description',
                            priority: prioIdx > -1 ? cols[prioIdx] : 'Medium',
                            status,
                            sourceArtifactId: art.id,
                            linkedCode: links.code,
                            linkedTests: links.tests,
                            linkedDesigns: links.designs
                        });
                        tableParsedCount++;
                    }
                }
            } else if (trimmedLine === '') {
               if (inTable) inTable = false;
            }
        });

        if (tableParsedCount === 0) {
            const bulletRegex = /^[\*\-1-9\#\.]+\s*(?:\[?\**([A-Z]+-[\d\w]+)\**\]?:?)?\s*(.*)$/i;
            lines.forEach(line => {
                const match = line.match(bulletRegex);
                if (match) {
                    const possibleId = match[1];
                    const content = match[2];
                    if (possibleId && (possibleId.startsWith('REQ') || possibleId.startsWith('USR') || possibleId.startsWith('SYS'))) {
                        const links = findLinks(possibleId);
                        
                        // Debug logging for empty links
                        if (process.env.NODE_ENV === 'development' && links.code.length === 0 && links.tests.length === 0 && links.designs.length === 0) {
                            console.log(`[RequirementsDashboard] No links found for requirement ${possibleId} (bullet format). Available artifacts:`, {
                                code: codeArtifacts.length,
                                tests: testArtifacts.length,
                                designs: designArtifacts.length
                            });
                        }
                        
                         parsedReqs.push({
                            id: possibleId,
                            type: 'Functional', 
                            description: content.trim(),
                            priority: 'Medium',
                            status: 'Defined',
                            sourceArtifactId: art.id,
                            linkedCode: links.code,
                            linkedTests: links.tests,
                            linkedDesigns: links.designs
                        });
                    }
                }
            });
        }
    });

    return { requirements: parsedReqs };
  }, [artifacts]);

  const handleGenerateArchitecture = () => {
      console.log('[RequirementsDashboard] Generate diagram button clicked', { onCreateTask: !!onCreateTask, isGeneratingDiagram });
      
      if (!onCreateTask) {
          console.warn('[RequirementsDashboard] onCreateTask is not available');
          setGenerateError('Task creation is not available. Please ensure you are in workspace mode and not in view-only or demo mode.');
          setTimeout(() => setGenerateError(null), 5000);
          return;
      }
      
      if (isGeneratingDiagram) {
          console.log('[RequirementsDashboard] Already generating, ignoring click');
          return;
      }
      
      setIsGeneratingDiagram(true);
      setGenerateError(null);
      
      try {
          // Collect requirements context for better architecture generation
          const requirementsText = requirements.length > 0 
              ? requirements.slice(0, 10).map(r => `- ${r.id}: ${r.description}`).join('\n')
              : 'No structured requirements found.';
          
          const task: Task = {
              id: Math.random().toString(36).substring(7),
              title: 'Generate Modern Flow Architecture',
              description: `Analyze the project requirements and generate a modern, high-level system architecture visualization using MermaidJS C4 Container diagram format.

**Requirements Context:**
${requirementsText}

**Instructions:**
- Create a C4 Container diagram showing the system architecture
- Include containers for major components (frontend, backend, database, APIs, etc.)
- Show relationships and data flows between components
- Use proper MermaidJS C4 syntax
- The diagram should be comprehensive and reflect the project's technical requirements`,
              assignedTo: AgentRole.DESIGN_ARCH_AGENT,
              phase: Phase.ARCHITECTURE,
              status: TaskStatus.PENDING,
              dependencies: [],
              logs: [],
              progress: 0,
              traceRefs: ['ARCH-FLOW'],
              sprint: currentSprint
          };
          
          console.log('[RequirementsDashboard] Creating architecture generation task:', task.id, task);
          
          // Call onCreateTask and handle any errors
          if (typeof onCreateTask === 'function') {
              onCreateTask(task);
              console.log('[RequirementsDashboard] Task created successfully');
          } else {
              throw new Error('onCreateTask is not a function');
          }
          
          // Reset state after a short delay
          setTimeout(() => {
              setIsGeneratingDiagram(false);
          }, 1000);
      } catch (error: any) {
          console.error('[RequirementsDashboard] Error creating architecture task:', error);
          setGenerateError(error.message || 'Failed to create diagram generation task. Please check the console for details.');
          setIsGeneratingDiagram(false);
          setTimeout(() => setGenerateError(null), 5000);
      }
  };

  // --- FILTERING ---
  const filteredReqs = requirements.filter(r => 
      (r.id || "").toLowerCase().includes(filter.toLowerCase()) || 
      (r.description || "").toLowerCase().includes(filter.toLowerCase())
  );

  // --- METRICS ---
  const total = requirements.length;
  const verified = requirements.filter(r => r.linkedTests.length > 0).length;
  const coveragePct = total > 0 ? Math.round((verified / total) * 100) : 0;

  // --- ARCHITECTURE DATA ---
  // Fallback to projectPreview architecture diagram if no design artifacts exist
  const activeDesign = useMemo(() => {
    const designArtifacts = artifacts.filter(a => a.type === 'design').sort((a, b) => b.timestamp - a.timestamp);
    
    if (designArtifacts.length > 0) {
      return designArtifacts[0];
    }
    
    // If no design artifacts but we have a projectPreview with architecture diagram, create a virtual artifact
    if (projectPreview?.architectureDiagram) {
      const cleanArch = projectPreview.architectureDiagram.replace(/```(?:mermaid|mmd)?/gi, '').replace(/```/g, '').trim();
      if (cleanArch && cleanArch.length > 5) {
        return {
          id: 'preview-architecture',
          title: 'System Architecture.mermaid',
          content: `\`\`\`mermaid\n${cleanArch}\n\`\`\``,
          type: 'design' as const,
          phase: Phase.INITIATION,
          createdBy: AgentRole.DESIGN_ARCH_AGENT,
          timestamp: Date.now(),
          tags: ['Architecture', 'Preview']
        };
      }
    }
    
    return null;
  }, [artifacts, projectPreview]);

  const renderArchitectureContent = () => {
      if (!activeDesign) return null;
      
      const parts = activeDesign.content.split(/(```\s*(?:mermaid|mmd)[\s\S]*?```)/gi);
      // Filter to only valid mermaid blocks for counting
      const validMermaidBlocks = parts.filter(p => {
          const trimmed = p.trim();
          if (!trimmed.toLowerCase().startsWith('```')) return false;
          const code = trimmed.replace(/```\s*(?:mermaid|mmd)?/gi, '').replace(/```/g, '').trim();
          return code.length > 5;
      });
      const diagramCount = validMermaidBlocks.length;

      return (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              
              {/* Header Summary */}
              <div className="bg-gradient-to-r from-slate-800 to-slate-900 rounded-2xl p-6 shadow-lg text-white flex items-center justify-between">
                  <div>
                      <h3 className="text-lg font-bold flex items-center gap-2"><Layout size={20} className="text-blue-400" /> {activeDesign.title}</h3>
                      <p className="text-sm text-slate-300 mt-1 flex items-center gap-4">
                          <span className="flex items-center gap-1"><GitGraph size={14} /> {diagramCount} Visual Model{diagramCount !== 1 ? 's' : ''}</span>
                          <span className="flex items-center gap-1"><Clock size={14} /> {new Date(activeDesign.timestamp).toLocaleDateString()}</span>
                      </p>
                  </div>
                  <button 
                      onClick={handleGenerateArchitecture} 
                      disabled={!onCreateTask || isGeneratingDiagram}
                      className={`px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors backdrop-blur-sm border border-white/10 ${
                          (!onCreateTask || isGeneratingDiagram) ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                      title={!onCreateTask ? 'Task creation is disabled in view-only mode' : isGeneratingDiagram ? 'Generating diagram...' : 'Regenerate architecture diagram'}
                  >
                      {isGeneratingDiagram ? 'Generating...' : 'Regenerate'}
                  </button>
              </div>

              {(() => {
                  let diagramIndex = 0; // Track actual diagram number (1-based)
                  return parts.map((part, index) => {
                      const trimmed = part.trim();
                      if (trimmed.toLowerCase().startsWith('```')) {
                          const code = trimmed.replace(/```\s*(?:mermaid|mmd)?/gi, '').replace(/```/g, '').trim();
                          if (code.length > 5) {
                              diagramIndex++; // Increment for each valid diagram
                              return <DiagramViewer key={index} code={code} title={`Architectural Model #${diagramIndex}`} />;
                          }
                      }
                      if (!trimmed) return null;
                  
                  // Enhancing Text Content
                  return (
                      <div key={index} className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow">
                          <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-primary to-purple-600"></div>
                          <div className="flex items-center gap-2 mb-6 text-slate-400 font-bold uppercase tracking-widest text-xs border-b border-slate-100 pb-2">
                              <Lightbulb size={16} className="text-yellow-500" /> Insight Block
                          </div>
                          <div className="prose prose-sm max-w-none text-slate-600 leading-relaxed font-normal
                              prose-headings:text-slate-800 prose-headings:font-bold 
                              prose-strong:text-slate-900 prose-strong:font-semibold
                              prose-ul:list-disc prose-ul:pl-5 prose-ul:space-y-1
                              prose-li:marker:text-primary
                              prose-blockquote:border-l-4 prose-blockquote:border-primary/30 prose-blockquote:bg-slate-50 prose-blockquote:py-2 prose-blockquote:px-4 prose-blockquote:rounded-r-lg prose-blockquote:text-slate-700 prose-blockquote:not-italic
                              prose-code:text-primary prose-code:bg-primary/5 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:font-mono prose-code:text-[12px]
                          ">
                              <ReactMarkdown>{part}</ReactMarkdown>
                          </div>
                      </div>
                  );
                  });
              })()}
          </div>
      );
  };

  return (
    <div className="h-full flex flex-col bg-slate-50 relative">
        <div className="p-4 bg-white border-b border-slate-200 flex items-center justify-between shrink-0 z-10 shadow-sm">
            <div>
                <h2 className="text-base font-bold text-slate-800 flex items-center gap-2"><Layers className="text-primary" size={18} /> Requirements & Design</h2>
                <p className="text-[10px] text-slate-500 mt-0.5">Manage scope, traceability, and architectural definitions.</p>
            </div>
            <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
                <button onClick={() => setActiveTab('traceability')} className={`px-4 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 ${activeTab === 'traceability' ? 'bg-white text-primary shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}><Table size={14} /> Traceability</button>
                <button onClick={() => setActiveTab('vmodel')} className={`px-4 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 ${activeTab === 'vmodel' ? 'bg-white text-primary shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}><Split size={14} className="rotate-90" /> V-Model</button>
                <button onClick={() => setActiveTab('architecture')} className={`px-4 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 ${activeTab === 'architecture' ? 'bg-white text-primary shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}><Cpu size={14} /> Architecture</button>
            </div>
        </div>

        {activeTab === 'traceability' && (
            <div className="p-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <div className="flex gap-4 items-center">
                    <div className="flex bg-white rounded-lg p-1 border border-slate-200 shadow-sm">
                        <button onClick={() => setViewMode('list')} className={`px-3 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all ${viewMode === 'list' ? 'bg-primary text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}><Table size={14} /> List</button>
                        <button onClick={() => setViewMode('matrix')} className={`px-3 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all ${viewMode === 'matrix' ? 'bg-primary text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}><Grid size={14} /> Matrix</button>
                    </div>
                    <div className="h-6 w-px bg-slate-200"></div>
                    <div className="flex items-center gap-3">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Coverage:</span>
                        <div className="flex items-center gap-2 px-2 py-1 bg-white border border-slate-200 rounded shadow-sm">
                            <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden"><div className={`h-full ${coveragePct > 80 ? 'bg-success' : 'bg-orange-400'}`} style={{ width: `${coveragePct}%` }}></div></div>
                            <span className="text-xs font-mono font-bold text-slate-700">{coveragePct}%</span>
                        </div>
                    </div>
                    {complianceScore !== null && (
                        <>
                            <div className="h-6 w-px bg-slate-200"></div>
                            <div className="flex items-center gap-2 px-2 py-1 bg-white border border-slate-200 rounded shadow-sm">
                                <Target size={12} className="text-primary" />
                                <span className="text-[10px] font-bold text-slate-400 uppercase">Compliance:</span>
                                <span className={`text-xs font-mono font-bold ${complianceScore >= 80 ? 'text-green-600' : complianceScore >= 60 ? 'text-orange-600' : 'text-red-600'}`}>
                                    {loadingCompliance ? '...' : `${complianceScore.toFixed(0)}%`}
                                </span>
                            </div>
                        </>
                    )}
                    {missingRequirements > 0 && (
                        <>
                            <div className="h-6 w-px bg-slate-200"></div>
                            <div className="flex items-center gap-2 px-2 py-1 bg-red-50 border border-red-200 rounded shadow-sm">
                                <AlertTriangle size={12} className="text-red-600" />
                                <span className="text-[10px] font-bold text-red-600 uppercase">Missing:</span>
                                <span className="text-xs font-mono font-bold text-red-600">{missingRequirements}</span>
                            </div>
                        </>
                    )}
                    {projectId && (
                        <>
                            <div className="h-6 w-px bg-slate-200"></div>
                            <button
                                onClick={() => setShowCoverageReport(true)}
                                className="px-3 py-1.5 bg-primary text-white rounded-md text-xs font-bold uppercase tracking-wider hover:bg-blue-600 transition-all flex items-center gap-2 shadow-sm"
                            >
                                <BarChart3 size={14} />
                                Full Report
                            </button>
                        </>
                    )}
                </div>
                <div className="relative">
                    <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input type="text" placeholder="Filter requirements..." value={filter} onChange={(e) => setFilter(e.target.value)} className="pl-7 pr-3 py-1 rounded-lg border border-slate-200 text-xs focus:outline-none focus:border-primary w-56 shadow-sm" />
                </div>
            </div>
        )}

        <div className="flex-1 overflow-auto custom-scrollbar p-4">
            {activeTab === 'traceability' && (
                requirements.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-slate-400">
                        <div className="border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50 p-6 flex flex-col items-center max-w-lg text-center">
                            <FileText size={40} className="mb-3 opacity-50" />
                            <h3 className="text-base font-bold text-slate-600">No Structured Requirements Found</h3>
                            <p className="text-xs mt-2 text-slate-500 leading-relaxed">The dashboard parses artifacts for Markdown tables containing <strong>ID</strong>, <strong>Description</strong>, and <strong>Type</strong> columns.</p>
                        </div>
                    </div>
                ) : viewMode === 'list' ? (
                    <div className="space-y-2">
                        {filteredReqs.map((req, index) => (
                            <div key={`${req.sourceArtifactId}-${req.id}-${index}`} className="bg-white border border-slate-200 rounded-lg p-3 shadow-sm hover:shadow-md transition-shadow group">
                                <div className="flex items-start justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        <div className="px-1.5 py-0.5 bg-slate-100 rounded text-[10px] font-mono font-bold text-slate-700 border border-slate-200">{req.id}</div>
                                        <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border ${req.status === 'Verified' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-slate-50 text-slate-500 border-slate-200'}`}>{req.status}</span>
                                        <span className="text-[10px] text-slate-400 font-medium">{req.type} • {req.priority}</span>
                                    </div>
                                </div>
                                <p className="text-xs text-slate-700 leading-relaxed mb-2 pl-1">{req.description}</p>
                                <div className="flex items-center gap-3 pt-2 border-t border-slate-100">
                                    <div className="flex items-center gap-2"><span className={`text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 ${req.linkedCode.length ? 'text-blue-600' : 'text-slate-400'}`}><Code size={12} /> Implemented:</span>{req.linkedCode.length > 0 ? (<div className="flex flex-wrap gap-1">{req.linkedCode.map(art => (<span key={art.id} className="text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded border border-blue-100 truncate max-w-[150px]" title={art.title}>{art.title}</span>))}</div>) : (<span className="text-[10px] text-orange-400 italic flex items-center gap-1"><AlertCircle size={10} /> Pending</span>)}</div>
                                    <div className="w-px h-4 bg-slate-200"></div>
                                    <div className="flex items-center gap-2"><span className={`text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 ${req.linkedTests.length ? 'text-green-600' : 'text-slate-400'}`}><CheckSquare size={12} /> Verified:</span>{req.linkedTests.length > 0 ? (<div className="flex flex-wrap gap-1">{req.linkedTests.map(art => (<span key={art.id} className="text-[10px] px-1.5 py-0.5 bg-green-50 text-green-600 rounded border border-green-100 truncate max-w-[150px]" title={art.title}>{art.title}</span>))}</div>) : (<span className="text-[10px] text-red-400 italic flex items-center gap-1"><AlertCircle size={10} /> Unverified</span>)}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50 border-b border-slate-200 text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                                        <th className="p-2 w-20 sticky left-0 bg-slate-50 z-10 border-r border-slate-200">ID</th>
                                        <th className="p-2 w-96">Requirement</th>
                                        <th className="p-2 w-24 text-center">Design</th>
                                        <th className="p-2 w-24 text-center">Code</th>
                                        <th className="p-2 w-24 text-center">Test</th>
                                        <th className="p-2 w-24 text-center">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                                    {filteredReqs.map((req, index) => (
                                        <tr key={`${req.sourceArtifactId}-${req.id}-${index}`} className="hover:bg-slate-50 transition-colors">
                                            <td className="p-2 font-mono font-bold text-slate-600 sticky left-0 bg-white group-hover:bg-slate-50 border-r border-slate-100 text-[10px]">{req.id}</td>
                                            <td className="p-2"><div className="line-clamp-2" title={req.description}>{req.description}</div></td>
                                            <td className="p-2 text-center">{req.linkedDesigns.length > 0 ? <div className="flex justify-center"><div className="w-5 h-5 rounded bg-purple-100 text-purple-600 flex items-center justify-center cursor-help"><Layers size={12} /></div></div> : <div className="w-1.5 h-1.5 rounded-full bg-slate-200 mx-auto"></div>}</td>
                                            <td className="p-2 text-center">{req.linkedCode.length > 0 ? <div className="flex justify-center"><div className="w-5 h-5 rounded bg-blue-100 text-blue-600 flex items-center justify-center cursor-help"><Code size={12} /></div></div> : <div className="w-1.5 h-1.5 rounded-full bg-slate-200 mx-auto"></div>}</td>
                                            <td className="p-2 text-center">{req.linkedTests.length > 0 ? <div className="flex justify-center"><div className="w-5 h-5 rounded bg-green-100 text-green-600 flex items-center justify-center cursor-help"><CheckSquare size={12} /></div></div> : <div className="w-1.5 h-1.5 rounded-full bg-slate-200 mx-auto"></div>}</td>
                                            <td className="p-2 text-center">{req.status === 'Verified' ? <CheckCircle size={16} className="text-green-500 mx-auto" /> : req.status === 'Implemented' ? <Activity size={16} className="text-blue-500 mx-auto" /> : <div className="w-2 h-2 rounded-full bg-slate-300 mx-auto"></div>}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )
            )}

            {activeTab === 'vmodel' && (
                <div className="h-full -m-6 min-h-0">
                    <VModelTraceability requirements={requirements} />
                </div>
            )}

            {activeTab === 'architecture' && (
                !activeDesign ? (
                    <div className="flex flex-col items-center justify-center h-full text-slate-400">
                        <div className="border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50 p-10 flex flex-col items-center max-w-lg text-center">
                            <GitGraph size={64} className="mb-4 opacity-50 text-primary" />
                            <h3 className="text-lg font-bold text-slate-600">Architecture Not Defined</h3>
                            <p className="text-sm mt-2 text-slate-500 leading-relaxed">Generate a visual C4 Model or Flowchart.</p>
                            {generateError && (
                                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs max-w-md">
                                    {generateError}
                                </div>
                            )}
                            <div className="mt-8">
                                <button 
                                    onClick={handleGenerateArchitecture} 
                                    disabled={!onCreateTask || isGeneratingDiagram} 
                                    className={`px-6 py-3 bg-primary hover:bg-blue-600 text-white rounded-xl font-bold text-sm uppercase tracking-wider shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all flex items-center gap-2 ${
                                        (!onCreateTask || isGeneratingDiagram) ? 'opacity-50 cursor-not-allowed' : ''
                                    }`}
                                >
                                    {isGeneratingDiagram ? (
                                        <>
                                            <RefreshCw size={16} className="animate-spin" />
                                            Generating...
                                        </>
                                    ) : (
                                        <>
                                            <Play size={16} className="fill-current" />
                                            Generate Diagram
                                        </>
                                    )}
                                </button>
                                {!onCreateTask && (
                                    <p className="mt-2 text-xs text-slate-400">Task creation is disabled in view-only mode</p>
                                )}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col w-full max-w-6xl mx-auto">
                        <div className="w-full">
                            {renderArchitectureContent()}
                        </div>
                    </div>
                )
            )}
        </div>

        {showCoverageReport && projectId && (
            <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
                <div className="bg-white rounded-lg shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-auto">
                    <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between z-10">
                        <h3 className="text-xl font-bold text-gray-800">Requirements Compliance Report</h3>
                        <button
                            onClick={() => setShowCoverageReport(false)}
                            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                            <X size={20} className="text-gray-600" />
                        </button>
                    </div>
                    <div className="p-4">
                        <RequirementsCoverageReport projectId={projectId} onClose={() => setShowCoverageReport(false)} />
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};

export default RequirementsDashboard;
