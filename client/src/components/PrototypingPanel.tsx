import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'; // Device view update check
import { FileText, Layers, Zap, Sparkles, Palette, RefreshCw, Code, Smartphone, Tablet, Monitor, Globe, Package, AlertTriangle, CheckCircle2, Terminal, Database, Shield, Rocket, ChevronDown, ChevronUp, Target, Users, TrendingUp, BarChart3, Lightbulb, GitBranch, Hammer, Check, CheckSquare, ArrowRight, ArrowLeft, Network, Minimize2, Maximize2, ZoomIn, ZoomOut, Move, RotateCcw, AlertCircle, Gamepad2 } from 'lucide-react';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import PreviewFrame from './PreviewFrame';
import PrototypePreviewToast from './PrototypePreviewToast';
import { ProjectPreview } from '../services/geminiService';
import { Artifact, Phase, FeatureCoverage } from '@orbitai/shared';
import MaturityAssessment from './MaturityAssessment';
import { calculateMaturityAssessment, calculateHybridMaturityAssessment } from '@src/utils/maturityAssessment';
import OrbGraph, { Idea, CATEGORY_STYLES } from './OrbGraph';
import IdeaTreeGraph from './IdeaTreeGraph';
import GameMechanicsPanel from './GameMechanicsPanel';
// Graph3D removed
import { v4 as uuidv4 } from 'uuid';


// Helper function for cleaning Mermaid code - extracted from component
// Helper function for cleaning Mermaid code - synchronized with PreviewFrame
const cleanMermaidCode = (rawCode: string): string => {
  if (!rawCode) return '';

  // ===== PASS 0: Detect and convert PlantUML to Mermaid =====
  // PlantUML (used by C4-PlantUML) is NOT compatible with Mermaid
  // If we detect PlantUML syntax, we need to strip it and convert to Mermaid C4
  const isPlantUML =
    rawCode.includes('!define') ||
    rawCode.includes('!include') ||
    rawCode.includes('@startuml') ||
    rawCode.includes('@enduml') ||
    rawCode.includes('$sprite') ||
    rawCode.includes('AddRelTag') ||
    rawCode.includes('LAYOUT_') ||
    /plantuml-icon-font-sprites/.test(rawCode) ||
    /C4-PlantUML/.test(rawCode) ||
    /AWSPuml|AzurePuml/.test(rawCode); // AWS/Azure C4 libraries

  let cleaned = rawCode;

  if (isPlantUML) {
    console.log('[PrototypingPanel] PlantUML detected - converting to Mermaid C4 format');

    // Remove PlantUML-specific directives
    cleaned = cleaned
      .replace(/!define\s+[^\n]+/g, '')           // Remove !define lines
      .replace(/!include\s+[^\n]+/g, '')          // Remove !include lines
      .replace(/!includeurl\s+[^\n]+/g, '')       // Remove !includeurl lines
      .replace(/@startuml[^\n]*/g, '')            // Remove @startuml
      .replace(/@enduml/g, '')                    // Remove @enduml
      .replace(/skinparam\s+[^\n]+/g, '')         // Remove skinparam lines
      .replace(/AddRelTag\([^)]+\)/g, '')         // Remove AddRelTag calls
      .replace(/AddElementTag\([^)]+\)/g, '')     // Remove AddElementTag calls
      .replace(/LAYOUT_[A-Z_]+\(\)/g, '')         // Remove LAYOUT_* calls
      .replace(/SHOW_[A-Z_]+\(\)/g, '')           // Remove SHOW_* calls
      .replace(/UpdateLayoutConfig\([^)]+\)/g, '') // Remove UpdateLayoutConfig
      .replace(/\$sprite\s*=\s*[^,)]+/g, '')      // Remove $sprite parameters
      .replace(/,\s*\$sprite\s*=[^,)]+/g, '')     // Remove trailing sprite parameters
      .replace(/,\s*\$tags\s*=[^,)]+/g, '')       // Remove $tags parameters
      .replace(/,\s*\$link\s*=[^,)]+/g, '');      // Remove $link parameters

    // Convert PlantUML C4 function syntax to Mermaid C4 syntax
    // PlantUML uses: System_Boundary(alias, "Label") { ... }
    // Mermaid uses: System_Boundary(alias, "Label") with close brace on same nesting

    // Handle System_Boundary and similar boundary constructs
    cleaned = cleaned
      // Fix Boundary() standalone calls that might have been truncated
      .replace(/Boundary\(([^)]+)\)/g, 'System_Boundary($1)')
      // Convert Enterprise_Boundary to System_Boundary (Mermaid doesn't have Enterprise)
      .replace(/Enterprise_Boundary/g, 'System_Boundary')
      // Convert Deployment_Node to Container (closest Mermaid equivalent)
      .replace(/Deployment_Node/g, 'Container')
      // Fix trailing { from PlantUML boundary syntax - Mermaid uses { on same line
      .replace(/\)\s*\{/g, ') {')
      // Remove standalone closing braces from PlantUML (Mermaid handles nesting differently)
      .replace(/^\s*\}\s*$/gm, '}');

    // Convert PlantUML relationship syntax to Mermaid
    // PlantUML: Rel(from, to, "label", "technology")
    // Mermaid: Rel(from, to, "label", "technology") - same format, but clean up
    cleaned = cleaned
      // Fix Rel_D, Rel_U, Rel_L, Rel_R (directional) to just Rel
      .replace(/Rel_[DULR]\(/g, 'Rel(')
      // Fix BiRel to Rel
      .replace(/BiRel\(/g, 'Rel(');

    // Clean up empty lines and extra whitespace
    cleaned = cleaned
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .join('\n');

    // Ensure proper C4 diagram type at the start
    // Check what type of diagram this should be based on content
    const hasContainers = cleaned.includes('Container(') || cleaned.includes('Container_Db(') || cleaned.includes('ContainerDb(');
    const hasSystems = cleaned.includes('System(') || cleaned.includes('System_Ext(');
    const hasPersons = cleaned.includes('Person(') || cleaned.includes('Person_Ext(');
    const hasBoundaries = cleaned.includes('System_Boundary(') || cleaned.includes('Container_Boundary(');

    // Determine the right C4 diagram type
    let diagramType = 'C4Container'; // Default
    if (hasContainers || hasBoundaries) {
      diagramType = 'C4Container';
    } else if (hasSystems && !hasContainers) {
      diagramType = 'C4Context';
    }

    // Prepend diagram type if not already present
    if (!cleaned.startsWith('C4Container') && !cleaned.startsWith('C4Context') && !cleaned.startsWith('C4Component') && !cleaned.startsWith('C4Dynamic') && !cleaned.startsWith('C4Deployment')) {
      cleaned = diagramType + '\n' + cleaned;
    }

    console.log('[PrototypingPanel] Converted PlantUML to Mermaid C4:', cleaned.substring(0, 300));
  }

  // Basic cleanup first
  cleaned = cleaned.replace(/```(?:mermaid|mmd)?/gi, '').replace(/```/g, '').trim();

  // Fix line breaks within strings (common issue from LLM generation)
  // This must happen first before other transformations
  // Process the code character by character to properly handle escaped quotes
  let fixedCode = '';
  let inString = false;
  let stringChar = null;
  let i = 0;

  while (i < cleaned.length) {
    const char = cleaned[i];
    const prevChar = i > 0 ? cleaned[i - 1] : null;

    // Check if we're entering or exiting a string
    if (!inString && (char === '"' || char === "'")) {
      inString = true;
      stringChar = char;
      fixedCode += char;
    } else if (inString && char === stringChar && prevChar !== '\\') {
      // Exiting string (not escaped quote)
      inString = false;
      stringChar = null;
      fixedCode += char;
    } else if (inString && (char === '\n' || char === '\r')) {
      // Replace line breaks within strings with spaces
      if (fixedCode[fixedCode.length - 1] !== ' ') {
        fixedCode += ' ';
      }
    } else {
      fixedCode += char;
    }
    i++;
  }

  cleaned = fixedCode;

  // Fix common Mermaid syntax issues
  cleaned = cleaned
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/&amp;/g, '&')
    // NOTE: Do NOT transform Container_Boundary, Container_Db, Container_Ext, etc.
    // These are valid Mermaid C4 constructs. Only transform unknown suffixes.
    // Actually, these patterns were causing issues - removing them entirely
    // as Mermaid C4 uses underscores in valid function names
    // Fix C4ContainerPerson -> C4Person
    .replace(/C4ContainerPerson/gi, 'C4Person')
    .replace(/C4ContainerSystem/gi, 'C4System')
    .replace(/SystemBoun(dary)?/gi, 'SystemBoundary');

  // Remove Rel() calls that use C4 directives as identifiers (invalid syntax)
  // C4Person, C4Container, C4System are directives, not identifiers
  let cleanIndex = 0;
  while (cleanIndex < cleaned.length) {
    const relIndex = cleaned.indexOf('Rel(', cleanIndex);
    if (relIndex < 0) break;

    // Find the matching closing paren (handle nested parentheses and quotes)
    let parenCount = 1;
    let currentIndex = relIndex + 4;
    let inQuotes = false;
    let quoteChar = null;

    while (currentIndex < cleaned.length && parenCount > 0) {
      const char = cleaned[currentIndex];
      if (!inQuotes && (char === '"' || char === "'")) {
        inQuotes = true;
        quoteChar = char;
      } else if (inQuotes && char === quoteChar && cleaned[currentIndex - 1] !== '\\') {
        inQuotes = false;
        quoteChar = null;
      } else if (!inQuotes) {
        if (char === '(') parenCount++;
        else if (char === ')') parenCount--;
      }
      currentIndex++;
    }

    const relCall = cleaned.substring(relIndex, currentIndex);
    // Check if this Rel() call contains a C4 directive as an argument
    if (relCall.match(/Rel\s*\(\s*C4(Person|Container|System)\s*,/i) ||
      relCall.match(/Rel\s*\([^,]+,\s*C4(Person|Container|System)\s*,/i)) {
      // Remove this invalid Rel() call
      cleaned = cleaned.substring(0, relIndex) + cleaned.substring(currentIndex);
      // Don't advance cleanIndex - check same position again
    } else {
      cleanIndex = currentIndex;
    }
  }

  // Convert arrow syntax to Rel() for C4 diagrams
  cleaned = cleaned.replace(/([A-Za-z0-9_]+)\s*->\s*([A-Za-z0-9_]+)(?:\s*:\s*([^,\n)]+))?/g, (match, source, target, label) => {
    if (source.match(/^C4(Container|Person|System)$/i) || target.match(/^C4(Container|Person|System)$/i)) {
      return ''; // Remove invalid arrows
    }
    if (label) {
      const cleanLabel = label.trim().replace(/^["']|["']$/g, '').replace(/"/g, '\\"');
      return 'Rel(' + source + ', ' + target + ', "' + cleanLabel + '")';
    }
    return 'Rel(' + source + ', ' + target + ', "")';
  });

  // Final cleanup
  return cleaned.replace(/[`]/g, '\\`').split('\n').filter(l => l.trim().length > 0).join('\n');
};



// Use a memoized version of ReactMarkdown for performance
const MemoizedMarkdown = React.memo(ReactMarkdown);

// PERF: Create remarkPlugins array once to prevent re-renders
const REMARK_PLUGINS = [remarkGfm];

// PERF: CollapsibleSection moved outside component to prevent recreation on every render
const CollapsibleSection: React.FC<{
  title: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  iconColor?: string;
  defaultExpanded?: boolean;
  children: React.ReactNode;
}> = React.memo(({ title, icon: Icon, iconColor = "text-primary", defaultExpanded = false, children }) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <div className="bg-white/60 rounded-lg border border-white/80 shadow-sm overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between gap-2 p-3 hover:bg-white/40 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Icon size={14} className={iconColor} />
          <h2 className="text-sm font-bold text-slate-800">{title}</h2>
        </div>
        {isExpanded ? (
          <ChevronUp size={14} className="text-slate-500" />
        ) : (
          <ChevronDown size={14} className="text-slate-500" />
        )}
      </button>
      {isExpanded && (
        <div className="px-3 pb-3 pt-1 border-t border-white/60">
          {children}
        </div>
      )}
    </div>
  );
});

interface PrototypingPanelProps {
  projectPreview: ProjectPreview | null;
  onClose: () => void;
  onArtifactCreate: (artifact: Omit<Artifact, 'id' | 'created' | 'lastModified' | 'createdBy'>) => void;
  onGenerateTheme?: (description: string) => Promise<{ primary: string; secondary: string; accent: string; background: string; textColor: string }>;
  onLaunchProject?: (platform?: string, features?: string[]) => Promise<void>;
  conversationMessages: any[]; // Replace with specific type if available
  ideas: Idea[];
  keyInsights: string[];
  selectedStandards: string[];
  userSelectedFeatures: Idea[];
  // Optional props that might be missing but used
  projectName?: string;
  projectDescription?: string;
  artifacts?: Artifact[];
  useInternet?: boolean;
  onRegeneratePrototype?: (section?: 'wireframe' | 'architecture') => void;
  isRefining?: boolean;
  featureCoverage?: FeatureCoverage;
}

const PrototypingPanel: React.FC<PrototypingPanelProps> = ({
  projectPreview,
  onClose,
  onArtifactCreate,
  onGenerateTheme,
  onLaunchProject,
  conversationMessages = [],
  ideas = [],
  keyInsights = [],
  selectedStandards = [],
  userSelectedFeatures = [],
  projectName,
  projectDescription = '',
  artifacts = [],
  useInternet = false,
  onRegeneratePrototype,
  isRefining = false,
  featureCoverage
}) => {
  // Derive graph ideas with recursive parent search for complete hierarchy
  const graphIdeas = useMemo(() => {
    if (!userSelectedFeatures || userSelectedFeatures.length === 0) return [];
    if (!ideas || ideas.length === 0) return userSelectedFeatures;

    const selectedIds = new Set(userSelectedFeatures.map(f => f.id));
    const resultIds = new Set(selectedIds);
    const result = [...userSelectedFeatures];

    // Iteratively search for parents to avoid recursion limits and ensure all ancestors are found
    let currentLevel = userSelectedFeatures;

    // Limit iterations to prevent infinite loops in case of malformed data
    for (let i = 0; i < 10; i++) {
      const parentsFound: Idea[] = [];
      currentLevel.forEach(idea => {
        if (idea.parentId) {
          const parent = ideas.find(p => p.id === idea.parentId);
          if (parent && !resultIds.has(parent.id)) {
            resultIds.add(parent.id);
            parentsFound.push(parent);
          }
        }
      });
      if (parentsFound.length === 0) break;
      result.push(...parentsFound);
      currentLevel = parentsFound;
    }
    return result;
  }, [userSelectedFeatures, ideas]);

  // Generate Architecture Diagram HTML source
  const architectureSrcDoc = useMemo(() => {
    if (!projectPreview?.architectureDiagram) {
      console.log('[Architecture] No diagram in projectPreview');
      return '';
    }

    let cleanedDiagram = cleanMermaidCode(projectPreview.architectureDiagram);
    console.log('[Architecture] Original diagram:', projectPreview.architectureDiagram.substring(0, 200));
    console.log('[Architecture] Cleaned diagram:', cleanedDiagram.substring(0, 200));

    // C4Container is supported in Mermaid 10+ with the correct imports, but often fails in basic setups
    // We'll try to use the original C4 if possible, but fallback to a SAFE flowchart if it looks broken
    // The previous conversion logic was aggressive and prone to syntax errors

    // Check if we need to convert C4 to Flowchart (only if completely necessary or requested)
    // For now, we'll trust the cleaned logic but provide a cleaner environment

    if (!cleanedDiagram || cleanedDiagram.trim().length === 0) {
      return `<!DOCTYPE html><html><body><div style="text-align:center;padding:20px;color:#666;">No Architecture Diagram Available</div></body></html>`;
    }

    // Escape backticks in the diagram code to prevent breaking the template string
    const escapedDiagram = cleanedDiagram.replace(/`/g, '\\`').replace(/\${/g, '\\${');

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <script type="module">
            import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.esm.min.mjs';
            mermaid.initialize({ 
              startOnLoad: true, 
              theme: 'default', 
              securityLevel: 'loose',
              flowchart: {
                curve: 'basis',
                padding: 20
              },
              // Enable C4 diagram support explicitly if needed (v10 supports it natively usually)
            });
          </script>
          <style>
            body { margin: 0; padding: 20px; background: white; font-family: sans-serif; height: 100vh; display: flex; align-items: center; justify-content: center; overflow: auto; }
            .mermaid { max-width: 100%; }
            .error { color: red; padding: 20px; text-align: center; }
          </style>
        </head>
        <body>
          <div class="mermaid">${escapedDiagram}</div>
        </body>
      </html>
    `;
  }, [projectPreview?.architectureDiagram, projectPreview?.techStack]);

  // ... (repeat for other buttons)

  const [activeTab, setActiveTab] = useState<'blueprint' | 'architecture' | 'prototype' | 'buildProject' | 'brainstorm'>('blueprint');
  const [previewMode, setPreviewMode] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [graphViewMode, setGraphViewMode] = useState<'orb' | 'tree'>('tree');
  const [codeView, setCodeView] = useState<'web' | 'react-native' | 'flutter' | 'ios' | 'android'>('web');
  const [customTheme, setCustomTheme] = useState<{ primary: string; secondary: string; accent: string; background: string; textColor: string } | null>(null);
  const [isGeneratingTheme, setIsGeneratingTheme] = useState(false);
  const [themeDescription, setThemeDescription] = useState('');
  const [isAIBuildExpanded, setIsAIBuildExpanded] = useState(false);
  const [aiBuildStep, setAiBuildStep] = useState<'features' | 'platform'>('features');
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([]);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // View state for toggling between End User App and Admin Console
  const [activeView, setActiveView] = useState<'endUser' | 'adminConsole'>('endUser');

  // Prototype Preview Toast state - shows browser-like preview after generation
  const [showPreviewToast, setShowPreviewToast] = useState(false);
  const [previewApproved, setPreviewApproved] = useState(false);
  const hasShownToastRef = useRef(false);

  // Auto-show preview toast when wireframe is first generated
  useEffect(() => {
    const wireframeCode = projectPreview?.wireframeCode;
    if (wireframeCode && wireframeCode.length > 100 && !hasShownToastRef.current && !previewApproved) {
      // Show toast after small delay to let panel render
      const timer = setTimeout(() => {
        setShowPreviewToast(true);
        hasShownToastRef.current = true;
        console.log('[PrototypingPanel] Preview toast auto-shown');
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [projectPreview?.wireframeCode, previewApproved]);

  // Toast action handlers
  const handlePreviewApprove = useCallback(() => {
    setShowPreviewToast(false);
    setPreviewApproved(true);
    console.log('[PrototypingPanel] Preview approved by user');
  }, []);

  const handlePreviewRegenerate = useCallback(() => {
    setShowPreviewToast(false);
    hasShownToastRef.current = false; // Allow toast to show again after regeneration
    if (onRegeneratePrototype) {
      onRegeneratePrototype('wireframe');
    }
    console.log('[PrototypingPanel] Regeneration requested by user');
  }, [onRegeneratePrototype]);

  const handlePreviewClose = useCallback(() => {
    setShowPreviewToast(false);
    setPreviewApproved(true); // Treat close as implicit approval
  }, []);

  // Quick refinement handler for toast chat
  const [isToastRefining, setIsToastRefining] = useState(false);
  const handlePreviewRefine = useCallback(async (refinementMessage: string) => {
    console.log('[PrototypingPanel] Refining with message:', refinementMessage);
    setIsToastRefining(true);

    try {
      // Call the regenerate with the refinement context
      if (onRegeneratePrototype) {
        // Store the refinement message for the regeneration process
        // The regeneration will pick this up and use it as context
        (window as any).__orbitai_refinement_context = refinementMessage;
        hasShownToastRef.current = false; // Allow toast to re-show after update
        await onRegeneratePrototype('wireframe');
      }
    } finally {
      setIsToastRefining(false);
      // Clear the refinement context
      delete (window as any).__orbitai_refinement_context;
    }
  }, [onRegeneratePrototype]);

  // Game-Dashboard event relay
  const dashboardIframeRef = useRef<HTMLIFrameElement>(null);
  useEffect(() => {
    const handleGameEvent = (event: MessageEvent) => {
      // Relay game events to dashboard iframe
      if (event.data.source === 'orbitai-game') {
        // Forward to dashboard with relay marker
        const dashboardFrame = document.querySelector('iframe[title*="Game Dashboard"], iframe[title*="Admin Console"]') as HTMLIFrameElement;
        if (dashboardFrame?.contentWindow) {
          dashboardFrame.contentWindow.postMessage({
            ...event.data,
            source: 'orbitai-game-relay'
          }, '*');
        }
      }
    };

    window.addEventListener('message', handleGameEvent);
    return () => window.removeEventListener('message', handleGameEvent);
  }, []);

  // Architecture diagram pan/zoom state
  const [archZoom, setArchZoom] = useState(1);
  const [archPan, setArchPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const archContainerRef = useRef<HTMLDivElement>(null);

  // Architecture diagram pan/zoom handlers
  const handleZoomIn = () => {
    setArchZoom(prev => Math.min(prev + 0.25, 3));
  };

  const handleZoomOut = () => {
    setArchZoom(prev => Math.max(prev - 0.25, 0.5));
  };

  const handleResetView = () => {
    setArchZoom(1);
    setArchPan({ x: 0, y: 0 });
  };

  // Auto-fit diagram to screen on initial load
  useEffect(() => {
    if (!iframeRef.current || !archContainerRef.current || !projectPreview?.architectureDiagram) return;

    const calculateFitZoom = () => {
      try {
        const container = archContainerRef.current;
        const iframe = iframeRef.current;
        if (!container || !iframe) return;

        const containerRect = container.getBoundingClientRect();
        const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
        if (!iframeDoc || !iframeDoc.body) return;

        // Get diagram natural dimensions
        const diagramWidth = iframeDoc.body.scrollWidth || 800;
        const diagramHeight = iframeDoc.body.scrollHeight || 600;

        // Calculate zoom to fit  
        const scaleX = containerRect.width / diagramWidth;
        const scaleY = containerRect.height / diagramHeight;
        const fitZoom = Math.min(scaleX, scaleY, 1.5); // Cap at 150% to avoid over-zooming

        // Only auto-fit if current zoom is default (1), don't override user's manual zoom
        if (archZoom === 1 && fitZoom > 0.3 && fitZoom < 1) {
          setArchZoom(Number(fitZoom.toFixed(2)));
        }
      } catch (err) {
        console.warn('[ArchDiagram] Auto-fit calculation failed:', err);
      }
    };

    // Wait for iframe content to load
    const timer = setTimeout(calculateFitZoom, 500);
    return () => clearTimeout(timer);
  }, [projectPreview?.architectureDiagram, iframeRef.current, archContainerRef.current]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0) { // Left mouse button
      setIsPanning(true);
      setPanStart({ x: e.clientX - archPan.x, y: e.clientY - archPan.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      setArchPan({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y
      });
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setArchZoom(prev => Math.max(0.5, Math.min(3, prev + delta)));
  };

  // Auto-scroll logs - Removed as `isGenerating` and `statusLogs` are no longer props.

  // If generating, show the Mission Control View (Split View) - Removed as `isGenerating` is no longer a prop.


  // Create artifact from wireframe code for PreviewFrame
  const wireframeArtifact = useMemo<Artifact | null>(() => {
    // Determine target code based on active view
    let targetCode = projectPreview?.wireframeCode || '';

    // Switch between views if available
    if (projectPreview?.views) {
      if (activeView === 'endUser' && projectPreview.views.endUser?.wireframe) {
        targetCode = projectPreview.views.endUser.wireframe;
      } else if (activeView === 'adminConsole' && projectPreview.views.adminConsole?.wireframe) {
        targetCode = projectPreview.views.adminConsole.wireframe;
      }
    }

    // Debug: log what we have
    console.log('[PrototypingPanel] wireframeCode check:', {
      hasProjectPreview: !!projectPreview,
      activeView,
      targetCodeLength: targetCode?.length || 0,
      projectName: projectPreview?.projectName
    });

    if (!targetCode || targetCode.trim().length === 0) {
      console.warn('[PrototypingPanel] No wireframe code available for view:', activeView);
      return null;
    }

    // Basic validation - check if it looks like valid HTML
    const cleanCode = targetCode.trim();
    if (cleanCode.length < 50) {
      console.warn('[PrototypingPanel] Wireframe code seems too short:', cleanCode.length);
    }

    return {
      id: `prototype-${activeView}`,
      title: activeView === 'adminConsole' ? 'Admin Console Prototype' : 'Project Prototype',
      content: cleanCode,
      type: 'build',
      phase: Phase.ARCHITECTURE,
      created: Date.now(),
      timestamp: Date.now(),
      lastModified: Date.now(),
      createdBy: 'AI',
      tags: ['prototype', 'wireframe', activeView]
    };
  }, [projectPreview, activeView]);

  // Calculate maturity assessment (AI-powered)
  const [maturityAssessment, setMaturityAssessment] = useState(() => {
    // Start with rule-based assessment immediately
    const allArtifacts = wireframeArtifact ? [...artifacts, wireframeArtifact] : artifacts;
    const hasResearchFindings = conversationMessages.some(m =>
      m.text.includes('Research Findings') ||
      m.text.includes('**Research Findings:**')
    );

    return calculateMaturityAssessment({
      projectName: projectName || projectPreview?.projectName,
      projectDescription,
      conversationMessages,
      projectPreview,
      artifacts: allArtifacts,
      selectedStandards: selectedStandards.length > 0 ? selectedStandards : projectPreview?.recommendedStandards,
      useInternet,
      hasResearchFindings
    });
  });

  // Update assessment when inputs change (with AI enhancement)
  useEffect(() => {
    // Prevent infinite loops by checking if assessment is already updating
    let isCancelled = false;

    const updateAssessment = async () => {
      const allArtifacts = wireframeArtifact ? [...artifacts, wireframeArtifact] : artifacts;
      const hasResearchFindings = conversationMessages?.some(m =>
        m.text?.includes('Research Findings') ||
        m.text?.includes('**Research Findings:**')
      ) || false;

      const input = {
        projectName: projectName || projectPreview?.projectName,
        projectDescription,
        conversationMessages: conversationMessages || [],
        projectPreview,
        artifacts: allArtifacts,
        selectedStandards: selectedStandards.length > 0 ? selectedStandards : projectPreview?.recommendedStandards,
        useInternet,
        hasResearchFindings
      };

      // OPTIMIZATION: Show rule-based assessment immediately (no delay)
      const ruleBasedAssessment = calculateMaturityAssessment(input);
      if (!isCancelled) {
        setMaturityAssessment(ruleBasedAssessment);
      }

      // Then enhance with AI assessment in background (non-blocking)
      if (conversationMessages && conversationMessages.length > 0 && !isCancelled) {
        // Use setTimeout to run AI assessment after initial render
        setTimeout(async () => {
          if (isCancelled) return;
          try {
            const { calculateHybridMaturityAssessment } = await import('@src/utils/maturityAssessment');
            const aiAssessment = await calculateHybridMaturityAssessment(input, true);
            if (!isCancelled) {
              setMaturityAssessment(aiAssessment);
            }
          } catch (error) {
            console.warn('AI assessment failed, keeping rule-based:', error);
            // Keep the rule-based assessment (already set above)
          }
        }, 100); // Small delay to let UI render first
      }
    };

    updateAssessment();

    return () => {
      isCancelled = true;
    };
  }, [
    projectPreview?.projectName,
    projectPreview?.recommendedStandards,
    projectName,
    projectDescription,
    conversationMessages?.length, // Use length instead of full array to avoid reference changes
    artifacts?.length, // Use length instead of full array
    wireframeArtifact?.id, // Use specific property instead of full object
    selectedStandards?.length, // Use length instead of full array
    useInternet
  ]);

  // Get current code based on selected view
  const currentCode = useMemo(() => {
    if (!projectPreview) return null;

    switch (codeView) {
      case 'web':
        return projectPreview.wireframeCode || null;
      case 'react-native':
        return projectPreview.mobileCode?.reactNative || null;
      case 'flutter':
        return projectPreview.mobileCode?.flutter || null;
      case 'ios':
        return projectPreview.mobileCode?.iosSwift || null;
      case 'android':
        return projectPreview.mobileCode?.androidKotlin || null;
      default:
        return null;
    }
  }, [codeView, projectPreview]);

  // Reset AI build step when collapsed
  useEffect(() => {
    if (!isAIBuildExpanded) {
      setAiBuildStep('features');
    }
  }, [isAIBuildExpanded]);

  // Get available features - prioritize userSelectedFeatures from brainstorming
  const availableFeatures = useMemo(() => {
    // PRIORITY 1: Use userSelectedFeatures from brainstorming (Feature Selection Modal)
    if (userSelectedFeatures && userSelectedFeatures.length > 0) {
      return userSelectedFeatures.map(f => f.label);
    }

    // PRIORITY 2: Use features from projectPreview if available
    if (projectPreview?.features && projectPreview.features.length > 0) {
      return projectPreview.features;
    }

    // PRIORITY 3: Extract from all ideas (implementation categories only)
    const implementationCategories = ['feature', 'technology', 'design', 'architecture', 'integration', 'security', 'performance', 'ux', 'data', 'platform', 'idea'];
    const brainstormedFeatures = ideas
      .filter(i => i.id !== 'welcome-bubble' && implementationCategories.includes(i.category || 'idea'))
      .map(i => i.label);

    if (brainstormedFeatures.length > 0) {
      return brainstormedFeatures;
    }

    // PRIORITY 4: Extract features from techStack and summary
    const extractedFeatures: string[] = [];

    // Add based on tech stack
    if (projectPreview?.techStack) {
      if (projectPreview.techStack.some(t => /react|vue|angular/i.test(t))) {
        extractedFeatures.push('Modern Frontend UI');
      }
      if (projectPreview.techStack.some(t => /node|express|django|flask/i.test(t))) {
        extractedFeatures.push('Backend API');
      }
      if (projectPreview.techStack.some(t => /postgres|mysql|mongodb|database/i.test(t))) {
        extractedFeatures.push('Database Integration');
      }
      if (projectPreview.techStack.some(t => /auth|jwt|oauth/i.test(t))) {
        extractedFeatures.push('User Authentication');
      }
    }

    // Default features if nothing extracted
    if (extractedFeatures.length === 0) {
      return [
        'User Interface',
        'Backend Logic',
        'Database Storage',
        'User Authentication',
        'API Endpoints',
        'Real-time Features',
        'Admin Dashboard',
        'Analytics & Reporting'
      ];
    }

    return extractedFeatures;
  }, [userSelectedFeatures, ideas, projectPreview?.features, projectPreview?.techStack]);

  // Get recommended platform from brainstorming
  const recommendedPlatform = useMemo(() => {
    // Check userSelectedFeatures first
    if (userSelectedFeatures && userSelectedFeatures.length > 0) {
      const text = userSelectedFeatures.map(i => i.label.toLowerCase()).join(' ');
      if (text.includes('mobile') || text.includes('ios') || text.includes('android') || text.includes('react native')) return 'mobile';
      if (text.includes('web') || text.includes('website') || text.includes('next.js') || text.includes('react')) return 'web';
      if (text.includes('desktop') || text.includes('electron') || text.includes('tauri')) return 'desktop';
      if (text.includes('api') || text.includes('backend') || text.includes('server')) return 'api';
    }

    // Check all platform ideas
    const platformIdeas = ideas.filter(i => i.category === 'platform');
    if (platformIdeas.length > 0) {
      const text = platformIdeas.map(i => i.label.toLowerCase()).join(' ');
      if (text.includes('mobile') || text.includes('ios') || text.includes('android')) return 'mobile';
      if (text.includes('web') || text.includes('website')) return 'web';
      if (text.includes('desktop') || text.includes('electron')) return 'desktop';
      if (text.includes('api') || text.includes('backend')) return 'api';
    }

    // Fallback to project preview
    if (projectPreview?.summary) {
      const summary = projectPreview.summary.toLowerCase();
      if (summary.includes('mobile app') || summary.includes('ios') || summary.includes('android')) return 'mobile';
      if (summary.includes('web app') || summary.includes('website')) return 'web';
      if (summary.includes('desktop')) return 'desktop';
      if (summary.includes('api') || summary.includes('backend')) return 'api';
    }



    return 'fullstack'; // Default to fullstack if unsure
  }, [userSelectedFeatures, ideas, projectPreview]);

  // Apply theme to prototype iframe
  useEffect(() => {
    if (!customTheme || !iframeRef.current || !wireframeArtifact) return;

    const iframe = iframeRef.current;
    const iframeDocument = iframe.contentDocument || iframe.contentWindow?.document;
    if (!iframeDocument) return;

    // Apply CSS variables for theming
    const style = iframeDocument.createElement('style');
    style.textContent = `
      :root {
        --theme-primary: ${customTheme.primary};
        --theme-secondary: ${customTheme.secondary};
        --theme-accent: ${customTheme.accent};
        --theme-background: ${customTheme.background};
        --theme-text: ${customTheme.textColor};
      }
      body {
        background-color: var(--theme-background) !important;
        color: var(--theme-text) !important;
      }
    `;
    iframeDocument.head.appendChild(style);

    // Force re-render by updating the iframe content
    const currentContent = iframeDocument.documentElement.outerHTML;
    iframeDocument.open();
    iframeDocument.write(currentContent);
    iframeDocument.close();
  }, [customTheme, wireframeArtifact]);

  const handleGenerateTheme = async () => {
    if (!themeDescription.trim() || !onGenerateTheme) return;

    setIsGeneratingTheme(true);
    try {
      const theme = await onGenerateTheme(themeDescription);
      setCustomTheme(theme);
      setThemeDescription('');
    } catch (error) {
      console.error('Failed to generate theme:', error);
    } finally {
      setIsGeneratingTheme(false);
    }
  };

  // Extract features from summary for better display
  const extractFeaturesFromSummary = (summary: string): string => {
    // Try to extract bullet points or numbered lists from summary
    const lines = summary.split('\n');
    const features: string[] = [];

    lines.forEach(line => {
      const trimmed = line.trim();
      // Match bullet points, numbered lists, or lines starting with key feature words
      if (trimmed.match(/^[-*•]\s+/) ||
        trimmed.match(/^\d+[.)]\s+/) ||
        trimmed.match(/^(feature|functionality|capability|component|module|system):/i)) {
        features.push(trimmed.replace(/^[-*•]\s+/, '').replace(/^\d+[.)]\s+/, ''));
      }
    });

    if (features.length > 0) {
      return features.map(f => `- ${f}`).join('\n');
    }

    // Fallback: return a formatted version of key sentences
    const sentences = summary.split(/[.!?]+/).filter(s => s.trim().length > 20);
    return sentences.slice(0, 5).map(s => `- ${s.trim()}`).join('\n');
  };

  // CollapsibleSection moved outside component for performance


  return (
    <div className="w-full h-full flex flex-col bg-white/40 backdrop-blur-xl rounded-2xl border border-white/60 shadow-2xl overflow-hidden relative">

      {/* Tabs Header */}
      <div className="flex items-center gap-0.5 p-1.5 border-b border-white/60 bg-white/30 relative z-50">
        <button
          onClick={() => setActiveTab('blueprint')}
          className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all ${activeTab === 'blueprint'
            ? 'bg-primary text-white shadow-sm'
            : 'text-slate-500 hover:text-slate-700 hover:bg-white/40'
            }`}
        >
          <FileText size={12} />
          <span>Blueprint</span>
        </button>
        <button
          onClick={() => setActiveTab('brainstorm')}
          className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all ${activeTab === 'brainstorm'
            ? 'bg-primary text-white shadow-sm'
            : 'text-slate-500 hover:text-slate-700 hover:bg-white/40'
            }`}
        >
          <Network size={12} />
          <span>Brainstorm</span>
        </button>
        <button
          onClick={() => setActiveTab('architecture')}
          className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all ${activeTab === 'architecture'
            ? 'bg-primary text-white shadow-sm'
            : 'text-slate-500 hover:text-slate-700 hover:bg-white/40'
            }`}
        >
          <Layers size={12} />
          <span>Architecture</span>
        </button>
        <button
          onClick={() => setActiveTab('prototype')}
          className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all ${activeTab === 'prototype'
            ? 'bg-primary text-white shadow-sm'
            : 'text-slate-500 hover:text-slate-700 hover:bg-white/40'
            }`}
        >
          <Zap size={12} />
          <span>Prototype</span>
        </button>

        <button
          onClick={() => setActiveTab('buildProject')}
          className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all ${activeTab === 'buildProject'
            ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-sm'
            : 'text-slate-500 hover:text-slate-700 hover:bg-white/40'
            }`}
        >
          <Hammer size={12} />
          <span>Build</span>
        </button>
        {/* Tab Indicator */}
        {activeTab === 'blueprint' && <div className="absolute bottom-0 left-0 w-1/5 h-0.5 bg-indigo-600 transition-all duration-300 ease-in-out transform translate-x-0" />}
        {activeTab === 'brainstorm' && <div className="absolute bottom-0 left-0 w-1/5 h-0.5 bg-indigo-600 transition-all duration-300 ease-in-out transform translate-x-[100%]" />}
        {activeTab === 'architecture' && <div className="absolute bottom-0 left-0 w-1/5 h-0.5 bg-indigo-600 transition-all duration-300 ease-in-out transform translate-x-[200%]" />}
        {activeTab === 'prototype' && <div className="absolute bottom-0 left-0 w-1/5 h-0.5 bg-indigo-600 transition-all duration-300 ease-in-out transform translate-x-[300%]" />}
        {activeTab === 'buildProject' && <div className="absolute bottom-0 left-0 w-1/5 h-0.5 bg-indigo-600 transition-all duration-300 ease-in-out transform translate-x-[400%]" />}
      </div>

      {/* Tab Content */}
      <div className={`flex-1 ${['brainstorm', 'architecture', 'prototype'].includes(activeTab) ? 'overflow-hidden' : 'overflow-y-auto custom-scrollbar'} p-6 bg-slate-50/50`}>
        {activeTab === 'brainstorm' && (
          <div className="w-full h-[calc(100%-20px)] bg-white rounded-xl border border-slate-200 overflow-hidden shadow-inner relative">
            {/* View Toggle */}
            <div className="absolute top-4 right-4 z-10 flex bg-white/90 backdrop-blur-sm p-1 rounded-lg border border-slate-200 shadow-sm">
              <button
                onClick={() => setGraphViewMode('orb')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 ${graphViewMode === 'orb'
                  ? 'bg-indigo-100 text-indigo-700 shadow-sm'
                  : 'text-slate-600 hover:bg-slate-50'
                  }`}
              >
                <Network size={14} />
                Graph
              </button>
              <button
                onClick={() => setGraphViewMode('tree')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 ${graphViewMode === 'tree'
                  ? 'bg-indigo-100 text-indigo-700 shadow-sm'
                  : 'text-slate-600 hover:bg-slate-50'
                  }`}
              >
                <GitBranch size={14} />
                Tree
              </button>
            </div>

            {graphViewMode === 'orb' ? (
              <OrbGraph
                topic={projectPreview?.projectName || projectName || "My Project"}
                ideas={graphIdeas}
                activeIdeaId={null}
                onIdeaClick={() => { }}
              />
            ) : (
              <IdeaTreeGraph
                topic={projectPreview?.projectName || projectName || "My Project"}
                ideas={graphIdeas}
                activeIdeaId={null}
                onIdeaClick={() => { }}
              />
            )}
            {(!userSelectedFeatures || userSelectedFeatures.length === 0) && (
              <div className="absolute inset-0 flex items-center justify-center text-slate-400">
                <p>No features selected to visualize</p>
              </div>
            )}
            <div className="absolute bottom-4 right-4 bg-white/90 backdrop-blur px-3 py-1.5 rounded-full text-xs font-medium text-slate-500 border border-slate-200 shadow-sm pointer-events-none">
              Visualization of your selected features
            </div>
          </div>
        )}

        {/* Blueprint Tab */}
        {activeTab === 'blueprint' && (
          !projectPreview ? (
            <div className="flex flex-col items-center justify-center min-h-[500px] p-8 space-y-4 text-center text-slate-400">
              <div className="w-20 h-20 rounded-full bg-slate-50 flex items-center justify-center mb-4">
                <FileText size={40} className="text-slate-300" />
              </div>
              <h3 className="text-lg font-semibold text-slate-600">No Blueprint Generated</h3>
              <p className="max-w-xs mx-auto text-sm">
                Start a conversation and ask the AI to generate a project blueprint.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-3">
                {/* Project Header - Enhanced */}
                <div className="bg-gradient-to-r from-primary/10 via-purple-500/10 to-indigo-500/10 backdrop-blur-sm rounded-xl p-4 border border-primary/20 shadow-lg">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      {projectPreview?.projectName && (
                        <h1 className="text-xl font-bold text-slate-800 mb-2 flex items-center gap-2">
                          <Package size={18} className="text-primary" />
                          {projectPreview.projectName}
                        </h1>
                      )}
                      <div className="flex flex-wrap items-center gap-2 mt-3">
                        {projectPreview?.recommendedMethodology && (
                          <div className="flex items-center gap-1.5 text-xs text-slate-700 bg-white/80 px-3 py-1.5 rounded-lg border border-white/80 shadow-sm font-medium">
                            <Rocket size={13} className="text-indigo-500" />
                            <span>{projectPreview.recommendedMethodology}</span>
                          </div>
                        )}
                        {(selectedStandards && selectedStandards.length > 0 ? selectedStandards : (projectPreview?.recommendedStandards || [])).length > 0 && (
                          <div className="flex items-center gap-1.5 text-xs text-slate-700 bg-white/80 px-3 py-1.5 rounded-lg border border-white/80 shadow-sm font-medium">
                            <Shield size={13} className="text-emerald-500" />
                            <span>{(selectedStandards && selectedStandards.length > 0 ? selectedStandards : (projectPreview?.recommendedStandards || [])).length} quality standard{(selectedStandards && selectedStandards.length > 0 ? selectedStandards : (projectPreview?.recommendedStandards || [])).length !== 1 ? 's' : ''}</span>
                          </div>
                        )}
                        {projectPreview?.techStack && projectPreview.techStack.length > 0 && (
                          <div className="flex items-center gap-1.5 text-xs text-slate-700 bg-white/80 px-3 py-1.5 rounded-lg border border-white/80 shadow-sm font-medium">
                            <Terminal size={13} className="text-blue-500" />
                            <span>{projectPreview.techStack.length} technolog{projectPreview.techStack.length !== 1 ? 'ies' : 'y'}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Live Maturity Assessment - Removed from Phase 2, now shown in Phase 1 Glass Panel */}

                {/* Executive Summary - Enhanced */}
                <CollapsibleSection
                  title="Executive Summary"
                  icon={FileText}
                  iconColor="text-primary"
                  defaultExpanded={true}
                >
                  <div className="prose prose-sm max-w-none text-slate-700 text-xs leading-relaxed">
                    <MemoizedMarkdown remarkPlugins={REMARK_PLUGINS}>
                      {projectPreview?.summary || 'No summary available.'}
                    </MemoizedMarkdown>
                  </div>
                </CollapsibleSection>

                {/* Selected Features - User Selected */}
                {userSelectedFeatures && userSelectedFeatures.length > 0 && (
                  <CollapsibleSection
                    title="Selected Features"
                    icon={CheckSquare}
                    iconColor="text-indigo-600"
                    defaultExpanded={false}
                  >
                    <div className="grid grid-cols-2 gap-4">
                      {Array.from(new Set(userSelectedFeatures.map(f => f.category || 'other'))).map(category => {
                        const categoryFeatures = userSelectedFeatures.filter(f => (f.category || 'other') === category);
                        const style = CATEGORY_STYLES[category] || CATEGORY_STYLES.other || { color: '#64748b', icon: '📌', label: 'Other' };

                        return (
                          <div key={category} className="space-y-2">
                            <h4
                              className="text-[10px] font-bold uppercase tracking-wider pl-1 flex items-center gap-1.5"
                              style={{ color: style.color }}
                            >
                              <span>{style.icon}</span>
                              {style.label || category}
                            </h4>
                            <div className="grid grid-cols-1 gap-2">
                              {categoryFeatures.map((feature, index) => (
                                <div
                                  key={feature.id || index}
                                  className="flex flex-col gap-1 p-3 rounded-lg shadow-sm border transition-all hover:shadow-md"
                                  style={{
                                    borderColor: style.color + '40', // 25% opacity border
                                    backgroundColor: style.color + '08' // 5% opacity bg
                                  }}
                                >
                                  <div className="flex items-center gap-2">
                                    <Check size={16} style={{ color: style.color }} className="shrink-0" />
                                    <span className="text-sm font-semibold text-slate-800">{feature.label}</span>
                                  </div>
                                  {feature.description && (
                                    <p className="text-xs text-slate-600 pl-6 leading-relaxed">
                                      {feature.description}
                                    </p>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="mt-4 pt-2 border-t border-slate-200/60">
                      <p className="text-[10px] text-slate-500 italic">
                        ✨ Features prioritized for the prototype build
                      </p>
                    </div>
                  </CollapsibleSection>
                )}

                {/* Feature Coverage Report */}
                {featureCoverage && featureCoverage.totalFeatures > 0 && (
                  <CollapsibleSection
                    title={`Feature Coverage (${featureCoverage.coveragePercentage}%)`}
                    icon={Target}
                    iconColor={featureCoverage.coveragePercentage >= 80 ? 'text-emerald-500' : featureCoverage.coveragePercentage >= 50 ? 'text-amber-500' : 'text-red-500'}
                    defaultExpanded={featureCoverage.coveragePercentage < 80}
                  >
                    <div className="space-y-3">
                      {/* Coverage Bar */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-600">Coverage</span>
                          <span className={`font-bold ${featureCoverage.coveragePercentage >= 80 ? 'text-emerald-600' : featureCoverage.coveragePercentage >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                            {featureCoverage.coveredFeatures}/{featureCoverage.totalFeatures} features
                          </span>
                        </div>
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${featureCoverage.coveragePercentage >= 80 ? 'bg-emerald-500' : featureCoverage.coveragePercentage >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                            style={{ width: `${featureCoverage.coveragePercentage}%` }}
                          />
                        </div>
                      </div>

                      {/* Summary Message */}
                      <div className={`text-xs p-2 rounded-lg ${featureCoverage.coveragePercentage >= 80 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : featureCoverage.coveragePercentage >= 50 ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                        {featureCoverage.coveragePercentage >= 80
                          ? '✅ Excellent coverage! Most features are implemented in the prototype.'
                          : featureCoverage.coveragePercentage >= 50
                            ? '⚠️ Partial coverage. Some features may need refinement.'
                            : '⚠️ Low coverage. Consider regenerating the prototype.'}
                      </div>

                      {/* Per-Feature Breakdown - Hierarchical */}
                      <div className="space-y-1.5">
                        {/* Get parent features (no parentId) first */}
                        {(() => {
                          const parentFeatures = featureCoverage.features.filter(f => !f.parentId);
                          const childFeatures = featureCoverage.features.filter(f => f.parentId);

                          return parentFeatures.map((feature, index) => {
                            // Find children for this parent
                            const children = childFeatures.filter(c => c.parentId === feature.featureId);

                            return (
                              <div key={feature.featureId || index} className="space-y-1">
                                {/* Parent Feature */}
                                <div
                                  className={`flex items-center gap-2 p-2 rounded-lg text-xs ${feature.covered ? 'bg-emerald-50/50 border border-emerald-100' : 'bg-slate-50 border border-slate-100'}`}
                                >
                                  {feature.covered ? (
                                    <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
                                  ) : (
                                    <AlertCircle size={14} className="text-slate-400 shrink-0" />
                                  )}
                                  <span className={`flex-1 font-medium ${feature.covered ? 'text-slate-700' : 'text-slate-500'}`}>
                                    {feature.featureLabel}
                                  </span>
                                  {feature.covered && (
                                    <span className="text-[10px] text-emerald-600 bg-emerald-100 px-1.5 py-0.5 rounded">
                                      {Math.round(feature.confidence * 100)}%
                                    </span>
                                  )}
                                </div>

                                {/* Child Features - Indented */}
                                {children.length > 0 && (
                                  <div className="ml-4 pl-3 border-l-2 border-slate-200 space-y-1">
                                    {children.map((child, childIndex) => (
                                      <div
                                        key={child.featureId || `child-${childIndex}`}
                                        className={`flex items-center gap-2 p-1.5 rounded-md text-xs ${child.covered ? 'bg-emerald-50/30 border border-emerald-100/50' : 'bg-slate-50/50 border border-slate-100/50'}`}
                                      >
                                        {child.covered ? (
                                          <CheckCircle2 size={12} className="text-emerald-400 shrink-0" />
                                        ) : (
                                          <AlertCircle size={12} className="text-slate-300 shrink-0" />
                                        )}
                                        <span className={`flex-1 text-[11px] ${child.covered ? 'text-slate-600' : 'text-slate-400'}`}>
                                          {child.featureLabel}
                                        </span>
                                        {child.covered && (
                                          <span className="text-[9px] text-emerald-500 bg-emerald-100/70 px-1 py-0.5 rounded">
                                            {Math.round(child.confidence * 100)}%
                                          </span>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          });
                        })()}

                        {/* Orphan children (parentId points to non-existent parent) */}
                        {(() => {
                          const parentIds = featureCoverage.features.filter(f => !f.parentId).map(f => f.featureId);
                          const orphanChildren = featureCoverage.features.filter(f => f.parentId && !parentIds.includes(f.parentId));

                          if (orphanChildren.length === 0) return null;

                          return orphanChildren.map((feature, index) => (
                            <div
                              key={feature.featureId || `orphan-${index}`}
                              className={`flex items-center gap-2 p-2 rounded-lg text-xs ${feature.covered ? 'bg-emerald-50/50 border border-emerald-100' : 'bg-slate-50 border border-slate-100'}`}
                            >
                              {feature.covered ? (
                                <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
                              ) : (
                                <AlertCircle size={14} className="text-slate-400 shrink-0" />
                              )}
                              <span className={`flex-1 ${feature.covered ? 'text-slate-700' : 'text-slate-500'}`}>
                                {feature.featureLabel}
                              </span>
                              {feature.covered && (
                                <span className="text-[10px] text-emerald-600 bg-emerald-100 px-1.5 py-0.5 rounded">
                                  {Math.round(feature.confidence * 100)}%
                                </span>
                              )}
                            </div>
                          ));
                        })()}
                      </div>
                    </div>
                  </CollapsibleSection>
                )}

                {/* Brainstorming Insights */}
                {keyInsights && keyInsights.length > 0 && (
                  <CollapsibleSection
                    title="Key Strategic Insights"
                    icon={Lightbulb}
                    iconColor="text-amber-500"
                    defaultExpanded={true}
                  >
                    <ul className="space-y-2">
                      {keyInsights.map((insight, index) => (
                        <li key={index} className="flex items-start gap-2 text-xs text-slate-700 bg-amber-50/50 p-2 rounded border border-amber-100/50">
                          <span className="mt-0.5 text-amber-500">•</span>
                          <span>{insight}</span>
                        </li>
                      ))}
                    </ul>
                  </CollapsibleSection>
                )}

                {/* Brainstorming Ideas Summary */}
                {ideas && ideas.length > 0 && (
                  <CollapsibleSection
                    title={`Brainstorming Ideas (${ideas.length})`}
                    icon={Sparkles}
                    iconColor="text-purple-500"
                    defaultExpanded={false}
                  >
                    <div className="space-y-3">
                      {/* Group ideas by category */}
                      {Array.from(new Set(ideas.map(i => i.category || 'Other'))).map(category => {
                        const categoryIdeas = ideas.filter(i => (i.category || 'Other') === category);
                        if (categoryIdeas.length === 0) return null;

                        return (
                          <div key={category} className="space-y-1.5">
                            <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider pl-1">{category}</h4>
                            <div className="grid grid-cols-1 gap-1.5">
                              {categoryIdeas.map(idea => (
                                <div key={idea.id} className="bg-white/50 p-2 rounded border border-slate-100 flex items-start gap-2">
                                  <div className="w-1.5 h-1.5 rounded-full bg-purple-400 mt-1.5 shrink-0" />
                                  <div>
                                    <p className="text-xs font-medium text-slate-800">{idea.label}</p>
                                    {idea.description && (
                                      <p className="text-[10px] text-slate-500 mt-0.5 line-clamp-2">{idea.description}</p>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CollapsibleSection>
                )}

                {/* Tech Stack - Enhanced */}
                {projectPreview?.techStack && projectPreview.techStack.length > 0 && (
                  <CollapsibleSection
                    title="Technology Stack"
                    icon={Terminal}
                    iconColor="text-blue-500"
                    defaultExpanded={true}
                  >
                    <div className="space-y-2">
                      <div className="flex flex-wrap gap-1.5">
                        {projectPreview.techStack.map((tech, index) => (
                          <span
                            key={index}
                            className="px-2.5 py-1.5 bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-700 rounded-lg text-xs font-semibold border border-blue-200/60 shadow-sm hover:shadow-md transition-all"
                          >
                            {tech}
                          </span>
                        ))}
                      </div>
                      <div className="mt-3 pt-2 border-t border-slate-200/60">
                        <p className="text-[10px] text-slate-500 italic">
                          💡 Technologies selected based on project requirements and best practices
                        </p>
                      </div>
                    </div>
                  </CollapsibleSection>
                )}

                {/* Game Mechanics - Only for game projects */}
                {projectPreview?.gameMechanics && (
                  <CollapsibleSection
                    title="Game Mechanics Code"
                    icon={Gamepad2}
                    iconColor="text-purple-500"
                    defaultExpanded={true}
                  >
                    <GameMechanicsPanel gameMechanics={projectPreview.gameMechanics} />
                  </CollapsibleSection>
                )}

                {/* Project Methodology */}
                {projectPreview?.recommendedMethodology && (
                  <CollapsibleSection
                    title="Project Methodology"
                    icon={Rocket}
                    iconColor="text-indigo-500"
                    defaultExpanded={false}
                  >
                    <div className="space-y-3">
                      {projectPreview?.recommendedMethodology && (
                        <div className="bg-gradient-to-r from-indigo-50 to-blue-50 rounded-lg p-3 border border-indigo-200/60">
                          <div className="flex items-center gap-2 mb-2">
                            <Rocket size={14} className="text-indigo-600" />
                            <span className="text-xs font-semibold text-slate-700">Development Methodology</span>
                          </div>
                          <div className="space-y-1.5">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-indigo-700">{projectPreview.recommendedMethodology}</span>
                            </div>
                            <p className="text-[10px] text-slate-600 leading-relaxed">
                              This methodology has been selected to optimize development workflow, risk management, and delivery timeline for your project type.
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </CollapsibleSection>
                )}

                {/* Recommended Standards - Enhanced */}
                {((selectedStandards && selectedStandards.length > 0) || (projectPreview?.recommendedStandards && projectPreview.recommendedStandards.length > 0)) && (
                  <CollapsibleSection
                    title="Quality Standards"
                    icon={Shield}
                    iconColor="text-emerald-500"
                    defaultExpanded={false}
                  >
                    <div className="space-y-2">
                      <div className="flex flex-wrap gap-1.5">
                        {(selectedStandards && selectedStandards.length > 0 ? selectedStandards : projectPreview?.recommendedStandards || []).map((standard, index) => (
                          <span
                            key={index}
                            className="px-2.5 py-1.5 bg-gradient-to-r from-emerald-50 to-green-50 text-emerald-700 rounded-lg text-xs font-semibold border border-emerald-200/60 shadow-sm hover:shadow-md transition-all"
                          >
                            <CheckCircle2 size={12} className="inline mr-1" />
                            {standard}
                          </span>
                        ))}
                      </div>
                      <div className="mt-3 pt-2 border-t border-slate-200/60">
                        <p className="text-[10px] text-slate-500 italic">
                          ✅ These standards will help ensure code quality, security, and maintainability
                        </p>
                      </div>
                    </div>
                  </CollapsibleSection>
                )}

                {/* Risks - Enhanced */}
                {projectPreview?.risks && projectPreview.risks.length > 0 && (
                  <CollapsibleSection
                    title="Identified Risks & Mitigation"
                    icon={AlertTriangle}
                    iconColor="text-rose-500"
                    defaultExpanded={false}
                  >
                    <div className="space-y-2">
                      {projectPreview.risks.map((risk, index) => (
                        <div key={index} className="bg-gradient-to-r from-rose-50 to-orange-50 rounded-lg p-2.5 border border-rose-200/60">
                          <div className="flex items-start gap-2">
                            <AlertTriangle size={14} className="text-rose-500 mt-0.5 shrink-0" />
                            <span className="text-xs text-slate-700 leading-relaxed">{risk}</span>
                          </div>
                        </div>
                      ))}
                      <div className="mt-3 pt-2 border-t border-slate-200/60">
                        <p className="text-[10px] text-slate-500 italic">
                          ⚠️ Review these risks and plan mitigation strategies early in the project
                        </p>
                      </div>
                    </div>
                  </CollapsibleSection>
                )}

                {/* Key Features & Requirements - Extracted from Summary */}
                {projectPreview?.summary && (
                  <CollapsibleSection
                    title="Key Features & Requirements"
                    icon={Target}
                    iconColor="text-amber-500"
                    defaultExpanded={false}
                  >
                    <div className="prose prose-sm max-w-none text-slate-700 text-xs leading-relaxed">
                      <MemoizedMarkdown remarkPlugins={REMARK_PLUGINS}>
                        {extractFeaturesFromSummary(projectPreview.summary)}
                      </MemoizedMarkdown>
                    </div>
                  </CollapsibleSection>
                )}

                {/* Next Steps */}
                <CollapsibleSection
                  title="Recommended Next Steps"
                  icon={TrendingUp}
                  iconColor="text-indigo-500"
                  defaultExpanded={false}
                >
                  <div className="space-y-2">
                    <div className="bg-gradient-to-r from-indigo-50 to-blue-50 rounded-lg p-3 border border-indigo-200/60">
                      <ol className="space-y-2 text-xs text-slate-700">
                        <li className="flex items-start gap-2">
                          <span className="font-bold text-indigo-600">1.</span>
                          <span>Review the architecture diagram to understand system design</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="font-bold text-indigo-600">2.</span>
                          <span>Test the interactive prototype to validate user experience</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="font-bold text-indigo-600">3.</span>
                          <span>Review code samples for your target platform</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="font-bold text-indigo-600">4.</span>
                          <span>Start project to begin implementation with AI agents</span>
                        </li>
                      </ol>
                    </div>
                  </div>
                </CollapsibleSection>
              </div>
            </div>
          )
        )}

        {/* Architecture Tab */}
        {activeTab === 'architecture' && (
          <div className="h-full flex flex-col">
            {projectPreview?.architectureDiagram ? (
              <div className="flex-1 min-h-0 p-2">
                <div className="w-full h-full bg-white/60 backdrop-blur-sm rounded-lg border border-white/80 shadow-sm overflow-hidden relative">
                  {/* Control Bar - Top */}
                  <div className="absolute top-3 left-3 right-3 z-10 flex items-center justify-between">
                    {/* Pan/Zoom Controls - Left */}
                    <div className="flex items-center gap-1 bg-white/90 backdrop-blur-sm rounded-lg shadow-sm border border-slate-200 p-1">
                      <button
                        onClick={handleZoomOut}
                        className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-slate-100 text-slate-600 hover:text-slate-800 transition-colors"
                        title="Zoom Out (50%-300%)"
                        disabled={archZoom <= 0.5}
                      >
                        <ZoomOut size={16} />
                      </button>
                      <div className="px-2 text-xs font-medium text-slate-600 min-w-[50px] text-center">
                        {Math.round(archZoom * 100)}%
                      </div>
                      <button
                        onClick={handleZoomIn}
                        className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-slate-100 text-slate-600 hover:text-slate-800 transition-colors"
                        title="Zoom In (50%-300%)"
                        disabled={archZoom >= 3}
                      >
                        <ZoomIn size={16} />
                      </button>
                      <div className="w-px h-6 bg-slate-200 mx-1" />
                      <button
                        onClick={handleResetView}
                        className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-slate-100 text-slate-600 hover:text-slate-800 transition-colors"
                        title="Reset View"
                      >
                        <RotateCcw size={16} />
                      </button>
                      <div className="w-px h-6 bg-slate-200 mx-1" />
                      <div className="flex items-center gap-1 px-2 text-xs text-slate-500">
                        <Move size={12} />
                        <span>Drag to pan</span>
                      </div>
                    </div>

                    {/* Regenerate Button - Right */}
                    {onRegeneratePrototype && (
                      <button
                        onClick={() => onRegeneratePrototype('architecture')}
                        className="flex items-center gap-2 px-3 py-1.5 bg-white/90 hover:bg-white shadow-sm hover:shadow-md border border-slate-200 hover:border-indigo-200 rounded-lg text-xs font-medium text-slate-600 hover:text-indigo-600 transition-all"
                        title="Regenerate Architecture Diagram"
                      >
                        <RefreshCw size={14} />
                        <span>Regenerate</span>
                      </button>
                    )}
                  </div>

                  {/* Pannable/Zoomable Container */}
                  <div
                    ref={archContainerRef}
                    className={`w-full h-full overflow-hidden ${isPanning ? 'cursor-grabbing' : 'cursor-grab'}`}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                    onWheel={handleWheel}
                  >
                    <div
                      className="w-full h-full transition-transform duration-100 ease-out"
                      style={{
                        transform: `translate(${archPan.x}px, ${archPan.y}px) scale(${archZoom})`,
                        transformOrigin: 'center center'
                      }}
                    >
                      <iframe
                        ref={iframeRef}
                        className="w-full h-full border-0 pointer-events-none"
                        title="Architecture Diagram"
                        srcDoc={architectureSrcDoc}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex-1 min-h-0 flex items-center justify-center">
                <div className="text-center text-slate-500">
                  <Layers size={48} className="mx-auto mb-4 opacity-50" />
                  <p className="text-sm">No architecture diagram available.</p>
                </div>
              </div>
            )}

            {/* Full Architecture Analysis Sections */}
            {(projectPreview?.backendArchitecture || projectPreview?.adminConsole || projectPreview?.infrastructure ||
              projectPreview?.securityArchitecture || projectPreview?.databaseArchitecture || projectPreview?.apiDesign) && (
                <div className="flex-shrink-0 p-2 border-t border-white/60 bg-white/30 backdrop-blur-sm max-h-[45%] overflow-y-auto">
                  <CollapsibleSection
                    title="Complete Architecture Breakdown"
                    icon={Layers}
                    iconColor="text-indigo-600"
                    defaultExpanded={false}
                  >
                    <div className="space-y-3 pt-2">
                      {/* Backend Architecture */}
                      {projectPreview?.backendArchitecture && (
                        <CollapsibleSection
                          title="Backend Architecture"
                          icon={Terminal}
                          iconColor="text-blue-500"
                          defaultExpanded={false}
                        >
                          <div className="space-y-2 text-xs text-slate-700">
                            <div><strong>API Server:</strong> {projectPreview.backendArchitecture.apiServer}</div>
                            <div><strong>Architecture:</strong> {projectPreview.backendArchitecture.architecture}</div>
                            <div><strong>Framework:</strong> {projectPreview.backendArchitecture.framework}</div>
                            <div className="mt-2 pt-2 border-t border-slate-200">
                              <p className="text-[11px] leading-relaxed">{projectPreview.backendArchitecture.description}</p>
                            </div>
                          </div>
                        </CollapsibleSection>
                      )}

                      {/* Admin Console */}
                      {projectPreview?.adminConsole && projectPreview.adminConsole.required && (
                        <CollapsibleSection
                          title="Admin Console"
                          icon={Users}
                          iconColor="text-purple-500"
                          defaultExpanded={false}
                        >
                          <div className="space-y-2 text-xs text-slate-700">
                            <div className="flex flex-wrap gap-1.5">
                              {projectPreview.adminConsole.features.map((feature, idx) => (
                                <span key={idx} className="px-2 py-1 bg-purple-50 text-purple-700 rounded text-[10px] font-medium">
                                  {feature}
                                </span>
                              ))}
                            </div>
                            <div className="mt-2 pt-2 border-t border-slate-200">
                              <p className="text-[11px] leading-relaxed">{projectPreview.adminConsole.description}</p>
                            </div>
                          </div>
                        </CollapsibleSection>
                      )}

                      {/* Infrastructure */}
                      {projectPreview?.infrastructure && (
                        <CollapsibleSection
                          title="Infrastructure"
                          icon={Rocket}
                          iconColor="text-orange-500"
                          defaultExpanded={false}
                        >
                          <div className="space-y-2 text-xs text-slate-700">
                            <div><strong>Application Servers:</strong> {projectPreview.infrastructure.applicationServers}</div>
                            <div><strong>Database:</strong> {projectPreview.infrastructure.databaseServers}</div>
                            <div><strong>Caching:</strong> {projectPreview.infrastructure.caching}</div>
                            <div><strong>Deployment:</strong> {projectPreview.infrastructure.deployment}</div>
                            <div className="mt-2 pt-2 border-t border-slate-200">
                              <p className="text-[11px] leading-relaxed">{projectPreview.infrastructure.description}</p>
                            </div>
                          </div>
                        </CollapsibleSection>
                      )}

                      {/* Security Architecture */}
                      {projectPreview?.securityArchitecture && (
                        <CollapsibleSection
                          title="Security Architecture"
                          icon={Shield}
                          iconColor="text-red-500"
                          defaultExpanded={false}
                        >
                          <div className="space-y-2 text-xs text-slate-700">
                            <div><strong>Authentication:</strong> {projectPreview.securityArchitecture.authentication}</div>
                            <div><strong>Authorization:</strong> {projectPreview.securityArchitecture.authorization}</div>
                            {projectPreview.securityArchitecture.compliance.length > 0 && (
                              <div>
                                <strong>Compliance:</strong>{' '}
                                {projectPreview.securityArchitecture.compliance.join(', ')}
                              </div>
                            )}
                            <div className="mt-2 pt-2 border-t border-slate-200">
                              <p className="text-[11px] leading-relaxed">{projectPreview.securityArchitecture.description}</p>
                            </div>
                          </div>
                        </CollapsibleSection>
                      )}

                      {/* Database Architecture */}
                      {projectPreview?.databaseArchitecture && (
                        <CollapsibleSection
                          title="Database Architecture"
                          icon={Database}
                          iconColor="text-green-500"
                          defaultExpanded={false}
                        >
                          <div className="space-y-2 text-xs text-slate-700">
                            <div><strong>Primary Database:</strong> {projectPreview.databaseArchitecture.primaryDatabase}</div>
                            <div><strong>Type:</strong> {projectPreview.databaseArchitecture.databaseType.toUpperCase()}</div>
                            <div><strong>Caching Strategy:</strong> {projectPreview.databaseArchitecture.cachingStrategy}</div>
                            <div className="mt-2 pt-2 border-t border-slate-200">
                              <p className="text-[11px] leading-relaxed">{projectPreview.databaseArchitecture.description}</p>
                            </div>
                          </div>
                        </CollapsibleSection>
                      )}

                      {/* API Design */}
                      {projectPreview?.apiDesign && (
                        <CollapsibleSection
                          title="API Design"
                          icon={GitBranch}
                          iconColor="text-indigo-500"
                          defaultExpanded={false}
                        >
                          <div className="space-y-2 text-xs text-slate-700">
                            <div><strong>API Style:</strong> {projectPreview.apiDesign.apiStyle}</div>
                            {projectPreview.apiDesign.endpoints.length > 0 && (
                              <div>
                                <strong>Key Endpoints:</strong>
                                <ul className="list-disc list-inside ml-2 mt-1">
                                  {projectPreview.apiDesign.endpoints.slice(0, 5).map((endpoint, idx) => (
                                    <li key={idx} className="text-[10px]">{endpoint}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {projectPreview.apiDesign.externalIntegrations.length > 0 && (
                              <div>
                                <strong>External Integrations:</strong>{' '}
                                {projectPreview.apiDesign.externalIntegrations.join(', ')}
                              </div>
                            )}
                            <div className="mt-2 pt-2 border-t border-slate-200">
                              <p className="text-[11px] leading-relaxed">{projectPreview.apiDesign.description}</p>
                            </div>
                          </div>
                        </CollapsibleSection>
                      )}
                    </div>
                  </CollapsibleSection>
                </div>
              )}
          </div>
        )}

        {/* Prototype Tab */}
        {activeTab === 'prototype' && (
          <div className="h-full flex flex-col">
            {/* Toolbar: Device & Theme Controls */}
            <div className="p-2 border-b border-white/60 bg-white/30 flex flex-wrap items-center gap-4 justify-between">

              {/* Device Switcher */}
              <div className="flex items-center gap-1 bg-white/50 p-1 rounded-lg border border-slate-200/60">
                <button
                  onClick={() => setPreviewMode('mobile')}
                  className={`p-1.5 rounded-md transition-all ${previewMode === 'mobile'
                    ? 'bg-white shadow-sm text-indigo-600'
                    : 'text-slate-400 hover:text-slate-600 hover:bg-white/50'
                    }`}
                  title="Mobile View"
                >
                  <Smartphone size={16} />
                </button>
                <button
                  onClick={() => setPreviewMode('tablet')}
                  className={`p-1.5 rounded-md transition-all ${previewMode === 'tablet'
                    ? 'bg-white shadow-sm text-indigo-600'
                    : 'text-slate-400 hover:text-slate-600 hover:bg-white/50'
                    }`}
                  title="Tablet View"
                >
                  <Tablet size={16} />
                </button>
                <button
                  onClick={() => setPreviewMode('desktop')}
                  className={`p-1.5 rounded-md transition-all ${previewMode === 'desktop'
                    ? 'bg-white shadow-sm text-indigo-600'
                    : 'text-slate-400 hover:text-slate-600 hover:bg-white/50'
                    }`}
                  title="Desktop View"
                >
                  <Monitor size={16} />
                </button>
              </div>

              {/* Theme Controls */}
              {onGenerateTheme && (
                <div className="flex items-center gap-1.5 flex-1 justify-end max-w-xl">
                  <Palette size={14} className="text-primary shrink-0" />
                  <input
                    type="text"
                    value={themeDescription}
                    onChange={(e) => setThemeDescription(e.target.value)}
                    placeholder="Theme (e.g., 'Dark mode with blue accents')"
                    className="flex-1 px-2 py-1.5 text-xs bg-white/60 border border-white/80 rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50 min-w-[150px]"
                    onKeyPress={(e) => e.key === 'Enter' && handleGenerateTheme()}
                  />
                  <button
                    onClick={handleGenerateTheme}
                    disabled={!themeDescription.trim() || isGeneratingTheme}
                    className="px-2 py-1.5 bg-primary text-white rounded-md text-xs font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-1 shrink-0"
                  >
                    {isGeneratingTheme ? (
                      <>
                        <RefreshCw size={12} className="animate-spin" />
                        <span>...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles size={12} />
                        <span>Apply</span>
                      </>
                    )}
                  </button>
                  {customTheme && (
                    <button
                      onClick={() => setCustomTheme(null)}
                      className="px-2 py-1.5 text-xs text-slate-600 hover:text-slate-800 hover:bg-white/40 rounded-md transition-colors shrink-0"
                    >
                      Reset
                    </button>
                  )}
                  {onRegeneratePrototype && (
                    <button
                      onClick={() => onRegeneratePrototype('wireframe')}
                      className="ml-2 px-2 py-1.5 bg-white shadow-sm border border-slate-200 hover:border-indigo-300 hover:text-indigo-600 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 shrink-0"
                      title="Regenerate Prototype"
                    >
                      <RefreshCw size={12} />
                      <span>Regenerate</span>
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Prototype Preview */}
            <div className="flex-1 overflow-hidden min-h-0 bg-slate-100/50 flex flex-col items-center relative">
              {/* View Switcher (Only visible if Admin Console is available) */}
              {projectPreview?.views?.adminConsole && (
                <div className="mt-4 mb-2 bg-white rounded-lg shadow-sm border border-slate-200 p-1 flex items-center gap-1 z-10">
                  <button
                    onClick={() => setActiveView('endUser')}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-2 ${activeView === 'endUser'
                      ? 'bg-indigo-50 text-indigo-600 shadow-sm ring-1 ring-indigo-200'
                      : 'text-slate-600 hover:bg-slate-50'
                      }`}
                  >
                    <Smartphone size={14} />
                    {projectPreview?.requirements?.projectType === 'game' ? 'Play Game' : 'End User App'}
                  </button>
                  <div className="w-px h-4 bg-slate-200 mx-1"></div>
                  <button
                    onClick={() => setActiveView('adminConsole')}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-2 ${activeView === 'adminConsole'
                      ? 'bg-indigo-50 text-indigo-600 shadow-sm ring-1 ring-indigo-200'
                      : 'text-slate-600 hover:bg-slate-50'
                      }`}
                  >
                    <Shield size={14} />
                    {projectPreview?.requirements?.projectType === 'game' ? 'Game Dashboard' : 'Admin Console'}
                  </button>
                </div>
              )}

              <div
                className={`relative h-full transition-all duration-300 ease-in-out shadow-2xl bg-white ${previewMode === 'mobile' ? 'w-[375px] my-4 rounded-[2rem] border-[8px] border-slate-800 overflow-hidden' :
                  previewMode === 'tablet' ? 'w-[768px] my-4 rounded-[1.5rem] border-[8px] border-slate-800 overflow-hidden' :
                    'w-full border-none rounded-none'
                  }`}
              >
                {/* Refinement Overlay */}
                {isRefining && (
                  <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/60 backdrop-blur-[2px] transition-all duration-300">
                    <div className="flex flex-col items-center gap-3 p-4 bg-white/90 rounded-2xl shadow-xl border border-indigo-100 animate-in fade-in zoom-in-95 duration-200">
                      <div className="relative">
                        <div className="w-10 h-10 rounded-full border-3 border-indigo-100 border-t-indigo-600 animate-spin"></div>
                        <Sparkles className="absolute -top-1 -right-1 w-4 h-4 text-amber-400 animate-pulse" />
                      </div>
                      <span className="text-sm font-medium text-slate-700 animate-pulse">Refining Prototype...</span>
                    </div>
                  </div>
                )}
                {wireframeArtifact ? (
                  <PreviewFrame
                    artifact={wireframeArtifact}
                    viewType={activeView}
                    theme={customTheme ? {
                      primary: customTheme.primary,
                      secondary: customTheme.secondary,
                      accent: customTheme.accent,
                      background: customTheme.background,
                      textColor: customTheme.textColor
                    } : undefined}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center p-8 bg-white">
                    <div className="text-center text-slate-500 max-w-md">
                      <Zap size={48} className="mx-auto mb-4 opacity-50" />
                      <p className="text-lg font-semibold text-slate-700 mb-2">No Prototype Generated Yet</p>
                      <p className="text-sm mb-4">The prototype code hasn't been generated or wasn't saved properly.</p>
                      <p className="text-xs text-slate-400">
                        Click <strong className="text-primary">REGENERATE PROTOTYPE</strong> on the left panel to generate your interactive prototype.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Scale/Label indicator - Optional */}
              {previewMode !== 'desktop' && (
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 px-3 py-1 bg-slate-800/80 text-white text-[10px] rounded-full backdrop-blur-sm pointer-events-none z-10 transition-opacity opacity-50 hover:opacity-100">
                  {previewMode === 'mobile' ? 'Mobile (375px)' : 'Tablet (768px)'}
                </div>
              )}
            </div>
          </div>
        )}



        {/* Build Your Project Tab */}
        {activeTab === 'buildProject' && (
          <div className="space-y-4">
            <div className="space-y-3">
              {/* Build Options Header */}
              <div className="bg-gradient-to-r from-indigo-500 to-purple-600 p-4 rounded-xl shadow-lg text-white">
                <h3 className="text-lg font-bold mb-1 flex items-center gap-2">
                  <Hammer size={20} />
                  Build Your Project
                </h3>
                <p className="text-indigo-100 text-xs">
                  Choose from the recommended approaches below to bring your project to life.
                </p>
              </div>

              {/* AI-Powered Development */}
              <div
                onClick={() => setIsAIBuildExpanded(!isAIBuildExpanded)}
                className={`bg-white/60 backdrop-blur-sm rounded-lg border shadow-sm p-3 transition-all cursor-pointer group ${isAIBuildExpanded ? 'border-indigo-400 shadow-md ring-2 ring-indigo-100' : 'border-white/80 hover:border-indigo-300 hover:shadow-md'
                  }`}
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shrink-0">
                    <Zap className="text-white" size={18} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-semibold text-slate-800 group-hover:text-indigo-600 transition-colors">AI-Powered Development</h4>
                      <ChevronDown size={16} className={`text-slate-400 transition-transform ${isAIBuildExpanded ? 'rotate-180' : ''}`} />
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">Let AI agents build your project automatically using the generated blueprint.</p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-600 rounded text-[10px] font-medium">Fastest</span>
                      <span className="px-1.5 py-0.5 bg-green-50 text-green-600 rounded text-[10px] font-medium">Recommended</span>
                    </div>
                  </div>
                </div>

                {/* Expanded Content - Feature & Platform Selection */}
                {isAIBuildExpanded && (
                  <div className="mt-4 pt-3 border-t border-slate-200 space-y-3 animate-in slide-in-from-top-2 duration-200">
                    {/* Progress Indicator */}
                    <div className="flex items-center justify-center gap-2 mb-2">
                      <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-medium ${aiBuildStep === 'features' ? 'bg-indigo-100 text-indigo-700' : 'bg-green-100 text-green-700'}`}>
                        <span className="w-4 h-4 rounded-full bg-current text-white flex items-center justify-center text-[8px]">1</span>
                        Features
                      </div>
                      <ArrowRight size={12} className="text-slate-300" />
                      <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-medium ${aiBuildStep === 'platform' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-400'}`}>
                        <span className="w-4 h-4 rounded-full bg-current text-white flex items-center justify-center text-[8px]">2</span>
                        Platform
                      </div>
                    </div>

                    {/* Step 1: Feature Selection */}
                    {aiBuildStep === 'features' && (
                      <>
                        {/* Project Summary */}
                        <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg p-3 border border-indigo-100">
                          <h5 className="text-xs font-bold text-indigo-800 mb-1">🎯 {projectPreview?.projectName || 'Your Project'}</h5>
                          <p className="text-[10px] text-indigo-600">{projectPreview?.summary?.slice(0, 100) || 'Based on your brainstorming session'}...</p>
                        </div>

                        {/* Feature Selection Header */}
                        <div className="flex items-center justify-between">
                          <h5 className="text-xs font-semibold text-slate-700">Select Features to Build:</h5>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (selectedFeatures.length === availableFeatures.length) {
                                setSelectedFeatures([]);
                              } else {
                                setSelectedFeatures([...availableFeatures]);
                              }
                            }}
                            className="text-[10px] text-indigo-600 hover:text-indigo-800 font-medium"
                          >
                            {selectedFeatures.length === availableFeatures.length ? 'Deselect All' : 'Select All'}
                          </button>
                        </div>

                        {/* Feature Checkboxes */}
                        <div className="grid grid-cols-2 gap-2">
                          {availableFeatures.map((feature, index) => {
                            const isSelected = selectedFeatures.includes(feature);
                            return (
                              <div
                                key={index}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (isSelected) {
                                    setSelectedFeatures(selectedFeatures.filter(f => f !== feature));
                                  } else {
                                    setSelectedFeatures([...selectedFeatures, feature]);
                                  }
                                }}
                                className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-all ${isSelected
                                  ? 'bg-indigo-50 border-indigo-300 shadow-sm'
                                  : 'bg-white border-slate-200 hover:border-indigo-200'
                                  }`}
                              >
                                <div className={`w-4 h-4 rounded flex items-center justify-center transition-colors ${isSelected ? 'bg-indigo-500' : 'bg-slate-200'
                                  }`}>
                                  {isSelected && <Check size={10} className="text-white" />}
                                </div>
                                <span className={`text-[10px] font-medium ${isSelected ? 'text-indigo-800' : 'text-slate-600'}`}>
                                  {feature}
                                </span>
                              </div>
                            );
                          })}
                        </div>

                        {/* Continue Button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (selectedFeatures.length === 0) {
                              setSelectedFeatures([...availableFeatures]); // Select all if none selected
                            }
                            setAiBuildStep('platform');
                          }}
                          className="w-full mt-2 py-2 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-lg text-xs font-bold hover:from-indigo-600 hover:to-purple-700 transition-all shadow-sm flex items-center justify-center gap-2"
                        >
                          Continue to Platform Selection
                          <ArrowRight size={14} />
                        </button>
                      </>
                    )}

                    {/* Step 2: Platform Selection */}
                    {aiBuildStep === 'platform' && (
                      <>
                        {/* Selected Features Summary */}
                        <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-3 border border-green-100">
                          <div className="flex items-center justify-between mb-1">
                            <h5 className="text-xs font-bold text-green-800">✓ {selectedFeatures.length} Features Selected</h5>
                            <button
                              onClick={(e) => { e.stopPropagation(); setAiBuildStep('features'); }}
                              className="text-[10px] text-green-600 hover:text-green-800 font-medium flex items-center gap-1"
                            >
                              <ArrowLeft size={10} />
                              Edit
                            </button>
                          </div>
                          <p className="text-[10px] text-green-600">{selectedFeatures.slice(0, 3).join(', ')}{selectedFeatures.length > 3 ? ` +${selectedFeatures.length - 3} more` : ''}</p>
                        </div>

                        {/* Platform Options Header */}
                        <div className="flex items-center justify-between mb-2">
                          <h5 className="text-xs font-semibold text-slate-700">Choose Your Platform:</h5>
                          {recommendedPlatform && (
                            <span className="text-[10px] px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full font-medium">
                              Recommended: {recommendedPlatform === 'mobile' ? 'Mobile App' :
                                recommendedPlatform === 'web' ? 'Website / Web App' :
                                  recommendedPlatform === 'desktop' ? 'Desktop App' :
                                    recommendedPlatform === 'api' ? 'API / Backend' : 'Full Stack'}
                            </span>
                          )}
                        </div>

                        {/* Mobile App Option */}
                        <div className={`rounded-lg border p-3 transition-all ${recommendedPlatform === 'mobile' ? 'bg-blue-50 border-blue-300 ring-1 ring-blue-200 shadow-sm' : 'bg-white border-slate-200 hover:border-blue-300 hover:shadow-sm'}`}>
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                                <Smartphone className="text-white" size={16} />
                              </div>
                              <div>
                                <p className="text-xs font-semibold text-slate-800">Mobile App</p>
                                <p className="text-[10px] text-slate-500">iOS & Android with React Native</p>
                              </div>
                            </div>
                            <button
                              onClick={(e) => { e.stopPropagation(); onLaunchProject?.('mobile', selectedFeatures); }}
                              className="px-3 py-1.5 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-lg text-[10px] font-bold hover:from-blue-600 hover:to-cyan-600 transition-all shadow-sm flex items-center gap-1"
                            >
                              <Zap size={12} />
                              Start Build
                            </button>
                          </div>
                        </div>

                        {/* Website Option */}
                        <div className={`rounded-lg border p-3 transition-all ${recommendedPlatform === 'web' ? 'bg-indigo-50 border-indigo-300 ring-1 ring-indigo-200 shadow-sm' : 'bg-white border-slate-200 hover:border-indigo-300 hover:shadow-sm'}`}>
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                                <Globe className="text-white" size={16} />
                              </div>
                              <div>
                                <p className="text-xs font-semibold text-slate-800">Website / Web App</p>
                                <p className="text-[10px] text-slate-500">React, Next.js, or Vue.js</p>
                              </div>
                            </div>
                            <button
                              onClick={(e) => { e.stopPropagation(); onLaunchProject?.('web', selectedFeatures); }}
                              className="px-3 py-1.5 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-lg text-[10px] font-bold hover:from-indigo-600 hover:to-purple-700 transition-all shadow-sm flex items-center gap-1"
                            >
                              <Zap size={12} />
                              Start Build
                            </button>
                          </div>
                        </div>

                        {/* Desktop App Option */}
                        <div className={`rounded-lg border p-3 transition-all ${recommendedPlatform === 'desktop' ? 'bg-slate-100 border-slate-400 ring-1 ring-slate-300 shadow-sm' : 'bg-white border-slate-200 hover:border-slate-400 hover:shadow-sm'}`}>
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-slate-600 to-slate-800 flex items-center justify-center">
                                <Terminal className="text-white" size={16} />
                              </div>
                              <div>
                                <p className="text-xs font-semibold text-slate-800">Desktop App</p>
                                <p className="text-[10px] text-slate-500">Electron or Tauri</p>
                              </div>
                            </div>
                            <button
                              onClick={(e) => { e.stopPropagation(); onLaunchProject?.('desktop', selectedFeatures); }}
                              className="px-3 py-1.5 bg-gradient-to-r from-slate-600 to-slate-800 text-white rounded-lg text-[10px] font-bold hover:from-slate-700 hover:to-slate-900 transition-all shadow-sm flex items-center gap-1"
                            >
                              <Zap size={12} />
                              Start Build
                            </button>
                          </div>
                        </div>

                        {/* API/Backend Option */}
                        <div className={`rounded-lg border p-3 transition-all ${recommendedPlatform === 'api' ? 'bg-emerald-50 border-emerald-300 ring-1 ring-emerald-200 shadow-sm' : 'bg-white border-slate-200 hover:border-emerald-300 hover:shadow-sm'}`}>
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
                                <Database className="text-white" size={16} />
                              </div>
                              <div>
                                <p className="text-xs font-semibold text-slate-800">API / Backend</p>
                                <p className="text-[10px] text-slate-500">Node.js, Python, or Go</p>
                              </div>
                            </div>
                            <button
                              onClick={(e) => { e.stopPropagation(); onLaunchProject?.('api', selectedFeatures); }}
                              className="px-3 py-1.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-lg text-[10px] font-bold hover:from-emerald-600 hover:to-teal-600 transition-all shadow-sm flex items-center gap-1"
                            >
                              <Zap size={12} />
                              Start Build
                            </button>
                          </div>
                        </div>

                        {/* Full Stack Option */}
                        <div className={`rounded-lg border p-3 transition-all ${!recommendedPlatform || recommendedPlatform === 'fullstack' ? 'bg-gradient-to-r from-indigo-50 to-purple-50 border-indigo-200 ring-1 ring-indigo-200 shadow-sm' : 'bg-white border-slate-200 hover:border-indigo-200 hover:shadow-sm'}`}>
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-pink-500 flex items-center justify-center">
                                <Layers className="text-white" size={16} />
                              </div>
                              <div>
                                <p className="text-xs font-semibold text-slate-800">Full Stack Application</p>
                                <p className="text-[10px] text-slate-500">Frontend + Backend + Database</p>
                              </div>
                            </div>
                            <button
                              onClick={(e) => { e.stopPropagation(); onLaunchProject?.('fullstack', selectedFeatures); }}
                              className="px-3 py-1.5 bg-gradient-to-r from-orange-500 to-pink-500 text-white rounded-lg text-[10px] font-bold hover:from-orange-600 hover:to-pink-600 transition-all shadow-sm flex items-center gap-1"
                            >
                              <Zap size={12} />
                              Start Build
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Hire Expert Developer */}
              <div className="bg-white/60 backdrop-blur-sm rounded-lg border border-white/80 shadow-sm p-3 hover:border-orange-300 hover:shadow-md transition-all cursor-pointer group">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center shrink-0">
                    <Rocket className="text-white" size={18} />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-sm font-semibold text-slate-800 group-hover:text-orange-600 transition-colors">Hire Expert Developer</h4>
                    <p className="text-xs text-slate-500 mt-0.5">Connect with pre-vetted developers to build and customize your project.</p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      <span className="px-1.5 py-0.5 bg-orange-50 text-orange-600 rounded text-[10px] font-medium">Expert Support</span>
                      <span className="px-1.5 py-0.5 bg-orange-50 text-orange-600 rounded text-[10px] font-medium">Custom Development</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Phase 6 Options Notice */}
              <div className="bg-slate-50 rounded-lg border border-slate-200 p-3 mt-4">
                <p className="text-xs text-slate-500 text-center">
                  <span className="font-medium text-slate-600">More options available after project completion:</span><br />
                  Export Code • Push to GitHub • Deploy to Cloud
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Prototype Preview Toast - shows browser-like preview after generation */}
      <PrototypePreviewToast
        isOpen={showPreviewToast}
        wireframeCode={projectPreview?.wireframeCode || ''}
        projectName={projectName || 'Project'}
        onApprove={handlePreviewApprove}
        onRegenerate={handlePreviewRegenerate}
        onClose={handlePreviewClose}
        onRefine={handlePreviewRefine}
        isRefining={isToastRefining}
        conversationMessages={conversationMessages}
      />
    </div>
  );
};

export default PrototypingPanel;
