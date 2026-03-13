import React, { useState } from 'react';
import { ProjectPreview } from '@orbitai/shared';
import { Layers, FileCode, Server, ShieldAlert, Cpu, CheckCircle, Smartphone, Hammer, Rocket, Code, Globe, GitBranch, Zap } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface ProjectBlueprintViewProps {
    preview: ProjectPreview;
    className?: string;
}

const ProjectBlueprintView: React.FC<ProjectBlueprintViewProps> = ({ preview, className = '' }) => {
    const [activeTab, setActiveTab] = useState<'blueprint' | 'architecture' | 'buildProject'>('blueprint');

    // Helper to render markdown content
    const renderMarkdown = (content: string) => (
        <div className="prose prose-sm max-w-none prose-slate">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
        </div>
    );

    return (
        <div className={`flex flex-col h-full bg-white/95 backdrop-blur-md rounded-xl shadow-2xl border border-slate-200 overflow-hidden ${className}`}>
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/50">
                <div>
                    <h2 className="text-xl font-bold text-slate-800">{preview.appName || preview.projectName || 'Project Blueprint'}</h2>
                    {preview.tagline && <p className="text-sm text-slate-500 mt-0.5">{preview.tagline}</p>}
                </div>
                <div className="flex gap-2">
                    {preview.estimatedEffort && (
                        <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold">
                            {preview.estimatedEffort}
                        </span>
                    )}
                    {preview.estimatedSprints && (
                        <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-semibold">
                            {preview.estimatedSprints} Sprints
                        </span>
                    )}
                </div>
            </div>

            {/* Tabs */}
            <div className="flex items-center px-4 border-b border-slate-200 bg-white">
                <button
                    onClick={() => setActiveTab('blueprint')}
                    className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'blueprint'
                        ? 'border-indigo-600 text-indigo-600'
                        : 'border-transparent text-slate-500 hover:text-slate-700'
                        }`}
                >
                    <FileCode size={16} />
                    Blueprint
                </button>
                <button
                    onClick={() => setActiveTab('architecture')}
                    className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'architecture'
                        ? 'border-indigo-600 text-indigo-600'
                        : 'border-transparent text-slate-500 hover:text-slate-700'
                        }`}
                >
                    <Server size={16} />
                    Architecture
                </button>
                <button
                    onClick={() => setActiveTab('buildProject')}
                    className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'buildProject'
                        ? 'border-indigo-600 text-indigo-600'
                        : 'border-transparent text-slate-500 hover:text-slate-700'
                        }`}
                >
                    <Hammer size={16} />
                    Build Your Project
                </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 bg-slate-50/30">
                {activeTab === 'blueprint' && (
                    <div className="space-y-6">
                        <div className="bg-white p-5 rounded-lg shadow-sm border border-slate-200">
                            <h3 className="text-lg font-semibold text-slate-800 mb-3 flex items-center gap-2">
                                <Layers className="text-indigo-500" size={20} />
                                Executive Summary
                            </h3>
                            <p className="text-slate-600 leading-relaxed text-sm">
                                {preview.summary}
                            </p>
                        </div>

                        {preview.features && preview.features.length > 0 && (
                            <div className="bg-white p-5 rounded-lg shadow-sm border border-slate-200">
                                <h3 className="text-lg font-semibold text-slate-800 mb-3 flex items-center gap-2">
                                    <CheckCircle className="text-emerald-500" size={20} />
                                    Key Features
                                </h3>
                                <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {preview.features.map((feature, idx) => (
                                        <li key={idx} className="flex items-start gap-2 text-sm text-slate-600">
                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                                            {feature}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {preview.wireframeCode && (
                            <div className="bg-white p-5 rounded-lg shadow-sm border border-slate-200">
                                <h3 className="text-lg font-semibold text-slate-800 mb-3 flex items-center gap-2">
                                    <FileCode className="text-slate-500" size={20} />
                                    Wireframe / Implementation Details
                                </h3>
                                <div className="bg-slate-900 rounded-lg p-4 overflow-x-auto">
                                    <pre className="text-xs text-slate-300 font-mono">
                                        {preview.wireframeCode}
                                    </pre>
                                </div>
                            </div>
                        )}

                        {/* Mobile Code Preview */}
                        {preview.mobileCode && (
                            <div className="bg-white p-5 rounded-lg shadow-sm border border-slate-200">
                                <h3 className="text-lg font-semibold text-slate-800 mb-3 flex items-center gap-2">
                                    <Smartphone className="text-blue-500" size={20} />
                                    Mobile Implementation
                                </h3>

                                <div className="space-y-4">
                                    {preview.mobileCode.reactNative && (
                                        <div className="space-y-2">
                                            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">React Native</span>
                                            <div className="bg-slate-900 rounded-lg p-4 overflow-x-auto max-h-60">
                                                <pre className="text-xs text-slate-300 font-mono">{preview.mobileCode.reactNative}</pre>
                                            </div>
                                        </div>
                                    )}
                                    {preview.mobileCode.flutter && (
                                        <div className="space-y-2">
                                            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Flutter</span>
                                            <div className="bg-slate-900 rounded-lg p-4 overflow-x-auto max-h-60">
                                                <pre className="text-xs text-slate-300 font-mono">{preview.mobileCode.flutter}</pre>
                                            </div>
                                        </div>
                                    )}
                                    {/* Native iOS/Android could also be here */}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'architecture' && (
                    <div className="space-y-6">
                        <div className="bg-white p-5 rounded-lg shadow-sm border border-slate-200">
                            <h3 className="text-lg font-semibold text-slate-800 mb-3 flex items-center gap-2">
                                <Server className="text-blue-600" size={20} />
                                Tech Stack
                            </h3>
                            <div className="flex flex-wrap gap-2">
                                {preview.techStack.map((tech, idx) => (
                                    <span key={idx} className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium border border-slate-200">
                                        {tech}
                                    </span>
                                ))}
                            </div>
                        </div>

                        {preview.architectureDiagram && (
                            <div className="bg-white p-5 rounded-lg shadow-sm border border-slate-200">
                                <h3 className="text-lg font-semibold text-slate-800 mb-3 flex items-center gap-2">
                                    <Layers className="text-orange-500" size={20} />
                                    System Architecture
                                </h3>
                                <div className="p-4 bg-white border border-slate-100 rounded-lg">
                                    {/* If it's mermaid code, we might want to render it, but for now just showing as code or text */}
                                    {preview.architectureDiagram.includes('graph') || preview.architectureDiagram.includes('flowchart') ? (
                                        <div className="bg-slate-50 p-3 rounded text-xs font-mono text-slate-600 whitespace-pre-wrap">
                                            {preview.architectureDiagram}
                                            <p className="mt-2 text-xs text-slate-400 italic">(Mermaid diagram source)</p>
                                        </div>
                                    ) : (
                                        renderMarkdown(preview.architectureDiagram)
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'buildProject' && (
                    <div className="space-y-6">
                        {/* Build Options Header */}
                        <div className="bg-gradient-to-r from-indigo-500 to-purple-600 p-6 rounded-lg shadow-lg text-white">
                            <h3 className="text-xl font-bold mb-2 flex items-center gap-2">
                                <Hammer size={24} />
                                Build Your Project
                            </h3>
                            <p className="text-indigo-100 text-sm">
                                Choose from the recommended approaches below to bring your project to life.
                            </p>
                        </div>

                        {/* AI-Powered Development */}
                        <div className="bg-white p-5 rounded-lg shadow-sm border border-slate-200 hover:border-indigo-300 hover:shadow-md transition-all cursor-pointer group">
                            <div className="flex items-start gap-4">
                                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shrink-0">
                                    <Zap className="text-white" size={24} />
                                </div>
                                <div className="flex-1">
                                    <h4 className="text-lg font-semibold text-slate-800 group-hover:text-indigo-600 transition-colors">AI-Powered Development</h4>
                                    <p className="text-sm text-slate-500 mt-1">Let our AI agents build your project automatically using the generated blueprint and architecture.</p>
                                    <div className="mt-3 flex flex-wrap gap-2">
                                        <span className="px-2 py-1 bg-indigo-50 text-indigo-600 rounded text-xs font-medium">Fastest Option</span>
                                        <span className="px-2 py-1 bg-green-50 text-green-600 rounded text-xs font-medium">Recommended</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Export Code & Build Manually */}
                        <div className="bg-white p-5 rounded-lg shadow-sm border border-slate-200 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer group">
                            <div className="flex items-start gap-4">
                                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shrink-0">
                                    <Code className="text-white" size={24} />
                                </div>
                                <div className="flex-1">
                                    <h4 className="text-lg font-semibold text-slate-800 group-hover:text-blue-600 transition-colors">Export Code & Build Manually</h4>
                                    <p className="text-sm text-slate-500 mt-1">Download the generated code scaffolding and continue development in your preferred IDE.</p>
                                    <div className="mt-3 flex flex-wrap gap-2">
                                        <span className="px-2 py-1 bg-blue-50 text-blue-600 rounded text-xs font-medium">Full Control</span>
                                        <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded text-xs font-medium">For Developers</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Connect to GitHub */}
                        <div className="bg-white p-5 rounded-lg shadow-sm border border-slate-200 hover:border-slate-400 hover:shadow-md transition-all cursor-pointer group">
                            <div className="flex items-start gap-4">
                                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center shrink-0">
                                    <GitBranch className="text-white" size={24} />
                                </div>
                                <div className="flex-1">
                                    <h4 className="text-lg font-semibold text-slate-800 group-hover:text-slate-700 transition-colors">Push to GitHub Repository</h4>
                                    <p className="text-sm text-slate-500 mt-1">Create a new repository or push to an existing one with the complete project structure.</p>
                                    <div className="mt-3 flex flex-wrap gap-2">
                                        <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded text-xs font-medium">Version Control</span>
                                        <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded text-xs font-medium">Collaboration</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Deploy to Cloud */}
                        <div className="bg-white p-5 rounded-lg shadow-sm border border-slate-200 hover:border-emerald-300 hover:shadow-md transition-all cursor-pointer group">
                            <div className="flex items-start gap-4">
                                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shrink-0">
                                    <Globe className="text-white" size={24} />
                                </div>
                                <div className="flex-1">
                                    <h4 className="text-lg font-semibold text-slate-800 group-hover:text-emerald-600 transition-colors">Deploy to Cloud</h4>
                                    <p className="text-sm text-slate-500 mt-1">Deploy your project directly to cloud platforms like Vercel, AWS, or Google Cloud.</p>
                                    <div className="mt-3 flex flex-wrap gap-2">
                                        <span className="px-2 py-1 bg-emerald-50 text-emerald-600 rounded text-xs font-medium">One-Click Deploy</span>
                                        <span className="px-2 py-1 bg-emerald-50 text-emerald-600 rounded text-xs font-medium">Production Ready</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Hire a Developer */}
                        <div className="bg-white p-5 rounded-lg shadow-sm border border-slate-200 hover:border-orange-300 hover:shadow-md transition-all cursor-pointer group">
                            <div className="flex items-start gap-4">
                                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center shrink-0">
                                    <Rocket className="text-white" size={24} />
                                </div>
                                <div className="flex-1">
                                    <h4 className="text-lg font-semibold text-slate-800 group-hover:text-orange-600 transition-colors">Hire Expert Developer</h4>
                                    <p className="text-sm text-slate-500 mt-1">Connect with pre-vetted developers who can build and customize your project.</p>
                                    <div className="mt-3 flex flex-wrap gap-2">
                                        <span className="px-2 py-1 bg-orange-50 text-orange-600 rounded text-xs font-medium">Expert Support</span>
                                        <span className="px-2 py-1 bg-orange-50 text-orange-600 rounded text-xs font-medium">Custom Development</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ProjectBlueprintView;
