// @ts-nocheck
/// <reference path="../types/three-jsx.d.ts" />
import React, { useRef, useMemo, useState, useEffect, Suspense } from 'react';
import { Canvas, useFrame, ThreeEvent } from '@react-three/fiber';
import { OrbitControls, Text, Billboard, Line } from '@react-three/drei';
import * as THREE from 'three';
import { motion } from 'framer-motion';
import { Idea, IdeaCategory } from '@orbitai/shared';

// Re-export Idea for backwards compatibility with existing imports
export type { Idea, IdeaCategory } from '@orbitai/shared';

// --- Constants ---
const CATEGORY_COLORS: Record<string, string> = {
    feature: '#9333ea',   // Darker Purple
    technical: '#2563eb', // Darker Blue
    design: '#db2777',    // Darker Pink
    market: '#16a34a',    // Darker Green
    business: '#ca8a04',  // Darker Yellow/Gold
    data: '#ea580c',      // Darker Orange
    ux: '#be185d',        // Darker Pink-Red
    community: '#0d9488', // Darker Teal
    platform: '#4f46e5',  // Darker Indigo
    general: '#475569',   // Darker Slate
    technology: '#2563eb', // Darker Blue
    risk: '#dc2626',       // Red
    opportunity: '#059669', // Emerald
    constraint: '#d97706', // Amber
    requirement: '#7c3aed', // Violet
    improvement: '#c026d3', // Fuchsia
    idea: '#0d9488',       // Teal
    other: '#64748b',      // Slate
};

// --- Helper Components ---

const ConnectionLine = React.memo(({ start, end, color = '#94a3b8', opacity = 0.4 }: { start: THREE.Vector3, end: THREE.Vector3, color?: string, opacity?: number }) => {
    const points = useMemo(() => [
        [start.x, start.y, start.z] as [number, number, number],
        [end.x, end.y, end.z] as [number, number, number]
    ], [start, end]);

    return (
        <Line
            points={points}
            color={color}
            lineWidth={1.5} // Slightly thicker for day mode
            transparent
            opacity={opacity}
        />
    );
});

const NodeMesh = React.memo(({ position, color, size, isHovered, isParent }: { position: THREE.Vector3, color: string, size: number, isHovered: boolean, isParent: boolean }) => {
    const meshRef = useRef<THREE.Mesh>(null);

    // Subtle floating animation
    useFrame((state) => {
        if (meshRef.current) {
            meshRef.current.position.y = position.y + Math.sin(state.clock.elapsedTime + position.x) * 0.2;
            meshRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.5) * 0.1;
            meshRef.current.rotation.y += 0.01;
        }
    });

    return (
        <group position={position}>
            {/* Core Sphere */}
            <mesh ref={meshRef}>
                {isParent ? <icosahedronGeometry args={[size, 1]} /> : <dodecahedronGeometry args={[size, 0]} />}
                <meshStandardMaterial
                    color={color}
                    emissive={color}
                    emissiveIntensity={isHovered ? 0.6 : 0.1} // Lower emissive for day mode
                    roughness={0.3}
                    metalness={0.6}
                />
            </mesh>

            {/* Outer Glow Ring for Parents - darker opacity for visibility */}
            {isParent && (
                <mesh rotation={[Math.PI / 2, 0, 0]}>
                    <torusGeometry args={[size * 1.5, 0.05, 16, 32]} />
                    <meshBasicMaterial color={color} transparent opacity={0.5} />
                </mesh>
            )}
        </group>
    );
});

const InteractiveNode = ({ idea, position, color, size, isParent, onHover, onLeave }: { idea: Idea, position: THREE.Vector3, color: string, size: number, isParent: boolean, onHover: (i: Idea) => void, onLeave: () => void }) => {
    const [hovered, setHover] = useState(false);

    const handlePointerOver = (e: ThreeEvent<PointerEvent>) => {
        e.stopPropagation();
        setHover(true);
        onHover(idea);
        document.body.style.cursor = 'pointer';
    };

    const handlePointerOut = () => {
        setHover(false);
        onLeave();
        document.body.style.cursor = 'auto';
    };

    return (
        <group
            onPointerOver={handlePointerOver}
            onPointerOut={handlePointerOut}
        >
            <NodeMesh
                position={position}
                color={color}
                size={hovered ? size * 1.2 : size}
                isHovered={hovered}
                isParent={isParent}
            />

            {/* Label - visible on hover or if it's a parent hub */}
            {(hovered || isParent) && (
                <Billboard position={[position.x, position.y + size + 0.5, position.z]}>
                    <Text
                        fontSize={isParent ? 0.8 : 0.5}
                        color="#0f172a" // Dark text for day mode
                        anchorX="center"
                        anchorY="bottom"
                        outlineWidth={0.02}
                        outlineColor="#ffffff"
                        fontWeight="bold"
                    >
                        {(idea.label || idea.title).length > 25 && !hovered
                            ? (idea.label || idea.title).substring(0, 25) + '...'
                            : (idea.label || idea.title)}
                    </Text>
                </Billboard>
            )}
        </group>
    );
};

// --- Scene Logic ---

function GraphScene({ ideas, onHoverIdea, onLeaveIdea }: { ideas: Idea[], onHoverIdea: (i: Idea) => void, onLeaveIdea: () => void }) {
    // calculate layout ONCE when ideas change
    const layout = useMemo(() => {
        // Debugging logs
        console.log('[OrbGraph3D] Recalculating layout, ideas count:', ideas?.length);

        if (!ideas || ideas.length === 0) {
            console.warn('[OrbGraph3D] No ideas provided to GraphScene');
            return { nodes: [], connections: [] };
        }

        // 1. Build Hierarchy Tree with Implicit Categories
        const nodesById: Record<string, { idea: Idea, children: string[], level: number, position: THREE.Vector3 }> = {};
        const roots: string[] = [];
        const categoryNodes: Record<string, string> = {}; // category name -> node id

        // 1a. Pre-pass: Identify implicitly needed categories
        ideas.forEach(idea => {
            if (!idea.category) return;
            if (!categoryNodes[idea.category]) {
                const catId = `CAT-${idea.category}`;
                categoryNodes[idea.category] = catId;

                // Create virtual idea for the category hub
                nodesById[catId] = {
                    idea: {
                        id: catId,
                        title: idea.category.charAt(0).toUpperCase() + idea.category.slice(1),
                        label: idea.category.toUpperCase(),
                        description: `Category Hub for ${idea.category} ideas`,
                        category: idea.category,
                        parentId: null
                    },
                    children: [],
                    level: 0,
                    position: new THREE.Vector3(0, 0, 0)
                };
                roots.push(catId);
            }
        });

        // 1b. Initialize all real idea nodes
        ideas.forEach(idea => {
            nodesById[idea.id] = {
                idea,
                children: [],
                level: 0,
                position: new THREE.Vector3(0, 0, 0)
            };
        });

        // 1c. Build relationships
        ideas.forEach(idea => {
            const node = nodesById[idea.id];

            if (idea.parentId && nodesById[idea.parentId]) {
                nodesById[idea.parentId].children.push(idea.id);
            }
            else if (idea.category && categoryNodes[idea.category]) {
                const catId = categoryNodes[idea.category];
                nodesById[catId].children.push(idea.id);
            }
            else {
                roots.push(idea.id);
            }
        });

        // 2. Recursive Positioning
        const processedNodes: any[] = [];
        const connections: any[] = [];

        const distributeChildren = (parentId: string, parentPos: THREE.Vector3, level: number, visited: Set<string> = new Set()) => {
            const childrenIds = nodesById[parentId].children;
            if (childrenIds.length === 0) return;

            if (visited.has(parentId)) return;
            visited.add(parentId);

            const radius = level === 0 ? 15 : (level === 1 ? 10 : 6);
            const phi = Math.PI * (3 - Math.sqrt(5));

            childrenIds.forEach((childId, i) => {
                if (nodesById[childId].level > 0 && nodesById[childId].level <= level) return;

                const childNode = nodesById[childId];
                childNode.level = level + 1;

                const y = 1 - (i / (childrenIds.length - 1 || 1)) * 2;
                const r = Math.sqrt(1 - y * y);
                const theta = phi * i;

                const x = Math.cos(theta) * r;
                const z = Math.sin(theta) * r;

                const localPos = new THREE.Vector3(x, y, z).multiplyScalar(radius);
                localPos.add(new THREE.Vector3(
                    (Math.random() - 0.5) * 2,
                    (Math.random() - 0.5) * 2,
                    (Math.random() - 0.5) * 2
                ));

                childNode.position = new THREE.Vector3().copy(parentPos).add(localPos);

                connections.push({
                    start: parentPos,
                    end: childNode.position,
                    color: CATEGORY_COLORS[childNode.idea.category] || '#94a3b8',
                    level: level
                });

                distributeChildren(childId, childNode.position, level + 1, new Set(visited));
            });
        };

        if (roots.length === 0) {
            // Edge case
        } else if (roots.length === 1) {
            const rootId = roots[0];
            nodesById[rootId].position.set(0, 0, 0);
            distributeChildren(rootId, new THREE.Vector3(0, 0, 0), 0);
        } else {
            const ROOT_RADIUS = 25;
            roots.forEach((rootId, i) => {
                const angle = (i / roots.length) * Math.PI * 2;
                const x = Math.cos(angle) * ROOT_RADIUS;
                const z = Math.sin(angle) * ROOT_RADIUS;
                const pos = new THREE.Vector3(x, 0, z);

                nodesById[rootId].position.copy(pos);

                connections.push({
                    start: new THREE.Vector3(0, 0, 0),
                    end: pos,
                    color: '#94a3b8',
                    opacity: 0.1
                });

                distributeChildren(rootId, pos, 0, new Set());
            });
        }

        Object.values(nodesById).forEach(node => {
            processedNodes.push({
                ...node,
                isParent: node.children.length > 0
            });
        });

        console.log('[OrbGraph3D] Layout complete. Nodes:', processedNodes.length, 'Connections:', connections.length);
        return { nodes: processedNodes, connections };

    }, [ideas]);

    return (
        <group>
            {/* Global Lights - Brighter for Day Mode */}
            <ambientLight intensity={0.8} />
            <pointLight position={[100, 100, 100]} intensity={1.2} />
            <pointLight position={[-100, -100, -100]} intensity={0.6} color="#3b82f6" />
            <directionalLight position={[50, 100, 50]} intensity={1} castShadow />

            {/* Render Connections */}
            {layout.connections.map((conn, i) => (
                <ConnectionLine
                    key={`conn-${i}`}
                    start={conn.start}
                    end={conn.end}
                    color={conn.color}
                    opacity={0.3}
                    width={conn.level === 0 ? 2 : 1}
                />
            ))}

            {/* Render Nodes */}
            {layout.nodes.map((node) => (
                <InteractiveNode
                    key={node.idea.id}
                    idea={node.idea}
                    position={node.position}
                    color={CATEGORY_COLORS[node.idea.category] || CATEGORY_COLORS.general}
                    size={node.level === 0 ? 1.5 : (node.level === 1 ? 1 : 0.6)}
                    isParent={node.isParent}
                    onHover={onHoverIdea}
                    onLeave={onLeaveIdea}
                />
            ))}

            <OrbitControls
                enablePan={true}
                enableZoom={true}
                autoRotate={true}
                autoRotateSpeed={0.5}
                dampingFactor={0.1}
                maxDistance={150}
                minDistance={10}
            />
            {/* Removed Stars for Day Theme */}
        </group>
    );
}

// --- Main Component ---

function OrbGraph3D({ ideas, className }: { ideas: Idea[], className?: string }) {
    const safeIdeas = Array.isArray(ideas) ? ideas : [];
    const [hoveredIdea, setHoveredIdea] = useState<Idea | null>(null);

    // Initial check for empty data
    useEffect(() => {
        if (safeIdeas.length === 0) {
            console.warn('[OrbGraph3D] Component mounted with 0 ideas.');
        } else {
            console.log('[OrbGraph3D] Component mounted with', safeIdeas.length, 'ideas.');
        }
    }, [safeIdeas.length]);

    return (
        <div className={`w-full h-full relative bg-slate-50 ${className || ''}`}>

            {/* Overlay UI - Day Theme */}
            <div className="absolute top-4 left-4 z-10 pointer-events-none">
                <div className="bg-white/80 backdrop-blur-md p-3 rounded-xl border border-slate-200 shadow-sm">
                    <h3 className="text-slate-800 font-semibold text-sm">Neural Architecture</h3>
                    <p className="text-slate-500 text-xs mt-1">{safeIdeas.length} Nodes Active</p>
                </div>
            </div>

            <Canvas camera={{ position: [0, 20, 40], fov: 60 }} dpr={[1, 2]}>
                <color attach="background" args={['#f8fafc']} /> {/* slate-50 */}
                <fog attach="fog" args={['#f8fafc', 50, 100]} />

                <Suspense fallback={null}>
                    <GraphScene
                        ideas={safeIdeas}
                        onHoverIdea={setHoveredIdea}
                        onLeaveIdea={() => setHoveredIdea(null)}
                    />
                </Suspense>
            </Canvas>

            {/* Tooltip - Day Theme */}
            {hoveredIdea && (
                <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    className="absolute bottom-6 left-6 max-w-sm bg-white/90 backdrop-blur-xl rounded-2xl p-4 border border-slate-200 shadow-xl z-20 pointer-events-none"
                    key={hoveredIdea.id}
                >
                    <div className="flex items-center gap-2 mb-2">
                        <div
                            className="w-2.5 h-2.5 rounded-full"
                            style={{ backgroundColor: CATEGORY_COLORS[hoveredIdea.category] || CATEGORY_COLORS.general }}
                        />
                        <span className="text-[10px] font-bold tracking-wider text-slate-500 uppercase">
                            {hoveredIdea.category}
                        </span>
                    </div>
                    <h4 className="font-bold text-base text-slate-900 leading-tight mb-1">{hoveredIdea.label || hoveredIdea.title}</h4>
                    <p className="text-xs text-slate-600 leading-relaxed line-clamp-3">{hoveredIdea.description}</p>
                </motion.div>
            )}
        </div>
    );
}

export default React.memo(OrbGraph3D);
