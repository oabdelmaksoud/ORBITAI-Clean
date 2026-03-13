/**
 * Code Generation Panel Component
 * UI for manually triggering frontend/backend code generation with configuration options
 */

import React, { useState, useCallback } from 'react';
import { 
  Code, Server, Layout, Loader2, CheckCircle2, XCircle, 
  AlertTriangle, Play, Download, Eye, Settings, ChevronDown,
  ChevronRight, FileCode, Folder, Copy, Check, RefreshCw,
  Database, Globe, Lock, Layers, Cpu, Palette, Package
} from 'lucide-react';
import { useFeatureAccess } from '../hooks/useFeatureAccess';

interface DataModel {
  name: string;
  fields: Array<{
    name: string;
    type: string;
    required?: boolean;
  }>;
}

interface ApiEndpoint {
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  description?: string;
}

interface GeneratedFile {
  path: string;
  content: string;
  fileType: string;
}

interface CodeGenerationPanelProps {
  projectId: string;
  projectName?: string;
  token?: string;
  userRole?: string;
  onFilesGenerated?: (files: GeneratedFile[]) => void;
}

const CodeGenerationPanel: React.FC<CodeGenerationPanelProps> = ({
  projectId,
  projectName = 'My Project',
  token,
  userRole = 'user',
  onFilesGenerated
}) => {
  const [activeTab, setActiveTab] = useState<'backend' | 'frontend'>('backend');
  const [loading, setLoading] = useState(false);
  const [generatedFiles, setGeneratedFiles] = useState<GeneratedFile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [selectedFile, setSelectedFile] = useState<GeneratedFile | null>(null);
  const [copied, setCopied] = useState(false);

  // Backend config
  const [backendConfig, setBackendConfig] = useState({
    framework: 'express',
    language: 'typescript',
    methodology: 'agile',
    dataModels: [] as DataModel[],
    apiEndpoints: [] as ApiEndpoint[],
    features: ['authentication', 'validation', 'error-handling'] as string[]
  });

  // Frontend config
  const [frontendConfig, setFrontendConfig] = useState({
    framework: 'react',
    stateManagement: 'context',
    styling: 'tailwind',
    pages: [] as Array<{ name: string; path: string; components?: string[] }>,
    components: [] as Array<{ name: string; type: string; props?: string[] }>,
    authentication: { enabled: true, provider: 'jwt' }
  });

  // Quick model input
  const [newModelName, setNewModelName] = useState('');
  const [newModelFields, setNewModelFields] = useState('');

  const canGenerate = useFeatureAccess('code_generation', userRole);
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3002';
  const authToken = token || localStorage.getItem('authToken');

  const backendFrameworks = [
    { id: 'express', name: 'Express.js', language: 'TypeScript/JavaScript' },
    { id: 'fastapi', name: 'FastAPI', language: 'Python' },
    { id: 'django', name: 'Django', language: 'Python' },
    { id: 'gin', name: 'Gin', language: 'Go' },
    { id: 'nestjs', name: 'NestJS', language: 'TypeScript' }
  ];

  const frontendFrameworks = [
    { id: 'react', name: 'React', version: '18.x' },
    { id: 'vue', name: 'Vue.js', version: '3.x' },
    { id: 'angular', name: 'Angular', version: '17.x' },
    { id: 'svelte', name: 'Svelte', version: '5.x' }
  ];

  const stateManagers = {
    react: ['context', 'redux', 'zustand', 'jotai', 'recoil'],
    vue: ['pinia', 'vuex'],
    angular: ['ngrx', 'akita', 'ngxs'],
    svelte: ['stores', 'context']
  };

  const stylingOptions = ['tailwind', 'styled-components', 'css-modules', 'scss', 'emotion'];

  const featureOptions = [
    'authentication', 'validation', 'error-handling', 'logging', 
    'rate-limiting', 'caching', 'websockets', 'file-upload'
  ];

  const addDataModel = () => {
    if (!newModelName.trim()) return;
    
    const fields = newModelFields.split(',').map(f => {
      const [name, type = 'string'] = f.trim().split(':');
      return { name: name.trim(), type: type.trim(), required: true };
    }).filter(f => f.name);

    setBackendConfig(c => ({
      ...c,
      dataModels: [...c.dataModels, { name: newModelName, fields }]
    }));
    setNewModelName('');
    setNewModelFields('');
  };

  const removeDataModel = (index: number) => {
    setBackendConfig(c => ({
      ...c,
      dataModels: c.dataModels.filter((_, i) => i !== index)
    }));
  };

  const generateBackend = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${apiUrl}/api/code-generation/generate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          projectId,
          projectName,
          framework: backendConfig.framework,
          language: backendConfig.language,
          methodology: backendConfig.methodology,
          dataModels: backendConfig.dataModels,
          apiEndpoints: backendConfig.apiEndpoints,
          features: backendConfig.features
        })
      });

      const data = await response.json();

      if (data.success) {
        setGeneratedFiles(data.data.fullFiles || data.data.files || []);
        onFilesGenerated?.(data.data.fullFiles || data.data.files || []);
      } else {
        setError(data.message || 'Code generation failed');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to generate code');
    } finally {
      setLoading(false);
    }
  };

  const generateFrontend = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${apiUrl}/api/frontend-generation/generate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          projectId,
          projectName,
          framework: frontendConfig.framework,
          stateManagement: frontendConfig.stateManagement,
          styling: frontendConfig.styling,
          pages: frontendConfig.pages,
          components: frontendConfig.components,
          authentication: frontendConfig.authentication
        })
      });

      const data = await response.json();

      if (data.success) {
        setGeneratedFiles(data.data.fullFiles || data.data.files || []);
        onFilesGenerated?.(data.data.fullFiles || data.data.files || []);
      } else {
        setError(data.message || 'Frontend generation failed');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to generate frontend');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = () => {
    if (activeTab === 'backend') {
      generateBackend();
    } else {
      generateFrontend();
    }
  };

  const buildFileTree = (files: GeneratedFile[]) => {
    const tree: Record<string, any> = {};
    
    files.forEach(file => {
      const parts = file.path.split('/');
      let current = tree;
      
      parts.forEach((part, index) => {
        if (index === parts.length - 1) {
          current[part] = file;
        } else {
          current[part] = current[part] || {};
          current = current[part];
        }
      });
    });
    
    return tree;
  };

  const toggleFolder = (path: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const renderFileTree = (tree: Record<string, any>, path = '') => {
    return Object.entries(tree).map(([name, value]) => {
      const fullPath = path ? `${path}/${name}` : name;
      const isFile = value.content !== undefined;
      
      if (isFile) {
        return (
          <button
            key={fullPath}
            onClick={() => setSelectedFile(value)}
            className={`w-full flex items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-gray-700/50 rounded transition-colors ${
              selectedFile?.path === value.path ? 'bg-purple-500/20 text-purple-400' : 'text-gray-300'
            }`}
          >
            <FileCode className="w-4 h-4 flex-shrink-0" />
            <span className="truncate">{name}</span>
          </button>
        );
      }
      
      return (
        <div key={fullPath}>
          <button
            onClick={() => toggleFolder(fullPath)}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-sm text-gray-300 hover:bg-gray-700/50 rounded transition-colors"
          >
            {expandedFolders.has(fullPath) ? (
              <ChevronDown className="w-4 h-4 flex-shrink-0" />
            ) : (
              <ChevronRight className="w-4 h-4 flex-shrink-0" />
            )}
            <Folder className="w-4 h-4 flex-shrink-0 text-yellow-500" />
            <span>{name}</span>
          </button>
          {expandedFolders.has(fullPath) && (
            <div className="ml-4 border-l border-gray-700 pl-2">
              {renderFileTree(value, fullPath)}
            </div>
          )}
        </div>
      );
    });
  };

  const copyFileContent = async () => {
    if (!selectedFile) return;
    await navigator.clipboard.writeText(selectedFile.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadAllFiles = () => {
    // Create a simple downloadable text file with all contents
    const content = generatedFiles.map(f => 
      `// ==================== ${f.path} ====================\n\n${f.content}\n\n`
    ).join('\n');
    
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${projectName}-generated-code.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!canGenerate.enabled) {
    return (
      <div className="p-6 bg-gray-800 rounded-lg text-center">
        <Lock className="w-12 h-12 mx-auto text-gray-500 mb-4" />
        <h3 className="text-lg font-semibold text-white mb-2">Code Generation Locked</h3>
        <p className="text-gray-400">Upgrade your plan to access code generation features.</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 rounded-lg border border-gray-700 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-gray-700 bg-gray-800/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-500/20 rounded-lg">
              <Code className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Code Generation</h2>
              <p className="text-sm text-gray-400">Generate backend and frontend code</p>
            </div>
          </div>
          <button
            onClick={handleGenerate}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg disabled:opacity-50 transition-colors"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Play className="w-4 h-4" />
            )}
            Generate {activeTab === 'backend' ? 'Backend' : 'Frontend'}
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mt-4">
          <button
            onClick={() => setActiveTab('backend')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'backend'
                ? 'bg-green-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            <Server className="w-4 h-4" />
            Backend
          </button>
          <button
            onClick={() => setActiveTab('frontend')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'frontend'
                ? 'bg-green-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            <Layout className="w-4 h-4" />
            Frontend
          </button>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="mx-4 mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2 text-red-400">
          <XCircle className="w-5 h-5" />
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 divide-x divide-gray-700" style={{ minHeight: '500px' }}>
        {/* Configuration Panel */}
        <div className="p-4 overflow-y-auto">
          {activeTab === 'backend' ? (
            <div className="space-y-6">
              {/* Framework Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Framework</label>
                <div className="grid grid-cols-2 gap-2">
                  {backendFrameworks.map(fw => (
                    <button
                      key={fw.id}
                      onClick={() => setBackendConfig(c => ({ ...c, framework: fw.id }))}
                      className={`p-3 rounded-lg border text-left transition-colors ${
                        backendConfig.framework === fw.id
                          ? 'border-green-500 bg-green-500/10'
                          : 'border-gray-700 hover:border-gray-600'
                      }`}
                    >
                      <div className="text-white font-medium text-sm">{fw.name}</div>
                      <div className="text-xs text-gray-500">{fw.language}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Data Models */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  <Database className="w-4 h-4 inline mr-1" />
                  Data Models
                </label>
                
                <div className="space-y-2 mb-3">
                  {backendConfig.dataModels.map((model, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2 bg-gray-800 rounded">
                      <div>
                        <span className="text-white font-medium">{model.name}</span>
                        <span className="text-gray-500 text-sm ml-2">
                          ({model.fields.length} fields)
                        </span>
                      </div>
                      <button
                        onClick={() => removeDataModel(idx)}
                        className="text-red-400 hover:text-red-300"
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newModelName}
                    onChange={(e) => setNewModelName(e.target.value)}
                    placeholder="Model name"
                    className="flex-1 bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm text-white"
                  />
                  <input
                    type="text"
                    value={newModelFields}
                    onChange={(e) => setNewModelFields(e.target.value)}
                    placeholder="name:string, age:number"
                    className="flex-1 bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm text-white"
                  />
                  <button
                    onClick={addDataModel}
                    className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded transition-colors"
                  >
                    Add
                  </button>
                </div>
              </div>

              {/* Features */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  <Layers className="w-4 h-4 inline mr-1" />
                  Features
                </label>
                <div className="flex flex-wrap gap-2">
                  {featureOptions.map(feature => (
                    <button
                      key={feature}
                      onClick={() => {
                        setBackendConfig(c => ({
                          ...c,
                          features: c.features.includes(feature)
                            ? c.features.filter(f => f !== feature)
                            : [...c.features, feature]
                        }));
                      }}
                      className={`px-3 py-1 rounded-full text-sm transition-colors ${
                        backendConfig.features.includes(feature)
                          ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                          : 'bg-gray-700 text-gray-400 border border-gray-600 hover:border-gray-500'
                      }`}
                    >
                      {feature}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Frontend Framework */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Framework</label>
                <div className="grid grid-cols-2 gap-2">
                  {frontendFrameworks.map(fw => (
                    <button
                      key={fw.id}
                      onClick={() => setFrontendConfig(c => ({ 
                        ...c, 
                        framework: fw.id,
                        stateManagement: stateManagers[fw.id as keyof typeof stateManagers]?.[0] || 'context'
                      }))}
                      className={`p-3 rounded-lg border text-left transition-colors ${
                        frontendConfig.framework === fw.id
                          ? 'border-green-500 bg-green-500/10'
                          : 'border-gray-700 hover:border-gray-600'
                      }`}
                    >
                      <div className="text-white font-medium text-sm">{fw.name}</div>
                      <div className="text-xs text-gray-500">v{fw.version}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* State Management */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  <Cpu className="w-4 h-4 inline mr-1" />
                  State Management
                </label>
                <select
                  value={frontendConfig.stateManagement}
                  onChange={(e) => setFrontendConfig(c => ({ ...c, stateManagement: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white"
                >
                  {(stateManagers[frontendConfig.framework as keyof typeof stateManagers] || []).map(sm => (
                    <option key={sm} value={sm}>{sm}</option>
                  ))}
                </select>
              </div>

              {/* Styling */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  <Palette className="w-4 h-4 inline mr-1" />
                  Styling
                </label>
                <div className="flex flex-wrap gap-2">
                  {stylingOptions.map(style => (
                    <button
                      key={style}
                      onClick={() => setFrontendConfig(c => ({ ...c, styling: style }))}
                      className={`px-3 py-1 rounded-full text-sm transition-colors ${
                        frontendConfig.styling === style
                          ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                          : 'bg-gray-700 text-gray-400 border border-gray-600 hover:border-gray-500'
                      }`}
                    >
                      {style}
                    </button>
                  ))}
                </div>
              </div>

              {/* Authentication */}
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="auth"
                  checked={frontendConfig.authentication.enabled}
                  onChange={(e) => setFrontendConfig(c => ({
                    ...c,
                    authentication: { ...c.authentication, enabled: e.target.checked }
                  }))}
                  className="w-4 h-4 rounded bg-gray-700 border-gray-600 text-green-500"
                />
                <label htmlFor="auth" className="text-sm text-gray-300">
                  Include Authentication
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Generated Files Panel */}
        <div className="flex flex-col">
          {generatedFiles.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
              <Package className="w-12 h-12 text-gray-600 mb-4" />
              <h3 className="text-lg font-medium text-gray-400 mb-2">No Files Generated</h3>
              <p className="text-sm text-gray-500">Configure your settings and click Generate</p>
            </div>
          ) : (
            <>
              {/* File tree header */}
              <div className="p-3 border-b border-gray-700 bg-gray-800/50 flex items-center justify-between">
                <span className="text-sm font-medium text-gray-300">
                  {generatedFiles.length} files generated
                </span>
                <button
                  onClick={downloadAllFiles}
                  className="flex items-center gap-1 px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 rounded transition-colors"
                >
                  <Download className="w-3 h-3" />
                  Download All
                </button>
              </div>

              {/* Split view: tree + content */}
              <div className="flex-1 grid grid-cols-5 divide-x divide-gray-700 overflow-hidden">
                {/* File tree */}
                <div className="col-span-2 p-2 overflow-y-auto bg-gray-800/30">
                  {renderFileTree(buildFileTree(generatedFiles))}
                </div>

                {/* File content */}
                <div className="col-span-3 flex flex-col overflow-hidden">
                  {selectedFile ? (
                    <>
                      <div className="p-2 border-b border-gray-700 bg-gray-800/50 flex items-center justify-between">
                        <span className="text-sm text-gray-300 truncate">{selectedFile.path}</span>
                        <button
                          onClick={copyFileContent}
                          className="p-1 text-gray-400 hover:text-white transition-colors"
                        >
                          {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                        </button>
                      </div>
                      <pre className="flex-1 p-3 overflow-auto text-xs text-gray-300 font-mono bg-gray-900">
                        {selectedFile.content}
                      </pre>
                    </>
                  ) : (
                    <div className="flex-1 flex items-center justify-center text-gray-500">
                      Select a file to view
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default CodeGenerationPanel;
