/**
 * Asset3DViewer Component
 * Interactive 3D model viewer using Three.js for GLB/GLTF files
 */

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { X, RotateCw, ZoomIn, ZoomOut, Maximize2, Download } from 'lucide-react';
import type { GameAsset } from '../../../../shared/types';

interface Asset3DViewerProps {
    asset: GameAsset;
    onClose: () => void;
    onDownload?: (asset: GameAsset) => void;
}

export const Asset3DViewer: React.FC<Asset3DViewerProps> = ({
    asset,
    onClose,
    onDownload
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [polyCount, setPolyCount] = useState<number>(0);
    const [isFullscreen, setIsFullscreen] = useState(false);

    // Three.js refs
    const sceneRef = useRef<THREE.Scene | null>(null);
    const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
    const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
    const controlsRef = useRef<OrbitControls | null>(null);
    const modelRef = useRef<THREE.Group | null>(null);
    const animationFrameRef = useRef<number | null>(null);

    useEffect(() => {
        if (!containerRef.current) return;

        // Setup scene
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x1a1a1a);
        sceneRef.current = scene;

        // Setup camera
        const camera = new THREE.PerspectiveCamera(
            75,
            containerRef.current.clientWidth / containerRef.current.clientHeight,
            0.1,
            1000
        );
        camera.position.set(2, 2, 2);
        cameraRef.current = camera;

        // Setup renderer
        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
        renderer.setPixelRatio(window.devicePixelRatio);
        containerRef.current.appendChild(renderer.domElement);
        rendererRef.current = renderer;

        // Setup controls
        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;
        controls.minDistance = 1;
        controls.maxDistance = 20;
        controlsRef.current = controls;

        // Add lights
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(5, 5, 5);
        scene.add(directionalLight);

        const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.4);
        directionalLight2.position.set(-5, 3, -5);
        scene.add(directionalLight2);

        // Add grid
        const gridHelper = new THREE.GridHelper(10, 10, 0x444444, 0x222222);
        scene.add(gridHelper);

        // Load model
        const loader = new GLTFLoader();

        loader.load(
            asset.fileUrl,
            (gltf) => {
                const model = gltf.scene;
                modelRef.current = model;

                // Calculate bounding box and center model
                const box = new THREE.Box3().setFromObject(model);
                const center = box.getCenter(new THREE.Vector3());
                const size = box.getSize(new THREE.Vector3());

                model.position.sub(center);

                // Scale model to fit in view
                const maxDim = Math.max(size.x, size.y, size.z);
                const scale = 2 / maxDim;
                model.scale.multiplyScalar(scale);

                scene.add(model);

                // Calculate poly count
                let triangles = 0;
                model.traverse((child) => {
                    if (child instanceof THREE.Mesh) {
                        const geometry = child.geometry;
                        if (geometry.index) {
                            triangles += geometry.index.count / 3;
                        } else {
                            triangles += geometry.attributes.position.count / 3;
                        }
                    }
                });
                setPolyCount(Math.round(triangles));

                setLoading(false);
            },
            (progress) => {
                console.log(`Loading: ${(progress.loaded / progress.total * 100).toFixed(0)}%`);
            },
            (error) => {
                console.error('Error loading model:', error);
                setError('Failed to load 3D model');
                setLoading(false);
            }
        );

        // Animation loop
        const animate = () => {
            animationFrameRef.current = requestAnimationFrame(animate);

            if (controlsRef.current) {
                controlsRef.current.update();
            }

            if (rendererRef.current && sceneRef.current && cameraRef.current) {
                rendererRef.current.render(sceneRef.current, cameraRef.current);
            }
        };
        animate();

        // Handle resize
        const handleResize = () => {
            if (!containerRef.current || !cameraRef.current || !rendererRef.current) return;

            const width = containerRef.current.clientWidth;
            const height = containerRef.current.clientHeight;

            cameraRef.current.aspect = width / height;
            cameraRef.current.updateProjectionMatrix();
            rendererRef.current.setSize(width, height);
        };
        window.addEventListener('resize', handleResize);

        // Cleanup
        return () => {
            window.removeEventListener('resize', handleResize);

            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }

            if (rendererRef.current && containerRef.current) {
                containerRef.current.removeChild(rendererRef.current.domElement);
                rendererRef.current.dispose();
            }

            if (sceneRef.current) {
                sceneRef.current.traverse((object) => {
                    if (object instanceof THREE.Mesh) {
                        object.geometry.dispose();
                        if (Array.isArray(object.material)) {
                            object.material.forEach(mat => mat.dispose());
                        } else {
                            object.material.dispose();
                        }
                    }
                });
            }
        };
    }, [asset.fileUrl]);

    const handleReset = () => {
        if (!cameraRef.current || !controlsRef.current) return;

        cameraRef.current.position.set(2, 2, 2);
        controlsRef.current.target.set(0, 0, 0);
        controlsRef.current.update();
    };

    const handleZoomIn = () => {
        if (!cameraRef.current) return;
        cameraRef.current.position.multiplyScalar(0.8);
    };

    const handleZoomOut = () => {
        if (!cameraRef.current) return;
        cameraRef.current.position.multiplyScalar(1.25);
    };

    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            containerRef.current?.parentElement?.requestFullscreen();
            setIsFullscreen(true);
        } else {
            document.exitFullscreen();
            setIsFullscreen(false);
        }
    };

    const formatFileSize = (bytes: number): string => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    return (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center">
            <div className="relative w-full h-full max-w-7xl max-h-screen p-4">
                {/* Header */}
                <div className="absolute top-4 left-4 right-4 z-10 flex items-start justify-between gap-4">
                    <div className="bg-black/70 backdrop-blur-sm rounded-lg p-4 flex-1">
                        <h3 className="text-white font-semibold mb-1">{asset.prompt}</h3>
                        <div className="flex items-center gap-4 text-sm text-gray-300">
                            <span className="capitalize">{asset.category}</span>
                            <span>•</span>
                            <span>{polyCount.toLocaleString()} triangles</span>
                            <span>•</span>
                            <span>{formatFileSize(asset.metadata.fileSize)}</span>
                            <span>•</span>
                            <span className="capitalize">{asset.format}</span>
                            {asset.provider && (
                                <>
                                    <span>•</span>
                                    <span className="capitalize">{asset.provider}</span>
                                </>
                            )}
                        </div>
                    </div>

                    <button
                        onClick={onClose}
                        className="bg-black/70 backdrop-blur-sm hover:bg-black/90 p-3 rounded-lg transition-colors"
                    >
                        <X className="w-6 h-6 text-white" />
                    </button>
                </div>

                {/* Controls */}
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 bg-black/70 backdrop-blur-sm rounded-lg p-3 flex items-center gap-2">
                    <button
                        onClick={handleReset}
                        className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                        title="Reset View"
                    >
                        <RotateCw className="w-5 h-5 text-white" />
                    </button>

                    <div className="w-px h-6 bg-white/20"></div>

                    <button
                        onClick={handleZoomIn}
                        className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                        title="Zoom In"
                    >
                        <ZoomIn className="w-5 h-5 text-white" />
                    </button>

                    <button
                        onClick={handleZoomOut}
                        className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                        title="Zoom Out"
                    >
                        <ZoomOut className="w-5 h-5 text-white" />
                    </button>

                    <div className="w-px h-6 bg-white/20"></div>

                    <button
                        onClick={toggleFullscreen}
                        className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                        title="Fullscreen"
                    >
                        <Maximize2 className="w-5 h-5 text-white" />
                    </button>

                    {onDownload && (
                        <>
                            <div className="w-px h-6 bg-white/20"></div>
                            <button
                                onClick={() => onDownload(asset)}
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors flex items-center gap-2"
                            >
                                <Download className="w-5 h-5 text-white" />
                                <span className="text-white font-medium">Download</span>
                            </button>
                        </>
                    )}
                </div>

                {/* 3D Viewer Container */}
                <div ref={containerRef} className="w-full h-full rounded-lg overflow-hidden">
                    {loading && (
                        <div className="absolute inset-0 flex items-center justify-center">
                            <div className="text-center">
                                <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-white mx-auto mb-4"></div>
                                <p className="text-white text-lg">Loading 3D Model...</p>
                            </div>
                        </div>
                    )}

                    {error && (
                        <div className="absolute inset-0 flex items-center justify-center">
                            <div className="bg-red-900/50 backdrop-blur-sm rounded-lg p-6 text-center">
                                <p className="text-red-100 text-lg font-semibold mb-2">Failed to Load Model</p>
                                <p className="text-red-200 text-sm">{error}</p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Instructions */}
                {!loading && !error && (
                    <div className="absolute bottom-20 left-4 bg-black/50 backdrop-blur-sm rounded-lg p-3 text-white text-sm">
                        <p className="font-semibold mb-1">Controls:</p>
                        <ul className="space-y-1 text-gray-300">
                            <li>• Left click + drag: Rotate</li>
                            <li>• Right click + drag: Pan</li>
                            <li>• Scroll: Zoom</li>
                        </ul>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Asset3DViewer;
