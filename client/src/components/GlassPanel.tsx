import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Idea } from './OrbGraph';
import { Globe, WifiOff, ShieldCheck, CheckSquare, MessageSquare, Database, User, Bot, Users, ArrowDown, X, ChevronRight } from 'lucide-react';
import { QUALITY_STANDARDS } from '@orbitai/shared';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ChatMessage } from '@orbitai/shared';
import ScopeSelector, { ProjectScope } from './ScopeSelector';
import EnhancedChatMessage from './EnhancedChatMessage';

interface GlassPanelProps {
  topic: string;
  ideas: Idea[];
  activeIdeaId: string | null;
  keyInsights: string[];
  nextSteps: string[];
  onIdeaClick?: (ideaId: string) => void;
  messages?: ChatMessage[];
  showChatHistory?: boolean;
  onToggleChatHistory?: () => void;
  useInternet?: boolean;
  onToggleInternet?: () => void;
  selectedStandards?: string[];
  onToggleStandard?: (id: string) => void;
  readyCheck?: {
    canProceed: boolean;
    reason?: string;
    score?: number;
    breakdown?: {
      clarity: number;
      feasibility: number;
      completeness: number;
      standards: number;
      research: number;
    }
  };
  onReadyToGo?: () => void;
  isGeneratingPreview?: boolean;
  isProcessing?: boolean;
  generationProgress?: number;
  onDeepResearch?: (query: string) => void;
  onSendMessage?: (message: string) => void;
  prototypingStage?: 'ideation' | 'prototyping';
  onRegeneratePrototype?: () => void;
  activeView?: 'context' | 'history' | 'maturity';
  onActiveViewChange?: (view: 'context' | 'history' | 'maturity') => void;
  setInput?: (input: string) => void; // Input field setter for research
  onIdeaUpdate?: (ideaId: string, updates: Partial<Idea>) => void; // Update idea (description, notes, etc.)
  onGenerateRelatedIdeas?: () => void; // Generate related ideas across all ideas
  onIdeaRefinement?: (ideaId: string) => void; // Refine a specific idea
  onGapAnalysis?: () => void; // Identify missing aspects
  onCrossPollination?: () => void; // Combine ideas from different branches
  onLaunchProject?: () => void; // Launch project (proceed to workspace)
  onGetAgentsInvolved?: () => Promise<void>; // Get agents involved in brainstorming
  isGettingAgentsInvolved?: boolean; // Loading state for agent involvement
  activeAgents?: Array<{ id: string; name: string; role: string }>; // Active agents in conversation
  loadingStatusText?: string; // Text to display during loading (e.g. generating prototype stages)
  hasBrainstormed?: boolean;
  onClose?: () => void; // Handler to hide the panel
  // Deepen Ideas
  onDeepenIdeas?: () => void;
  deepenLevel?: number; // 0 = not used, 1 = X1, 2 = X2 (max)
  isDeepeningIdeas?: boolean;
  deepeningProgress?: number;
  hasIdeas?: boolean;
  // Project Scope (prevent overengineering)
  projectScope?: ProjectScope;
  scopeAutoDetected?: boolean;
  scopeConfidence?: number;
  scopeReasoning?: string;
  onScopeChange?: (scope: ProjectScope) => void;
}

// Category color mapping for inline styles
const getCategoryColorHex = (category?: string): string => {
  const colors: Record<string, string> = {
    feature: '#22C55E',    // green
    technology: '#6366F1', // indigo
    ux: '#EC4899',         // pink
    data: '#06B6D4',       // cyan
    business: '#F97316',   // orange
    community: '#8B5CF6',  // purple
    platform: '#EAB308',   // yellow
    risk: '#EF4444',       // red
    opportunity: '#10B981',// emerald
    constraint: '#F59E0B', // amber
    requirement: '#3B82F6',// blue
    improvement: '#14B8A6',// teal
    idea: '#6366F1',       // indigo
    other: '#6B7280',      // gray
  };
  return colors[category || 'idea'] || colors.idea;
};

// Helper to strip XML tags from message text for display
// This removes orphaned closing tags, full idea blocks, and any other XML artifacts
// BUT preserves content inside markdown code blocks (```...```)
const stripXmlTags = (text: string): string => {
  if (!text) return '';

  // First, extract and preserve all code blocks
  const codeBlockRegex = /```[\s\S]*?```/g;
  const codeBlocks: string[] = [];
  let textWithPlaceholders = text.replace(codeBlockRegex, (match) => {
    codeBlocks.push(match);
    return `__CODE_BLOCK_${codeBlocks.length - 1}__`;
  });

  // Apply XML stripping only to non-code-block parts
  textWithPlaceholders = textWithPlaceholders
    // Remove complete <idea>...</idea> blocks (including nested and with attributes)
    .replace(/<idea[^>]*>[\s\S]*?<\/idea>/gi, '')
    // Remove orphaned closing tags
    .replace(/<\/[a-z]+>/gi, '')
    // Remove orphaned opening tags with or without attributes
    .replace(/<[a-z]+[^>]*>/gi, '')
    // Remove legacy [[IDEA:...:...]] tags
    .replace(/\[\[\s*IDEA\s*:\s*.*?\s*:\s*.*?\s*\]\]/gi, '')
    // Clean up excessive whitespace
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  // Restore code blocks
  textWithPlaceholders = textWithPlaceholders.replace(/__CODE_BLOCK_(\d+)__/g, (_, index) => {
    return codeBlocks[parseInt(index)] || '';
  });

  return textWithPlaceholders;
};

const GlassPanel: React.FC<GlassPanelProps> = ({
  topic,
  ideas,
  activeIdeaId,
  keyInsights,
  nextSteps,
  onIdeaClick,
  useInternet = false,
  onToggleInternet,
  selectedStandards = [],
  onToggleStandard,
  messages = [],
  showChatHistory = false,
  onToggleChatHistory,
  readyCheck,
  onReadyToGo,
  isGeneratingPreview = false,
  isProcessing = false,
  generationProgress = 0,
  onDeepResearch,
  onSendMessage,
  prototypingStage = 'ideation',
  onRegeneratePrototype,
  activeView: activeViewProp = 'context',
  onActiveViewChange,
  setInput,
  onIdeaUpdate,
  onGenerateRelatedIdeas,
  onIdeaRefinement,
  onGapAnalysis,
  onCrossPollination,
  onLaunchProject,
  onGetAgentsInvolved,
  isGettingAgentsInvolved = false,
  activeAgents = [],
  hasBrainstormed,
  loadingStatusText = "Generating Prototype...",
  onClose,
  onDeepenIdeas,
  deepenLevel = 0,
  isDeepeningIdeas = false,
  deepeningProgress = 0,
  hasIdeas = false,
  // Project Scope
  projectScope = 'standard',
  scopeAutoDetected = true,
  scopeConfidence,
  scopeReasoning,
  onScopeChange
}) => {
  const [editingIdeaId, setEditingIdeaId] = useState<string | null>(null);
  const [editDescription, setEditDescription] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['focus', 'insights', 'ideas']));
  const [searchQuery, setSearchQuery] = useState('');
  const [showStandards, setShowStandards] = useState(false);
  const [ideaFilter, setIdeaFilter] = useState<'all' | 'feature' | 'constraint' | 'opportunity' | 'risk' | 'requirement' | 'improvement' | 'idea' | 'other'>('all');
  const [priorityFilter, setPriorityFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all');
  const [selectedIdeaIdsForBulk, setSelectedIdeaIdsForBulk] = useState<Set<string>>(new Set());
  // Use internal state only if prop is not provided (for backward compatibility)
  const [internalActiveView, setInternalActiveView] = useState<'context' | 'history' | 'maturity'>('context');
  const activeView = activeViewProp !== undefined ? activeViewProp : internalActiveView;
  const setActiveView = onActiveViewChange || setInternalActiveView;
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Resizable panel state
  const [panelWidth, setPanelWidth] = useState<number>(() => {
    const saved = localStorage.getItem('glassPanelWidth');
    return saved ? parseInt(saved, 10) : (prototypingStage === 'prototyping' ? 480 : 320);
  });
  const [isResizing, setIsResizing] = useState(false);
  const resizeRef = useRef<HTMLDivElement>(null);

  // Save width to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('glassPanelWidth', panelWidth.toString());
  }, [panelWidth]);

  // Resize handler - only enabled in ideation phase (step 1)
  useEffect(() => {
    if (!isResizing || prototypingStage !== 'ideation') return;

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = window.innerWidth - e.clientX;
      const minWidth = 280;
      const maxWidth = Math.min(800, window.innerWidth * 0.6);
      setPanelWidth(Math.max(minWidth, Math.min(maxWidth, newWidth)));
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, prototypingStage]);

  // Update width when prototyping stage changes (but respect user's saved width)
  useEffect(() => {
    const saved = localStorage.getItem('glassPanelWidth');
    if (!saved) {
      setPanelWidth(prototypingStage === 'prototyping' ? 480 : 320);
    }
  }, [prototypingStage]);

  // Find active idea details if any
  const activeIdea = ideas.find(i => i.id === activeIdeaId);

  // Calculate statistics
  const stats = useMemo(() => {
    const realIdeas = ideas.filter(i => i.id !== 'welcome-bubble');
    const topLevelIdeas = realIdeas.filter(i => !i.parentId || i.parentId === 'CENTER');
    const subIdeas = realIdeas.filter(i => i.parentId && i.parentId !== 'CENTER');
    const ideaRelationships = realIdeas.reduce((acc, idea) => {
      if (idea.parentId) {
        acc[idea.parentId] = (acc[idea.parentId] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);

    // Category breakdown
    const byCategory = realIdeas.reduce((acc, idea) => {
      const cat = idea.category || 'idea';
      acc[cat] = (acc[cat] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Priority breakdown
    const highPriority = realIdeas.filter(i => i.priority && i.priority >= 4).length;
    const mediumPriority = realIdeas.filter(i => i.priority === 3).length;
    const lowPriority = realIdeas.filter(i => !i.priority || i.priority <= 2).length;

    return {
      total: realIdeas.length,
      topLevel: topLevelIdeas.length,
      subIdeas: subIdeas.length,
      relationships: ideaRelationships,
      byCategory,
      highPriority,
      mediumPriority,
      lowPriority
    };
  }, [ideas]);

  // Filter ideas based on search - also search topic, insights, next steps, notes, and tags
  const filteredIdeas = useMemo(() => {
    if (!searchQuery.trim()) return ideas;
    const query = searchQuery.toLowerCase();
    return ideas.filter(idea =>
      idea.label.toLowerCase().includes(query) ||
      idea.description?.toLowerCase().includes(query) ||
      idea.notes?.toLowerCase().includes(query) ||
      idea.tags?.some(tag => tag.toLowerCase().includes(query)) ||
      idea.category?.toLowerCase().includes(query)
    );
  }, [ideas, searchQuery]);

  // Check if search matches topic, insights, or next steps
  const searchMatches = useMemo(() => {
    if (!searchQuery.trim()) return { topic: false, insights: false, nextSteps: false, ideas: false };
    const query = searchQuery.toLowerCase();
    return {
      topic: topic && topic.toLowerCase().includes(query),
      insights: keyInsights.some(insight => insight.toLowerCase().includes(query)),
      nextSteps: nextSteps.some(step => step.toLowerCase().includes(query)),
      ideas: filteredIdeas.length > 0
    };
  }, [searchQuery, topic, keyInsights, nextSteps, filteredIdeas]);

  // Scroll to bottom function
  const scrollToBottom = useCallback(() => {
    if (scrollContainerRef.current) {
      const scrollContainer = scrollContainerRef.current;
      scrollContainer.scrollTop = scrollContainer.scrollHeight;
    }
  }, []);

  // Auto-scroll chat history to bottom when messages change or view switches to history
  useEffect(() => {
    if (activeView === 'history' && scrollContainerRef.current) {
      // Use the last message ID or timestamp to detect actual message changes
      const lastMessageId = messages.length > 0 ? messages[messages.length - 1].id : null;

      // Use requestAnimationFrame to ensure DOM has updated
      requestAnimationFrame(() => {
        scrollToBottom();
        // Double-check after delays to handle async rendering (e.g., markdown rendering)
        setTimeout(scrollToBottom, 100);
        setTimeout(scrollToBottom, 300); // Additional delay for markdown rendering
      });
    }
  }, [messages, activeView, scrollToBottom]); // Changed from messages.length to messages to detect actual changes

  // Auto-expand sections when new data arrives (including when loading old conversations)
  // Also auto-expand sections when search matches them
  useEffect(() => {
    const newSections = new Set(expandedSections);
    let hasChanges = false;

    if (ideas.length > 0 && !newSections.has('ideas')) {
      newSections.add('ideas');
      hasChanges = true;
    }
    if (keyInsights.length > 0 && !newSections.has('insights')) {
      newSections.add('insights');
      hasChanges = true;
    }
    if (nextSteps.length > 0 && !newSections.has('nextSteps')) {
      newSections.add('nextSteps');
      hasChanges = true;
    }
    // Expand focus if we have a valid topic (not empty or welcome message)
    const hasValidTopic = topic && topic.trim() &&
      !topic.toLowerCase().includes('start crafting your idea') &&
      !topic.toLowerCase().includes('your project starts here');
    if (hasValidTopic && !newSections.has('focus')) {
      newSections.add('focus');
      hasChanges = true;
    }

    // Auto-expand sections when search matches them
    if (searchQuery.trim()) {
      if (searchMatches.topic && !newSections.has('focus')) {
        newSections.add('focus');
        hasChanges = true;
      }
      if (searchMatches.insights && !newSections.has('insights')) {
        newSections.add('insights');
        hasChanges = true;
      }
      if (searchMatches.nextSteps && !newSections.has('nextSteps')) {
        newSections.add('nextSteps');
        hasChanges = true;
      }
      if (searchMatches.ideas && !newSections.has('ideas')) {
        newSections.add('ideas');
        hasChanges = true;
      }
    }

    if (hasChanges) {
      setExpandedSections(newSections);
    }
  }, [ideas.length, keyInsights.length, nextSteps.length, topic, expandedSections, searchQuery, searchMatches]);

  // Group ideas by parent (use filtered ideas if search is active)
  const ideaGroups = useMemo(() => {
    const groups: Record<string, Idea[]> = {};
    const topLevel: Idea[] = [];
    const query = searchQuery.toLowerCase().trim();

    if (query) {
      // Search mode: find matching ideas and include their relationships
      const matchingIds = new Set<string>();

      // Find all ideas that match the search
      ideas.forEach(idea => {
        if (idea.id === 'welcome-bubble') return;
        const matches = idea.label.toLowerCase().includes(query) ||
          idea.description?.toLowerCase().includes(query);
        if (matches) {
          matchingIds.add(idea.id);
          // Also include parent if this is a child
          if (idea.parentId && idea.parentId !== 'CENTER') {
            matchingIds.add(idea.parentId);
          }
          // Also include all children if this is a parent
          ideas.forEach(child => {
            if (child.parentId === idea.id) {
              matchingIds.add(child.id);
            }
          });
        }
      });

      // Group matching ideas
      ideas.forEach(idea => {
        if (idea.id === 'welcome-bubble') return;
        if (!matchingIds.has(idea.id)) return;

        if (!idea.parentId || idea.parentId === 'CENTER') {
          topLevel.push(idea);
        } else {
          if (!groups[idea.parentId]) {
            groups[idea.parentId] = [];
          }
          groups[idea.parentId].push(idea);
        }
      });
    } else {
      // Normal mode: group all ideas
      ideas.forEach(idea => {
        if (idea.id === 'welcome-bubble') return;
        if (!idea.parentId || idea.parentId === 'CENTER') {
          topLevel.push(idea);
        } else {
          if (!groups[idea.parentId]) {
            groups[idea.parentId] = [];
          }
          groups[idea.parentId].push(idea);
        }
      });
    }

    return { topLevel, groups };
  }, [ideas, searchQuery]);

  const toggleSection = (section: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  // Helper function to highlight search matches in text
  const highlightSearchMatch = (text: string, query: string) => {
    if (!query.trim()) return text;
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);
    return (
      <>
        {parts.map((part, i) =>
          regex.test(part) ? (
            <mark key={i} className="bg-yellow-200 text-yellow-900 px-0.5 rounded">{part}</mark>
          ) : (
            <span key={i}>{part}</span>
          )
        )}
      </>
    );
  };


  return (
    <div
      className="backdrop-blur-xl bg-white/40 border border-white/60 rounded-xl shadow-2xl flex flex-col text-slate-800 transition-all duration-300 h-full relative"
      style={{ width: prototypingStage === 'prototyping' ? '100%' : `${panelWidth}px` }}
    >
      {/* Resize Handle - Only shown in ideation phase (step 1) */}
      {prototypingStage === 'ideation' && (
        <div
          ref={resizeRef}
          onMouseDown={(e) => {
            e.preventDefault();
            setIsResizing(true);
          }}
          className={`absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/30 transition-colors ${isResizing ? 'bg-primary/50' : 'bg-transparent'
            }`}
          style={{ zIndex: 10 }}
        >
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-0.5 h-8 bg-slate-400 rounded-full opacity-0 hover:opacity-100 transition-opacity" />
        </div>
      )}

      {/* Header with View Toggle - Always Visible */}
      <div className="shrink-0 p-2 border-b border-slate-300/30 flex flex-col gap-1">
        {/* Top Header Row with Title and Close Button */}
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest pl-1">Project Context</h2>
          {onClose && (
            <button
              onClick={onClose}
              className="w-7 h-7 bg-white/80 hover:bg-white flex items-center justify-center rounded-lg shadow-sm border border-slate-200/60 text-slate-400 hover:text-slate-600 transition-all active:scale-95"
              title="Hide Panel"
            >
              <ChevronRight size={16} />
            </button>
          )}
        </div>

        {/* View Toggle Switch */}
        <div className="flex items-center gap-1.5 bg-white/50 rounded-lg p-0.5 border border-white/60">
          <button
            onClick={() => setActiveView('history')}
            className={`flex-1 flex items-center justify-center gap-1 px-1.5 py-1 rounded-md text-[9px] font-bold uppercase tracking-wider transition-all ${activeView === 'history'
              ? 'bg-primary text-white shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
              }`}
          >
            <MessageSquare size={12} />
            <span>History</span>
            {messages.length > 0 && (
              <span className={`text-[9px] px-1 py-0.5 rounded-full ${activeView === 'history' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-600'
                }`}>
                {messages.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveView('context')}
            className={`flex-1 flex items-center justify-center gap-1 px-1.5 py-1 rounded-md text-[9px] font-bold uppercase tracking-wider transition-all ${activeView === 'context'
              ? 'bg-primary text-white shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
              }`}
          >
            <Database size={12} />
            <span>Context</span>
          </button>
          <button
            onClick={() => setActiveView('maturity')}
            className={`flex-1 flex items-center justify-center gap-1 px-1.5 py-1 rounded-md text-[9px] font-bold uppercase tracking-wider transition-all ${activeView === 'maturity'
              ? 'bg-primary text-white shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
              }`}
          >
            <CheckSquare size={12} />
            <span>Maturity</span>
          </button>
          {/* Scroll to Bottom Button - Only show in history view when there are messages */}
          {activeView === 'history' && messages.length > 0 && (
            <button
              onClick={() => scrollToBottom()}
              className="p-1.5 text-slate-500 hover:text-slate-700 hover:bg-white/70 rounded-md transition-all"
              title="Scroll to bottom"
            >
              <ArrowDown size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Scrollable Content Area */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1.5 min-h-0">

        {/* Conversation History View */}
        {activeView === 'history' && (
          <div className="space-y-1.5">
            {messages.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                <MessageSquare size={36} className="mx-auto mb-2 opacity-50" />
                <p className="text-xs">No messages yet. Start a conversation!</p>
              </div>
            ) : (
              messages.map((msg) => (
                <EnhancedChatMessage
                  key={msg.id}
                  message={{ ...msg, text: stripXmlTags(msg.text) }}
                  showTimestamp={true}
                />
              ))
            )}
          </div>
        )}

        {/* Session Context View */}
        {activeView === 'context' && (
          <>
            {/* Internet and Standards Controls */}
            <div className="flex items-center justify-center gap-1 flex-wrap mb-1.5">
              {onToggleInternet && (
                <button
                  onClick={onToggleInternet}
                  title={useInternet ? 'Web search enabled for AI responses' : 'Web search disabled'}
                  className={`flex items-center gap-1 px-2 py-1 rounded-md text-[9px] font-semibold uppercase tracking-wider transition-all border ${useInternet
                    ? 'bg-blue-500/10 text-blue-600 border-blue-500/30 hover:bg-blue-500/20'
                    : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200'
                    }`}
                >
                  {useInternet ? <Globe size={10} /> : <WifiOff size={10} />}
                  {useInternet ? 'Web ON' : 'Web OFF'}
                </button>
              )}
              {onToggleStandard && (
                <div className="relative">
                  <button
                    onClick={() => setShowStandards(!showStandards)}
                    title="Select compliance standards for AI responses"
                    className={`flex items-center gap-1 px-2 py-1 rounded-md text-[9px] font-semibold uppercase tracking-wider transition-all border ${(selectedStandards?.length || 0) > 0
                      ? 'bg-purple-500/10 text-purple-600 border-purple-500/30 hover:bg-purple-500/20'
                      : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200'
                      }`}
                  >
                    <ShieldCheck size={10} />
                    {(selectedStandards?.length || 0) > 0 ? `${selectedStandards.length}` : 'Standards'}
                  </button>
                  {showStandards && (
                    <div className="absolute top-full right-0 mt-1.5 w-56 bg-white border border-slate-200 rounded-lg shadow-xl z-30 p-1.5 animate-in fade-in zoom-in-95">
                      <h3 className="text-[9px] font-bold text-slate-400 uppercase tracking-widest px-1.5 py-0.5 mb-1">
                        Compliance Protocols
                      </h3>
                      <div className="space-y-0.5 max-h-40 overflow-y-auto custom-scrollbar">
                        {(QUALITY_STANDARDS || []).map((std) => {
                          const isSelected = (selectedStandards || []).includes(std.id);
                          return (
                            <button
                              key={std.id}
                              onClick={() => onToggleStandard(std.id)}
                              className={`w-full text-left px-2 py-1.5 rounded-md text-[10px] font-medium flex items-center justify-between group transition-colors ${isSelected
                                ? 'bg-purple-500/10 text-purple-600'
                                : 'text-slate-600 hover:bg-slate-50'
                                }`}
                            >
                              <div className="flex flex-col">
                                <span>{std.name}</span>
                                <span className="text-[8px] text-slate-400 font-mono opacity-80">
                                  {std.description}
                                </span>
                              </div>
                              {isSelected && <CheckSquare size={10} className="shrink-0" />}
                            </button>
                          );
                        })}
                      </div>
                      <div className="mt-1.5 pt-1.5 border-t border-slate-100 px-1.5 flex justify-between items-center">
                        <button
                          onClick={() => setShowStandards(false)}
                          className="text-[9px] font-bold text-purple-600 uppercase hover:underline"
                        >
                          Done
                        </button>
                        <span className="text-[8px] text-slate-400">
                          {(selectedStandards?.length || 0)} Active
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Project Scope Indicator (read-only, set by AI) */}
            {projectScope && (
              <div className="mb-2">
                <div
                  className="inline-flex items-center gap-2 bg-gradient-to-r from-slate-50 to-slate-100 rounded-lg px-3 py-1.5 border border-slate-200"
                  title={scopeReasoning || 'Scope is auto-detected from your description'}
                >
                  <span className="text-sm font-medium text-slate-600">Scope:</span>
                  <span className="text-sm font-semibold text-slate-700">
                    {projectScope === 'mvp' && '🚀 MVP (3-5)'}
                    {projectScope === 'simple' && '🎯 Simple (5-8)'}
                    {projectScope === 'standard' && '⚙️ Standard (8-15)'}
                    {projectScope === 'full' && '🏢 Full (15+)'}
                  </span>
                  {scopeAutoDetected && (
                    <span className="text-xs text-slate-400 flex items-center gap-1">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
                      </svg>
                      auto
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Statistics */}
            <div className="grid grid-cols-3 gap-0.5 mb-1">
              <div className="bg-white/40 p-0.5 rounded-md border border-white/60 text-center">
                <div className="text-xs font-bold text-slate-700">{stats.total}</div>
                <div className="text-[8px] text-slate-500">Total</div>
              </div>
              <div className="bg-white/40 p-0.5 rounded-md border border-white/60 text-center">
                <div className="text-xs font-bold text-slate-700">{stats.topLevel}</div>
                <div className="text-[8px] text-slate-500">Top</div>
              </div>
              <div className="bg-white/40 p-0.5 rounded-md border border-white/60 text-center">
                <div className="text-xs font-bold text-slate-700">{stats.subIdeas}</div>
                <div className="text-[8px] text-slate-500">Sub</div>
              </div>
            </div>
            {Object.keys(stats.byCategory).length > 0 && (
              <div className="text-[8px] text-slate-500 space-y-0.5">
                <div>Categories: {Object.entries(stats.byCategory).map(([cat, count]) => `${cat}(${count})`).join(', ')}</div>
                <div>Priorities: High({stats.highPriority}) Med({stats.mediumPriority}) Low({stats.lowPriority})</div>
              </div>
            )}

            {/* Active Agents */}
            {activeAgents.length > 0 && (
              <div className="space-y-1">
                <button
                  onClick={() => toggleSection('agents')}
                  className="flex items-center justify-between w-full text-slate-600 hover:text-slate-800 transition-colors py-0.5"
                >
                  <div className="flex items-center gap-1.5">
                    <Users size={14} className="text-primary" />
                    <h3 className="font-semibold text-xs">Active Agents:</h3>
                  </div>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className={`w-3.5 h-3.5 transition-transform ${expandedSections.has('agents') ? 'rotate-180' : ''}`}
                  >
                    <path fillRule="evenodd" d="M12.53 16.28a.75.75 0 0 1-1.06 0l-7.5-7.5a.75.75 0 0 1 1.06-1.06L12 14.69l6.97-6.97a.75.75 0 1 1 1.06 1.06l-7.5 7.5Z" clipRule="evenodd" />
                  </svg>
                </button>
                {expandedSections.has('agents') && (
                  <div className="ml-5.5 animate-in fade-in slide-in-from-top-2 duration-300 space-y-1.5">
                    {activeAgents.map((agent) => (
                      <div
                        key={agent.id}
                        className="bg-white/60 border border-primary/20 rounded-md p-1.5 flex items-center gap-2"
                      >
                        <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <Bot size={12} className="text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-bold text-slate-800 truncate">{agent.name}</div>
                          <div className="text-[9px] text-slate-500 truncate">{agent.role}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Current Focus / Topic */}
            <div className="space-y-1">
              <button
                onClick={() => toggleSection('focus')}
                className="flex items-center justify-between w-full text-slate-600 hover:text-slate-800 transition-colors py-0.5"
              >
                <div className="flex items-center gap-1.5">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                    <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
                    <path fillRule="evenodd" d="M1.323 11.447C2.811 6.976 7.028 3.75 12.001 3.75c4.97 0 9.185 3.223 10.675 7.69.12.362.12.752 0 1.113-1.487 4.471-5.705 7.697-10.677 7.697-4.97 0-9.186-3.223-10.675-7.69a1.762 1.762 0 0 1 0-1.113ZM17.25 12a5.25 5.25 0 1 1-10.5 0 5.25 5.25 0 0 1 10.5 0Z" clipRule="evenodd" />
                  </svg>
                  <h3 className="font-semibold text-xs">Current Focus:</h3>
                </div>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className={`w-3.5 h-3.5 transition-transform ${expandedSections.has('focus') ? 'rotate-180' : ''}`}
                >
                  <path fillRule="evenodd" d="M12.53 16.28a.75.75 0 0 1-1.06 0l-7.5-7.5a.75.75 0 0 1 1.06-1.06L12 14.69l6.97-6.97a.75.75 0 1 1 1.06 1.06l-7.5 7.5Z" clipRule="evenodd" />
                </svg>
              </button>
              {expandedSections.has('focus') && (
                <div className="ml-5.5 animate-in fade-in slide-in-from-top-2 duration-300">
                  {(() => {
                    const displayText = activeIdea ? activeIdea.label : (topic || 'Start Crafting Your Idea');
                    const isWelcomeMessage = displayText.includes('Start Crafting Your Idea') || displayText.includes('starts here') || displayText.includes('Your Project starts here');
                    const matchesSearch = searchQuery.trim() && displayText.toLowerCase().includes(searchQuery.toLowerCase());
                    return (
                      <p className={`${isWelcomeMessage ? 'text-sm' : 'text-base'} font-extrabold bg-clip-text text-transparent bg-gradient-to-r ${isWelcomeMessage ? 'from-purple-600 via-pink-500 to-rose-500' : 'from-blue-600 to-violet-600'} leading-tight ${matchesSearch ? 'ring-2 ring-yellow-400 rounded px-1' : ''}`}>
                        {searchQuery.trim() ? highlightSearchMatch(displayText, searchQuery) : displayText}
                      </p>
                    );
                  })()}
                  {activeIdea && (
                    <div className="mt-1.5 space-y-1.5">
                      {editingIdeaId === activeIdea.id ? (
                        <div className="space-y-2">
                          <textarea
                            value={editDescription}
                            onChange={(e) => setEditDescription(e.target.value)}
                            onBlur={() => {
                              if (onIdeaUpdate) {
                                onIdeaUpdate(activeIdea.id, { description: editDescription, updatedAt: Date.now() });
                              }
                              setEditingIdeaId(null);
                            }}
                            className="w-full text-xs text-slate-700 leading-relaxed bg-white/80 p-1.5 rounded-md border border-blue-300 focus:border-blue-500 focus:outline-none resize-none"
                            rows={3}
                            autoFocus
                          />
                          <button
                            onClick={() => {
                              if (onIdeaUpdate) {
                                onIdeaUpdate(activeIdea.id, { description: editDescription, updatedAt: Date.now() });
                              }
                              setEditingIdeaId(null);
                            }}
                            className="text-[10px] px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
                          >
                            Save
                          </button>
                        </div>
                      ) : (
                        <p
                          className="text-xs text-slate-600 leading-relaxed bg-white/40 p-1.5 rounded-md border border-white/50 cursor-pointer hover:bg-white/60 transition-colors"
                          onClick={() => {
                            setEditingIdeaId(activeIdea.id);
                            setEditDescription(activeIdea.description || '');
                          }}
                          title="Click to edit description"
                        >
                          {activeIdea.description || 'No description - click to add'}
                        </p>
                      )}

                      {/* Notes section */}
                      <div className="mt-2">
                        {editingIdeaId === `${activeIdea.id}-notes` ? (
                          <div className="space-y-2">
                            <textarea
                              value={editNotes}
                              onChange={(e) => setEditNotes(e.target.value)}
                              onBlur={() => {
                                if (onIdeaUpdate) {
                                  onIdeaUpdate(activeIdea.id, { notes: editNotes, updatedAt: Date.now() });
                                }
                                setEditingIdeaId(null);
                              }}
                              placeholder="Add notes about this idea..."
                              className="w-full text-[10px] text-slate-700 leading-relaxed bg-white/80 p-1.5 rounded-md border border-blue-300 focus:border-blue-500 focus:outline-none resize-none"
                              rows={3}
                              autoFocus
                            />
                            <button
                              onClick={() => {
                                if (onIdeaUpdate) {
                                  onIdeaUpdate(activeIdea.id, { notes: editNotes, updatedAt: Date.now() });
                                }
                                setEditingIdeaId(null);
                              }}
                              className="text-[10px] px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
                            >
                              Save
                            </button>
                          </div>
                        ) : (
                          <div
                            className="text-[10px] text-slate-600 bg-white/30 p-1.5 rounded-md border border-white/30 cursor-pointer hover:bg-white/50 transition-colors"
                            onClick={() => {
                              setEditingIdeaId(`${activeIdea.id}-notes`);
                              setEditNotes(activeIdea.notes || '');
                            }}
                          >
                            <div className="flex items-center gap-1 mb-1">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                              <span className="font-medium">Notes</span>
                            </div>
                            {activeIdea.notes ? (
                              <p className="text-slate-700 whitespace-pre-wrap">{activeIdea.notes}</p>
                            ) : (
                              <p className="text-slate-400 italic">Click to add notes...</p>
                            )}
                          </div>
                        )}
                      </div>

                      {ideaGroups.groups[activeIdea.id] && ideaGroups.groups[activeIdea.id].length > 0 && (
                        <div className="text-[10px] text-slate-500">
                          <strong>Sub-ideas:</strong> {ideaGroups.groups[activeIdea.id].length}
                        </div>
                      )}

                      {/* Idea History/Timeline */}
                      {(activeIdea.createdAt || activeIdea.updatedAt || activeIdea.state) && (
                        <div className="mt-2 pt-2 border-t border-white/30">
                          <div className="text-[9px] text-slate-500 space-y-0.5">
                            {activeIdea.createdAt && (
                              <div>Created: {new Date(activeIdea.createdAt).toLocaleString()}</div>
                            )}
                            {activeIdea.updatedAt && activeIdea.updatedAt !== activeIdea.createdAt && (
                              <div>Updated: {new Date(activeIdea.updatedAt).toLocaleString()}</div>
                            )}
                            {activeIdea.state && activeIdea.state !== 'new' && (
                              <div>State: <span className="capitalize">{activeIdea.state}</span></div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Key Insights */}
            <div className="space-y-1">
              <button
                onClick={() => toggleSection('insights')}
                className="flex items-center justify-between w-full text-rose-500 hover:text-rose-600 transition-colors py-0.5"
              >
                <div className="flex items-center gap-1.5">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                    <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12ZM12 8.25a.75.75 0 0 1 .75.75v3.75a.75.75 0 0 1-1.5 0V9a.75.75 0 0 1 .75-.75Zm0 8.25a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z" clipRule="evenodd" />
                  </svg>
                  <h3 className="font-semibold text-xs">Captured Insights:</h3>
                  {keyInsights.length > 0 && (
                    <span className="text-[10px] bg-rose-100 text-rose-600 px-1 py-0.5 rounded-full">{keyInsights.length}</span>
                  )}
                </div>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className={`w-3.5 h-3.5 transition-transform ${expandedSections.has('insights') ? 'rotate-180' : ''}`}
                >
                  <path fillRule="evenodd" d="M12.53 16.28a.75.75 0 0 1-1.06 0l-7.5-7.5a.75.75 0 0 1 1.06-1.06L12 14.69l6.97-6.97a.75.75 0 1 1 1.06 1.06l-7.5 7.5Z" clipRule="evenodd" />
                </svg>
              </button>
              {expandedSections.has('insights') && (
                <div className="ml-5.5 animate-in fade-in slide-in-from-top-2 duration-300">
                  {keyInsights.length === 0 ? (
                    <p className="text-[10px] text-slate-400 italic">Waiting for conversation...</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {keyInsights
                        .filter(insight => {
                          if (!searchQuery.trim()) return true;
                          return insight.toLowerCase().includes(searchQuery.toLowerCase());
                        })
                        .map((insight, idx) => (
                          <li key={idx} className={`text-[10px] text-slate-700 bg-rose-50/50 p-1.5 rounded-md border border-rose-100/50 flex items-start gap-1.5 ${searchQuery.trim() && insight.toLowerCase().includes(searchQuery.toLowerCase()) ? 'ring-2 ring-yellow-400' : ''}`}>
                            <span className="text-rose-500 mt-0.5 text-xs">💡</span>
                            <span>{searchQuery.trim() ? highlightSearchMatch(insight, searchQuery) : insight}</span>
                          </li>
                        ))}
                    </ul>
                  )}
                </div>
              )}
            </div>

            {/* Ideas List with Relationships */}
            <div className="space-y-1">
              <button
                onClick={() => toggleSection('ideas')}
                className="flex items-center justify-between w-full text-slate-600 hover:text-slate-800 transition-colors py-0.5"
              >
                <div className="flex items-center gap-1.5">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                    <path fillRule="evenodd" d="M3 6a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V6Zm4.5 7.5a.75.75 0 0 1 .75.75v2.25a.75.75 0 0 1-1.5 0v-2.25a.75.75 0 0 1 .75-.75Zm3.75-1.5a.75.75 0 0 0-1.5 0v4.5a.75.75 0 0 0 1.5 0V12Zm2.25-3a.75.75 0 0 1 .75.75v6.75a.75.75 0 0 1-1.5 0V9.75A.75.75 0 0 1 13.5 9Zm3.75-1.5a.75.75 0 0 0-1.5 0v8.25a.75.75 0 0 0 1.5 0V7.5Z" clipRule="evenodd" />
                  </svg>
                  <h3 className="font-semibold text-xs">Ideation Map:</h3>
                </div>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className={`w-3.5 h-3.5 transition-transform ${expandedSections.has('ideas') ? 'rotate-180' : ''}`}
                >
                  <path fillRule="evenodd" d="M12.53 16.28a.75.75 0 0 1-1.06 0l-7.5-7.5a.75.75 0 0 1 1.06-1.06L12 14.69l6.97-6.97a.75.75 0 1 1 1.06 1.06l-7.5 7.5Z" clipRule="evenodd" />
                </svg>
              </button>
              {expandedSections.has('ideas') && (
                <div className="ml-5.5 space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
                  {/* Search and Filters */}
                  <div className="space-y-1.5">
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Search ideas, topic, insights..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full text-[10px] px-1.5 py-1 pl-6 bg-white/60 border border-white/80 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400"
                      />
                      <svg className="absolute left-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                      {searchQuery && (
                        <button
                          onClick={() => setSearchQuery('')}
                          className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 hover:text-slate-600"
                          title="Clear search"
                        >
                          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </div>

                    {/* Search results indicator */}
                    {searchQuery.trim() && (
                      <div className="text-[8px] text-slate-500 flex items-center gap-2 flex-wrap">
                        <span>Found in:</span>
                        {searchMatches.topic && <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded">Topic</span>}
                        {searchMatches.ideas && <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded">{filteredIdeas.length} Ideas</span>}
                        {searchMatches.insights && <span className="px-1.5 py-0.5 bg-green-100 text-green-700 rounded">Insights</span>}
                        {searchMatches.nextSteps && <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded">Next Steps</span>}
                        {!searchMatches.topic && !searchMatches.ideas && !searchMatches.insights && !searchMatches.nextSteps && (
                          <span className="text-slate-400">No matches</span>
                        )}
                      </div>
                    )}

                    {/* Filters */}
                    <div className="flex gap-1 flex-wrap">
                      <select
                        value={ideaFilter}
                        onChange={(e) => setIdeaFilter(e.target.value as any)}
                        className="text-[9px] px-1.5 py-0.5 bg-white/60 border border-white/80 rounded focus:outline-none"
                      >
                        <option value="all">All Categories</option>
                        <option value="feature">Features</option>
                        <option value="constraint">Constraints</option>
                        <option value="opportunity">Opportunities</option>
                        <option value="risk">Risks</option>
                        <option value="requirement">Requirements</option>
                        <option value="improvement">Improvements</option>
                      </select>
                      <select
                        value={priorityFilter}
                        onChange={(e) => setPriorityFilter(e.target.value as any)}
                        className="text-[9px] px-1.5 py-0.5 bg-white/60 border border-white/80 rounded focus:outline-none"
                      >
                        <option value="all">All Priorities</option>
                        <option value="high">High (4-5)</option>
                        <option value="medium">Medium (3)</option>
                        <option value="low">Low (1-2)</option>
                      </select>
                    </div>

                    {/* Bulk Actions */}
                    {selectedIdeaIdsForBulk.size > 0 && (
                      <div className="flex gap-1 text-[9px]">
                        <span className="text-slate-600">{selectedIdeaIdsForBulk.size} selected</span>
                        <button
                          onClick={() => setSelectedIdeaIdsForBulk(new Set())}
                          className="text-blue-600 hover:text-blue-700"
                        >
                          Clear
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Enhanced Statistics */}
                  <div className="text-[9px] text-slate-500 flex gap-2">
                    <span>Total: {stats.total}</span>
                    <span>Top: {stats.topLevel}</span>
                    <span>Sub: {stats.subIdeas}</span>
                    {ideas.filter(i => i.connections && i.connections.length > 0).length > 0 && (
                      <span>Connections: {ideas.reduce((sum, i) => sum + (i.connections?.length || 0), 0) / 2}</span>
                    )}
                  </div>

                  {/* Top Level Ideas */}
                  <div className="space-y-1.5 max-h-64 overflow-y-auto">
                    {ideaGroups.topLevel.filter(i => {
                      if (i.id === 'welcome-bubble') return false;
                      if (ideaFilter !== 'all' && i.category !== ideaFilter) return false;
                      if (priorityFilter === 'high' && (!i.priority || i.priority < 4)) return false;
                      if (priorityFilter === 'medium' && (!i.priority || i.priority !== 3)) return false;
                      if (priorityFilter === 'low' && i.priority && i.priority > 2) return false;
                      return true;
                    }).map((item) => (
                      <div key={item.id} className="space-y-0.5">
                        <div className="flex items-center gap-1">
                          {selectedIdeaIdsForBulk.size > 0 && (
                            <input
                              type="checkbox"
                              checked={selectedIdeaIdsForBulk.has(item.id)}
                              onChange={(e) => {
                                setSelectedIdeaIdsForBulk(prev => {
                                  const next = new Set(prev);
                                  if (e.target.checked) {
                                    next.add(item.id);
                                  } else {
                                    next.delete(item.id);
                                  }
                                  return next;
                                });
                              }}
                              className="w-3 h-3"
                              onClick={(e) => e.stopPropagation()}
                            />
                          )}
                          <button
                            onClick={() => onIdeaClick?.(item.id)}
                            className={`flex-1 text-left text-xs px-2 py-1.5 rounded-lg border-l-4 shadow-sm transition-all hover:scale-[1.02]
                         ${item.id === activeIdeaId
                                ? 'bg-blue-100 text-blue-700'
                                : 'bg-white/60 text-slate-700 hover:bg-white/80'}`}
                            style={{
                              borderLeftColor: item.id === activeIdeaId ? '#3b82f6' : getCategoryColorHex(item.category)
                            }}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-medium">{item.label}</span>
                              <div className="flex items-center gap-1">
                                {item.priority && (
                                  <span className="text-[8px] text-amber-600">{'★'.repeat(item.priority)}</span>
                                )}
                                {item.category && item.category !== 'idea' && (
                                  <span className="text-[8px] px-1 py-0.5 bg-slate-200 rounded text-slate-600">{item.category}</span>
                                )}
                              </div>
                            </div>
                            {ideaGroups.groups[item.id] && ideaGroups.groups[item.id].length > 0 && (
                              <div className="text-[9px] text-slate-400 mt-0.5">
                                {ideaGroups.groups[item.id].length} sub-idea{ideaGroups.groups[item.id].length !== 1 ? 's' : ''}
                              </div>
                            )}
                          </button>
                          {/* Sub-ideas */}
                          {ideaGroups.groups[item.id] && ideaGroups.groups[item.id].length > 0 && (
                            <div className="ml-3 space-y-0.5">
                              {ideaGroups.groups[item.id].map((subIdea) => (
                                <button
                                  key={subIdea.id}
                                  onClick={() => onIdeaClick?.(subIdea.id)}
                                  className={`w-full text-left text-[9px] px-1.5 py-0.5 rounded border transition-all
                               ${subIdea.id === activeIdeaId ? 'bg-blue-50 border-blue-200 text-blue-600' : 'bg-white/30 border-white/40 text-slate-500 hover:bg-white/40'}`}
                                >
                                  └ {subIdea.label}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                    {ideaGroups.topLevel.filter(i => {
                      if (i.id === 'welcome-bubble') return false;
                      if (ideaFilter !== 'all' && i.category !== ideaFilter) return false;
                      if (priorityFilter === 'high' && (!i.priority || i.priority < 4)) return false;
                      if (priorityFilter === 'medium' && (!i.priority || i.priority !== 3)) return false;
                      if (priorityFilter === 'low' && i.priority && i.priority > 2) return false;
                      return true;
                    }).length === 0 && (
                        <span className="text-[10px] text-slate-400">No ideas yet</span>
                      )}
                  </div>
                </div>
              )}
            </div>



            {/* AI Brainstorming Tools */}
            {ideas.length > 0 && (
              <div className="space-y-1 border-t border-white/60 pt-2 mt-2">
                <h3 className="text-xs font-semibold text-slate-700 mb-2 px-1">AI Brainstorming Tools</h3>
                <div className="space-y-1">
                  {onGenerateRelatedIdeas && (
                    <button
                      onClick={onGenerateRelatedIdeas}
                      className="w-full px-3 py-2 text-left text-xs text-slate-700 bg-gradient-to-r from-slate-50 to-white hover:from-slate-100 hover:to-slate-50 rounded-lg transition-all flex items-center gap-2 border border-slate-200 shadow-sm hover:shadow"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                      </svg>
                      Generate Related Ideas
                    </button>
                  )}
                  {onIdeaRefinement && activeIdeaId && (
                    <button
                      onClick={() => onIdeaRefinement(activeIdeaId)}
                      className="w-full px-3 py-2 text-left text-xs text-slate-700 bg-gradient-to-r from-slate-50 to-white hover:from-slate-100 hover:to-slate-50 rounded-lg transition-all flex items-center gap-2 border border-slate-200 shadow-sm hover:shadow"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      Refine Selected Idea
                    </button>
                  )}
                  {onGapAnalysis && (
                    <button
                      onClick={onGapAnalysis}
                      className="w-full px-3 py-2 text-left text-xs text-slate-700 bg-gradient-to-r from-slate-50 to-white hover:from-slate-100 hover:to-slate-50 rounded-lg transition-all flex items-center gap-2 border border-slate-200 shadow-sm hover:shadow"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Gap Analysis
                    </button>
                  )}
                  {onCrossPollination && (
                    <button
                      onClick={onCrossPollination}
                      className="w-full px-3 py-2 text-left text-xs text-slate-700 bg-gradient-to-r from-slate-50 to-white hover:from-slate-100 hover:to-slate-50 rounded-lg transition-all flex items-center gap-2 border border-slate-200 shadow-sm hover:shadow"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                      </svg>
                      Cross-Pollination
                    </button>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {/* Maturity View */}
        {activeView === 'maturity' && (
          <div className="space-y-3">
            {/* Overall Score Circle */}
            <div className="bg-gradient-to-br from-emerald-50 to-green-50 rounded-lg p-4 border border-emerald-200/50 text-center">
              <h3 className="text-xs font-bold text-emerald-800 mb-3 flex items-center justify-center gap-1.5">
                <CheckSquare size={14} />
                Project Maturity Score
              </h3>
              <div className="relative w-24 h-24 mx-auto mb-3">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="45" fill="none" stroke="#d1fae5" strokeWidth="10" />
                  <circle
                    cx="50" cy="50" r="45" fill="none"
                    stroke={readyCheck?.score && readyCheck.score >= 70 ? '#10b981' : readyCheck?.score && readyCheck.score >= 50 ? '#f59e0b' : '#ef4444'}
                    strokeWidth="10"
                    strokeLinecap="round"
                    strokeDasharray={`${(readyCheck?.score || 0) * 2.83} 283`}
                    className="transition-all duration-700"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className={`text-2xl font-bold ${readyCheck?.score && readyCheck.score >= 70 ? 'text-emerald-600' : readyCheck?.score && readyCheck.score >= 50 ? 'text-amber-600' : 'text-red-500'}`}>
                    {readyCheck?.score || 0}%
                  </span>
                </div>
              </div>
              <p className={`text-[10px] font-medium ${readyCheck?.canProceed ? 'text-emerald-600' : 'text-amber-600'}`}>
                {readyCheck?.canProceed ? '✓ Ready to proceed!' : 'Need 70% to proceed'}
              </p>
            </div>

            {/* Detailed Breakdown */}
            <div className="space-y-2">
              <h4 className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Score Breakdown</h4>

              {/* Clarity - 25% weight */}
              <div className="bg-white/60 rounded-lg p-2 border border-slate-200/50">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[10px] font-medium text-slate-700">💬 Clarity</span>
                  <span className="text-[10px] font-bold text-slate-600">{readyCheck?.breakdown?.clarity || 0}%</span>
                </div>
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 transition-all duration-500" style={{ width: `${readyCheck?.breakdown?.clarity || 0}%` }} />
                </div>
                <p className="text-[8px] text-slate-500 mt-0.5">How well-defined are requirements? (25% weight)</p>
              </div>

              {/* Feasibility - 30% weight (highest!) */}
              <div className="bg-white/60 rounded-lg p-2 border border-slate-200/50">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[10px] font-medium text-slate-700">⚡ Feasibility</span>
                  <span className="text-[10px] font-bold text-slate-600">{readyCheck?.breakdown?.feasibility || 0}%</span>
                </div>
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-indigo-500 transition-all duration-500" style={{ width: `${readyCheck?.breakdown?.feasibility || 0}%` }} />
                </div>
                <p className="text-[8px] text-slate-500 mt-0.5">Is it technically achievable? (30% weight)</p>
              </div>

              {/* Completeness - 25% weight */}
              <div className="bg-white/60 rounded-lg p-2 border border-slate-200/50">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[10px] font-medium text-slate-700">📋 Completeness</span>
                  <span className="text-[10px] font-bold text-slate-600">{readyCheck?.breakdown?.completeness || 0}%</span>
                </div>
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-purple-500 transition-all duration-500" style={{ width: `${readyCheck?.breakdown?.completeness || 0}%` }} />
                </div>
                <p className="text-[8px] text-slate-500 mt-0.5">How thorough is the documentation? (25% weight)</p>
              </div>

              {/* Standards - 10% weight */}
              <div className="bg-white/60 rounded-lg p-2 border border-slate-200/50">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[10px] font-medium text-slate-700">⭐ Standards</span>
                  <span className="text-[10px] font-bold text-slate-600">{readyCheck?.breakdown?.standards || 0}%</span>
                </div>
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-amber-500 transition-all duration-500" style={{ width: `${readyCheck?.breakdown?.standards || 0}%` }} />
                </div>
                <p className="text-[8px] text-slate-500 mt-0.5">Adherence to best practices (10% weight)</p>
              </div>

              {/* Research - 10% weight */}
              <div className="bg-white/60 rounded-lg p-2 border border-slate-200/50">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[10px] font-medium text-slate-700">🔍 Research</span>
                  <span className="text-[10px] font-bold text-slate-600">{readyCheck?.breakdown?.research || 0}%</span>
                </div>
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-green-500 transition-all duration-500" style={{ width: `${readyCheck?.breakdown?.research || 0}%` }} />
                </div>
                <p className="text-[8px] text-slate-500 mt-0.5">Depth of market/tech research (10% weight)</p>
              </div>

            </div>

            {/* Tip */}
            {readyCheck?.reason && !readyCheck.canProceed && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 text-[10px] text-amber-800">
                <span className="font-semibold">💡 {readyCheck.reason}</span>
              </div>
            )}
          </div>
        )}

      </div>



      {/* Export Button */}
      <div className="shrink-0 p-2 border-t border-white/60">
        <button
          onClick={() => {
            // Export brainstorming session
            const exportData = {
              topic,
              ideas: ideas.map(i => ({
                id: i.id,
                label: i.label,
                description: i.description,
                parentId: i.parentId,
                priority: i.priority,
                category: i.category,
                notes: i.notes,
                connections: i.connections,
                state: i.state,
                tags: i.tags,
                createdAt: i.createdAt,
                updatedAt: i.updatedAt
              })),
              keyInsights,
              nextSteps,
              exportedAt: new Date().toISOString()
            };

            const jsonStr = JSON.stringify(exportData, null, 2);
            const blob = new Blob([jsonStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `brainstorming-${topic.replace(/[^a-z0-9]/gi, '_').toLowerCase()}-${Date.now()}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
          }}
          className="w-full px-2 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[9px] font-medium transition-colors flex items-center justify-center gap-1.5"
          title="Export brainstorming session"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Export
        </button>
      </div>

      {/* Bottom Buttons - Always Visible */}
      <div className="shrink-0 p-3 pt-2 border-t border-white/60">
        {/* Deepen Ideas Button - Shows when ideas exist, can be clicked twice */}
        {hasIdeas && onDeepenIdeas && deepenLevel < 2 && prototypingStage === 'ideation' && (
          <button
            onClick={onDeepenIdeas}
            disabled={isProcessing || isDeepeningIdeas}
            className={`w-full mb-2 px-3 py-2 rounded-lg transition-all text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 ${isDeepeningIdeas
              ? 'bg-blue-500 text-white'
              : 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white hover:from-blue-600 hover:to-indigo-700 shadow-md hover:shadow-lg'
              }`}
            title={`Deepen Ideas - Add more detail and sub-ideas (${2 - deepenLevel} uses left)`}
          >
            {isDeepeningIdeas ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Deepening Ideas... {deepeningProgress > 0 ? `${deepeningProgress}%` : ''}</span>
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
                  <path d="M12 2v20M2 12h20" />
                </svg>
                <span>Deepen Ideas X{deepenLevel + 1}</span>
              </>
            )}
          </button>
        )}
        <div className="flex items-center gap-1.5">

          {/* Regenerate Prototype Button (when in prototyping) or Help with idea Button (when in ideation) */}

        </div>

        {/* Helper text when Ready To Go is disabled - Enhanced visibility for idea maturity feedback */}
        {
          onReadyToGo && readyCheck && !readyCheck.canProceed && !isGeneratingPreview && !isProcessing && (
            <div className="mt-2 px-2 py-2 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-start gap-1.5">
                <svg className="w-3 h-3 text-amber-600 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="text-[9px] text-amber-700 leading-relaxed whitespace-pre-line">
                  <span className="font-semibold block mb-0.5">Idea not ready yet:</span>
                  {readyCheck.reason || "Continue refining your idea to proceed"}
                </div>
              </div>
            </div>
          )
        }

        {/* Get Agents Involved Button - Above Launch Project */}
        {
          onGetAgentsInvolved && (
            <button
              onClick={onGetAgentsInvolved}
              disabled={isGettingAgentsInvolved || isProcessing || (activeAgents && activeAgents.length > 0)}
              className={`mt-2 w-full px-2 py-1.5 rounded-lg shadow-lg transition-all text-[9px] font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 ${!isGettingAgentsInvolved && !isProcessing && (!activeAgents || activeAgents.length === 0)
                ? 'bg-gradient-to-r from-purple-500 to-indigo-600 text-white hover:shadow-xl hover:from-purple-600 hover:to-indigo-700 cursor-pointer'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed opacity-50'
                }`}
              title={
                activeAgents && activeAgents.length > 0
                  ? 'Agents are already collaborating on this project'
                  : isGettingAgentsInvolved
                    ? 'Inviting agents to collaborate...'
                    : 'Invite relevant AI agents to chat and enhance your project idea'
              }
            >
              {isGettingAgentsInvolved ? (
                <>
                  <div className="w-3 h-3 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"></div>
                  <span>Inviting Agents...</span>
                </>
              ) : (
                <>
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  <span>Get Agents Involved</span>
                </>
              )}
            </button>
          )
        }

        {/* Buttons removed per request */}

        {/* Launch Project Button - Only visible when prototyping panel is expanded */}

      </div>
    </div>
  );
};

export default GlassPanel;
