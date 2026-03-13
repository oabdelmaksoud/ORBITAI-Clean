import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import { Idea } from '@src/services/chatApi';

interface MindMapGraphProps {
    ideas: Idea[];
    topic?: string;
    onIdeaClick?: (idea: Idea | null) => void;
    activeIdeaId?: string | null;
    className?: string;
    activeTheme?: any;
}

interface HierarchyNode extends d3.HierarchyNode<Idea> {
    x: number;
    y: number;
}

const MindMapGraph: React.FC<MindMapGraphProps> = ({
    ideas,
    topic,
    onIdeaClick,
    activeIdeaId,
    className = "",
    activeTheme = { mode: 'light', colors: {} } // Default theme
}) => {
    const svgRef = useRef<SVGSVGElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
    const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

    // Vibrant Palette for Mind Map Branches
    const MINDMAP_PALETTE = [
        '#84CC16', // Lime (Circuit)
        '#10B981', // Emerald (Electric Power)
        '#F59E0B', // Amber (Ohm's Law)
        '#3B82F6', // Blue (Magnetism)
        '#EC4899', // Pink (Household)
        '#6366F1', // Indigo
        '#8B5CF6', // Violet
        '#D946EF', // Fuchsia
    ];

    const colorScale = d3.scaleOrdinal(MINDMAP_PALETTE);

    // Resize Observer
    useEffect(() => {
        if (!containerRef.current) return;
        const resizeObserver = new ResizeObserver((entries) => {
            for (const entry of entries) {
                if (entry.contentRect.width > 0 && entry.contentRect.height > 0) {
                    setDimensions({
                        width: entry.contentRect.width,
                        height: entry.contentRect.height
                    });
                }
            }
        });
        resizeObserver.observe(containerRef.current);
        return () => resizeObserver.disconnect();
    }, []);

    // Main Render Effect
    useEffect(() => {
        if (!svgRef.current || dimensions.width === 0 || dimensions.height === 0 || ideas.length === 0) return;

        const { width, height } = dimensions;
        const svg = d3.select(svgRef.current);
        // NOTE: Removed destructive cleanup


        // 1. Build Hierarchy (Robust to multiple roots)
        // Always create a virtual root to ensure a valid single-tree structure
        const hierarchyRootId = 'VIRTUAL_ROOT';
        const rootLabel = topic || "Central Topic";

        // Clone ideas to avoid mutating props
        let processedIdeas = ideas.map(i => ({ ...i }));

        // Check if we already have a single root
        const potentialRoots = processedIdeas.filter(i => !i.parentId);

        let root: d3.HierarchyNode<Idea>;

        try {
            if (potentialRoots.length === 1 && processedIdeas.length > 1 && ideas.some(i => i.parentId === potentialRoots[0].id)) {
                // If it's already a perfect tree with 1 root and children, use it
                const stratify = d3.stratify<Idea>()
                    .id(d => d.id)
                    .parentId(d => d.parentId);
                root = stratify(processedIdeas);
            } else {
                // Group by Category to create Level 1 Branches
                const hierarchyRootId = 'VIRTUAL_ROOT';
                const virtualRoot: Idea = {
                    id: hierarchyRootId,
                    label: rootLabel,
                    category: 'general',
                    parentId: null,
                    description: 'Central Topic',
                    connections: [],
                    priority: 10
                };

                // 1. Identify Categories and Create Category Nodes
                const categoryNodes = new Map<string, Idea>();
                const nodesToStratify: Idea[] = [virtualRoot];

                // Create a Set for quick lookup of existing IDs
                const nodeIdSet = new Set(processedIdeas.map(i => i.id));

                // Helper to get consistent category key
                processedIdeas.forEach(i => {
                    // Determine if this is a "Top Level" idea for our visualization
                    // It is top level if:
                    // 1. It has no parentId (null/undefined/empty)
                    // 2. OR its parentId does not exist in our current list of ideas (Orphan)
                    //    (This happens often if parent is "root" or a conversation ID not in the idea list)
                    const isOrphan = i.parentId && !nodeIdSet.has(i.parentId);
                    const isTopLevel = !i.parentId || isOrphan;

                    if (isTopLevel) {
                        const rawCat = i.category || 'general';
                        const catKey = 'CAT_' + rawCat.toLowerCase();

                        if (!categoryNodes.has(catKey)) {
                            // Create the Category Node (Level 1)
                            const catLabel = rawCat.charAt(0).toUpperCase() + rawCat.slice(1);
                            const catNode: Idea = {
                                id: catKey,
                                label: catLabel, // Label is the Category Name
                                category: rawCat,
                                parentId: hierarchyRootId, // Connect to Virtual Root
                                description: `Group for ${catLabel}`,
                                connections: [],
                                priority: 5
                            };
                            categoryNodes.set(catKey, catNode);
                            nodesToStratify.push(catNode);
                        }

                        // Reparent this top-level/orphan idea to the Category Node
                        i.parentId = catKey;
                    }
                    nodesToStratify.push(i);
                });

                const stratify = d3.stratify<Idea>()
                    .id(d => d.id)
                    .parentId(d => d.parentId);

                root = stratify(nodesToStratify);
            }
        } catch (e) {
            console.error("Hierarchy build crashed:", e);
            // Emergency Fallback: Just show root
            const fallbackRoot: Idea = { id: 'ERR', label: 'Rendering Error', parentId: null } as any;
            root = d3.hierarchy(fallbackRoot);
        }

        // 2. Custom Radial Layout (Quadrants)
        // Root at (0,0)
        // Level 1 Nodes: 4 Quadrants (TL, TR, BL, BR)
        // Level 2 Nodes: Vertical List below L1

        const layoutRoot = root as any;
        layoutRoot.x = 0;
        layoutRoot.y = 0;

        const L1_OFFSET_X = 500; // Wide for columns
        const L1_OFFSET_Y = 220; // Vertical Start
        const L2_SPACING = 50;

        const quadrants = [
            { x: -L1_OFFSET_X, y: -L1_OFFSET_Y, label: "Top Left" },     // TL
            { x: L1_OFFSET_X, y: -L1_OFFSET_Y, label: "Top Right" },     // TR
            { x: -L1_OFFSET_X, y: L1_OFFSET_Y, label: "Bottom Left" },   // BL
            { x: L1_OFFSET_X, y: L1_OFFSET_Y, label: "Bottom Right" }    // BR
        ];

        const quadrantNodes: any[][] = [[], [], [], []];

        // 1. Assign nodes to quadrants
        if (layoutRoot.children) {
            layoutRoot.children.forEach((child: any, i: number) => {
                const qIndex = i % 4; // 0, 1, 2, 3
                quadrantNodes[qIndex].push(child);
            });
        }

        // 2. Process each quadrant
        const MAX_PER_COL = 5;
        const COL_WIDTH = 240;
        const L2_SPACING_COMPACT = 36;

        quadrantNodes.forEach((nodes, qIndex) => {
            const isTop = qIndex < 2;
            const isLeft = qIndex === 0 || qIndex === 2;
            const q = quadrants[qIndex];

            // Start at the base offset for this quadrant
            let currentYPointer = q.y;

            nodes.forEach((child: any) => {
                // --- HEIGHT-AWARE LAYOUT LOGIC ---
                const MAX_COL_HEIGHT = 450;
                let totalContentHeight = 0;

                if (child.children) {
                    child.children.forEach((gc: any) => {
                        const l3 = gc.children ? gc.children.length : 0;
                        totalContentHeight += (L2_SPACING_COMPACT + l3 * 28 + 12);
                    });
                }
                const listHeight = Math.min(totalContentHeight, MAX_COL_HEIGHT);
                const totalBlockHeight = 60 + listHeight;

                // Position the MAIN HUB
                if (isTop) {
                    // TOP: Stack Upwards (Moving further negative from q.y)
                    const requiredY = currentYPointer - totalBlockHeight;
                    child.x = q.x;
                    child.y = requiredY;
                    currentYPointer = requiredY - 80;
                } else {
                    // BOTTOM: Stack Downwards (positive from q.y)
                    child.x = q.x;
                    child.y = currentYPointer;
                    currentYPointer += totalBlockHeight + 80;
                }

                // Add label
                child.quadrantLabel = (child.data.label || 'Category').toUpperCase();

                // Layout children (Level 2) with Height-Aware Wrapping
                if (child.children) {
                    let currentColIndex = 0;
                    const colStartY = child.y + 60; // Start below hub header
                    const colYTrackers: number[] = [colStartY];

                    child.children.forEach((grandChild: any, j: number) => {
                        const l3Count = grandChild.children ? grandChild.children.length : 0;
                        const myContentHeight = 36 + (l3Count * 28) + 12;

                        const currentHeightInCol = colYTrackers[currentColIndex] - colStartY;

                        // Check if we need to wrap
                        if (currentHeightInCol > 0 && (currentHeightInCol + myContentHeight > MAX_COL_HEIGHT)) {
                            currentColIndex++;
                            colYTrackers[currentColIndex] = colStartY;
                        }

                        // Direction: Left Side grows Left (-x), Right Side grows Right (+x)
                        const xDir = isLeft ? -1 : 1;
                        const xOffset = (currentColIndex * COL_WIDTH * xDir) + (isLeft ? -20 : 20);

                        grandChild.x = child.x + xOffset;
                        grandChild.y = colYTrackers[currentColIndex];

                        // Level 3 Layout
                        if (grandChild.children) {
                            grandChild.children.forEach((greatGrandChild: any, k: number) => {
                                greatGrandChild.x = grandChild.x + (xDir * 16);
                                greatGrandChild.y = grandChild.y + 32 + (k * 28);
                            });
                        }

                        colYTrackers[currentColIndex] += myContentHeight;
                    });
                }
            });
        });

        // 3. Zoom/Pan Setup
        // 3. Zoom/Pan Setup - use join
        const g = svg.selectAll<SVGGElement, unknown>(".mindmap-content")
            .data([0])
            .join("g")
            .attr("class", "mindmap-content");


        const zoom = d3.zoom<SVGSVGElement, unknown>()
            .scaleExtent([0.1, 4])
            .on("zoom", (event) => {
                g.attr("transform", event.transform);
            });
        // Setup zoom behavior
        // Only reset transform on FIRST render or if dimensions changed significantly (optional, but safer to stick to first)
        if (!zoomRef.current) {
            svg.call(zoom);
            const initialScale = Math.min(width / 1000, height / 800, 0.8);
            svg.call(zoom.transform, d3.zoomIdentity.translate(width / 2, height / 2).scale(initialScale));
            zoomRef.current = zoom;
        } else {
            svg.call(zoom);
        }



        // 4. Render Links (Custom)
        const links = root.links();
        g.selectAll(".link")
            .data(links)
            .join("path")
            .attr("class", "link")
            .attr("d", (d: any) => {
                const sx = d.source.x;
                const sy = d.source.y;
                const tx = d.target.x;
                const ty = d.target.y;

                // Universal S-Curve (Vertical Bias): Control points at mid-Y.
                // This creates graceful curves that exit vertically/diagonally, suitable for 4-Quadrant.
                return `M${sx},${sy} C${sx},${(sy + ty) / 2} ${tx},${(sy + ty) / 2} ${tx},${ty}`;
            })
            .attr("fill", "none")
            .attr("stroke", d => {
                let ancestor = d.target;
                while (ancestor.depth > 1) ancestor = ancestor.parent!;
                return colorScale(ancestor.data.id || 'root');
            })
            .attr("stroke-width", 2);


        // 5. Render Nodes
        // We render decorated L1 nodes different from Center and L2
        const nodes = root.descendants();

        // Group nodes by depth for potentially different drawing orders or logic
        const nodeGroup = g.selectAll(".node")
            .data(nodes)
            .join("g")
            .attr("class", "node cursor-pointer")
            .attr("transform", (d: any) => `translate(${d.x},${d.y})`)
            .on("click", (event, d) => {
                event.stopPropagation();
                onIdeaClick?.(d.data);
            });

        // Drawing Logic
        nodeGroup.each(function (d: any) {
            const el = d3.select(this);
            const isRoot = d.depth === 0;
            const isL1 = d.depth === 1;
            const isL2 = d.depth > 1;
            const label = d.data.label;

            // --- Colors ---
            let branchColor = "#ccc";
            if (!isRoot) {
                let ancestor = d;
                while (ancestor.depth > 1) ancestor = ancestor.parent!;
                branchColor = colorScale(ancestor.data.id);
            }
            if (isRoot) branchColor = "#10B981"; // Green center

            // --- DECORATION (Start with text label for L1) ---
            if (isL1) {
                // "Professor Name" Label above 
                el.append("text")
                    .attr("y", -40)
                    .attr("text-anchor", "middle")
                    .attr("fill", "#64748b")
                    .attr("font-size", "12px")
                    .text(d.quadrantLabel || "Category");

                // Horizontal line underline
                el.append("line")
                    .attr("x1", -40)
                    .attr("y1", -35)
                    .attr("x2", 40)
                    .attr("y2", -35)
                    .attr("stroke", "#cbd5e1")
                    .attr("stroke-width", 1);
            }

            // --- MAIN PILL ---
            const textWidth = Math.min(200, Math.max(80, label.length * 8));
            const pHeight = isRoot ? 60 : isL1 ? 40 : 22; // L2 is tiny pill/list item
            const pWidth = isL2 ? textWidth + 20 : textWidth + 40;

            if (isL2) {
                // --- LEVEL 2 & 3 (List Items) ---
                const isLeft = d.x < 0;

                // NEW LOGIC: Anchor Bullet at (0,0) so lines connect to it
                // Text/Pill pushed "Outwards"

                // Bullet (Circle) at Center
                const idx = d.parent && d.parent.children ? d.parent.children.indexOf(d) + 1 : 1;

                el.append("circle")
                    .attr("cx", 0)
                    .attr("cy", 0)
                    .attr("r", 8)
                    .attr("fill", "white")
                    .attr("stroke", branchColor)
                    .attr("stroke-width", 1.5);

                el.append("text")
                    .attr("x", 0)
                    .attr("y", 3)
                    .attr("text-anchor", "middle")
                    .attr("font-size", "9px")
                    .attr("fill", branchColor)
                    .text(idx);

                // Calculate Offsets for Text/Pill
                // Gap between Bullet Center and Pill Edge = 16px
                const gap = 16;
                const rectX = isLeft ? (-gap - pWidth) : gap;
                const textX = isLeft ? (-gap - pWidth / 2) : (gap + pWidth / 2);

                // Node Background (White with border)
                el.append("rect")
                    .attr("x", rectX)
                    .attr("y", -pHeight / 2)
                    .attr("width", pWidth)
                    .attr("height", pHeight)
                    .attr("rx", pHeight / 2)
                    .attr("ry", pHeight / 2)
                    .attr("fill", "white")
                    .attr("stroke", branchColor)
                    .attr("stroke-width", 1.5);

                // Text (Colored)
                el.append("text")
                    .attr("x", textX)
                    .attr("dy", "0.35em")
                    .attr("text-anchor", "middle")
                    .attr("fill", "#334155")
                    .attr("font-size", "11px")
                    .attr("font-weight", "500")
                    .text(label.length > 25 ? label.substring(0, 22) + "..." : label);

            } else {
                // --- ROOT & LEVEL 1 (Solid Pills) ---
                el.append("rect")
                    .attr("x", -pWidth / 2)
                    .attr("y", -pHeight / 2)
                    .attr("width", pWidth)
                    .attr("height", pHeight)
                    .attr("rx", pHeight / 2)
                    .attr("ry", pHeight / 2)
                    .attr("fill", branchColor)
                    .attr("stroke", d3.rgb(branchColor).darker(0.2).toString())
                    .attr("stroke-width", isRoot ? 4 : 0)
                    .style("filter", "drop-shadow(0px 4px 6px rgba(0,0,0,0.1))");

                el.append("text")
                    .attr("dy", "0.35em")
                    .attr("text-anchor", "middle")
                    .attr("fill", "white")
                    .attr("font-size", isRoot ? "16px" : "13px")
                    .attr("font-weight", "bold")
                    .text(label.length > 25 ? label.substring(0, 22) + "..." : label);
            }
        });

    }, [ideas, dimensions, topic, activeTheme]);


    return (
        <div ref={containerRef} className={`w-full h-full relative overflow-hidden bg-slate-50/50 ${className}`}>
            <svg
                ref={svgRef}
                width="100%"
                height="100%"
                className="w-full h-full cursor-grab active:cursor-grabbing"
            />

            {/* Zoom Controls */}
            <div className="absolute bottom-4 right-4 flex flex-col gap-2">
                <button
                    onClick={() => zoomRef.current && (d3.select(svgRef.current) as any).transition().call(zoomRef.current.scaleBy, 1.2)}
                    className="p-2 bg-white rounded-lg shadow-md hover:bg-slate-50 border border-slate-200"
                >
                    <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                </button>
                <button
                    onClick={() => zoomRef.current && (d3.select(svgRef.current) as any).transition().call(zoomRef.current.scaleBy, 0.8)}
                    className="p-2 bg-white rounded-lg shadow-md hover:bg-slate-50 border border-slate-200"
                >
                    <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                    </svg>
                </button>
            </div>
        </div>
    );
};

export default React.memo(MindMapGraph);
