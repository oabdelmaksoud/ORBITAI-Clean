import React, { useState, useEffect } from 'react';
import { Alert, AlertDescription } from '../ui/alert';
import * as gameMechanicsService from '../../services/gameMechanicsService';

interface Template {
    id: string;
    name: string;
    engine: string;
    category: string;
    language: string;
    variables: Array<{
        name: string;
        type: string;
        default: any;
        description: string;
    }>;
    dependencies: string[];
    instructions: string;
    tags: string[];
}

interface GeneratedMechanic {
    mechanicsId: string;
    files: Array<{
        filename: string;
        content: string;
        language: string;
    }>;
    mechanics: {
        movement?: boolean;
        combat?: boolean;
        ai?: boolean;
        progression?: boolean;
    };
    setupInstructions: string;
}

const GameMechanicsGenerator: React.FC = () => {
    // State
    const [templates, setTemplates] = useState<Template[]>([]);
    const [selectedEngine, setSelectedEngine] = useState<string>('unity');
    const [selectedCategory, setSelectedCategory] = useState<string>('all');
    const [selectedTemplates, setSelectedTemplates] = useState<string[]>([]);
    const [gameDescription, setGameDescription] = useState('');
    const [customizations, setCustomizations] = useState<Record<string, any>>({});
    const [generatedCode, setGeneratedCode] = useState<GeneratedMechanic | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Load templates on mount
    useEffect(() => {
        loadTemplates();
    }, []);

    const loadTemplates = async () => {
        try {
            const data = await gameMechanicsService.listTemplates();
            setTemplates(data);
        } catch (err) {
            setError('Failed to load templates');
            console.error(err);
        }
    };

    // Filter templates
    const filteredTemplates = templates.filter(t => {
        if (selectedEngine !== 'all' && t.engine !== selectedEngine) return false;
        if (selectedCategory !== 'all' && t.category !== selectedCategory) return false;
        return true;
    });

    // Group templates by category
    const categorizedTemplates = filteredTemplates.reduce((acc, template) => {
        if (!acc[template.category]) acc[template.category] = [];
        acc[template.category].push(template);
        return acc;
    }, {} as Record<string, Template[]>);

    const handleGenerate = async () => {
        setLoading(true);
        setError(null);

        try {
            const result = await gameMechanicsService.generateMechanics({
                gameDescription,
                targetEngine: selectedEngine,
                customizations
            });

            setGeneratedCode(result);
        } catch (err: any) {
            setError(err.message || 'Failed to generate mechanics');
        } finally {
            setLoading(false);
        }
    };

    const handleDownload = (filename: string, content: string) => {
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleDownloadAll = () => {
        if (!generatedCode) return;

        generatedCode.files.forEach(file => {
            handleDownload(file.filename, file.content);
        });
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
    };

    return (
        <div className="game-mechanics-generator max-w-7xl mx-auto p-6">
            <div className="mb-8">
                <h1 className="text-3xl font-bold mb-2">🎮 Game Mechanics Generator</h1>
                <p className="text-gray-600">
                    Generate production-ready game code for Unity, Godot, and Phaser
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Panel - Configuration */}
                <div className="lg:col-span-1 space-y-6">
                    {/* Engine Selector */}
                    <div className="bg-white rounded-lg shadow p-4">
                        <label className="block text-sm font-medium mb-2">Game Engine</label>
                        <select
                            value={selectedEngine}
                            onChange={(e) => setSelectedEngine(e.target.value)}
                            className="w-full px-3 py-2 border rounded-md"
                        >
                            <option value="all">All Engines</option>
                            <option value="unity">Unity (C#)</option>
                            <option value="godot">Godot (GDScript)</option>
                            <option value="phaser">Phaser 3 (JavaScript)</option>
                        </select>
                    </div>

                    {/* Category Filter */}
                    <div className="bg-white rounded-lg shadow p-4">
                        <label className="block text-sm font-medium mb-2">Category</label>
                        <select
                            value={selectedCategory}
                            onChange={(e) => setSelectedCategory(e.target.value)}
                            className="w-full px-3 py-2 border rounded-md"
                        >
                            <option value="all">All Categories</option>
                            <option value="movement">Movement</option>
                            <option value="combat">Combat</option>
                            <option value="ai">Enemy AI</option>
                            <option value="progression">Progression</option>
                        </select>
                    </div>

                    {/* Game Description */}
                    <div className="bg-white rounded-lg shadow p-4">
                        <label className="block text-sm font-medium mb-2">
                            Describe Your Game
                        </label>
                        <textarea
                            value={gameDescription}
                            onChange={(e) => setGameDescription(e.target.value)}
                            placeholder="e.g., 2D platformer with RPG elements, medieval theme"
                            className="w-full px-3 py-2 border rounded-md h-24 resize-none"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                            AI will select appropriate templates based on your description
                        </p>
                    </div>

                    {/* Generate Button */}
                    <button
                        onClick={handleGenerate}
                        disabled={loading || !gameDescription}
                        className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white py-3 px-4 rounded-md font-medium transition"
                    >
                        {loading ? 'Generating...' : '✨ Generate Code'}
                    </button>

                    {error && (
                        <Alert variant="destructive">
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    )}
                </div>

                {/* Middle Panel - Template Browser */}
                <div className="lg:col-span-1 bg-white rounded-lg shadow p-4 max-h-[800px] overflow-y-auto">
                    <h2 className="text-lg font-semibold mb-4">
                        Available Templates ({filteredTemplates.length})
                    </h2>

                    {Object.entries(categorizedTemplates).map(([category, templates]) => (
                        <div key={category} className="mb-6">
                            <h3 className="text-sm font-medium text-gray-500 uppercase mb-2">
                                {category}
                            </h3>
                            <div className="space-y-2">
                                {templates.map(template => (
                                    <div
                                        key={template.id}
                                        className="border rounded-md p-3 hover:border-blue-500 cursor-pointer transition"
                                    >
                                        <div className="flex items-start justify-between">
                                            <div className="flex-1">
                                                <h4 className="font-medium text-sm">{template.name}</h4>
                                                <p className="text-xs text-gray-500 mt-1">
                                                    {template.engine} · {template.language}
                                                </p>
                                                <div className="flex flex-wrap gap-1 mt-2">
                                                    {template.tags.slice(0, 3).map(tag => (
                                                        <span
                                                            key={tag}
                                                            className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-xs"
                                                        >
                                                            {tag}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Right Panel - Generated Code */}
                <div className="lg:col-span-1 bg-white rounded-lg shadow p-4overflow-y-auto">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-semibold">Generated Code</h2>
                        {generatedCode && (
                            <button
                                onClick={handleDownloadAll}
                                className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700"
                            >
                                ⬇️ Download All
                            </button>
                        )}
                    </div>

                    {!generatedCode ? (
                        <div className="text-center py-12 text-gray-400">
                            <svg
                                className="mx-auto h-12 w-12 mb-4"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
                                />
                            </svg>
                            <p>No code generated yet</p>
                            <p className="text-sm mt-1">
                                Describe your game and click Generate
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-4 max-h-[700px] overflow-y-auto">
                            {/* Files */}
                            {generatedCode.files.map((file, idx) => (
                                <div key={idx} className="border rounded-md">
                                    <div className="bg-gray-50 px-3 py-2 border-b flex items-center justify-between">
                                        <span className="text-sm font-medium font-mono">
                                            {file.filename}
                                        </span>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => copyToClipboard(file.content)}
                                                className="text-xs px-2 py-1 bg-white border rounded hover:bg-gray-50"
                                            >
                                                📋 Copy
                                            </button>
                                            <button
                                                onClick={() => handleDownload(file.filename, file.content)}
                                                className="text-xs px-2 py-1 bg-white border rounded hover:bg-gray-50"
                                            >
                                                ⬇️ Download
                                            </button>
                                        </div>
                                    </div>
                                    <pre className="p-3 text-xs overflow-x-auto bg-gray-900 text-gray-100 max-h-64">
                                        <code>{file.content}</code>
                                    </pre>
                                </div>
                            ))}

                            {/* Setup Instructions */}
                            {generatedCode.setupInstructions && (
                                <div className="border rounded-md p-4 bg-blue-50">
                                    <h3 className="font-medium mb-2">📖 Setup Instructions</h3>
                                    <div className="prose prose-sm max-w-none">
                                        <pre className="whitespace-pre-wrap text-sm">
                                            {generatedCode.setupInstructions}
                                        </pre>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Stats Footer */}
            <div className="mt-8 bg-gray-50 rounded-lg p-4">
                <div className="grid grid-cols-4 gap-4 text-center">
                    <div>
                        <div className="text-2xl font-bold text-blue-600">
                            {templates.length}
                        </div>
                        <div className="text-sm text-gray-600">Templates</div>
                    </div>
                    <div>
                        <div className="text-2xl font-bold text-green-600">3</div>
                        <div className="text-sm text-gray-600">Engines</div>
                    </div>
                    <div>
                        <div className="text-2xl font-bold text-purple-600">
                            {new Set(templates.map(t => t.category)).size}
                        </div>
                        <div className="text-sm text-gray-600">Categories</div>
                    </div>
                    <div>
                        <div className="text-2xl font-bold text-orange-600">
                            {generatedCode?.files.length || 0}
                        </div>
                        <div className="text-sm text-gray-600">Files Generated</div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default GameMechanicsGenerator;
