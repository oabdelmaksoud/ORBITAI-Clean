
import React from 'react';
import { Artifact, Phase } from '@orbitai/shared';
import { FileText, Code, CheckSquare, FileSearch, Terminal, BrainCircuit } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
// @ts-ignore
import remarkGfm from 'remark-gfm';

interface ArtifactViewerProps {
  artifacts: Artifact[];
  currentPhase: Phase;
}

const ArtifactIcon = ({ type }: { type: Artifact['type'] }) => {
  switch (type) {
    case 'code': return <Code size={16} className="text-blue-500" />;
    case 'test-plan': return <CheckSquare size={16} className="text-success" />;
    case 'audit-report': return <FileSearch size={16} className="text-error" />;
    case 'requirement': return <FileText size={16} className="text-secondary" />;
    default: return <Terminal size={16} className="text-slate-400" />;
  }
};

const ArtifactViewer: React.FC<ArtifactViewerProps> = ({ artifacts }) => {
  const [selectedArtifactId, setSelectedArtifactId] = React.useState<string | null>(null);

  const selectedArtifact = artifacts.find(a => a.id === selectedArtifactId) || artifacts[0];

  if (artifacts.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-slate-500 p-8">
        <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4 border border-slate-200">
            <FileText size={24} className="opacity-50" />
        </div>
        <p className="text-sm font-mono">NO_ARTIFACTS_FOUND</p>
      </div>
    );
  }

  // Filter out reasoning blocks for display
  const getCleanContent = (content: string) => {
      return content.replace(/<!-- REASONING_START -->[\s\S]*?<!-- REASONING_END -->/g, '');
  };

  // Extract reasoning blocks for specific display (Optional)
  const getReasoningContent = (content: string) => {
      const match = content.match(/<!-- REASONING_START -->([\s\S]*?)<!-- REASONING_END -->/);
      return match ? match[1].trim() : null;
  };

  const cleanContent = selectedArtifact ? getCleanContent(selectedArtifact.content) : '';
  const reasoningContent = selectedArtifact ? getReasoningContent(selectedArtifact.content) : null;

  return (
    <div className="flex h-full border border-slate-200 rounded-lg bg-white overflow-hidden shadow-sm">
      {/* Sidebar List */}
      <div className="w-1/3 border-r border-slate-200 bg-slate-50 overflow-y-auto custom-scrollbar">
        <div className="p-3 border-b border-slate-200 bg-white">
          <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Document Repository</h3>
        </div>
        <div>
          {artifacts.map(art => (
            <button
              key={art.id}
              onClick={() => setSelectedArtifactId(art.id)}
              className={`w-full text-left p-3 border-b border-slate-100 hover:bg-white transition-colors flex items-start gap-3 group ${
                selectedArtifact?.id === art.id 
                ? 'bg-white border-l-2 border-l-primary shadow-sm' 
                : 'border-l-2 border-l-transparent text-slate-600'
              }`}
            >
              <div className="mt-0.5"><ArtifactIcon type={art.type} /></div>
              <div className="min-w-0">
                <div className={`text-xs font-bold truncate ${selectedArtifact?.id === art.id ? 'text-primary' : 'text-slate-700'}`}>
                    {art.title}
                </div>
                <div className="text-[10px] text-slate-400 flex items-center gap-2 mt-1">
                  <span className="font-medium text-slate-500">{art.phase}</span>
                  <span>•</span>
                  <span className="font-mono">{new Date(art.timestamp).toLocaleTimeString()}</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Content Preview */}
      <div className="w-2/3 flex flex-col h-full bg-white">
        {selectedArtifact && (
          <>
            <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex justify-between items-center backdrop-blur-sm">
              <div>
                 <h2 className="text-sm font-bold text-slate-900">{selectedArtifact.title}</h2>
                 <p className="text-[10px] text-slate-500 font-mono font-medium mt-0.5">AUTHOR: <span className="text-slate-700">{selectedArtifact.createdBy}</span></p>
              </div>
              <span className="text-[10px] font-bold font-mono bg-white px-2 py-1 rounded text-slate-600 uppercase border border-slate-200 shadow-sm">
                {selectedArtifact.type}
              </span>
            </div>
            
            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar bg-white">
               {reasoningContent && (
                   <div className="mb-8 p-5 bg-purple-50/50 border border-purple-100 rounded-xl shadow-sm">
                       <h4 className="text-[10px] font-bold text-purple-700 uppercase tracking-widest mb-3 flex items-center gap-2">
                           <BrainCircuit size={14} /> AI Reasoning Chain
                       </h4>
                       <div className="prose prose-sm max-w-none text-purple-900 font-medium text-xs opacity-90 leading-relaxed font-mono whitespace-pre-wrap">
                           {reasoningContent}
                       </div>
                   </div>
               )}

               <div className="max-w-3xl mx-auto pb-20">
                   <div className="prose prose-sm max-w-none 
                      text-slate-600 font-normal leading-relaxed
                      
                      /* Headings */
                      prose-headings:font-bold prose-headings:text-slate-800 prose-headings:tracking-tight
                      prose-h1:text-2xl prose-h1:mb-6 prose-h1:pb-4 prose-h1:border-b prose-h1:border-slate-100
                      prose-h2:text-lg prose-h2:mt-8 prose-h2:mb-4 prose-h2:text-primary prose-h2:font-bold
                      prose-h3:text-base prose-h3:mt-6 prose-h3:mb-3 prose-h3:text-slate-700 prose-h3:font-semibold
                      
                      /* Text Elements */
                      prose-p:mb-4 prose-p:leading-7
                      prose-strong:font-semibold prose-strong:text-slate-900
                      prose-em:text-slate-500 prose-em:italic
                      
                      /* Lists */
                      prose-ul:my-4 prose-ul:list-disc prose-ul:pl-6 prose-ul:text-slate-600
                      prose-ol:my-4 prose-ol:list-decimal prose-ol:pl-6 prose-ol:text-slate-600
                      prose-li:mb-1.5 prose-li:marker:text-slate-300
                      
                      /* Code - Inline */
                      prose-code:font-mono prose-code:text-[12px] prose-code:font-medium 
                      prose-code:text-primary prose-code:bg-primary/5 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-md prose-code:border prose-code:border-primary/10
                      prose-code:before:content-none prose-code:after:content-none
                      
                      /* Code - Blocks (pre) */
                      prose-pre:bg-[#1e293b] prose-pre:text-slate-50 prose-pre:rounded-xl prose-pre:shadow-lg prose-pre:border prose-pre:border-slate-700 prose-pre:p-5 prose-pre:my-6
                      prose-pre:code:bg-transparent prose-pre:code:text-inherit prose-pre:code:border-0 prose-pre:code:p-0 prose-pre:code:text-xs prose-pre:code:leading-relaxed
                      
                      /* Links */
                      prose-a:text-primary prose-a:font-semibold prose-a:no-underline hover:prose-a:underline hover:prose-a:text-blue-600 transition-colors
                      
                      /* Blockquotes (Callouts) */
                      prose-blockquote:border-l-4 prose-blockquote:border-primary prose-blockquote:bg-slate-50 prose-blockquote:text-slate-600 
                      prose-blockquote:rounded-r-lg prose-blockquote:py-3 prose-blockquote:px-5 prose-blockquote:my-6 prose-blockquote:not-italic
                      prose-blockquote:shadow-sm
                      
                      /* Tables */
                      prose-table:w-full prose-table:my-8 prose-table:border-collapse prose-table:rounded-lg prose-table:overflow-hidden prose-table:shadow-sm prose-table:border prose-table:border-slate-200 prose-table:text-sm
                      prose-thead:bg-slate-50 prose-thead:border-b prose-thead:border-slate-200
                      prose-th:text-xs prose-th:uppercase prose-th:tracking-wider prose-th:font-bold prose-th:text-slate-500 prose-th:p-4 prose-th:text-left
                      prose-td:p-4 prose-td:border-b prose-td:border-slate-100 prose-td:text-slate-600
                      prose-tr:hover:bg-slate-50/50 transition-colors
                      prose-tr:last:border-0
                      
                      /* Images */
                      prose-img:rounded-xl prose-img:shadow-md prose-img:my-8 prose-img:border prose-img:border-slate-100
                      
                      /* Horizontal Rules */
                      prose-hr:border-slate-100 prose-hr:my-8
                   ">
                     <ReactMarkdown remarkPlugins={[remarkGfm]}>{cleanContent}</ReactMarkdown>
                   </div>
               </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ArtifactViewer;
