import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { ChatMessage } from '@orbitai/shared';
import { v4 as uuidv4 } from 'uuid';
import OrbGraph, { Idea } from './OrbGraph';
import GlassPanel from './GlassPanel';
import OrbitAIControlBar from './OrbitAIControlBar';
import PrototypingPanel from './PrototypingPanel';
import PathChoiceModal from './PathChoiceModal';
import FeatureSelectionModal from './FeatureSelectionModal';
import MissionControl from './MissionControl';
import { apiRequest } from '@src/services/api.js';
import { generateProjectPreview, generateAppTheme, ProjectPreview, performFullArchitectureAnalysis, FullArchitectureAnalysis } from '../services/geminiService';
import { streamChatMessage, messagesToHistory } from '@src/services/streamingChatApi';
import { Mic, Paperclip, ChevronRight, ChevronDown, Plus, Folder, FolderPlus, Settings, LogOut, ArrowRight, Trash2, Edit2, MessageSquare, Clock, X, ChevronLeft, Rocket, RefreshCw, ChevronUp, Globe, Smartphone, Monitor, Server, Code, MoreVertical, Move } from 'lucide-react';
import { chatApi, ChatConversation } from '@src/services/chatApi';
import { projectFolderApi } from '@src/services/projectFolderApi';
import { ProjectFolder } from '@orbitai/shared';
import { useAuth } from '../contexts/AuthContext';
import ConfirmationModal from './ConfirmationModal';
import UserProfileModal from './UserProfileModal';
import UserLogin from './UserLogin';
import ProjectFolderManager from './ProjectFolderManager';
import { toast } from '../services/toastService';
import { showConfirm, showAlert } from '../utils/browserUtils';
import { useLiveSession, ConnectionStatus } from '../hooks/useLiveSession';
import { useStreamingChat } from '../hooks/useStreamingChat';
import ErrorBoundary from './ErrorBoundary';
import { webContainerService } from '../services/WebContainerService';

// Extracted components and utilities from neural-stream-chat module
import {
  categorizeIdeaWithAI,
  inferCategoryQuickFallback,
  normalizeIdeas,
  recategorizeIdeasWithAI,
  normalizeMethodology,
  normalizeProjectPreview,
  VALID_VIZ_CATEGORIES,
  AGENT_VOICE_MAP,
} from './neural-stream-chat';
import { parseXmlToIdeas } from './neural-stream-chat/utils/xmlParser';
import { useNeuralStreamState, SavedConversation } from './neural-stream-chat/hooks/useNeuralStreamState';
import { ChatHistorySidebar } from './neural-stream-chat/components/ChatHistorySidebar';
import { IdeaVisualization } from './neural-stream-chat/components/IdeaVisualization';
import { useIdeaExtraction } from './neural-stream-chat/hooks/useIdeaExtraction';

import type { VisualizationCategory, ValidMethodology, AgentVoice } from './neural-stream-chat';
import { calculateMaturityAssessment } from '@src/utils/maturityAssessment';

// Other visualization components
import { IdeationViewType } from './ViewToggle';
import { generateProjectResearch, ProjectResearch } from '../services/geminiService';

// Extend Window interface for Speech Recognition
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

// Note: normalizeIdeaCategory, categorizeIdeaWithAI, inferCategoryQuickFallback, 
// normalizeIdeas, recategorizeIdeasWithAI, normalizeMethodology, normalizeProjectPreview,
// VALID_VIZ_CATEGORIES, VisualizationCategory, and ValidMethodology are now imported 
// from './neural-stream-chat' module above

interface NeuralStreamChatProps {
  messages: ChatMessage[];
  onSendMessage: (message: string, stageContext?: string) => void;
  input: string;
  setInput: (input: string) => void;
  isProcessing?: boolean;
  processingLabel?: string | null;
  useInternet?: boolean;
  onToggleInternet?: () => void;
  selectedStandards?: string[];
  onToggleStandard?: (id: string) => void;
  onDeepResearch?: (query: string) => void; // Deep research function
  onSwitchToSetupView?: () => void; // Callback to switch to SetupView (classic mode)
  onLoadConversation?: (messages: ChatMessage[]) => void; // Callback to load conversation messages
  projectName?: string; // Project name to show as Central Idea from kickoff (before brainstorming)
  onLaunchProject?: (brainstormingData: {
    topic: string;
    ideas: Idea[];
    keyInsights: string[];
    nextSteps: string[];
    projectPreview: ProjectPreview | null;
    selectedStandards: string[];
    messages: ChatMessage[];
    useInternet: boolean;
    conversationId: string | null;
  }) => Promise<void> | void; // Callback to launch project (proceed to workspace)
  onProjectPreviewChange?: (preview: ProjectPreview | null) => void; // Callback when projectPreview changes
}

const NeuralStreamChat: React.FC<NeuralStreamChatProps> = ({
  messages,
  onSendMessage,
  input,
  setInput,
  isProcessing = false,
  onSwitchToSetupView,
  processingLabel = null,
  useInternet = false,
  onToggleInternet,
  selectedStandards = [],
  onToggleStandard,
  onDeepResearch,
  onLoadConversation,
  onLaunchProject,
  projectName = '', // Project name for Central Idea from kickoff
  onProjectPreviewChange
}) => {
  // Debug log disabled - was causing console spam during normal operation
  // console.log('🚀 [NeuralStreamChat] RENDER START');
  const { user, isAuthenticated, logout, login, refreshUser, loading: authLoading } = useAuth();
  // Initialize topic from projectName prop - shows project name as Central Idea from kickoff
  const {
    topic, setTopic,
    ideas, setIdeas,
    hasInitializedRef,
    isExtractingIdeasRef,
    hasUserInteractedRef,
    activeIdeaId, setActiveIdeaId,
    keyInsights, setKeyInsights,
    nextSteps, setNextSteps,
    glassPanelActiveView, setGlassPanelActiveView,
    showChatHistorySidebar, setShowChatHistorySidebar,
    showTemplateSelector, setShowTemplateSelector,
    layoutMode, setLayoutMode,
    savedConversations, setSavedConversations,
    currentConversationId, setCurrentConversationId,
    conversationToRestore, setConversationToRestore,
    generatingSuggestions, setGeneratingSuggestions,
    isGettingAgentsInvolved, setIsGettingAgentsInvolved,
    loadingStatusText, setLoadingStatusText,
    activeAgents, setActiveAgents,
    prototypingStage, setPrototypingStage,
    projectPreview, setProjectPreview,
    isGeneratingPreview, setIsGeneratingPreview,
    generationProgress, setGenerationProgress,
    isLaunchingProject, setIsLaunchingProject,
    showPathChoice, setShowPathChoice,
    showFeatureSelection, setShowFeatureSelection,
    statusLogs, setStatusLogs,
    suggestionModal, setSuggestionModal,
    selectedIdeas, setSelectedIdeas,
    mergeDialog, setMergeDialog,
    contextMenu, setContextMenu,
    linkingMode, setLinkingMode,
    linkDialog, setLinkDialog,
    aiSuggestions, setAiSuggestions,
    isFetchingAiSuggestions, setIsFetchingAiSuggestions,
    suggestionSetIndex, setSuggestionSetIndex,
    aiSuggestionDebounceRef,
    showNewChatConfirm, setShowNewChatConfirm,
    isResetting, setIsResetting,
    showUserProfile, setShowUserProfile,
    showUserLogin, setShowUserLogin,
    projectFolders, setProjectFolders,
    folderToDelete, setFolderToDelete,
    editingFolderId, setEditingFolderId,
    editingFolderName, setEditingFolderName,
    expandedFolders, setExpandedFolders,
    showFolderManager, setShowFolderManager,
    folderManagerMode, setFolderManagerMode,
    editingFolder, setEditingFolder,
    showMoveConversationDialog, setShowMoveConversationDialog,
    conversationToMove, setConversationToMove,
    currentWorkspaceId, setCurrentWorkspaceId,
    deepenLevel, setDeepenLevel,
    isDeepeningIdeas, setIsDeepeningIdeas,
    isLoadingConversationRef,
    lastLoadedConversationIdRef,
    isReloadingMessagesRef,
    messagesRef,
    debugLastParsed, setDebugLastParsed,
    lastMessageCountRef,
    extractionTimeoutRef,
    extractionAbortControllerRef,
    systemMessages, setSystemMessages,
    deepenMapRef
  } = useNeuralStreamState(projectName || '', messages);

  // Hook for Idea Extraction logic
  const {
    isExtractingIdeas,
    extractionAgent,
    extractIdeasAndInsights,
    filterRelevantMessages
  } = useIdeaExtraction({
    topic,
    ideas,
    setIdeas,
    setKeyInsights,
    setNextSteps,
    deepenLevel,
    isDeepeningIdeas,
    deepenMapRef
  });

  const [showInbox, setShowInbox] = useState(false); // Kept local if not in hook? Wait, systemMessages is in hook. showInbox is UI state for Sidebar.
  // Sidebar component handles showInbox internally? No, I defined showInbox in NeuralStreamChat as state.
  // But my ChatHistorySidebar component ALSO has `const [showInbox, setShowInbox] = useState(true);`
  // So I can REMOVE `showInbox` state from NeuralStreamChat!


  // Convert messages to conversation history format for voice session
  const conversationHistory = useMemo(() => {
    return messages
      .filter(msg => msg.sender === 'user' || msg.sender === 'agent')
      .slice(-10) // Last 10 messages for context
      .map(msg => ({
        role: msg.sender === 'user' ? 'user' as const : 'assistant' as const,
        content: msg.text
      }));
  }, [messages]);

  // Helper function to create Orchestrator welcome message (from Raed, the Orchestrator Agent)
  const createOrchestratorWelcomeMessage = useCallback((): ChatMessage => {
    return {
      id: `orchestrator-welcome-${Date.now()}`,
      sender: 'agent',
      text: `Hello! I'm Raed, your Orchestrator Agent and main AI assistant in OrbitAI. As a Distinguished Program Director with 20+ years of experience driving digital transformation, I'm here to help you brainstorm, develop your project ideas, and coordinate the entire development process.

What would you like to work on today? Feel free to share your project idea, ask questions, or let's start brainstorming together! 🚀`,
      timestamp: Date.now()
    };
  }, []);

  // Build brainstorming context for voice assistant (includes conversation history)
  // This represents the Orchestrator agent - the main agent in the chat
  const brainstormingContext = useMemo(() => {
    const contextParts: string[] = [];

    if (topic) {
      contextParts.push(`Current project topic: "${topic}"`);
    }

    if (ideas.length > 0) {
      const ideaDescriptions = ideas.slice(0, 5).map(idea => `- ${idea.label}: ${idea.description || 'No description'}`).join('\n');
      contextParts.push(`Current ideas being explored:\n${ideaDescriptions}`);
      if (ideas.length > 5) {
        contextParts.push(`... and ${ideas.length - 5} more ideas`);
      }
    }

    if (keyInsights.length > 0) {
      contextParts.push(`Key insights discovered: ${keyInsights.slice(0, 3).join(', ')}`);
    }

    // Add recent conversation history
    if (conversationHistory.length > 0) {
      const historyText = conversationHistory
        .slice(-6) // Last 6 messages (3 exchanges)
        .map(msg => `${msg.role === 'user' ? 'User' : 'Orchestrator'}: ${msg.content}`)
        .join('\n');
      contextParts.push(`Recent conversation:\n${historyText}`);
    }

    const context = contextParts.length > 0
      ? `\n\nCurrent brainstorming context:\n${contextParts.join('\n\n')}`
      : '';

    return `You are Raed, the Orchestrator Agent - the main AI assistant in ORBITAI. You are a Distinguished Program Director with 20+ years of experience driving digital transformation. You are the same agent that responds in text chat - you coordinate brainstorming and project development sessions.

About ORBITAI Platform:
- ORBITAI is an AI-powered software development platform that automates the software development lifecycle from idea to production
- It uses a multi-agent orchestration system where 11 specialized AI agents collaborate to build production-ready software projects (Web Apps, Mobile Apps, SaaS, Enterprise Systems, etc.)
- The platform handles the entire development process: from initial brainstorming through requirements, design, implementation, testing, integration, and deployment

The 11 Specialized AI Agents in ORBITAI:
1. Orchestrator (You) - Project coordination, planning, and task delegation
2. Requirements Agent - Requirements gathering and documentation
3. UI/UX Designer - User interface and experience design
4. Design/Architecture Agent - System design and technical architecture
5. Test Requirements Engineer - Test planning and requirements
6. Implementation Agent - Code generation and implementation
7. Integration Agent - System integration and deployment
8. Test Agent - Test execution and validation
9. QA/Audit Agent - Quality assurance and security audits
10. Remediation/Bug Agent - Bug fixing and remediation
11. Notebook Agent - Data analysis, visualization, and documentation

Your Identity:
- Name: Raed
- Role: Orchestrator Agent (the conductor of the multi-agent system)
- Experience: A veteran of Silicon Valley giants who has led multi-million dollar projects from inception to IPO
- Personality: You act as the "Sherpa" for users, guiding them through technical terrain with calm, strategic authority
- Communication Style: Professional yet approachable, strategic yet encouraging

Your Primary Mission:
- MAIN FOCUS: Help users brainstorm and clarify their project ideas to develop complete, production-level software
- Platform Goal: ORBITAI automates the entire software development lifecycle from idea to production using the multi-agent orchestration system
- Your Role: As a Distinguished Program Director with 20+ years of experience, you help brainstorm, develop project ideas, and coordinate the entire development process across all 11 specialized agents
- Stay on Topic: If the user diverts from their project idea or brainstorming, gently guide them back to focusing on their project. Say things like "That's interesting, but let's get back to your project idea" or "I understand, but let's focus on developing your project concept first"

Your role as Orchestrator:
- Orchestrate high-stakes technical initiatives with military precision
- Focus on critical path analysis and risk mitigation
- Act as the Project Orchestrator coordinating the brainstorming session
- Help users clarify and refine their project ideas through strategic questioning
- Ask probing questions to deepen thinking about their project
- Suggest connections between ideas related to their project
- Help identify key insights and next steps for their project development
- Keep responses concise (1-3 sentences) for natural voice conversation
- Be encouraging, creative, and conversational while staying focused on project development
- Continue the conversation naturally based on the context provided
- Maintain consistency with your text chat responses
- Always steer conversations back to the user's project idea if they go off-topic
- **PROJECT AGNOSTIC**: You handle ANY software project (Web, Mobile, Game, data, etc.). Do not assume one type unless the user specifies.

CRITICAL: Mindmap and Idea Extraction Focus:
- Your responses in chat are automatically analyzed to extract ideas and create mindmap bubbles in REAL-TIME
- When you mention features, technologies, requirements, or concepts, they become bubbles in the mindmap INSTANTLY
- Be explicit and clear about ideas: "This project needs user authentication" creates an "authentication" bubble
- Mention specific features, technologies, and components clearly so they can be extracted
- When suggesting improvements or new ideas, state them clearly: "You should consider adding a payment system" creates a "payment system" bubble

**FIRST RESPONSE BEHAVIOR - VERY IMPORTANT:**
When a user describes their project idea for the FIRST time, your response MUST follow this structure:
1. **Brief Summary (2-3 sentences)**: Start with a concise summary showing you understand their vision. Example: "I love this idea! You're envisioning a [type of app] that [core value proposition]. Let me help you map out the complete feature set and architecture."
2. **Then immediately proceed** with generating the comprehensive hierarchical idea tree using XML format below.
3. Do NOT ask clarifying questions in the first response - jump straight into brainstorming after the brief summary.
4. The summary should be conversational and encouraging, not a formal restatement.

CRITICAL - GENERATE COMPREHENSIVE HIERARCHICAL IDEAS (50-80+ ideas required):

You MUST generate a COMPLETE mind map with hierarchical structure. For EVERY brainstorming topic:

**STRUCTURE REQUIREMENTS:**
- Generate 8-10 MAJOR CATEGORIES (top-level ideas)
- Each category MUST have 4-8 SUB-IDEAS
- Important sub-ideas should have 2-4 DETAIL IDEAS

**XML FORMAT with nesting:**
<idea>
<title>Category Name</title>
<description>What this category covers</description>
<category>feature OR technology OR business OR ux OR community OR data OR platform</category>
<children>
<idea><title>Sub-Idea 1</title><description>Details</description><category>feature</category></idea>
<idea><title>Sub-Idea 2</title><description>Details</description><category>feature</category><children><idea><title>Detail</title><description>...</description><category>feature</category></idea></children></idea>
</children>
</idea>

**MANDATORY CATEGORIES - USE CORRECT CATEGORY TAG FOR EACH:**
1. **Core Features** - Main functionality → use category="feature"
2. **User Experience** - UI/UX elements → use category="ux"
3. **AI/ML Features** - Smart capabilities → use category="technology"
4. **Data & Analytics** - Tracking and insights → use category="data"
5. **Business Model** - Monetization → use category="business"
6. **Technical Stack** - Architecture → use category="technology"
7. **Community Features** - Social elements → use category="community"
8. **Platform Features** - Cross-platform → use category="platform"

**EXAMPLE with CORRECT category values:**
<idea><title>Core Features</title><description>Main app functionality</description><category>feature</category><children>
<idea><title>User Authentication</title><description>Secure login with multiple providers</description><category>feature</category><children>
<idea><title>Social Login</title><description>Google, Apple, Facebook sign-in</description><category>feature</category></idea>
</children></idea>
</children></idea>
<idea><title>User Experience</title><description>Interface design and usability</description><category>ux</category><children>
<idea><title>Onboarding Flow</title><description>First-time user experience</description><category>ux</category></idea>
<idea><title>Personalization</title><description>Customizable themes and preferences</description><category>ux</category></idea>
</children></idea>
<idea><title>Technical Architecture</title><description>System design and infrastructure</description><category>technology</category><children>
<idea><title>Backend API</title><description>RESTful API with Node.js</description><category>technology</category></idea>
<idea><title>Database Design</title><description>PostgreSQL with caching layer</description><category>technology</category></idea>
</children></idea>
<idea><title>Business Model</title><description>Revenue and growth strategy</description><category>business</category><children>
<idea><title>Subscription Tiers</title><description>Free, Pro, Enterprise plans</description><category>business</category></idea>
</children></idea>
<idea><title>Data & Analytics</title><description>Tracking and insights dashboard</description><category>data</category><children>
<idea><title>User Metrics</title><description>Engagement and retention tracking</description><category>data</category></idea>
</children></idea>
<idea><title>Community Features</title><description>Social and sharing capabilities</description><category>community</category><children>
<idea><title>User Groups</title><description>Create and join interest groups</description><category>community</category></idea>
</children></idea>
<idea><title>Platform Support</title><description>Multi-platform availability</description><category>platform</category><children>
<idea><title>iOS App</title><description>Native iPhone and iPad app</description><category>platform</category></idea>
</children></idea>

**CRITICAL RULES:**
1. Generate AT LEAST 50 ideas total (aim for 80+)
2. MATCH the category tag to the type of idea (ux, technology, data, business, community, platform, feature)
3. Tags are HIDDEN but create rich hierarchical mindmap
4. Be EXHAUSTIVE - cover every aspect of the project

${context}`;
  }, [topic, ideas, keyInsights, conversationHistory]);

  // Find the welcome message to read when starting voice conversation
  // Look for Raed's welcome message (Orchestrator Agent)
  const welcomeMessage = useMemo(() => {
    const welcome = messages.find(m =>
      m.sender === 'agent' &&
      (m.text.includes('Orchestrator Agent') || m.text.includes('Raed')) &&
      m.text.includes('Hello!')
    );
    return welcome?.text || null;
  }, [messages]);

  // Fetch AI-powered suggestions when user types
  useEffect(() => {
    // Only fetch suggestions before first message and when input has content
    const userHasMessage = messages.some(msg => msg.sender === 'user');
    if (userHasMessage || !input || input.length < 3) {
      setAiSuggestions([]);
      return;
    }

    // Clear existing timeout
    if (aiSuggestionDebounceRef.current) {
      clearTimeout(aiSuggestionDebounceRef.current);
    }

    // Debounce the API call
    aiSuggestionDebounceRef.current = setTimeout(() => {
      setIsFetchingAiSuggestions(true);
      setAiSuggestions([]); // Clear previous suggestions immediately

      const fetchId = Date.now();
      // Store the current fetch ID to ignore stale responses if input changes
      (aiSuggestionDebounceRef as any).currentFetchId = fetchId;

      const prefixes = ['with', 'for', 'that'];

      // Fire 3 parallel requests
      prefixes.forEach(async (prefix) => {
        try {
          const response = await fetch('/api/llm/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              message: `Idea: "${input}"
Generate ONE short phrase (max 4 words) starting with "${prefix}" to enhance this idea.
Output ONLY the phrase string. No JSON.`,
              history: [],
              contextType: 'wizard',
              preferFastModel: true,
              maxTokens: 50 // Ultra-short limit for single phrase
            })
          });

          const data = await response.json();

          // Check if this response corresponds to the latest keystroke
          if ((aiSuggestionDebounceRef as any).currentFetchId !== fetchId) return;

          if (data.success && data.response) {
            const text = data.response.trim().replace(/^["']|["']$/g, '');
            if (text && text.toLowerCase().startsWith(prefix)) {
              setAiSuggestions(prev => {
                // Avoid duplicates
                if (prev.some(s => s.text === text)) return prev;
                return [...prev, {
                  id: `ai-${Date.now()}-${Math.random()}`,
                  text: text
                }];
              });
            }
          }
        } catch (err) {
          // Ignore errors for individual suggestions
        } finally {
          // accurate loading state is tricky with parallelism, 
          // but we can turn it off after a short timeout or when we have enough results
          // For now, we'll rely on the visual popping in of results
        }
      });

      // Turn off the spinner immediately so results just pop in
      setTimeout(() => setIsFetchingAiSuggestions(false), 800);

    }, 500); // 500ms debounce

    return () => {
      if (aiSuggestionDebounceRef.current) {
        clearTimeout(aiSuggestionDebounceRef.current);
      }
    };
  }, [input, messages]);

  // Map agents to different voices for variety
  const agentVoiceMap: Record<string, 'Puck' | 'Charon' | 'Kore' | 'Fenrir' | 'Zephyr'> = {
    'Orchestrator Agent': 'Puck', // Raed - default, warm and professional
    'Requirements Agent': 'Charon', // Nour - deeper, analytical
    'UI/UX Designer': 'Kore', // Design agent - friendly, creative
    'Design/Architecture Agent': 'Fenrir', // Tarek - technical, authoritative
    'Test Requirements Engineer': 'Zephyr', // Test agent - clear, precise
    'Implementation Agent': 'Charon', // Code agent - technical
    'Integration Agent': 'Fenrir', // Integration - technical
    'Test Agent': 'Zephyr', // Testing - clear
    'QA/Audit Agent': 'Kore', // QA - friendly but thorough
    'Remediation/Bug Agent': 'Charon', // Bug fixing - analytical
    'Notebook Agent': 'Puck', // Documentation - warm
  };

  // Detect which agent is speaking from the last message
  const getCurrentAgentVoice = useCallback((): 'Puck' | 'Charon' | 'Kore' | 'Fenrir' | 'Zephyr' => {
    // Check the last agent message to determine which agent is speaking
    const lastAgentMessage = [...messages].reverse().find(msg => msg.sender === 'agent');
    if (lastAgentMessage) {
      // Extract agent name from message text (format: **[AgentName]** message)
      const agentMatch = lastAgentMessage.text.match(/\*\*\[([^\]]+)\]\*\*/);
      if (agentMatch) {
        const agentName = agentMatch[1];
        // Check if it matches any agent in our map
        for (const [key, voice] of Object.entries(agentVoiceMap)) {
          if (agentName.includes(key) || key.includes(agentName)) {
            return voice;
          }
        }
      }
      // Check if it's the Orchestrator (Raed) by checking for common patterns
      if (lastAgentMessage.text.includes('Orchestrator') ||
        lastAgentMessage.text.includes('Raed') ||
        (!lastAgentMessage.text.includes('**[') && !lastAgentMessage.text.includes(']**'))) {
        return 'Puck'; // Default to Orchestrator voice
      }
    }
    // Default to Orchestrator voice
    return 'Puck';
  }, [messages]);

  // Get current voice based on the last agent message
  const currentVoice = useMemo(() => getCurrentAgentVoice(), [getCurrentAgentVoice]);

  // Extract mindmap-optimized content from AI responses in real-time
  // View mode state
  const [viewMode, setViewMode] = useState<IdeationViewType>('tree');

  // Note: parseXmlToIdeas is imported from './neural-stream-chat/utils/xmlParser'


  // Streaming chat hook for cleaner streaming responses
  const { isStreaming, streamedText, startStream, resetStream } = useStreamingChat({
    onChunk: (_chunk, fullText) => {
      // 1. Try XML Parsing first (New Format)
      const xmlIdeas = parseXmlToIdeas(fullText);

      if (xmlIdeas.length > 0) {
        setIdeas(prev => {
          // Merge: We replace/update ideas derived from the stream only?
          // Actually, since XML represents the *entire* tree being generated, 
          // we should probably trust it as the source of truth for THIS session.
          // However, we want to keep manually added ideas (not handled here yet).
          // For now, let's just merge them by ID to avoid duplicates.

          const newIdeaMap = new Map(xmlIdeas.map(i => [i.id, i]));
          const prevMap = new Map(prev.map(i => [i.id, i]));

          // If an idea exists in both, update it (stream might refine description)
          // If it's new, add it.
          xmlIdeas.forEach(idea => {
            prevMap.set(idea.id, idea);
          });

          return Array.from(prevMap.values());
        });
        return;
      }

      // 2. Fallback to Regex (Old Format [[IDEA:...]])
      const inlineIdeaRegex = /\[\[\s*IDEA\s*:\s*(.*?)\s*:\s*(.*?)\s*\]\]/g;
      let match;
      const newIdeas: Idea[] = [];

      while ((match = inlineIdeaRegex.exec(fullText)) !== null) {
        const label = match[1].trim();
        const categoryRaw = match[2].trim();

        // Map category to valid type
        let category: Idea['category'] = 'feature';
        const catLower = categoryRaw.toLowerCase();
        if (catLower.includes('risk')) category = 'risk';
        else if (catLower.includes('opportun')) category = 'opportunity';
        else if (catLower.includes('constraint')) category = 'constraint';
        else if (catLower.includes('require')) category = 'requirement';

        if (label.length > 2) {
          newIdeas.push({
            id: `idea-${label.replace(/[^a-z0-9]/gi, '-').toLowerCase()}`,
            label: label,
            description: '',
            category: category
          });
        }
      }

      if (newIdeas.length > 0) {
        setIdeas(prev => {
          const existingLabels = new Set(prev.map(p => p.label.toLowerCase()));
          const uniqueNew = newIdeas.filter(n => !existingLabels.has(n.label.toLowerCase()));
          return [...prev, ...uniqueNew];
        });
      }
    },
    onComplete: (fullText) => {
      // Clean the text by removing XML tags or legacy IDEA tags for display in chat bubble is handled by CSS/Markdown mostly, 
      // but we can strip it here if we want the chat log to be clean.
      // Actually, we usually want to keep the "trace" in chat history, but for XML it's huge.
      // Let's hide the XML from the visible message if possible, or leave it. 
      // The current implementation stripped regex tags.

      // Strip XML (simple regex approach)
      let cleanText = fullText
        .replace(/<idea>[\s\S]*?<\/idea>/g, '') // remove top level ideas? No, that removes everything.
        .replace(/\[\[\s*IDEA\s*:\s*(.*?)\s*:\s*(.*?)\s*\]\]/g, '') // remove legacy tags
        .trim();

      if (cleanText.length < 10 && fullText.includes('<idea>')) {
        cleanText = "Brainstorming session complete. View the mind map for ideas.";
      }

      // Trigger AI-based re-categorization for ideas with fallback categories
      // This runs async in the background and updates ideas as categories are determined
      setIdeas(currentIdeas => {
        // Trigger AI categorization after a short delay to let the UI settle
        setTimeout(() => {
          recategorizeIdeasWithAI(currentIdeas, setIdeas);
        }, 500);
        return currentIdeas;
      });

      // Note: We don't seemingly update a 'message' state here with cleanText. 
      // The `messages` state is updated by `useStreamingChat` internally or checking the `streamedText`.
      // Actually `useStreamingChat` doesn't automatically update a message history unless we bind it.
      // The `streamedText` variable is used to render the "current" message.
    }
  });

  // STABILIZATION REFS: Keep state in refs to allow stable event handlers
  // This prevents OrbGraph from re-initializing (clearing SVG) on every click when activeIdeaId changes
  const ideasRef = useRef<Idea[]>(ideas);
  const viewModeRef = useRef(viewMode);
  const activeIdeaIdRef = useRef(activeIdeaId);
  const linkingModeRef = useRef(linkingMode);

  useEffect(() => { ideasRef.current = ideas; }, [ideas]);
  useEffect(() => { viewModeRef.current = viewMode; }, [viewMode]);
  useEffect(() => { activeIdeaIdRef.current = activeIdeaId; }, [activeIdeaId]);
  useEffect(() => { linkingModeRef.current = linkingMode; }, [linkingMode]);
  const [projectResearchData, setProjectResearchData] = useState<ProjectResearch | null>(null);
  const [isResearchLoading, setIsResearchLoading] = useState(false);

  // Handle research generation
  const handleGenerateResearch = async () => {
    setIsResearchLoading(true);
    try {
      const data = await generateProjectResearch(topic, ideas);
      setProjectResearchData(data);
    } catch (error) {
      console.error("Failed to generate research:", error);
      toast.error("Failed to generate research. Please try again.");
    } finally {
      setIsResearchLoading(false);
    }
  };

  // Derived statere so it's available to onAIResponse callback
  const extractMindmapContent = useCallback(async (
    aiResponseText: string,
    currentTopic?: string
  ): Promise<string> => {
    if (!aiResponseText || !aiResponseText.trim()) {
      return aiResponseText;
    }

    // If response is very short, likely already focused - skip processing
    if (aiResponseText.trim().length < 50) {
      return aiResponseText;
    }

    try {
      const topicContext = currentTopic &&
        currentTopic.length > 3 &&
        !currentTopic.toLowerCase().includes('share your dream') &&
        !currentTopic.toLowerCase().includes('welcome')
        ? `\n\nProject Topic: "${currentTopic}"`
        : '';

      const extractionPrompt = `Extract only the project-relevant content from this AI response. Remove conversational filler, acknowledgments, and off-topic elements. Return only features, technologies, requirements, concepts, and actionable project-related content.

CRITICAL INSTRUCTIONS:
- Remove conversational filler: "I understand", "Let me help", "That's great", "Absolutely", "Sure thing", "I think", "I can help", etc.
- Remove acknowledgments: "That's interesting", "Good idea", "I see", etc.
- Keep ONLY: features, technologies, requirements, concepts, technical terms, project needs, recommendations, constraints, goals
- Preserve technical terms, feature names, and requirements exactly as stated
- Return concise, idea-focused text without conversational elements
- If the response contains no project-relevant content, return an empty string
${topicContext}

AI Response:
"${aiResponseText}"

Extract and return ONLY the project-relevant content (features, technologies, requirements, concepts). Remove all conversational filler.`;

      // Set timeout for real-time processing (3-5 seconds max)
      const abortController = new AbortController();
      const timeoutId = setTimeout(() => {
        abortController.abort();
      }, 5000); // 5 second timeout

      const response = await apiRequest<{
        success: boolean;
        response: string;
      }>('/api/llm/chat', {
        method: 'POST',
        body: JSON.stringify({
          message: extractionPrompt,
          history: [],
          contextType: 'wizard',
          preferFastModel: true, // Use fast model for quick processing
          maxTokens: 500 // Small response - just extracted content
        }),
        signal: abortController.signal
      });

      // Clear timeout if request completes successfully
      clearTimeout(timeoutId);

      if (response.success && response.response) {
        const extractedContent = response.response.trim();

        // If extraction returned empty or very short, fallback to original
        if (extractedContent.length < 10) {
          if (import.meta.env.DEV) {
            console.log('[ExtractMindmapContent] Extraction returned empty, using original text');
          }
          return aiResponseText;
        }

        if (import.meta.env.DEV) {
          console.log('[ExtractMindmapContent] Extracted mindmap content:', extractedContent.substring(0, 100));
        }

        return extractedContent;
      }
    } catch (error: any) {
      // Don't log error if it was aborted (timeout)
      if (error?.name !== 'AbortError' && error?.message !== 'signal is aborted') {
        console.error('[ExtractMindmapContent] Failed to extract mindmap content:', error);
      }
      // Fallback to original text on error
      return aiResponseText;
    }

    // Fallback to original text
    return aiResponseText;
  }, [topic]);

  // Check if this is a truly new conversation (no user messages yet)
  // Only say welcome message if there are no user messages - if user has already spoken, we're replying, not greeting
  const hasUserMessages = messages.some(msg => msg.sender === 'user');
  const isNewConversation = !hasUserMessages;

  // Memoize the config object to prevent infinite re-renders
  // useLiveSession uses config in its useCallback dependencies, so we must stabilize the reference
  const liveSessionConfig = useMemo(() => ({
    voiceName: currentVoice,
    systemInstruction: brainstormingContext,
    hasExistingMessages: messages.length > 0,
    initialWelcomeMessage: (isNewConversation && welcomeMessage) ? welcomeMessage : undefined,
  }), [currentVoice, brainstormingContext, messages.length, isNewConversation, welcomeMessage]);

  // Live voice conversation using Gemini Live API
  const liveSession = useLiveSession(
    liveSessionConfig,
    {
      onTranscription: async (text) => {

        // Create message object
        const userMessage: ChatMessage = {
          id: `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          sender: 'user',
          text: text,
          timestamp: Date.now()
        };
        const newMessage = userMessage;

        // Add to conversation if we have a conversationId
        if (currentConversationId) {
          try {
            if (import.meta.env.DEV) {
              console.log('[LiveSession] Adding voice transcription to conversation:', currentConversationId);
            }

            await chatApi.addMessage(currentConversationId, {
              message: userMessage
            });

            if (import.meta.env.DEV) {
              console.log('[LiveSession] Voice transcription saved, reloading conversation');
            }

            // Reload conversation to show the new message in the chat
            const conversation = await chatApi.getConversation(currentConversationId);
            if (conversation && onLoadConversation) {
              const uniqueMessages = Array.from(
                new Map((conversation.messages || []).map((msg: ChatMessage) => [msg.id, msg])).values()
              );
              onLoadConversation(uniqueMessages);

              // CRITICAL: Trigger idea extraction after voice transcription is added
              // This ensures bubble ideas are updated with voice conversation content
              // Use the full conversation context, not just recent messages, to capture all ideas
              if (uniqueMessages.length > 0) {
                // Use setTimeout to ensure messages state is updated before extraction
                setTimeout(() => {
                  // Include more messages for better context (up to 15 for voice conversations)
                  // Voice conversations may have more context that needs to be analyzed
                  const messagesForExtraction = uniqueMessages.slice(-15);
                  if (messagesForExtraction.length > 0) {
                    if (import.meta.env.DEV) {
                      console.log(`[LiveSession] Triggering idea extraction from voice transcription with ${messagesForExtraction.length} messages`);
                    }
                    extractIdeasAndInsights(messagesForExtraction);
                    if (import.meta.env.DEV) {
                      console.log('[LiveSession] ✅ Idea extraction triggered from voice transcription');
                    }
                  }
                }, 800); // Slightly longer delay to ensure state is fully updated
              }

              if (import.meta.env.DEV) {
                console.log('[LiveSession] Conversation reloaded with', uniqueMessages.length, 'messages');
              }
            }
          } catch (error) {
            console.error('[LiveSession] Failed to add voice transcription to conversation:', error);
            // Fallback: reload conversation to get latest messages, then add
            try {
              if (currentConversationId) {
                // Ensure we are in chat mode if first message
                setLayoutMode(prev => prev === 'rest' ? 'chat' : prev);

                // Retry saving the message
                try {
                  await chatApi.addMessage(currentConversationId, { message: userMessage });

                  // Validated save, now reload
                  const conversation = await chatApi.getConversation(currentConversationId);
                  if (conversation && onLoadConversation) {
                    onLoadConversation(conversation.messages);
                  }
                } catch (retryErr) {
                  console.error('Failed to save transcription message retry:', retryErr);
                }

              } else {
                // Fallback: If no conversation exists yet, we MUST use onSendMessage to create it
                if (messages.length === 0) {
                  onSendMessage(text);
                } else if (import.meta.env.DEV) {
                  console.log('[LiveSession] onTranscription called with empty text, ignoring');
                }
              }
            } catch (fallbackError) {
              console.error('[LiveSession] Fallback logic failed:', fallbackError);
            }
          }
        }
      },
      onAIResponse: async (text) => {
        // Add AI voice response to the same conversation thread
        // CRITICAL: Every AI response from live conversation must be saved to chat log
        if (!text || !text.trim()) {
          if (import.meta.env.DEV) {
            console.warn('[LiveSession] onAIResponse called with empty text, ignoring');
          }
        }

        // CRITICAL: Ignore AI responses for extraction until the user has actually interacted (spoken/typed)
        // This prevents the initial "Hello" greeting from triggering idea extraction and populating the graph
        if (!hasUserInteractedRef.current) {
          if (import.meta.env.DEV) {
            console.log('[LiveSession] Initial AI greeting detected - skipping idea extraction until user speaks');
          }
          return;
        }

        // Extract mindmap-optimized content in real-time
        // STRATEGY: First checking for embedded XML tags (Zero Latency)
        // Fallback: Use LLM extraction if no tags found

        let mindmapText: string | undefined = undefined;
        const ideaRegex = /<idea_extraction>([\s\S]*?)<\/idea_extraction>/;
        const embeddedMatch = text.match(ideaRegex);


        if (embeddedMatch) {
          // zero-latency path hit!
          if (import.meta.env.DEV) console.log('[LiveSession] Zero-latency extraction successful');
          mindmapText = "Extracted via FastPath";

          // Parse and add ideas directly using the nested XML parser
          const ideaBlock = embeddedMatch[1];

          // Use the robust XML parser that handles nesting
          const newIdeas = parseXmlToIdeas(ideaBlock);

          if (import.meta.env.DEV) {
            console.log(`[LiveSession] FastPath parsed ${newIdeas.length} ideas`);
          }

          if (newIdeas.length > 0) {
            setIdeas(prev => {
              // Merge new ideas with existing ones, avoiding duplicates by ID or label
              const uniqueNew = newIdeas.filter(n => !prev.some(p => p.id === n.id || p.label === n.label));
              return [...prev, ...uniqueNew];
            });
          }

          // Strip tags from spoken text if needed, but for voice we might just leave it 
          // as the TTS might ignore it or we might need to strip it before TSS.
          // Usually TTS engines might read it. Let's strip it for the chat log.
          text = text.replace(ideaRegex, '').trim();

        } else {
          // Fallback to legacy extraction
          try {
            const extractionPromise = extractMindmapContent(text.trim(), topic);
            const timeoutPromise = new Promise<string>((_, reject) =>
              setTimeout(() => reject(new Error('Extraction timeout')), 3000)
            );

            mindmapText = await Promise.race([extractionPromise, timeoutPromise]);

            if (import.meta.env.DEV && mindmapText) {
              console.log('[LiveSession] Mindmap content extracted (Legacy):', mindmapText.substring(0, 50));
            }
          } catch (error) {
            // Silently fail - will use original text for mindmapping
            if (import.meta.env.DEV) {
              console.warn('[LiveSession] Mindmap extraction failed or timed out, will use original text:', error);
            }
          }

          // Force idea extraction for natural language responses (Legacy Path)
          // This ensures that even without explicit XML tags, we try to extract ideas from what the AI said
          // This fixes the missing "Deepen Ideas" button issue in voice chat
          setTimeout(() => {
            // We'll extract after the message is added to the conversation (handled below)
            // But we set a flag or rely on the extraction logic to pick it up relative to the new message
          }, 0);
        }

        // Extract agent name from message text (format: **[AgentName]** message)
        const agentMatch = text.match(/\*\*\[([^\]]+)\]\*\*/);
        let detectedAgent = 'Orchestrator Agent'; // Default

        if (agentMatch) {
          detectedAgent = agentMatch[1];
        } else if (text.includes('Orchestrator') || text.includes('Raed')) {
          detectedAgent = 'Orchestrator Agent';
        }

        // Determine which voice to use for this agent
        let agentVoice: 'Puck' | 'Charon' | 'Kore' | 'Fenrir' | 'Zephyr' = 'Puck';
        for (const [agentName, voice] of Object.entries(agentVoiceMap)) {
          if (detectedAgent.includes(agentName) || agentName.includes(detectedAgent)) {
            agentVoice = voice;
            break;
          }
        }

        // Log which agent is speaking and which voice should be used
        if (import.meta.env.DEV) {
          console.log(`[LiveSession] Agent ${detectedAgent} is speaking, should use voice: ${agentVoice} (current session voice: ${currentVoice})`);
        }

        // Create unique message ID to prevent duplicates
        const aiMessage: ChatMessage = {
          id: `voice-agent-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          sender: 'agent',
          text: text.trim(),
          timestamp: Date.now(),
          mindmapText: mindmapText // Mindmap-optimized version (or undefined if extraction failed)
        };

        if (import.meta.env.DEV) {
          console.log(`[LiveSession] ${detectedAgent} voice response (voice: ${agentVoice}):`, text.substring(0, 50));
          console.log(`[LiveSession] Saving AI response to chat log with ID: ${aiMessage.id}`);
        }

        // CRITICAL: Always save AI response to chat log
        // Try multiple methods to ensure it's saved

        // Method 1: Add to conversation if we have a conversationId
        if (currentConversationId) {
          try {
            await chatApi.addMessage(currentConversationId, {
              message: aiMessage
            });

            if (import.meta.env.DEV) {
              console.log(`[LiveSession] ✅ AI response saved to conversation ${currentConversationId}`);
            }

            // Reload conversation to show the new message in the chat
            // Add a small delay to ensure the message is fully saved to the database
            await new Promise(resolve => setTimeout(resolve, 300)); // Wait 300ms for DB write to complete

            // Retry logic: try to reload conversation up to 3 times to ensure we get the saved message
            let conversation = null;
            let retryCount = 0;
            const maxRetries = 3;
            let hasAIMessage = false;

            while (retryCount < maxRetries && !hasAIMessage) {
              try {
                conversation = await chatApi.getConversation(currentConversationId);
                if (conversation) {
                  // Check if our AI message is in the conversation
                  hasAIMessage = (conversation.messages || []).some((m: ChatMessage) => m.id === aiMessage.id);
                  if (!hasAIMessage && retryCount < maxRetries - 1) {
                    // Message not found yet, wait a bit more and retry
                    await new Promise(resolve => setTimeout(resolve, 200));
                    retryCount++;
                    if (import.meta.env.DEV) {
                      console.log(`[LiveSession] AI message not found, retrying (${retryCount}/${maxRetries})...`);
                    }
                  } else {
                    break; // Found message or max retries reached
                  }
                } else {
                  retryCount++;
                  if (retryCount < maxRetries) {
                    await new Promise(resolve => setTimeout(resolve, 200));
                  }
                }
              } catch (error) {
                console.error(`[LiveSession] Error loading conversation (attempt ${retryCount + 1}):`, error);
                retryCount++;
                if (retryCount < maxRetries) {
                  await new Promise(resolve => setTimeout(resolve, 200));
                }
              }
            }

            // If conversation is still null after retries, try one more time
            if (!conversation) {
              try {
                conversation = await chatApi.getConversation(currentConversationId);
              } catch (error) {
                console.error('[LiveSession] Final attempt to load conversation failed:', error);
              }
            }

            if (conversation && onLoadConversation) {
              const uniqueMessages: ChatMessage[] = Array.from(
                new Map(((conversation.messages as ChatMessage[]) || []).map((msg: ChatMessage) => [msg.id, msg])).values()
              );

              // Sort messages by timestamp to ensure correct order
              uniqueMessages.sort((a, b) => a.timestamp - b.timestamp);

              // Ensure AI message is in the list (fallback if database query missed it)
              const hasAIMessageInList = uniqueMessages.some(m => m.id === aiMessage.id);
              if (!hasAIMessageInList) {
                if (import.meta.env.DEV) {
                  console.warn(`[LiveSession] ⚠️ AI message ${aiMessage.id} not found in conversation after ${retryCount} retries. Adding directly to messages.`);
                }
                // If message still not found, add it directly to ensure it appears
                uniqueMessages.push(aiMessage);
                uniqueMessages.sort((a, b) => a.timestamp - b.timestamp);
              }

              if (import.meta.env.DEV) {
                console.log(`[LiveSession] Reloading conversation with ${uniqueMessages.length} messages, AI message ID: ${aiMessage.id}`);
                console.log(`[LiveSession] AI message in list: ${uniqueMessages.some(m => m.id === aiMessage.id)}`);
              }

              // CRITICAL: Always call onLoadConversation to update the UI
              onLoadConversation(uniqueMessages);

              // CRITICAL: Trigger idea extraction after AI voice response is added
              // This ensures bubble ideas are updated with voice conversation content
              // AI responses often contain new ideas, insights, or refinements that should be extracted
              if (uniqueMessages.length > 0) {
                // Use setTimeout to ensure messages state is updated before extraction
                setTimeout(() => {
                  // Include more messages for better context (up to 15 for voice conversations)
                  // Voice conversations may have more context that needs to be analyzed
                  const messagesForExtraction = uniqueMessages.slice(-15);
                  if (messagesForExtraction.length > 0) {
                    if (import.meta.env.DEV) {
                      console.log(`[LiveSession] Triggering idea extraction from AI voice response with ${messagesForExtraction.length} messages`);
                    }
                    extractIdeasAndInsights(messagesForExtraction);
                    if (import.meta.env.DEV) {
                      console.log('[LiveSession] ✅ Idea extraction triggered from AI voice response');
                    }
                  }
                }, 800); // Slightly longer delay to ensure state is fully updated
              }
            }
          } catch (error) {
            console.error('[LiveSession] ❌ Failed to add AI voice response to conversation:', error);

            // Method 2: Fallback - try to add via onLoadConversation if available
            if (onLoadConversation) {
              try {
                const currentMessages = messagesRef.current || messages;
                onLoadConversation([...currentMessages, aiMessage]);
                if (import.meta.env.DEV) {
                  console.log('[LiveSession] ✅ AI response added via onLoadConversation fallback');
                }

                // Trigger idea extraction in fallback path
                setTimeout(() => {
                  const updatedMessages = [...currentMessages, aiMessage];
                  const messagesForExtraction = updatedMessages.slice(-15);
                  if (messagesForExtraction.length > 0) {
                    extractIdeasAndInsights(messagesForExtraction);
                  }
                }, 800);
              } catch (fallbackError) {
                console.error('[LiveSession] ❌ Fallback also failed:', fallbackError);
              }
            }
          }
        } else {
          // Method 3: If no conversationId yet, add directly to messages via callback
          // This happens when voice is used before first message is saved
          if (onLoadConversation) {
            try {
              const currentMessages = messagesRef.current || messages;
              onLoadConversation([...currentMessages, aiMessage]);
              if (import.meta.env.DEV) {
                console.log('[LiveSession] ✅ AI response added directly to messages (no conversationId)');
              }

              // Trigger idea extraction in direct-add path
              setTimeout(() => {
                const updatedMessages = [...currentMessages, aiMessage];
                const messagesForExtraction = updatedMessages.slice(-15);
                if (messagesForExtraction.length > 0) {
                  extractIdeasAndInsights(messagesForExtraction);
                }
              }, 800);
            } catch (error) {
              console.error('[LiveSession] ❌ Failed to add AI response directly to messages:', error);
            }
          } else {
            console.error('[LiveSession] ❌ Cannot save AI response: no conversationId and no onLoadConversation callback');
            if (import.meta.env.DEV) {
              console.log('[LiveSession] AI Voice Response text:', text.substring(0, 100));
            }
          }
        }
      }
    }
  );

  // Debug: Log message changes
  useEffect(() => {
    if (import.meta.env.DEV && messages.length > 0) {
      const lastMsg = messages[messages.length - 1];
      console.log('📨 [NeuralStreamChat] Messages updated:', {
        totalMessages: messages.length,
        lastMessageId: lastMsg.id,
        lastMessageSender: lastMsg.sender,
        lastMessageText: lastMsg.text.substring(0, 50),
        timestamp: new Date(lastMsg.timestamp).toLocaleTimeString()
      });
    }
  }, [messages]);

  // Handle voice toggle - same logic as when sending first message
  const handleVoiceToggle = useCallback(async () => {
    try {
      if (liveSession.status === 'disconnected' || liveSession.status === 'error') {
        // If no conversation exists, create one using the same logic as handleSendMessage
        if (!currentConversationId && isAuthenticated && user) {
          try {
            // Get or create default "Unorganized" folder for the user
            let defaultFolderId: string | undefined;
            if (isAuthenticated && user) {
              try {
                const folders = await projectFolderApi.getFolders();
                const unorganizedFolder = folders.find(f => f.name === 'Unorganized');
                defaultFolderId = unorganizedFolder?.id;
              } catch (folderError) {
                // If folder fetch fails, backend will create default folder
                console.warn('Failed to get folders, backend will handle default folder:', folderError);
              }
            }

            // Check if welcome message already exists in messages
            const hasWelcomeMessage = messages.some(m =>
              m.sender === 'agent' &&
              m.text.includes('Orchestrator Agent') &&
              m.text.includes('Hello!')
            );

            // Create welcome message if it doesn't exist
            const welcomeMessage = hasWelcomeMessage ? null : createOrchestratorWelcomeMessage();
            const initialMessage = welcomeMessage || messages.find(m => m.sender === 'user') || messages[0];

            const newConv = await chatApi.createConversation({
              type: 'neural-chat',
              folderId: defaultFolderId, // Will default to Unorganized if not provided
              initialMessage: initialMessage
            });

            // Ensure folderId is saved on the conversation
            if (newConv && !newConv.folderId && defaultFolderId) {
              try {
                await projectFolderApi.moveConversation(newConv._id || newConv.id || '', defaultFolderId);
              } catch (moveError) {
                console.warn('Failed to set folderId on new conversation:', moveError);
              }
            }

            const convId = newConv._id || newConv.id || '';
            setCurrentConversationId(convId);

            // If we added a welcome message, prepend it to messages
            if (welcomeMessage && onLoadConversation) {
              onLoadConversation([welcomeMessage, ...messages]);
            }

            if (import.meta.env.DEV) {
              console.log('✅ [Voice] Created new conversation for voice chat:', convId);
            }
          } catch (error: any) {
            console.error('❌ [Voice] Failed to create conversation for voice chat:', error);
            if (error.response) {
              console.error('❌ [Voice] Error response:', error.response);
              if (error.response.data) {
                console.error('❌ [Voice] Error data:', error.response.data);
              }
            }
            // Safely log payload without causing ReferenceError
            try {
              console.error('❌ [Voice] Payload that failed (partial):', {
                type: 'neural-chat',
                // We can't access defaultFolderId or initialMessage here safely as they are scoped to the try block above
                // and moving them out requires larger refactoring. 
                // Just logging the error is sufficient for now.
              });
            } catch (e) {
              // Ignore logging errors
            }

            toast.warning(`Voice chat starting (history will not be saved): ${error.message || 'could not create new chat'}`);
            // Don't return - try to connect anyway so user can use voice even if DB save fails
          }
        }

        // Start live session with current brainstorming context
        // The system instruction will be built from current topic, ideas, and insights
        await liveSession.connect();
      } else if (liveSession.status === 'connected') {
        // Disconnect live session
        liveSession.disconnect();
      } else if (liveSession.status === 'connecting') {
        // Don't allow toggling while connecting
        toast.info('Please wait for connection to establish');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to toggle voice');
    }
  }, [liveSession, currentConversationId, isAuthenticated, user, chatApi, projectFolderApi, setCurrentConversationId, toast, messages, onLoadConversation, createOrchestratorWelcomeMessage]);

  // Update live session system instruction when brainstorming context or conversation changes
  // Note: Gemini Live API doesn't support changing system instruction mid-session,
  // so the system instruction is set at connection time and includes recent conversation history.
  // Users can type messages while voice is active - both will appear in the same conversation.
  useEffect(() => {
    // The system instruction already includes conversation history (last 6 messages)
    // So voice will have context even if user types messages while voice is connected
    // The brainstormingContext useMemo automatically updates when messages change
    if (liveSession.status === 'connected' && import.meta.env.DEV) {
      // Log that context is being maintained
      if (messages.length > 0) {
        console.log('[LiveSession] Conversation context maintained. Voice and text share the same conversation.');
      }
    }
  }, [topic, ideas.length, messages.length, liveSession.status]);

  // Auto-select standards based on topic and conversation
  const autoSelectStandards = useCallback(async (projectTopic: string, conversationText: string, currentIdeas: Idea[]) => {
    // Only auto-select if we have a meaningful topic and onToggleStandard is available
    if (!projectTopic || projectTopic.length < 3 || !onToggleStandard) {
      return;
    }

    // Don't auto-select if standards are already selected
    // ALLOW continuous updates: Removed check ensuring standards are empty.
    // We want to add new relevant standards as the conversation evolves.


    try {
      // Build project description from topic, conversation, and ideas
      const ideasDescription = currentIdeas
        .filter(i => i.id !== 'welcome-bubble')
        .slice(0, 10)
        .map(i => `${i.label}: ${i.description || ''}`)
        .join('; ');

      const fullDescription = `${projectTopic}. ${conversationText.substring(0, 1000)}. ${ideasDescription}`;

      if (import.meta.env.DEV) {
        console.log('📋 [Standards] Auto-selecting standards for topic:', projectTopic);
      }

      // Call standards auto-enroll API
      const response = await apiRequest<{
        success: boolean;
        data?: {
          enrolledStandards?: string[];
          count?: number;
        };
      }>('/api/standards/auto-enroll', {
        method: 'POST',
        body: JSON.stringify({
          name: projectTopic,
          description: fullDescription,
          autoEnrollRequired: true,
          autoEnrollRecommended: true,
          maxStandards: 5
        })
      });

      if (response.success && response.data?.enrolledStandards) {
        const enrolledStandards = response.data.enrolledStandards;

        if (import.meta.env.DEV) {
          console.log('✅ [Standards] Auto-selected standards:', enrolledStandards);
        }

        // Auto-select each standard
        for (const standardId of enrolledStandards) {
          // Only toggle if not already selected
          if (!selectedStandards || !selectedStandards.includes(standardId)) {
            onToggleStandard(standardId);
          }
        }
      }
    } catch (error: any) {
      console.error('❌ [Standards] Failed to auto-select standards:', error);
      // Don't show error to user - this is a background operation
    }
  }, [selectedStandards, onToggleStandard, ideas]);



  // Speech/audio features removed

  // Handle idea click with multi-select support
  // Handle idea click with multi-select support
  // STABILIZED: Uses refs to prevent dependency changes when activeIdeaId updates
  // This prevents OrbGraph from re-initializing (clearing SVG) on every click
  // Handle idea click with multi-select support
  // STABILIZED PROXY: This function identity NEVER changes
  // It delegates to the current implementation stored in a ref
  const handleIdeaClickImplRef = useRef<any>(null);
  const handleIdeaClick = useCallback((...args: any[]) => {
    if (handleIdeaClickImplRef.current) {
      handleIdeaClickImplRef.current(...args);
    }
  }, []);

  // Update idea (description, notes, priority, etc.)
  const updateIdea = useCallback((ideaId: string, updates: Partial<Idea>) => {
    setIdeas(prev => prev.map(i =>
      i.id === ideaId ? { ...i, ...updates, updatedAt: Date.now() } : i
    ));
  }, []);

  // Link two ideas (defined early for use in handleIdeaClick)
  const linkIdeas = useCallback((sourceId: string, targetId: string) => {
    setIdeas(prev => prev.map(i => {
      if (i.id === sourceId) {
        const connections = new Set(i.connections || []);
        connections.add(targetId);
        return { ...i, connections: Array.from(connections), updatedAt: Date.now() };
      }
      if (i.id === targetId) {
        const connections = new Set(i.connections || []);
        connections.add(sourceId);
        return { ...i, connections: Array.from(connections), updatedAt: Date.now() };
      }
      return i;
    }));
    setLinkingMode(null);
    setLinkDialog(null);
  }, []);


  // Merge ideas
  const mergeIdeas = useCallback((ideaIds: string[], mergedLabel?: string, mergedDescription?: string) => {
    if (ideaIds.length < 2) return;

    const ideasToMerge = ideas.filter(i => ideaIds.includes(i.id));
    if (ideasToMerge.length < 2) return;

    // Get sub-ideas of all ideas being merged
    const subIdeas = ideas.filter(i => i.parentId && ideaIds.includes(i.parentId));

    // Create merged idea
    const mergedIdea: Idea = {
      id: `merged-${Date.now()}`,
      label: mergedLabel || ideasToMerge[0].label,
      description: mergedDescription || ideasToMerge.map(i => i.description).filter(Boolean).join(' | ') || '',
      parentId: ideasToMerge[0].parentId || null,
      priority: Math.max(...ideasToMerge.map(i => i.priority || 1)),
      category: ideasToMerge[0].category,
      notes: ideasToMerge.map(i => i.notes).filter(Boolean).join('\n\n'),
      connections: Array.from(new Set(ideasToMerge.flatMap(i => i.connections || []))).filter(id => !ideaIds.includes(id)),
      state: 'merged',
      tags: Array.from(new Set(ideasToMerge.flatMap(i => i.tags || []))),
      createdAt: Math.min(...ideasToMerge.map(i => i.createdAt || Date.now())),
      updatedAt: Date.now()
    };

    // Update sub-ideas to point to merged idea
    const updatedSubIdeas = subIdeas.map(subIdea => ({
      ...subIdea,
      parentId: mergedIdea.id
    }));

    // Remove old ideas and add merged idea + updated sub-ideas
    setIdeas(prev => {
      const remaining = prev.filter(i => !ideaIds.includes(i.id));
      return [...remaining, mergedIdea, ...updatedSubIdeas];
    });

    // Clear selection and merge dialog
    setSelectedIdeas(new Set());
    setMergeDialog(null);
    setActiveIdeaId(mergedIdea.id);
  }, [ideas]);

  // Generate AI suggestions for a clicked bubble
  const generateBubbleSuggestions = useCallback(async (ideaId: string, position?: { x: number; y: number }) => {
    const clickedIdea = ideas.find(i => i.id === ideaId);
    if (!clickedIdea) return;

    // Check if this idea already has sub-bubbles
    const existingSubIdeas = ideas.filter(i => i.parentId === ideaId);
    if (existingSubIdeas.length > 0) {
      // Already has suggestions, just focus on it
      setActiveIdeaId(ideaId === activeIdeaId ? null : ideaId);
      return;
    }

    setGeneratingSuggestions(ideaId);
    setActiveIdeaId(ideaId);

    try {
      // Get conversation context
      const conversationText = messages
        .slice(-10) // Last 10 messages for context
        .map(msg => `${msg.sender === 'user' ? 'User' : 'AI'}: ${msg.text}`)
        .join('\n\n');

      // Get related ideas for context
      const relatedIdeas = ideas.filter(i =>
        i.id !== clickedIdea.id &&
        (i.parentId === clickedIdea.id || clickedIdea.connections?.includes(i.id) || i.connections?.includes(clickedIdea.id))
      );
      const relatedIdeasContext = relatedIdeas.length > 0
        ? `\nRelated ideas in the project:\n${relatedIdeas.map(i => `- ${i.label}: ${i.description || ''}`).join('\n')}\n`
        : '';

      // Get project topic for context
      const projectContext = topic && topic.length > 3 && !topic.toLowerCase().includes('start crafting')
        ? `\nProject Topic: ${topic}\n`
        : '';

      const prompt = `You are a creative brainstorming assistant. The user is working on a project and wants to expand on an idea: "${clickedIdea.label}"

${clickedIdea.description ? `Idea Description: ${clickedIdea.description}\n\n` : ''}
${projectContext}
${relatedIdeasContext}
${conversationText ? `Recent conversation context:\n${conversationText}\n\n` : ''}

Generate 3-5 creative, contextual suggestions to expand "${clickedIdea.label}". Consider the project context and related ideas when generating suggestions.

SUGGESTION TYPES (use a mix):
- "Expand": Features that build upon this idea
- "Refine": Ways to improve or clarify this idea
- "Alternative": Different approaches or variations
- "Implementation": Practical steps to realize this idea
- "Risk": Potential challenges or considerations

Each suggestion should:
1. Be directly related to "${clickedIdea.label}" and fit the project context
2. Be specific, actionable, and concrete
3. Add value by expanding, refining, or complementing the idea
4. Be concise (2-5 words for label, 1-2 sentences for description)
5. Consider how it relates to other ideas in the project

IMPORTANT: You MUST respond with ONLY valid JSON. Do not include any markdown formatting, code blocks, or explanatory text. Return ONLY the JSON object.

Required JSON format (no markdown, no code blocks, just the JSON):
{
  "suggestions": [
    {"id": "sub-idea-1", "label": "Feature Name", "description": "Brief description with type hint (e.g., [Expand], [Refine], [Alternative], [Implementation], [Risk])", "type": "expand"},
    {"id": "sub-idea-2", "label": "Another Feature", "description": "Brief description", "type": "refine"}
  ]
}`;

      const response = await apiRequest<{
        success: boolean;
        response: string;
      }>('/api/llm/chat', {
        method: 'POST',
        body: JSON.stringify({
          message: prompt,
          history: [],
          contextType: 'wizard'
        })
      });

      if (response.success && response.response) {
        try {
          let responseText = response.response.trim();

          // Try to extract JSON from markdown code blocks first
          const codeBlockMatch = responseText.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
          if (codeBlockMatch) {
            responseText = codeBlockMatch[1];
          } else {
            // Try to extract JSON object directly
            const jsonMatch = responseText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              responseText = jsonMatch[0];
            }
          }

          if (import.meta.env.DEV) {
            console.log('📝 [Suggestions] Extracted JSON text:', responseText.substring(0, 200));
          }

          const data = JSON.parse(responseText);

          if (data.suggestions && Array.isArray(data.suggestions) && data.suggestions.length > 0) {
            // Show suggestions in modal for user to select (don't add automatically)
            const formattedSuggestions = data.suggestions.map((suggestion: any) => ({
              id: `suggestion-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              label: suggestion.label || suggestion.title || suggestion.name || 'New Idea',
              description: suggestion.description || suggestion.desc || ''
            }));

            // Set the suggestion modal with the generated suggestions and position
            setSuggestionModal({
              ideaId: ideaId,
              ideaLabel: clickedIdea.label,
              suggestions: formattedSuggestions,
              position: position || undefined
            });

            // Voice feedback removed - user requested no speech when clicking bubbles
          } else {
            console.warn('⚠️ [Suggestions] No suggestions found in response:', data);
            toast.warning('No suggestions were generated. Please try clicking the bubble again.');
          }
        } catch (parseError: any) {
          console.error('❌ [Suggestions] Failed to parse AI suggestions:', parseError);
          console.error('📄 [Suggestions] Raw response:', response.response);

          // Try to provide a more helpful error message
          let errorMessage = 'Failed to parse AI suggestions. ';
          if (parseError.message) {
            errorMessage += parseError.message;
          }
          errorMessage += ' Please try clicking the bubble again.';

          toast.error(errorMessage);
        }
      } else {
        console.error('❌ [Suggestions] API request failed:', response);
        toast.error('Failed to generate suggestions. Please try again.');
      }
    } catch (error) {
      console.error('Failed to generate bubble suggestions:', error);
      toast.error('Failed to generate suggestions. Please try again.');
    } finally {
      setGeneratingSuggestions(null);
    }
  }, [ideas, messages, activeIdeaId]);

  // Handle Idea Click Implementation
  // Defined here to ensure dependencies (linkIdeas, generateBubbleSuggestions) are available
  const handleIdeaClickImpl = useCallback((ideaId: string, position?: { x: number; y: number }, shiftKey?: boolean) => {
    // If in linking mode, complete the link
    if (linkingModeRef.current && linkingModeRef.current !== ideaId) {
      linkIdeas(linkingModeRef.current, ideaId);
      return;
    }

    if (shiftKey) {
      // Multi-select mode
      setSelectedIdeas(prev => {
        const next = new Set(prev);
        if (next.has(ideaId)) {
          next.delete(ideaId);
        } else {
          next.add(ideaId);
        }
        // If we have 2+ selected, show merge option
        if (next.size >= 2) {
          const ideaLabels = Array.from(next).map(id => ideasRef.current.find(i => i.id === id)?.label || id);
          setMergeDialog({
            ideaIds: Array.from(next),
            ideaLabels
          });
        } else {
          setMergeDialog(null);
        }
        return next;
      });
    } else {
      // Single click - clear selection
      setSelectedIdeas(new Set());
      setMergeDialog(null);

      // Generate bubble suggestions in bubble and tree view
      // In other views (mindmap, research), just toggle the idea
      if (viewModeRef.current === 'bubble' || viewModeRef.current === 'tree') {
        generateBubbleSuggestions(ideaId, position);
      } else {
        // For Research/Mindmap views, just toggle the active idea
        const currentActiveId = activeIdeaIdRef.current;
        setActiveIdeaId(ideaId === currentActiveId ? null : ideaId);
      }
    }
  }, [linkIdeas, generateBubbleSuggestions]);

  // Keep the impl ref updated
  useEffect(() => {
    handleIdeaClickImplRef.current = handleIdeaClickImpl;
  }, [handleIdeaClickImpl]);

  // Generate related ideas across all ideas
  const generateRelatedIdeas = useCallback(async () => {
    if (ideas.length === 0) return;

    try {
      const ideasContext = ideas
        .filter(i => i.id !== 'welcome-bubble')
        .map(i => `- ${i.label}: ${i.description || ''}`)
        .join('\n');

      const prompt = `Analyze these brainstorming ideas and generate new related ideas that connect or expand upon them:

Current Ideas:
${ideasContext}

${topic && topic.length > 3 ? `Project Topic: ${topic}\n` : ''}

Generate 3-5 new ideas that:
1. Connect different existing ideas together
2. Fill gaps between ideas
3. Expand on themes that emerge from multiple ideas
4. Add new perspectives that complement existing ideas

Return ONLY valid JSON:
{
  "relatedIdeas": [
    {"id": "related-1", "label": "New Idea", "description": "How this connects or expands existing ideas", "connections": ["idea-id-1", "idea-id-2"]},
    {"id": "related-2", "label": "Another Idea", "description": "Description", "connections": ["idea-id-3"]}
  ]
}`;

      const response = await apiRequest<{
        success: boolean;
        response: string;
      }>('/api/llm/chat', {
        method: 'POST',
        body: JSON.stringify({
          message: prompt,
          history: [],
          contextType: 'wizard'
        })
      });

      if (response.success && response.response) {
        try {
          const jsonMatch = response.response.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const data = JSON.parse(jsonMatch[0]);
            if (data.relatedIdeas && Array.isArray(data.relatedIdeas)) {
              const newIdeas: Idea[] = data.relatedIdeas.map((idea: any): Idea => ({
                id: idea.id || `related-${Date.now()}-${Math.random()}`,
                label: idea.label,
                description: idea.description || '',
                parentId: null,
                connections: idea.connections || [],
                category: 'idea',
                state: 'new' as const,
                createdAt: Date.now(),
                updatedAt: Date.now()
              }));

              setIdeas(prev => {
                const existingIds = new Set(prev.map(i => i.id));
                const uniqueNew = newIdeas.filter(i => !existingIds.has(i.id));
                return [...prev, ...uniqueNew];
              });
            }
          }
        } catch (error) {
          console.error('Failed to parse related ideas:', error);
        }
      }
    } catch (error) {
      console.error('Failed to generate related ideas:', error);
    }
  }, [ideas, topic]);

  // Refine a specific idea
  const refineIdea = useCallback(async (ideaId: string) => {
    const idea = ideas.find(i => i.id === ideaId);
    if (!idea) return;

    try {
      const prompt = `Refine and improve this brainstorming idea:

Idea: "${idea.label}"
Description: ${idea.description || 'No description'}

${topic && topic.length > 3 ? `Project Context: ${topic}\n` : ''}

Suggest improvements to make this idea:
1. More specific and actionable
2. Better aligned with the project
3. More innovative or unique
4. Better connected to related ideas

Return ONLY valid JSON:
{
  "refinedLabel": "Improved label",
  "refinedDescription": "Improved description with more detail",
  "suggestions": ["Suggestion 1", "Suggestion 2"]
}`;

      const response = await apiRequest<{
        success: boolean;
        response: string;
      }>('/api/llm/chat', {
        method: 'POST',
        body: JSON.stringify({
          message: prompt,
          history: [],
          contextType: 'wizard'
        })
      });

      if (response.success && response.response) {
        try {
          const jsonMatch = response.response.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const data = JSON.parse(jsonMatch[0]);
            if (data.refinedLabel || data.refinedDescription) {
              updateIdea(ideaId, {
                label: data.refinedLabel || idea.label,
                description: data.refinedDescription || idea.description,
                state: 'refined',
                notes: data.suggestions ? `Refinement suggestions:\n${data.suggestions.join('\n')}` : idea.notes
              });
            }
          }
        } catch (error) {
          console.error('Failed to parse refinement:', error);
        }
      }
    } catch (error) {
      console.error('Failed to refine idea:', error);
    }
  }, [ideas, topic, updateIdea]);

  // Gap analysis - identify missing aspects
  const performGapAnalysis = useCallback(async () => {
    if (ideas.length === 0) return;

    try {
      const ideasContext = ideas
        .filter(i => i.id !== 'welcome-bubble')
        .map(i => `- ${i.label}: ${i.description || ''}`)
        .join('\n');

      const conversationText = messages
        .slice(-10)
        .map(msg => `${msg.sender === 'user' ? 'User' : 'AI'}: ${msg.text}`)
        .join('\n\n');

      const prompt = `Analyze this brainstorming session and identify gaps or missing aspects:

Current Ideas:
${ideasContext}

${topic && topic.length > 3 ? `Project Topic: ${topic}\n` : ''}
${conversationText ? `Conversation Context:\n${conversationText}\n` : ''}

Identify:
1. Missing features or aspects that should be considered
2. Areas that need more detail
3. Potential risks or constraints not yet addressed
4. Implementation considerations missing

Return ONLY valid JSON:
{
  "gaps": [
    {"label": "Missing Aspect", "description": "Why this is important", "category": "feature"},
    {"label": "Risk", "description": "Potential issue", "category": "risk"}
  ],
  "newIdeas": [
    {"id": "gap-1", "label": "New Idea", "description": "Description", "category": "feature"}
  ]
}`;

      const response = await apiRequest<{
        success: boolean;
        response: string;
      }>('/api/llm/chat', {
        method: 'POST',
        body: JSON.stringify({
          message: prompt,
          history: [],
          contextType: 'wizard'
        })
      });

      if (response.success && response.response) {
        try {
          const jsonMatch = response.response.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const data = JSON.parse(jsonMatch[0]);
            if (data.newIdeas && Array.isArray(data.newIdeas)) {
              const newIdeas: Idea[] = data.newIdeas.map((idea: any): Idea => ({
                id: idea.id || `gap-${Date.now()}-${Math.random()}`,
                label: idea.label,
                description: idea.description || '',
                parentId: null,
                category: idea.category || 'idea',
                state: 'new' as const,
                createdAt: Date.now(),
                updatedAt: Date.now()
              }));

              setIdeas(prev => {
                const existingIds = new Set(prev.map(i => i.id));
                const uniqueNew = newIdeas.filter(i => !existingIds.has(i.id));
                return [...prev, ...uniqueNew];
              });
            }

            // Add gaps to insights
            if (data.gaps && Array.isArray(data.gaps) && data.gaps.length > 0) {
              const gapInsights = data.gaps.map((gap: any) => `Gap: ${gap.label} - ${gap.description}`);
              setKeyInsights(prev => [...prev, ...gapInsights]);
            }
          }
        } catch (error) {
          console.error('Failed to parse gap analysis:', error);
        }
      }
    } catch (error) {
      console.error('Failed to perform gap analysis:', error);
    }
  }, [ideas, topic, messages]);

  // Cross-pollination - combine ideas from different branches
  const crossPollinateIdeas = useCallback(async () => {
    if (ideas.length < 2) return;

    try {
      const topLevelIdeas = ideas.filter(i => !i.parentId || i.parentId === 'CENTER');
      if (topLevelIdeas.length < 2) return;

      const ideasContext = topLevelIdeas
        .slice(0, 5)
        .map(i => `- ${i.label}: ${i.description || ''}`)
        .join('\n');

      const prompt = `Combine and cross-pollinate these ideas to create innovative new concepts:

Ideas to Combine:
${ideasContext}

${topic && topic.length > 3 ? `Project Topic: ${topic}\n` : ''}

Generate 3-5 new ideas that creatively combine elements from different ideas above. These should be:
1. Innovative combinations that create new value
2. Practical and actionable
3. Connected to the project theme
4. Different from simple merging - truly novel combinations

Return ONLY valid JSON:
{
  "combinedIdeas": [
    {"id": "combined-1", "label": "Combined Concept", "description": "How ideas X and Y combine to create this", "sourceIdeas": ["idea-1", "idea-id-2"]},
    {"id": "combined-2", "label": "Another Combination", "description": "Description", "sourceIdeas": ["idea-id-3", "idea-id-4"]}
  ]
}`;

      const response = await apiRequest<{
        success: boolean;
        response: string;
      }>('/api/llm/chat', {
        method: 'POST',
        body: JSON.stringify({
          message: prompt,
          history: [],
          contextType: 'wizard'
        })
      });

      if (response.success && response.response) {
        try {
          const jsonMatch = response.response.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const data = JSON.parse(jsonMatch[0]);
            if (data.combinedIdeas && Array.isArray(data.combinedIdeas)) {
              const newIdeas: Idea[] = data.combinedIdeas.map((idea: any): Idea => ({
                id: idea.id || `combined-${Date.now()}-${Math.random()}`,
                label: idea.label,
                description: idea.description || '',
                parentId: null,
                connections: idea.sourceIdeas || [],
                category: 'idea',
                state: 'new' as const,
                createdAt: Date.now(),
                updatedAt: Date.now()
              }));

              setIdeas(prev => {
                const existingIds = new Set(prev.map(i => i.id));
                const uniqueNew = newIdeas.filter(i => !existingIds.has(i.id));
                return [...prev, ...uniqueNew];
              });
            }
          }
        } catch (error) {
          console.error('Failed to parse cross-pollination:', error);
        }
      }
    } catch (error) {
      console.error('Failed to cross-pollinate ideas:', error);
    }
  }, [ideas, topic]);

  // Add selected suggestions as sub-bubbles
  const addSelectedSuggestions = useCallback((selectedIds: string[]) => {
    if (!suggestionModal) return;

    const selectedSuggestions = suggestionModal.suggestions.filter(s => selectedIds.includes(s.id));

    if (selectedSuggestions.length === 0) {
      setSuggestionModal(null);
      return;
    }

    // Add selected suggestions as sub-ideas
    const newSubIdeas: Idea[] = selectedSuggestions.map((suggestion, index) => ({
      id: `${suggestionModal.ideaId}-sub-${Date.now()}-${index}`,
      label: suggestion.label,
      description: suggestion.description,
      parentId: suggestionModal.ideaId
    }));

    // Filter out duplicates
    setIdeas(prev => {
      const existingIds = new Set(prev.map(i => i.id));
      const uniqueNewIdeas = newSubIdeas.filter(idea => !existingIds.has(idea.id));
      return [...prev, ...uniqueNewIdeas];
    });

    // Close modal
    setSuggestionModal(null);

    // Voice feedback removed - user requested no speech when adding suggestions
  }, [suggestionModal]);

  const [attachedFiles, setAttachedFiles] = useState<Array<{ name: string; type: string; content: string }>>([]);
  const [isAnalyzingFiles, setIsAnalyzingFiles] = useState(false);


  const handleSendMessage = useCallback(async (message?: string, attachments?: Array<{ name: string; type: string; content: string }>, options?: { bypassProcessing?: boolean }) => {
    // Mark interaction as true
    hasUserInteractedRef.current = true;

    const textToSend = message || input;
    if ((!textToSend || !textToSend.trim()) && (!attachments || attachments.length === 0)) {
      console.log('⚠️ [NeuralStreamChat] Empty message and no attachments, not sending');
      return;
    }
    if (isProcessing && !options?.bypassProcessing) {
      console.log('⚠️ [NeuralStreamChat] Already processing, not sending');
      return;
    }


    const trimmedMessage = (textToSend || '').trim();
    console.log('📤 [NeuralStreamChat] Sending message:', {
      message: trimmedMessage.substring(0, 50) + (trimmedMessage.length > 50 ? '...' : ''),
      length: trimmedMessage.length,
      attachments: attachments?.length || 0,
      isProcessing,
      messageCount: messages.length
    });

    // OPTIMISTIC UI UPDATE: Switch to chat layout immediately
    // This removes the perceived lag when sending the first message
    // OPTIMISTIC UI UPDATE: Switch to chat layout immediately
    // This removes the perceived lag when sending the first message
    if (layoutMode === 'rest') {
      setLayoutMode('chat');
    }

    try {
      // Build message with file context if files are attached
      let messageToSend = trimmedMessage;
      if (attachments && attachments.length > 0) {
        setIsAnalyzingFiles(true);
        toast.info(`Analyzing ${attachments.length} file(s) with AI...`);

        try {
          // Analyze files with AI to extract variable types and other information
          const fileAnalyses = await Promise.all(
            attachments.map(async (file) => {
              if (file.type.startsWith('image/')) {
                return `[Attached image: ${file.name}]`;
              } else {
                // Use AI to analyze code files for variable types, functions, classes, etc.
                try {
                  const analysisPrompt = `Analyze the following code file and extract:
1. All variable declarations with their types
2. Function signatures with parameters and return types
3. Class definitions with their properties and methods
4. Import statements and dependencies
5. Key data structures and their schemas
6. Configuration values and constants

File: ${file.name}
Content:
\`\`\`
${file.content.length > 10000 ? file.content.substring(0, 10000) + '...(truncated)' : file.content}
\`\`\`

Provide a structured analysis in JSON format:
{
  "variables": [{"name": "...", "type": "...", "scope": "..."}],
  "functions": [{"name": "...", "parameters": [...], "returnType": "..."}],
  "classes": [{"name": "...", "properties": [...], "methods": [...]}],
  "imports": [...],
  "dependencies": [...],
  "summary": "..."
}`;

                  const analysisResponse = await apiRequest<{ success: boolean; response?: string; text?: string }>('/api/llm/chat', {
                    method: 'POST',
                    body: JSON.stringify({
                      message: analysisPrompt,
                      history: [],
                      contextType: 'other'
                    })
                  });

                  const analysis = analysisResponse.response || analysisResponse.text || '';
                  return `[Attached file: ${file.name}]\n\n**AI Analysis:**\n${analysis}\n\n**Original Content:**\n\`\`\`\n${file.content.length > 5000 ? file.content.substring(0, 5000) + '...(truncated)' : file.content}\n\`\`\``;
                } catch (analysisError) {
                  console.warn(`Failed to analyze file ${file.name}:`, analysisError);
                  // Fallback to simple content if analysis fails
                  const content = file.content.length > 5000 ? file.content.substring(0, 5000) + '...(truncated)' : file.content;
                  return `[Attached file: ${file.name}]\n\`\`\`\n${content}\n\`\`\``;
                }
              }
            })
          );

          messageToSend = messageToSend
            ? `${messageToSend}\n\n${fileAnalyses.join('\n\n')}`
            : fileAnalyses.join('\n\n');
        } finally {
          setIsAnalyzingFiles(false);
        }
      }

      // Check if voice is active - if so, send to voice session instead of regular chat
      // This allows seamless switching between text and voice in the same conversation
      const isVoiceActive = liveSession.status === 'connected' && liveSession.sendText;

      if (isVoiceActive) {
        // Voice is active - send text to voice session
        try {
          await liveSession.sendText(messageToSend);

          // Add user message to chat immediately
          const userMessage: ChatMessage = {
            id: `voice-text-${Date.now()}`,
            sender: 'user',
            text: messageToSend,
            timestamp: Date.now()
          };

          // Switch to chat layout when first message is sent
          // Optimistically handled at start of function
          // if (messages.length === 0 && layoutMode === 'rest') {
          //   setLayoutMode('chat');
          // }

          if (onLoadConversation) {
            onLoadConversation([...messages, userMessage]);
          }

          // Voice session will respond via audio and onAIResponse callback
          // The AI response will be added to chat automatically via onAIResponse
          setInput('');
          setAttachedFiles([]);
          console.log('✅ [NeuralStreamChat] Message sent to voice session');
          return; // Exit early - voice will handle the response
        } catch (voiceError) {
          console.warn('[NeuralStreamChat] Failed to send text to voice session, falling back to regular chat:', voiceError);
          // Fall through to regular chat flow if voice fails
        }
      }

      // Regular chat flow (when voice is not active or voice send failed)
      // Use streaming if available, otherwise use regular onSendMessage
      try {
        // Add user message immediately
        const userMessage: ChatMessage = {
          id: Date.now().toString(),
          sender: 'user',
          text: messageToSend,
          timestamp: Date.now()
        };

        // Switch to chat layout when first message is sent
        // Optimistically handled at start of function
        // if (messages.length === 0 && layoutMode === 'rest') {
        //   setLayoutMode('chat');
        // }

        // Try streaming first
        try {
          const history = messagesToHistory(messages);
          const responseId = (Date.now() + 1).toString();
          let accumulatedText = '';

          // Create placeholder for streaming response with "thinking" indicator
          const streamingMessage: ChatMessage = {
            id: responseId,
            sender: 'agent',
            text: '🤔 Thinking...',
            timestamp: Date.now()
          };

          // INSTANT UPDATE: Add user message and AI thinking indicator immediately
          if (onLoadConversation) {
            onLoadConversation([...messages, userMessage, streamingMessage]);
          }

          // Clear input immediately for better UX
          setInput('');
          setAttachedFiles([]);

          const stream = streamChatMessage({
            message: messageToSend,
            history,
            contextType: 'wizard',
            preferFastModel: false, // Use full model for comprehensive brainstorming
            maxTokens: 8000, // Allow for comprehensive idea generation (50-80 ideas as per prompt)
            systemContext: brainstormingContext // Inject our custom prompt with XML instructions
          });

          // Stream response - Extract hierarchical XML ideas recursively
          let displayMessage = ''; // Declare displayMessage for cleaned text display


          for await (const chunk of stream) {
            accumulatedText += chunk;

            // Extract all ideas including nested children
            const allIdeas = parseXmlToIdeas(accumulatedText);
            if (import.meta.env.DEV && allIdeas.length > 0) {
              console.log(`[IdeaExtract] Found ${allIdeas.length} ideas`);
            }

            // Add unique new ideas from hierarchical extraction
            if (allIdeas.length > 0) {
              setIdeas(prev => {
                const existingLabels = new Set(prev.map(p => p.label.toLowerCase()));
                const uniqueNew = allIdeas.filter(n => !existingLabels.has(n.label.toLowerCase()));
                return [...prev, ...uniqueNew];
              });
            }

            // Hide the XML tags from the UI display - handle nested structures
            displayMessage = accumulatedText
              .replace(/<\/?ideas?>/gi, '') // Remove <idea> and <ideas> tags
              .replace(/<\/?children>/gi, '') // Remove <children> tags
              .replace(/<title>[\s\S]*?<\/title>/gi, '') // Remove title blocks
              .replace(/<description>[\s\S]*?<\/description>/gi, '') // Remove description blocks  
              .replace(/<category>[\s\S]*?<\/category>/gi, '') // Remove category blocks
              .replace(/\[\[\s*IDEA\s*:\s*(.*?)\s*:\s*(.*?)\s*\]\]/g, '') // Also clean old format
              .replace(/<[^>]+>/g, '') // Remove any remaining angle-bracket tags
              .replace(/\n{3,}/g, '\n\n') // Collapse multiple newlines
              .trim();

            streamingMessage.text = displayMessage;

            // Update messages through onLoadConversation if available
            if (onLoadConversation) {
              const updatedMessages = [
                ...messages,
                userMessage,
                { ...streamingMessage, text: displayMessage }
              ];
              onLoadConversation(updatedMessages);
            }
          }

          // TTS is handled by live conversation if active

          // Final update
          if (onLoadConversation) {
            // Apply final cleanup to ensure no XML or inline tags remain
            const finalCleanText = accumulatedText
              .replace(/<idea>[\s\S]*?<\/idea>/g, '')
              .replace(/\[\[\s*IDEA\s*:\s*(.*?)\s*:\s*(.*?)\s*\]\]/g, '')
              .trim();
            streamingMessage.text = finalCleanText;

            const finalMessages = [
              ...messages,
              userMessage,
              streamingMessage
            ];
            onLoadConversation(finalMessages);
          } else {
            // Fallback to regular onSendMessage
            onSendMessage(messageToSend);
          }
        } catch (streamError: any) {
          console.warn('Streaming failed, falling back to regular chat:', streamError);
          // Fallback to regular onSendMessage
          onSendMessage(messageToSend);
        }
      } catch (error) {
        // If everything fails, use regular onSendMessage
        onSendMessage(messageToSend);
      }

      setInput('');
      setAttachedFiles([]);
      console.log('✅ [NeuralStreamChat] Message sent');
    } catch (error) {
      console.error('❌ [NeuralStreamChat] Error sending message:', error);
      toast.error('Failed to send message. Please try again.');
      setIsAnalyzingFiles(false);
    }
  }, [input, isProcessing, onSendMessage]);

  // Ref to access control bar's stop function
  const controlBarStopRef = useRef<(() => void) | null>(null);

  // Voice conversation handlers

  // Stop conversation handler
  const handleStopConversation = useCallback(() => {
    // No-op - live conversation feature removed
  }, []);

  // Chat history panel state - only show when there are messages
  // Auto-expand when chat starts (first message appears)
  const [showChatHistory, setShowChatHistory] = useState(false);
  const hasMessages = messages.length > 0;

  // Check if user has sent at least one message OR if voice conversation is active
  // This ensures the chat box moves to bottom when voice starts, just like when sending a message
  const hasUserMessage = messages.some(msg => msg.sender === 'user') || liveSession.status === 'connected' || isGettingAgentsInvolved;

  // Load saved conversations from database only (no localStorage)
  useEffect(() => {
    const loadConversations = async () => {
      // Wait for auth to finish loading before attempting to load conversations
      if (authLoading) {
        return;
      }

      try {
        if (isAuthenticated && user && user.role !== 'guest') {
          // Load folders and conversations in parallel
          const [conversations, folders] = await Promise.all([
            chatApi.getConversations({ type: 'neural-chat' }).catch((error) => {
              console.error('Failed to load conversations:', error);
              return [];
            }),
            projectFolderApi.getFolders().catch((error) => {
              console.error('Failed to load folders:', error);
              return [];
            })
          ]);

          // Transform folders (already transformed by API, but ensure format)
          const transformedFolders = folders.map((folder: any) => ({
            id: folder.id || folder._id || '',
            userId: user?.id || '',
            name: folder.name || 'Unnamed Folder',
            description: folder.description,
            platforms: folder.platforms || folder.platform ? (Array.isArray(folder.platforms) ? folder.platforms : [folder.platform]) : ['other'],
            conversationIds: folder.conversationIds || [],
            createdAt: typeof folder.createdAt === 'number' ? folder.createdAt : (folder.createdAt ? new Date(folder.createdAt).getTime() : Date.now()),
            updatedAt: typeof folder.updatedAt === 'number' ? folder.updatedAt : (folder.updatedAt ? new Date(folder.updatedAt).getTime() : Date.now())
          }));
          setProjectFolders(transformedFolders);

          // Transform API format to local format
          const transformed = conversations.map((conv: ChatConversation) => ({
            id: conv._id || conv.id || '',
            title: (conv.metadata?.topic ||
              conv.messages.find((m: ChatMessage) => m.sender === 'user')?.text.substring(0, 50) ||
              'New Conversation') as string,
            preview: (conv.messages
              .filter((m: ChatMessage) => m.sender === 'user')
              .slice(-3)
              .map((m: ChatMessage) => m.text)
              .join(' ')
              .substring(0, 100) || 'No messages yet') as string,
            timestamp: conv.createdAt ? new Date(conv.createdAt).getTime() : Date.now(),
            messages: conv.messages || [],
            topic: conv.metadata?.topic || conv.topic || '',
            ideas: (conv.metadata?.ideas || conv.ideas || []).map((idea: any): Idea => ({
              id: idea.id || `idea-${Date.now()}-${Math.random()}`,
              label: idea.label || '',
              description: idea.description || '',
              parentId: idea.parentId || null,
              priority: idea.priority,
              category: idea.category,
              notes: idea.notes,
              connections: idea.connections || [],
              state: idea.state || 'new',
              tags: idea.tags || [],
              createdAt: idea.createdAt || Date.now(), // Preserve or set creation timestamp
              updatedAt: idea.updatedAt || Date.now() // Preserve or set update timestamp
            })),
            keyInsights: conv.metadata?.keyInsights || conv.keyInsights || [],
            nextSteps: conv.metadata?.nextSteps || conv.nextSteps || [],
            // CRITICAL: Extract prototypingStage, projectPreview, and activeIdeaId from metadata
            prototypingStage: conv.metadata?.prototypingStage || conv.prototypingStage || 'ideation',
            projectPreview: conv.metadata?.projectPreview || conv.projectPreview || null,
            activeIdeaId: conv.metadata?.activeIdeaId ?? conv.activeIdeaId ?? null,
            glassPanelActiveView: conv.metadata?.glassPanelActiveView || conv.glassPanelActiveView || 'context',
            folderId: (conv as any).folderId || conv.folderId || null
          }));

          // Deduplicate conversations by ID - keep only the most recent one
          const deduplicated = Array.from(
            new Map(
              transformed
                .sort((a, b) => b.timestamp - a.timestamp) // Sort by most recent first
                .map(conv => [conv.id, conv]) // Use ID as key for deduplication
            ).values()
          );

          setSavedConversations(deduplicated);

          // After loading conversations, check if we should restore the last active conversation
          // Only restore if we're in setup view (not when explicitly starting a new project)
          // Check URL parameter first, then localStorage
          const urlParams = new URLSearchParams(window.location.search);
          const conversationIdFromUrl = urlParams.get('conversation');

          // Check if we're explicitly starting a new project (no conversation in URL and no project ID)
          const urlHash = window.location.hash;
          const isNewProject = !conversationIdFromUrl && (urlHash === '#setup' || urlHash === '');

          // Also check localStorage for last active conversation (as backup)
          // But only if we're not explicitly starting a new project
          let conversationIdToLoad: string | null = conversationIdFromUrl;
          if (!conversationIdToLoad && !isNewProject && typeof window !== 'undefined') {
            try {
              const lastConversationId = localStorage.getItem('neuralChat_lastConversationId');
              if (lastConversationId && deduplicated.some(c => c.id === lastConversationId)) {
                conversationIdToLoad = lastConversationId;
              }
            } catch (e) {
              // Ignore localStorage errors
            }
          }

          // Set conversation to restore (will be handled by separate effect after loadConversation is defined)
          // Only restore if we have a conversation ID and we're not explicitly starting a new project
          if (conversationIdToLoad && conversationIdToLoad !== currentConversationId && deduplicated.length > 0 && !isNewProject) {
            setConversationToRestore(conversationIdToLoad);
          }

          // Database only - no localStorage fallback
        } else {
          // GUEST USERS: Load workspaces from localStorage (persists across sessions)
          try {
            // Try localStorage first, fallback to sessionStorage for legacy data
            let guestWorkspacesStr = localStorage.getItem('guestWorkspaces');
            if (!guestWorkspacesStr) {
              guestWorkspacesStr = sessionStorage.getItem('guestWorkspaces');
              // Migrate to localStorage if found in sessionStorage
              if (guestWorkspacesStr) {
                localStorage.setItem('guestWorkspaces', guestWorkspacesStr);
                console.log('📂 [Workspace] Migrated guest workspaces from sessionStorage to localStorage');
              }
            }
            const guestWorkspaces = JSON.parse(guestWorkspacesStr || '[]');
            setProjectFolders(guestWorkspaces);
            console.log('📂 [Workspace] Loaded guest workspaces from localStorage:', guestWorkspaces.length);
          } catch (e) {
            console.warn('Failed to load guest workspaces from localStorage:', e);
            setProjectFolders([]);
          }
          // Guest conversations - stored in localStorage as well
          setSavedConversations([]);
        }
      } catch (error) {
        console.error('Failed to load saved conversations:', error);
        // Database only - no localStorage fallback
        setSavedConversations([]);
      }
    };

    loadConversations();
  }, [isAuthenticated, user, authLoading]);

  // Save conversation when it changes (debounced, but immediate for first message)
  const saveConversationTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isFirstSaveRef = useRef(true);
  useEffect(() => {
    // Debug logging
    if (import.meta.env.DEV) {
      console.log('🔄 [NeuralStreamChat] Save effect triggered:', {
        hasUserMessage,
        messagesLength: messages.length,
        hasUserMessages: messages.some(m => m.sender === 'user'),
        currentConversationId,
        isFirstSave: isFirstSaveRef.current,
        isLoadingConversation: isLoadingConversationRef.current,
        isReloadingMessages: isReloadingMessagesRef.current
      });
    }

    // Guard: Don't save while loading or reloading to prevent infinite loops
    if (isLoadingConversationRef.current || isReloadingMessagesRef.current) {
      if (import.meta.env.DEV) {
        console.log('⏭️ [NeuralStreamChat] Skipping save - currently loading/reloading conversation');
      }
      return;
    }

    if (!hasUserMessage || messages.length === 0) {
      if (import.meta.env.DEV) {
        console.log('⏭️ [NeuralStreamChat] Skipping save - no user messages yet');
      }
      return;
    }

    // Check if this is the first save (immediate save) or subsequent saves (debounced)
    const isFirstSave = isFirstSaveRef.current && messages.some(m => m.sender === 'user');
    const delay = isFirstSave ? 500 : 2000; // 500ms for first save, 2s for subsequent

    if (import.meta.env.DEV) {
      console.log('⏰ [NeuralStreamChat] Scheduling save:', { isFirstSave, delay });
    }

    if (saveConversationTimeoutRef.current) {
      clearTimeout(saveConversationTimeoutRef.current);
    }

    saveConversationTimeoutRef.current = setTimeout(async () => {
      try {
        isFirstSaveRef.current = false; // Mark that we've done the first save

        const conversationTitle = topic && topic !== "Start Crafting Your Idea" && topic !== "Your Project starts here"
          ? topic
          : messages.find(m => m.sender === 'user')?.text.substring(0, 50) || 'New Conversation';

        const preview = messages
          .filter(m => m.sender === 'user')
          .slice(-3)
          .map(m => m.text)
          .join(' ')
          .substring(0, 100) || 'No messages yet';

        // Use existing conversation ID if we're updating, otherwise create new one
        let conversationId = currentConversationId || `conv_${Date.now()}`;

        // Save to database if authenticated
        if (isAuthenticated && user) {
          try {
            if (currentConversationId) {
              // Update existing conversation
              // Normalize ideas before saving to ensure valid categories
              const normalizedIdeas = normalizeIdeas(ideas);
              const normalizedPreview = normalizeProjectPreview(projectPreview);

              // Filter out messages with empty text before saving
              const validMessages = messages.filter(m => m.text && m.text.trim().length > 0);

              await chatApi.updateNeuralChat(conversationId, {
                messages: validMessages,
                topic,
                ideas: normalizedIdeas,
                keyInsights: [...keyInsights],
                nextSteps: [...nextSteps],
                prototypingStage,
                projectPreview: (normalizedPreview as any) || undefined,
                activeIdeaId,
                glassPanelActiveView: glassPanelActiveView as any
              });
              if (import.meta.env.DEV) {
                console.log('✅ [NeuralStreamChat] Conversation saved to database:', conversationId);
              }
            } else {
              // Create new conversation
              try {
                // Get or create default "Unorganized" folder for the user
                let defaultFolderId: string | undefined;
                if (isAuthenticated && user) {
                  try {
                    const folders = await projectFolderApi.getFolders();
                    const unorganizedFolder = folders.find(f => f.name === 'Unorganized');
                    defaultFolderId = unorganizedFolder?.id;
                  } catch (folderError) {
                    // If folder fetch fails, backend will create default folder
                    console.warn('Failed to get folders, backend will handle default folder:', folderError);
                  }
                }

                // Check if welcome message already exists in messages
                const hasWelcomeMessage = messages.some(m =>
                  m.sender === 'agent' &&
                  m.text.includes('Orchestrator Agent') &&
                  m.text.includes('Hello!')
                );

                // Create welcome message if it doesn't exist
                const welcomeMessage = hasWelcomeMessage ? null : createOrchestratorWelcomeMessage();

                // Use welcome message as initial message, or first user message if no welcome needed
                const initialMessage = welcomeMessage || messages.find(m => m.sender === 'user') || messages[0];

                const newConv = await chatApi.createConversation({
                  type: 'neural-chat',
                  folderId: defaultFolderId, // Will default to Unorganized if not provided
                  initialMessage: initialMessage
                });

                // If we added a welcome message, prepend it to messages
                if (welcomeMessage && onLoadConversation) {
                  onLoadConversation([welcomeMessage, ...messages]);
                }

                // Ensure folderId is saved on the conversation
                if (newConv && !newConv.folderId && defaultFolderId) {
                  // If backend didn't set folderId, update it
                  try {
                    await projectFolderApi.moveConversation(newConv._id || newConv.id || conversationId, defaultFolderId);
                  } catch (moveError) {
                    console.warn('Failed to set folderId on new conversation:', moveError);
                  }
                }
                const convId = newConv._id || newConv.id || conversationId;
                conversationId = convId; // Use the actual ID from database

                // Normalize ideas before saving to ensure valid categories
                const normalizedIdeas = normalizeIdeas(ideas);
                const normalizedPreview = normalizeProjectPreview(projectPreview);

                // Filter out messages with empty text before saving
                const validMessages = messages.filter(m => m.text && m.text.trim().length > 0);

                await chatApi.updateNeuralChat(convId, {
                  messages: validMessages,
                  topic,
                  ideas: normalizedIdeas,
                  keyInsights: [...keyInsights],
                  nextSteps: [...nextSteps],
                  prototypingStage,
                  projectPreview: (normalizedPreview as any) || undefined,
                  activeIdeaId,
                  glassPanelActiveView: glassPanelActiveView as any
                });
                setCurrentConversationId(convId);
                if (import.meta.env.DEV) {
                  console.log('✅ [NeuralStreamChat] New conversation created and saved to database:', convId);
                }
              } catch (createError) {
                console.error('❌ [NeuralStreamChat] Failed to create conversation in database:', createError);
                // Database only - don't fall back to localStorage for authenticated users
                throw createError; // Re-throw to prevent state update
              }
            }
          } catch (error) {
            console.error('❌ [NeuralStreamChat] Failed to save conversation to database:', error);
            // Database only - don't fall back to localStorage for authenticated users
            return; // Exit early to prevent state update
          }
        }

        // For authenticated users, update state from database response
        // Unauthenticated users - database only, cannot save without authentication
        if (isAuthenticated && user && user.role !== 'guest') {
          // Database only - update state to reflect saved conversation
          setSavedConversations(prev => {
            const existingConv = prev.find(c => c.id === conversationId);
            const timestamp = existingConv?.timestamp || Date.now();

            const newConversation = {
              id: conversationId,
              title: conversationTitle,
              preview,
              timestamp,
              messages: [...messages],
              topic,
              ideas: [...ideas],
              keyInsights: [...keyInsights],
              nextSteps: [...nextSteps],
              prototypingStage,
              projectPreview: projectPreview || null,
              activeIdeaId,
              glassPanelActiveView: glassPanelActiveView as any
            };

            const filtered = prev.filter(c => c.id !== conversationId);
            const updated = [newConversation, ...filtered].slice(0, 50);

            // Deduplicate by ID to ensure no duplicates (in case of race conditions)
            const deduplicated = Array.from(
              new Map(
                updated
                  .sort((a, b) => b.timestamp - a.timestamp)
                  .map(conv => [conv.id, conv])
              ).values()
            );

            if (import.meta.env.DEV) {
              console.log('✅ [NeuralStreamChat] Conversation saved to database (state updated):', conversationId);
            }

            return deduplicated;
          });
        } else {
          // Unauthenticated users - database only, no localStorage
          // Cannot save conversations without authentication
          if (import.meta.env.DEV) {
            console.warn('⚠️ [NeuralStreamChat] Cannot save conversation - user not authenticated. Database only.');
          }
          return; // Exit early - cannot save without authentication
        }

        // Set current conversation ID so future saves update the same conversation
        // Important: This must be set after database save to ensure consistency
        if (!currentConversationId && conversationId) {
          setCurrentConversationId(conversationId);
          if (import.meta.env.DEV) {
            console.log('✅ [NeuralStreamChat] Set current conversation ID:', conversationId);
          }
        }
      } catch (error) {
        console.error('❌ [NeuralStreamChat] Failed to save conversation:', error);
      }
    }, delay);

    return () => {
      if (saveConversationTimeoutRef.current) {
        clearTimeout(saveConversationTimeoutRef.current);
      }
    };
    // CRITICAL: Only depend on messages and conversation/auth state
    // Other values (ideas, topic, etc.) are read from current state via closure
    // This prevents infinite loops when derived state updates
  }, [messages, hasUserMessage, currentConversationId, isAuthenticated, user]);

  // Auto-expand chat history when first message appears
  useEffect(() => {
    if (hasMessages && !showChatHistory) {
      setShowChatHistory(true);
    } else if (!hasMessages && showChatHistory) {
      // Auto-collapse if all messages are cleared
      setShowChatHistory(false);
    }
    // Only depend on hasMessages to avoid unnecessary re-renders
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasMessages]);

  // Load a conversation
  const loadConversation = useCallback(async (conversationId: string) => {
    // Prevent duplicate loads
    if (isLoadingConversationRef.current) {
      if (import.meta.env.DEV) {
        console.warn('[NeuralStreamChat] Load conversation already in progress, skipping:', conversationId);
      }
      return;
    }

    isLoadingConversationRef.current = true;

    try {
      let conversation: any = null;

      // If authenticated, ALWAYS load from database first (most up-to-date data)
      if (isAuthenticated && user && user.role !== 'guest') {
        try {
          const dbConversation = await chatApi.getConversation(conversationId);

          // Transform database format to local format
          conversation = {
            id: dbConversation._id || dbConversation.id || conversationId,
            title: dbConversation.metadata?.topic ||
              dbConversation.messages.find((m: ChatMessage) => m.sender === 'user')?.text.substring(0, 50) ||
              'New Conversation',
            preview: dbConversation.messages
              .filter((m: ChatMessage) => m.sender === 'user')
              .slice(-3)
              .map((m: ChatMessage) => m.text)
              .join(' ')
              .substring(0, 100) || 'No messages yet',
            timestamp: dbConversation.createdAt ? new Date(dbConversation.createdAt).getTime() : Date.now(),
            messages: dbConversation.messages || [],
            topic: dbConversation.metadata?.topic || dbConversation.topic || '',
            ideas: (dbConversation.metadata?.ideas || dbConversation.ideas || []).map((idea: any): Idea => ({
              id: idea.id || `idea-${Date.now()}-${Math.random()}`,
              label: idea.label || '',
              description: idea.description || '',
              parentId: idea.parentId || null,
              priority: idea.priority,
              category: idea.category,
              notes: idea.notes,
              connections: idea.connections || [],
              state: idea.state || 'new',
              tags: idea.tags || [],
              createdAt: idea.createdAt || Date.now(), // Preserve or set creation timestamp
              updatedAt: idea.updatedAt || Date.now() // Preserve or set update timestamp
            })),
            keyInsights: dbConversation.metadata?.keyInsights || dbConversation.keyInsights || [],
            nextSteps: dbConversation.metadata?.nextSteps || dbConversation.nextSteps || [],
            // CRITICAL: Extract prototypingStage, projectPreview, and activeIdeaId from metadata
            prototypingStage: dbConversation.metadata?.prototypingStage || dbConversation.prototypingStage || 'ideation',
            projectPreview: dbConversation.metadata?.projectPreview || dbConversation.projectPreview || null,
            activeIdeaId: dbConversation.metadata?.activeIdeaId ?? dbConversation.activeIdeaId ?? null,
            glassPanelActiveView: dbConversation.metadata?.glassPanelActiveView || dbConversation.glassPanelActiveView || 'context',
            folderId: (dbConversation as any).folderId || dbConversation.folderId || null
          };
        } catch (error: any) {
          // Check if it's a 404 (conversation not found)
          // The apiRequest throws errors with message containing "not found" or status 404
          const isNotFound = error?.message?.includes('not found') ||
            error?.message?.includes('404') ||
            error?.status === 404 ||
            (error?.endpoint && error?.status === 404);

          if (isNotFound) {
            // Conversation doesn't exist - clean up URL and show user-friendly message
            if (typeof window !== 'undefined') {
              try {
                const url = new URL(window.location.href);
                if (url.searchParams.get('conversation') === conversationId) {
                  url.searchParams.delete('conversation');
                  window.history.replaceState({}, '', url.toString());
                  if (import.meta.env.DEV) {
                    console.log('[NeuralStreamChat] Removed invalid conversation ID from URL:', conversationId);
                  }
                }
              } catch (urlError) {
                // Ignore URL errors
              }
            }

            // Show user-friendly toast message
            if (typeof toast !== 'undefined') {
              toast.warning('The conversation you were looking for no longer exists. Starting a new conversation.');
            }

            if (import.meta.env.DEV) {
              console.warn('[NeuralStreamChat] Conversation not found (404), cleaned up URL:', conversationId);
            }
          } else {
            console.error('[NeuralStreamChat] Failed to load conversation from database:', error);
          }

          // Fallback to local state on error (only if not 404)
          if (!isNotFound) {
            conversation = savedConversations.find(c => c.id === conversationId);
          } else {
            conversation = null;
          }
        }
      } else {
        // For unauthenticated users - database only, cannot load without authentication
        if (import.meta.env.DEV) {
          console.warn('⚠️ [NeuralStreamChat] Cannot load conversation - user not authenticated. Database only.');
        }
        conversation = null;
      }

      if (!conversation) {
        if (import.meta.env.DEV) {
          console.warn('[NeuralStreamChat] Conversation not found:', conversationId);
        }
        isLoadingConversationRef.current = false;
        return;
      }

      if (import.meta.env.DEV) {
        console.log('📂 [NeuralStreamChat] Loading conversation:', {
          id: conversationId,
          title: conversation.title,
          hasTopic: !!conversation.topic,
          topic: conversation.topic,
          ideasCount: conversation.ideas?.length || 0,
          ideas: conversation.ideas?.map((i: Idea) => i.label),
          insightsCount: conversation.keyInsights?.length || 0,
          insights: conversation.keyInsights,
          nextStepsCount: conversation.nextSteps?.length || 0,
          nextSteps: conversation.nextSteps,
          messagesCount: conversation.messages?.length || 0,
          prototypingStage: conversation.prototypingStage,
          hasProjectPreview: !!conversation.projectPreview,
          activeIdeaId: conversation.activeIdeaId
        });
      }

      // Reset internal state FIRST - restore all conversation data
      // Use functional updates to ensure state is set correctly
      setTopic(conversation.topic || "");
      setIdeas(conversation.ideas || []);
      setKeyInsights(conversation.keyInsights || []);
      setNextSteps(conversation.nextSteps || []);
      setActiveIdeaId(conversation.activeIdeaId ?? null);
      setPrototypingStage(conversation.prototypingStage || 'ideation');
      setProjectPreview(conversation.projectPreview || null);
      setGlassPanelActiveView(conversation.glassPanelActiveView || 'context');
      hasInitializedRef.current = true;
      setCurrentConversationId(conversationId);

      // Auto-switch to chat layout if conversation has messages
      const hasMessages = conversation.messages && conversation.messages.length > 0;
      if (hasMessages) {
        setLayoutMode('chat');
      }

      // Store conversation ID in localStorage and URL for restoration on refresh
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem('neuralChat_lastConversationId', conversationId);
          // Update URL without page reload
          const url = new URL(window.location.href);
          url.searchParams.set('conversation', conversationId);
          window.history.replaceState({}, '', url.toString());
        } catch (e) {
          // Ignore localStorage/URL errors
        }
      }

      // Reset analyzing state when loading a conversation
      setIsExtractingIdeas(false);

      // Load messages LAST via callback (same as when user sends input)
      // This triggers all the same effects (hasUserMessage, UI updates, etc.)
      // Use setTimeout to ensure state updates are applied first
      // IMPORTANT: Replace messages, don't append - clear any existing messages first
      requestAnimationFrame(() => {
        setTimeout(() => {
          if (onLoadConversation && !isReloadingMessagesRef.current) {
            isReloadingMessagesRef.current = true;
            lastLoadedConversationIdRef.current = conversationId;
            // Clear existing messages first to prevent duplicates
            onLoadConversation([]);
            // Then load the conversation messages after a brief delay
            setTimeout(() => {
              const loadedMessages = conversation.messages || [];
              // Deduplicate messages by ID before loading
              const uniqueMessages: ChatMessage[] = Array.from(
                new Map((loadedMessages as ChatMessage[]).map((msg: ChatMessage) => [msg.id, msg])).values()
              );
              onLoadConversation(uniqueMessages);
              // CRITICAL: Set lastMessageCountRef to prevent extraction of loaded messages
              // This prevents "Analyzing conversation..." from showing when loading old conversations
              lastMessageCountRef.current = uniqueMessages.length;
              // Reset flag after loading
              setTimeout(() => {
                isReloadingMessagesRef.current = false;
              }, 100);
            }, 50);
          }
        }, 100);
      });

      // Close sidebar after loading
      setShowChatHistorySidebar(false);
    } finally {
      isLoadingConversationRef.current = false;
    }
  }, [savedConversations, onLoadConversation, isAuthenticated, user]);

  // Effect to restore conversation on mount/refresh
  useEffect(() => {
    if (conversationToRestore && !isLoadingConversationRef.current && !currentConversationId) {
      // Small delay to ensure everything is ready
      const timer = setTimeout(() => {
        loadConversation(conversationToRestore);
        setConversationToRestore(null); // Clear after loading
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [conversationToRestore, currentConversationId, loadConversation]);

  // Delete a conversation
  const deleteConversation = useCallback(async (conversationId: string) => {
    try {
      if (isAuthenticated && user && user.role !== 'guest') {
        // Delete from database
        await chatApi.deleteConversation(conversationId);
      } else {
        // Unauthenticated users - database only, cannot delete without authentication
        if (import.meta.env.DEV) {
          console.warn('⚠️ [NeuralStreamChat] Cannot delete conversation - user not authenticated. Database only.');
        }
      }

      // Update local state (database only)
      setSavedConversations(prev => {
        const updated = prev.filter(c => c.id !== conversationId);
        return updated;
      });
    } catch (error) {
      console.error('Failed to delete conversation:', error);
      // Still update local state on error
      setSavedConversations(prev => prev.filter(c => c.id !== conversationId));
    }
  }, [isAuthenticated, user]);

  // Helper function to save conversation immediately (bypasses debounce)
  const saveConversationImmediately = useCallback(async () => {
    if (!hasUserMessage || messages.length === 0) return;

    try {
      // Clear any pending debounced save
      if (saveConversationTimeoutRef.current) {
        clearTimeout(saveConversationTimeoutRef.current);
        saveConversationTimeoutRef.current = null;
      }

      const conversationTitle = topic && topic !== "Start Crafting Your Idea" && topic !== "Your Project starts here"
        ? topic
        : messages.find(m => m.sender === 'user')?.text.substring(0, 50) || 'New Conversation';

      const preview = messages
        .filter(m => m.sender === 'user')
        .slice(-3)
        .map(m => m.text)
        .join(' ')
        .substring(0, 100) || 'No messages yet';

      const conversationId = currentConversationId || `conv_${Date.now()}`;

      // Save to database if authenticated
      if (isAuthenticated && user && user.role !== 'guest') {
        try {
          if (currentConversationId) {
            // Update existing conversation
            // Normalize ideas before saving to ensure valid categories
            const normalizedIdeas = normalizeIdeas(ideas);
            try {
              await chatApi.updateNeuralChat(conversationId, {
                messages: [...messages],
                topic,
                ideas: normalizedIdeas,
                keyInsights: [...keyInsights],
                nextSteps: [...nextSteps],
                prototypingStage,
                projectPreview: (projectPreview as any) || undefined,
                activeIdeaId,
                glassPanelActiveView: glassPanelActiveView as any
              });
            } catch (saveError: any) {
              // Suppress 401/403 errors for background saves
              if (saveError.message?.includes('401') || saveError.message?.includes('403') || saveError.message?.includes('Access token')) {
                console.warn('Background save skipped (session expired/invalid)', saveError.message);
                return;
              }
              throw saveError;
            }
          } else {
            // Create new conversation
            // Get or create default "Unorganized" folder for the user
            let defaultFolderId: string | undefined;
            if (isAuthenticated && user && user.role !== 'guest') {
              try {
                const folders = await projectFolderApi.getFolders();
                const unorganizedFolder = folders.find(f => f.name === 'Unorganized');
                defaultFolderId = unorganizedFolder?.id;
              } catch (folderError) {
                // If folder fetch fails, backend will create default folder
                console.warn('Failed to get folders, backend will handle default folder:', folderError);
              }
            }

            // Check if welcome message already exists in messages
            const hasWelcomeMessage = messages.some(m =>
              m.sender === 'agent' &&
              m.text.includes('Orchestrator Agent') &&
              m.text.includes('Hello!')
            );

            // Create welcome message if it doesn't exist
            const welcomeMessage = hasWelcomeMessage ? null : createOrchestratorWelcomeMessage();
            const initialMessage = welcomeMessage || messages[0];

            let newConv;
            try {
              newConv = await chatApi.createConversation({
                type: 'neural-chat',
                folderId: defaultFolderId, // Will default to Unorganized if not provided
                initialMessage: initialMessage
              });
            } catch (createError: any) {
              // Suppress 401/403 errors for background saves
              if (createError.message?.includes('401') || createError.message?.includes('403') || createError.message?.includes('Access token')) {
                console.warn('Background creation skipped (session expired/invalid)', createError.message);
                return;
              }
              throw createError;
            }

            // If we added a welcome message, prepend it to messages
            if (welcomeMessage && onLoadConversation) {
              onLoadConversation([welcomeMessage, ...messages]);
            }
            // Normalize ideas before saving to ensure valid categories
            const normalizedIdeas = normalizeIdeas(ideas);
            const normalizedPreview = normalizeProjectPreview(projectPreview);
            try {
              await chatApi.updateNeuralChat(newConv._id || newConv.id || conversationId, {
                messages: [...messages],
                topic,
                ideas: normalizedIdeas,
                keyInsights: [...keyInsights],
                nextSteps: [...nextSteps],
                prototypingStage,
                projectPreview: (normalizedPreview as any) || undefined,
                activeIdeaId,
                glassPanelActiveView: glassPanelActiveView as any
              });
            } catch (saveError: any) {
              // Suppress 401/403 errors for background saves
              if (saveError.message?.includes('401') || saveError.message?.includes('403') || saveError.message?.includes('Access token')) {
                console.warn('Background save skipped (session expired/invalid)', saveError.message);
                return;
              }
              throw saveError;
            }
            setCurrentConversationId(newConv._id || newConv.id || conversationId);
          }
        } catch (error) {
          console.error('Failed to save conversation to database:', error);
          // Database only - don't fall back to localStorage for authenticated users
          return; // Exit early to prevent state update
        }
      }

      // Update state - database only (requires authentication)
      if (isAuthenticated && user && user.role !== 'guest') {
        // Database only - update state to reflect saved conversation
        setSavedConversations(prev => {
          const existingConv = prev.find(c => c.id === conversationId);
          const timestamp = existingConv?.timestamp || Date.now();

          const newConversation = {
            id: conversationId,
            title: conversationTitle,
            preview,
            timestamp,
            messages: [...messages],
            topic,
            ideas: [...ideas],
            keyInsights: [...keyInsights],
            nextSteps: [...nextSteps],
            prototypingStage,
            projectPreview: projectPreview || null,
            activeIdeaId,
            glassPanelActiveView
          };

          const filtered = prev.filter(c => c.id !== conversationId);
          return [newConversation, ...filtered].slice(0, 50);
        });
      } else {
        // Unauthenticated users - database only, cannot save without authentication
        if (import.meta.env.DEV) {
          console.warn('⚠️ [NeuralStreamChat] Cannot save conversation - user not authenticated. Database only.');
        }
        return; // Exit early - cannot save without authentication
      }

      if (!currentConversationId && conversationId) {
        if (import.meta.env.DEV) {
          console.warn('⚠️ [NeuralStreamChat] Cannot save conversation - user not authenticated. Database only.');
        }
        return; // Exit early - cannot save without authentication
      }

      if (!currentConversationId) {
        setCurrentConversationId(conversationId);
      }
    } catch (error) {
      console.error('Failed to save conversation immediately:', error);
    }
  }, [hasUserMessage, messages, currentConversationId, isAuthenticated, user]);

  // Helper function to detect if there are unsaved changes
  const hasUnsavedChanges = useCallback(() => {
    // If no messages, no unsaved changes
    if (!hasUserMessage || messages.length === 0) return false;

    // If we have a current conversation, compare with saved version
    if (currentConversationId) {
      const savedConv = savedConversations.find(c => c.id === currentConversationId);
      if (!savedConv) return true; // Conversation exists in state but not saved

      // Compare state with saved conversation
      const stateChanged =
        savedConv.messages.length !== messages.length ||
        savedConv.topic !== topic ||
        savedConv.ideas.length !== ideas.length ||
        savedConv.keyInsights.length !== keyInsights.length ||
        savedConv.nextSteps.length !== nextSteps.length ||
        savedConv.prototypingStage !== prototypingStage ||
        savedConv.activeIdeaId !== activeIdeaId ||
        savedConv.glassPanelActiveView !== glassPanelActiveView;

      return stateChanged;
    }

    // New conversation with content = unsaved
    return true;
  }, [hasUserMessage, messages, currentConversationId, savedConversations, topic, ideas, keyInsights, nextSteps, prototypingStage, activeIdeaId, glassPanelActiveView]);

  // Perform the actual reset (after confirmation and save)
  const performReset = useCallback(async () => {
    setIsResetting(true);

    // Stop live conversation if active
    if (controlBarStopRef.current) {
      controlBarStopRef.current();
    }

    // Disconnect live voice session if connected
    if (liveSession.status === 'connected' || liveSession.status === 'connecting') {
      if (import.meta.env.DEV) {
        console.log('[NeuralStreamChat] Disconnecting live session before starting new chat');
      }
      try {
        liveSession.disconnect();
      } catch (error) {
        console.error('[NeuralStreamChat] Error disconnecting live session:', error);
      }
    }

    // Stop any ongoing extraction/analysis
    setIsExtractingIdeas(false);
    if (extractionTimeoutRef.current) {
      clearTimeout(extractionTimeoutRef.current);
      extractionTimeoutRef.current = null;
    }
    // Cancel any ongoing extraction request
    if (extractionAbortControllerRef.current) {
      extractionAbortControllerRef.current.abort();
      extractionAbortControllerRef.current = null;
    }

    // Wait for animations (500ms for fade-out)
    await new Promise(resolve => setTimeout(resolve, 500));

    // Clear all state
    setTopic("");
    setIdeas([]);
    setActiveIdeaId(null);
    setKeyInsights([]);
    setNextSteps([]);
    setPrototypingStage('ideation');
    setProjectPreview(null);
    setGeneratingSuggestions(null);
    setSuggestionModal(null);
    setMergeDialog(null);
    setSelectedIdeas(new Set());
    setGlassPanelActiveView('context');
    setLayoutMode('rest'); // Reset to rest layout on new conversation
    hasInitializedRef.current = false;
    lastMessageCountRef.current = 0;
    setInput('');
    setCurrentConversationId(null);

    // Clear stored conversation ID from localStorage and URL
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem('neuralChat_lastConversationId');
        // Remove conversation from URL
        const url = new URL(window.location.href);
        url.searchParams.delete('conversation');
        window.history.replaceState({}, '', url.toString());
      } catch (e) {
        // Ignore localStorage/URL errors
      }
    }


    // Reset first save flag for new conversation
    isFirstSaveRef.current = true;

    // Clear messages via callback
    if (onLoadConversation) {
      onLoadConversation([]);
    }

    // Close sidebar
    setShowChatHistorySidebar(false);

    // Reset animation state
    setIsResetting(false);
  }, [setInput, onLoadConversation, liveSession]);

  // Start new conversation - wrapper that checks for unsaved changes
  const startNewConversation = useCallback(async () => {
    // Check if there are unsaved changes
    if (hasUnsavedChanges()) {
      // Show confirmation dialog
      setShowNewChatConfirm(true);
      return;
    }

    // No unsaved changes, proceed directly
    await performReset();
  }, [hasUnsavedChanges, performReset]);

  // Detection logic: Use comprehensive maturity assessment for quality evaluation
  const canProceedToPrototyping = useCallback((messages: ChatMessage[], ideas: Idea[]): {
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
  } => {
    // Use maturity assessment from imported module
    const assessment = calculateMaturityAssessment({
      projectName: topic,
      projectDescription: topic !== "Start Crafting Your Idea" && topic !== "Your Project starts here" ? topic : undefined,
      conversationMessages: messages.map(m => ({ sender: m.sender, text: m.text })),
      ideas: ideas
        .filter(i => i.id !== 'welcome-bubble')
        .map(i => ({
          id: i.id,
          label: i.label,
          description: i.description,
          category: i.category,
          connections: i.connections,
          isEnriched: i.isEnriched
        })),
      selectedStandards,
      useInternet,
      activeAgentsCount: activeAgents?.length || 0
    });

    const canProceed = assessment.overall >= 70;

    // Generate helpful feedback based on weakest criteria
    if (canProceed) {
      return {
        canProceed: true,
        reason: 'Project is ready for prototyping!',
        score: assessment.overall,
        breakdown: assessment.criteria
      };
    }

    // Find weakest areas and give specific tips
    const criteriaEntries = Object.entries(assessment.criteria) as [keyof typeof assessment.criteria, number][];
    const weakCriteria = criteriaEntries
      .filter(([_, score]) => score < 50)
      .sort(([_, scoreA], [__, scoreB]) => scoreA - scoreB)
      .slice(0, 2);

    const criteriaLabels: Record<string, string> = {
      clarity: 'add more details about your requirements',
      feasibility: 'discuss technical implementation',
      completeness: 'expand on features and architecture',
      standards: 'consider quality standards and best practices',
      research: 'enable internet research for market insights'
    };

    const weakAreas = weakCriteria.map(([key]) => criteriaLabels[key] || key);

    const reason = weakAreas.length > 0
      ? `Tip: Try to ${weakAreas.join(' or ')} to reach the next stage.`
      : 'Keep refining your idea to unlock the next stage';

    return {
      canProceed: false,
      reason,
      score: assessment.overall,
      breakdown: assessment.criteria
    };
  }, [topic, selectedStandards, useInternet, activeAgents]);

  // Check if ready to proceed (for button state)
  const readyCheck = useMemo(() => {
    // Always calculate maturity score to show current progress
    const maturityResult = canProceedToPrototyping(messages, ideas);

    // If no user message yet, prevent proceeding but still show the score
    if (!hasUserMessage) {
      return {
        ...maturityResult,
        canProceed: false,
        reason: maturityResult.reason || 'Start a conversation to begin'
      };
    }

    return maturityResult;
  }, [messages, ideas, hasUserMessage, canProceedToPrototyping]);

  // Handle Deepen Ideas - re-run brainstorming for more detail
  const handleDeepenIdeas = useCallback(async () => {
    if (isDeepeningIdeas || deepenLevel >= 2) return;

    setIsDeepeningIdeas(true);
    const newLevel = deepenLevel + 1;

    try {
      // Get the current ideas to build a focused deepening prompt
      const currentIdeas = ideas.filter(i => i.id !== 'welcome-bubble');

      // For X1: Get top-level ideas (no parent or parent is CENTER)
      const topLevelIdeas = currentIdeas.filter(i => !i.parentId || i.parentId === 'CENTER');

      // For X2: Focus on just the most important 3-4 areas to avoid timeout
      const focusedIdeas = newLevel === 2
        ? topLevelIdeas.slice(0, 4)
        : topLevelIdeas.slice(0, 8);

      // Map to aliases for the prompt (UUIDs confuse the LLM sometimes)
      deepenMapRef.current.clear();
      const ideaSummary = focusedIdeas.map((i, index) => {
        const alias = `id-${index + 1}`;
        deepenMapRef.current.set(alias, i.id);
        return `- ID: "${alias}" Idea: "${i.label}"`;
      }).join('\n');

      // Build a prompt requesting more detail - X2 is more focused
      // Refined for Progressive Depth:
      // X1 (Level 1) -> Adds Specific Ideas (Layer 2)
      // X2 (Level 2) -> Adds Implementation Details (Layer 3)
      // KEY CHANGE: Request hierarchical XML output with <children> nesting
      const deepenPrompt = newLevel === 1
        ? `We have these Major Categories. For EACH category, generate 4-5 SPECIFIC, actionable feature/concept ideas as SUB-IDEAS.

IMPORTANT: Output the ideas in HIERARCHICAL XML format using <children> tags for nesting:

<idea>
<title>${focusedIdeas[0]?.label || 'Category Name'}</title>
<description>Parent category</description>
<category>feature</category>
<children>
  <idea>
  <title>Specific Sub-Feature 1</title>
  <description>Detailed description of this sub-feature</description>
  <category>feature</category>
  </idea>
  <idea>
  <title>Specific Sub-Feature 2</title>
  <description>Another sub-feature description</description>
  <category>technology</category>
  </idea>
</children>
</idea>

Now apply this format to EACH of these categories:
${ideaSummary}

Generate hierarchical XML output with each category containing 4-5 specific sub-ideas inside <children> tags.`
        : `Focus on these specific ideas. For each, add detailed technical implementation sub-tasks.

IMPORTANT: Output in HIERARCHICAL XML format with nested <children> for sub-sub-ideas:

<idea>
<title>${focusedIdeas[0]?.label || 'Concept Name'}</title>
<description>Parent concept</description>
<category>feature</category>
<children>
  <idea>
  <title>Implementation Step 1</title>
  <description>Detailed technical step</description>
  <category>technology</category>
  </idea>
  <idea>
  <title>Implementation Step 2</title>
  <description>Another implementation detail</description>
  <category>architecture</category>
  </idea>
</children>
</idea>

Apply this format to these ${focusedIdeas.length} key concepts:
${ideaSummary}

For each, provide 2-3 specific implementation steps nested inside <children> tags.`;

      console.log('🚀 [NeuralStreamChat] Deepening ideas...', { level: newLevel, promptLength: deepenPrompt.length });

      // Trigger the streaming chat with the deepen prompt
      // await handleSendMessage to ensure we block until streaming completes
      // PASS bypassProcessing to ensure it runs even if state is weird
      await handleSendMessage(deepenPrompt, undefined, { bypassProcessing: true });
      console.log('✅ [NeuralStreamChat] Deepen ideas stream complete');

      setDeepenLevel(newLevel);
    } catch (error) {
      console.error('❌ [NeuralStreamChat] Error deepening ideas:', error);
      toast.error('Failed to deepen ideas. Please try again.');
    } finally {
      // Reset loading state immediately after stream completes
      console.log('🔄 [NeuralStreamChat] Resetting isDeepeningIdeas state');
      setIsDeepeningIdeas(false);
    }
  }, [isDeepeningIdeas, deepenLevel, ideas, handleSendMessage]);

  // Direct quick generation (extracted from original handleTransitionToPrototyping)
  // NOTE: This must be defined BEFORE handlePathSelected since handlePathSelected depends on it
  const handleDirectQuickGeneration = useCallback(async () => {
    console.log('[handleDirectQuickGeneration] Called!', { isGeneratingPreview, prototypingStage });

    if (isGeneratingPreview) {
      console.log('[handleDirectQuickGeneration] Early return - already generating');
      return;
    }

    console.log('[handleDirectQuickGeneration] Starting generation and transitioning to prototyping phase...');
    setIsGeneratingPreview(true);
    setGenerationProgress(0);
    // IMPORTANT: Transition to prototyping phase immediately so Mission Control is shown
    setPrototypingStage('prototyping');
    // Initialize status logs for Mission Control
    setStatusLogs(['🚀 Starting blueprint generation...']);

    // Simulate progress updates during generation
    const progressInterval = setInterval(() => {
      setGenerationProgress(prev => {
        // Slower, more realistic progress simulation (target 90% over ~2 minutes)
        // If it was just 500ms updates, we need significantly smaller increments

        let increment = 0;
        if (prev < 10) increment = 0.5;      // Initial startup
        else if (prev < 30) increment = 0.3; // Analysis checks
        else if (prev < 60) increment = 0.2; // Deep generation
        else if (prev < 80) increment = 0.1; // Architecture/Finalizing
        else if (prev < 90) increment = 0.05; // Late stage waiting

        const nextProgress = Math.min(prev + increment, 90);

        // Update status text and logs based on progress stages
        if (nextProgress < 10) {
          setLoadingStatusText("Initializing AI Design Agent...");
        } else if (nextProgress < 30) {
          setLoadingStatusText("Analyzing conversation context...");
          if (prev < 10 && nextProgress >= 10) {
            setStatusLogs(logs => [...logs, '🤖 AI Design Agent initialized']);
          }
        } else if (nextProgress < 50) {
          setLoadingStatusText("Architecting system components...");
          if (prev < 30 && nextProgress >= 30) {
            setStatusLogs(logs => [...logs, '🔍 Context analysis complete', '🏗️ Starting system architecture...']);
          }
        } else if (nextProgress < 70) {
          setLoadingStatusText("Generating database schema...");
          if (prev < 50 && nextProgress >= 50) {
            setStatusLogs(logs => [...logs, '⚙️ Component architecture complete', '📊 Generating database schema...']);
          }
        } else if (nextProgress < 85) {
          setLoadingStatusText("Drafting frontend prototype...");
          if (prev < 70 && nextProgress >= 70) {
            setStatusLogs(logs => [...logs, '💾 Schema generation complete', '🎨 Building frontend interface...']);
          }
        } else {
          setLoadingStatusText("Finalizing project blueprint...");
          if (prev < 85 && nextProgress >= 85) {
            setStatusLogs(logs => [...logs, '🎯 Interface prototype ready', '✨ Finalizing blueprint...']);
          }
        }

        return nextProgress;
      });
    }, 500); // Update every 500ms

    try {
      // Build structured project context for optimal LLM understanding
      const userMessages = messages.filter(m => m.sender === 'user');
      const systemMessages = messages.filter(m => m.sender === 'system');
      const agentMessages = messages.filter(m => m.sender === 'agent');

      // Extract initial user goal (first user message or topic)
      const initialGoal = userMessages.length > 0
        ? userMessages[0].text
        : (topic && topic !== "Start Crafting Your Idea" && topic !== "Your Project starts here" ? topic : 'New project idea');

      // Structure ideas with all details
      const structuredIdeas = ideas
        .filter(i => i.id !== 'welcome-bubble')
        .map(i => {
          const ideaObj: any = {
            label: i.label
          };
          if (i.description) ideaObj.description = i.description;
          if (i.notes) ideaObj.notes = i.notes;
          if (i.category && i.category !== 'idea') ideaObj.category = i.category;
          if (i.priority) ideaObj.priority = `${i.priority}/5`;
          if (i.state && i.state !== 'new') ideaObj.state = i.state;
          if (i.tags && i.tags.length > 0) ideaObj.tags = i.tags;
          if (i.parentId) ideaObj.parentId = i.parentId;
          return ideaObj;
        });

      // Build structured user goal with clear sections
      const structuredGoal = `PROJECT TOPIC: ${topic && topic !== "Start Crafting Your Idea" && topic !== "Your Project starts here" ? topic : 'To be determined'}

INITIAL REQUEST:
${initialGoal}

${userMessages.length > 1 ? `\nADDITIONAL REQUIREMENTS:\n${userMessages.slice(1).map((m, idx) => `${idx + 1}. ${m.text}`).join('\n')}` : ''}

${structuredIdeas.length > 0 ? `\nPROJECT IDEAS & REQUIREMENTS (${structuredIdeas.length} items):\n${structuredIdeas.map((idea, idx) => {
        const parts = [`${idx + 1}. ${idea.label}`];
        if (idea.description) parts.push(`   Description: ${idea.description}`);
        if (idea.category) parts.push(`   Category: ${idea.category}`);
        if (idea.priority) parts.push(`   Priority: ${idea.priority}`);
        if (idea.state) parts.push(`   State: ${idea.state}`);
        if (idea.notes) parts.push(`   Notes: ${idea.notes}`);
        if (idea.tags && idea.tags.length > 0) parts.push(`   Tags: ${idea.tags.join(', ')}`);
        return parts.join('\n');
      }).join('\n\n')}` : ''}

${keyInsights.length > 0 ? `\nKEY INSIGHTS:\n${keyInsights.map((insight, idx) => `${idx + 1}. ${insight}`).join('\n')}` : ''}

${nextSteps.length > 0 ? `\nNEXT STEPS:\n${nextSteps.map((step, idx) => `${idx + 1}. ${step}`).join('\n')}` : ''}

${selectedStandards.length > 0 ? `\nSELECTED STANDARDS:\n${selectedStandards.map((std, idx) => `${idx + 1}. ${std}`).join('\n')}` : ''}`;

      // Create enhanced conversation history with structured context
      const enhancedMessages: ChatMessage[] = [...messages];

      // Add structured context as a system message for better LLM understanding
      if (structuredIdeas.length > 0 || keyInsights.length > 0 || nextSteps.length > 0) {
        enhancedMessages.push({
          id: `structured-context-${Date.now()}`,
          sender: 'system',
          text: structuredGoal,
          timestamp: Date.now()
        });
      }

      setGenerationProgress(15); // Started generation

      // Generate project preview with structured context and brainstorming data for coverage analysis
      const brainstormingData = {
        concept: topic,
        ideas: ideas.filter(i => i.id !== 'welcome-bubble'),
        keyInsights,
        nextSteps,
        audience: 'General',
        style: 'Standard',
        coreLoop: 'Standard gameplay'
      };
      const preview = await generateProjectPreview(structuredGoal, enhancedMessages, useInternet, null, undefined, brainstormingData);

      setGenerationProgress(95); // Almost done

      // Normalize preview before setting state
      const normalizedPreview = normalizeProjectPreview(preview);
      setProjectPreview(normalizedPreview || null);
      setPrototypingStage('prototyping');

      setGenerationProgress(100); // Complete

      // Force save conversation when transitioning to prototyping
      if (hasUserMessage && messages.length > 0) {
        await saveConversationImmediately();
      }

      if (import.meta.env.DEV) {
        console.log('[Prototyping] Project preview generated:', {
          hasPreview: !!preview,
          hasArchitecture: !!preview?.architectureDiagram,
          hasWireframe: !!preview?.wireframeCode,
          ideasIncluded: structuredIdeas.length,
          messagesIncluded: enhancedMessages.length
        });
      }
    } catch (error: any) {
      console.error('[Prototyping] Failed to generate preview:', error);
      setGenerationProgress(0);

      // Show user-friendly error message
      const errorMessage = error?.message || 'Failed to generate project preview';
      if (errorMessage.includes('incomplete preview data') || errorMessage.includes('Missing or empty')) {
        toast.error('Preview generation incomplete. Some sections (Architecture, Prototype, or Code) were not generated. Please try again or refine your project description.');
      } else if (errorMessage.includes('timeout') || errorMessage.includes('Timeout')) {
        toast.error('Preview generation timed out. The request took too long. Please try again with a shorter project description.');
      } else {
        toast.error(`Failed to generate preview: ${errorMessage}`);
      }

      // Don't transition if generation fails
    } finally {
      clearInterval(progressInterval);
      setIsGeneratingPreview(false);
      // Reset progress after a short delay
      setTimeout(() => setGenerationProgress(0), 500);
    }
  }, [messages, ideas, topic, keyInsights, nextSteps, selectedStandards, useInternet, isGeneratingPreview, prototypingStage, hasUserMessage, saveConversationImmediately]);

  // Handle path selection from PathChoiceModal
  const handlePathSelected = useCallback(async (path: 'agents' | 'quick') => {
    console.log('[handlePathSelected] Called with path:', path);
    setShowPathChoice(false);

    if (path === 'agents') {
      // AI Agents path - use the existing agent involvement logic
      setIsGettingAgentsInvolved(true);
      setLoadingStatusText('Analyzing project for agent selection...');

      // Trigger the agent involvement flow (which will eventually lead to generation)
      // The agent flow is already implemented in handleSendMessage with agent context
      toast.info('AI Agents are analyzing your project...', 3000);

      // Build a special message to trigger agent brainstorming
      const agentPrompt = `Based on the brainstorming session so far, please have the specialized AI agents (Requirements Agent, UX Designer, Design/Architecture Agent) collaborate to:
1. Analyze the ${ideas.filter(i => i.id !== 'welcome-bubble').length} ideas we've generated
2. Identify gaps and suggest improvements
3. Prepare a comprehensive project summary for blueprint generation

After the agents have contributed their insights, proceed to generate the project blueprint.`;

      try {
        await handleSendMessage(agentPrompt, undefined, { bypassProcessing: true });
      } catch (error) {
        console.error('Agent path failed:', error);
        toast.error('Agent analysis failed, falling back to quick generation');
      } finally {
        setIsGettingAgentsInvolved(false);
      }

      // After agents have contributed, trigger the actual generation
      console.log('[handlePathSelected] Calling handleDirectQuickGeneration after agents...');
      await handleDirectQuickGeneration();
    } else {
      // Direct Quick path - immediate generation
      console.log('[handlePathSelected] Calling handleDirectQuickGeneration directly...');
      await handleDirectQuickGeneration();
    }
    console.log('[handlePathSelected] Completed');
  }, [ideas, handleSendMessage, handleDirectQuickGeneration]);

  // Handle transition to prototyping phase - show Feature Selection modal first
  const handleTransitionToPrototyping = useCallback(async () => {
    if (isGeneratingPreview || prototypingStage === 'prototyping') return;

    // Show Feature Selection modal first
    setShowFeatureSelection(true);
  }, [isGeneratingPreview, prototypingStage]);

  // Handle feature selection confirmation - called when user confirms features in modal
  const handleFeatureSelectionConfirm = useCallback((selectedFeatures: Idea[]) => {
    // Update selectedIdeas with the confirmed features
    setSelectedIdeas(new Set(selectedFeatures.map(f => f.id)));
    setShowFeatureSelection(false);

    console.log(`[Feature Selection] User selected ${selectedFeatures.length} features`);

    // Check if user has a saved path preference
    try {
      const savedPreference = localStorage.getItem('orbitai_path_preference');
      if (savedPreference === 'agents' || savedPreference === 'quick') {
        // Use saved preference directly
        handlePathSelected(savedPreference);
        return;
      }
    } catch (e) {
      // Ignore localStorage errors
    }

    // Show Path Choice modal
    setShowPathChoice(true);
  }, [handlePathSelected]);


  const handleLaunchProject = useCallback(async () => {
    if (!projectPreview || isLaunchingProject || !onLaunchProject) return;

    setIsLaunchingProject(true);

    try {
      // FEATURE SELECTION: Determine which ideas to send based on user selection
      let filteredIdeas = ideas;
      let selectionMode: 'all' | 'selected' | 'root-only' = 'all';

      if (selectedIdeas.size > 0 && selectedIdeas.size < ideas.length) {
        // User has explicitly selected SOME features (not all) - use only those
        filteredIdeas = ideas.filter(idea => selectedIdeas.has(idea.id));
        selectionMode = 'selected';
        console.log(`[Launch Project] Using ${filteredIdeas.length} user-selected ideas out of ${ideas.length} total`);
      } else if (selectedIdeas.size === 0) {
        // No explicit selection - send all but mark hierarchy for LLM
        selectionMode = 'all';
        console.log(`[Launch Project] No selection made - sending all ${ideas.length} ideas with hierarchy`);
      } else {
        // User selected ALL ideas explicitly
        selectionMode = 'all';
        console.log(`[Launch Project] User selected all ${ideas.length} ideas - sending with hierarchy`);
      }

      // Enrich ideas with hierarchy information for better LLM understanding
      const enrichedIdeas = filteredIdeas.map(idea => ({
        ...idea,
        isRoot: !idea.parentId || idea.parentId === 'CENTER',
        childCount: filteredIdeas.filter(child => child.parentId === idea.id).length,
        priority: (!idea.parentId || idea.parentId === 'CENTER') ? 'high' : 'medium'
      }));

      // Collect all brainstorming data with ENRICHED ideas
      const brainstormingData = {
        topic,
        ideas: enrichedIdeas,  // Enriched with hierarchy info
        selectionMode,         // Tell backend how to interpret
        keyInsights,
        nextSteps,
        projectPreview,
        selectedStandards,
        messages,
        useInternet,
        conversationId: currentConversationId,
        workspaceId: currentWorkspaceId // Link build to same workspace as chat
      };

      // Call the parent callback to launch project
      await onLaunchProject(brainstormingData);

      if (import.meta.env.DEV) {
        console.log('[Launch Project] Project launched successfully with brainstorming data:', {
          topic,
          ideasCount: ideas.length,
          insightsCount: keyInsights.length,
          nextStepsCount: nextSteps.length,
          hasPreview: !!projectPreview,
          standardsCount: selectedStandards.length,
          messagesCount: messages.length
        });
      }
    } catch (error) {
      console.error('[Launch Project] Failed to launch project:', error);
      // Show error toast if available
      try {
        const { toast } = await import('../services/toastService');
        toast.error('Failed to launch project. Please try again.', 5000);
      } catch (toastError) {
        // Toast service not available
      }
    } finally {
      setIsLaunchingProject(false);
    }
  }, [projectPreview, isLaunchingProject, onLaunchProject, topic, ideas, selectedIdeas, keyInsights, nextSteps, selectedStandards, messages, useInternet, currentConversationId, currentWorkspaceId]);

  // Handle regenerating prototype based on current refinements
  const handleRegeneratePrototype = useCallback(async (section?: 'wireframe' | 'architecture') => {
    if (isGeneratingPreview || prototypingStage !== 'prototyping') return;

    setIsGeneratingPreview(true);
    setGenerationProgress(0);

    // Simulate progress updates during regeneration
    const progressInterval = setInterval(() => {
      setGenerationProgress(prev => {
        // Gradually increase progress, but cap at 90% until generation completes
        if (prev < 10) return 10;
        if (prev < 30) return prev + 2;
        if (prev < 60) return prev + 1.5;
        if (prev < 90) return prev + 1;
        return 90; // Cap at 90% until completion
      });
    }, 500); // Update every 500ms

    try {
      setGenerationProgress(15); // Started regeneration

      // Build structured project context with all refinements
      const userMessages = messages.filter(m => m.sender === 'user');

      // Extract initial user goal
      const initialGoal = userMessages.length > 0
        ? userMessages[0].text
        : (topic && topic !== "Start Crafting Your Idea" && topic !== "Your Project starts here" ? topic : 'New project idea');

      // Structure ideas with all details
      const structuredIdeas = ideas
        .filter(i => i.id !== 'welcome-bubble')
        .map(i => {
          const ideaObj: any = {
            label: i.label
          };
          if (i.description) ideaObj.description = i.description;
          if (i.notes) ideaObj.notes = i.notes;
          if (i.category && i.category !== 'idea') ideaObj.category = i.category;
          if (i.priority) ideaObj.priority = `${i.priority}/5`;
          if (i.state && i.state !== 'new') ideaObj.state = i.state;
          if (i.tags && i.tags.length > 0) ideaObj.tags = i.tags;
          if (i.parentId) ideaObj.parentId = i.parentId;
          return ideaObj;
        });

      // Build structured user goal with clear sections
      const structuredGoal = `PROJECT TOPIC: ${topic && topic !== "Start Crafting Your Idea" && topic !== "Your Project starts here" ? topic : 'To be determined'}

INITIAL REQUEST:
${initialGoal}

${userMessages.length > 1 ? `\nADDITIONAL REQUIREMENTS:\n${userMessages.slice(1).map((m, idx) => `${idx + 1}. ${m.text}`).join('\n')}` : ''}

${structuredIdeas.length > 0 ? `\nUPDATED PROJECT IDEAS & REQUIREMENTS (${structuredIdeas.length} items):\n${structuredIdeas.map((idea, idx) => {
        const parts = [`${idx + 1}. ${idea.label}`];
        if (idea.description) parts.push(`   Description: ${idea.description}`);
        if (idea.category) parts.push(`   Category: ${idea.category}`);
        if (idea.priority) parts.push(`   Priority: ${idea.priority}`);
        if (idea.state) parts.push(`   State: ${idea.state}`);
        if (idea.notes) parts.push(`   Notes: ${idea.notes}`);
        if (idea.tags && idea.tags.length > 0) parts.push(`   Tags: ${idea.tags.join(', ')}`);
        return parts.join('\n');
      }).join('\n\n')}` : ''}

${keyInsights.length > 0 ? `\nKEY INSIGHTS:\n${keyInsights.map((insight, idx) => `${idx + 1}. ${insight}`).join('\n')}` : ''}

${nextSteps.length > 0 ? `\nNEXT STEPS:\n${nextSteps.map((step, idx) => `${idx + 1}. ${step}`).join('\n')}` : ''}

${selectedStandards.length > 0 ? `\nSELECTED STANDARDS:\n${selectedStandards.map((std, idx) => `${idx + 1}. ${std}`).join('\n')}` : ''}

${projectPreview ? `\nCURRENT PROJECT CONTEXT (for reference):
Summary: ${projectPreview.summary || 'N/A'}
Tech Stack: ${(projectPreview.techStack || []).join(', ')}
Methodology: ${projectPreview.recommendedMethodology || 'N/A'}

Please regenerate the prototype considering all updates and refinements mentioned above.` : ''}`;

      // Create enhanced conversation history with structured context
      const enhancedMessages: ChatMessage[] = [...messages];

      // Add structured context as a system message
      enhancedMessages.push({
        id: `structured-refinement-${Date.now()}`,
        sender: 'system',
        text: structuredGoal,
        timestamp: Date.now()
      });

      setGenerationProgress(30); // Analyzing conversation

      // Regenerate project preview with current refinements and enhanced context
      // Pass current preview as context to allow backend to reuse unchanged parts (refinement mode)
      // Pass 'section' to tell backend which specific part to force-regenerate (if any)
      // If section is provided ('wireframe' or 'architecture'), we reuse the other parts.
      const refinementContext = section ? projectPreview : undefined;
      const preview = await generateProjectPreview(structuredGoal, enhancedMessages, useInternet, refinementContext, section);

      setGenerationProgress(95); // Almost done

      // Normalize preview before setting state
      const normalizedPreview = normalizeProjectPreview(preview);
      setProjectPreview(normalizedPreview || null);

      setGenerationProgress(100); // Complete

      // Save regenerated preview to database
      if (currentConversationId && hasUserMessage && messages.length > 0) {
        await saveConversationImmediately();
      }

      if (import.meta.env.DEV) {
        console.log('[Prototyping] Prototype regenerated with refinements:', {
          hasPreview: !!normalizedPreview,
          hasArchitecture: !!normalizedPreview?.architectureDiagram,
          hasWireframe: !!normalizedPreview?.wireframeCode,
          ideasIncluded: structuredIdeas.length,
          messagesIncluded: enhancedMessages.length
        });
      }
    } catch (error: any) {
      console.error('[Prototyping] Failed to regenerate prototype:', error);
      setGenerationProgress(0);

      // Show user-friendly error message
      const errorMessage = error?.message || 'Failed to regenerate prototype';
      if (errorMessage.includes('incomplete preview data') || errorMessage.includes('Missing or empty')) {
        toast.error('Prototype regeneration incomplete. Some sections (Architecture, Prototype, or Code) were not generated. Please try again or refine your project description.');
      } else if (errorMessage.includes('timeout') || errorMessage.includes('Timeout')) {
        toast.error('Prototype regeneration timed out. The request took too long. Please try again with a shorter project description.');
      } else {
        toast.error(`Failed to regenerate prototype: ${errorMessage}`);
      }
    } finally {
      clearInterval(progressInterval);
      setIsGeneratingPreview(false);
      // Reset progress after a short delay
      setTimeout(() => setGenerationProgress(0), 500);
    }
  }, [messages, ideas, useInternet, isGeneratingPreview, prototypingStage, projectPreview, currentConversationId, hasUserMessage, saveConversationImmediately]);

  // Manual transition handler (no auto-transition)
  const handleManualTransition = useCallback(async () => {
    if (!readyCheck.canProceed || isGeneratingPreview || prototypingStage === 'prototyping') return;
    await handleTransitionToPrototyping();
  }, [readyCheck.canProceed, isGeneratingPreview, prototypingStage, handleTransitionToPrototyping]);

  // Handle going back to ideation from prototyping
  const handleBackToIdeation = useCallback(async () => {
    if (prototypingStage !== 'prototyping') return;

    // Save conversation before going back (to preserve any changes)
    if (hasUserMessage && messages.length > 0) {
      await saveConversationImmediately();
    }

    setPrototypingStage('ideation');

    if (import.meta.env.DEV) {
      console.log('[Prototyping] Returned to ideation stage');
    }
  }, [prototypingStage, hasUserMessage, messages.length, saveConversationImmediately]);

  // Handle workspace deletion
  const handleDeleteWorkspace = (folderId: string, folderName: string, count: number) => {
    setFolderToDelete({ id: folderId, name: folderName, count });
  };

  // Handle workspace rename
  const handleStartRename = (folder: ProjectFolder) => {
    setEditingFolderId(folder.id);
    setEditingFolderName(folder.name);
  };

  const handleSaveRename = async () => {
    if (!editingFolderId || !editingFolderName.trim()) {
      setEditingFolderId(null);
      return;
    }

    try {
      const updatedFolder = await projectFolderApi.updateFolder(editingFolderId, {
        name: editingFolderName.trim()
      });

      setProjectFolders(prev => prev.map(f => f.id === editingFolderId ? updatedFolder : f));
      toast.success('Workspace renamed');
    } catch (error: any) {
      console.error('Failed to rename workspace:', error);
      toast.error('Failed to rename workspace');
    } finally {
      setEditingFolderId(null);
      setEditingFolderName('');
    }
  };

  // Handle deleting a conversation
  const handleDeleteConversation = useCallback(async (conversationId: string) => {
    if (!conversationId) return;
    try {
      await chatApi.deleteConversation(conversationId);
      setSavedConversations(prev => prev.filter(c => c.id !== conversationId));
      toast.success('Conversation deleted');

      // If the current conversation was deleted, reset the view
      if (currentConversationId === conversationId) {
        performReset();
      }
    } catch (error: any) {
      console.error('Failed to delete conversation:', error);
      toast.error('Failed to delete conversation');
    }
  }, [currentConversationId, performReset]);

  // Handle getting agents involved in brainstorming
  // Handle getting agents involved in brainstorming
  const handleGetAgentsInvolved = useCallback(async () => {
    if (isGettingAgentsInvolved || isProcessing) return;

    // ALWAYS switch to chat layout when agents are involved
    if (layoutMode === 'rest') {
      setLayoutMode('chat');
      setShowChatHistorySidebar(true);
    }

    // First, send the user's input message if there is one (like the send button would)
    const textToSend = input?.trim();
    if (textToSend) {
      console.log('📤 [Agents] Sending user message before inviting agents:', textToSend.substring(0, 50));

      // Add user message to conversation
      const userMessage: ChatMessage = {
        id: Date.now().toString(),
        sender: 'user',
        text: textToSend,
        timestamp: Date.now()
      };

      // Switch to chat layout when first message is sent
      if (layoutMode === 'rest') {
        setLayoutMode('chat');
        setShowChatHistorySidebar(true); // Explicitly open sidebar
      }

      // If this is the kickoff message (first user message), update topic immediately
      // Also trigger the Sandbox Pre-Boot here for zero-latency preview later
      if (!hasUserMessage) { // Using hasUserMessage to check if it's the first user message
        if (!topic) {
          // Extract topic from first message
          const extractedTopic = textToSend.length > 50 ? textToSend.substring(0, 50) + '...' : textToSend;
          setTopic(extractedTopic);
        }

        // PRE-BOOT STRATEGY: Start booting the WebContainer engine now
        // This happens while the AI is thinking/generating, so by the time 
        // the user reaches the "Preview" stage, the sandbox is ready.
        console.log('[NeuralStreamChat] 🚀 Triggering Sandbox Pre-Boot sequence...');
        webContainerService.boot().catch(err => {
          console.warn('[NeuralStreamChat] Pre-boot warning:', err);
        });
      }

      // Update topic if this is the first message (this block was moved/modified)
      if (!hasUserMessage) {
        const newTopic = textToSend.length > 50 ? textToSend.substring(0, 50) + '...' : textToSend;
        setTopic(newTopic);
      }

      // Add message to UI
      if (onLoadConversation) {
        onLoadConversation([...messages, userMessage]);
      }

      // Clear input
      setInput('');
      setAttachedFiles([]);

      // Save the user message to conversation
      let targetConversationId = currentConversationId;
      if (!targetConversationId) {
        // Create a new conversation if none exists
        // Auto-create a NEW WORKSPACE with the topic name for this conversation
        let workspaceFolderId: string | undefined;

        // Workspace name from first message
        const workspaceName = textToSend.length > 40
          ? textToSend.substring(0, 40) + '...'
          : textToSend;

        if (isAuthenticated && user) {
          // AUTHENTICATED USER: Save workspace to database
          try {
            const newWorkspace = await projectFolderApi.createFolder({
              name: workspaceName,
              description: `Auto-created workspace for: ${workspaceName}`,
              platforms: ['other']
            });

            workspaceFolderId = newWorkspace.id || newWorkspace._id;

            // Track the current workspace for build linking
            setCurrentWorkspaceId(workspaceFolderId!);

            // Update local state to show the new workspace
            setProjectFolders(prev => [...prev, {
              id: workspaceFolderId!,
              userId: user.id,
              name: workspaceName,
              description: `Auto-created workspace for: ${workspaceName}`,
              platforms: ['other'],
              conversationIds: [],
              createdAt: Date.now(),
              updatedAt: Date.now()
            }]);

            // Auto-expand the new workspace in the sidebar
            setExpandedFolders(prev => {
              const next = new Set(prev);
              next.add(workspaceFolderId!);
              return next;
            });

            console.log('✅ [Workspace] Auto-created workspace (DB):', workspaceName, workspaceFolderId);
          } catch (folderError) {
            console.warn('Failed to create workspace, will use Unorganized:', folderError);
            // Fallback to Unorganized folder if workspace creation fails
            try {
              const folders = await projectFolderApi.getFolders();
              const unorganizedFolder = folders.find(f => f.name === 'Unorganized');
              workspaceFolderId = unorganizedFolder?.id;
            } catch (fallbackError) {
              console.warn('Failed to get fallback folder:', fallbackError);
            }
          }
        } else {
          // GUEST USER: Store workspace in sessionStorage (deleted on tab/browser close)
          try {
            const guestWorkspaceId = `guest-workspace-${Date.now()}`;
            const guestWorkspace = {
              id: guestWorkspaceId,
              userId: 'guest',
              name: workspaceName,
              description: `Guest workspace for: ${workspaceName}`,
              platforms: ['other'] as const,
              conversationIds: [] as string[],
              createdAt: Date.now(),
              updatedAt: Date.now()
            };

            // Get existing guest workspaces from localStorage (persists across sessions)
            const existingWorkspaces = JSON.parse(localStorage.getItem('guestWorkspaces') || '[]');
            existingWorkspaces.push(guestWorkspace);
            localStorage.setItem('guestWorkspaces', JSON.stringify(existingWorkspaces));

            workspaceFolderId = guestWorkspaceId;
            setCurrentWorkspaceId(guestWorkspaceId);

            // Update local state
            setProjectFolders(prev => [...prev, guestWorkspace as any]);

            // Auto-expand the new workspace in the sidebar
            setExpandedFolders(prev => {
              const next = new Set(prev);
              next.add(guestWorkspaceId);
              return next;
            });

            console.log('✅ [Workspace] Auto-created guest workspace (sessionStorage):', workspaceName, guestWorkspaceId);
          } catch (guestError) {
            console.warn('Failed to create guest workspace:', guestError);
          }
        }

        try {
          const newConversation = await chatApi.createConversation({
            type: 'neural-chat',
            folderId: workspaceFolderId,
            initialMessage: userMessage
          });
          targetConversationId = newConversation._id || newConversation.id || null;
          setCurrentConversationId(targetConversationId);

          // Add the new conversation to savedConversations so it shows in the sidebar under the workspace
          if (targetConversationId) {
            const newConvEntry = {
              id: targetConversationId,
              title: workspaceName,
              preview: textToSend,
              timestamp: Date.now(),
              messages: [userMessage],
              topic: workspaceName,
              ideas: [],
              keyInsights: [],
              nextSteps: [],
              projectPreview: null,
              selectedStandards: [],
              folderId: workspaceFolderId // Link to the workspace
            };
            setSavedConversations(prev => [newConvEntry, ...prev]);
            console.log('📝 [Conversation] Added new conversation to sidebar:', targetConversationId);
          }
        } catch (initialErr: any) {
          console.warn('[Agents] Failed to create initial conversation (likely guest):', initialErr.message);

          // FALLBACK FOR GUESTS: Create a local conversation entry even if API fails
          // This ensures the conversation shows up in the sidebar under the workspace
          const localConversationId = `guest-conv-${Date.now()}`;
          targetConversationId = localConversationId;
          setCurrentConversationId(localConversationId);

          const guestConvEntry = {
            id: localConversationId,
            title: workspaceName,
            preview: textToSend,
            timestamp: Date.now(),
            messages: [userMessage],
            topic: workspaceName,
            ideas: [],
            keyInsights: [],
            nextSteps: [],
            projectPreview: null,
            selectedStandards: [],
            folderId: workspaceFolderId // Link to the workspace
          };
          setSavedConversations(prev => [guestConvEntry, ...prev]);
          console.log('📝 [Conversation] Added guest conversation to sidebar:', localConversationId, 'in workspace:', workspaceFolderId);
        }
      } else {
        try {
          // Add message to existing conversation
          await chatApi.addMessage(targetConversationId, { message: userMessage });
        } catch (msgErr: any) {
          console.warn('[Agents] Failed to save user message (likely guest):', msgErr.message);
        }
      }

      // Small delay to let the message be processed
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    setIsGettingAgentsInvolved(true);

    try {
      // Build project description from topic, ideas, and conversation
      const projectDescription = [
        topic && topic !== "Start Crafting Your Idea" && topic !== "Your Project starts here" ? `Project: ${topic}` : '',
        ideas.length > 0 ? `\nKey Ideas:\n${ideas.slice(0, 10).map(i => `- ${i.label}: ${i.description || ''}`).join('\n')}` : '',
        keyInsights.length > 0 ? `\nInsights:\n${keyInsights.map(i => `- ${i}`).join('\n')}` : '',
        nextSteps.length > 0 ? `\nNext Steps:\n${nextSteps.map(s => `- ${s}`).join('\n')}` : ''
      ].filter(Boolean).join('\n') || 'A new project idea that needs refinement and enhancement.';

      const recentMessages = messages.slice(-10).map(msg => `${msg.sender === 'user' ? 'User' : 'AI'}: ${msg.text}`).join('\n');
      const fullDescription = projectDescription + (recentMessages ? `\n\nRecent Conversation:\n${recentMessages}` : '');

      if (import.meta.env.DEV) {
        console.log('🤖 [Agents] Analyzing project to select relevant agents...', {
          topic,
          ideasCount: ideas.length,
          descriptionLength: fullDescription.length
        });
      }

      // Step 1: Analyze project and select relevant agents
      const agentAnalysisResponse = await apiRequest<{
        success: boolean;
        data?: {
          selectedAgents?: Array<{ role: string; justification: string }>;
          overallReasoning?: string;
        };
      }>('/api/ai-agents/analyze-agent-requirements', {
        method: 'POST',
        body: JSON.stringify({
          projectName: topic || 'New Project',
          projectDescription: fullDescription,
          currentPhase: 'Initiation',
          availableAgents: [
            { role: 'Requirements Agent', name: 'Nour', description: 'Elite Requirements Architect & Domain Expert', capabilities: ['requirements_gathering', 'domain_analysis'] },
            { role: 'UX Designer', name: 'Karim', description: 'Visionary Product Design Lead', capabilities: ['ui_design', 'ux_research', 'user_experience'] },
            { role: 'Design/Architecture Agent', name: 'Tarek', description: 'Distinguished System Architect', capabilities: ['system_design', 'architecture', 'technical_planning'] },
            { role: 'Orchestrator', name: 'Raed', description: 'Distinguished Program Director', capabilities: ['project_coordination', 'planning'] }
          ]
        })
      });

      if (!agentAnalysisResponse.success || !agentAnalysisResponse.data?.selectedAgents?.length) {
        throw new Error('No relevant agents selected for this project');
      }

      const selectedAgents = agentAnalysisResponse.data.selectedAgents;

      if (import.meta.env.DEV) {
        console.log('✅ [Agents] Selected agents:', selectedAgents.map(a => a.role));
      }

      // Step 2: Prepare agent join message (used later)
      const agentRolesList = selectedAgents.map(a => a.role).join(', ');
      const agentJoinMessage = `🤖 **AI Agents Joined the Conversation**\n\n${agentRolesList} have been invited to collaborate on enhancing this project idea. They will work together to provide insights, suggestions, and improvements.`;

      // Step 3: Format agents for autogen and initiate multi-agent conversation
      const autogenAgents = selectedAgents.map(selection => {
        // Map role to agent details from constants
        const agentMap: Record<string, { name: string; description: string; goal: string; backstory: string }> = {
          'Requirements Agent': {
            name: 'Nour',
            description: 'Elite Requirements Architect & Domain Expert with 18+ years bridging business and tech.',
            goal: 'Distill abstract visions into mathematically precise, unambiguous specifications.',
            backstory: 'Started as a kernel developer before moving to systems analysis. Treats requirements as the project\'s constitution.'
          },
          'UX Designer': {
            name: 'Karim',
            description: 'Visionary Product Design Lead with 15+ years shaping human-computer interaction.',
            goal: 'Craft interfaces that feel inevitable. Design systems that scale effortlessly.',
            backstory: 'Designs have won multiple Apple Design Awards. Believes a pixel out of place is a breach of user trust.'
          },
          'Design/Architecture Agent': {
            name: 'Tarek',
            description: 'Distinguished System Architect with 20+ years designing hyper-scale distributed systems.',
            goal: 'Architect resilient, cloud-native solutions that survive the test of time.',
            backstory: 'Author of seminal books on microservices. Builds digital cathedrals of logic.'
          },
          'Orchestrator': {
            name: 'Raed',
            description: 'Distinguished Program Director with 20+ years driving digital transformation.',
            goal: 'Orchestrate high-stakes technical initiatives with military precision.',
            backstory: 'A veteran of Silicon Valley giants who has led multi-million dollar projects from inception to IPO.'
          }
        };

        const agentDetails = agentMap[selection.role] || {
          name: selection.role.replace(' Agent', '').replace('/', ' '),
          description: selection.justification,
          goal: 'Enhance and improve the project idea',
          backstory: 'Expert in their field working to improve this project'
        };

        return {
          id: selection.role.toLowerCase().replace(/\s+/g, '-').replace(/\//g, '-'),
          name: agentDetails.name,
          systemMessage: `You are ${agentDetails.name}, ${agentDetails.description}. Your goal: ${agentDetails.goal}. Background: ${agentDetails.backstory}. 

CONTEXT: The user is building a project with the topic: "${topic || 'Software Project'}".
FULL DESCRIPTION: ${fullDescription}

CRITICAL INSTRUCTION: You must provide CONCRETE, SPECIFIC ideas for this exact project topic ("${topic}").
- DO NOT use generic project management phrases like "Define Core Problem", "Establish KPIs", "Identify Persona", "Define MVP", "Scope Boundaries".
- DO NOT give abstract advice or act like a consultant.
- DO NOT say "As a [Role], I recommend..." or "From a [Role] perspective...". Just say the idea.
- You MUST discuss CONCRETE features, SPECIFIC mechanics, ACUTAL design elements, and REAL technical details.
- If this is a Game, talk about gameplay loops, level design, safeguards, graphics style.
- If this is an App, talk about specific screens, data fields, user interactions.

You are collaborating with other agents to enhance this specific project idea. This is a brainstorming session where you should:
- Actively participate and share your expertise
- Provide specific, actionable insights
- Engage with other agents' ideas
- Be proactive - don't wait to be asked, contribute your thoughts
- Build on what others say when relevant

Be conversational, helpful, and focus on providing valuable insights that will improve the project.`,
          model: undefined, // Let autogen use default
          temperature: 0.7,
          maxConsecutiveAutoReply: 5, // Allow more consecutive replies for better conversation flow
          humanInputMode: 'NEVER' as const
        };
      });

      // Step 4: Create initial message for agents (optimized for speed)
      // Step 4: Create initial message for agents (optimized for speed)
      const initialAgentMessage = `Hello team! We're working on enhancing this project idea:

Topic: ${topic}
Description: ${fullDescription}

**Your Task:**
1. Briefly introduce yourself (1 sentence)
2. Provide 2-3 HIGHLY SPECIFIC, CREATIVE ideas for this "${topic}".
3. DO NOT use generic jargon (KPIs, MVP, Scope). Talk about ACTUAL features/mechanics.

**Important:** Be creative and concrete. What would make this "${topic}" amazing?`;

      // Step 5: Initiate multi-agent conversation
      const conversationId = `agent-collab-${currentConversationId || Date.now()}`;

      // Note: terminationCondition cannot be sent as a function in JSON
      // The backend will handle termination based on maxRounds and natural completion
      let conversationResponse;
      try {
        conversationResponse = await apiRequest<{
          success: boolean;
          data?: {
            conversationId?: string;
            messages?: Array<{ role: string; content: string; agentId?: string; timestamp?: Date }>;
            terminated?: boolean;
            rounds?: number;
          };
        }>('/api/autogen/conversations', {
          method: 'POST',
          body: JSON.stringify({
            conversationId,
            agents: autogenAgents,
            initialMessage: initialAgentMessage,
            config: {
              maxRounds: 3 // Optimized for speed: Intro + 1 Round max
            }
          })
          // Timeout is automatically set to 5 minutes by apiRequest for autogen endpoints
        });
      } catch (error: any) {
        console.error('❌ [Agents] Autogen API error:', error);
        throw new Error(`Failed to start agent conversation: ${error.message || 'Unknown error'}`);
      }

      // Check if we got messages back
      if (conversationResponse.success && conversationResponse.data?.messages) {
        const allMessages = conversationResponse.data.messages;

        if (import.meta.env.DEV) {
          console.log(`✅ [Agents] Conversation completed: ${conversationResponse.data.rounds} rounds, ${allMessages.length} messages`);
        }

        if (allMessages.length > 0) {
          // Step 6: Prepare agent messages for gradual display
          const agentMessages = allMessages
            .filter((msg: any) => msg.role === 'assistant' && msg.content)
            .map((msg: any) => ({
              sender: 'agent' as const,
              text: `**[${autogenAgents.find(a => a.id === msg.agentId)?.name || 'Agent'}]** ${msg.content}`,
              timestamp: msg.timestamp ? new Date(msg.timestamp).getTime() : Date.now(),
              agentName: autogenAgents.find(a => a.id === msg.agentId)?.name || 'Agent'
            }));

          // Step 7: Add agent messages to conversation gradually
          let targetConversationId = currentConversationId;

          // If no conversation exists, create one first
          if (!targetConversationId) {
            // Get or create default "Unorganized" folder for the user
            let defaultFolderId: string | undefined;
            if (isAuthenticated && user) {
              try {
                const folders = await projectFolderApi.getFolders();
                const unorganizedFolder = folders.find(f => f.name === 'Unorganized');
                defaultFolderId = unorganizedFolder?.id;
              } catch (folderError) {
                console.warn('Failed to get folders, backend will handle default folder:', folderError);
              }
            }

            // Create welcome message for new conversation
            const welcomeMessage = createOrchestratorWelcomeMessage();
            try {
              const newConversation = await chatApi.createConversation({
                type: 'neural-chat',
                folderId: defaultFolderId,
                initialMessage: welcomeMessage
              });
              targetConversationId = newConversation._id || newConversation.id || null;
              setCurrentConversationId(targetConversationId);
            } catch (dbError: any) {
              console.warn('[Agents] Failed to create conversation in DB (likely guest), proceeding with local state:', dbError.message);
            }

            // Add welcome message to UI
            if (onLoadConversation) {
              onLoadConversation([welcomeMessage]);
            }
          }

          if (targetConversationId) {
            try {
              // Add agent join message
              if (agentJoinMessage) {
                await chatApi.addMessage(targetConversationId, {
                  message: {
                    id: `agent-join-${Date.now()}`,
                    sender: 'system',
                    text: agentJoinMessage,
                    timestamp: Date.now()
                  }
                });
              }

              // Switch to history view
              setGlassPanelActiveView('history');

              // Reload to show join message
              const initialConversation = await chatApi.getConversation(targetConversationId);
              if (initialConversation && onLoadConversation) {
                // De-duplication logic (simplified)
                const uniqueMessages = Array.from(
                  new Map((initialConversation.messages || []).map((msg: ChatMessage) => [msg.id, msg])).values()
                );
                onLoadConversation(uniqueMessages);
              }
            } catch (dbError: any) {
              console.warn('[Agents] Failed to update DB (likely guest):', dbError.message);
            }
          } else {
            // Guest mode: Just switch view
            setGlassPanelActiveView('history');
          }

          // Update active agents state
          const agentsInfo = autogenAgents.map(agent => {
            const selectedAgent = selectedAgents.find(s => {
              const roleToNameMap: Record<string, string> = {
                'Requirements Agent': 'Nour',
                'UX Designer': 'Karim',
                'Design/Architecture Agent': 'Tarek',
                'Orchestrator': 'Raed'
              };
              return roleToNameMap[s.role] === agent.name || s.role === agent.name;
            });
            return {
              id: agent.id,
              name: agent.name,
              role: selectedAgent?.role || agent.name
            };
          });
          setActiveAgents(agentsInfo);

          // Calculate delay function
          // Calculate delay function
          const calculateDelay = (messageText: string, index: number): number => {
            // FAST TYPING SIMULATION: 50ms - 150ms max (Optimized for speed)
            const baseDelay = Math.min(50 + (messageText.length / 100) * 20, 150);
            return Math.max(50, baseDelay);
          };

          // Running list of messages for guest mode usage
          let currentLocalMessages: ChatMessage[] = [...messages];

          // Add messages loop
          for (let i = 0; i < agentMessages.length; i++) {
            const agentMsg = agentMessages[i];
            const delay = calculateDelay(agentMsg.text, i);
            await new Promise(resolve => setTimeout(resolve, delay));

            if (targetConversationId) {
              try {
                await chatApi.addMessage(targetConversationId, {
                  message: {
                    id: `agent-msg-${Date.now()}-${Math.random()}`,
                    sender: 'agent',
                    text: agentMsg.text,
                    timestamp: agentMsg.timestamp
                  }
                });

                if (!isReloadingMessagesRef.current) {
                  const conversation = await chatApi.getConversation(targetConversationId);
                  if (conversation && onLoadConversation) {
                    const uniqueMessages = Array.from(
                      new Map((conversation.messages || []).map((msg: ChatMessage) => [msg.id, msg])).values()
                    );
                    onLoadConversation(uniqueMessages);
                    currentLocalMessages = uniqueMessages;
                  }
                }
              } catch (msgError: any) {
                console.warn('[Agents] Guest fallback save failed:', msgError.message);
              }
            }

            if (!targetConversationId) {
              const newMsg: ChatMessage = {
                id: `agent-msg-${Date.now()}-${Math.random()}`,
                sender: 'agent',
                text: agentMsg.text,
                timestamp: agentMsg.timestamp || Date.now()
              };
              currentLocalMessages = [...currentLocalMessages, newMsg];
              if (onLoadConversation) {
                onLoadConversation(currentLocalMessages);
              }
            }
          }

          // Extraction logic
          // Extraction logic
          setTimeout(async () => {
            try {
              // Reduced from 3000ms to 200ms - just enough to let React state settle
              await new Promise(resolve => setTimeout(resolve, 200));
              let finalMessages: ChatMessage[] = [];
              if (targetConversationId) {
                const finalConversation = await chatApi.getConversation(targetConversationId);
                if (finalConversation?.messages) finalMessages = finalConversation.messages;
              } else {
                finalMessages = currentLocalMessages;
              }

              if (finalMessages.length > 0) {
                const recentMessages = finalMessages.slice(-25);
                // Trigger extraction with explicit topic to avoid stale closure issues
                if (recentMessages.length > 0) {
                  // Pass the original user input text if we have it, otherwise fallback to topic or null
                  const extractionTopic = textToSend || (topic !== "Start Crafting Your Idea" ? topic : null);
                  extractIdeasAndInsights(recentMessages, extractionTopic);
                }
              }
            } catch (err: any) {
              console.error('Error loading extraction:', err);
            }
          }, 800); // Reduced from 5000ms to 800ms

          // Success toast
          setTimeout(() => {
            toast.success(`🤖 ${selectedAgents.length} agents are collaborating on your project!`);
          }, 1500);
        } else {
          console.warn('[Agents] No messages generated');
          toast.warning('Agents were invited but generated no messages.');
        }

        if (import.meta.env.DEV) {
          console.log('✅ [Agents] Agent conversation completed');
        }
      } else {
        console.warn('[Agents] Conversation response failure');
        toast.warning('Failed to start agent conversation.');
      }

    } catch (error: any) {
      console.error('❌ [Agents] Failed to get agents involved:', error);
      toast.error(`Failed to invite agents: ${error.message || 'Unknown error'}`);
    } finally {
      setIsGettingAgentsInvolved(false);
    }
  }, [
    isGettingAgentsInvolved, isProcessing, input, messages, layoutMode, hasUserMessage,
    onLoadConversation, currentConversationId, isAuthenticated, user,
    extractIdeasAndInsights
  ]);

  const handleIdeaDelete = useCallback(async (ideaId: string) => {
    const idea = ideas.find(i => i.id === ideaId);
    if (!idea) return;

    const confirmed = await showConfirm(`Delete "${idea.label}"?`);
    if (confirmed) {
      setIdeas(prev => prev.filter(i => i.id !== ideaId));

      // Clear active idea if it was deleted
      if (activeIdeaId === ideaId) {
        setActiveIdeaId(null);
      }

      // Remove from selected ideas if selected
      setSelectedIdeas(prev => {
        const next = new Set(prev);
        next.delete(ideaId);
        return next;
      });

      // Save conversation after deletion
      if (hasUserMessage && messages.length > 0) {
        await saveConversationImmediately();
      }

      if (import.meta.env.DEV) {
        console.log('[NeuralStreamChat] Idea deleted:', ideaId);
      }
    }
  }, [ideas, activeIdeaId, hasUserMessage, messages.length, saveConversationImmediately]);

  // Handle theme generation for prototype
  const handleGenerateTheme = useCallback(async (description: string): Promise<{ primary: string; secondary: string; accent: string; background: string; textColor: string }> => {
    try {
      const theme = await generateAppTheme(description);
      return {
        primary: theme.primary || '#6366f1',
        secondary: theme.secondary || '#8b5cf6',
        accent: theme.accent || '#ec4899',
        background: theme.background || '#f8fafc',
        textColor: theme.textColor || '#1e293b'
      };
    } catch (error) {
      console.error('[Prototyping] Failed to generate theme:', error);
      // Return default theme on error
      return {
        primary: '#6366f1',
        secondary: '#8b5cf6',
        accent: '#ec4899',
        background: '#f8fafc',
        textColor: '#1e293b'
      };
    }
  }, []);

  // Helper function to get platform icon (uses first platform if array provided)
  const getPlatformIcon = useCallback((platform?: string | string[]) => {
    const platformValue = Array.isArray(platform) ? platform[0] : platform;
    switch (platformValue) {
      case 'web': return Globe;
      case 'android': case 'ios': return Smartphone;
      case 'desktop': return Monitor;
      case 'api': return Server;
      default: return Code;
    }
  }, []);

  return (
    <div className="relative w-full h-full bg-slate-50 overflow-hidden font-sans text-slate-900 selection:bg-rose-200 flex">

      {/* Chat History Sidebar - Redesigned */}
      <ChatHistorySidebar
        showChatHistorySidebar={showChatHistorySidebar}
        setShowChatHistorySidebar={setShowChatHistorySidebar}
        systemMessages={systemMessages}
        setSystemMessages={setSystemMessages}
        startNewConversation={startNewConversation}
        projectFolders={projectFolders}
        savedConversations={savedConversations}
        setFolderManagerMode={setFolderManagerMode}
        setEditingFolder={setEditingFolder}
        setShowFolderManager={setShowFolderManager}
        expandedFolders={expandedFolders}
        setExpandedFolders={setExpandedFolders}
        editingFolderId={editingFolderId}
        setEditingFolderId={setEditingFolderId}
        editingFolderName={editingFolderName}
        setEditingFolderName={setEditingFolderName}
        handleSaveRename={handleSaveRename}
        handleStartRename={handleStartRename}
        handleDeleteWorkspace={handleDeleteWorkspace}
        currentConversationId={currentConversationId}
        loadConversation={loadConversation}
        handleDeleteConversation={handleDeleteConversation}
      />

      {/* Toggle Sidebar Button */}
      {
        !showChatHistorySidebar && (
          <button
            onClick={() => setShowChatHistorySidebar(true)}
            className="absolute left-2 top-32 z-30 p-2 bg-white/90 backdrop-blur-sm border border-slate-300 rounded-lg shadow-sm hover:bg-white hover:shadow-md transition-all"
            title="Open chat history"
          >
            <ChevronRight size={16} className="text-slate-600" />
          </button>
        )
      }

      {/* Background Ambience with Animation */}
      <div className="absolute inset-0 z-0 opacity-40 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-200 rounded-full blur-[120px] animate-pulse" style={{ animationDuration: '8s' }} />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-200 rounded-full blur-[120px] animate-pulse" style={{ animationDuration: '10s', animationDelay: '2s' }} />
        <div className="absolute top-[40%] left-[40%] w-[30%] h-[30%] bg-rose-100 rounded-full blur-[100px] animate-pulse" style={{ animationDuration: '12s', animationDelay: '4s' }} />
      </div>

      {/* Conversation History is now in the Session Context (GlassPanel) */}

      {/* Top Navigation Buttons - Always Visible */}
      <div className="absolute top-6 right-8 z-[60] flex flex-col items-end gap-2">
        <div className="flex items-center gap-2">
          {/* Layout Toggle Button - Only show when there are messages */}
          {hasUserMessage && prototypingStage === 'ideation' && (
            <button
              onClick={() => setLayoutMode(layoutMode === 'rest' ? 'chat' : 'rest')}
              className="px-3 py-2 bg-white/90 backdrop-blur-sm border border-slate-200 rounded-lg shadow-md hover:bg-white hover:shadow-lg transition-all text-sm font-semibold text-slate-700 flex items-center gap-2"
              title={layoutMode === 'rest' ? 'Switch to Chat Layout' : 'Switch to Rest Layout'}
            >
              {layoutMode === 'rest' ? (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  <span className="hidden sm:inline">Chat Layout</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                  </svg>
                  <span className="hidden sm:inline">Mind Map</span>
                </>
              )}
            </button>
          )}

          {!isAuthenticated ? (
            <button
              onClick={() => setShowUserLogin(true)}
              className="px-4 py-2 bg-gradient-to-r from-primary to-indigo-600 text-white rounded-lg shadow-md hover:from-primary/90 hover:to-indigo-700 hover:shadow-lg transition-all text-sm font-semibold flex items-center gap-2"
              title="Sign In"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
              </svg>
              Sign In
            </button>
          ) : user && (
            <button
              onClick={() => setShowUserProfile(true)}
              className="flex items-center gap-2 px-3 py-2 bg-white/90 backdrop-blur-sm border border-slate-200 rounded-lg shadow-md hover:bg-white hover:shadow-lg transition-all text-sm font-semibold text-slate-700"
              title="User Profile"
            >
              {user.avatar ? (
                <img src={user.avatar} className="w-5 h-5 rounded-full bg-slate-100" alt={user.name} />
              ) : (
                <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center text-white text-xs font-bold">
                  {user.name.charAt(0).toUpperCase()}
                </div>
              )}
              <span className="hidden sm:inline">{user.name.split(' ')[0]}</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Layout Grid */}
      <div className="relative z-10 w-full h-full flex">

        {/* Left/Center: Visualization or GlassPanel (when prototyping) */}
        <div className={`relative h-full flex-1 ${prototypingStage === 'prototyping'
          ? 'max-w-[520px] border-r border-slate-200/50'
          : ''
          }`}>
          {/* Header / Branding */}
          <div className="absolute top-8 left-8 z-20">
            <h1 className="text-2xl font-bold tracking-tight text-slate-800">Orbit<span className="text-rose-500">AI</span></h1>
            <p className="text-xs text-slate-500 mt-1">AI-Powered Ideation Canvas</p>
          </div>


          {prototypingStage === 'ideation' ? (
            <div className={`w-full h-full transition-opacity duration-500 ${isResetting ? 'opacity-0' : 'opacity-100'} relative`}>
              <IdeaVisualization
                viewMode={viewMode}
                ideas={ideas}
                activeIdeaId={activeIdeaId}
                onIdeaClick={handleIdeaClick}
                topic={topic}
                projectPreview={projectPreview} // Need to check if available
                messages={messages}
                keyInsights={keyInsights}
                nextSteps={nextSteps}
                selectedIdeaIds={selectedIdeas}
                onIdeaDelete={handleIdeaDelete}
                onViewChange={setViewMode}
                showViewToggle={hasUserMessage}
              />
            </div>
          ) : (
            /* Expanded GlassPanel when in prototyping phase */
            <div className={`absolute flex items-center justify-center transition-opacity duration-300 ${isResetting ? 'opacity-0' : 'opacity-100'}`} style={{ top: '90px', bottom: '20px', left: '0', width: '520px', paddingTop: '0.5rem', paddingRight: '1rem', paddingBottom: '8rem', paddingLeft: '1rem', zIndex: 10 }}>
              <GlassPanel
                key={`glass-expanded-${currentConversationId || 'new'}-${topic}-${ideas.length}-${keyInsights.length}-${nextSteps.length}`}
                topic={topic}
                ideas={ideas}
                activeIdeaId={activeIdeaId}
                keyInsights={keyInsights}
                nextSteps={nextSteps}
                onIdeaClick={(ideaId) => setActiveIdeaId(ideaId === activeIdeaId ? null : ideaId)}
                onIdeaUpdate={updateIdea}
                useInternet={useInternet}
                onToggleInternet={onToggleInternet}
                selectedStandards={selectedStandards}
                messages={messages}
                showChatHistory={showChatHistory}
                onToggleChatHistory={() => setShowChatHistory(!showChatHistory)}
                onToggleStandard={onToggleStandard}
                onDeepResearch={onDeepResearch}
                onSendMessage={handleSendMessage}
                prototypingStage={prototypingStage}
                activeView={glassPanelActiveView}
                onActiveViewChange={setGlassPanelActiveView}
                setInput={setInput}
                onGenerateRelatedIdeas={generateRelatedIdeas}
                onIdeaRefinement={refineIdea}
                onGapAnalysis={performGapAnalysis}
                onCrossPollination={crossPollinateIdeas}
                loadingStatusText={loadingStatusText}
                // onGetAgentsInvolved={handleGetAgentsInvolved} // Disabled - using streaming chat
                isGettingAgentsInvolved={false}
                onDeepenIdeas={handleDeepenIdeas}
                deepenLevel={deepenLevel}
                isDeepeningIdeas={isDeepeningIdeas}
                hasIdeas={ideas.length > 0}
              />
            </div>
          )}

          {/* Start Crafting Your Idea Text - Shown above chat box before first message and when no ideas exist */}
          {!hasUserMessage && ideas.length === 0 && (!topic || topic === "Start Crafting Your Idea" || topic === "Your Project starts here") && (
            <div className="absolute inset-0 z-40 flex items-center justify-center pointer-events-none" style={{ background: 'linear-gradient(135deg, #f8f7ff 0%, #f0f4ff 50%, #faf5ff 100%)' }}>
              <div className="text-center" style={{ marginTop: '-80px' }}>
                <h2 className="text-6xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-purple-600 via-pink-500 to-rose-500 leading-tight">
                  Start Crafting Your Idea
                </h2>
              </div>
            </div>
          )}

          {/* Input Box - Positioned below welcome bubble initially, then moves to bottom after first input */}
          {/* In chat layout, moves down and adjusts width to make room for GlassPanel */}
          <div
            className={`absolute z-50 transition-all duration-700 ease-in-out ${hasUserMessage || layoutMode === 'chat'
              ? 'bottom-6'
              : 'top-[57%]'
              } ${isResetting ? 'opacity-0' : 'opacity-100'}`}
            style={
              prototypingStage === 'prototyping' ? {
                left: '260px', // Center of left column (520px / 2)
                transform: 'translateX(-50%)',
                maxWidth: '480px',
                width: '100%',
                bottom: '24px',
                top: 'auto'
              } : layoutMode === 'chat' ? {
                left: '50%', // Centered on screen
                transform: 'translateX(-50%)',
                maxWidth: '50rem', // Standard width
                width: '100%',
                bottom: '24px', // Ensure bottom is set explicitly for chat layout
                top: 'auto' // Clear any top positioning
              } : layoutMode === 'rest' ? {
                left: '50%', // Centered
                transform: 'translateX(-50%)',
                maxWidth: '50rem', // Constrained width for search-bar look
                width: '100%'
              } : {
                left: '50%',
                transform: 'translateX(-50%)',
                maxWidth: '50rem',
                width: '100%'
              }}
          >
            <div className={`flex items-center transition-all duration-300 ${hasUserMessage ? 'gap-1' : 'gap-2'}`}>
              {/* New Chat Button - Left of chat box */}
              {hasUserMessage && (
                <button
                  onClick={() => {
                    // Use the same function as sidebar button for consistency
                    startNewConversation();
                  }}
                  className={`p-2 bg-white/90 backdrop-blur-sm border border-slate-300 text-slate-600 rounded-xl shadow-sm hover:bg-white hover:shadow-md hover:border-indigo-400 hover:text-indigo-600 transition-all flex items-center justify-center group shrink-0 ${prototypingStage === 'prototyping' ? 'ml-3' : ''}`}
                  title="Start New Chat"
                >
                  <svg className="w-4 h-4 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </button>
              )}

              <div className="flex-1 relative">
                <OrbitAIControlBar
                  input={input}
                  setInput={setInput}
                  onSendMessage={handleSendMessage}
                  isProcessing={isProcessing || isAnalyzingFiles || isGeneratingPreview}
                  attachedFiles={attachedFiles}
                  onFilesChange={setAttachedFiles}
                  onVoiceToggle={handleVoiceToggle}
                  voiceState={liveSession.status}
                  isVoiceDisabled={(!hasUserMessage && ideas.length === 0) && prototypingStage !== 'prototyping'} // Disable voice until text sent OR brainstorming results available OR in prototyping stage
                  showGetAgentsInvolved={false} // Disabled - using streaming chat instead
                  // onGetAgentsInvolved={handleGetAgentsInvolved}
                  isGettingAgentsInvolved={false}
                  hasUserMessage={hasUserMessage}
                  onReadyToGo={handleTransitionToPrototyping}
                  readyCheck={readyCheck}
                  showReadyToGo={readyCheck?.canProceed}
                  onDeepenIdeas={handleDeepenIdeas}
                  deepenLevel={deepenLevel}
                  isDeepeningIdeas={isDeepeningIdeas}
                  hasIdeas={ideas.length > 0}
                  prototypingStage={prototypingStage}
                  layoutMode={layoutMode}
                  onInterrupt={liveSession.interrupt}
                  isAISpeaking={liveSession.isAISpeaking}
                >
                  {/* AI Suggestions - Horizontal compact chips aligned with input */}
                  {!hasUserMessage && input && input.length > 2 && (
                    <div className="mt-2 flex flex-wrap gap-2 items-center justify-start px-0">
                      {isFetchingAiSuggestions ? (
                        <div className="flex items-center gap-2 text-slate-400">
                          <div className="w-3 h-3 border-2 border-indigo-300 border-t-transparent rounded-full animate-spin" />
                          <span className="text-xs">AI suggestions...</span>
                        </div>
                      ) : aiSuggestions.length > 0 ? (
                        aiSuggestions.slice(0, 4).map((suggestion) => {
                          const handleEnhance = async () => {
                            if (setInput) {
                              setIsFetchingAiSuggestions(true);
                              const rawPrompt = `${input.trim()} ${suggestion.text}`;

                              try {
                                const response = await fetch('/api/llm/chat', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({
                                    message: `Polish and rewrite this project idea into a clear, professional, and concise one-sentence description. Keep it natural and focused. Only output the polished text, nothing else:\n\n"${rawPrompt}"`,
                                    history: [],
                                    contextType: 'wizard',
                                    preferFastModel: true,
                                    maxTokens: 150
                                  })
                                });

                                const data = await response.json();
                                if (data.success && data.response) {
                                  let polished = data.response.trim();
                                  polished = polished.replace(/^["']|["']$/g, '');
                                  polished = polished.replace(/^(Here's|Here is|Polished:?|Result:?)/i, '').trim();
                                  setInput(polished);
                                } else {
                                  let baseInput = input.trim();
                                  if (baseInput.length > 0 && baseInput[0] === baseInput[0].toLowerCase()) {
                                    baseInput = baseInput.charAt(0).toUpperCase() + baseInput.slice(1);
                                  }
                                  setInput(`${baseInput} ${suggestion.text}`);
                                }
                              } catch {
                                let baseInput = input.trim();
                                if (baseInput.length > 0 && baseInput[0] === baseInput[0].toLowerCase()) {
                                  baseInput = baseInput.charAt(0).toUpperCase() + baseInput.slice(1);
                                }
                                setInput(`${baseInput} ${suggestion.text}`);
                              } finally {
                                setIsFetchingAiSuggestions(false);
                              }
                            }
                          };

                          return (
                            <button
                              key={suggestion.id}
                              onClick={handleEnhance}
                              className="px-3 py-1.5 bg-white/90 backdrop-blur-sm border border-slate-200 rounded-full text-xs text-slate-600 hover:border-indigo-400 hover:text-indigo-600 hover:shadow-sm transition-all whitespace-nowrap"
                            >
                              <span className="text-indigo-400 mr-1">✦</span>
                              + {suggestion.text.length > 25 ? suggestion.text.substring(0, 25) + '...' : suggestion.text}
                            </button>
                          );
                        })
                      ) : null}
                    </div>
                  )}
                </OrbitAIControlBar>
              </div>
            </div>


            {/* Template and Setup View Buttons - Only shown before first message, below chat box */}
            {!hasUserMessage && (
              <div className="mt-3 flex items-center justify-center gap-2 w-full flex-wrap" style={{ marginLeft: '-22%' }}>
                {onSwitchToSetupView && (
                  <button
                    onClick={onSwitchToSetupView}
                    className="px-3 py-1.5 bg-white/90 backdrop-blur-sm border border-slate-300 text-slate-700 rounded-full shadow-sm hover:bg-white hover:shadow-md hover:border-indigo-400 transition-all text-xs font-medium flex items-center gap-1.5 group"
                  >
                    <svg className="w-3.5 h-3.5 text-slate-500 group-hover:text-indigo-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                    </svg>
                    <span>Switch to Setup Wizard</span>
                  </button>
                )}
              </div>
            )}
          </div>


          {/* Loading State for Idea Extraction - Only show when extraction is actually in progress */}
          {isExtractingIdeas && !generatingSuggestions && (
            <div className={`absolute left-1/2 -translate-x-1/2 z-20 backdrop-blur-sm bg-white/60 text-slate-600 px-4 py-2 rounded-lg shadow-md text-xs flex items-center gap-2 ${hasUserMessage ? 'bottom-28' : 'top-[calc(57%-80px)]'
              }`}>
              <div className="w-3 h-3 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"></div>
              <span>Analyzing conversation{extractionAgent ? ` (${extractionAgent})` : ''}...</span>
            </div>
          )}

          {/* Delete button - appears whenever a bubble is selected, independent of Analyzing conversation */}
          {/* Only show in ideation view, not in expanded prototyping view */}
          {activeIdeaId && activeIdeaId !== 'CENTER' && prototypingStage === 'ideation' && (
            <div className={`absolute left-1/2 z-20 ${hasUserMessage ? 'bottom-28' : 'top-[calc(57%-80px)]'
              }`} style={{ marginLeft: isExtractingIdeas && !generatingSuggestions ? '140px' : '0px' }}>
              <button
                onClick={async (e) => {
                  e.stopPropagation();
                  await handleIdeaDelete(activeIdeaId);
                }}
                className="p-1.5 rounded-full bg-rose-500 hover:bg-rose-600 text-white transition-colors flex items-center justify-center shadow-md backdrop-blur-sm"
                title={`Delete "${ideas.find(i => i.id === activeIdeaId)?.label || 'bubble'}"`}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          )}

          {/* Loading State for Bubble Suggestions */}
          {generatingSuggestions && (
            <div className="absolute top-32 left-1/2 -translate-x-1/2 z-20 backdrop-blur-xl bg-purple-500/80 text-white px-6 py-3 rounded-full shadow-lg flex items-center gap-3 animate-pulse">
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              <span className="text-sm font-medium">
                Generating brainstorming suggestions for "{ideas.find(i => i.id === generatingSuggestions)?.label || 'idea'}"...
              </span>
            </div>
          )}
        </div>

        {/* Context Menu */}
        {contextMenu && (() => {
          const idea = ideas.find(i => i.id === contextMenu.ideaId);
          if (!idea) return null;

          return (
            <div
              className="fixed z-50 bg-white rounded-lg shadow-xl border border-slate-200 py-1 min-w-[180px]"
              style={{ left: contextMenu.x, top: contextMenu.y }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => {
                  setActiveIdeaId(contextMenu.ideaId);
                  setContextMenu(null);
                }}
                className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 transition-colors flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                View Details
              </button>
              <button
                onClick={() => {
                  // TODO: Implement edit
                  setContextMenu(null);
                }}
                className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 transition-colors flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Edit
              </button>
              <div className="border-t border-slate-200 my-1"></div>
              <button
                onClick={() => {
                  setSelectedIdeas(prev => new Set([...prev, contextMenu.ideaId]));
                  setContextMenu(null);
                }}
                className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 transition-colors flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
                Merge
              </button>
              <button
                onClick={() => {
                  setLinkingMode(contextMenu.ideaId);
                  setLinkDialog({ sourceId: contextMenu.ideaId });
                  setContextMenu(null);
                }}
                className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 transition-colors flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
                Link to...
              </button>
              <div className="border-t border-slate-200 my-1"></div>
              <div className="px-4 py-1 text-xs text-slate-500">Priority</div>
              {[5, 4, 3, 2, 1].map(priority => (
                <button
                  key={priority}
                  onClick={() => {
                    setIdeas(prev => prev.map(i =>
                      i.id === contextMenu.ideaId ? { ...i, priority, updatedAt: Date.now() } : i
                    ));
                    setContextMenu(null);
                  }}
                  className="w-full px-4 py-1.5 text-left text-xs text-slate-600 hover:bg-slate-100 transition-colors flex items-center gap-2"
                >
                  {'★'.repeat(priority)}{'☆'.repeat(5 - priority)} {priority}
                </button>
              ))}
              <div className="border-t border-slate-200 my-1"></div>
              <button
                onClick={() => {
                  // TODO: Implement add note
                  setContextMenu(null);
                }}
                className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 transition-colors flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Add Note
              </button>
              <div className="border-t border-slate-200 my-1"></div>
              <button
                onClick={async () => {
                  setContextMenu(null);
                  await handleIdeaDelete(contextMenu.ideaId);
                }}
                className="w-full px-4 py-2 text-left text-sm text-rose-600 hover:bg-rose-50 transition-colors flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Delete
              </button>
            </div>
          );
        })()}

        {/* Link Ideas Dialog */}
        {linkDialog && linkingMode && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => {
            setLinkDialog(null);
            setLinkingMode(null);
          }}>
            <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-lg font-semibold text-slate-800 mb-4">Link Ideas</h3>
              <p className="text-sm text-slate-600 mb-4">Click on another idea bubble to link with "{ideas.find(i => i.id === linkingMode)?.label}"</p>
              <p className="text-xs text-slate-500 mb-4">Or select from list:</p>
              <div className="max-h-64 overflow-y-auto space-y-1 mb-4">
                {ideas.filter(i => i.id !== linkingMode).map(idea => (
                  <button
                    key={idea.id}
                    onClick={() => {
                      linkIdeas(linkingMode, idea.id);
                    }}
                    className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 rounded transition-colors flex items-center justify-between"
                  >
                    <span>{idea.label}</span>
                    {(idea.connections || []).includes(linkingMode) && (
                      <span className="text-xs text-blue-600">Already linked</span>
                    )}
                  </button>
                ))}
              </div>
              <button
                onClick={() => {
                  setLinkDialog(null);
                  setLinkingMode(null);
                }}
                className="w-full px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Template selector removed - now using AI suggestions instead */}

        {/* Merge Ideas Dialog */}
        {mergeDialog && mergeDialog.ideaIds.length >= 2 && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => {
            setMergeDialog(null);
            setSelectedIdeas(new Set());
          }}>
            <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-lg font-semibold text-slate-800 mb-4">Merge Ideas</h3>
              <p className="text-sm text-slate-600 mb-4">Merge {mergeDialog.ideaIds.length} ideas into one:</p>
              <ul className="list-disc list-inside text-sm text-slate-700 mb-4 space-y-1 max-h-48 overflow-y-auto">
                {mergeDialog.ideaLabels.map((label, idx) => (
                  <li key={idx}>{label}</li>
                ))}
              </ul>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    mergeIdeas(mergeDialog.ideaIds);
                    setMergeDialog(null);
                    setSelectedIdeas(new Set());
                  }}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  Merge Ideas
                </button>
                <button
                  onClick={() => {
                    setMergeDialog(null);
                    setSelectedIdeas(new Set());
                  }}
                  className="flex-1 px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Suggestion Selection Card - Small and positioned next to bubble */}
        {suggestionModal && (() => {
          // Calculate safe position avoiding chatbox and GlassPanel
          const modalWidth = 320;
          const modalHeight = 400;
          const glassPanelWidth = 380;
          const glassPanelRight = window.innerWidth;
          const glassPanelLeft = glassPanelRight - glassPanelWidth;
          const glassPanelTop = 100;
          const glassPanelBottom = 100;

          // Chatbox dimensions
          const chatboxWidth = Math.min(768, window.innerWidth * 0.8);
          const chatboxLeft = (window.innerWidth - chatboxWidth) / 2;
          const chatboxRight = chatboxLeft + chatboxWidth;
          const chatboxBottomOffset = 24; // bottom-6 = 24px
          const chatboxTopNoMessage = window.innerHeight * 0.57;
          const bottomSafeArea = 250; // Extra space above chatbox

          let left = suggestionModal.position ? suggestionModal.position.x + 80 : window.innerWidth / 2;
          let top = suggestionModal.position ? suggestionModal.position.y - 50 : window.innerHeight / 2;

          // Adjust position to avoid GlassPanel (right side)
          if (left + modalWidth > glassPanelLeft &&
            top > glassPanelTop &&
            top < window.innerHeight - glassPanelBottom) {
            // Move to the left of GlassPanel
            left = glassPanelLeft - modalWidth - 20; // 20px padding
            // If that would push it off left edge, move above/below instead
            if (left < 20) {
              left = suggestionModal.position ? suggestionModal.position.x - modalWidth - 20 : 20;
            }
          }

          // Adjust position to avoid chatbox (bottom)
          const chatboxTop = hasUserMessage
            ? window.innerHeight - bottomSafeArea
            : chatboxTopNoMessage;

          if (top + modalHeight > chatboxTop) {
            // Move above chatbox
            top = chatboxTop - modalHeight - 20; // 20px padding
            // If that would push it above viewport, try left side instead
            if (top < 100) {
              top = suggestionModal.position ? suggestionModal.position.y - modalHeight - 20 : 100;
            }
          }

          // Ensure modal stays within viewport bounds
          left = Math.max(20, Math.min(left, window.innerWidth - modalWidth - 20));
          top = Math.max(100, Math.min(top, window.innerHeight - modalHeight - 20));

          return (
            <div
              className="fixed inset-0 z-50 pointer-events-none"
              onClick={() => setSuggestionModal(null)}
            >
              <div
                className="absolute bg-white border-2 border-purple-200 rounded-xl shadow-2xl relative overflow-hidden flex flex-col transition-all duration-300 ease-out pointer-events-auto"
                style={{
                  width: `${modalWidth}px`,
                  maxHeight: `${modalHeight}px`,
                  left: `${left}px`,
                  top: `${top}px`,
                  zIndex: 1000
                }}
                onClick={(e) => e.stopPropagation()}
                onMouseLeave={() => {
                  // Close when mouse leaves the card
                  setTimeout(() => setSuggestionModal(null), 300);
                }}
              >
                {/* Compact Header */}
                <div className="p-3 border-b border-purple-100 bg-gradient-to-r from-purple-50 to-blue-50 flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-bold text-slate-800 truncate">
                      💡 Suggestions for "{suggestionModal.ideaLabel}"
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Select to add • Move away to dismiss
                    </p>
                  </div>
                  <button
                    onClick={() => setSuggestionModal(null)}
                    className="ml-2 text-slate-400 hover:text-slate-600 transition-colors p-1 rounded hover:bg-slate-100 flex-shrink-0"
                    aria-label="Close"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Compact Suggestions List */}
                <div className="flex-1 overflow-y-auto p-3 space-y-2 max-h-[300px] custom-scrollbar">
                  <SuggestionSelector
                    suggestions={suggestionModal.suggestions}
                    onSelect={addSelectedSuggestions}
                    onClose={() => setSuggestionModal(null)}
                  />
                </div>
              </div>
            </div>
          );
        })()}

        {/* Right Side: Glass Panel (ideation) or Prototyping Panel (prototyping) */}
        {/* Show GlassPanel in chat layout mode when there are messages OR when agents are working */}
        {layoutMode === 'chat' && (hasUserMessage || isGettingAgentsInvolved || messages.length > 1) && prototypingStage === 'ideation' && (
          <div className="absolute right-0 flex flex-col pr-8 z-20" style={{ top: '100px', bottom: '100px' }}>
            {/* Glass Panel */}
            <div className="flex-1 flex items-center justify-center min-h-0">
              <GlassPanel
                key={`glass-${currentConversationId || 'new'}-${topic}-${ideas.length}-${keyInsights.length}-${nextSteps.length}`}
                topic={topic}
                ideas={ideas}
                activeIdeaId={activeIdeaId}
                keyInsights={keyInsights}
                nextSteps={nextSteps}
                onIdeaClick={(ideaId) => setActiveIdeaId(ideaId === activeIdeaId ? null : ideaId)}
                useInternet={useInternet}
                onToggleInternet={onToggleInternet}
                selectedStandards={selectedStandards}
                messages={messages}
                showChatHistory={showChatHistory}
                onToggleChatHistory={() => setShowChatHistory(!showChatHistory)}
                onToggleStandard={onToggleStandard}
                readyCheck={readyCheck}
                onReadyToGo={handleManualTransition}
                isGeneratingPreview={isGeneratingPreview}
                generationProgress={generationProgress}
                isProcessing={isProcessing}
                onDeepResearch={onDeepResearch}
                onSendMessage={handleSendMessage}
                prototypingStage={prototypingStage}
                onRegeneratePrototype={handleRegeneratePrototype}
                activeView={glassPanelActiveView}
                onActiveViewChange={setGlassPanelActiveView}
                onGenerateRelatedIdeas={generateRelatedIdeas}
                onIdeaRefinement={refineIdea}
                onGapAnalysis={performGapAnalysis}
                onCrossPollination={crossPollinateIdeas}
                loadingStatusText={loadingStatusText}
                // onGetAgentsInvolved={handleGetAgentsInvolved} // Disabled - using streaming chat
                isGettingAgentsInvolved={false}
                activeAgents={activeAgents}
                onDeepenIdeas={handleDeepenIdeas}
                deepenLevel={deepenLevel}
                isDeepeningIdeas={isDeepeningIdeas}
                hasIdeas={ideas.length > 0}
                onLaunchProject={handleLaunchProject}
              />
            </div>
          </div>
        )}

        {/* Prototyping Panel - Right Side */}
        {prototypingStage === 'prototyping' && (
          <>
            {/* Back to Ideation Button - Above the expanded window */}
            <div className="absolute z-30" style={{ top: '50px', left: '520px' }}>
              <button
                onClick={handleBackToIdeation}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors flex items-center gap-2 text-sm font-medium shadow-sm"
                title="Go back to brainstorming to add more bubbles"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Back to Brainstorming
              </button>
            </div>
            <div className="absolute flex flex-col z-20 animate-in slide-in-from-right duration-700" style={{ top: '100px', bottom: '20px', left: '520px', right: '8px' }}>
              {/* Prototyping Panel - Always show the Blueprint */}
              <div className="w-full flex-1 flex items-center justify-center min-h-0 mb-3">
                <PrototypingPanel
                  projectPreview={projectPreview}
                  onClose={handleBackToIdeation}
                  onArtifactCreate={() => { }}
                  onGenerateTheme={handleGenerateTheme}
                  onLaunchProject={handleLaunchProject}
                  conversationMessages={messages}
                  ideas={ideas}
                  keyInsights={keyInsights}
                  selectedStandards={selectedStandards}
                  userSelectedFeatures={ideas.filter(i => i.id !== 'welcome-bubble')}
                  onRegeneratePrototype={handleRegeneratePrototype}
                  featureCoverage={projectPreview?.featureCoverage}
                />
              </div>

            </div>

            {/* Mission Control Overlay - Appears on top during generation */}
            {isGeneratingPreview && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-300">
                <div className="w-[90%] max-w-5xl h-[80vh] max-h-[700px] animate-in zoom-in-95 duration-300">
                  <MissionControl
                    progress={generationProgress}
                    logs={statusLogs}
                    showMetadata={false}
                  />
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* New Chat Confirmation Modal */}
      <ConfirmationModal
        isOpen={showNewChatConfirm}
        type="confirm"
        title="Start New Chat?"
        message="Your current conversation will be saved automatically before starting a new chat. Continue?"
        confirmText="Start New Chat"
        cancelText="Cancel"
        onConfirm={async () => {
          setShowNewChatConfirm(false);
          // Save conversation first
          await saveConversationImmediately();
          // Small delay to ensure save completes
          await new Promise(resolve => setTimeout(resolve, 100));
          // Then perform reset
          await performReset();
        }}
        onCancel={() => {
          setShowNewChatConfirm(false);
        }}
        onClose={() => {
          setShowNewChatConfirm(false);
        }}
      />


      {/* Feature Selection Modal - Select which features to include in prototype */}
      <FeatureSelectionModal
        isOpen={showFeatureSelection}
        onClose={() => setShowFeatureSelection(false)}
        onConfirm={handleFeatureSelectionConfirm}
        ideas={ideas}
      />

      {/* Path Choice Modal - Choose between AI Agents path or Direct Quick path */}
      <PathChoiceModal
        isOpen={showPathChoice}
        onClose={() => setShowPathChoice(false)}
        onSelectPath={handlePathSelected}
        ideaCount={ideas.filter(i => i.id !== 'welcome-bubble').length}
        maturityScore={readyCheck?.score || 0}
      />

      {/* User Login Modal */}
      {
        showUserLogin && (
          <UserLogin
            onLoginSuccess={async (userData: any) => {
              // UserLogin component already handles the login API call and stores token
              // Refresh the auth context to get updated user state
              setShowUserLogin(false);
              try {
                await refreshUser();
                if (import.meta.env.DEV) {
                  console.log('✅ [NeuralStreamChat] User logged in successfully, context refreshed');
                }
              } catch (error) {
                console.error('❌ [NeuralStreamChat] Failed to refresh user after login:', error);
              }
            }}
            onSwitchToSignup={() => {
              // Navigate to hub for signup
              setShowUserLogin(false);
              window.location.hash = '#setup';
            }}
            onClose={() => setShowUserLogin(false)}
          />
        )
      }

      {/* User Profile Modal */}
      {
        showUserProfile && user && (
          <UserProfileModal
            user={user as any}
            onClose={() => setShowUserProfile(false)}
            onUpgrade={() => {
              // Navigate to hub where user can upgrade
              setShowUserProfile(false);
              window.location.hash = '#setup';
            }}
            onLogout={() => {
              setShowUserProfile(false);
              logout();
              // Optionally navigate to landing page
              window.location.hash = '#';
            }}
          />
        )
      }

      {/* Project Folder Manager Modal */}
      <ProjectFolderManager
        isOpen={showFolderManager}
        onClose={() => {
          setShowFolderManager(false);
          setEditingFolder(null);
        }}
        mode={folderManagerMode}
        existingFolder={editingFolder ? {
          id: editingFolder.id,
          userId: user?.id || '',
          name: editingFolder.name,
          description: editingFolder.description,
          platforms: editingFolder.platforms || ['other'],
          conversationIds: [],
          createdAt: 0,
          updatedAt: 0
        } : null}
        onFolderCreated={async (folder) => {
          setProjectFolders(prev => [...prev, {
            id: folder.id,
            userId: folder.userId || user?.id || '',
            name: folder.name,
            description: folder.description,
            platforms: folder.platforms || ['other'],
            conversationIds: folder.conversationIds || [],
            createdAt: folder.createdAt ? new Date(folder.createdAt).getTime() : Date.now(),
            updatedAt: folder.updatedAt ? new Date(folder.updatedAt).getTime() : Date.now()
          }]);
          setShowFolderManager(false);
        }}
        onFolderUpdated={async (folder) => {
          setProjectFolders(prev => prev.map(f =>
            f.id === folder.id ? {
              id: folder.id,
              userId: folder.userId || f.userId,
              name: folder.name,
              description: folder.description,
              platforms: folder.platforms || ['other'],
              conversationIds: folder.conversationIds || [],
              createdAt: folder.createdAt ? new Date(folder.createdAt).getTime() : f.createdAt,
              updatedAt: folder.updatedAt ? new Date(folder.updatedAt).getTime() : Date.now()
            } : f
          ));
          setShowFolderManager(false);
          setEditingFolder(null);
        }}
        onFolderDeleted={async (folderId) => {
          setProjectFolders(prev => prev.filter(f => f.id !== folderId));
          // Reload conversations to update folder assignments
          const conversations = await chatApi.getConversations({ type: 'neural-chat' });
          const transformed = conversations.map((conv: ChatConversation) => ({
            id: conv._id || conv.id || '',
            title: (conv.metadata?.topic ||
              conv.messages.find((m: ChatMessage) => m.sender === 'user')?.text.substring(0, 50) ||
              'New Conversation') as string,
            preview: (conv.messages
              .filter((m: ChatMessage) => m.sender === 'user')
              .slice(-3)
              .map((m: ChatMessage) => m.text)
              .join(' ')
              .substring(0, 100) || 'No messages yet') as string,
            timestamp: conv.createdAt ? new Date(conv.createdAt).getTime() : Date.now(),
            messages: conv.messages || [],
            topic: conv.metadata?.topic || conv.topic || '',
            ideas: (conv.metadata?.ideas || conv.ideas || []).map((idea: any): Idea => ({
              id: idea.id || `idea-${Date.now()}-${Math.random()}`,
              label: idea.label || '',
              description: idea.description || '',
              parentId: idea.parentId || null,
              priority: idea.priority,
              category: idea.category,
              notes: idea.notes,
              connections: idea.connections || [],
              state: idea.state || 'new',
              tags: idea.tags || [],
              createdAt: idea.createdAt || Date.now(),
              updatedAt: idea.updatedAt || Date.now()
            })),
            keyInsights: conv.metadata?.keyInsights || conv.keyInsights || [],
            nextSteps: conv.metadata?.nextSteps || conv.nextSteps || [],
            prototypingStage: conv.metadata?.prototypingStage || conv.prototypingStage || 'ideation',
            projectPreview: conv.metadata?.projectPreview || conv.projectPreview || null,
            activeIdeaId: conv.metadata?.activeIdeaId ?? conv.activeIdeaId ?? null,
            glassPanelActiveView: conv.metadata?.glassPanelActiveView || conv.glassPanelActiveView || 'context',
            folderId: (conv as any).folderId || conv.folderId || null
          }));
          setSavedConversations(transformed);
        }}
      />

      {/* Move Conversation Dialog */}
      {
        showMoveConversationDialog && conversationToMove && (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={() => {
              setShowMoveConversationDialog(false);
              setConversationToMove(null);
            }}
          >
            <div
              className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-300"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="bg-gradient-to-r from-primary to-indigo-600 p-4 text-white">
                <h3 className="text-lg font-bold">Move Conversation</h3>
                <p className="text-white/80 text-sm">Select a folder to move this conversation to</p>
              </div>
              <div className="p-4 max-h-96 overflow-y-auto">
                <div className="space-y-2">
                  <button
                    onClick={async () => {
                      try {
                        await projectFolderApi.moveConversation(conversationToMove, null);
                        showAlert('Conversation moved to Unorganized', 'success');

                        // Update the conversation's folderId in local state immediately
                        setSavedConversations(prev => prev.map(conv =>
                          conv.id === conversationToMove
                            ? { ...conv, folderId: undefined }
                            : conv
                        ));

                        // Reload conversations from server to ensure consistency
                        const conversations = await chatApi.getConversations({ type: 'neural-chat' });
                        const transformed = conversations.map((conv: ChatConversation) => ({
                          id: conv._id || conv.id || '',
                          title: (conv.metadata?.topic ||
                            conv.messages.find((m: ChatMessage) => m.sender === 'user')?.text.substring(0, 50) ||
                            'New Conversation') as string,
                          preview: (conv.messages
                            .filter((m: ChatMessage) => m.sender === 'user')
                            .slice(-3)
                            .map((m: ChatMessage) => m.text)
                            .join(' ')
                            .substring(0, 100) || 'No messages yet') as string,
                          timestamp: conv.createdAt ? new Date(conv.createdAt).getTime() : Date.now(),
                          messages: conv.messages || [],
                          topic: conv.metadata?.topic || conv.topic || '',
                          ideas: (conv.metadata?.ideas || conv.ideas || []).map((idea: any): Idea => ({
                            id: idea.id || `idea-${Date.now()}-${Math.random()}`,
                            label: idea.label || '',
                            description: idea.description || '',
                            parentId: idea.parentId || null,
                            priority: idea.priority,
                            category: idea.category,
                            notes: idea.notes,
                            connections: idea.connections || [],
                            state: idea.state || 'new',
                            tags: idea.tags || [],
                            createdAt: idea.createdAt || Date.now(),
                            updatedAt: idea.updatedAt || Date.now()
                          })),
                          keyInsights: conv.metadata?.keyInsights || conv.keyInsights || [],
                          nextSteps: conv.metadata?.nextSteps || conv.nextSteps || [],
                          prototypingStage: conv.metadata?.prototypingStage || conv.prototypingStage || 'ideation',
                          projectPreview: conv.metadata?.projectPreview || conv.projectPreview || null,
                          activeIdeaId: conv.metadata?.activeIdeaId ?? conv.activeIdeaId ?? null,
                          glassPanelActiveView: conv.metadata?.glassPanelActiveView || conv.glassPanelActiveView || 'context',
                          folderId: (conv as any).folderId || conv.folderId || null
                        }));
                        setSavedConversations(transformed);
                        setShowMoveConversationDialog(false);
                        setConversationToMove(null);
                      } catch (error: any) {
                        showAlert(error.message || 'Failed to move conversation', 'error');
                      }
                    }}
                    className="w-full p-3 text-left bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <Folder size={16} className="text-slate-400" />
                      <span className="text-sm font-medium text-slate-700">Unorganized</span>
                    </div>
                  </button>
                  {projectFolders
                    .filter(f => f.name !== 'Unorganized')
                    .map((folder) => {
                      const PlatformIcon = getPlatformIcon(folder.platforms || ['other']);
                      return (
                        <button
                          key={folder.id}
                          onClick={async () => {
                            try {
                              await projectFolderApi.moveConversation(conversationToMove, folder.id);
                              showAlert(`Conversation moved to "${folder.name}"`, 'success');
                              // Reload conversations
                              const conversations = await chatApi.getConversations({ type: 'neural-chat' });
                              const transformed = conversations.map((conv: ChatConversation) => ({
                                id: conv._id || conv.id || '',
                                title: (conv.metadata?.topic ||
                                  conv.messages.find((m: ChatMessage) => m.sender === 'user')?.text.substring(0, 50) ||
                                  'New Conversation') as string,
                                preview: (conv.messages
                                  .filter((m: ChatMessage) => m.sender === 'user')
                                  .slice(-3)
                                  .map((m: ChatMessage) => m.text)
                                  .join(' ')
                                  .substring(0, 100) || 'No messages yet') as string,
                                timestamp: conv.createdAt ? new Date(conv.createdAt).getTime() : Date.now(),
                                messages: conv.messages || [],
                                topic: conv.metadata?.topic || conv.topic || '',
                                ideas: (conv.metadata?.ideas || conv.ideas || []).map((idea: any): Idea => ({
                                  id: idea.id || `idea-${Date.now()}-${Math.random()}`,
                                  label: idea.label || '',
                                  description: idea.description || '',
                                  parentId: idea.parentId || null,
                                  priority: idea.priority,
                                  category: idea.category,
                                  notes: idea.notes,
                                  connections: idea.connections || [],
                                  state: idea.state || 'new',
                                  tags: idea.tags || [],
                                  createdAt: idea.createdAt || Date.now(),
                                  updatedAt: idea.updatedAt || Date.now()
                                })),
                                keyInsights: conv.metadata?.keyInsights || conv.keyInsights || [],
                                nextSteps: conv.metadata?.nextSteps || conv.nextSteps || [],
                                prototypingStage: conv.metadata?.prototypingStage || conv.prototypingStage || 'ideation',
                                projectPreview: conv.metadata?.projectPreview || conv.projectPreview || null,
                                activeIdeaId: conv.metadata?.activeIdeaId ?? conv.activeIdeaId ?? null,
                                glassPanelActiveView: conv.metadata?.glassPanelActiveView || conv.glassPanelActiveView || 'context',
                                folderId: (conv as any).folderId || conv.folderId || null
                              }));
                              setSavedConversations(transformed);
                              setShowMoveConversationDialog(false);
                              setConversationToMove(null);
                            } catch (error: any) {
                              showAlert(error.message || 'Failed to move conversation', 'error');
                            }
                          }}
                          className="w-full p-3 text-left bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <PlatformIcon size={16} className="text-primary" />
                            <span className="text-sm font-medium text-slate-700">{folder.name}</span>
                          </div>
                        </button>
                      );
                    })}
                </div>
              </div>
              <div className="p-4 border-t border-slate-200 flex justify-end">
                <button
                  onClick={() => {
                    setShowMoveConversationDialog(false);
                    setConversationToMove(null);
                  }}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )
      }

      <ConfirmationModal
        isOpen={!!folderToDelete}
        type="error"
        title="Delete Workspace"
        message={`Are you sure you want to delete the workspace "${folderToDelete?.name}"?\n\nThis will permanently delete the workspace and ALL ${folderToDelete?.count || 0} conversations inside it.\n\nThis action cannot be undone.`}
        confirmText="Delete Forever"
        onConfirm={async () => {
          if (!folderToDelete) return;
          try {
            await projectFolderApi.deleteFolder(folderToDelete.id, true);

            // Update state
            setProjectFolders(prev => prev.filter(f => f.id !== folderToDelete.id));
            setSavedConversations(prev => prev.filter(c => c.folderId !== folderToDelete.id));
            if (expandedFolders.has(folderToDelete.id)) {
              setExpandedFolders(prev => {
                const next = new Set(prev);
                next.delete(folderToDelete.id);
                return next;
              });
            }

            // If current conversation was in this folder, reset?
            const currentConv = savedConversations.find(c => c.id === currentConversationId);
            if (currentConv && currentConv.folderId === folderToDelete.id) {
              performReset();
            }

            toast.success(`Workspace "${folderToDelete.name}" deleted`);
            setFolderToDelete(null); // Close modal
          } catch (error: any) {
            console.error('Failed to delete workspace:', error);
            toast.error(error.message || 'Failed to delete workspace');
          }
        }}
        onCancel={() => setFolderToDelete(null)}
        onClose={() => setFolderToDelete(null)}
      />

    </div >
  );
};

// Memoize NeuralStreamChat to prevent unnecessary re-renders
export default React.memo(NeuralStreamChat, (prevProps, nextProps) => {
  // Only re-render if key props actually changed
  return (
    prevProps.messages.length === nextProps.messages.length &&
    prevProps.input === nextProps.input &&
    prevProps.isProcessing === nextProps.isProcessing &&
    prevProps.processingLabel === nextProps.processingLabel &&
    prevProps.useInternet === nextProps.useInternet &&
    prevProps.selectedStandards.length === nextProps.selectedStandards.length &&
    prevProps.projectName === nextProps.projectName &&
    prevProps.onSendMessage === nextProps.onSendMessage &&
    prevProps.onToggleInternet === nextProps.onToggleInternet &&
    prevProps.onToggleStandard === nextProps.onToggleStandard &&
    prevProps.onDeepResearch === nextProps.onDeepResearch
  );
});

