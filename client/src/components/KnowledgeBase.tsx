
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Artifact, Task } from '@orbitai/shared';
import { Search, Book, ExternalLink, FileText, Database, Sparkles, Folder, Link, ArrowRight, Loader2, Tag, Clock, Filter, Copy, Check, FileCode, CheckSquare, Layers, X, Upload } from 'lucide-react';
import { searchProjectKnowledge } from '../services/geminiService';
import ReactMarkdown from 'react-markdown';
// @ts-ignore
import JSZip from 'jszip';
import MaturityAssessment from './MaturityAssessment';
import { calculateMaturityAssessment, calculateHybridMaturityAssessment } from '@src/utils/maturityAssessment';

interface KnowledgeBaseProps {
  projectDescription: string;
  artifacts: Artifact[];
  tasks: Task[];
  onUpload: (file: File, content: string | ArrayBuffer) => void;
  projectName?: string;
  projectPreview?: any;
  selectedStandards?: string[];
  useInternet?: boolean;
  conversationMessages?: Array<{ sender: string; text: string }>;
}

const KnowledgeBase: React.FC<KnowledgeBaseProps> = ({ 
  projectDescription, 
  artifacts, 
  tasks, 
  onUpload,
  projectName,
  projectPreview,
  selectedStandards = [],
  useInternet = false,
  conversationMessages = []
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Artifact[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<'ALL' | 'REQ' | 'CODE' | 'DESIGN' | 'TEST'>('ALL');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Calculate maturity assessment (AI-powered)
  const [maturityAssessment, setMaturityAssessment] = useState(() => {
    const hasResearchFindings = conversationMessages.some(m => 
      m.text.includes('Research Findings') || 
      m.text.includes('**Research Findings:**')
    );
    
    return calculateMaturityAssessment({
      projectName,
      projectDescription,
      conversationMessages,
      projectPreview,
      artifacts,
      selectedStandards,
      useInternet,
      hasResearchFindings
    });
  });

  // Stable references for dependency tracking to prevent infinite loops
  const conversationMessagesLength = conversationMessages?.length ?? 0;
  const artifactsLength = artifacts?.length ?? 0;
  const selectedStandardsKey = selectedStandards?.join(',') ?? '';
  
  // Use ref to track if we've already computed for these inputs
  const lastComputedRef = useRef<string>('');

  // Update assessment when inputs change (with AI enhancement)
  useEffect(() => {
    // Create a stable key from the inputs to prevent redundant calculations
    const computeKey = `${projectName}-${projectDescription?.slice(0, 50)}-${conversationMessagesLength}-${artifactsLength}-${selectedStandardsKey}-${useInternet}`;
    
    // Skip if we've already computed for these exact inputs
    if (lastComputedRef.current === computeKey) {
      return;
    }
    
    let isCancelled = false;
    
    const updateAssessment = async () => {
      const hasResearchFindings = conversationMessages.some(m => 
        m.text.includes('Research Findings') || 
        m.text.includes('**Research Findings:**')
      );

      const input = {
        projectName,
        projectDescription,
        conversationMessages,
        projectPreview,
        artifacts,
        selectedStandards,
        useInternet,
        hasResearchFindings
      };

      // Use AI-powered assessment if conversation has messages
      if (conversationMessages && conversationMessages.length > 0) {
        try {
          const aiAssessment = await calculateHybridMaturityAssessment(input, true);
          if (!isCancelled) {
            lastComputedRef.current = computeKey;
            setMaturityAssessment(aiAssessment);
          }
          return;
        } catch (error) {
          console.warn('AI assessment failed, using rule-based:', error);
        }
      }

      // Fallback to rule-based
      if (!isCancelled) {
        const ruleBasedAssessment = calculateMaturityAssessment(input);
        lastComputedRef.current = computeKey;
        setMaturityAssessment(ruleBasedAssessment);
      }
    };

    updateAssessment();
    
    return () => {
      isCancelled = true;
    };
  }, [projectName, projectDescription, conversationMessagesLength, artifactsLength, projectPreview, selectedStandardsKey, useInternet, conversationMessages, artifacts, selectedStandards]);

  // Deduplicate resources from tasks
  const resources = useMemo(() => {
    const allLinks = new Set<string>();
    const linkList: { url: string; title: string; task: string }[] = [];

    tasks.forEach(t => {
        if (t.resources) {
            t.resources.forEach(url => {
                if (!allLinks.has(url)) {
                    allLinks.add(url);
                    try {
                        const hostname = new URL(url).hostname;
                        linkList.push({ url, title: hostname, task: t.title });
                    } catch (e) {
                        // ignore invalid urls
                    }
                }
            });
        }
    });
    return linkList;
  }, [tasks]);

  // Derive Tags from Artifacts
  const allTags = useMemo(() => {
      const tags = new Set<string>();
      artifacts.forEach(a => {
          if (a.tags) a.tags.forEach(t => tags.add(t));
          tags.add(a.type);
          tags.add(a.phase);
      });
      return Array.from(tags).sort();
  }, [artifacts]);

  const handleSearch = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!searchQuery.trim()) return;

      setIsSearching(true);
      try {
          // Perform semantic search
          const results = await searchProjectKnowledge(searchQuery, artifacts);
          setSearchResults(results);
      } catch (error) {
          console.error("Search failed", error);
      } finally {
          setIsSearching(false);
      }
  };

  const clearSearch = () => {
      setSearchQuery("");
      setSearchResults([]);
      setSelectedTag(null);
  };

  const copyToClipboard = async (content: string, id: string) => {
      await navigator.clipboard.writeText(content);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);

    try {
        // Handle ZIP Uploads
        if (file.name.endsWith('.zip')) {
          const zip = await JSZip.loadAsync(file);
          const promises: Promise<void>[] = [];
          
          zip.forEach((relativePath: string, zipEntry: any) => {
            if (zipEntry.dir || relativePath.startsWith('__MACOSX') || relativePath.includes('.DS_Store')) return;
            
            const p = (async () => {
              const isImage = relativePath.match(/\.(png|jpg|jpeg|gif|svg)$/i);
              const isAudio = relativePath.match(/\.(mp3|wav|ogg)$/i);
              const isVideo = relativePath.match(/\.(mp4|webm)$/i);
              
              let type = 'text/plain';
              if (isImage) type = 'image/png';
              else if (isAudio) type = 'audio/mp3';
              else if (isVideo) type = 'video/mp4';

              const mockFile = { name: relativePath, type: type } as File;
              
              if (isImage || isAudio || isVideo) {
                const base64 = await zipEntry.async('base64');
                onUpload(mockFile, base64);
              } else {
                const text = await zipEntry.async('string');
                onUpload(mockFile, text);
              }
            })();
            promises.push(p);
          });

          await Promise.all(promises);
        } 
        else {
            // Handle Single File
            const reader = new FileReader();
            
            if (file.type.startsWith('image/') || file.type.startsWith('audio/') || file.type.startsWith('video/')) {
                reader.onload = (ev) => {
                    const result = ev.target?.result as string;
                    const base64 = result.split(',')[1];
                    onUpload(file, base64);
                };
                reader.readAsDataURL(file);
            } else {
                reader.onload = (ev) => {
                    const result = ev.target?.result as string;
                    onUpload(file, result);
                };
                reader.readAsText(file);
            }
        }
    } catch (err) {
        console.error("Upload failed", err);
    } finally {
        setIsUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Filter Logic
  const filteredArtifacts = useMemo(() => {
      let data = searchResults.length > 0 ? searchResults : artifacts;
      
      // 1. Filter by Category
      if (selectedFilter !== 'ALL') {
          data = data.filter(a => {
              if (selectedFilter === 'REQ') return a.type === 'requirement';
              if (selectedFilter === 'CODE') return a.type === 'code' || a.type === 'build';
              if (selectedFilter === 'DESIGN') return a.type === 'design' || a.type === 'image';
              if (selectedFilter === 'TEST') return a.type === 'test-plan' || a.type === 'audit-report';
              return true;
          });
      }

      // 2. Filter by Tag
      if (selectedTag) {
          data = data.filter(a => 
              a.tags?.includes(selectedTag) || 
              a.type === selectedTag || 
              a.phase === selectedTag
          );
      }

      // Sort by newest first
      return data.sort((a, b) => b.timestamp - a.timestamp);
  }, [artifacts, searchResults, selectedFilter, selectedTag]);

  // Recent Artifacts (Top 6)
  const recentArtifacts = useMemo(() => {
      return [...artifacts].sort((a, b) => b.timestamp - a.timestamp).slice(0, 6);
  }, [artifacts]);

  // Stats
  const stats = [
      { label: "Total Artifacts", value: artifacts.length, icon: FileText, color: "text-blue-500" },
      { label: "External Links", value: resources.length, icon: Link, color: "text-green-500" },
      { label: "Knowledge Vector Points", value: artifacts.filter(a => a.embedding).length, icon: Database, color: "text-purple-500" }
  ];

  return (
    <div className="h-full flex flex-col bg-slate-50 overflow-hidden relative">
       
       <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleFileSelect} 
          className="hidden" 
          multiple
       />

       {/* Background Pattern */}
       <div className="absolute inset-0 pointer-events-none opacity-30" style={{ 
            backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 1px)', 
            backgroundSize: '24px 24px' 
       }} />

       {/* Header */}
       <div className="p-6 bg-white border-b border-slate-200 flex items-center justify-between shrink-0 z-10 shadow-sm">
           <div>
               <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                   <Book className="text-primary" /> Project Knowledge Base
               </h2>
               <p className="text-xs text-slate-500 mt-1">
                   Centralized repository for project context, artifacts, and discovered resources.
               </p>
           </div>
           
           <div className="flex gap-4 items-center">
                <button 
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-bold uppercase tracking-wider transition-colors shadow-sm disabled:opacity-50"
                >
                    {isUploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                    Upload
                </button>

                <div className="w-px h-8 bg-slate-200 mx-2"></div>

                {stats.map((stat, i) => (
                    <div key={i} className="flex items-center gap-3 px-3 py-2 bg-slate-50 rounded-lg border border-slate-100">
                        <div className={`p-2 rounded-full bg-white border border-slate-200 shadow-sm ${stat.color}`}>
                            <stat.icon size={14} />
                        </div>
                        <div>
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{stat.label}</div>
                            <div className="text-sm font-bold text-slate-700">{stat.value}</div>
                        </div>
                    </div>
                ))}
           </div>
       </div>

       {/* Main Content */}
       <div className="flex-1 flex overflow-hidden">
           
           {/* Left Column: Context & Tags */}
           <div className="w-80 min-w-[300px] border-r border-slate-200 bg-white/50 backdrop-blur-sm flex flex-col overflow-y-auto custom-scrollbar p-6 space-y-6 z-10">
               
               {/* Live Maturity Assessment */}
               <MaturityAssessment assessment={maturityAssessment} showDetails={true} compact={false} />

               {/* Project Context Card */}
               <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden group hover:shadow-md transition-shadow shrink-0 flex flex-col max-h-[250px]">
                   <div className="p-3 bg-slate-50 border-b border-slate-100 flex items-center gap-2 shrink-0">
                        <Sparkles size={14} className="text-purple-500" />
                        <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Project Scope</h3>
                   </div>
                   <div className="p-4 overflow-y-auto custom-scrollbar bg-white">
                       <div className="prose prose-sm max-w-none text-xs text-slate-600">
                           <ReactMarkdown>{projectDescription}</ReactMarkdown>
                       </div>
                   </div>
               </div>

               {/* Tag Cloud */}
                <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden shrink-0">
                   <div className="p-3 bg-slate-50 border-b border-slate-100 flex items-center gap-2 shrink-0">
                        <Tag size={14} className="text-blue-500" />
                        <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Smart Tags</h3>
                   </div>
                   <div className="p-3 flex flex-wrap gap-1.5">
                        {allTags.length === 0 ? (
                            <span className="text-xs text-slate-400 italic">No tags generated yet.</span>
                        ) : (
                            allTags.map(tag => (
                                <button
                                    key={tag}
                                    onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
                                    className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider border transition-all ${
                                        selectedTag === tag 
                                        ? 'bg-primary text-white border-primary shadow-sm' 
                                        : 'bg-slate-50 text-slate-500 border-slate-100 hover:border-primary/30 hover:text-primary'
                                    }`}
                                >
                                    {tag}
                                </button>
                            ))
                        )}
                   </div>
               </div>

               {/* External Resources List */}
               <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex-1 flex flex-col min-h-[200px]">
                   <div className="p-3 bg-slate-50 border-b border-slate-100 flex items-center gap-2 shrink-0">
                        <ExternalLink size={14} className="text-green-500" />
                        <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">External Links</h3>
                        <span className="ml-auto bg-white px-2 py-0.5 rounded text-[10px] border border-slate-200 font-mono text-slate-400">{resources.length}</span>
                   </div>
                   <div className="flex-1 overflow-y-auto p-2 space-y-1">
                        {resources.length === 0 ? (
                            <div className="text-center py-8 text-slate-400 text-xs italic">
                                No external resources tracked yet.
                            </div>
                        ) : (
                            resources.map((res, i) => (
                                <a key={i} href={res.url} target="_blank" rel="noopener noreferrer" className="block p-3 rounded-lg hover:bg-slate-50 border border-transparent hover:border-slate-100 transition-all group/link">
                                    <div className="flex items-start justify-between">
                                        <div className="min-w-0">
                                            <div className="text-xs font-bold text-primary truncate flex items-center gap-1.5">
                                                <Link size={10} /> {res.title}
                                            </div>
                                            <div className="text-[10px] text-slate-400 mt-0.5 truncate">{res.url}</div>
                                        </div>
                                        <ExternalLink size={10} className="text-slate-300 group-hover/link:text-primary transition-colors mt-1" />
                                    </div>
                                </a>
                            ))
                        )}
                   </div>
               </div>

           </div>

           {/* Right Column: Content & Search */}
           <div className="flex-1 flex flex-col bg-slate-50/30 p-8 z-10 overflow-y-auto custom-scrollbar">
                
                <div className="max-w-4xl mx-auto w-full">
                    {/* Search Bar */}
                    <form onSubmit={handleSearch} className="mb-6 relative">
                        <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                            <Search className={`w-5 h-5 ${isSearching ? 'text-primary animate-pulse' : 'text-slate-400'}`} />
                        </div>
                        <input 
                            type="text" 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Ask the knowledge base (e.g., 'Show me the database schema' or 'Find authentication logic')..."
                            className="w-full bg-white border border-slate-200 rounded-2xl py-4 pl-12 pr-4 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all placeholder-slate-400"
                            disabled={isSearching}
                        />
                        {searchQuery && (
                            <button 
                                type="button" 
                                onClick={clearSearch} 
                                className="absolute right-24 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                            >
                                <X size={14} />
                            </button>
                        )}
                        <button 
                            type="submit"
                            disabled={!searchQuery.trim() || isSearching}
                            className="absolute inset-y-2 right-2 px-4 bg-slate-900 text-white rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-slate-800 disabled:opacity-50 transition-colors shadow-sm"
                        >
                            {isSearching ? <Loader2 size={16} className="animate-spin" /> : "Search"}
                        </button>
                    </form>

                    {/* Filter Tabs */}
                    <div className="flex items-center gap-2 mb-6 overflow-x-auto scrollbar-hide pb-2">
                        <div className="flex items-center gap-2 px-1">
                            <Filter size={14} className="text-slate-400 mr-2" />
                            {[
                                { id: 'ALL', label: 'All Artifacts' },
                                { id: 'REQ', label: 'Requirements' },
                                { id: 'DESIGN', label: 'Design & UX' },
                                { id: 'CODE', label: 'Code & Build' },
                                { id: 'TEST', label: 'Tests & Audits' }
                            ].map(filter => (
                                <button
                                    key={filter.id}
                                    onClick={() => setSelectedFilter(filter.id as any)}
                                    className={`px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition-all border ${
                                        selectedFilter === filter.id
                                        ? 'bg-slate-800 text-white border-slate-800 shadow-lg'
                                        : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300 hover:text-slate-700'
                                    }`}
                                >
                                    {filter.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Results Area */}
                    {filteredArtifacts.length > 0 ? (
                        <div className="grid grid-cols-1 gap-4 animate-in slide-in-from-bottom-4 duration-500">
                             <div className="flex items-center justify-between mb-2">
                                 <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                     {searchQuery ? 'Search Results' : selectedFilter !== 'ALL' || selectedTag ? 'Filtered Results' : 'Recent Activity'}
                                 </h3>
                                 <span className="text-[10px] text-slate-400 font-mono">{filteredArtifacts.length} items found</span>
                             </div>

                             {(searchQuery ? filteredArtifacts : (selectedFilter !== 'ALL' || selectedTag ? filteredArtifacts : recentArtifacts)).map(result => (
                                 <div key={result.id} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow group relative">
                                     <div className="flex items-center justify-between mb-3">
                                         <div className="flex items-center gap-3">
                                             <div className={`p-2 rounded-lg border flex items-center justify-center ${
                                                 result.type === 'code' ? 'bg-blue-50 border-blue-100 text-blue-600' :
                                                 result.type === 'requirement' ? 'bg-orange-50 border-orange-100 text-orange-600' :
                                                 result.type === 'design' ? 'bg-purple-50 border-purple-100 text-purple-600' :
                                                 result.type === 'test-plan' ? 'bg-green-50 border-green-100 text-green-600' :
                                                 'bg-slate-50 border-slate-100 text-slate-500'
                                             }`}>
                                                 {result.type === 'code' ? <FileCode size={18} /> : 
                                                  result.type === 'requirement' ? <FileText size={18} /> :
                                                  result.type === 'design' ? <Layers size={18} /> :
                                                  result.type === 'test-plan' ? <CheckSquare size={18} /> :
                                                  <FileText size={18} />}
                                             </div>
                                             <div>
                                                 <h4 className="font-bold text-slate-800 text-sm group-hover:text-primary transition-colors">{result.title}</h4>
                                                 <div className="flex items-center gap-2 mt-0.5">
                                                     <span className="px-1.5 py-0.5 bg-slate-100 rounded text-[9px] font-bold text-slate-500 uppercase">{result.type}</span>
                                                     <span className="text-[10px] text-slate-400 flex items-center gap-1">
                                                         <Clock size={10} /> {new Date(result.timestamp).toLocaleDateString()} {new Date(result.timestamp).toLocaleTimeString()}
                                                     </span>
                                                     <span className="text-[10px] text-slate-400">• {result.createdBy}</span>
                                                 </div>
                                             </div>
                                         </div>
                                         <button 
                                            onClick={() => copyToClipboard(result.content, result.id)}
                                            className="p-2 hover:bg-slate-50 rounded-lg text-slate-400 hover:text-primary transition-colors"
                                            title="Copy Content"
                                         >
                                             {copiedId === result.id ? <Check size={16} className="text-success" /> : <Copy size={16} />}
                                         </button>
                                     </div>
                                     <div className="bg-slate-50 rounded-lg p-3 border border-slate-100 text-xs font-mono text-slate-600 line-clamp-3 leading-relaxed">
                                         {result.content.replace(/```/g, '').substring(0, 300)}...
                                     </div>
                                 </div>
                             ))}
                             
                             {!searchQuery && selectedFilter === 'ALL' && !selectedTag && artifacts.length > 6 && (
                                 <div className="text-center py-4">
                                     <span className="text-xs text-slate-400 italic">Showing 6 most recent items... Use search for more.</span>
                                 </div>
                             )}
                        </div>
                    ) : (
                        <div className="text-center py-20 opacity-60">
                             <Database size={64} className="mx-auto mb-4 text-slate-200" />
                             <h3 className="text-lg font-bold text-slate-400">Knowledge Base Empty</h3>
                             <p className="text-sm text-slate-400 mt-2 max-w-sm mx-auto">
                                 {searchQuery || selectedFilter !== 'ALL' ? "No artifacts match your filter." : "Start a project to populate the knowledge graph."}
                             </p>
                         </div>
                    )}
                </div>

           </div>
       </div>
    </div>
  );
};

export default KnowledgeBase;
