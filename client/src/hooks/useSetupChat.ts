import React, { useCallback, useRef } from 'react';
import { ChatMessage, Phase, AgentRole, TaskStatus, Methodology, ProjectState, Agent } from '@orbitai/shared';
import { AGENTS, QUALITY_STANDARDS, PROJECT_THEMES } from '@orbitai/shared';
import { generateProjectPreview, orchestrateNextSteps, generateAgentProfile } from '../services/geminiService';
import { agentAssignmentService } from '../services/agentAssignment.service';
import { cleanMermaidCode } from '../utils/mermaidUtils';
import { ProjectPreview } from '../services/geminiService';
import { v4 as uuidv4 } from 'uuid';
import { toastService } from '../services/toastService';
import { projectStorage } from '../services/projectStorage';

const generateMessageId = () => uuidv4();
const toast = toastService; // alias used in orchestratePhase

export interface SetupChatDeps {
  // State
  setupInput: string;
  setupFiles: File[];
  state: any;
  stateRef: React.MutableRefObject<any>;
  setupMessages: ChatMessage[];
  projectPreview: ProjectPreview | null;
  setupStage: string;
  setupProjectName: string;
  hasManuallyEditedProjectName: boolean;
  tempSelectedStandards: string[];
  selectedTheme: string;
  availableThemes: any[];
  selectedTemplateId: string | null;
  selectedTemplateName: string | null;
  user: any;

  // Setters
  setSetupInput: (v: string) => void;
  setSetupMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  setProjectPreview: (p: ProjectPreview | null) => void;
  setSetupStage: (s: string) => void;
  setSetupProjectName: (n: string) => void;
  setTempSelectedStandards: React.Dispatch<React.SetStateAction<string[]>>;
  setProcessingLabel: (l: string | null) => void;
  setProcessingProgress: (p: number) => void;
  setProcessingStatusText: (t: string | undefined) => void;
  setProcessingEstimatedTime: (t: number | undefined) => void;
  setProcessingTaskCount: (c: number | undefined) => void;
  processingStartTimeRef: React.MutableRefObject<number | null>;
  setIsResearching: (v: boolean) => void;
  setDynamicSuggestions: React.Dispatch<React.SetStateAction<any[]>>;
  setViewMode: (m: any) => void;
  setGlobalMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  setSetupFiles: React.Dispatch<React.SetStateAction<File[]>>;

  // Functions
  dispatch: React.Dispatch<any>;
  saveProject: () => Promise<void>;
  addLog: (msg: string, agent: any, type?: any, taskId?: string) => void;
  setupInputRef: React.RefObject<HTMLTextAreaElement>;

  // Refs
  settingsRef: React.MutableRefObject<any>;
  isStoppingRef: React.MutableRefObject<boolean>;
  isBatchingRef: React.MutableRefObject<boolean>;
  batchIntervalRef: React.MutableRefObject<NodeJS.Timeout | null>;
  activeTaskControllersRef: React.MutableRefObject<Map<string, AbortController>>;
  autoPilotStatusRef: React.MutableRefObject<string>;

  // Setters from autoPilot
  setAutoPilotStatus: (s: any) => void;
}

export function useSetupChat(deps: SetupChatDeps) {
  const isProcessingMessageRef = useRef(false);
  const processedMessageIdsRef = useRef<Set<string>>(new Set());

  // orchestratePhase - exact body from App.tsx lines 4038-4281
  // with all direct variable references replaced with deps.xxx
  const orchestratePhase = async (phase: Phase, description: string) => {
    // Track start time for accurate time estimation
    const startTime = Date.now();
    deps.processingStartTimeRef.current = startTime;

    // Helper function to calculate and update estimated time based on actual elapsed time
    const updateEstimatedTime = (currentProgress: number) => {
      if (!deps.processingStartTimeRef.current) return;
      const elapsedMs = Date.now() - deps.processingStartTimeRef.current;
      const elapsedSeconds = elapsedMs / 1000;

      // Calculate estimated remaining time based on progress and elapsed time
      // Progress is not linear - most time is spent on LLM call (typically 2-8 seconds)
      if (currentProgress < 50) {
        // Before LLM call completes: estimate conservatively
        // Most orchestration time (70-80%) is spent waiting for LLM response
        // Typical LLM call: 3-6 seconds, but can be up to 8-10 seconds
        const typicalLLMDuration = 6; // Conservative estimate: 6 seconds for LLM
        const remainingForLLM = Math.max(3, typicalLLMDuration - elapsedSeconds);
        const remainingForProcessing = 3; // Task processing after LLM (conservative)
        const estimatedRemaining = remainingForLLM + remainingForProcessing;
        // Always show at least 5 seconds if early in process
        deps.setProcessingEstimatedTime(Math.ceil(Math.max(5, estimatedRemaining)));
      } else if (currentProgress >= 50 && currentProgress < 90) {
        // After LLM call: estimate based on remaining task processing
        // Use actual elapsed time to predict remaining, but be conservative
        const progressRatio = Math.max(0.1, currentProgress / 100);
        const estimatedTotalSeconds = elapsedSeconds / progressRatio;
        const estimatedRemaining = estimatedTotalSeconds - elapsedSeconds;
        // Add 50% buffer for safety (was 20%, now more conservative)
        const bufferedRemaining = estimatedRemaining * 1.5;
        deps.setProcessingEstimatedTime(Math.ceil(Math.max(2, bufferedRemaining)));
      } else {
        // Almost done (90%+)
        deps.setProcessingEstimatedTime(1);
      }
    };

    // Initialize processing state
    deps.setProcessingLabel(`Orchestrating Strategy for ${phase}...`);
    deps.setProcessingProgress(10);
    deps.setProcessingStatusText('Analyzing project requirements...');
    updateEstimatedTime(10);
    deps.setProcessingTaskCount(0);
    deps.dispatch({ type: 'SET_PROCESSING', payload: true });
    deps.addLog(`Orchestrating tasks for ${phase} (Sprint ${deps.stateRef.current.currentSprint})...`, AgentRole.ORCHESTRATOR, 'action');

    const currentState = deps.stateRef.current;
    const allCompleted = currentState.tasks.filter((t: any) => t.status === TaskStatus.COMPLETED);
    const localAgents = [...currentState.agents];

    // Stage 1: Connect to AI orchestrator
    deps.setProcessingLabel(`Orchestrating Strategy for ${phase}...`);
    deps.setProcessingStatusText('Connecting to AI orchestrator...');
    deps.setProcessingProgress(20);
    updateEstimatedTime(20);

    // Stage 2: Generate task breakdown
    deps.setProcessingStatusText('Generating task breakdown...');
    deps.setProcessingProgress(30);
    updateEstimatedTime(30);

    let result;
    try {
      result = await orchestrateNextSteps(phase, description, allCompleted, currentState.useInternet, currentState.mcpServers, deps.settingsRef.current.maxTasksPerPhase, localAgents);
    } catch (error: any) {
      // Check if it's a connection error (backend not running)
      if (error?.isConnectionError || error?.message?.includes('Backend server is not running') || error?.message?.includes('Failed to fetch')) {
        deps.dispatch({ type: 'SET_PROCESSING', payload: false });
        deps.setProcessingLabel(null);
        deps.setProcessingProgress(0);
        deps.setProcessingStatusText(undefined);
        toast.error(
          `Backend server is not running. Please start it:\n\n1. Open a terminal\n2. cd server\n3. npm run dev\n\nThe server should run on http://localhost:3002`,
          10000
        );
        deps.addLog(
          `❌ Backend server is not running. Please start it:\n\n` +
          `1. Open a terminal\n` +
          `2. cd server\n` +
          `3. npm run dev\n\n` +
          `The server should run on http://localhost:3002`,
          AgentRole.ORCHESTRATOR,
          'error'
        );
        alert(
          'Backend Server Not Running\n\n' +
          'Please start the backend server:\n\n' +
          '1. Open a terminal\n' +
          '2. cd server\n' +
          '3. npm run dev\n\n' +
          'The server should run on http://localhost:3002\n\n' +
          'Check the console for more details.'
        );
        return;
      }
      // Re-throw other errors
      throw error;
    }

    // Stage 3: Assign agents to tasks
    deps.setProcessingProgress(50);
    deps.setProcessingStatusText('Assigning agents to tasks...');
    updateEstimatedTime(50);

    if (result && result.tasks && result.tasks.length > 0) {
      deps.setProcessingLabel("Provisioning Agents & Generating Tasks...");
      deps.setProcessingTaskCount(result.tasks.length);

      const titleToIdMap = new Map<string, string>();
      currentState.tasks.forEach((t: any) => titleToIdMap.set(t.title, t.id));

      const tasksWithIds = result.tasks.map((t: any) => {
        const newId = Math.random().toString(36).substring(7);
        if (t.title) titleToIdMap.set(t.title, newId);
        return { ...t, id: newId };
      });

      // OPTIMIZATION: Process tasks in batches with async breaks to keep UI responsive
      const processTask = async (t: any, index: number) => {
        if (!t.title) return;

        let safeAssignedTo = String(t.assignedTo || AgentRole.ORCHESTRATOR).trim();
        const targetRoleLower = safeAssignedTo.toLowerCase();

        // OPTIMIZATION: Faster agent lookup - simplified matching
        let existingAgent = localAgents.find((a: any) => {
          const roleLower = a.role.toLowerCase();
          const nameLower = a.name.toLowerCase();
          return roleLower === targetRoleLower ||
            nameLower === targetRoleLower ||
            (roleLower.includes(targetRoleLower) && targetRoleLower.length > 3) ||
            (targetRoleLower.includes(roleLower) && roleLower.length > 3);
        });

        // OPTIMIZATION: Skip agent creation if not found - assign to Orchestrator immediately
        // Agent creation can be done later if needed, don't block task generation
        if (!existingAgent) {
          const isGeneric = ['undefined', 'unknown', 'unassigned', 'orchestrator'].includes(targetRoleLower);
          if (!isGeneric && targetRoleLower.length > 3) {
            // Try to create agent but with timeout to avoid blocking
            try {
              deps.setProcessingStatusText(`Assigning agent for task ${index + 1}...`);
              const agentPromise = generateAgentProfile(safeAssignedTo, currentState.description);
              const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Agent creation timeout')), 20000) // Increased to 20s to allow LLM API calls to complete
              );

              const newAgent = await Promise.race([agentPromise, timeoutPromise]) as Agent;
              const duplicate = localAgents.find((a: any) =>
                a.role.toLowerCase() === newAgent.role.toLowerCase() ||
                a.name.toLowerCase() === newAgent.name.toLowerCase()
              );
              if (!duplicate) {
                deps.dispatch({ type: 'ADD_AGENT', payload: newAgent });
                localAgents.push(newAgent);
                safeAssignedTo = newAgent.role;
              } else {
                safeAssignedTo = duplicate.role;
              }
            } catch (e) {
              // Timeout or error - just use Orchestrator, don't block
              console.warn("Agent creation skipped, using Orchestrator", e);
              safeAssignedTo = AgentRole.ORCHESTRATOR;
            }
          } else {
            safeAssignedTo = AgentRole.ORCHESTRATOR;
          }
        } else {
          safeAssignedTo = existingAgent.role;
        }

        // Resolve dependencies quickly
        const resolvedDeps: string[] = [];
        if (t.dependencies && Array.isArray(t.dependencies)) {
          t.dependencies.forEach((depTitle: string) => {
            const depId = titleToIdMap.get(depTitle);
            if (depId) {
              resolvedDeps.push(depId);
            } else {
              const match = Array.from(titleToIdMap.keys()).find(k => k.toLowerCase() === depTitle.toLowerCase());
              if (match) {
                resolvedDeps.push(titleToIdMap.get(match)!);
              }
            }
          });
        }

        // OPTIMIZATION: Add task immediately (optimistic UI update)
        deps.dispatch({
          type: 'ADD_TASK',
          payload: {
            id: t.id,
            title: t.title,
            description: t.description || "Task generated by Orchestrator",
            assignedTo: safeAssignedTo,
            phase: phase,
            status: TaskStatus.PENDING,
            dependencies: resolvedDeps,
            logs: [],
            progress: 0,
            traceRefs: t.traceRefs || [],
            sprint: currentState.currentSprint,
            // Initialize evaluation with pending status (will be calculated when task is executed)
            evaluation: {
              score: 0,
              reasoning: 'Quality score will be calculated when task is executed.',
              criteria: [],
              timestamp: Date.now()
            }
          }
        });
        deps.addLog(`Created task: ${t.title} -> ${safeAssignedTo}`, AgentRole.ORCHESTRATOR);

        // Update progress
        const p = 50 + Math.round(((index + 1) / tasksWithIds.length) * 50);
        deps.setProcessingProgress(Math.min(99, p));
      };
      // Process tasks with async breaks to keep UI responsive
      for (let i = 0; i < tasksWithIds.length; i++) {
        await processTask(tasksWithIds[i], i);
        // Yield to browser every 2 tasks to keep UI responsive
        if ((i + 1) % 2 === 0) {
          await new Promise(resolve => setTimeout(resolve, 0));
        }
      }
    } else {
      deps.addLog(`No new tasks generated. Phase might be complete.`, AgentRole.ORCHESTRATOR, 'info');
    }

    // Complete
    deps.setProcessingProgress(100);
    deps.setProcessingStatusText('Complete!');
    deps.setProcessingEstimatedTime(0);

    setTimeout(() => {
      deps.dispatch({ type: 'SET_PROCESSING', payload: false });
      deps.setProcessingLabel(null);
      deps.setProcessingProgress(0);
      deps.setProcessingStatusText(undefined);
      deps.setProcessingEstimatedTime(undefined);
      deps.setProcessingTaskCount(undefined);
      deps.processingStartTimeRef.current = null;
    }, 500);
  };

  // canProceedToPreview - exact body from App.tsx lines 2113-2161
  const canProceedToPreview = useCallback((messages: ChatMessage[]): { canProceed: boolean; reason?: string } => {
    // Filter out system welcome messages and status messages
    const meaningfulMessages = messages.filter(m => {
      const text = m.text.toLowerCase();
      // Exclude welcome messages and status messages
      return !text.includes('welcome to orbitai') &&
        !text.includes('hello, i am') &&
        !text.includes('transcribing') &&
        !text.includes('ai is thinking') &&
        !text.includes('ai is speaking') &&
        !text.includes('listening');
    });

    const userMessages = meaningfulMessages.filter(m => m.sender === 'user');
    const systemMessages = meaningfulMessages.filter(m => m.sender === 'system' || m.sender === 'agent');

    // Check for research findings
    const hasResearch = systemMessages.some(m =>
      m.text.includes('Research Findings') ||
      m.text.includes('technical specification') ||
      (m.text.includes('initialize the project') && m.text.length > 500)
    );

    // Count meaningful exchanges (user message + AI response pairs)
    const exchangeCount = Math.min(userMessages.length, systemMessages.length);

    // Check if user has provided project description
    const userTexts = userMessages.map(m => m.text).join(' ').toLowerCase();
    const hasProjectIdea = userTexts.length > 20 && (
      userTexts.includes('build') ||
      userTexts.includes('create') ||
      userTexts.includes('develop') ||
      userTexts.includes('make') ||
      userTexts.includes('app') ||
      userTexts.includes('website') ||
      userTexts.includes('game') ||
      userTexts.includes('platform') ||
      userTexts.includes('system') ||
      userTexts.includes('project')
    );

    // Criteria for proceeding:
    // 1. Has research findings (automatic proceed), OR
    // 2. At least 2 meaningful exchanges AND has project idea, OR
    // 3. At least 3 user messages with substantial content

    if (hasResearch) {
      return { canProceed: true, reason: 'Research findings available' };
    }

    if (exchangeCount >= 2 && hasProjectIdea) {
      return { canProceed: true, reason: 'Enough exchanges with project idea' };
    }

    if (userMessages.length >= 3) {
      const totalUserContent = userMessages.reduce((sum, m) => sum + m.text.length, 0);
      if (totalUserContent > 50) {
        return { canProceed: true, reason: 'Multiple user messages with content' };
      }
    }

    // Not enough information
    const missingRequirements: string[] = [];
    if (userMessages.length < 2) {
      missingRequirements.push('more user input');
    }
    if (!hasProjectIdea && userMessages.length > 0) {
      missingRequirements.push('project description');
    }
    if (exchangeCount < 2) {
      missingRequirements.push('more conversation exchanges');
    }

    return {
      canProceed: false,
      reason: missingRequirements.length > 0
        ? `Need ${missingRequirements.join(', ')}`
        : 'Need more information about your project'
    };
  }, []);

  // inferStandardsFromDescription - exact body from App.tsx
  const inferStandardsFromDescription = useCallback((description: string, messages: ChatMessage[]): string[] => {
    const text = `${description} ${messages.map(m => m.text).join(' ')}`.toLowerCase();
    const standards: string[] = [];

    // Game projects - typically need web/app security and accessibility
    if (text.includes('game') || text.includes('gaming') || text.includes('mario') || text.includes('player')) {
      if (text.includes('web') || text.includes('browser') || text.includes('html5')) {
        standards.push('owasp', 'wcag');
      } else {
        standards.push('owasp');
      }
    }

    // Web projects - security and accessibility
    if (text.includes('website') || text.includes('web app') || text.includes('web application') ||
      text.includes('react') || text.includes('vue') || text.includes('angular') || text.includes('html')) {
      standards.push('owasp', 'wcag');
      if (text.includes('e-commerce') || text.includes('ecommerce') || text.includes('payment') || text.includes('shop') || text.includes('store')) {
        standards.push('pci-dss');
      }
      if (text.includes('eu') || text.includes('europe') || text.includes('gdpr')) {
        standards.push('gdpr');
      }
    }

    // Mobile apps
    if (text.includes('mobile') || text.includes('ios') || text.includes('android') ||
      text.includes('react native') || text.includes('flutter') || text.includes('swift') || text.includes('kotlin')) {
      standards.push('owasp');
      if (text.includes('health') || text.includes('medical') || text.includes('patient')) {
        standards.push('hipaa', 'iec62304');
      }
    }

    // Healthcare/Medical
    if (text.includes('health') || text.includes('medical') || text.includes('patient') || text.includes('hospital') || text.includes('clinic')) {
      standards.push('hipaa', 'iec62304');
      if (text.includes('device') || text.includes('medical device')) {
        standards.push('fda21cfr', 'iso13485');
      }
    }

    // Financial
    if (text.includes('finance') || text.includes('banking') || text.includes('payment') ||
      text.includes('transaction') || text.includes('money') || text.includes('bank')) {
      standards.push('pci-dss', 'sox');
    }

    // Automotive
    if (text.includes('automotive') || text.includes('vehicle') || text.includes('car') || text.includes('auto')) {
      standards.push('aspice', 'iso26262');
    }

    // Data/Privacy
    if (text.includes('data') || text.includes('privacy') || text.includes('personal information') || text.includes('user data')) {
      if (text.includes('eu') || text.includes('europe')) {
        standards.push('gdpr');
      }
      if (text.includes('california') || text.includes('ca')) {
        standards.push('ccpa');
      }
      standards.push('gdpr'); // Default to GDPR for data projects
    }

    // Security-focused projects
    if (text.includes('security') || text.includes('secure') || text.includes('encryption') ||
      text.includes('authentication') || text.includes('cyber') || text.includes('hack')) {
      standards.push('owasp', 'iso27001');
    }

    // Cloud/SaaS
    if (text.includes('cloud') || text.includes('saas') || text.includes('aws') || text.includes('azure')) {
      standards.push('soc2', 'iso27001');
    }

    // Remove duplicates and limit to 5, ensure all IDs exist in QUALITY_STANDARDS
    const validStandards = Array.from(new Set(standards))
      .filter(id => QUALITY_STANDARDS.some(s => s.id === id))
      .slice(0, 5);

    return validStandards;
  }, []);

  // handleJumpToPreview - exact body from App.tsx
  const handleJumpToPreview = useCallback(async () => {
    if (deps.setupStage === 'preview') {
      console.warn('[Jump to Preview] Already in preview stage');
      return;
    }

    // Check if we have enough information
    const checkResult = canProceedToPreview(deps.setupMessages);
    if (!checkResult.canProceed) {
      console.warn('[Jump to Preview] Not enough information:', checkResult.reason);
      return;
    }

    console.log('[Jump to Preview] Generating preview with current conversation...');

    // Extract user input from messages for preview generation
    const userMessages = deps.setupMessages.filter(m => m.sender === 'user');
    const userText = userMessages
      .map(m => m.text)
      .join('\n')
      .substring(0, 500); // Limit length

    // Use first user message or combined text as project goal
    const projectGoal = userMessages[0]?.text || userText || 'Project based on conversation';

    try {
      deps.dispatch({ type: 'SET_PROCESSING', payload: true });
      deps.setProcessingLabel("Generating Project Preview...");
      deps.setProcessingProgress(10);

      deps.setProcessingProgress(40);
      const preview = await generateProjectPreview(projectGoal, deps.setupMessages, deps.state.useInternet);

      // Check if this is a game project and generate mechanics
      const isGameProject = deps.state.description?.toLowerCase().includes('game') ||
        deps.state.techStack?.some((tech: string) => ['unity', 'unreal', 'phaser', 'godot'].includes(tech.toLowerCase())) ||
        preview.techStack?.some((tech: string) => ['unity', 'unreal', 'phaser', 'godot'].includes(tech.toLowerCase()));

      if (isGameProject) {
        deps.setProcessingStatusText('Generating game mechanics code...');
        deps.setProcessingProgress(50);

        try {
          // Auto-detect game engine from tech stack
          let gameEngine: 'unity' | 'godot' | 'phaser' | null = null;
          const allTech = [...(deps.state.techStack || []), ...(preview.techStack || [])];

          if (allTech.some((t: string) => t.toLowerCase().includes('unity'))) {
            gameEngine = 'unity';
          } else if (allTech.some((t: string) => t.toLowerCase().includes('godot'))) {
            gameEngine = 'godot';
          } else if (allTech.some((t: string) => t.toLowerCase().includes('phaser'))) {
            gameEngine = 'phaser';
          } else {
            // Default to Unity for any game without specified engine
            gameEngine = 'unity';
          }

          if (gameEngine) {
            // Import game mechanics service
            const { gameMechanicsClientService } = await import('../services/gameMechanicsService');

            // Generate mechanics
            const mechanicsResult = await gameMechanicsClientService.generateMechanics({
              gameDescription: deps.state.description || projectGoal,
              targetEngine: gameEngine
            });

            // Add to preview
            preview.gameMechanics = mechanicsResult;

            if ((import.meta as any).env?.DEV) {
              console.log('[Game Mechanics Generated]:', {
                engine: gameEngine,
                filesCount: mechanicsResult.files.length
              });
            }
          }
        } catch (mechanicsError) {
          // Non-blocking: Log error but continue with preview
          console.error('[Game Mechanics] Generation failed (non-blocking):', mechanicsError);
        }
      }

      deps.setProcessingProgress(90);

      if ((import.meta as any).env?.DEV) {
        console.log('[Jump to Preview] Preview generated:', {
          hasPreview: !!preview,
          projectName: preview?.projectName
        });
      }

      deps.setProjectPreview(preview);
      deps.setSetupStage('preview');

      // Auto-populate project name
      if (!deps.hasManuallyEditedProjectName && preview.projectName && preview.projectName.trim()) {
        if (!deps.setupProjectName.trim() || deps.setupProjectName.trim() === '') {
          deps.setSetupProjectName(preview.projectName.trim());
        }
      }

      // Auto-populate standards
      if (preview.recommendedStandards && preview.recommendedStandards.length > 0) {
        const validStandards = Array.isArray(preview.recommendedStandards)
          ? preview.recommendedStandards.filter((id: string) => QUALITY_STANDARDS.some(s => s.id === id))
          : [];
        if (validStandards.length > 0) {
          deps.setTempSelectedStandards(validStandards);
        }
      } else {
        // Try to infer standards from conversation
        if (deps.tempSelectedStandards.length === 0 && userText) {
          const inferredStandards = inferStandardsFromDescription(userText, deps.setupMessages);
          if (inferredStandards.length > 0) {
            deps.setTempSelectedStandards(inferredStandards);
          }
        }
      }

      // Add success message
      const standardsText = preview.recommendedStandards && preview.recommendedStandards.length > 0
        ? `\n\n**Recommended Quality Standards: ${preview.recommendedStandards.length}**\n*Automatically selected based on project characteristics.*`
        : '';

      const sprintsText = preview.estimatedSprints
        ? `\n\n**Estimated Sprints: ${preview.estimatedSprints}**\n*Based on project complexity analysis.*`
        : '';

      const successMessage: ChatMessage = {
        id: generateMessageId(),
        sender: 'system',
        text: `✅ **Preview Generated!**\n\nI've created your project blueprint based on our conversation.\n\n**Recommended Methodology: ${preview.recommendedMethodology}**\n*Optimized for your project type.*${standardsText}${sprintsText}\n\n**Review the Executive Brief and Prototype on the right.**\n\nIf you're happy, type **"Start Project"**. Otherwise, tell me what to change.`,
        timestamp: Date.now()
      };

      deps.setSetupMessages(prev => {
        const existingIds = new Set(prev.map(m => m.id));
        if (existingIds.has(successMessage.id)) {
          return prev;
        }
        return [...prev, successMessage];
      });

      deps.dispatch({ type: 'SET_PROCESSING', payload: false });
      deps.setProcessingLabel(null);
      deps.setProcessingProgress(0);
    } catch (error) {
      console.error('[Jump to Preview] Error generating preview:', error);
      const errorMessage: ChatMessage = {
        id: generateMessageId(),
        sender: 'system',
        text: '⚠️ I encountered an issue generating the preview. Please try again or continue the conversation.',
        timestamp: Date.now()
      };
      deps.setSetupMessages(prev => [...prev, errorMessage]);
      deps.dispatch({ type: 'SET_PROCESSING', payload: false });
      deps.setProcessingLabel(null);
      deps.setProcessingProgress(0);
    }
  }, [deps.setupMessages, deps.setupStage, canProceedToPreview, deps.state, deps.hasManuallyEditedProjectName, deps.setupProjectName, deps.tempSelectedStandards, inferStandardsFromDescription, deps.dispatch, deps.setProcessingLabel, deps.setProcessingProgress, deps.setProcessingStatusText, deps.setProjectPreview, deps.setSetupStage, deps.setSetupProjectName, deps.setTempSelectedStandards, deps.setSetupMessages]);

  // proceedToWorkspace - exact body from App.tsx lines 3221-3651
  const proceedToWorkspace = async (history: ChatMessage[]) => {
    let savedProject: any = null;
    // Validate transition prerequisites
    if (!history || history.length === 0) {
      console.error('[Transition] No chat history provided');
      if (toastService) {
        toastService.error('Transition Failed: No chat history available. Please restart the setup process.', 5000);
      }
      return;
    }

    // Warn if no project preview exists (but allow transition)
    if (!deps.projectPreview) {
      console.warn('[Transition] No project preview available, proceeding with conversation history only');
      if (toastService) {
        toastService.warning(
          'No Preview Available: Proceeding to workspace with conversation history. You can generate artifacts manually.',
          5000
        );
      }
    }

    // Validate project name
    const finalProjectName = deps.setupProjectName.trim() || deps.projectPreview?.projectName || '';
    if (!finalProjectName) {
      console.error('[Transition] No project name available');
      if (toastService) {
        toastService.error('Transition Failed: Please provide a project name before launching.', 5000);
      }
      deps.dispatch({ type: 'SET_PROCESSING', payload: false });
      return;
    }

    deps.dispatch({ type: 'SET_PROCESSING', payload: true });
    deps.setProcessingLabel("Initializing Project Environment...");
    deps.setProcessingProgress(0);

    const themeLabel = deps.availableThemes.find((t: any) => t.id === deps.selectedTheme)?.label || 'Standard';

    // Wrap entire transition in try-catch for error recovery
    try {

      // Construct a clean, structured project description
      let structuredDescription = `# PROJECT: ${deps.setupProjectName}\n\n`;

      if (deps.projectPreview) {
        structuredDescription += `## EXECUTIVE SUMMARY\n${deps.projectPreview.summary}\n\n`;
        structuredDescription += `## TECH STACK\n${deps.projectPreview.techStack.map((t: string) => `- ${t}`).join('\n')}\n\n`;
        structuredDescription += `## DESIGN THEME\n${themeLabel} (Theme ID: ${deps.selectedTheme})\n\n`;

        // Embed the architecture diagram directly
        const cleanArch = cleanMermaidCode(deps.projectPreview.architectureDiagram);
        structuredDescription += `## ARCHITECTURE DIAGRAM\n\`\`\`mermaid\n${cleanArch}\n\`\`\`\n\n`;

        // Reference the UI Prototype
        structuredDescription += `## UI PROTOTYPE\n(See 'Wireframe Prototype.html' artifact for the visual mockups. Agents should refer to this artifact for UI tasks.)\n\n`;

        structuredDescription += `## IDENTIFIED RISKS\n${deps.projectPreview.risks.map((r: string) => `- ${r}`).join('\n')}\n\n`;
      }

      structuredDescription += `## INITIAL REQUIREMENTS CONVERSATION\n`;
      structuredDescription += history.map(m => `**${m.sender.toUpperCase()}**: ${m.text}`).join('\n\n');

      // Initialize Project State with automatically determined methodology and estimated sprints
      // Use AI-suggested project name from preview if user hasn't provided one
      const finalProjectNameInner = deps.setupProjectName.trim() || deps.projectPreview?.projectName || '';

      deps.dispatch({
        type: 'SET_PROJECT_DETAILS',
        payload: {
          name: finalProjectNameInner,
          description: structuredDescription,
          methodology: (deps.projectPreview?.recommendedMethodology as Methodology) || 'V-Model',
          estimatedSprints: deps.projectPreview?.estimatedSprints
        }
      });
      // Use recommended standards from preview if available, otherwise use tempSelectedStandards
      const standardsToUse = deps.projectPreview?.recommendedStandards && deps.projectPreview.recommendedStandards.length > 0
        ? deps.projectPreview.recommendedStandards
        : (deps.tempSelectedStandards || []);

      if ((import.meta as any).env?.DEV) {
        console.log('[Standards] Assigning standards to project:', {
          fromPreview: deps.projectPreview?.recommendedStandards,
          fromTemp: deps.tempSelectedStandards,
          final: standardsToUse,
          count: standardsToUse.length
        });
      }

      deps.dispatch({ type: 'SET_STANDARDS', payload: standardsToUse });

      // INTELLIGENT AGENT ASSIGNMENT: Assign existing custom agents or create new ones based on project needs
      // This analyzes project requirements and either assigns existing custom agents or creates new ones
      deps.setProcessingLabel("Intelligently assigning agents to project...");
      try {
        // First, try intelligent assignment (assigns existing custom agents or creates new ones)
        if (deps.user?.id && savedProject?._id) {
          try {
            const intelligentResult = await agentAssignmentService.intelligentlyAssignCustomAgents(
              savedProject._id || savedProject.id,
              structuredDescription,
              Phase.INITIATION
            );

            deps.addLog(
              `Intelligent assignment: ${intelligentResult.assignedExistingAgents} existing agent(s) assigned, ${intelligentResult.createdAgents} new agent(s) created. ${intelligentResult.reasoning}`,
              AgentRole.ORCHESTRATOR,
              'success'
            );

            if ((import.meta as any).env?.DEV) {
              console.log('[Intelligent Assignment]', intelligentResult);
            }
          } catch (intelligentError) {
            console.warn('[Intelligent Assignment] Failed, falling back to system agents:', intelligentError);
            // Fall through to system agent assignment
          }
        }

        // Also assign system agents using AI reasoning (for system agents like Orchestrator, etc.)
        deps.setProcessingLabel("Orchestrator analyzing project requirements...");
        const agentAssignment = await agentAssignmentService.analyzeProjectForAgents(
          finalProjectNameInner,
          structuredDescription,
          Phase.INITIATION
        );

        // Add the assigned system agents to the project
        deps.dispatch({ type: 'ADD_AGENTS', payload: agentAssignment.agents });
        deps.addLog(`Orchestrator assigned ${agentAssignment.agents.length} system agents based on AI analysis: ${agentAssignment.reasoning}`, AgentRole.ORCHESTRATOR, 'action');

        if ((import.meta as any).env?.DEV) {
          console.log('[Agent Assignment]', {
            agents: agentAssignment.agents.map((a: any) => a.role),
            reasoning: agentAssignment.reasoning,
            justifications: agentAssignment.agentJustifications
          });
        }
      } catch (agentError) {
        console.warn('[Agent Assignment] Failed, using fallback:', agentError);
        // Fallback: Add basic team if AI fails
        const fallbackAgents = [AgentRole.REQUIREMENTS_AGENT, AgentRole.UX_DESIGNER, AgentRole.IMPLEMENTATION_AGENT];
        fallbackAgents.forEach(role => {
          const agent = AGENTS.find(a => a.role === role);
          if (agent) deps.dispatch({ type: 'ADD_AGENT', payload: agent });
        });
        deps.addLog('Orchestrator assigned default team (AI analysis unavailable).', AgentRole.ORCHESTRATOR, 'info');
      }
      // MIGRATION: Convert uploaded files to artifacts
      if (deps.setupFiles.length > 0) {
        deps.setProcessingLabel("Processing uploaded files...");
        deps.setProcessingProgress(20);

        for (const file of deps.setupFiles) {
          try {
            // Read file content (limit to 1MB for text files to prevent memory issues)
            let fileContent = '';
            if (file.size < 1024 * 1024 && (file.type.startsWith('text/') || file.name.match(/\.(txt|md|json|xml|html|css|js|ts|py|java|cpp|c)$/i))) {
              const reader = new FileReader();
              fileContent = await new Promise<string>((resolve, reject) => {
                reader.onload = (e) => resolve(e.target?.result as string);
                reader.onerror = reject;
                reader.readAsText(file);
              });
            } else {
              fileContent = `[Binary file: ${file.name}]\nSize: ${(file.size / 1024).toFixed(2)} KB\nType: ${file.type || 'unknown'}\n\nThis file was uploaded during project setup but content could not be extracted as text.`;
            }

            // Determine artifact type based on file extension
            let artifactType: 'requirement' | 'design' | 'code' | 'documentation' | 'build' = 'requirement';
            const extension = file.name.split('.').pop()?.toLowerCase();
            if (['pdf', 'doc', 'docx', 'txt', 'md'].includes(extension || '')) {
              artifactType = 'requirement';
            } else if (['png', 'jpg', 'jpeg', 'svg', 'fig', 'sketch'].includes(extension || '')) {
              artifactType = 'design';
            } else if (['js', 'ts', 'jsx', 'tsx', 'py', 'java', 'cpp', 'c'].includes(extension || '')) {
              artifactType = 'code';
            } else if (['html', 'css', 'json', 'xml'].includes(extension || '')) {
              artifactType = 'build';
            }

            deps.dispatch({
              type: 'ADD_ARTIFACT', payload: {
                id: Math.random().toString(36).substring(7),
                title: file.name,
                content: fileContent,
                type: artifactType,
                phase: Phase.INITIATION,
                createdBy: AgentRole.ORCHESTRATOR,
                timestamp: Date.now(),
                tags: ['Uploaded', 'Wizard']
              }
            });
          } catch (error) {
            console.error(`Failed to process file ${file.name}:`, error);
            // Still create artifact entry even if reading fails
            deps.dispatch({
              type: 'ADD_ARTIFACT', payload: {
                id: Math.random().toString(36).substring(7),
                title: file.name,
                content: `[File upload failed: ${error}]\n\nFile: ${file.name}\nSize: ${(file.size / 1024).toFixed(2)} KB\nType: ${file.type || 'unknown'}`,
                type: 'requirement',
                phase: Phase.INITIATION,
                createdBy: AgentRole.ORCHESTRATOR,
                timestamp: Date.now(),
                tags: ['Uploaded', 'Wizard', 'Error']
              }
            });
          }
        }
      }

      // Add initial artifacts from preview
      if (deps.projectPreview) {
        const cleanArch = cleanMermaidCode(deps.projectPreview.architectureDiagram);

        deps.dispatch({
          type: 'ADD_ARTIFACT', payload: {
            id: Math.random().toString(36).substring(7),
            title: 'Executive Summary.md',
            content: deps.projectPreview.summary,
            type: 'requirement',
            phase: Phase.INITIATION,
            createdBy: AgentRole.ORCHESTRATOR,
            timestamp: Date.now(),
            tags: ['Brief']
          }
        });
        deps.dispatch({
          type: 'ADD_ARTIFACT', payload: {
            id: Math.random().toString(36).substring(7),
            title: 'System Architecture.mermaid',
            content: `\`\`\`mermaid\n${cleanArch}\n\`\`\``,
            type: 'design',
            phase: Phase.INITIATION,
            createdBy: AgentRole.DESIGN_ARCH_AGENT,
            timestamp: Date.now(),
            tags: ['Architecture']
          }
        });
        deps.dispatch({
          type: 'ADD_ARTIFACT', payload: {
            id: Math.random().toString(36).substring(7),
            title: 'Wireframe Prototype.html',
            content: deps.projectPreview.wireframeCode,
            type: 'build',
            phase: Phase.INITIATION,
            createdBy: AgentRole.UX_DESIGNER,
            timestamp: Date.now(),
            tags: ['Prototype']
          }
        });
      }

      // MIGRATION: Extract research findings as knowledge artifacts
      const researchMessages = history.filter(msg =>
        msg.sender === 'system' &&
        (msg.text.includes('Research Findings') || msg.text.includes('Deep Research'))
      );

      if (researchMessages.length > 0) {
        researchMessages.forEach((msg, index) => {
          deps.dispatch({
            type: 'ADD_ARTIFACT', payload: {
              id: Math.random().toString(36).substring(7),
              title: `Research Findings ${index + 1}.md`,
              content: msg.text,
              type: 'requirement',
              phase: Phase.INITIATION,
              createdBy: AgentRole.ORCHESTRATOR,
              timestamp: msg.timestamp,
              tags: ['Research', 'Knowledge', 'Wizard']
            }
          });
        });
      }

      // MIGRATION: Store wizard metadata in project state
      // Get custom themes (themes not in default PROJECT_THEMES)
      const defaultThemeIds = PROJECT_THEMES.map((t: any) => t.id);
      const customThemes = deps.availableThemes
        .filter((t: any) => !defaultThemeIds.includes(t.id))
        .map((t: any) => ({
          id: t.id,
          label: t.label,
          primary: t.primary,
          secondary: (t as any).secondary,
          accent: (t as any).accent
        }));

      // Prepare uploaded files metadata
      const uploadedFilesMetadata = deps.setupFiles.map(file => ({
        name: file.name,
        type: file.type || 'unknown',
        size: file.size
      }));

      // Store wizard metadata via direct state update (since we don't have a reducer action for this)
      const currentState = deps.stateRef.current;
      if (currentState) {
        const updatedState: ProjectState = {
          ...currentState,
          wizardMetadata: {
            templateId: deps.selectedTemplateId || undefined,
            templateName: deps.selectedTemplateName || undefined,
            projectPreview: deps.projectPreview ? {
              summary: deps.projectPreview.summary,
              techStack: deps.projectPreview.techStack,
              risks: deps.projectPreview.risks,
              recommendedMethodology: deps.projectPreview.recommendedMethodology as Methodology,
              recommendedStandards: deps.projectPreview.recommendedStandards,
              estimatedSprints: deps.projectPreview.estimatedSprints,
              projectName: deps.projectPreview.projectName
            } : undefined,
            customThemes: customThemes.length > 0 ? customThemes : undefined,
            uploadedFiles: uploadedFilesMetadata.length > 0 ? uploadedFilesMetadata : undefined
          }
        };
        deps.dispatch({ type: 'RESET_PROJECT', payload: updatedState });
      }

      deps.addLog(`Project initialized based on interactive brief.`, AgentRole.ORCHESTRATOR, 'success');
      if (deps.state.useInternet) deps.addLog(`External Knowledge Access: ENABLED`, AgentRole.ORCHESTRATOR, 'info');
      if ((standardsToUse?.length || 0) > 0) {
        const stdNames = (standardsToUse || []).map((id: string) => (QUALITY_STANDARDS || []).find(s => s.id === id)?.name).filter(Boolean).join(', ');
        deps.addLog(`Compliance Protocols Activated: ${stdNames}`, AgentRole.QA_AUDIT_AGENT, 'action');
      }

      // Transfer setup chat messages to global chat for continuity
      // Filter out the initial welcome message from setup if it exists, and keep the global welcome message
      const setupMessagesToTransfer = history.filter(msg =>
        !(msg.sender === 'system' && msg.text.includes('Hello, I am Raed'))
      );

      // Get the orchestrator agent for proper message formatting
      const orchestrator = deps.stateRef.current.agents.find((a: any) => a.role === AgentRole.ORCHESTRATOR) || AGENTS[0];

      // Transfer messages, converting system messages to agent messages for continuity
      const transferredMessages: ChatMessage[] = setupMessagesToTransfer.map(msg => {
        if (msg.sender === 'system') {
          // Convert system messages to agent messages for continuity in global chat
          return {
            ...msg,
            sender: 'agent' as const,
            agentId: orchestrator.id,
            isLogEvent: false
          };
        }
        return msg;
      });

      // Append transferred messages to global messages (keeping the welcome message)
      deps.setGlobalMessages(prev => {
        // Check if messages are already transferred to avoid duplicates
        const existingIds = new Set(prev.map(m => m.id));
        const newMessages = transferredMessages.filter(m => !existingIds.has(m.id));
        return [...prev, ...newMessages];
      });

      deps.setSetupFiles([]);

      // CRITICAL: Save project immediately after adding wizard-created artifacts
      // This ensures all items created in wizard are persisted before transitioning to workspace
      // Wait a brief moment for state updates to complete
      await new Promise(resolve => setTimeout(resolve, 100));
      await deps.saveProject();

      deps.setViewMode('workspace');
      window.location.hash = '#workspace';
      deps.setProcessingProgress(50);

      // Orchestrate phase will create tasks - save again after it completes
      await orchestratePhase(Phase.INITIATION, structuredDescription);

      // CRITICAL: Save project again after orchestratePhase completes
      // This ensures all tasks and artifacts created during orchestration are persisted
      await new Promise(resolve => setTimeout(resolve, 100));
      await deps.saveProject();

      // Update URL with project ID for proper restoration
      const currentProjectId = deps.stateRef.current?.id;
      if (currentProjectId) {
        const url = new URL(window.location.href);
        url.hash = '#workspace';
        url.searchParams.set('project', currentProjectId);
        window.history.replaceState({}, '', url.toString());
        projectStorage.setCurrentProjectId(currentProjectId);
      }

      deps.setProcessingProgress(100);
      deps.setProcessingLabel("Project initialized successfully!");

      // Clear processing state after a brief delay
      setTimeout(() => {
        deps.dispatch({ type: 'SET_PROCESSING', payload: false });
        deps.setProcessingLabel(null);
        deps.setProcessingProgress(0);
      }, 1000);

    } catch (error: any) {
      // Error recovery for transition failures
      console.error('[Transition] Failed to initialize workspace:', error);

      const errorMessage = error?.message || error?.toString() || 'Unknown error occurred';

      // Show user-friendly error with recovery options
      if (toastService) {
        toastService.error(
          `Workspace Initialization Failed: ${errorMessage}. You can try again or continue with manual setup.`,
          8000
        );
      }

      // Add error message to chat history
      const errorMsg: ChatMessage = {
        id: generateMessageId(),
        sender: 'system',
        text: `⚠️ **Transition Error:** ${errorMessage}\n\nYour project data has been saved. You can:\n1. Try launching again\n2. Continue in workspace with manual setup\n3. Contact support if the issue persists.`,
        timestamp: Date.now()
      };

      // Ensure chat history is preserved even on error
      deps.setSetupMessages(prev => {
        const existingIds = new Set(prev.map(m => m.id));
        if (existingIds.has(errorMsg.id)) {
          return prev;
        }
        return [...prev, errorMsg];
      });

      // Reset processing state
      deps.dispatch({ type: 'SET_PROCESSING', payload: false });
      deps.setProcessingLabel(null);
      deps.setProcessingProgress(0);

      // Optionally, still transition to workspace but show error
      // Or stay in setup view - for now, we'll stay in setup
      // deps.setViewMode('workspace'); // Uncomment to allow transition despite error
    }
  };

  // handleSetupSend - exact body from App.tsx lines 2525-3209
  const handleSetupSend = useCallback(async (e: React.SyntheticEvent, stageContext?: string) => {
    e.preventDefault();

    // Prevent concurrent message processing
    if (isProcessingMessageRef.current) {
      console.warn('[Setup Chat] Message already being processed, skipping duplicate');
      return;
    }

    // Get user text from event target value (for voice input) or setupInput (for text input)
    const eventValue = (e.currentTarget as any)?.value || '';
    const inputText = eventValue.trim() || deps.setupInput.trim();

    if ((!inputText && deps.setupFiles.length === 0) || deps.state.isProcessing) {
      console.log('[Setup Chat] Skipping send:', {
        hasInputText: !!inputText,
        inputTextLength: inputText.length,
        hasFiles: deps.setupFiles.length > 0,
        isProcessing: deps.state.isProcessing
      });
      return;
    }

    let userText = inputText || (deps.setupFiles.length > 0 ? "Review attached files for project scope." : "");

    console.log('[Setup Chat] Processing message:', {
      userText: userText.substring(0, 50),
      source: eventValue ? 'event' : 'setupInput',
      hasStageContext: !!stageContext
    });

    // Handle system context updates (stage changes) - these are silent updates
    if (stageContext && stageContext.startsWith('[SYSTEM CONTEXT UPDATE:')) {
      // This is a stage change notification, add it to history but don't show to user
      const systemMessageId = generateMessageId();
      const systemMessage: ChatMessage = {
        id: systemMessageId,
        sender: 'system',
        text: stageContext,
        timestamp: Date.now()
      };

      // Check for duplicate before adding
      deps.setSetupMessages(prev => {
        const existingIds = new Set(prev.map(m => m.id));
        if (existingIds.has(systemMessageId)) {
          console.warn('[Setup Chat] Duplicate system message ID detected, skipping');
          return prev;
        }
        processedMessageIdsRef.current.add(systemMessageId);
        return [...prev, systemMessage];
      });
      return; // Don't send to API, just update context
    }

    // Include stage context in the message if provided
    if (stageContext && !userText.includes('[Context:')) {
      userText = `${userText}\n\n[Context: ${stageContext}]`;
    }

    deps.setSetupInput("");
    deps.setDynamicSuggestions([]); // Clear suggestions on send

    // Generate unique message ID and check for duplicates
    let messageId = generateMessageId();

    // Check if this message ID was already processed (very unlikely but check anyway)
    if (processedMessageIdsRef.current.has(messageId)) {
      console.warn('[Setup Chat] Duplicate message ID detected, generating new one');
      // Generate a new ID (very unlikely to collide again)
      messageId = generateMessageId();
    }

    const newMessage: ChatMessage = {
      id: messageId,
      sender: 'user',
      text: deps.setupFiles.length > 0 ? `${userText}\n\n**Attached Files:**\n${deps.setupFiles.map(f => `- ${f.name}`).join('\n')}` : userText,
      timestamp: Date.now()
    };

    // Set processing lock
    isProcessingMessageRef.current = true;
    processedMessageIdsRef.current.add(messageId);

    // Add message with duplicate check - use functional update
    // Also check for duplicate text content to prevent exact duplicates
    let hasDuplicate = false;
    deps.setSetupMessages(prev => {
      const existingIds = new Set(prev.map(m => m.id));
      if (existingIds.has(messageId)) {
        console.warn('[Setup Chat] Duplicate message ID in state, skipping');
        hasDuplicate = true;
        isProcessingMessageRef.current = false; // Release lock
        return prev;
      }

      // Also check for duplicate text content (same text, same sender, within last 5 seconds)
      const recentDuplicate = prev.find(m =>
        m.sender === 'user' &&
        m.text.trim() === newMessage.text.trim() &&
        Date.now() - m.timestamp < 5000 // Within last 5 seconds
      );
      if (recentDuplicate) {
        console.warn('[Setup Chat] Duplicate message text detected (likely double-send), skipping');
        hasDuplicate = true;
        isProcessingMessageRef.current = false; // Release lock
        return prev;
      }

      const updated = [...prev, newMessage];

      console.log('[Setup Chat] Adding user message:', {
        userText,
        messageId: newMessage.id,
        currentMessagesCount: prev.length,
        updatedMessagesCount: updated.length,
        messageText: newMessage.text.substring(0, 50),
        stageContext: stageContext || 'none'
      });

      return updated;
    });

    // If duplicate was detected, abort processing
    if (hasDuplicate) {
      return;
    }

    // Get current messages for processing (will use latest state)
    const currentMessages = deps.setupMessages;
    const updatedMessages = [...currentMessages, newMessage];

    // Check if user is confirming after research findings - generate preview directly
    const confirmationPhrases = ['yes', 'proceed', 'initialize', 'ok', 'okay', 'go ahead', 'let\'s do it', 'sounds good', 'continue'];
    const userTextLower = userText.toLowerCase().trim();
    const isConfirmation = confirmationPhrases.some(phrase =>
      userTextLower === phrase ||
      userTextLower === phrase + '.' ||
      userTextLower.startsWith(phrase + ' ')
    );

    // Find the most recent research findings message
    const researchMessage = [...updatedMessages]
      .reverse()
      .find(m => m.sender === 'system' && (
        m.text.includes('Research Findings') ||
        m.text.includes('technical specification') ||
        (m.text.includes('initialize the project') && m.text.length > 500)
      ));

    // If user confirmed after research findings, generate preview directly
    if (isConfirmation && researchMessage && deps.setupStage !== 'preview') {
      console.log('[Setup Chat] User confirmed after research findings, generating preview directly...');

      // Extract research findings text (everything after "Research Findings:")
      let researchText = researchMessage.text;
      const findingsIndex = researchText.indexOf('Research Findings');
      if (findingsIndex >= 0) {
        researchText = researchText.substring(findingsIndex);
      }

      // Combine user's original request with research findings for preview generation
      const originalUserMessages = updatedMessages
        .filter(m => m.sender === 'user')
        .slice(0, -1) // Exclude the current "yes" message
        .map(m => m.text)
        .join('\n');

      // Use the original project idea, and include research context in message history
      const previewInput = originalUserMessages || userText;

      // Generate preview directly from research findings
      deps.dispatch({ type: 'SET_PROCESSING', payload: true });
      deps.setProcessingLabel("Generating Project Preview from Research...");
      deps.setProcessingProgress(10);

      try {
        // Create a comprehensive message history including research
        const previewMessages = [
          ...updatedMessages.slice(0, -1), // All messages except the "yes"
          {
            ...newMessage,
            text: `${previewInput}\n\n[User confirmed proceeding with research findings]`
          }
        ];

        deps.setProcessingProgress(40);
        const preview = await generateProjectPreview(previewInput, previewMessages, deps.state.useInternet);

        // Generate game mechanics if this is a game project
        const isGameProject = deps.state.description?.toLowerCase().includes('game') ||
          deps.state.techStack?.some((tech: string) => ['unity', 'unreal', 'phaser', 'godot'].includes(tech.toLowerCase())) ||
          preview.techStack?.some((tech: string) => ['unity', 'unreal', 'phaser', 'godot'].includes(tech.toLowerCase()));

        if (isGameProject) {
          deps.setProcessingStatusText('Generating game mechanics code...');
          deps.setProcessingProgress(50);
          try {
            let gameEngine: 'unity' | 'godot' | 'phaser' | null = null;
            const allTech = [...(deps.state.techStack || []), ...(preview.techStack || [])];
            if (allTech.some((t: string) => t.toLowerCase().includes('unity'))) gameEngine = 'unity';
            else if (allTech.some((t: string) => t.toLowerCase().includes('godot'))) gameEngine = 'godot';
            else if (allTech.some((t: string) => t.toLowerCase().includes('phaser'))) gameEngine = 'phaser';
            else gameEngine = 'unity';

            if (gameEngine) {
              const { gameMechanicsClientService } = await import('../services/gameMechanicsService');
              const mechanicsResult = await gameMechanicsClientService.generateMechanics({
                gameDescription: deps.state.description || previewInput,
                targetEngine: gameEngine
              });
              preview.gameMechanics = mechanicsResult;
            }
          } catch (err) {
            console.error('[Game Mechanics] Generation failed (non-blocking):', err);
          }
        }

        deps.setProjectPreview(preview);
        deps.setSetupStage('preview');

        // Auto-populate project name
        if (!deps.hasManuallyEditedProjectName && preview.projectName && preview.projectName.trim()) {
          if (!deps.setupProjectName.trim() || deps.setupProjectName.trim() === '') {
            deps.setSetupProjectName(preview.projectName.trim());
          }
        }

        // Auto-populate standards
        if (preview.recommendedStandards && preview.recommendedStandards.length > 0) {
          const validStandards = Array.isArray(preview.recommendedStandards)
            ? preview.recommendedStandards.filter((id: string) => QUALITY_STANDARDS.some(s => s.id === id))
            : [];
          if (validStandards.length > 0) {
            deps.setTempSelectedStandards(validStandards);
          }
        }

        // Add success message
        const successMessage: ChatMessage = {
          id: generateMessageId(),
          sender: 'system',
          text: `✅ **Project initialized successfully!**\n\nI've generated your project blueprint based on the research findings.\n\n**Review the Executive Brief and Prototype on the right.**\n\nIf you're happy, type **"Start Project"**. Otherwise, tell me what to change.`,
          timestamp: Date.now()
        };

        deps.setSetupMessages(prev => {
          const existingIds = new Set(prev.map(m => m.id));
          if (existingIds.has(successMessage.id)) {
            return prev;
          }
          return [...prev, successMessage];
        });

        deps.dispatch({ type: 'SET_PROCESSING', payload: false });
        deps.setProcessingLabel(null);
        deps.setProcessingProgress(0);
        isProcessingMessageRef.current = false; // Release lock after successful preview generation
        return; // Exit - preview generated, no need for AI response
      } catch (error) {
        console.error('[Setup Chat] Error generating preview from research:', error);
        const errorMessage: ChatMessage = {
          id: generateMessageId(),
          sender: 'system',
          text: '⚠️ I encountered an issue generating the preview. Let me help you through the normal flow instead.',
          timestamp: Date.now()
        };
        deps.setSetupMessages(prev => [...prev, errorMessage]);
        deps.dispatch({ type: 'SET_PROCESSING', payload: false });
        deps.setProcessingLabel(null);
        deps.setProcessingProgress(0);
        // Continue with normal AI chat flow below
      }
    }

    // If we are already in preview stage, check for confirmation keywords
    if (deps.setupStage === 'preview') {
      const lowerText = userText.toLowerCase();
      if (lowerText.includes('start') || lowerText.includes('launch') || lowerText.includes('proceed') || lowerText.includes('go')) {
        // Proceed to launch
        proceedToWorkspace(updatedMessages);
        return;
      }
    }

    // Use LLM chat API for conversation instead of immediately generating preview
    // Only generate preview when user explicitly requests it or AI indicates readiness
    // Don't show processing states during conversation - only when generating preview

    let isGeneratingPreview = false; // Track if we're generating preview to avoid clearing states in finally

    try {
      // Build conversation history for LLM
      const history = updatedMessages
        .filter(msg => msg.sender !== 'system' || !msg.text.includes('Hello, I am Raed'))
        .slice(-10) // Last 10 messages for context
        .map(msg => ({
          role: msg.sender === 'user' ? 'user' : 'assistant',
          content: msg.text
        }));

      // Call LLM chat API with wizard context
      console.log('[Setup Chat] Calling LLM API with:', {
        message: userText.substring(0, 100),
        historyLength: history.length,
        projectStateId: deps.state.id
      });

      const { apiRequest } = await import('@src/services/api');
      const response = await apiRequest<{
        success: boolean;
        response: string;
        usage?: any;
        modelUsed?: string;
        provider?: string;
      }>('/api/llm/chat', {
        method: 'POST',
        body: JSON.stringify({
          message: userText,
          history: history,
          projectState: deps.state.id ? { id: deps.state.id } : null,
          contextType: 'wizard'
        })
      });

      console.log('[Setup Chat] LLM API response:', {
        success: response.success,
        responseLength: response.response?.length || 0,
        modelUsed: response.modelUsed,
        provider: response.provider
      });

      if (response.success && response.response) {
        console.log('[Setup Chat] Received AI response:', response.response.substring(0, 100) + '...');
        const aiResponseId = generateMessageId();
        const aiResponse: ChatMessage = {
          id: aiResponseId,
          sender: 'system',
          text: response.response,
          timestamp: Date.now()
        };
        deps.setSetupMessages(prev => {
          const existingIds = new Set(prev.map(m => m.id));
          if (existingIds.has(aiResponseId)) {
            console.warn('[Setup Chat] Duplicate AI response ID detected, skipping');
            return prev;
          }

          // Also check for duplicate text content (same text, same sender, within last 5 seconds)
          const recentDuplicate = prev.find(m =>
            m.sender === 'system' &&
            m.text.trim() === aiResponse.text.trim() &&
            Date.now() - m.timestamp < 5000 // Within last 5 seconds
          );
          if (recentDuplicate) {
            console.warn('[Setup Chat] Duplicate AI response text detected (likely double-send), skipping');
            return prev;
          }

          const updated = [...prev, aiResponse];
          console.log('[Setup Chat] Updated messages count:', updated.length, 'New AI message ID:', aiResponse.id);
          console.log('[Setup Chat] Last message sender:', updated[updated.length - 1]?.sender, 'text preview:', updated[updated.length - 1]?.text.substring(0, 50));
          return updated;
        });

        // No processing state during conversation - only when generating preview
        // Check if AI indicates it has enough information or user explicitly requests preview
        const responseText = response.response.toLowerCase();
        const userTextLowerInner = userText.toLowerCase();

        const explicitCompletionPhrases = [
          'i have enough information to generate',
          'i can now generate your project',
          'ready to create your project preview',
          'i have everything i need to get started',
          'perfect! i have enough information',
          'i\'m ready to generate your project'
        ];

        const userRequestPhrases = [
          'generate preview',
          'create preview',
          'show preview',
          'generate project',
          'create project',
          'build project',
          'start project',
          'launch project'
        ];

        // Check if user is confirming after research findings
        const confirmationPhrasesInner = ['yes', 'proceed', 'initialize', 'ok', 'okay', 'go ahead', 'let\'s do it', 'sounds good', 'continue'];
        const userConfirmed = confirmationPhrasesInner.some(phrase => userTextLowerInner.trim() === phrase || userTextLowerInner.trim().startsWith(phrase + ' '));

        // Check if previous message was research findings
        const previousSystemMessage = updatedMessages
          .slice()
          .reverse()
          .find(m => m.sender === 'system');
        const hasRecentResearch = previousSystemMessage && (
          previousSystemMessage.text.includes('Research Findings') ||
          previousSystemMessage.text.includes('initialize the project') ||
          previousSystemMessage.text.includes('technical specification')
        );

        const hasEnoughInfo = explicitCompletionPhrases.some(phrase => responseText.includes(phrase));
        const userRequestedPreview = userRequestPhrases.some(phrase => userTextLowerInner.includes(phrase));
        const messageCount = updatedMessages.filter(m => m.sender === 'user').length;

        // Only generate preview if:
        // 1. User explicitly requests it, OR
        // 2. User confirms after research findings, OR
        // 3. AI indicates readiness AND we have at least 4 exchanges
        if (userRequestedPreview || (userConfirmed && hasRecentResearch) || (hasEnoughInfo && messageCount >= 4)) {
          // Generate preview - NOW we show processing states
          isGeneratingPreview = true;
          deps.dispatch({ type: 'SET_PROCESSING', payload: true });
          deps.setProcessingLabel(deps.projectPreview ? "Refining Prototype..." : "Architecting Solution & Generating Prototype...");
          deps.setProcessingProgress(10);

          // Process files if any
          const fileDataPayload: { mimeType: string, data: string }[] = [];

          deps.setProcessingProgress(40);

          const preview = await generateProjectPreview(userText, [...updatedMessages, aiResponse], deps.state.useInternet, deps.projectPreview);
          if ((import.meta as any).env?.DEV) {
            console.log('[Preview] Received preview data:', {
              hasPreview: !!preview,
              hasArchitectureDiagram: !!preview?.architectureDiagram,
              architectureDiagramLength: preview?.architectureDiagram?.length || 0,
              architectureDiagramPreview: preview?.architectureDiagram?.substring(0, 200) || 'N/A',
              allKeys: preview ? Object.keys(preview) : []
            });
          }
          deps.setProjectPreview(preview);
          deps.setSetupStage('preview');

          // Auto-populate project name if user hasn't entered one and AI suggests a name
          // This ensures the system always suggests a name when available
          if (!deps.hasManuallyEditedProjectName && preview.projectName && preview.projectName.trim()) {
            // Only auto-populate if field is empty or still has default value
            if (!deps.setupProjectName.trim() || deps.setupProjectName.trim() === '') {
              deps.setSetupProjectName(preview.projectName.trim());
              if ((import.meta as any).env?.DEV) {
                console.log('[Project Name] Auto-populated AI-suggested name:', preview.projectName);
              }
            }
          } else if ((import.meta as any).env?.DEV) {
            console.log('[Project Name] Skipping auto-populate:', {
              hasManuallyEdited: deps.hasManuallyEditedProjectName,
              currentName: deps.setupProjectName,
              suggestedName: preview.projectName,
              isEmpty: !deps.setupProjectName.trim()
            });
          }

          // Auto-populate standards dropdown with recommended standards
          if (preview.recommendedStandards && preview.recommendedStandards.length > 0) {
            console.log('[Standards] Received recommended standards from preview:', preview.recommendedStandards);
            // Ensure we're setting an array
            const standardsArray = Array.isArray(preview.recommendedStandards)
              ? preview.recommendedStandards
              : [preview.recommendedStandards];
            console.log('[Standards] Setting tempSelectedStandards to:', standardsArray);
            console.log('[Standards] Available QUALITY_STANDARDS IDs:', QUALITY_STANDARDS.map(s => s.id));
            console.log('[Standards] Matching standards:', standardsArray.filter((id: string) => QUALITY_STANDARDS.some(s => s.id === id)));
            // Filter to only include valid standard IDs that exist in QUALITY_STANDARDS
            const validStandards = standardsArray.filter((id: string) => QUALITY_STANDARDS.some(s => s.id === id));
            if (validStandards.length > 0) {
              console.log('[Standards] Setting valid standards:', validStandards);
              deps.setTempSelectedStandards(validStandards);
            } else {
              console.warn('[Standards] No valid standards found. Received:', standardsArray, 'Available:', QUALITY_STANDARDS.map(s => s.id));
            }
          } else {
            console.warn('[Standards] No recommended standards in preview:', {
              hasPreview: !!preview,
              hasRecommendedStandards: !!preview?.recommendedStandards,
              standardsLength: preview?.recommendedStandards?.length || 0,
              recommendedStandards: preview?.recommendedStandards
            });

            // Fallback: Try to infer standards from project description if backend didn't return any
            if (deps.tempSelectedStandards.length === 0 && userText) {
              const inferredStandards = inferStandardsFromDescription(userText, deps.setupMessages);
              if (inferredStandards.length > 0) {
                console.log('[Standards] Inferred standards from description:', inferredStandards);
                deps.setTempSelectedStandards(inferredStandards);
              }
            }
          }

          const standardsText = preview.recommendedStandards && preview.recommendedStandards.length > 0
            ? `\n\n**Recommended Quality Standards: ${preview.recommendedStandards.length}**\n*Automatically selected based on project characteristics and compliance requirements.*`
            : '';

          const sprintsText = preview.estimatedSprints
            ? `\n\n**Estimated Sprints: ${preview.estimatedSprints}**\n*Based on project complexity, team size, and requirements analysis.*`
            : '';

          const systemReply: ChatMessage = {
            id: Math.random().toString(),
            sender: 'system',
            text: `I've generated a project blueprint based on your request. \n\n**Recommended Methodology: ${preview.recommendedMethodology}**\n*Reasoning: Adapted to your project type for optimal results.*${standardsText}${sprintsText}\n\n**Review the Executive Brief and Prototype on the right.**\n\nIf you're happy, type **"Start Project"**. Otherwise, tell me what to change (e.g., "Add dark mode").`,
            timestamp: Date.now()
          };
          deps.setSetupMessages(prev => [...prev, systemReply]);

          // Clear processing states after preview is generated
          deps.dispatch({ type: 'SET_PROCESSING', payload: false });
          deps.setProcessingLabel(null);
          deps.setProcessingProgress(0);
          deps.setIsResearching(false);
          isGeneratingPreview = false; // Reset flag
        } else {
          // AI wants to continue conversation - no preview generation
          // Processing state already cleared above, just return
          return; // Exit early, don't generate preview
        }
      } else {
        // LLM API failed - fallback to direct preview generation only if user explicitly requested
        const userTextLowerFallback = userText.toLowerCase();
        const userRequestedPreview = userTextLowerFallback.includes('generate') ||
          userTextLowerFallback.includes('preview') ||
          userTextLowerFallback.includes('create project') ||
          userTextLowerFallback.includes('build project');

        if (!userRequestedPreview) {
          // Don't generate preview if user didn't explicitly request it
          // No processing state to clear - we don't show it during conversation

          // Show error message
          const errorMessage: ChatMessage = {
            id: Math.random().toString(),
            sender: 'system',
            text: 'I encountered an issue processing your message. Please try again or type "generate preview" when you\'re ready to create your project.',
            timestamp: Date.now()
          };
          deps.setSetupMessages(prev => [...prev, errorMessage]);
          return;
        }

        // User explicitly requested preview - generate it
        isGeneratingPreview = true;
        deps.dispatch({ type: 'SET_PROCESSING', payload: true });
        deps.setProcessingLabel(deps.projectPreview ? "Refining Prototype..." : "Architecting Solution & Generating Prototype...");
        deps.setProcessingProgress(10);

        // Process files if any
        const fileDataPayload: { mimeType: string, data: string }[] = [];

        deps.setProcessingProgress(40);

        const preview = await generateProjectPreview(userText, updatedMessages, deps.state.useInternet, deps.projectPreview);
        if ((import.meta as any).env?.DEV) {
          console.log('[Preview] Received preview data:', {
            hasPreview: !!preview,
            hasArchitectureDiagram: !!preview?.architectureDiagram,
            architectureDiagramLength: preview?.architectureDiagram?.length || 0,
            architectureDiagramPreview: preview?.architectureDiagram?.substring(0, 200) || 'N/A',
            allKeys: preview ? Object.keys(preview) : []
          });
        }
        deps.setProjectPreview(preview);
        deps.setSetupStage('preview');

        // Auto-populate project name if user hasn't entered one and AI suggests a name
        if (!deps.hasManuallyEditedProjectName && preview.projectName && preview.projectName.trim()) {
          if (!deps.setupProjectName.trim() || deps.setupProjectName.trim() === '') {
            deps.setSetupProjectName(preview.projectName.trim());
            if ((import.meta as any).env?.DEV) {
              console.log('[Project Name] Auto-populated AI-suggested name:', preview.projectName);
            }
          }
        } else if ((import.meta as any).env?.DEV) {
          console.log('[Project Name] Skipping auto-populate:', {
            hasManuallyEdited: deps.hasManuallyEditedProjectName,
            currentName: deps.setupProjectName,
            suggestedName: preview.projectName,
            isEmpty: !deps.setupProjectName.trim()
          });
        }

        // Auto-populate standards dropdown with recommended standards
        if (preview.recommendedStandards && preview.recommendedStandards.length > 0) {
          console.log('[Standards] Received recommended standards from preview:', preview.recommendedStandards);
          const standardsArray = Array.isArray(preview.recommendedStandards)
            ? preview.recommendedStandards
            : [preview.recommendedStandards];
          const validStandards = standardsArray.filter((id: string) => QUALITY_STANDARDS.some(s => s.id === id));
          if (validStandards.length > 0) {
            deps.setTempSelectedStandards(validStandards);
          }
        } else {
          if (deps.tempSelectedStandards.length === 0 && userText) {
            const inferredStandards = inferStandardsFromDescription(userText, deps.setupMessages);
            if (inferredStandards.length > 0) {
              deps.setTempSelectedStandards(inferredStandards);
            }
          }
        }

        const standardsText = preview.recommendedStandards && preview.recommendedStandards.length > 0
          ? `\n\n**Recommended Quality Standards: ${preview.recommendedStandards.length}**\n*Automatically selected based on project characteristics and compliance requirements.*`
          : '';

        const sprintsText = preview.estimatedSprints
          ? `\n\n**Estimated Sprints: ${preview.estimatedSprints}**\n*Based on project complexity, team size, and requirements analysis.*`
          : '';

        const systemReply: ChatMessage = {
          id: Math.random().toString(),
          sender: 'system',
          text: `I've generated a project blueprint based on your request. \n\n**Recommended Methodology: ${preview.recommendedMethodology}**\n*Reasoning: Adapted to your project type for optimal results.*${standardsText}${sprintsText}\n\n**Review the Executive Brief and Prototype on the right.**\n\nIf you're happy, type **"Start Project"**. Otherwise, tell me what to change (e.g., "Add dark mode").`,
          timestamp: Date.now()
        };
        deps.setSetupMessages(prev => [...prev, systemReply]);

        // Clear processing states after preview is generated
        deps.dispatch({ type: 'SET_PROCESSING', payload: false });
        deps.setProcessingLabel(null);
        deps.setProcessingProgress(0);
        deps.setIsResearching(false);
        isGeneratingPreview = false; // Reset flag
      }
    } catch (err: any) {
      console.error("❌ Setup chat failed", err);
      console.error("Error details:", {
        message: err?.message,
        error: err?.error,
        response: err?.response,
        stack: err?.stack
      });
      deps.setIsResearching(false);

      // Extract detailed error message
      const errorMessage = err?.message || err?.error?.message || err?.toString() || 'Unknown error';
      const errorDetails = err?.error?.details || err?.response?.data?.error || '';
      const fullError = errorDetails ? `${errorMessage}: ${errorDetails}` : errorMessage;

      // Check if it's a backend connection error
      const isBackendError = errorMessage.includes('fetch') || errorMessage.includes('network') || errorMessage.includes('Failed to fetch') || errorMessage.includes('ERR_CONNECTION_REFUSED');
      const backendHint = isBackendError ? '\n\n**Tip:** Make sure the backend server is running at http://localhost:3002' : '';

      // Show toast notification for user feedback
      if (toastService) {
        toastService.error(
          `Failed to process message: ${isBackendError
            ? 'Please check your backend connection'
            : 'Please try again or type "generate preview" when you\'re ready to create your project'}`
        );
      }

      const errReply: ChatMessage = {
        id: generateMessageId(),
        sender: 'system',
        text: `I encountered an error: ${fullError}${backendHint}\n\nPlease try again or type "generate preview" when you're ready to create your project.`,
        timestamp: Date.now()
      };

      // Add error message with duplicate check
      deps.setSetupMessages(prev => {
        const existingIds = new Set(prev.map(m => m.id));
        if (existingIds.has(errReply.id)) {
          return prev;
        }
        return [...prev, errReply];
      });
    } finally {
      // Always release the processing lock
      isProcessingMessageRef.current = false;

      // Only clear processing states if we're NOT generating preview
      // If we're generating preview, let it continue showing
      if (!isGeneratingPreview) {
        deps.dispatch({ type: 'SET_PROCESSING', payload: false });
        deps.setProcessingLabel(null);
        deps.setProcessingProgress(0);
        deps.setIsResearching(false);
      }
      setTimeout(() => deps.setupInputRef.current?.focus(), 100);
    }
  }, [deps.setupInput, deps.setupFiles, deps.state, deps.setupMessages, deps.projectPreview, deps.dispatch, deps.setSetupInput, deps.setSetupMessages, deps.setProjectPreview, deps.setProcessingLabel, deps.setProcessingProgress, deps.setIsResearching, deps.setTempSelectedStandards, deps.setSetupStage, deps.setupProjectName, deps.hasManuallyEditedProjectName, deps.setSetupProjectName, inferStandardsFromDescription]);

  // handleManualLaunch - exact body from App.tsx
  const handleManualLaunch = (e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();

    console.log("Manual Launch Triggered");

    const userText = "Start Project";
    const newMessage: ChatMessage = {
      id: Math.random().toString(),
      sender: 'user',
      text: userText,
      timestamp: Date.now()
    };
    const updatedMessages = [...deps.setupMessages, newMessage];
    deps.setSetupMessages(updatedMessages);
    proceedToWorkspace(updatedMessages);
  };

  return { handleSetupSend, handleJumpToPreview, handleManualLaunch, orchestratePhase, canProceedToPreview };
}
