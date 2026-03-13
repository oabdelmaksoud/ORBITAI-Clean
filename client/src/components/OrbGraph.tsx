import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { OrbGraphTheme, getThemeById } from '@orbitai/shared';
import IdeaImageGenerator from './IdeaImageGenerator';
import { Idea, IdeaCategory } from '@orbitai/shared';

// Re-export Idea for backwards compatibility with existing imports
export type { Idea, IdeaCategory } from '@orbitai/shared';

export interface OrbNode extends d3.SimulationNodeDatum {
  id: string;
  label: string;
  type: 'center' | 'idea';
  desc?: string;
  isFocused?: boolean;
  isWelcome?: boolean;
  isSubBubble?: boolean;
  parentId?: string | null;
  category?: IdeaCategory;
  priority?: number;
  state?: 'new' | 'developing' | 'refined' | 'merged';
  depth?: number; // Hierarchy depth for alternating colors
  isCategoryHub?: boolean; // Is this a category center?
  // isSubBubble defined above at line 30
  hasSubIdeas?: boolean; // Does this idea have its own children?
  researchData?: string;

  fx?: number | null;
  fy?: number | null;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
}

export interface OrbLink extends d3.SimulationLinkDatum<OrbNode> {

  source: string | OrbNode;
  target: string | OrbNode;
  relationshipType?: 'parent-child' | 'connection' | 'related' | 'similar';
  strength?: number;
}

interface OrbGraphProps {
  topic: string;
  ideas: Idea[];
  activeIdeaId: string | null;
  selectedIdeaIds?: Set<string>;
  onIdeaClick?: (ideaId: string | null, position?: { x: number; y: number }, shiftKey?: boolean) => void;
  onIdeaDoubleClick?: (ideaId: string) => void;
  onIdeaDelete?: (ideaId: string) => void;
  onIdeaEdit?: (ideaId: string) => void;
  onIdeaMerge?: (ideaId: string, targetId: string) => void;
  onIdeaLink?: (ideaId: string, targetId: string) => void;
  onIdeaSetPriority?: (ideaId: string, priority: number) => void;
  onIdeaAddNote?: (ideaId: string, note: string) => void;
  onIdeaImageGenerated?: (ideaId: string, imageUrl: string) => void;
  theme?: OrbGraphTheme | string;
}

// Category-based color and icon mapping - includes AI-generated categories
export const CATEGORY_STYLES: Record<string, { color: string; gradient: [string, string]; icon: string; label: string }> = {
  // AI-generated categories
  feature: { color: '#22C55E', gradient: ['#4ADE80', '#16A34A'], icon: '⚙️', label: 'Feature' },
  technology: { color: '#6366F1', gradient: ['#818CF8', '#4F46E5'], icon: '💻', label: 'Technology' },
  ux: { color: '#EC4899', gradient: ['#F472B6', '#DB2777'], icon: '🎨', label: 'UX' },
  data: { color: '#06B6D4', gradient: ['#22D3EE', '#0891B2'], icon: '📊', label: 'Data' },
  business: { color: '#F97316', gradient: ['#FB923C', '#EA580C'], icon: '💼', label: 'Business' },
  community: { color: '#8B5CF6', gradient: ['#A78BFA', '#7C3AED'], icon: '👥', label: 'Community' },
  platform: { color: '#EAB308', gradient: ['#FACC15', '#CA8A04'], icon: '📱', label: 'Platform' },
  // Legacy/additional categories
  risk: { color: '#EF4444', gradient: ['#F87171', '#DC2626'], icon: '⚠️', label: 'Risk' },
  opportunity: { color: '#10B981', gradient: ['#34D399', '#059669'], icon: '💡', label: 'Opportunity' },
  constraint: { color: '#F59E0B', gradient: ['#FBBF24', '#D97706'], icon: '🔒', label: 'Constraint' },
  requirement: { color: '#3B82F6', gradient: ['#60A5FA', '#2563EB'], icon: '📋', label: 'Requirement' },
  improvement: { color: '#14B8A6', gradient: ['#2DD4BF', '#0D9488'], icon: '✨', label: 'Improvement' },
  idea: { color: '#6366F1', gradient: ['#818CF8', '#4F46E5'], icon: '💭', label: 'Idea' },
  other: { color: '#6B7280', gradient: ['#9CA3AF', '#4B5563'], icon: '📌', label: 'Other' }
};

// Priority styles
export const PRIORITY_STYLES: Record<number, { sizeMultiplier: number; glowIntensity: number; pulseSpeed: number }> = {
  5: { sizeMultiplier: 1.2, glowIntensity: 1.5, pulseSpeed: 1.5 },
  4: { sizeMultiplier: 1.1, glowIntensity: 1.2, pulseSpeed: 1.2 },
  3: { sizeMultiplier: 1.0, glowIntensity: 1.0, pulseSpeed: 1.0 },
  2: { sizeMultiplier: 0.95, glowIntensity: 0.8, pulseSpeed: 0.8 },
  1: { sizeMultiplier: 0.9, glowIntensity: 0.5, pulseSpeed: 0.5 }
};

// State styles
export const STATE_STYLES: Record<string, { badge: string; borderStyle: string; opacity: number }> = {
  new: { badge: '🆕', borderStyle: 'solid', opacity: 1.0 },
  developing: { badge: '🔄', borderStyle: 'solid', opacity: 0.95 },
  refined: { badge: '✅', borderStyle: 'solid', opacity: 1.0 },
  merged: { badge: '🔗', borderStyle: 'dashed', opacity: 0.7 }
};

const getCategoryStyle = (category?: string) => CATEGORY_STYLES[category || 'idea'] || CATEGORY_STYLES.idea;
const getPriorityStyle = (priority?: number) => PRIORITY_STYLES[priority || 3] || PRIORITY_STYLES[3];
const getStateStyle = (state?: string) => STATE_STYLES[state || 'new'] || STATE_STYLES.new;

const OrbGraph: React.FC<OrbGraphProps> = ({
  topic,
  ideas,
  activeIdeaId,
  selectedIdeaIds = new Set(),
  onIdeaClick,
  onIdeaDoubleClick,
  onIdeaDelete,
  onIdeaEdit,
  onIdeaMerge,
  onIdeaLink,
  onIdeaSetPriority,
  onIdeaAddNote,
  onIdeaImageGenerated,
  theme
}) => {
  // P0 FIX: Defensive null check to prevent crash when ideas is undefined
  const safeIdeas = ideas ?? [];

  // Early return for empty state - prevents D3 errors
  if (safeIdeas.length === 0 && !topic) {
    return (
      <div className="flex items-center justify-center h-full w-full bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
        <div className="text-center p-8">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-100 flex items-center justify-center">
            <span className="text-3xl">💡</span>
          </div>
          <p className="text-sm font-medium text-slate-600">Start brainstorming to see ideas here</p>
          <p className="text-xs text-slate-400 mt-1">Your ideas will appear as interactive bubbles</p>
        </div>
      </div>
    );
  }

  const [imageGeneratorIdea, setImageGeneratorIdea] = useState<Idea | null>(null);
  // Tooltip state for hover details
  const [tooltipData, setTooltipData] = useState<{
    idea: OrbNode | null;
    x: number;
    y: number;
  } | null>(null);
  const activeTheme: OrbGraphTheme = typeof theme === 'string'
    ? (getThemeById(theme) || getThemeById('default')!)
    : (theme || getThemeById('default')!);

  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const simulationRef = useRef<d3.Simulation<OrbNode, OrbLink> | null>(null);
  const nodesRef = useRef<OrbNode[]>([]);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const transformRef = useRef<d3.ZoomTransform>(d3.zoomIdentity);

  // Generate unique ID for this instance to avoid gradient conflicts
  const graphId = React.useMemo(() => Math.random().toString(36).substr(2, 9), []);
  const orbGradientId = `orbGradient-${graphId}`;
  const welcomeGradientId = `welcomeGradient-${graphId}`;
  const glowId = `glow-${graphId}`;

  // State for dimensions to trigger re-render on resize
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (import.meta.env.DEV) console.log('[OrbGraph] Mounted/Remounted');
    if (!containerRef.current) return;

    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        if (import.meta.env.DEV) console.log('[OrbGraph] ResizeObserver:', entry.contentRect.width, entry.contentRect.height);
        if (entry.contentRect.width > 0 && entry.contentRect.height > 0) {
          setDimensions({
            width: entry.contentRect.width,
            height: entry.contentRect.height
          });
        }
      }
    });

    observer.observe(containerRef.current);

    return () => {
      if (import.meta.env.DEV) console.log('[OrbGraph] Unmounting - disconnecting observer');
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    if (import.meta.env.DEV) console.log('[OrbGraph] Render Effect Triggered', {
      width: dimensions.width,
      height: dimensions.height,
      hasSvg: !!svgRef.current,
      ideaCount: ideas.length
    });

    if (!svgRef.current || !containerRef.current || dimensions.width === 0 || dimensions.height === 0) {
      if (import.meta.env.DEV) console.log('[OrbGraph] Skipping render due to 0 dims or missing ref');
      return;
    }

    // Don't render anything if there's no topic AND no ideas (initial empty state)
    if (!topic && ideas.length === 0) {
      if (import.meta.env.DEV) console.log('[OrbGraph] Skipping render (no topic/ideas)');
      // Clear SVG content to show nothing
      const svg = d3.select(svgRef.current);
      svg.selectAll("*").remove();
      return;
    }

    const { width, height } = dimensions;
    const svg = d3.select(svgRef.current);

    // NOTE: Removed destructive cleanup to prevent flickering


    // Dynamic radius calculation helper
    const calculateRadius = (node: OrbNode): number => {
      if (!node) return 30;

      if (node.type === 'center') {
        // Dynamic size for center based on text length
        const len = node.label?.length || 0;
        // Base 60, add ~1 px per char over 10 chars, capped at 120
        return Math.min(120, Math.max(60, 50 + len * 0.8));
      }

      if (node.isWelcome) return 80;
      if (node.isCategoryHub) return 50; // Increased hub size

      // Base sizes - Increased for better legibility
      // DIFFERENTIATION: Make sub-ideas noticeably smaller (25 vs 40)
      const baseSize = node.isSubBubble ? 25 : 40;

      const priorityStyle = getPriorityStyle(node.priority || 3);
      const multiplier = priorityStyle.sizeMultiplier;

      // Text length adjustment
      const textLength = node.label?.length || 0;
      const lengthAdjustment = Math.max(0, (textLength - 12) * 2.5);

      // Cap max size 
      const maxRadius = 100;

      // Safety: Ensure minimum visible size (20px radius) even if label is short or parameters are off
      return Math.max(20, Math.min(maxRadius, (baseSize + lengthAdjustment) * multiplier));
    };



    // Background click handler for deselection
    svg.on("click", (event) => {
      // Only deselect if clicking directly on the SVG background
      if (event.target === svgRef.current && onIdeaClick) {
        onIdeaClick(null);
      }
    });

    // NOTE: Simulation reset removed to persist state


    // Reset zoom ref
    zoomRef.current = null;

    // When ideas is empty, we still want to show the center node
    // Only completely clear when explicitly resetting (handled by parent)

    // Check for welcome message
    const isWelcomeMessage = ideas.length === 1 && !topic;

    // Build nodes
    const prevNodes = nodesRef.current;
    const newNodesMap = new Map<string, OrbNode>();

    // Center layout constants
    const centerX = width / 2;
    const centerY = height / 2;
    // DUAL ORBIT LAYOUT
    // Orbit 1: Categories (Inner Ring) - MAXIMIZED distance (User Request: "big distance")
    const categoryRingRadius = Math.min(width, height) * 0.45;

    // Orbit 2: Ideas (Outer Ring) - Way out there to avoid clutter
    const ideaOrbitRadius = Math.min(width, height) * 0.85;




    // Palette for categories
    const RADIAL_PALETTE = [
      '#EF476F', // Pink
      '#F78C6B', // Salmon
      '#FFD166', // Yellow
      '#06D6A0', // Green
      '#118AB2', // Blue
      '#073B4C', // Midnight
      '#9D4EDD', // Purple
      '#FF9F1C', // Orange
      '#2EC4B6', // Teal
      '#E71D36', // Red
    ];

    // Center node - Fixed at screen center
    newNodesMap.set('CENTER', {
      id: 'CENTER',
      label: topic || '',
      type: 'center',
      fx: centerX,
      fy: centerY,
      x: centerX,
      y: centerY
    });

    // Calculate depth for each idea (for alternating colors)
    const getDepth = (ideaId: string, depth = 2): number => {
      const idea = ideas.find(i => i.id === ideaId);
      if (!idea?.parentId) return depth;
      if (idea.parentId.startsWith('CAT-')) return depth;
      return getDepth(idea.parentId, depth + 1);
    };

    // Find unique categories in use
    const usedCategories = new Set<string>();
    const parentIds = new Set<string>(); // Set of IDs that are parents
    ideas.forEach(idea => {
      if (!idea.parentId && idea.category) {
        usedCategories.add(idea.category);
      }
      if (idea.parentId) {
        parentIds.add(idea.parentId);
      }
    });

    // Helper to find ancestor category if not directly present
    const findAncestorCategory = (nodeId: string, visited = new Set<string>()): string | undefined => {

      if (visited.has(nodeId)) return undefined;
      visited.add(nodeId);

      const node = newNodesMap.get(nodeId);
      if (!node) return undefined;
      if (node.category) return node.category;
      if (node.parentId) return findAncestorCategory(node.parentId, visited);
      return undefined;
    };

    // Add category hub nodes with FIXED radial positions
    const sortedCategories = Array.from(usedCategories).sort(); // Sort for consistent ordering
    sortedCategories.forEach((cat, i) => {
      const categoryStyle = getCategoryStyle(cat);
      // Equal angular spacing
      const angle = (i / sortedCategories.length) * 2 * Math.PI - (Math.PI / 2); // Start from top (-90deg)
      const cx = centerX + Math.cos(angle) * categoryRingRadius;
      const cy = centerY + Math.sin(angle) * categoryRingRadius;

      newNodesMap.set(`CAT-${cat}`, {
        id: `CAT-${cat}`,
        label: `${categoryStyle.icon} ${categoryStyle.label}`,
        type: 'idea',
        category: cat as any,
        depth: 1,
        isCategoryHub: true,
        fx: cx, // FIX Position
        fy: cy, // FIX Position
        x: cx,
        y: cy
        // We'll use custom colors in rendering
      });
    });

    // START SECTOR LOGIC
    const categoryAngles = new Map<string, number>();
    sortedCategories.forEach((cat, i) => {
      const angle = (i / sortedCategories.length) * 2 * Math.PI - (Math.PI / 2);
      categoryAngles.set(cat, angle);
    });
    // END SECTOR LOGIC


    // Idea nodes - Do NOT fix position, let them float around their hubs
    ideas.forEach(idea => {
      const isWelcome = ideas.length === 1 && !topic;
      const depth = getDepth(idea.id);
      newNodesMap.set(idea.id, {
        id: idea.id,
        label: idea.label,
        desc: idea.description,
        type: 'idea',
        isFocused: idea.id === activeIdeaId,
        isWelcome: isWelcome,
        isSubBubble: !!idea.parentId,
        hasSubIdeas: parentIds.has(idea.id),
        parentId: idea.parentId,
        category: idea.category,
        priority: idea.priority,
        state: idea.state,
        depth: depth,
        researchData: idea.researchData
      });

    });

    // Merge with previous positions (for smooth transitions of non-fixed nodes)
    const nodes: OrbNode[] = Array.from(newNodesMap.values()).map(newNode => {
      // If it's a hub or center, force the new fixed position
      if (newNode.fx != null) return newNode;

      const prevNode = prevNodes.find(n => n.id === newNode.id);
      if (prevNode) {
        return { ...newNode, x: prevNode.x, y: prevNode.y, vx: prevNode.vx, vy: prevNode.vy };
      }
      return {
        ...newNode,
        x: centerX + (Math.random() - 0.5) * 50,
        y: centerY + (Math.random() - 0.5) * 50
      };
    });

    nodesRef.current = nodes;

    // Build links
    const links: OrbLink[] = [];

    // Link category hubs to center
    sortedCategories.forEach(cat => {
      links.push({ source: 'CENTER', target: `CAT-${cat}`, relationshipType: 'parent-child', strength: 2 }); // Strong link
    });

    // Link ideas
    ideas.forEach(idea => {
      if (idea.parentId && newNodesMap.has(idea.parentId)) {
        links.push({ source: idea.parentId, target: idea.id, relationshipType: 'parent-child', strength: 0.8 });
      } else if (idea.category && usedCategories.has(idea.category)) {
        links.push({ source: `CAT-${idea.category}`, target: idea.id, relationshipType: 'parent-child', strength: 0.8 });
      } else {
        links.push({ source: 'CENTER', target: idea.id, relationshipType: 'parent-child', strength: 0.5 });
      }

      // Connections
      if (idea.connections) {
        idea.connections.forEach(connId => {
          if (newNodesMap.has(connId) && !links.some(l =>
            (l.source === idea.id && l.target === connId) ||
            (l.source === connId && l.target === idea.id)
          )) {
            links.push({ source: idea.id, target: connId, relationshipType: 'connection', strength: 0.3 });
          }
        });
      }
    });

    // Setup simulation
    if (!simulationRef.current) {
      // Initialize simulation
      simulationRef.current = d3.forceSimulation(nodes)
        .force("link", d3.forceLink(links).id((d: any) => d.id).distance((d: any) => {
          // Shorter distance for leaves to cluster tightly around hubs
          if (d.target.id.startsWith('CAT-')) return categoryRingRadius * 0.8;

          // Gap bridge: Distance needed from Inner (0.28) to Outer (0.55) is 0.27 * dim 
          // Approx 250px on standard screen.
          // Parent ideas go even further.
          const gap = ideaOrbitRadius - categoryRingRadius;
          if (d.target.hasSubIdeas) return gap + 80;

          return gap + 20; // Standard leaf distance bridging the gap

        }).strength((d: any) => d.strength || 0.6)) // Relaxed link strength (was 0.8) to allow fanning


        .force("charge", d3.forceManyBody().strength((d: any) => {
          // Center and Hubs shouldn't repel too much, mostly leaves need spacing
          if (d.type === 'center') return -3000; // Strong repulsive core
          if (d.isCategoryHub) return -400;

          return -600; // Reduced repulsion to prevent huge spread


        }))
        .force("collide", d3.forceCollide().radius((d: any) => calculateRadius(d) * 1.4).iterations(3))


        // SECTOR FORCE: Push nodes towards their category angle, but further out
        .force("cluster", (alpha: number) => {
          for (const node of nodes) {
            if (node.type === 'center' || node.isCategoryHub) continue; // Hubs are fixed

            // Find target angle via ancestor
            const cat = node.category || findAncestorCategory(node.id);
            let targetAngle = -Math.PI / 2;

            if (cat && categoryAngles.has(cat)) {
              targetAngle = categoryAngles.get(cat)!;
            }

            // FLARING: Fan out significantly to create space between sectors
            // Use Outer Orbit Radius for all ideas
            // Parent ideas get pushed slightly further for the "bloom" effect
            const baseRadius = ideaOrbitRadius;
            const multiplier = node.hasSubIdeas ? 1.15 : 1.0;
            const targetDist = baseRadius * multiplier;
            const targetX = centerX + Math.cos(targetAngle) * targetDist;
            const targetY = centerY + Math.sin(targetAngle) * targetDist;





            // Apply stronger sector force
            node.vx! += (targetX - node.x!) * 0.35 * alpha;
            node.vy! += (targetY - node.y!) * 0.35 * alpha;

            // VOID FORCE: Keep center AND Inner Orbit empty of regular nodes
            // Calculate distance to center
            const dx = node.x! - centerX;
            const dy = node.y! - centerY;
            const dist = Math.sqrt(dx * dx + dy * dy);

            // EXCLUSION ZONE:
            // Ideas must stay OUTSIDE the Category Ring.
            // Give them a buffer of 50px beyond the category ring.
            const minKeepout = categoryRingRadius + 50;

            if (dist < minKeepout) {
              // Soft push if far in, Hard push if crossing the line
              const pushStrength = 0.8 * alpha;
              const angle = Math.atan2(dy, dx);

              // Apply strong outward velocity
              node.vx! += Math.cos(angle) * pushStrength;
              node.vy! += Math.sin(angle) * pushStrength;
            }
          }

        });




      // Removed complex manual clustering force in favor of fixed hubs
    } else {
      // Gentle update for existing simulation
      const sim = simulationRef.current;
      sim.nodes(nodes);
      (sim.force("link") as d3.ForceLink<OrbNode, OrbLink>).links(links);

      // Only reheat significantly if node count changed
      if (sim.nodes().length !== nodes.length) {
        sim.alpha(0.5).restart();
      } else {
        sim.alpha(0.1).restart(); // Gentle reheating for position adjustments
      }
    }

    // Setup zoom
    if (!zoomRef.current) {
      zoomRef.current = d3.zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.1, 3]) // Allow zooming out more
        .on("zoom", (event) => {
          transformRef.current = event.transform;
          svg.select(".zoom-group").attr("transform", event.transform.toString());
        });

      // Initialize zoomed out to see the larger graph
      const initialTransform = d3.zoomIdentity
        .translate(width / 2, height / 2)
        .scale(0.6) // Start at 60% zoom
        .translate(-width / 2, -height / 2);

      svg.call(zoomRef.current).call(zoomRef.current.transform, initialTransform);
    }

    // Create zoom group
    const zoomGroup = svg.selectAll<SVGGElement, unknown>(".zoom-group").data([0]).join("g").attr("class", "zoom-group");
    zoomGroup.attr("transform", transformRef.current.toString());

    // Create gradients - use join to prevent flicker
    const defs = svg.selectAll("defs").data([0]).join("defs");
    defs.selectAll("*").remove(); // Clear existing definitions to avoid duplicates



    // orb gradient
    const gradient = defs.append("radialGradient").attr("id", orbGradientId).attr("cx", "30%").attr("cy", "30%").attr("r", "70%");
    gradient.append("stop").attr("offset", "0%").attr("stop-color", "#ffffff").attr("stop-opacity", 0.98);
    gradient.append("stop").attr("offset", "100%").attr("stop-color", activeTheme.colors.ideaNode || "#e2e8f0").attr("stop-opacity", 0.85);

    // welcome gradient
    const welcomeGrad = defs.append("radialGradient").attr("id", welcomeGradientId).attr("cx", "30%").attr("cy", "30%").attr("r", "70%");
    welcomeGrad.append("stop").attr("offset", "0%").attr("stop-color", "#a855f7").attr("stop-opacity", 0.2);
    welcomeGrad.append("stop").attr("offset", "50%").attr("stop-color", "#6366f1").attr("stop-opacity", 0.3);
    welcomeGrad.append("stop").attr("offset", "100%").attr("stop-color", "#3b82f6").attr("stop-opacity", 0.4);

    // Glow filter
    const filter = defs.append("filter").attr("id", glowId).attr("x", "-50%").attr("y", "-50%").attr("width", "200%").attr("height", "200%");
    filter.append("feGaussianBlur").attr("stdDeviation", "4").attr("result", "coloredBlur");
    const feMerge = filter.append("feMerge");
    feMerge.append("feMergeNode").attr("in", "coloredBlur");
    feMerge.append("feMergeNode").attr("in", "SourceGraphic");

    // Shadow filter for depth
    const shadow = defs.append("filter").attr("id", "drop-shadow").attr("height", "130%");
    shadow.append("feGaussianBlur").attr("in", "SourceAlpha").attr("stdDeviation", 3);
    shadow.append("feOffset").attr("dx", 2).attr("dy", 2).attr("result", "offsetblur");
    const feMergeShadow = shadow.append("feMerge");
    feMergeShadow.append("feMergeNode"); // shadow
    feMergeShadow.append("feMergeNode").attr("in", "SourceGraphic");


    // D3 Color Scale for categories
    const categoryColorScale = d3.scaleOrdinal(RADIAL_PALETTE);

    // MOVED: Draw links BEFORE nodes so they appear behind
    const linkGroup = zoomGroup.selectAll(".links").data([0]).join("g").attr("class", "links");

    // Draw nodes AFTER links
    const nodeGroup = zoomGroup.selectAll<SVGGElement, unknown>(".node-group").data([0]).join("g").attr("class", "node-group");
    nodeGroup.raise(); // Ensure nodes are strictly on top


    const link = linkGroup
      .selectAll("path")
      .data(links)
      .join("path")
      .attr("class", "link")
      .attr("fill", "none")
      .attr("stroke", (d: any) => {
        // Color link by category of the target or source (if it's a hub)
        let category: any = null;
        if (d.source.category) category = d.source.category;
        else if (d.target.category) category = d.target.category;
        else if (d.source.id && d.source.id.startsWith('CAT-')) category = d.source.category;

        return category ? categoryColorScale(category) : "#cbd5e1";
      })
      .attr("stroke-width", (d: any) => d.relationshipType === 'parent-child' ? 2 : 1.5)
      .attr("stroke-opacity", 0.6);

    // Helper to get color for a node
    const getNodeColor = (d: any) => {
      if (d.category) return categoryColorScale(d.category);
      return "#94a3b8"; // Fallback grey
    };

    // Helper for state colors
    const getStateColor = (state: string) => {
      switch (state) {
        case 'approved': return '#3b82f6';
        case 'rejected': return '#ef4444';
        case 'pending': return '#f59e0b';
        case 'new': return '#10b981';
        default: return '#64748b';
      }
    };

    // Text wrapping helper
    const wrap = (textSelection: any, width: number) => {
      textSelection.each(function (this: any) {
        const text = d3.select(this);
        const words = text.text().split(/\s+/).reverse();
        let word;
        let line: string[] = [];
        let lineNumber = 0;
        const lineHeight = 1.2; // ems
        const y = text.attr("y");
        const dy = 0; // centered vertically initially
        let tspan = text.text(null).append("tspan").attr("x", 0).attr("y", y).attr("dy", dy + "em");

        while (word = words.pop()) {
          line.push(word);
          tspan.text(line.join(" "));
          if (tspan.node()!.getComputedTextLength() > width) {
            line.pop();
            tspan.text(line.join(" "));
            line = [word];
            tspan = text.append("tspan").attr("x", 0).attr("y", y).attr("dy", ++lineNumber * lineHeight + dy + "em").text(word);
          }
        }
        // Vertically center the block
        const totalLines = lineNumber + 1;
        const initialDy = -((totalLines - 1) * lineHeight) / 2;
        text.selectAll("tspan").attr("dy", (d: any, i: number) => (initialDy + i * lineHeight) + "em");
      });
    };

    const node = nodeGroup
      .selectAll<SVGGElement, OrbNode>("g")
      .data(nodes, (d: any) => d.id)
      .join(
        enter => {

          const g = enter.append("g")
            .attr("class", "cursor-pointer")
            .style("opacity", 0)
            .attr("transform", (d: any) => `translate(${d.x || width / 2},${d.y || height / 2}) scale(0)`);

          // Add circle 
          g.append("circle")
            .attr("r", (d: any) => calculateRadius(d))
            .attr("fill", (d: any) => {
              if (d.type === 'center') return "#ffffff"; // Solid white center
              if (d.isWelcome) return "url(#welcome-gradient)";
              // Use category color (recursive lookup)
              const cat = d.category || findAncestorCategory(d.id);
              if (d.isCategoryHub && d.category) return categoryColorScale(d.category);
              if (cat) return categoryColorScale(cat); // Solid color for leaves
              // Fallback for uncategorized/orphan nodes
              return "#64748b";
            })


            .attr("stroke", (d: any) => {
              if (d.isFocused) return "#3b82f6";
              // All others get white stroke for distinct separation 
              return "#ffffff";
            })
            .attr("stroke-width", (d: any) => {
              if (d.isFocused) return 4;
              if (d.isCategoryHub) return 2;
              if (d.type === 'center') return 0;
              // DIFFERENTIATION: Thicker border for main ideas, thin for sub-ideas
              return d.isSubBubble ? 1 : 3;
            })
            .style("opacity", (d: any) => d.isSubBubble ? 0.9 : 1) // Subtly fade sub-ideas
            .style("filter", "url(#drop-shadow)"); // Apply shadow



          // Add text 
          g.append("text")
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "central")
            .attr("font-size", (d: any) => {
              if (d.type === 'center') return "14px";
              if (d.isWelcome) return "16px";
              if (d.isCategoryHub) return "13px";
              // DIFFERENTIATION: Smaller text for sub-ideas
              return d.isSubBubble ? "10px" : "11px";
            })

            .attr("font-weight", (d: any) => d.type === 'center' || d.isCategoryHub ? "700" : "500")
            .attr("fill", (d: any) => {
              // Center: Dark Text
              if (d.type === 'center') return "#1e293b";
              // Hubs: White Text
              if (d.isCategoryHub) return "#ffffff";
              // Leaves: White Text for readability on colored background
              return "#ffffff";
            })

            .style("pointer-events", "none")
            .text((d: any) => d.label)
            .each(function (d: any) {
              if (d.type === 'center') {
                // Apply wrapping for center node
                // Max width is roughly diameter minus padding (e.g. radius*2 - 20)
                const r = calculateRadius(d);
                d3.select(this).call(wrap, r * 1.6);
              }
            });


          // Hover effect 
          g.on("mouseenter", function (event, d: any) {
            if (d.type === 'center') return;
            d3.select(this).transition().duration(150)
              .attr("transform", `translate(${d.x},${d.y}) scale(1.1)`);
          }).on("mouseleave", function (event, d: any) {
            if (d.type === 'center') return;
            d3.select(this).transition().duration(150)
              .attr("transform", `translate(${d.x},${d.y}) scale(1)`);
          });

          // State badge
          g.each(function (d: any) {
            if (d.state && d.state !== 'new' && !d.isCategoryHub && d.type !== 'center') {
              const badge = d3.select(this).append("circle")
                .attr("r", 4)
                .attr("cx", calculateRadius(d) * 0.7)
                .attr("cy", -calculateRadius(d) * 0.7)
                .attr("fill", getStateColor(d.state));
            }
          });

          // Animate entry (Opacity only, no scale/radius animation to prevent zero-size bug)
          g.transition()
            .duration(500)
            .style("opacity", 1)
            .attr("transform", (d: any) => `translate(${d.x || width / 2},${d.y || height / 2}) scale(1)`);

          g.select("circle")
            .attr("r", (d: any) => calculateRadius(d));

          return g;
        },
        update => {
          // Update existing nodes (mostly text/radius/color if changed)
          update.select("circle")
            .transition().duration(300)
            .attr("r", (d: any) => calculateRadius(d))
            .attr("fill", (d: any) => {
              if (d.type === 'center') return "#ffffff";
              if (d.isWelcome) return "url(#welcome-gradient)";
              const cat = d.category || findAncestorCategory(d.id);
              if (d.isCategoryHub && d.category) return categoryColorScale(d.category);
              if (cat) return categoryColorScale(cat);
              // Fallback for uncategorized/orphan nodes: Use a darker slate for visibility with white text
              return "#64748b";
            });

          // UPDATE TEXT: Re-apply text and wrapping for center node
          update.select("text")
            .attr("fill", (d: any) => {
              if (d.type === 'center') return "#1e293b";
              if (d.isCategoryHub) return "#ffffff";
              return "#ffffff"; // White text works on colored nodes and our new dark fallback
            })
            .text((d: any) => d.label)
            .each(function (d: any) {
              if (d.type === 'center') {
                const r = calculateRadius(d);
                d3.select(this).call(wrap, r * 1.6);
              }
            });

          return update;
        },
        exit => exit.transition().duration(300).style("opacity", 0).remove()
      );

    // No need for separate text update as it's handled in Enter/Update
    node.select("text").text((d: any) => d.label);

    // Add drag behavior
    const drag = d3.drag<SVGGElement, OrbNode>()
      .on("start", function (event, d) {
        if (!event.active && simulationRef.current) simulationRef.current.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on("drag", function (event, d) {
        d.fx = event.x;
        d.fy = event.y;
      })
      .on("end", function (event, d) {
        if (!event.active && simulationRef.current) simulationRef.current.alphaTarget(0);

        // CRITICAL: Do NOT unfix the center or category hubs
        if (d.id !== 'CENTER' && !d.isCategoryHub) {
          d.fx = null;
          d.fy = null;
        }
      });

    node.filter((d: any) => d.id !== 'CENTER' && !d.isCategoryHub).call(drag as any);

    // Click handlers
    node.on("click", function (event, d: any) {
      event.stopPropagation();
      if (d.id !== 'CENTER' && onIdeaClick) {
        onIdeaClick(d.id, { x: event.x, y: event.y }, event.shiftKey);
      }
    });

    node.on("dblclick", function (event, d: any) {
      event.stopPropagation();
      if (d.id !== 'CENTER' && onIdeaDoubleClick) {
        onIdeaDoubleClick(d.id);
      }
    });

    // Hover handlers for tooltip
    node.on("mouseenter", function (event, d: any) {
      if (d.id !== 'CENTER' && d.type !== 'center' && !d.isCategoryHub) {
        const rect = containerRef.current?.getBoundingClientRect();
        if (rect) {
          setTooltipData({
            idea: d,
            x: event.clientX - rect.left,
            y: event.clientY - rect.top
          });
        }
      }
    });

    node.on("mouseleave", function () {
      setTooltipData(null);
    });

    // Tick function
    simulationRef.current.on("tick", () => {
      // Update link positions with curved paths
      link.attr("d", (d: any) => {
        const sourceX = d.source.x;
        const sourceY = d.source.y;
        const targetX = d.target.x;
        const targetY = d.target.y;

        // Calculate control point for quadratic bezier
        const midX = (sourceX + targetX) / 2;
        const midY = (sourceY + targetY) / 2;
        const dx = targetX - sourceX;
        const dy = targetY - sourceY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const curvature = dist * 0.15;

        // Perpendicular offset for curve
        const nx = -dy / dist;
        const ny = dx / dist;
        const controlX = midX + nx * curvature;
        const controlY = midY + ny * curvature;

        return `M${sourceX},${sourceY} Q${controlX},${controlY} ${targetX},${targetY}`;
      });

      // Update node positions
      node.attr("transform", (d: any) => `translate(${d.x},${d.y})`);
    });

  }, [ideas, topic, onIdeaClick, onIdeaDoubleClick, activeTheme, dimensions]); // Added dimensions dependency

  // Separate effect for handling selection updates without restarting simulation
  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    const nodes = svg.selectAll<SVGGElement, OrbNode>(".node-group g");

    // Update data binding for isFocused
    nodes.each(function (d) {
      d.isFocused = d.id === activeIdeaId;
    });

    // Apply smooth transition to visual elements
    nodes.select("circle")
      .transition()
      .duration(300)
      .attr("stroke", (d: any) => {
        if (d.isFocused) return "#3b82f6";
        if (d.isWelcome) return "#a855f7";
        if (d.type === 'center') return "#a855f7";
        if (d.isCategoryHub) return "#ffffff";
        const isOddDepth = (d.depth || 2) % 2 === 0;
        return isOddDepth ? "#374151" : "#e5e7eb";
      })
      .attr("stroke-width", (d: any) => {
        if (d.type === 'center' || d.isWelcome) return d.isFocused ? 4 : 3;
        if (d.isCategoryHub) return 2.5;
        return d.isFocused ? 4 : (d.isSubBubble ? 1.5 : 2);
      });

  }, [activeIdeaId, selectedIdeaIds]);

  return (
    <>
      <div ref={containerRef} className="w-full h-full absolute top-0 left-0 cursor-move">
        <svg ref={svgRef} className="w-full h-full block" style={{ cursor: 'grab' }} />
      </div>

      {/* Image Generator Modal */}
      {imageGeneratorIdea && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={() => setImageGeneratorIdea(null)}
        >
          <div
            className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Generate Image for Idea</h3>
              <button
                onClick={() => setImageGeneratorIdea(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              <strong>{imageGeneratorIdea.label}</strong>
              {imageGeneratorIdea.description && `: ${imageGeneratorIdea.description}`}
            </p>
            <IdeaImageGenerator
              idea={imageGeneratorIdea}
              onImageGenerated={(ideaId, imageUrl) => {
                if (onIdeaImageGenerated) {
                  onIdeaImageGenerated(ideaId, imageUrl);
                }
                setImageGeneratorIdea(null);
              }}
            />
          </div>
        </div>
      )}

      {/* Hover Tooltip for Idea Details */}
      {tooltipData && tooltipData.idea && (
        <div
          className="absolute z-50 pointer-events-none"
          style={{
            left: Math.min(tooltipData.x + 15, (containerRef.current?.offsetWidth || 400) - 220),
            top: Math.min(tooltipData.y - 10, (containerRef.current?.offsetHeight || 300) - 100)
          }}
        >
          <div className="bg-slate-900/95 backdrop-blur-sm text-white rounded-xl shadow-2xl border border-slate-700 p-3 max-w-[200px]">
            <div className="font-semibold text-sm mb-1 text-white">{tooltipData.idea.label}</div>
            {tooltipData.idea.desc && (
              <p className="text-xs text-slate-300 mb-2 line-clamp-3">{tooltipData.idea.desc}</p>
            )}

            {/* Research Data Tooltip Section */}
            {tooltipData.idea.researchData && (
              <div className="mt-2 pt-2 border-t border-slate-700/50 mb-2">
                <div className="flex items-center gap-1 mb-1">
                  <span className="text-[10px] uppercase font-bold text-blue-400">AI Research</span>
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></div>
                </div>

                {(() => {
                  try {
                    // Try to parse structured data
                    const validJsonString = tooltipData.idea.researchData
                      .replace(/```json\s*/g, '')
                      .replace(/```\s*/g, '')
                      .trim();
                    const data = JSON.parse(validJsonString);
                    return (
                      <div className="flex flex-col gap-1">
                        {data.summary && <p className="text-[10px] text-slate-300 leading-tight">{data.summary}</p>}
                        {data.insight && (
                          <div className="bg-slate-800/50 p-1.5 rounded border border-slate-700/50">
                            <p className="text-[10px] text-blue-200 leading-tight">💡 {data.insight}</p>
                          </div>
                        )}
                        {data.source && (
                          <a
                            href={data.source}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[9px] text-blue-400 hover:text-blue-300 hover:underline flex items-center gap-1 mt-0.5"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                            View Source
                          </a>
                        )}
                      </div>
                    );
                  } catch (e) {
                    // Fallback for plain text
                    return (
                      <p className="text-[10px] text-slate-300 leading-tight bg-slate-800/50 p-1.5 rounded border border-slate-700/50">
                        {tooltipData.idea.researchData}
                      </p>
                    );
                  }
                })()}
              </div>
            )}

            <div className="flex flex-wrap gap-1.5 text-[10px]">
              {tooltipData.idea.category && (
                <span className="px-1.5 py-0.5 bg-blue-600/30 text-blue-200 rounded">
                  {getCategoryStyle(tooltipData.idea.category).icon} {tooltipData.idea.category}
                </span>
              )}
              {tooltipData.idea.state && tooltipData.idea.state !== 'new' && (
                <span className="px-1.5 py-0.5 bg-purple-600/30 text-purple-200 rounded">
                  {getStateStyle(tooltipData.idea.state).badge} {tooltipData.idea.state}
                </span>
              )}
              {tooltipData.idea.priority && tooltipData.idea.priority >= 4 && (
                <span className="px-1.5 py-0.5 bg-amber-600/30 text-amber-200 rounded">
                  ⭐ High Priority
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default React.memo(OrbGraph);

// Logic to wrap and vertically center text
function updateCenteredText(textEl: d3.Selection<SVGTextElement, unknown, null, undefined>, text: string, width: number) {
  if (!text || !textEl.node()) return;

  const words = text.split(/\s+/).reverse();
  let word;
  let line: string[] = [];
  let lines: string[] = [];

  textEl.text(null);
  let tspan = textEl.append("tspan");
  const tspanNode = tspan.node();

  if (!tspanNode) return;

  while ((word = words.pop())) {
    line.push(word);
    tspan.text(line.join(" "));
    const textLength = tspanNode.getComputedTextLength();
    if (textLength > width) {
      line.pop();
      lines.push(line.join(" "));
      line = [word];
      tspan.text(word);
    }
  }
  if (line.length > 0) lines.push(line.join(" "));

  textEl.text(null);
  const lineHeight = 1.2;
  const totalHeight = lines.length * lineHeight;
  const startY = -(totalHeight / 2) + (lineHeight / 2) - 0.1;

  lines.forEach((l, i) => {
    textEl.append("tspan")
      .attr("x", 0)
      .attr("dy", i === 0 ? `${startY}em` : `${lineHeight}em`)
      .text(l);
  });
}
