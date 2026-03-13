

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Artifact, Phase, AgentRole } from '@orbitai/shared';
import { 
  FileCode, FileJson, FileType, Folder, FolderOpen, 
  Save, Search, X, ChevronRight, ChevronDown, Command, Globe, Terminal, Box, Server, Image as ImageIcon,
  Cpu, Settings, Container, Download, DownloadCloud, Loader2, Upload, Archive, Music, Volume2, Video, Copy, Check, WrapText, Sparkles, Wand2, MessageSquare,
  Maximize2, Minimize2, Split, Replace, Regex, Minimize, Maximize, ChevronUp, ChevronDown as ChevronDownIcon, Play, Square, GitBranch, GitCommit, Monitor
} from 'lucide-react';
// @ts-ignore
import JSZip from 'jszip';
import { getAutocompleteSuggestions, explainCode, refactorCode, AutocompleteSuggestion } from '../services/autocompleteService';
import { searchCodebase } from '../services/codeSearchService';
import Editor from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import { useFeatureAccess } from '../hooks/useFeatureAccess';
import NotebookViewer from './NotebookViewer';

import { showAlert, showConfirm } from '../utils/browserUtils';
interface CodeEditorProps {
  artifacts: Artifact[];
  onSave?: (id: string, content: string) => void;
  onUpload?: (file: File, content: string | ArrayBuffer) => void;
  currentPhase: Phase;
  readOnly?: boolean;
}

const FileIcon = ({ type, title }: { type: Artifact['type'], title: string }) => {
  const lowerTitle = (title || "").toLowerCase();
  
  if (type === 'image') return <ImageIcon size={14} className="text-pink-400" />;
  if (type === 'audio') return <Music size={14} className="text-purple-500" />;
  if (type === 'video') return <Video size={14} className="text-rose-500" />;
  if (type === 'mcp') return <div className="text-[10px] font-bold text-success flex items-center gap-1"><Server size={12} /> MCP</div>;
  if (type === 'build') return <Globe size={14} className="text-cyan-400" />;
  if (type === 'notebook') return <FileCode size={14} className="text-orange-500" />;
  
  // Linux / Config Files
  if (lowerTitle.endsWith('.sh') || lowerTitle.endsWith('.bash') || lowerTitle.endsWith('.zsh')) {
      return <Terminal size={14} className="text-green-500" />;
  }
  if (lowerTitle.includes('dockerfile') || lowerTitle.includes('docker-compose')) {
      return <Container size={14} className="text-blue-400" />;
  }
  if (lowerTitle.includes('makefile')) {
      return <Cpu size={14} className="text-slate-400" />;
  }
  if (lowerTitle.endsWith('.conf') || lowerTitle.endsWith('.config') || lowerTitle.startsWith('.')) {
      return <Settings size={14} className="text-slate-500" />;
  }

  if (type === 'code') {
      if (lowerTitle.includes('cs') || lowerTitle.includes('sharp')) return <div className="text-[10px] font-bold text-purple-400">C#</div>;
      if (lowerTitle.includes('py')) return <div className="text-[10px] font-bold text-yellow-400">PY</div>;
      if (lowerTitle.includes('java')) return <div className="text-[10px] font-bold text-orange-400">JV</div>;
      if (lowerTitle.includes('cpp') || lowerTitle.includes('c++')) return <div className="text-[10px] font-bold text-blue-500">C++</div>;
      if (lowerTitle.includes('swift')) return <div className="text-[10px] font-bold text-red-400">SW</div>;
      return <FileCode size={14} className="text-blue-500" />;
  }
  
  // Mobile app artifact types
  if (type === 'react-native') return <div className="text-[10px] font-bold text-blue-400 flex items-center gap-1"><Smartphone size={12} /> RN</div>;
  if (type === 'flutter') return <div className="text-[10px] font-bold text-blue-500 flex items-center gap-1"><Smartphone size={12} /> FL</div>;
  if (type === 'ios-swift') return <div className="text-[10px] font-bold text-red-400 flex items-center gap-1"><Smartphone size={12} /> iOS</div>;
  if (type === 'android-kotlin') return <div className="text-[10px] font-bold text-green-500 flex items-center gap-1"><Smartphone size={12} /> A-K</div>;
  
  switch (type) {
    case 'requirement': return <FileType size={14} className="text-orange-400" />;
    case 'design': return <FileJson size={14} className="text-purple-400" />;
    case 'test-plan': return <FileType size={14} className="text-green-400" />;
    default: return <FileType size={14} className="text-slate-400" />;
  }
};

const getFileExtension = (type: Artifact['type'], title: string) => {
  const lowerTitle = (title || "").toLowerCase();
  
  // Mobile app artifact types
  if (type === 'react-native') return '.tsx';
  if (type === 'flutter') return '.dart';
  if (type === 'ios-swift') return '.swift';
  if (type === 'android-kotlin') return '.kt';
  
  // If title already has an extension, don't double up unless necessary
  if (lowerTitle.includes('.')) {
      const parts = lowerTitle.split('.');
      if (parts.length > 1 && parts[parts.length - 1].length > 0) {
          return ''; 
      }
  }

  // Use heuristic based on title if provided
  if (type === 'code' || type === 'mcp') {
      if (lowerTitle.includes('.cs') || lowerTitle.includes('c#')) return '.cs';
      if (lowerTitle.includes('.py') || lowerTitle.includes('python')) return '.py';
      if (lowerTitle.includes('.java')) return '.java';
      if (lowerTitle.includes('.cpp')) return '.cpp';
      if (lowerTitle.includes('.swift')) return '.swift';
      if (lowerTitle.includes('.sh') || lowerTitle.includes('bash')) return '.sh';
      if (lowerTitle.includes('docker')) return ''; // Dockerfile usually has no extension
      if (lowerTitle.includes('makefile')) return '';
      if (lowerTitle.includes('.tsx') || lowerTitle.includes('react')) return '.tsx';
      if (lowerTitle.includes('.ts')) return '.ts';
      if (lowerTitle.includes('.js')) return '.js';
      return '.ts'; // Default
  }

  switch (type) {
    case 'requirement': return '.md';
    case 'design': return '.json';
    case 'test-plan': return '.spec.ts';
    case 'audit-report': return '.log';
    case 'build': return '.html';
    case 'image': return '.png';
    case 'audio': return '.mp3';
    case 'video': return '.mp4';
    default: return '.txt';
  }
};

const CodeEditor: React.FC<CodeEditorProps> = ({ artifacts, onSave, onUpload, currentPhase, readOnly = false }) => {
  // Feature access checks - get user role from localStorage or default to 'public'
  const userRole = (() => {
    try {
      const userStr = localStorage.getItem('orbitai_user');
      if (userStr) {
        const user = JSON.parse(userStr);
        return user?.role?.toLowerCase() || 'public';
      }
    } catch (e) {
      // Ignore parse errors
    }
    return 'public';
  })();
  
  const canExportCode = useFeatureAccess('export_code', userRole);
  
  // Helper to check if feature should be shown
  const shouldShowFeature = (feature: { enabled: boolean; loading: boolean }) => {
    if (feature.loading) return false;
    return feature.enabled;
  };
  
  // Multiple tabs support
  const [openTabs, setOpenTabs] = useState<string[]>([]); // Array of artifact IDs
  const [activeArtifactId, setActiveArtifactId] = useState<string | null>(null);
  
  // Enhanced Folder Structure State
  const [openFolders, setOpenFolders] = useState<Record<string, boolean>>({
    '00_Stakeholder_Needs': true,
    '01_System_Requirements': true, 
    '02_Architecture_Design': true, 
    '03_Test_Planning': true,
    '04_Implementation_Source': true,
    '04_Assets_Media': true,
    '05_Integration_Builds': true,
    '06_Verification_Reports': true,
    '99_MCP_Tools': true,
    '99_Uncategorized': true
  });
  
  const [content, setContent] = useState('');
  const [isDirty, setIsDirty] = useState<Record<string, boolean>>({}); // Track dirty state per tab
  const [isZipping, setIsZipping] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [wordWrap, setWordWrap] = useState(true);
  const [copied, setCopied] = useState(false);
  
  // Terminal panel state
  const [showTerminal, setShowTerminal] = useState(false);
  const [terminalHeight, setTerminalHeight] = useState(200);
  const [terminalOutput, setTerminalOutput] = useState<string[]>([]);
  const [terminalInput, setTerminalInput] = useState('');
  const [isTerminalFocused, setIsTerminalFocused] = useState(false);
  
  // Find & Replace state
  const [showFindReplace, setShowFindReplace] = useState(false);
  const [findQuery, setFindQuery] = useState('');
  const [replaceQuery, setReplaceQuery] = useState('');
  const [useRegex, setUseRegex] = useState(false);
  const [matchCase, setMatchCase] = useState(false);
  const [findResults, setFindResults] = useState<{line: number, matches: number}[]>([]);
  const [currentFindIndex, setCurrentFindIndex] = useState(0);
  
  // Split view state
  const [splitView, setSplitView] = useState(false);
  const [splitArtifactId, setSplitArtifactId] = useState<string | null>(null);
  const [splitContent, setSplitContent] = useState('');
  
  // Minimap state
  const [showMinimap, setShowMinimap] = useState(true);
  
  // Fullscreen (expanded card) state
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  // Autocomplete state
  const [autocompleteSuggestions, setAutocompleteSuggestions] = useState<AutocompleteSuggestion[]>([]);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(0);
  const [isLoadingAutocomplete, setIsLoadingAutocomplete] = useState(false);
  const [cursorPosition, setCursorPosition] = useState(0);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedCode, setSelectedCode] = useState('');
  const [showCodeActions, setShowCodeActions] = useState(false);
  
  // Code search state
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const splitTextareaRef = useRef<HTMLTextAreaElement>(null);
  const terminalInputRef = useRef<HTMLInputElement>(null);
  const autocompleteTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const monacoEditorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const splitMonacoEditorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);

  const getFolderForArtifact = (artifact: Artifact): string => {
        // 0. Stakeholder / Initiation
        if (artifact.phase === Phase.INITIATION) return '00_Stakeholder_Needs';

        // 1. Requirements
        if (artifact.type === 'requirement' || artifact.phase === Phase.REQUIREMENTS) return '01_System_Requirements';
        
        // 2. Architecture
        if (artifact.type === 'design' || artifact.phase === Phase.ARCHITECTURE) return '02_Architecture_Design';
        
        // 3. Test Planning
        if (artifact.type === 'test-plan' || artifact.phase === Phase.TEST_PLANNING) return '03_Test_Planning';

        // 4. Implementation (Code)
        if (artifact.type === 'code' || artifact.phase === Phase.IMPLEMENTATION) return '04_Implementation_Source';
        
        // Assets
        if (['image', 'audio', 'video'].includes(artifact.type)) return '04_Assets_Media';
        
        // Notebooks (Data Analysis)
        if (artifact.type === 'notebook') return '04_Data_Analysis';
        
        // 5. Integration / Builds
        if (artifact.type === 'build' || artifact.phase === Phase.INTEGRATION || artifact.phase === Phase.RELEASE_PREP) return '05_Integration_Builds';
        
        // 6. Verification / Audits / Acceptance
        if (['audit-report', 'defect'].includes(artifact.type) || artifact.phase === Phase.SYSTEM_ACCEPTANCE || artifact.phase === Phase.POST_RELEASE) return '06_Verification_Reports';
        
        // MCP
        if (artifact.type === 'mcp') return '99_MCP_Tools';
        
        return '99_Uncategorized';
  };

  const fileSystem = React.useMemo(() => {
        const fs: Record<string, Artifact[]> = {
             '00_Stakeholder_Needs': [],
             '01_System_Requirements': [],
             '02_Architecture_Design': [],
             '03_Test_Planning': [],
             '04_Implementation_Source': [],
             '04_Assets_Media': [],
             '04_Data_Analysis': [],
             '05_Integration_Builds': [], 
             '06_Verification_Reports': [],
             '99_MCP_Tools': [],
             '99_Uncategorized': []
        };
        
        artifacts.forEach(art => {
            // Apply Search Filter
            if (searchTerm && !(art.title || "").toLowerCase().includes(searchTerm.toLowerCase())) {
                return;
            }

            const folder = getFolderForArtifact(art);
            if (fs[folder]) {
                fs[folder].push(art);
            } else {
                fs['99_Uncategorized'].push(art);
            }
        });
        return fs;
  }, [artifacts, searchTerm]);

  // Handle tab management
  const openTab = (artifactId: string) => {
    if (!openTabs.includes(artifactId)) {
      setOpenTabs([...openTabs, artifactId]);
    }
    setActiveArtifactId(artifactId);
  };

  const closeTab = (artifactId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const newTabs = openTabs.filter(id => id !== artifactId);
    setOpenTabs(newTabs);
    
    if (activeArtifactId === artifactId) {
      if (newTabs.length > 0) {
        setActiveArtifactId(newTabs[newTabs.length - 1]);
      } else {
        setActiveArtifactId(null);
        setContent('');
      }
    }
    
    // Clear dirty state for closed tab
    const newDirty = { ...isDirty };
    delete newDirty[artifactId];
    setIsDirty(newDirty);
  };

  useEffect(() => {
    if (activeArtifactId) {
      const art = artifacts.find(a => a.id === activeArtifactId);
      if (art) {
        setContent(art.content);
        if (!isDirty[activeArtifactId]) {
          setIsDirty(prev => ({ ...prev, [activeArtifactId]: false }));
        }
        setCopied(false);
        
        // Auto-open tab if not already open
        if (!openTabs.includes(activeArtifactId)) {
          setOpenTabs([...openTabs, activeArtifactId]);
        }
      }
    } else if (artifacts.length > 0 && !activeArtifactId && openTabs.length === 0) {
       // Only select first if no tabs are open
       const firstFolder = Object.values(fileSystem).find((files: Artifact[]) => files.length > 0);
       const first = firstFolder ? firstFolder[0] : null;
       
       if(first) {
         openTab(first.id);
       }
    }
  }, [activeArtifactId, artifacts, fileSystem]);

  // Debounced autocomplete fetch
  const fetchAutocomplete = useCallback(async (code: string, position: number) => {
    if (readOnly || !activeArtifactId) return;
    
    const activeArtifact = artifacts.find(a => a.id === activeArtifactId);
    if (!activeArtifact || activeArtifact.type !== 'code') return;

    setIsLoadingAutocomplete(true);
    try {
      const suggestions = await getAutocompleteSuggestions({
        code,
        cursorPosition: position,
        filePath: activeArtifact.title,
        fileType: getFileExtension(activeArtifact.type, activeArtifact.title).replace('.', ''),
        context: {
          selectedCode: selectedCode || undefined,
          projectContext: `Phase: ${currentPhase}`
        }
      });
      
      if (suggestions.length > 0) {
        setAutocompleteSuggestions(suggestions);
        setShowSuggestions(true);
        setSelectedSuggestionIndex(0);
      } else {
        setShowSuggestions(false);
      }
    } catch (error) {
      console.error('Autocomplete failed:', error);
      setShowSuggestions(false);
    } finally {
      setIsLoadingAutocomplete(false);
    }
  }, [activeArtifactId, artifacts, selectedCode, currentPhase, readOnly]);

  // Terminal functions
  const executeTerminalCommand = (command: string) => {
    if (!command.trim()) return;
    
    const output: string[] = [];
    output.push(`$ ${command}`);
    
    // Simple command simulation
    if (command.startsWith('ls') || command.startsWith('dir')) {
      const folders = Object.keys(fileSystem).filter(f => fileSystem[f].length > 0);
      output.push(...folders.map(f => `  ${f.replace(/_/g, ' ')}/`));
    } else if (command.startsWith('pwd')) {
      output.push('/workspace');
    } else if (command.startsWith('clear') || command.startsWith('cls')) {
      setTerminalOutput([]);
      return;
    } else if (command.startsWith('help')) {
      output.push('Available commands: ls, dir, pwd, clear, cls, help');
    } else {
      output.push(`Command not found: ${command}`);
    }
    
    setTerminalOutput(prev => [...prev, ...output]);
    setTerminalInput('');
  };

  const handleTerminalKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      executeTerminalCommand(terminalInput);
    }
  };

  // Find & Replace functions
  const performFind = (query: string, content: string) => {
    if (!query) {
      setFindResults([]);
      return;
    }
    
    const lines = content.split('\n');
    const results: {line: number, matches: number}[] = [];
    const flags = matchCase ? 'g' : 'gi';
    
    try {
      const regex = useRegex ? new RegExp(query, flags) : new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags);
      
      lines.forEach((line, index) => {
        const matches = line.match(regex);
        if (matches) {
          results.push({ line: index + 1, matches: matches.length });
        }
      });
      
      setFindResults(results);
      setCurrentFindIndex(0);
    } catch (error) {
      setFindResults([]);
    }
  };

  const performReplace = () => {
    if (!findQuery || !textareaRef.current) return;
    
    const flags = matchCase ? 'g' : 'gi';
    let regex: RegExp;
    
    try {
      regex = useRegex ? new RegExp(findQuery, flags) : new RegExp(findQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags);
    } catch (error) {
      showAlert('Invalid regex pattern');
      return;
    }
    
    const newContent = content.replace(regex, replaceQuery);
    setContent(newContent);
    setIsDirty(prev => ({ ...prev, [activeArtifactId || '']: true }));
    performFind(findQuery, newContent);
  };

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    const newPosition = e.target.selectionStart;
    
    setContent(newContent);
    if (activeArtifactId) {
      setIsDirty(prev => ({ ...prev, [activeArtifactId]: true }));
    }
    setCursorPosition(newPosition);
    
    // Update selected code if there's a selection
    const selectionStart = e.target.selectionStart;
    const selectionEnd = e.target.selectionEnd;
    if (selectionStart !== selectionEnd) {
      setSelectedCode(newContent.substring(selectionStart, selectionEnd));
      setShowCodeActions(true);
    } else {
      setSelectedCode('');
      setShowCodeActions(false);
    }
    
    // Debounce autocomplete requests
    if (autocompleteTimeoutRef.current) {
      clearTimeout(autocompleteTimeoutRef.current);
    }
    
    autocompleteTimeoutRef.current = setTimeout(() => {
      if (newContent.length > 0 && newPosition > 0) {
        fetchAutocomplete(newContent, newPosition);
      } else {
        setShowSuggestions(false);
      }
    }, 300); // 300ms debounce
  };

  // Handle keyboard events for autocomplete
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showSuggestions && autocompleteSuggestions.length > 0) {
      if (e.key === 'Tab' && !e.shiftKey) {
        e.preventDefault();
        acceptSuggestion(selectedSuggestionIndex);
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedSuggestionIndex(prev => 
          prev < autocompleteSuggestions.length - 1 ? prev + 1 : 0
        );
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedSuggestionIndex(prev => 
          prev > 0 ? prev - 1 : autocompleteSuggestions.length - 1
        );
        return;
      }
      if (e.key === 'Escape') {
        setShowSuggestions(false);
        return;
      }
    }
    
    // Cmd/Ctrl + K for codebase search
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      setShowSearch(true);
      return;
    }
    
    // Cmd/Ctrl + F for find
    if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
      e.preventDefault();
      setShowFindReplace(true);
      return;
    }
    
    // Cmd/Ctrl + H for find & replace
    if ((e.metaKey || e.ctrlKey) && e.key === 'h') {
      e.preventDefault();
      setShowFindReplace(true);
      return;
    }
    
    // Cmd/Ctrl + S for save
    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
      e.preventDefault();
      handleSave();
      return;
    }
    
    // Cmd/Ctrl + / for explain code
    if ((e.metaKey || e.ctrlKey) && e.key === '/') {
      e.preventDefault();
      if (selectedCode) {
        handleExplainCode();
      }
      return;
    }
    
    // Cmd/Ctrl + ` for terminal
    if ((e.metaKey || e.ctrlKey) && e.key === '`') {
      e.preventDefault();
      setShowTerminal(!showTerminal);
      return;
    }
    
    // F11 and Escape handlers removed - maximize functionality disabled
  };

  const acceptSuggestion = (index: number) => {
    if (index < 0 || index >= autocompleteSuggestions.length || !textareaRef.current) return;
    
    const suggestion = autocompleteSuggestions[index];
    const before = content.substring(0, cursorPosition);
    const after = content.substring(cursorPosition);
    const newContent = before + suggestion.text + after;
    
    setContent(newContent);
    setIsDirty(true);
    setShowSuggestions(false);
    
    // Set cursor position after inserted text
    setTimeout(() => {
      if (textareaRef.current) {
        const newPosition = cursorPosition + suggestion.text.length;
        textareaRef.current.setSelectionRange(newPosition, newPosition);
        setCursorPosition(newPosition);
      }
    }, 0);
  };

  const handleExplainCode = async () => {
    if (!selectedCode) return;
    const explanation = await explainCode(selectedCode, `File: ${activeArtifact?.title}`);
    alert(explanation);
  };

  const handleRefactorCode = async () => {
    if (!selectedCode || !textareaRef.current) return;
    const instruction = prompt('How would you like to refactor this code?');
    if (!instruction) return;
    
    try {
      const result = await refactorCode(selectedCode, instruction, `File: ${activeArtifact?.title}`);
      const start = textareaRef.current.selectionStart;
      const end = textareaRef.current.selectionEnd;
      const before = content.substring(0, start);
      const after = content.substring(end);
      setContent(before + result.refactoredCode + after);
      setIsDirty(true);
      alert(`Refactored! Changes: ${result.changes.join(', ')}`);
    } catch (error) {
      alert('Failed to refactor code');
    }
  };

  const handleSave = () => {
    if (activeArtifactId && onSave && !readOnly) {
      onSave(activeArtifactId, content);
      setIsDirty(prev => ({ ...prev, [activeArtifactId]: false }));
    }
  };
  
  const handleSaveAll = () => {
    openTabs.forEach(tabId => {
      const art = artifacts.find(a => a.id === tabId);
      if (art && onSave && !readOnly) {
        onSave(tabId, art.content);
      }
    });
    setIsDirty({});
  };

  const handleCopy = async () => {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
  };

  const constructFileName = (file: Artifact) => {
    let ext = getFileExtension(file.type, file.title);
    let cleanTitle = (file.title || "untitled").replace(/[^a-zA-Z0-9-_. \/]/g, '_').replace(/ /g, '_');
    
    // Check if title already ends with the extension
    if (ext && cleanTitle.toLowerCase().endsWith(ext)) {
        return cleanTitle;
    }
    return cleanTitle + ext;
  };

  const handleDownloadFile = () => {
    if (!activeArtifactId) return;
    const art = artifacts.find(a => a.id === activeArtifactId);
    if (!art) return;

    const fileName = constructFileName(art);
    
    if (['image', 'audio', 'video'].includes(art.type)) {
        const link = document.createElement('a');
        let mime = 'image/png';
        if (art.type === 'audio') mime = 'audio/mp3';
        if (art.type === 'video') mime = 'video/mp4';
        
        link.href = `data:${mime};base64,${art.content}`;
        link.download = fileName;
        link.click();
    } else {
        const blob = new Blob([art.content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        link.click();
        URL.revokeObjectURL(url);
    }
  };

  const handleDownloadZip = async () => {
    if (artifacts.length === 0) return;
    setIsZipping(true);
    
    try {
        const zip = new JSZip();

        // Iterate through the grouping logic to recreate the folder structure
        Object.entries(fileSystem).forEach(([folderName, filesData]) => {
            const files = filesData as Artifact[];
            if (files.length > 0) {
                const folder = zip.folder(folderName);
                if (folder) {
                    files.forEach(file => {
                        const fileName = constructFileName(file);
                        if (['image', 'audio', 'video'].includes(file.type)) {
                            folder.file(fileName, file.content, { base64: true });
                        } else {
                            folder.file(fileName, file.content);
                        }
                    });
                }
            }
        });

        const blob = await zip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'sdlc_project_export.zip';
        link.click();
        URL.revokeObjectURL(url);
    } catch (e) {
        console.error("Failed to generate zip", e);
        showAlert("Failed to generate zip archive.");
    } finally {
        setIsZipping(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Handle ZIP Uploads
    if (file.name.endsWith('.zip')) {
      setIsUploading(true);
      try {
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
            
            if (onUpload && !readOnly) {
              if (isImage || isAudio || isVideo) {
                const base64 = await zipEntry.async('base64');
                onUpload(mockFile, base64);
              } else {
                const text = await zipEntry.async('string');
                onUpload(mockFile, text);
              }
            }
          })();
          promises.push(p);
        });

        await Promise.all(promises);

      } catch (err) {
        console.error("Failed to unzip", err);
        alert("Failed to process ZIP file.", "error");
      } finally {
        setIsUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
      return;
    }

    // Handle Single File
    const reader = new FileReader();
    
    if (onUpload && !readOnly) {
      if (file.type.startsWith('image/') || file.type.startsWith('audio/') || file.type.startsWith('video/')) {
          reader.onload = (ev) => {
              const result = ev.target?.result as string;
              // Remove Data URL prefix to get raw base64
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
    
    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const toggleFolder = (folder: string) => {
    setOpenFolders(prev => ({ ...prev, [folder]: !prev[folder] }));
  };

  const renderFolder = (name: string, files: Artifact[], iconColor: string) => {
    const isEmpty = files.length === 0;
    const isOpen = openFolders[name] || searchTerm.length > 0; // Always open if searching

    if (isEmpty && searchTerm.length > 0) return null; // Hide empty folders during search

    return (
      <div className="mb-1">
        <button 
          onClick={() => toggleFolder(name)}
          className={`flex items-center gap-1.5 w-full hover:bg-slate-100 px-2 py-1 rounded transition-colors text-[10px] font-bold uppercase tracking-wider ${isEmpty ? 'text-slate-400' : 'text-slate-600 hover:text-slate-800'}`}
        >
           {isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
           {isOpen ? <FolderOpen size={14} className={iconColor} /> : <Folder size={14} className={iconColor} />}
           <span className="truncate">{name.replace(/_/g, ' ')}</span>
        </button>
        {isOpen && !isEmpty && (
          <div className="ml-4 border-l border-slate-200 pl-1 mt-1 space-y-0.5">
            {files.map(file => {
               const isActive = activeArtifactId === file.id;
               const fileName = constructFileName(file);
               
               return (
                <button
                  key={file.id}
                  onClick={() => openTab(file.id)}
                  onDoubleClick={() => openTab(file.id)}
                  className={`flex items-center gap-2 w-full text-left px-2 py-1.5 rounded text-[11px] font-mono transition-colors group ${
                    isActive 
                    ? 'bg-primary/10 text-primary font-bold' 
                    : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <div className="shrink-0"><FileIcon type={file.type} title={file.title} /></div>
                  <span className="truncate flex-1" title={fileName}>{fileName}</span>
                  {isDirty[file.id] && (
                     <div className="shrink-0 w-1.5 h-1.5 rounded-full bg-warning"></div>
                  )}
                </button>
               );
            })}
          </div>
        )}
      </div>
    );
  };

  const activeArtifact = artifacts.find(a => a.id === activeArtifactId);
  const activeFileName = activeArtifact ? constructFileName(activeArtifact) : 'untitled';

  const lines = content.split('\n');
  const lineNumbers = lines.map((_, i) => i + 1);
  
  // Get Monaco language from file extension
  const getMonacoLanguage = (artifact: Artifact | null): string => {
    if (!artifact) return 'plaintext';
    const ext = getFileExtension(artifact.type, artifact.title).replace('.', '').toLowerCase();
    const langMap: Record<string, string> = {
      'ts': 'typescript', 'tsx': 'typescript', 'js': 'javascript', 'jsx': 'javascript',
      'py': 'python', 'java': 'java', 'cs': 'csharp', 'cpp': 'cpp', 'c': 'c',
      'swift': 'swift', 'go': 'go', 'rs': 'rust', 'php': 'php', 'rb': 'ruby',
      'sh': 'shell', 'bash': 'shell', 'zsh': 'shell', 'md': 'markdown',
      'dart': 'dart', 'kt': 'kotlin',
      'json': 'json', 'html': 'html', 'css': 'css', 'scss': 'scss',
      'sql': 'sql', 'xml': 'xml', 'yaml': 'yaml', 'yml': 'yaml',
      'dockerfile': 'dockerfile', 'log': 'plaintext', 'txt': 'plaintext',
    };
    return langMap[ext] || 'plaintext';
  };
  
  // Handle Monaco Editor change
  const handleMonacoChange = (value: string | undefined) => {
    const newContent = value || '';
    setContent(newContent);
    if (activeArtifactId) {
      setIsDirty(prev => ({ ...prev, [activeArtifactId]: true }));
    }
    if (monacoEditorRef.current) {
      const selection = monacoEditorRef.current.getSelection();
      if (selection && !selection.isEmpty()) {
        const selectedText = monacoEditorRef.current.getModel()?.getValueInRange(selection) || '';
        setSelectedCode(selectedText);
        setShowCodeActions(true);
      } else {
        setSelectedCode('');
        setShowCodeActions(false);
      }
    }
    if (autocompleteTimeoutRef.current) clearTimeout(autocompleteTimeoutRef.current);
    if (monacoEditorRef.current && activeArtifactId) {
      const position = monacoEditorRef.current.getPosition();
      if (position) {
        const offset = monacoEditorRef.current.getModel()?.getOffsetAt(position) || 0;
        autocompleteTimeoutRef.current = setTimeout(() => {
          if (newContent.length > 0 && offset > 0) {
            fetchAutocomplete(newContent, offset);
          } else {
            setShowSuggestions(false);
          }
        }, 300);
      }
    }
  };
  
  // Handle Monaco Editor mount
  const handleEditorDidMount = (editor: monaco.editor.IStandaloneCodeEditor) => {
    monacoEditorRef.current = editor;
    editor.updateOptions({
      wordWrap: wordWrap ? 'on' : 'off',
      minimap: { enabled: showMinimap },
      fontSize: 13,
      lineNumbers: 'on',
      scrollBeyondLastLine: false,
      automaticLayout: true,
      readOnly: readOnly,
      theme: 'vs',
    });
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => handleSave());
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyF, () => editor.getAction('actions.find')?.run());
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyH, () => editor.getAction('editor.action.startFindReplaceAction')?.run());
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyK, () => setShowSearch(true));
    editor.onDidChangeCursorSelection(() => {
      const selection = editor.getSelection();
      if (selection && !selection.isEmpty()) {
        const selectedText = editor.getModel()?.getValueInRange(selection) || '';
        setSelectedCode(selectedText);
        setShowCodeActions(true);
      } else {
        setSelectedCode('');
        setShowCodeActions(false);
      }
    });
  };

  const ideContent = (
    <>
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileSelect} 
        className="hidden" 
      />

      {/* Sidebar / Explorer */}
      <div className="w-64 bg-slate-50 border-r border-slate-200 flex flex-col shrink-0 transition-colors duration-300">
         
         {/* Sidebar Header & Search */}
         <div className="h-14 px-3 flex flex-col justify-center border-b border-slate-200 bg-slate-50 gap-2">
             <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                    SDLC Explorer
                </span>
                {!readOnly && (
                  <button 
                      onClick={() => fileInputRef.current?.click()} 
                      className={`hover:text-primary transition-colors p-1 rounded hover:bg-slate-200 ${isUploading ? 'animate-pulse text-primary' : ''}`} 
                      title="Upload File"
                      disabled={isUploading}
                  >
                      {isUploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
                  </button>
                )}
             </div>
             
             {/* File Search Input */}
             <div className="relative">
                <Search size={12} className="absolute left-2 top-1.5 text-slate-400" />
                <input 
                    type="text" 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search files..."
                    className="w-full bg-white border border-slate-200 rounded pl-7 pr-2 py-1 text-[10px] focus:outline-none focus:border-primary placeholder-slate-300"
                />
             </div>
         </div>

         {/* File Tree */}
         <div className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar p-2">
            {renderFolder('00_Stakeholder_Needs', fileSystem['00_Stakeholder_Needs'], 'text-teal-400')}
            {renderFolder('01_System_Requirements', fileSystem['01_System_Requirements'], 'text-orange-400')}
            {renderFolder('02_Architecture_Design', fileSystem['02_Architecture_Design'], 'text-purple-400')}
            {renderFolder('03_Test_Planning', fileSystem['03_Test_Planning'], 'text-indigo-400')}
            {renderFolder('04_Implementation_Source', fileSystem['04_Implementation_Source'], 'text-blue-500')}
            {renderFolder('04_Assets_Media', fileSystem['04_Assets_Media'], 'text-pink-400')}
            {renderFolder('05_Integration_Builds', fileSystem['05_Integration_Builds'], 'text-cyan-500')}
            {renderFolder('06_Verification_Reports', fileSystem['06_Verification_Reports'], 'text-green-500')}
            {renderFolder('99_MCP_Tools', fileSystem['99_MCP_Tools'], 'text-success')}
            {renderFolder('99_Uncategorized', fileSystem['99_Uncategorized'], 'text-slate-400')}
            
            {artifacts.length === 0 && (
                <div className="text-center p-4 text-slate-400 text-xs italic">
                    Workspace Empty
                </div>
            )}
         </div>

         {/* Sidebar Footer: Export Actions - Protected by export_code flag */}
         {shouldShowFeature(canExportCode) && (
            <div className="p-3 border-t border-slate-200 bg-slate-50">
                <button 
                    onClick={handleDownloadZip} 
                    disabled={isZipping || artifacts.length === 0}
                    className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:text-primary hover:border-primary transition-colors disabled:opacity-50 shadow-sm"
                >
                    {isZipping ? <Loader2 size={14} className="animate-spin" /> : <Archive size={14} />}
                    {isZipping ? 'Zipping...' : 'Export Project (ZIP)'}
                </button>
            </div>
         )}
      </div>

      {/* Main Editor Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-white">
        
        {/* Editor Tabs / Header */}
        <div className="flex flex-col bg-slate-50 border-b border-slate-200">
          {/* Tabs Bar */}
          <div className="h-9 flex items-center overflow-x-auto custom-scrollbar">
            <div className="flex items-center gap-0.5 min-w-full">
              {openTabs.map(tabId => {
                const tabArtifact = artifacts.find(a => a.id === tabId);
                if (!tabArtifact) return null;
                const isActive = activeArtifactId === tabId;
                const fileName = constructFileName(tabArtifact);
                
                return (
                  <div
                    key={tabId}
                    onClick={() => setActiveArtifactId(tabId)}
                    className={`flex items-center gap-2 px-3 py-1.5 text-xs text-slate-700 min-w-[120px] max-w-[200px] cursor-pointer border-r border-slate-200 group/tab transition-colors ${
                      isActive 
                        ? 'bg-white border-t-2 border-t-primary shadow-sm' 
                        : 'bg-slate-100 hover:bg-slate-200'
                    }`}
                  >
                    <FileIcon type={tabArtifact.type} title={tabArtifact.title} />
                    <span className="truncate flex-1 font-medium">{fileName}</span>
                    {isDirty[tabId] && <div className="w-1.5 h-1.5 rounded-full bg-warning shrink-0"></div>}
                    <button
                      onClick={(e) => closeTab(tabId, e)}
                      className="opacity-0 group-hover/tab:opacity-100 hover:bg-slate-300 rounded p-0.5 transition-opacity shrink-0"
                      title="Close tab"
                    >
                      <X size={12} />
                    </button>
                  </div>
                );
              })}
              {openTabs.length === 0 && (
                <div className="px-3 text-[10px] text-slate-400 uppercase font-bold">No files open</div>
              )}
            </div>
          </div>

          {/* Toolbar */}
          {activeArtifact && (
            <div className="h-8 flex items-center justify-between px-2 border-t border-slate-200 bg-white">
              <div className="flex items-center gap-1">
                {/* Find & Replace Button */}
                <button 
                  onClick={() => setShowFindReplace(!showFindReplace)}
                  className={`p-1.5 rounded transition-colors ${showFindReplace ? 'bg-primary/10 text-primary' : 'text-slate-400 hover:bg-slate-200 hover:text-slate-600'}`}
                  title="Find & Replace (Cmd/Ctrl + F)"
                >
                  <Search size={14} />
                </button>
                
                {/* Codebase Search Button */}
                <button 
                  onClick={() => setShowSearch(true)}
                  className="p-1.5 hover:bg-slate-200 rounded text-slate-400 hover:text-primary transition-colors"
                  title="Search Codebase (Cmd/Ctrl + K)"
                >
                  <Search size={14} />
                </button>
                
                <div className="w-px h-4 bg-slate-300 mx-1"></div>
                
                {/* Split View */}
                <button 
                  onClick={() => {
                    if (!splitView && activeArtifactId) {
                      setSplitView(true);
                      setSplitArtifactId(activeArtifactId);
                      setSplitContent(content);
                    } else {
                      setSplitView(false);
                      setSplitArtifactId(null);
                    }
                  }}
                  className={`p-1.5 rounded transition-colors ${splitView ? 'bg-primary/10 text-primary' : 'text-slate-400 hover:bg-slate-200 hover:text-slate-600'}`}
                  title="Split View"
                >
                  <Split size={14} />
                </button>
                
                {/* Word Wrap Toggle */}
                <button 
                  onClick={() => setWordWrap(!wordWrap)}
                  className={`p-1.5 rounded transition-colors ${wordWrap ? 'bg-primary/10 text-primary' : 'text-slate-400 hover:bg-slate-200 hover:text-slate-600'}`}
                  title="Toggle Word Wrap"
                >
                  <WrapText size={14} />
                </button>

                {/* Minimap Toggle */}
                <button 
                  onClick={() => setShowMinimap(!showMinimap)}
                  className={`p-1.5 rounded transition-colors ${showMinimap ? 'bg-primary/10 text-primary' : 'text-slate-400 hover:bg-slate-200 hover:text-slate-600'}`}
                  title="Toggle Minimap"
                >
                  <Minimize size={14} />
                </button>
                
                {/* Maximize functionality removed */}
              </div>
              
              <div className="flex items-center gap-1">
                {/* Save All */}
                {Object.values(isDirty).some(d => d) && (
                  <button
                    onClick={handleSaveAll}
                    className="px-2 py-1 text-[10px] font-bold text-primary hover:bg-primary/10 rounded transition-colors"
                    title="Save All"
                  >
                    Save All
                  </button>
                )}
                
                {/* Copy Button */}
                <button 
                  onClick={handleCopy}
                  className="p-1.5 hover:bg-slate-200 rounded text-slate-400 hover:text-primary transition-colors"
                  title="Copy Content"
                >
                  {copied ? <Check size={14} className="text-success" /> : <Copy size={14} />}
                </button>
                
                {/* Download Button */}
                <button 
                  onClick={handleDownloadFile}
                  className="p-1.5 hover:bg-slate-200 rounded text-slate-400 hover:text-primary transition-colors"
                  title="Download File"
                >
                  <Download size={14} />
                </button>
                
                {/* Terminal Toggle */}
                <button 
                  onClick={() => setShowTerminal(!showTerminal)}
                  className={`p-1.5 rounded transition-colors ${showTerminal ? 'bg-primary/10 text-primary' : 'text-slate-400 hover:bg-slate-200 hover:text-slate-600'}`}
                  title="Toggle Terminal (Cmd/Ctrl + `)"
                >
                  <Terminal size={14} />
                </button>
              </div>
            </div>
          )}
          
          {/* Find & Replace Bar */}
          {showFindReplace && activeArtifact && (
            <div className="h-10 flex items-center gap-2 px-3 bg-slate-100 border-t border-slate-200">
              <div className="flex items-center gap-2 flex-1">
                <input
                  type="text"
                  value={findQuery}
                  onChange={(e) => {
                    setFindQuery(e.target.value);
                    performFind(e.target.value, content);
                  }}
                  placeholder="Find..."
                  className="flex-1 px-2 py-1 text-xs border border-slate-300 rounded focus:outline-none focus:border-primary bg-white"
                  autoFocus
                />
                <input
                  type="text"
                  value={replaceQuery}
                  onChange={(e) => setReplaceQuery(e.target.value)}
                  placeholder="Replace..."
                  className="flex-1 px-2 py-1 text-xs border border-slate-300 rounded focus:outline-none focus:border-primary bg-white"
                />
                <button
                  onClick={() => setUseRegex(!useRegex)}
                  className={`px-2 py-1 text-[10px] rounded transition-colors ${useRegex ? 'bg-primary text-white' : 'bg-white border border-slate-300'}`}
                  title="Use Regex"
                >
                  <Regex size={12} />
                </button>
                <button
                  onClick={() => setMatchCase(!matchCase)}
                  className={`px-2 py-1 text-[10px] rounded transition-colors ${matchCase ? 'bg-primary text-white' : 'bg-white border border-slate-300'}`}
                  title="Match Case"
                >
                  Aa
                </button>
                {findResults.length > 0 && (
                  <span className="text-[10px] text-slate-500">
                    {findResults.length} matches
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={performReplace}
                  className="px-2 py-1 text-[10px] bg-primary text-white rounded hover:bg-blue-600 transition-colors"
                  title="Replace"
                >
                  <Replace size={12} />
                </button>
                <button
                  onClick={() => setShowFindReplace(false)}
                  className="p-1 hover:bg-slate-200 rounded"
                >
                  <X size={12} />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Editor Surface */}
        {activeArtifact ? (
           <div className="flex-1 relative flex overflow-hidden">
              {activeArtifact.type === 'notebook' ? (
                 // Notebook Viewer Mode
                 <div className="flex-1 h-full">
                   <NotebookViewer 
                     artifact={activeArtifact}
                     onSave={(cells) => {
                       if (onSave) {
                         onSave(activeArtifact.id, JSON.stringify(cells));
                       }
                     }}
                     readOnly={readOnly}
                   />
                 </div>
              ) : ['image', 'audio', 'video'].includes(activeArtifact.type) ? (
                 // Media Preview Mode
                 <div className="absolute inset-0 flex items-center justify-center bg-slate-100 p-8">
                     <div className="flex flex-col items-center max-w-lg w-full">
                         <div className="p-2 bg-white border border-slate-200 rounded-lg shadow-xl mb-4 w-full flex items-center justify-center">
                            {activeArtifact.type === 'image' && (
                                <img 
                                    src={`data:image/png;base64,${content}`} 
                                    alt={activeArtifact.title} 
                                    className="max-w-full max-h-[500px] object-contain rounded" 
                                />
                            )}
                            {activeArtifact.type === 'audio' && (
                                <audio controls src={`data:audio/mp3;base64,${content}`} className="w-full" />
                            )}
                            {activeArtifact.type === 'video' && (
                                <video controls src={`data:video/mp4;base64,${content}`} className="w-full rounded" />
                            )}
                         </div>
                         <div className="text-xs text-slate-500 font-mono text-center">
                             <p>{activeArtifact.title}</p>
                             <p className="opacity-50 mt-1 uppercase text-[10px]">{activeArtifact.type.toUpperCase()} ASSET</p>
                         </div>
                     </div>
                 </div>
              ) : (
                  // Text Editor Mode
                  <>
                      {/* Line Numbers */}
                      <div className="w-10 bg-slate-50 border-r border-slate-200 flex flex-col items-end py-4 pr-2 select-none text-slate-400 text-[10px] leading-6 shrink-0 z-10 font-mono">
                         {lineNumbers.map(n => <div key={n}>{n}</div>)}
                      </div>

                      {/* Text Area */}
                      <div className="flex-1 relative flex">
                         <div className="flex-1 relative">
                           {/* Monaco Editor replaces textarea */}
                           <Editor
                             height="100%"
                             language={getMonacoLanguage(activeArtifact)}
                             value={content}
                             onChange={handleMonacoChange}
                             onMount={handleEditorDidMount}
                             theme="vs"
                             options={{
                               wordWrap: wordWrap ? 'on' : 'off',
                               minimap: { enabled: showMinimap },
                               fontSize: 13,
                               lineNumbers: 'on',
                               scrollBeyondLastLine: false,
                               automaticLayout: true,
                               readOnly: readOnly,
                               fontFamily: 'Monaco, Menlo, "Courier New", monospace',
                               tabSize: 2,
                               insertSpaces: true,
                               detectIndentation: true,
                               formatOnPaste: true,
                               formatOnType: true,
                               suggestOnTriggerCharacters: true,
                               quickSuggestions: true,
                               acceptSuggestionOnCommitCharacter: true,
                               acceptSuggestionOnEnter: 'on',
                               snippetSuggestions: 'top',
                               wordBasedSuggestions: 'allDocuments',
                               parameterHints: { enabled: true },
                               hover: { enabled: true },
                               links: true,
                               colorDecorators: true,
                               bracketPairColorization: { enabled: true },
                               guides: { bracketPairs: true, indentation: true },
                               renderWhitespace: 'selection',
                               renderLineHighlight: 'all',
                               cursorBlinking: 'blink',
                               cursorSmoothCaretAnimation: 'on',
                               smoothScrolling: true,
                               mouseWheelZoom: true,
                               multiCursorModifier: 'ctrlCmd',
                               accessibilitySupport: 'auto',
                             }}
                           />
                           
                           {/* Syntax Highlighting Overlay (Simple) - Only for code files */}
                           {activeArtifact?.type === 'code' && (
                             <div 
                               className="absolute inset-0 pointer-events-none p-4 leading-6 font-mono text-[13px] overflow-hidden custom-scrollbar"
                               style={{ 
                                 whiteSpace: wordWrap ? 'pre-wrap' : 'pre',
                                 color: 'transparent'
                               }}
                             >
                               {content.split('\n').map((line, idx) => {
                                 // Simple syntax highlighting for common patterns
                                 const highlighted = line
                                   .replace(/(\/\/.*)/g, '<span style="color: #94a3b8;">$1</span>')
                                   .replace(/(["'`])(?:(?=(\\?))\2.)*?\1/g, '<span style="color: #10b981;">$&</span>')
                                   .replace(/\b(function|const|let|var|class|interface|type|import|export|return|if|else|for|while|async|await|try|catch|finally)\b/g, '<span style="color: #2563eb; font-weight: 600;">$1</span>')
                                   .replace(/\b(true|false|null|undefined)\b/g, '<span style="color: #9333ea;">$1</span>')
                                   .replace(/\b(\d+\.?\d*)\b/g, '<span style="color: #f97316;">$1</span>');
                                 
                                 return (
                                   <div key={idx} dangerouslySetInnerHTML={{ __html: highlighted || '&nbsp;' }} />
                                 );
                               })}
                             </div>
                           )}
                         </div>
                         
                         {/* Minimap */}
                         {showMinimap && lines.length > 50 && (
                           <div className="w-16 border-l border-slate-200 bg-slate-50 overflow-y-auto custom-scrollbar shrink-0">
                             <div className="p-1 space-y-0.5">
                               {lines.map((line, idx) => {
                                 const hasContent = line.trim().length > 0;
                                 const height = Math.max(1, Math.min(3, Math.floor(line.length / 20)));
                                 return (
                                   <div
                                     key={idx}
                                     className={`text-[2px] leading-[2px] font-mono ${
                                       hasContent ? 'text-slate-600' : 'text-slate-300'
                                     }`}
                                     style={{ height: `${height}px` }}
                                   >
                                     {line.substring(0, 20)}
                                   </div>
                                 );
                               })}
                             </div>
                           </div>
                         )}
                         
                         {/* Autocomplete Suggestions */}
                         {showSuggestions && autocompleteSuggestions.length > 0 && !readOnly && (
                           <div className="absolute bg-white border border-slate-200 rounded-lg shadow-xl z-50 max-h-48 overflow-y-auto" 
                                style={{ 
                                  top: `${Math.min((cursorPosition - content.substring(0, cursorPosition).split('\n').length) * 20 + 40, window.innerHeight - 200)}px`,
                                  left: '20px',
                                  minWidth: '300px'
                                }}>
                             {autocompleteSuggestions.map((suggestion, index) => (
                               <div
                                 key={index}
                                 onClick={() => acceptSuggestion(index)}
                                 className={`px-3 py-2 cursor-pointer border-b border-slate-100 last:border-b-0 hover:bg-primary/5 ${
                                   index === selectedSuggestionIndex ? 'bg-primary/10' : ''
                                 }`}
                               >
                                 <div className="flex items-center gap-2">
                                   <Sparkles size={12} className="text-primary" />
                                   <code className="text-xs font-mono text-slate-700">
                                     {suggestion.displayText || suggestion.text}
                                   </code>
                                 </div>
                                 <div className="text-[10px] text-slate-400 mt-1">
                                   Press Tab to accept
                                 </div>
                               </div>
                             ))}
                           </div>
                         )}
                         
                         {/* Code Actions (when code is selected) */}
                         {showCodeActions && selectedCode && !readOnly && (
                           <div className="absolute bg-white border border-slate-200 rounded-lg shadow-xl z-50 p-2 flex gap-2"
                                style={{ 
                                  top: '10px',
                                  right: '10px'
                                }}>
                             <button
                               onClick={handleExplainCode}
                               className="px-3 py-1.5 text-xs bg-slate-100 hover:bg-primary/10 hover:text-primary rounded flex items-center gap-2 transition-colors"
                               title="Explain Code (Cmd/Ctrl + /)"
                             >
                               <MessageSquare size={12} />
                               Explain
                             </button>
                             <button
                               onClick={handleRefactorCode}
                               className="px-3 py-1.5 text-xs bg-slate-100 hover:bg-primary/10 hover:text-primary rounded flex items-center gap-2 transition-colors"
                               title="Refactor Code"
                             >
                               <Wand2 size={12} />
                               Refactor
                             </button>
                           </div>
                         )}
                      </div>

                      {/* Save FAB */}
                      {activeArtifactId && isDirty[activeArtifactId] && !readOnly && (
                         <button 
                            onClick={handleSave}
                            className="absolute bottom-6 right-6 bg-primary text-white p-3 rounded-full shadow-lg hover:bg-blue-600 transition-all z-20 animate-bounce"
                            title="Save (Ctrl+S)"
                         >
                            <Save size={20} />
                         </button>
                      )}
                  </>
              )}
           </div>
        ) : (
           <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
               <div className="w-16 h-16 rounded-xl bg-slate-100 flex items-center justify-center mb-4">
                  <Command size={32} />
               </div>
               <p className="text-xs font-mono text-slate-500">Select a file to start editing</p>
               <p className="text-[10px] mt-2 text-slate-400">SDLC Orchestra IDE v1.2</p>
           </div>
        )}

        {/* Status Bar */}
        <div className="h-6 bg-slate-50 border-t border-slate-200 flex items-center justify-between px-3 text-[10px] text-slate-500 font-mono select-none">
           <div className="flex items-center gap-4">
              <span className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-primary/50"></div> MASTER</span>
              {!['image', 'audio', 'video'].includes(activeArtifact?.type || '') && <span>{lines.length} LINES</span>}
              <span>{['image', 'audio', 'video'].includes(activeArtifact?.type || '') ? 'BINARY' : 'UTF-8'}</span>
              {activeArtifact && isDirty[activeArtifact.id] && <span className="text-warning">● UNSAVED</span>}
           </div>
           <div className="flex items-center gap-4">
              {activeArtifact && (
                  <>
                    <span className="uppercase">{activeArtifact.type}</span>
                    <span>{getFileExtension(activeArtifact.type, activeArtifact.title).replace('.', '').toUpperCase() || 'TXT'}</span>
                    {findResults.length > 0 && <span>{findResults.length} MATCHES</span>}
                  </>
              )}
           </div>
        </div>
        
        {/* Terminal Panel */}
        {showTerminal && (
          <div 
            className="border-t border-slate-300 bg-slate-900 text-green-400 font-mono text-xs flex flex-col"
            style={{ height: `${terminalHeight}px` }}
          >
            <div className="h-6 bg-slate-800 border-b border-slate-700 flex items-center justify-between px-2">
              <div className="flex items-center gap-2">
                <Terminal size={12} className="text-green-400" />
                <span className="text-[10px] font-bold text-slate-300 uppercase">Terminal</span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setTerminalHeight(prev => prev === 200 ? 400 : prev === 400 ? 600 : 200)}
                  className="p-1 hover:bg-slate-700 rounded text-slate-400"
                  title="Resize terminal"
                >
                  {terminalHeight >= 400 ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
                </button>
                <button
                  onClick={() => setShowTerminal(false)}
                  className="p-1 hover:bg-slate-700 rounded text-slate-400"
                >
                  <X size={12} />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-2 custom-scrollbar" style={{ maxHeight: `${terminalHeight - 24}px` }}>
              {terminalOutput.length === 0 ? (
                <div className="text-slate-500 text-[10px]">
                  Terminal ready. Type 'help' for available commands.
                </div>
              ) : (
                terminalOutput.map((line, idx) => (
                  <div key={idx} className="mb-0.5">
                    {line}
                  </div>
                ))
              )}
            </div>
            <div className="h-8 border-t border-slate-700 flex items-center px-2">
              <span className="text-green-400 mr-2">$</span>
              <input
                ref={terminalInputRef}
                type="text"
                value={terminalInput}
                onChange={(e) => setTerminalInput(e.target.value)}
                onKeyDown={handleTerminalKeyDown}
                onFocus={() => setIsTerminalFocused(true)}
                onBlur={() => setIsTerminalFocused(false)}
                className="flex-1 bg-transparent text-green-400 outline-none"
                placeholder="Enter command..."
              />
            </div>
          </div>
        )}
      </div>

      {/* Codebase Search Modal */}
      {showSearch && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center pt-20" onClick={() => setShowSearch(false)}>
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-2xl max-h-[600px] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Search size={16} className="text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    if (e.target.value.trim()) {
                      searchCodebase(artifacts, { query: e.target.value, type: 'all', limit: 20 })
                        .then(setSearchResults)
                        .catch(console.error);
                    } else {
                      setSearchResults([]);
                    }
                  }}
                  placeholder="Search codebase... (symbols, files, code)"
                  className="flex-1 outline-none text-sm"
                  autoFocus
                />
              </div>
              <button
                onClick={() => setShowSearch(false)}
                className="p-1 hover:bg-slate-100 rounded"
              >
                <X size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {searchResults.length === 0 && searchQuery ? (
                <div className="text-center text-slate-400 py-8">No results found</div>
              ) : searchResults.length > 0 ? (
                <div className="space-y-2">
                  {searchResults.map((result, index) => (
                    <div
                      key={index}
                      onClick={() => {
                        const artifact = artifacts.find(a => a.title === result.file.path);
                        if (artifact) {
                          setActiveArtifactId(artifact.id);
                          setShowSearch(false);
                        }
                      }}
                      className="p-3 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <FileCode size={14} className="text-blue-500" />
                        <span className="font-mono text-sm font-bold">{result.file.path}</span>
                      </div>
                      {result.symbols.length > 0 && (
                        <div className="text-xs text-slate-500 mt-1">
                          {result.symbols.map(s => s.name).join(', ', 'error')}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-slate-400 py-8">
                  Start typing to search...
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );

  // Maximize/fullscreen mode removed
  
  // Normal mode
  return (
    <div className="flex h-full bg-white text-slate-800 font-mono text-sm relative group overflow-hidden transition-colors duration-300">
      {ideContent}
    </div>
  );
};

export default CodeEditor;