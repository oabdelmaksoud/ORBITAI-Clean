import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as d3 from 'd3';
import { Idea, CATEGORY_STYLES, STATE_STYLES } from './OrbGraph';

interface IdeaTreeGraphProps {
    topic: string;
    ideas: Idea[];
    activeIdeaId: string | null;
    selectedIdeaIds?: Set<string>;
    onIdeaClick?: (ideaId: string, position?: { x: number; y: number }, shiftKey?: boolean) => void;
    onIdeaDoubleClick?: (ideaId: string) => void;
    onIdeaDelete?: (ideaId: string) => void;
}

interface TreeNode {
    id: string;
    label: string;
    description?: string;
    category?: string;
    state?: string;
    priority?: number;
    children: TreeNode[];
    x?: number;
    y?: number;
    depth?: number;
    isCenter?: boolean;
    isCategoryHub?: boolean;
    parentId?: string | null;
}

const getCategoryStyle = (category?: string) => CATEGORY_STYLES[category || 'idea'] || CATEGORY_STYLES.idea;
const getStateStyle = (state?: string) => STATE_STYLES[state || 'new'] || STATE_STYLES.new;

// Node dimensions
const NODE_WIDTH = 160;
const NODE_HEIGHT = 40;
const NODE_MARGIN_X = 180;  // Horizontal spacing between levels
const NODE_MARGIN_Y = 56;   // Vertical spacing between siblings
const CORNER_RADIUS = 8;
const ACCENT_WIDTH = 4;

const IdeaTreeGraph: React.FC<IdeaTreeGraphProps> = ({
    topic,
    ideas,
    activeIdeaId,
    selectedIdeaIds = new Set(),
    onIdeaClick,
    onIdeaDoubleClick,
    onIdeaDelete
}) => {
    const svgRef = useRef<SVGSVGElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
    const transformRef = useRef<d3.ZoomTransform>(d3.zoomIdentity);
    const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

    // Hover tooltip state
    const [hoveredIdea, setHoveredIdea] = useState<TreeNode | null>(null);
    const [tooltipPosition, setTooltipPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

    // Build tree structure from flat ideas array
    // This is memoized to prevent rebuilding on every render
    const buildTree = useCallback((): TreeNode => {
        const centerNode: TreeNode = {
            id: 'CENTER',
            label: topic || 'Central Idea',
            isCenter: true,
            children: []
        };

        if (!ideas || ideas.length === 0) return centerNode;

        const nodeMap = new Map<string, TreeNode>();
        nodeMap.set('CENTER', centerNode);

        // 1. Initialize all nodes first
        ideas.forEach(idea => {
            nodeMap.set(idea.id, {
                id: idea.id,
                label: idea.label,
                description: idea.description,
                category: idea.category,
                state: idea.state,
                priority: idea.priority,
                parentId: idea.parentId,
                children: [] // Initialize empty children
            });
        });

        // 2. Identify and create Category Hubs
        // We look for unique categories from ideas that are either top-level (no parent) OR explicitly marked as categories
        const usedCategories = new Set<string>();
        ideas.forEach(idea => {
            if (idea.category) {
                usedCategories.add(idea.category);
            }
        });

        const categoryHubs = new Map<string, TreeNode>();
        usedCategories.forEach(cat => {
            const style = getCategoryStyle(cat);
            const hub: TreeNode = {
                id: `CAT-${cat}`,
                label: style.label,
                category: cat,
                isCategoryHub: true,
                children: []
            };
            categoryHubs.set(cat, hub);
            nodeMap.set(hub.id, hub);
            // Link hub to center
            centerNode.children.push(hub);
        });

        // 3. Link nodes to their parents
        ideas.forEach(idea => {
            const node = nodeMap.get(idea.id)!;

            if (idea.parentId && nodeMap.has(idea.parentId)) {
                // Link to specific parent idea
                const parent = nodeMap.get(idea.parentId)!;
                parent.children.push(node);
            } else if (idea.category && categoryHubs.has(idea.category)) {
                // Top-level idea? Link to its Category Hub
                // But avoid linking if it IS a category definition itself (some inputs might treat it so)
                // For now, if no parentId, it goes to the Hub
                categoryHubs.get(idea.category)!.children.push(node);
            } else {
                // Orphan? Link to Center
                centerNode.children.push(node);
            }
        });

        return centerNode;
    }, [ideas, topic]);

    // Handle Resize
    useEffect(() => {
        if (!containerRef.current) return;
        const observer = new ResizeObserver(entries => {
            for (const entry of entries) {
                setDimensions({
                    width: entry.contentRect.width,
                    height: entry.contentRect.height
                });
            }
        });
        observer.observe(containerRef.current);
        return () => observer.disconnect();
    }, []);

    // D3 Render Logic
    useEffect(() => {
        if (!svgRef.current || dimensions.width === 0 || dimensions.height === 0) return;

        const { width, height } = dimensions;
        const svg = d3.select(svgRef.current);

        // Clear previous render to ensure clean state
        // NOTE: Removed destructive cleanup


        // 1. Setup Layout
        // Calculate dynamic radius based on number of ideas to prevent overlap
        const treeData = buildTree();
        const root = d3.hierarchy<TreeNode>(treeData);
        const nodeCount = root.descendants().length;

        // Base radius on node count: more nodes = larger radius
        // Minimum 40% of viewport, scales up with more nodes
        // Each node needs roughly 25-30px of circumference space for text
        const minRadius = Math.min(width, height) * 0.35;
        const nodeSpaceNeeded = nodeCount * 15; // 15px per node as base spacing
        const circumferenceNeeded = nodeSpaceNeeded;
        const radiusFromNodes = circumferenceNeeded / (2 * Math.PI);
        const radius = Math.max(minRadius, Math.min(radiusFromNodes, Math.min(width, height) * 0.45));

        // Configure Radial Tree
        // Large separation to prevent text overlap
        const treeLayout = d3.tree<TreeNode>()
            .size([2 * Math.PI, radius])
            .separation((a, b) => a.parent === b.parent ? 2 : 4);

        treeLayout(root);

        root.each(d => {
            // d.y is the radius. d3.tree auto-assigns it equidistantly up to the specified radius.
            // We want to push the inner layers out slightly to reduce clutter around the center,
            // but we must be careful not to push outer layers too far off-screen.

            if (d.depth === 1) {
                // Category hubs: Push out slightly to clear center
                d.y = (d.y ?? 0) * 1.3;
            } else if (d.depth === 2) {
                // First level children: Slight adjustment
                d.y = (d.y ?? 0) * 1.1;
            }
            // Depth 3+ (Sub-ideas): Leave at D3 assigned radius (which matches the tree size radius)
            // This ensures they stay within the calculated layout bounds.
        });

        // 2. Setup Zoom Group
        // We'll translate this group to the center of the SVG
        // 2. Setup Zoom Group - use join
        const g = svg.selectAll<SVGGElement, unknown>('.tree-content')
            .data([0])
            .join('g')
            .attr('class', 'tree-content')
            .attr('transform', `translate(${width / 2},${height / 2})`);


        // Initialize Zoom
        const zoom = d3.zoom<SVGSVGElement, unknown>()
            .scaleExtent([0.1, 3])
            .on('zoom', (event) => {
                // Apply zoom transform on top of the centering translation
                g.attr('transform', `translate(${width / 2 + event.transform.x},${height / 2 + event.transform.y}) scale(${event.transform.k})`);
                transformRef.current = event.transform;
            });

        // Only setup reset on first create
        if (!zoomRef.current) {
            svg.call(zoom)
                .call(zoom.transform, d3.zoomIdentity);
            zoomRef.current = zoom;
        } else {
            // Just update behavior, don't reset transform
            svg.call(zoom);
        }



        // 3. Draw Links
        // Custom link path that avoids crossing through text
        // Lines should start from the OUTER EDGE of text (beginning for left side, end for right side)
        const estimateTextWidth = (label: string): number => {
            const charWidth = 6; // Slightly larger for safety
            return Math.min((label?.length || 0) * charWidth + 12, 110);
        };

        // Custom path that offsets source/target based on text direction
        const linksSelection = g.selectAll<SVGPathElement, d3.HierarchyPointLink<TreeNode>>('.link')
            .data(root.links(), (d: any) => `${d.source.data.id}-${d.target.data.id}`);

        // Remove exiting links
        linksSelection.exit().remove();

        // Enter new links with fade-in
        const linksEnter = linksSelection.enter()
            .append('path')
            .attr('class', 'link')
            .attr('fill', 'none')
            .attr('stroke', '#CBD5E1')
            .attr('opacity', 0);

        // Merge enter + update and apply attributes
        const allLinks = linksEnter.merge(linksSelection)
            .attr('stroke-width', (d: any) => d.target.data.isCategoryHub ? 2 : 1.5)
            .attr('d', (d: any) => {
                // Source node position
                const srcAngle = d.source.x;
                const srcRadius = d.source.y;
                // Target node position
                const tgtAngle = d.target.x;
                const tgtRadius = d.target.y;

                // Both sides: line should start from OUTER EDGE of text
                // Right side (angle < PI): text extends outward, so outer edge = node + textWidth
                // Left side (angle >= PI): text extends inward (rotated), so outer edge = node + textWidth too
                //   because the "beginning" of text (where you start reading) is at the outer position
                const textWidth = d.source.data.isCenter ? 15 : estimateTextWidth(d.source.data.label);
                const srcOffset = textWidth;

                // Calculate source point (offset from node toward outer)
                const srcR = srcRadius + srcOffset;
                const srcA = srcAngle - Math.PI / 2; // Convert to standard angle
                const sx = srcR * Math.cos(srcA);
                const sy = srcR * Math.sin(srcA);

                // Target connects to the bullet (just before node)
                const tgtR = tgtRadius - 4;
                const tgtA = tgtAngle - Math.PI / 2;
                const tx = tgtR * Math.cos(tgtA);
                const ty = tgtR * Math.sin(tgtA);

                // Use quadratic curve for smoother appearance
                const ctrlR = (srcR + tgtR) / 2;
                const ctrlA = (srcA + tgtA) / 2;
                const cx = ctrlR * Math.cos(ctrlA);
                const cy = ctrlR * Math.sin(ctrlA);

                return `M${sx},${sy} Q${cx},${cy} ${tx},${ty}`;
            });

        // Only fade in NEW links (entering)
        linksEnter.transition().duration(400).attr('opacity', 1);

        // 4. Draw Nodes - proper enter/update/exit pattern
        const nodesSelection = g.selectAll<SVGGElement, d3.HierarchyPointNode<TreeNode>>('.node')
            .data(root.descendants(), (d: any) => d.data.id);

        // Remove exiting nodes
        nodesSelection.exit().remove();

        // Enter new nodes
        const nodesEnter = nodesSelection.enter()
            .append('g')
            .attr('class', 'node cursor-pointer')
            .attr('opacity', 0);

        // Add circle to NEW nodes only
        nodesEnter.append('circle')
            .attr('r', d => d.data.isCenter ? 8 : (d.data.isCategoryHub ? 6 : 4))
            .attr('fill', d => {
                if (d.data.isCenter) return '#6366F1';
                return getCategoryStyle(d.data.category).color;
            })
            .attr('stroke', '#fff')
            .attr('stroke-width', 2);

        // Merge enter + update for shared attributes
        const allNodes = nodesEnter.merge(nodesSelection)
            .attr('transform', d => {
                // Keep center node at origin with no rotation (horizontal text)
                if (d.data.isCenter) {
                    return 'translate(0,0)';
                }
                return `
                rotate(${(d.x ?? 0) * 180 / Math.PI - 90}) 
                translate(${d.y},0)
            `;
            })
            .on('click', (event, d) => {
                event.stopPropagation();
                if (d.data.id !== 'CENTER' && onIdeaClick) {
                    onIdeaClick(d.data.id, { x: event.clientX, y: event.clientY }, event.shiftKey);
                }
            })
            .on('dblclick', (event, d) => {
                event.stopPropagation();
                if (d.data.id !== 'CENTER' && onIdeaDoubleClick) {
                    onIdeaDoubleClick(d.data.id);
                }
            })
            .on('mouseenter', (event, d) => {
                if (!d.data.isCenter && !d.data.isCategoryHub) {
                    setHoveredIdea(d.data);
                    const rect = containerRef.current?.getBoundingClientRect();
                    if (rect) {
                        setTooltipPosition({
                            x: event.clientX - rect.left + 15,
                            y: event.clientY - rect.top + 15
                        });
                    }
                }
                // Highlight path to root
                g.selectAll('path.link')
                    .filter((l: any) => l.target === d || d.ancestors().includes(l.target))
                    .attr('stroke', '#3B82F6')
                    .attr('stroke-width', 2);
            })
            .on('mouseleave', () => {
                setHoveredIdea(null);
                // Reset links
                g.selectAll('path.link')
                    .attr('stroke', '#CBD5E1')
                    .attr('stroke-width', (d: any) => d.target.data.isCategoryHub ? 2 : 1.5);
            });

        // Update circles on existing nodes (for color/size changes)
        allNodes.select('circle')
            .attr('r', d => d.data.isCenter ? 8 : (d.data.isCategoryHub ? 6 : 4))
            .attr('fill', d => {
                if (d.data.isCenter) return '#6366F1';
                return getCategoryStyle(d.data.category).color;
            });

        // Fade in only new nodes
        nodesEnter.transition().duration(400).attr('opacity', 1);

        // Create a separate layer for text labels ON TOP of everything
        // This ensures text is never obscured by lines or circles
        // Use data join pattern to avoid creating multiple layers on re-render
        const labelsLayer = g.selectAll<SVGGElement, unknown>('.labels-layer')
            .data([0])
            .join('g')
            .attr('class', 'labels-layer');

        // Labels with proper enter/update/exit - NO more .remove() that causes flicker
        const labelsSelection = labelsLayer.selectAll<SVGGElement, d3.HierarchyPointNode<TreeNode>>('.label')
            .data(root.descendants(), (d: any) => d.data.id);

        // Remove exiting labels
        labelsSelection.exit().remove();

        // Enter new labels
        const labelsEnter = labelsSelection.enter()
            .append('g')
            .attr('class', 'label cursor-pointer')
            .attr('opacity', 0);

        // Add text to NEW labels only
        labelsEnter.append('text')
            .attr('dy', '0.31em')
            .attr('font-size', d => d.data.isCenter ? '14px' : '10px')
            .attr('font-weight', d => d.data.isCenter || d.data.isCategoryHub ? 'bold' : 'normal')
            .attr('fill', '#334155')
            .attr('stroke', '#ffffff')
            .attr('stroke-width', 4)
            .attr('paint-order', 'stroke')
            .attr('stroke-linejoin', 'round')
            .style('pointer-events', 'auto');

        // Merge enter + update for shared attributes
        const allLabels = labelsEnter.merge(labelsSelection)
            .attr('transform', d => {
                // Keep center node at origin with no rotation (horizontal text)
                if (d.data.isCenter) {
                    return 'translate(0,0)';
                }
                return `
                rotate(${(d.x ?? 0) * 180 / Math.PI - 90}) 
                translate(${d.y ?? 0},0)
            `;
            })
            .on('click', (event, d) => {
                event.stopPropagation();
                if (d.data.id !== 'CENTER' && onIdeaClick) {
                    onIdeaClick(d.data.id, { x: event.clientX, y: event.clientY }, event.shiftKey);
                }
            })
            .on('dblclick', (event, d) => {
                event.stopPropagation();
                if (d.data.id !== 'CENTER' && onIdeaDoubleClick) {
                    onIdeaDoubleClick(d.data.id);
                }
            });

        // Update text attributes on all labels (enter + existing)
        allLabels.select('text')
            .attr('x', d => {
                // Center node: center the text
                if (d.data.isCenter) return 0;
                // Other nodes: offset based on position in radial layout
                return (d.x ?? 0) < Math.PI ? 6 : -6;
            })
            .attr('text-anchor', d => {
                // Center node: middle aligned
                if (d.data.isCenter) return 'middle';
                // Other nodes: start/end based on position
                return (d.x ?? 0) < Math.PI ? 'start' : 'end';
            })
            .attr('transform', d => {
                // Center node: no rotation needed
                if (d.data.isCenter) return null;
                return (d.x ?? 0) >= Math.PI ? 'rotate(180)' : null;
            })
            .text(d => d.data.label);

        // Text wrapping - applied to all text elements
        allLabels.select('text').each(function (d) {
            const text = d3.select(this);
            const width = 120;
            const words = d.data.label.split(/\s+/).reverse();
            let word;
            let line: string[] = [];
            let lineNumber = 0;
            const lineHeight = 1.1;
            const x = text.attr("x");
            const y = 0;
            const dy = parseFloat(text.attr("dy")) || 0.31;

            // Clear existing content and rebuild tspans
            text.text(null);
            text.selectAll('tspan').remove();

            let tspan = text.append("tspan")
                .attr("x", x)
                .attr("y", y)
                .attr("dy", dy + "em");

            while (word = words.pop()) {
                line.push(word);
                tspan.text(line.join(" "));
                if (tspan.node()!.getComputedTextLength() > width && line.length > 1) {
                    line.pop();
                    tspan.text(line.join(" "));
                    line = [word];
                    tspan = text.append("tspan")
                        .attr("x", x)
                        .attr("y", y)
                        .attr("dy", ++lineNumber * lineHeight + dy + "em")
                        .text(word);
                }
            }
        });

        // Fade in only new labels
        labelsEnter.transition().duration(400).attr('opacity', 1);

    }, [dimensions, buildTree, activeIdeaId]); // Re-run when these change

    return (
        <div ref={containerRef} className="w-full h-full absolute top-0 left-0 bg-slate-50">
            <svg ref={svgRef} className="w-full h-full block cursor-move" />

            {/* Tooltip (reused) */}
            {hoveredIdea && (
                <div
                    className="absolute pointer-events-none z-50 transition-all duration-75"
                    style={{
                        left: Math.min(tooltipPosition.x, dimensions.width - 280),
                        top: Math.min(tooltipPosition.y, dimensions.height - 180),
                        maxWidth: '260px'
                    }}
                >
                    <div className="bg-slate-900/95 backdrop-blur-sm text-white rounded-lg p-3 shadow-xl border border-slate-700/50">
                        <div className="font-bold text-sm mb-1 flex items-center gap-2">
                            <span>{getCategoryStyle(hoveredIdea.category).icon}</span>
                            {hoveredIdea.label}
                        </div>
                        {hoveredIdea.description && (
                            <div className="text-xs text-slate-300 line-clamp-3">{hoveredIdea.description}</div>
                        )}
                        <div className="flex flex-wrap gap-2 text-[10px] mt-2">
                            <span className="px-1.5 py-0.5 rounded-full bg-white/10">
                                {getCategoryStyle(hoveredIdea.category).label}
                            </span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default React.memo(IdeaTreeGraph);
