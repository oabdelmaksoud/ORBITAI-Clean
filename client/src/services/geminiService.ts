import { GoogleGenAI, Type, Schema } from "@google/genai";
import { Agent, Task, Artifact, ChatMessage, AgentRole, Phase, MCPServer, DialogueEvent, TokenUsage, EvaluationResult, ProjectState, Mode, ProjectPreview } from '@orbitai/shared';
import { MODEL_PRICING } from '@orbitai/shared';

import { getApiBaseUrl } from '@src/utils/apiUrlNormalizer';

// Use backend API if available, otherwise fallback to direct API
const API_BASE_URL = getApiBaseUrl();
console.log('🔌 GeminiService using API URL:', API_BASE_URL || '(relative path via proxy)');
const USE_BACKEND_API = ((import.meta as any)?.env?.VITE_USE_BACKEND_API) !== 'false'; // Default to true

// SECURITY: API keys should NEVER be in frontend code.
// All AI calls must go through backend API to keep API keys secure.
// Direct API calls are disabled - functions will throw errors if backend is unavailable.

// Helper to throw error for any direct API access attempts
function throwDirectAPIDisabled(): never {
    throw new Error('Direct API calls from frontend are disabled for security. All AI operations must go through the backend API. Please ensure the backend server is running at ' + API_BASE_URL);
}

// Create a proxy object that throws errors on any access
const ai = new Proxy({} as GoogleGenAI, {
    get: () => throwDirectAPIDisabled(),
    set: () => throwDirectAPIDisabled(),
    apply: () => throwDirectAPIDisabled()
});

// OPTIMIZATION: Different timeouts for different operation types
const TIMEOUTS = {
    preview: 600000, // 10 minutes for preview generation (complex game projects can take longer)
    theme: 60000,    // 1 minute for theme generation
    agent: 120000,   // 2 minutes for agent tasks
    default: 90000   // 90 seconds default
};


// Helper to call backend API with operation-specific timeouts
async function callBackendAPI(endpoint: string, data: any, timeoutMs?: number) {
    // Auto-detect timeout based on endpoint if not specified
    if (!timeoutMs) {
        if (endpoint.includes('generate-preview')) {
            timeoutMs = TIMEOUTS.preview;
        } else if (endpoint.includes('generate-theme')) {
            timeoutMs = TIMEOUTS.theme;
        } else if (endpoint.includes('execute-task')) {
            timeoutMs = TIMEOUTS.agent;
        } else {
            timeoutMs = TIMEOUTS.default;
        }
    }
    try {
        // Get auth token from localStorage if available
        const token = typeof localStorage !== 'undefined' ? localStorage.getItem('authToken') : null;

        const headers: HeadersInit = {
            'Content-Type': 'application/json',
            'Bypass-Tunnel-Reminder': 'true', // Allow requests through localtunnel
        };

        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        // Create AbortController for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        try {
            const response = await fetch(`${API_BASE_URL}${endpoint}`, {
                method: 'POST',
                headers,
                body: JSON.stringify(data),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorText = await response.text();
                let errorData;
                try {
                    errorData = JSON.parse(errorText);
                } catch {
                    errorData = { message: errorText || `HTTP ${response.status}: ${response.statusText}` };
                }
                const error = new Error(errorData.error?.message || errorData.message || 'API request failed');
                (error as any).response = { data: errorData, status: response.status };
                (error as any).error = errorData.error;
                throw error;
            }

            const result = await response.json();
            return result;
        } catch (fetchError: any) {
            clearTimeout(timeoutId);
            if (fetchError.name === 'AbortError' || fetchError.message?.includes('aborted')) {
                const timeoutError = new Error(
                    `Request timed out after ${timeoutMs / 1000} seconds. The preview generation is taking longer than expected. ` +
                    `This may happen with complex projects. Please try:\n\n` +
                    `1. Simplifying your project description\n` +
                    `2. Waiting a moment and trying again\n` +
                    `3. Checking if the backend server is running properly\n\n` +
                    `Original error: ${fetchError.message}`
                );
                (timeoutError as any).isTimeoutError = true;
                (timeoutError as any).originalError = fetchError;
                console.error('⏱️ Request Timeout:', timeoutError.message);
                throw timeoutError;
            }
            throw fetchError;
        }
    } catch (error: any) {
        // Check if it's a timeout error (from server 408 response)
        if (error.message?.includes('timeout') || error.message?.includes('timed out') || error.response?.status === 408) {
            const timeoutError = new Error(
                `Request timed out. The preview generation is taking longer than expected. ` +
                `This may happen with complex projects. Please try:\n\n` +
                `1. Simplifying your project description\n` +
                `2. Waiting a moment and trying again\n` +
                `3. Checking if the backend server is running properly\n\n` +
                `Original error: ${error.message}`
            );
            (timeoutError as any).isTimeoutError = true;
            (timeoutError as any).originalError = error;
            console.error('⏱️ Request Timeout:', timeoutError.message);
            throw timeoutError;
        }
        // Check if it's a connection error
        if (error.message?.includes('Failed to fetch') || error.message?.includes('ERR_CONNECTION_REFUSED') || error.name === 'TypeError') {
            const friendlyError = new Error(
                `Backend server is not running. Please start the backend server:\n\n` +
                `1. Open a terminal\n` +
                `2. cd server\n` +
                `3. npm run dev\n\n` +
                `The server should run on ${API_BASE_URL}\n\n` +
                `Original error: ${error.message}`
            );
            (friendlyError as any).isConnectionError = true;
            (friendlyError as any).originalError = error;
            console.error('❌ Backend Connection Error:', friendlyError.message);
            // Show toast notification to user
            try {
                const { toast } = await import('./toastService');
                toast.error(
                    `Backend server is not running. Please start the backend server:\n\n1. Open a terminal\n2. cd server\n3. npm run dev\n\nThe server should run on ${API_BASE_URL}`,
                    10000
                );
            } catch (toastError) {
                // Toast service not available, continue with error
            }
            throw friendlyError;
        }
        console.error('Backend API call failed:', error);
        // Show generic error toast
        try {
            const { toast } = await import('./toastService');
            toast.error('Backend API call failed. Please check your connection and try again.', 6000);
        } catch (toastError) {
            // Toast service not available, continue with error
        }
        throw error;
    }
}

// --- Types ---

export type APIHealth = 'healthy' | 'degraded' | 'paused';

export interface APIMetrics {
    requests: number;
    lastLatency: number;
    errors: number;
    latencyHistory: number[];
    usageHistory: number[];
    msg?: string;
}

// ProjectPreview type is now imported from ../types
export type { ProjectPreview } from '@orbitai/shared';

export interface FullArchitectureAnalysis {
    summary: string;
    strengths: string[];
    weaknesses: string[];
    recommendations: string[];
    diagram: string;
    securityScore: number;
    scalabilityScore: number;
}

export async function performFullArchitectureAnalysis(
    projectId: string,
    context: any
): Promise<FullArchitectureAnalysis> {
    // Use backend API if available
    if (USE_BACKEND_API) {
        try {
            const result = await callBackendAPI('/api/llm/architecture-analysis', {
                projectId,
                context
            });
            if (result.success && result.data) {
                return result.data as FullArchitectureAnalysis;
            }
        } catch (error) {
            console.error('Architecture analysis failed:', error);
        }
    }


    // Fallback / Mock
    return {
        summary: "Architecture analysis requires backend connectivity.",
        strengths: ["Clean separation of concerns", "Modern stack"],
        weaknesses: ["No proper error handling in mock"],
        recommendations: ["Ensure backend is running"],
        diagram: "graph TD; A[Client] --> B[Server];",
        securityScore: 85,
        scalabilityScore: 90
    };
}

export interface ProjectResearch {
    executiveSummary: string | { overview: string; keyPoints: string[] };
    overallScore?: number;
    objectivesAndScope?: {
        researchQuestions: string[];
        geography: string;
        segments: string;
        timeframe: string;
    };
    methodology?: {
        dataSources: string[];
        timeWindow: string;
        limitations: string;
    };
    marketOverview?: {
        definition: string;
        size: string;
        sizeValue?: number;
        growthStage: string;
        growthRate: string;
        macroTrends: string[];
    };
    targetAudience?: {
        description: string;
        segments: Array<{
            name: string;
            size: string;
            needs: string;
            pains: string;
            willingnessToPay: string;
        }>;
    };
    demandAndBehavior?: {
        demandEvidence: string[];
        searchInterest: string;
        buyingJourney: string;
        adoptionBarriers: string[];
    };
    competitorLandscape?: Array<{
        name: string;
        offering: string;
        pricing: string;
        marketShare: string;
        strengths: string;
        weaknesses: string;
        differentiation: string;
    }>;
    pricingSnapshot?: {
        typicalRange: string;
        models: string[];
        priceSensitivity: string;
        recommendedStrategy: string;
    };
    swotAnalysis?: {
        strengths: string[];
        weaknesses: string[];
        opportunities: string[];
        threats: string[];
    };
    keyInsights?: {
        topPains: string[];
        desiredFeatures: string[];
        commonObjections: string[];
        trendingUp: string[];
        trendingDown: string[];
        surprisingFindings: string[];
    };
    validationChecklist?: {
        targetMarketClarity: { status: string; notes: string };
        realProblem: { status: string; notes: string };
        demandEvidence: { status: string; notes: string };
        competitionIntensity: { status: string; notes: string };
        feasibleDifferentiation: { status: string; notes: string };
    };
    feasibility: {
        technical: string;
        technicalScore?: number;
        financial: string;
        financialScore?: number;
        estimatedCosts?: { development: number; marketing: number; operationsPerYear: number };
        operational: string;
        operationalScore?: number;
        timeToMarket?: string;
    };
    marketAnalysis?: {
        targetAudience: string;
        audienceSize?: string;
        marketSize: string;
        marketSizeValue?: number;
        growthRate?: string;
        trends: string[];
    };
    competitors?: Array<string | { name: string; marketShare?: string; strengths?: string; weaknesses?: string }>;
    challenges?: Array<string | { risk: string; severity?: string; mitigation?: string }>;
    recommendations?: string[];
    keyMetrics?: {
        breakEvenMonths?: number;
        projectedROI?: string;
        customerAcquisitionCost?: number;
        lifetimeValue?: number;
    };
}

export async function generateProjectResearch(
    topic: string,
    ideas: any[]
): Promise<ProjectResearch> {
    // Use backend API if available
    if (USE_BACKEND_API) {
        try {
            const result = await callBackendAPI('/api/llm/generate-research', {
                topic,
                ideas
            });
            if (result.success && result.data) {
                return result.data as ProjectResearch;
            }
        } catch (error) {
            console.error('Research generation failed:', error);
        }
    }

    // Fallback Mock Data
    await new Promise(resolve => setTimeout(resolve, 2000));
    return {
        executiveSummary: `The proposed project "${topic}" shows high potential for market disruption. This platform addresses a clear gap in the current ecosystem by leveraging AI to solve complex user workflow issues.`,
        feasibility: {
            technical: "High feasibility using modern tech stack (React, Node, Python for AI). Key challenges involve real-time data processing and model latency, which can be mitigated with edge computing.",
            financial: "Moderate initial investment required for AI infrastructure. High scalability potential suggests strong ROI within 18-24 months.",
            operational: "Requires a specialized team of AI engineers and full-stack developers. Operational costs will scale with user base due to inference costs."
        },
        marketAnalysis: {
            targetAudience: "Enterprise users, Project Managers, and Software Development teams looking for automation.",
            marketSize: "$12.5B global market for AI-augmented development tools, growing at 22% CAGR.",
            trends: [
                "Shift towards agentic workflows",
                "Increasing demand for no-code/low-code solutions",
                "Integration of Generative AI in SDLC"
            ]
        },
        competitors: [
            "GitHub Copilot Workspace",
            "Cursor",
            "Devin (Cognition AI)",
            "Replit Agent"
        ],
        challenges: [
            "Model hallucination & accuracy",
            "High competition from established big tech",
            "Data privacy concerns for enterprise clients"
        ]
    };
}

// --- API Monitor ---

class APIMonitor {
    private listeners: ((status: APIHealth, metrics: APIMetrics) => void)[] = [];
    private metrics: APIMetrics = {
        requests: 0,
        lastLatency: 0,
        errors: 0,
        latencyHistory: [],
        usageHistory: []
    };
    private status: APIHealth = 'healthy';

    subscribe(listener: (status: APIHealth, metrics: APIMetrics) => void) {
        this.listeners.push(listener);
        listener(this.status, this.metrics);
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    }

    logRequest(latency: number, isError: boolean = false) {
        this.metrics.requests++;
        this.metrics.lastLatency = latency;
        if (isError) this.metrics.errors++;

        this.metrics.latencyHistory.push(latency);
        if (this.metrics.latencyHistory.length > 50) this.metrics.latencyHistory.shift();

        // Simple usage tracking
        this.metrics.usageHistory.push(1);
        if (this.metrics.usageHistory.length > 50) this.metrics.usageHistory.shift();

        this.notify();
    }

    private notify() {
        this.listeners.forEach(l => l(this.status, this.metrics));
    }
}

export const apiMonitor = new APIMonitor();

// --- Helper Functions ---

const getModelForAgent = (agent: Agent): string => {
    if (agent.role === AgentRole.ORCHESTRATOR || agent.role === AgentRole.DESIGN_ARCH_AGENT) {
        return 'gemini-3-pro-preview'; // High reasoning for planning
    }
    if (agent.role === AgentRole.IMPLEMENTATION_AGENT || agent.role === AgentRole.TEST_AGENT) {
        return 'gemini-2.5-flash'; // Fast for coding/testing
    }
    return 'gemini-2.5-flash';
};

// --- Core Service Functions ---

export async function executeAgentTask(
    agent: Agent,
    task: Task,
    projectContext: string,
    artifacts: Artifact[],
    useInternet: boolean,
    mcpServers: MCPServer[],
    onDialogue: (event: DialogueEvent) => void,
    standards: string[],
    signal?: AbortSignal
): Promise<{ output: string, resources: string[], tokenUsage: TokenUsage, modelUsed: string, evaluation?: EvaluationResult, collaboration?: DialogueEvent[] }> {
    const startTime = Date.now();
    const modelName = getModelForAgent(agent);

    // Backend API call (mock removed)

    // NEW: Analyze task to determine if tools are needed automatically
    const { analyzeTaskToolRequirements } = await import('./taskToolAnalyzer');
    const toolRequirements = analyzeTaskToolRequirements(task.description, task.title);

    // Collect collaboration events from frontend (before sending to backend)
    const frontendCollaborationEvents: DialogueEvent[] = [];

    // Wrap onDialogue to collect events
    const originalOnDialogue = onDialogue;
    const wrappedOnDialogue = (event: DialogueEvent) => {
        // Collect event for sending to backend
        frontendCollaborationEvents.push({
            ...event,
            id: event.id || Math.random().toString(36).substring(7),
            sender: event.sender || agent.role,
            receiver: event.receiver || agent.role,
            type: event.type || 'draft'
        });
        // Also call original callback
        if (originalOnDialogue) {
            originalOnDialogue(event);
        }
    };

    // Auto-enable internet if task needs it (respecting user setting as minimum)
    const effectiveUseInternet = useInternet || toolRequirements.needsInternet;
    if (toolRequirements.needsInternet && !useInternet) {
        console.log(`[executeAgentTask] Task requires internet search: "${task.title}" - Auto-enabling internet`);
        wrappedOnDialogue({
            id: Math.random().toString(36).substring(7),
            sender: agent.role,
            receiver: agent.role,
            message: `📡 Task requires internet access - automatically enabling search capability`,
            type: 'draft',
            timestamp: Date.now()
        });
    }

    // Determine if MCP tools are needed based on task analysis
    const needsMCPTools = toolRequirements.needsFileAccess || toolRequirements.needsCommandExecution;
    if (needsMCPTools) {
        // Check if MCP tools message was already added to avoid duplicates
        const mcpMessageAlreadyAdded = task.collaboration?.some(e =>
            e.message.includes('🔧 Task requires file/command access - enabling MCP tools automatically') ||
            e.message.includes('enabling MCP tools automatically')
        );

        if (!mcpMessageAlreadyAdded) {
            console.log(`[executeAgentTask] Task requires MCP tools: "${task.title}" - ${toolRequirements.reasoning}`);
            wrappedOnDialogue({
                id: Math.random().toString(36).substring(7),
                sender: agent.role,
                receiver: agent.role,
                message: `🔧 Task requires file/command access - enabling MCP tools automatically`,
                type: 'draft',
                timestamp: Date.now()
            });
        }
    }

    // Initialize vector search with artifacts if Knowledge Graph server is active
    // System servers default to active if status is missing
    const hasKnowledgeGraph = mcpServers.some(s => {
        if (!s || s.id !== 'mcp-sys-2') return false;
        // System servers default to active if status is missing
        if (s.source === 'system' && (!s.status || s.status === 'active')) return true;
        return s.status === 'active';
    });
    if (hasKnowledgeGraph && artifacts.length > 0) {
        try {
            const API_BASE_URL = ((import.meta as any)?.env?.VITE_API_URL) || '';
            await fetch(`${API_BASE_URL}/api/mcp/vector-search/initialize`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ artifacts })
            }).catch(err => console.warn('Failed to initialize vector search:', err));
        } catch (error) {
            console.warn('Vector search initialization error:', error);
        }
    }

    // Discover MCP tools from active servers (with caching)
    // NEW: Only connect to servers when actually needed - mark them as in use
    const functionDeclarations: any[] = [];
    // Filter active servers - treat undefined/null status as 'active' for system servers
    const activeServers = mcpServers.filter(s => {
        if (!s) return false;
        // System servers (source: 'system') default to active if status is missing
        if (s.source === 'system' && (!s.status || s.status === 'active')) return true;
        // Other servers must explicitly have status: 'active'
        return s.status === 'active';
    });
    const serverIdsToUse: string[] = [];

    if (activeServers.length > 0) {
        try {
            const { discoverMCPTools } = await import('./mcpApi');
            const { getCachedTools, setCachedTools, generateServersKey } = await import('./mcpToolCache');

            // Check cache first
            const serversKey = generateServersKey(activeServers);
            let toolsByServer = getCachedTools(serversKey);

            if (!toolsByServer) {
                // Cache miss - discover tools (this connects to servers)
                toolsByServer = await discoverMCPTools(activeServers);
                setCachedTools(serversKey, toolsByServer);

                // Mark servers as in use since we just connected to discover tools
                activeServers.forEach(server => serverIdsToUse.push(server.id));
            } else {
                // Cache hit - still mark servers as in use since we're using their tools
                activeServers.forEach(server => serverIdsToUse.push(server.id));
            }

            // Convert MCP tools to Gemini function format - collect all functions in one array
            if (toolsByServer) {
                for (const [serverId, tools] of Object.entries(toolsByServer)) {
                    if (Array.isArray(tools)) {
                        for (const tool of tools) {
                            functionDeclarations.push({
                                name: tool.name,
                                description: tool.description,
                                parameters: convertMCPSchemaToGemini(tool.inputSchema)
                            });
                        }
                    }
                }
            }
        } catch (error) {
            console.warn('Failed to discover MCP tools, continuing without them:', error);
        }
    }

    // NEW: Add create_mcp_server function for agents to create their own servers
    functionDeclarations.push({
        name: 'create_mcp_server',
        description: 'Create a new MCP (Model Context Protocol) server to provide additional tools for task execution. Use this when you need tools that are not available in existing servers. The server will be automatically added to the project and become available for use.',
        parameters: {
            type: 'object',
            properties: {
                name: {
                    type: 'string',
                    description: 'A descriptive name for the MCP server (e.g., "Database Access Server", "API Integration Server")'
                },
                description: {
                    type: 'string',
                    description: 'Description of what this server provides and why it is needed'
                },
                serverType: {
                    type: 'string',
                    enum: ['e2b', 'http', 'stdio', 'websocket', 'custom'],
                    description: 'Type of MCP server: e2b (sandbox environment), http (REST API), stdio (command-line), websocket (real-time), custom (other)'
                },
                endpoint: {
                    type: 'string',
                    description: 'For http/websocket servers: the endpoint URL. For stdio: the command to execute. Optional for e2b and custom.'
                },
                tools: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'List of tool names this server will provide (e.g., ["query_database", "execute_sql", "get_schema"])'
                },
                reason: {
                    type: 'string',
                    description: 'Explanation of why this server is needed for the current task'
                }
            },
            required: ['name', 'description', 'serverType', 'reason']
        }
    });

    // Construct Prompt with reasoning request
    // NEW: Enhanced prompt that informs agent about tool availability and task requirements
    let toolsInfo = '';
    if (effectiveUseInternet) {
        toolsInfo += '\n🌐 INTERNET ACCESS: You have access to Google Search. Use it to find current information, best practices, documentation, or any real-time data needed for this task.\n';
    }
    if (functionDeclarations.length > 0) {
        toolsInfo += `\n🔧 AVAILABLE TOOLS: You have access to ${functionDeclarations.length} MCP tool(s). Use them when appropriate to complete your task:\n`;
        functionDeclarations.forEach((tool, idx) => {
            toolsInfo += `   ${idx + 1}. ${tool.name}: ${tool.description || 'Available'}\n`;
        });
    }
    if (toolRequirements.needsInternet && effectiveUseInternet) {
        toolsInfo += `\n💡 TASK ANALYSIS: This task has been identified as requiring internet search. You should use Google Search to gather current information.\n`;
    }
    if (toolRequirements.needsFileAccess) {
        toolsInfo += `\n💡 TASK ANALYSIS: This task requires file system access. Use the available file operation tools.\n`;
    }
    if (toolRequirements.needsCommandExecution) {
        toolsInfo += `\n💡 TASK ANALYSIS: This task requires command execution. Use the available command execution tools.\n`;
    }

    // RESEARCH-BASED: Add online research context if internet is enabled
    // This helps agents execute tasks with current best practices and real-world knowledge
    let researchContextSection = '';
    if (effectiveUseInternet && projectContext) {
        // Note: Research is performed in the backend during task execution
        // This section will be populated by the backend with research results
        researchContextSection = `
    
    🌐 ONLINE RESEARCH CONTEXT:
    When internet is enabled, the system automatically researches current best practices, 
    technologies, and implementation approaches for this task. Use this research to inform 
    your execution and ensure you're following industry standards and current best practices.
    If you need additional information, use Google Search to find current documentation, 
    examples, or solutions.`;
    }

    const prompt = `
    ROLE: ${agent.role}
    GOAL: ${agent.goal}
    TASK: ${task.title}
    DESCRIPTION: ${task.description}
    
    PROJECT CONTEXT:
    ${projectContext.substring(0, 5000)}
    
    ARTIFACTS:
    ${artifacts.map(a => `- ${a.title} (${a.type})`).join('\n')}
    
    ${toolsInfo}
    ${researchContextSection}
    
    INSTRUCTIONS:
    Before executing the task, provide your reasoning and approach. Then execute the task.
    
    ${toolsInfo ? 'IMPORTANT: Use the available tools when they can help you complete the task more effectively. Tool access has been automatically enabled based on task requirements.' : ''}
    
    ${effectiveUseInternet ? 'RESEARCH: If internet is enabled, use Google Search to find current best practices, documentation, examples, or solutions that can help you complete this task more effectively.' : ''}
    
    ${functionDeclarations.some(f => f.name === 'create_mcp_server') ? `
    🆕 MCP SERVER CREATION:
    If you need tools that are not available in existing MCP servers, you can create a new server using the create_mcp_server function.
    - Use this when you need specific capabilities (database access, API integration, custom tools, etc.)
    - The server will be automatically added to the project and tools will become available immediately
    - Provide a clear reason for why the server is needed
    - Choose the appropriate server type (e2b for sandbox, http for REST APIs, stdio for commands, etc.)
    ` : ''}
    
    FORMAT YOUR RESPONSE AS FOLLOWS:
    
    <!-- REASONING_START -->
    [Your thinking process, analysis, approach, and decision-making steps for this task]
    <!-- REASONING_END -->
    
    [Your actual task output - code, review, or other deliverables]
    
    If you need to generate code, provide full, working code.
    If you need to review, provide a structured review.
    `;

    // Build tools array - Gemini API requires all function declarations in a single tool object
    // NEW: Agent-based tool selection - include tools if task needs them OR user enabled them
    const tools: any[] = [];

    // Add function declarations as a single tool if:
    // 1. Task analysis says they're needed, OR
    // 2. MCP servers are already active (existing behavior)
    const shouldIncludeMCPTools = needsMCPTools || functionDeclarations.length > 0;
    if (shouldIncludeMCPTools && functionDeclarations.length > 0) {
        tools.push({
            functionDeclarations: functionDeclarations
        });
    }

    // Add Google Search as a separate tool if:
    // 1. Task analysis says it's needed, OR
    // 2. User manually enabled internet
    if (effectiveUseInternet) {
        tools.push({ googleSearch: {} });
    }

    // Log tool selection decision
    if (tools.length > 0) {
        const toolNames = tools.map(t =>
            t.googleSearch ? 'googleSearch' :
                t.functionDeclarations ? `${t.functionDeclarations.length} MCP tool(s)` :
                    'unknown'
        ).join(', ');
        console.log(`[executeAgentTask] Tool selection for "${task.title}": ${toolNames}`);
        console.log(`[executeAgentTask] Tool reasoning: ${toolRequirements.reasoning}`);
    }

    // CRITICAL: Don't send empty tools array - convert to undefined to avoid API errors
    const toolsToSend = tools.length > 0 ? tools : undefined;

    try {
        // SECURITY: Direct API calls from frontend are disabled
        // All AI operations must go through backend API to keep API keys secure
        if (!USE_BACKEND_API) {
            throw new Error('Backend API is required. Direct API calls from frontend are disabled for security. Please ensure the backend server is running.');
        }

        // Call backend API for agent task execution
        // NEW: Pass effective useInternet (includes auto-enabled based on task analysis)
        // NEW: Pass collaboration events collected so far
        const result = await callBackendAPI('/api/llm/execute-task', {
            agent,
            task,
            projectContext,
            artifacts,
            useInternet: effectiveUseInternet, // Use effective value (auto-enabled if needed)
            mcpServers,
            standards,
            modelName,
            prompt,
            tools: toolsToSend,
            functionDeclarations,
            toolRequirements: toolRequirements, // Pass analysis for backend logging
            collaborationEvents: frontendCollaborationEvents // NEW: Send collaboration events to backend
        });

        if (!result.success || !result.data) {
            throw new Error(result.message || 'Backend API failed to execute agent task');
        }

        // Backend handles function calling through LLM router, which supports iterative function calls
        // The backend endpoint /api/llm/execute-task handles all function calling internally
        // Return the result from backend directly
        apiMonitor.logRequest(Date.now() - startTime, false);

        // Extract reasoning from response if available in result data
        const responseData = result.data;
        const fullText = responseData.output || '';

        // Extract reasoning if present in output
        const reasoningMatch = fullText.match(/<!-- REASONING_START -->([\s\S]*?)<!-- REASONING_END -->/);
        const reasoning = reasoningMatch ? reasoningMatch[1].trim() : null;

        // Extract the actual output (everything after reasoning, or full text if no reasoning markers)
        const output = reasoningMatch
            ? fullText.replace(/<!-- REASONING_START -->[\s\S]*?<!-- REASONING_END -->/, '').trim()
            : fullText;

        // NEW: Use collaboration events from backend if available
        // Backend now returns collaboration events including reasoning and evaluation events
        if (responseData.collaboration && Array.isArray(responseData.collaboration)) {
            // Trigger onDialogue for each collaboration event from backend
            responseData.collaboration.forEach((event: DialogueEvent) => {
                if (onDialogue) {
                    onDialogue(event);
                }
            });
        } else {
            // Fallback: Create DialogueEvent for reasoning if backend didn't return it
            if (reasoning && onDialogue) {
                const reasoningEvent: DialogueEvent = {
                    id: Math.random().toString(36).substring(7),
                    sender: agent.role,
                    receiver: agent.role, // Self-reflection
                    message: reasoning,
                    type: 'draft',
                    timestamp: Date.now()
                };
                onDialogue(reasoningEvent);
            }

            // If no reasoning was extracted but we have substantial output, create a reasoning event
            if (!reasoning && output.length > 200 && onDialogue) {
                // Extract first paragraph or first 500 chars as reasoning
                const extractedReasoning = output.split('\n\n')[0] || output.substring(0, 500);
                if (extractedReasoning.length > 100) {
                    const reasoningEvent: DialogueEvent = {
                        id: Math.random().toString(36).substring(7),
                        sender: agent.role,
                        receiver: agent.role,
                        message: `**Approach:** ${extractedReasoning}`,
                        type: 'draft',
                        timestamp: Date.now()
                    };
                    onDialogue(reasoningEvent);
                }
            }
        }

        // Return the result from backend (already formatted)
        // Include collaboration events, created MCP servers, and server IDs that were used
        return {
            ...responseData,
            collaboration: responseData.collaboration || [], // Ensure collaboration array is always present
            createdMCPServers: responseData.createdMCPServers || [], // Agent-created MCP servers
            serverIdsUsed: serverIdsToUse // Servers that were connected/used for this task
        };
    } catch (error) {
        apiMonitor.logRequest(Date.now() - startTime, true);
        throw error;
    }
}

export async function orchestrateNextSteps(
    phase: Phase,
    description: string,
    completedTasks: Task[],
    useInternet: boolean,
    mcpServers: MCPServer[],
    maxTasks: number,
    agents: Agent[]
): Promise<{ tasks: Partial<Task>[] }> {
    // Backend API call (mock removed)

    // Ensure agents is always an array
    const agentsArray = Array.isArray(agents) ? agents : [];

    const prompt = `
    Analyze the current project state and generate a list of tasks for the '${phase}' phase.
    Project Description: ${description}
    Completed Tasks: ${completedTasks.map(t => t.title).join(', ')}
    Max Tasks: ${maxTasks}
    
    Available Agents: ${agentsArray.map(a => a.role).join(', ')}
    `;

    const responseSchema: Schema = {
        type: Type.OBJECT,
        properties: {
            tasks: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        title: { type: Type.STRING },
                        description: { type: Type.STRING },
                        assignedTo: { type: Type.STRING },
                        dependencies: { type: Type.ARRAY, items: { type: Type.STRING } },
                        traceRefs: { type: Type.ARRAY, items: { type: Type.STRING } }
                    },
                    required: ["title", "description", "assignedTo"]
                }
            }
        }
    };

    // SECURITY: Use backend API instead of direct calls
    // E2B_API_KEY is handled server-side via environment variables
    const result = await callBackendAPI('/api/llm/orchestrate', {
        phase,
        description,
        completedTasks,
        useInternet,
        mcpServers,
        maxTasks,
        agents
    });

    if (!result.success || !result.data) {
        // Provide more detailed error message from backend
        const errorMsg = result.message || result.error?.message || 'Backend API failed to orchestrate tasks';
        const error = new Error(errorMsg);
        (error as any).isRetryable = errorMsg.includes('timeout') || errorMsg.includes('rate limit');
        throw error;
    }

    // Parse the JSON response
    const json = typeof result.data === 'string' ? JSON.parse(result.data) : result.data;
    return json;
}

export async function generateProjectPreview(
    userGoal: string,
    conversationHistory: ChatMessage[],
    useInternet: boolean,
    refinementContext?: ProjectPreview | null,
    regenerateSection?: 'wireframe' | 'architecture' | 'all',
    brainstormingData?: any // Added brainstorming data parameter
): Promise<ProjectPreview> {
    // Backend API call (no longer using mock data)

    // Try backend API first
    if (USE_BACKEND_API) {
        try {
            // Use timeout from TIMEOUTS config (callBackendAPI auto-detects for generate-preview endpoint)
            const result = await callBackendAPI('/api/llm/generate-preview', {
                userGoal,
                conversationHistory,
                useInternet,
                refinementContext, // Pass existing context for fast refinement
                regenerateSection,
                brainstormingContext: brainstormingData // Pass brainstorming data to backend
            }); // Timeout auto-detected from TIMEOUTS.preview (360 seconds)
            if (result.success && result.data) {
                // Ensure all required fields are present
                const preview = result.data as ProjectPreview;
                if (!preview.summary || !preview.techStack || !preview.wireframeCode || !preview.architectureDiagram) {
                    const missingFields = [];
                    if (!preview.summary) missingFields.push('summary');
                    if (!preview.techStack) missingFields.push('techStack');
                    if (!preview.wireframeCode) missingFields.push('wireframeCode');
                    if (!preview.architectureDiagram) missingFields.push('architectureDiagram');

                    console.error('Backend returned incomplete preview data. Missing:', missingFields);
                    throw new Error(`Backend returned incomplete preview data. Missing fields: ${missingFields.join(', ')}`);
                }
                return preview;
            } else {
                throw new Error(result.message || 'Backend API returned unsuccessful response');
            }
        } catch (error: any) {
            console.error('Backend API failed:', error);
            // Re-throw with more context if it's not a network error
            if (error.message && !error.message.includes('fetch') && !error.message.includes('network')) {
                throw new Error(`Backend API error: ${error.message}`);
            }
            throw error; // Re-throw network errors as-is
        }
    }

    // Fallback to direct API call
    const startTime = Date.now();

    // Construct context from conversation
    const conversationText = conversationHistory.map(m => `${m.sender}: ${m.text}`).join('\n');

    const prompt = `
    ROLE: Elite Solutions Architect & Creative Technologist.
    
    MISSION: 
    Analyze the user's request and perform two key actions:
    1. **Deep Analysis**: Infer specific domain requirements, user flows, and technical needs based on your knowledge and the provided context.
    2. **Generate Assets**: Create a structured project brief AND a **FULLY FUNCTIONAL** interactive prototype.

    USER GOAL: "${userGoal}"
    
    CONTEXT HISTORY:
    ${conversationText.substring(0, 2000)}
    
    OBJECTIVES & FORMAT:
    
    1. **Executive Summary**: A strategic, professional summary of the project.
    
    2. **Platform & Tech Stack**: 
       - **CRITICAL**: Analyze the conversation to determine the **Target Platforms** (e.g., Web, Mobile, iOS, Android).
       - If **Mobile** is targeted: Recommend React Native or Flutter.
       - If **Web** is targeted: Recommend React, Next.js, etc.
       - Return the stack as a list of strings.
    
    3. **Architecture**: A MermaidJS "C4 Container" diagram code string. 
       - **CRITICAL**: Return ONLY the raw mermaid code string. 
       - **DO NOT** wrap it in markdown code blocks (e.g. no \`\`\`mermaid).
       - Ensure syntax is valid.
    
    4. **Prototype (HTML/JS/Tailwind)**:
       - **CRITICAL**: This must be a single-file, **FULLY PLAYABLE** prototype.
       - **PLATFORM ADAPTATION**:
         - If **Mobile** target: Create a mobile-first UI with bottom navigation, touch interactions, and mobile app layout.
         - If **Web** target: Create a responsive desktop/web dashboard layout.
       - **FUNCTIONALITY**: 
         - Use vanilla JavaScript inside <script> tags.
         - Implement actual logic: navigation tabs must switch views, buttons must trigger alerts or state changes, forms must validate.
         - **GAMES**: Write the COMPLETE game loop in JS (Canvas/DOM). Add controls (Arrow keys/Mouse). It MUST be playable immediately.
         - **AUDIO**: If the project involves music, sound effects, voice, notifications, or any audio features, include:
           - Use HTML5 <audio> elements with controls or programmatic playback via JavaScript Audio API
           - For sound effects, use Web Audio API or Audio() constructor with base64-encoded audio data URLs
           - Include audio files as data URIs (base64 encoded) if small, or use external CDN URLs for larger files
           - Add play/pause controls and volume controls where appropriate
           - For games, include sound effects for actions (clicks, collisions, achievements, etc.)
           - For music apps, include a functional audio player with playlist support
           - For notifications/alerts, use AudioContext or simple beep sounds
       - **THEMING**: Use these CSS variables for the main colors to allow dynamic theming:
         - Primary Background: \`bg-[var(--theme-primary)]\`
         - Text Color: \`text-[var(--theme-primary)]\`
         - Border Color: \`border-[var(--theme-primary)]\`
         - (The app will inject the actual color values).
       - **CONTENT**: Use realistic, domain-specific text and data (e.g., if "Pizza App", show pizzas, not "Item 1").
       - **Output**: Return the RAW HTML string (including <script> and <style>). Do not wrap in markdown.
    
    5. **Risks**: Top 3 technical risks.
    
    6. **Methodology**: Select the best process model:
       - "V-Model" for safety-critical/regulated systems.
       - "Agile" for standard web/SaaS products.
       - "Waterfall" for legacy/hardware projects.
       - "LangGraph" for complex AI agent systems, multi-agent workflows, or cyclic graph-based applications.
    `;

    const responseSchema: Schema = {
        type: Type.OBJECT,
        properties: {
            summary: { type: Type.STRING },
            techStack: { type: Type.ARRAY, items: { type: Type.STRING } },
            wireframeCode: { type: Type.STRING },
            architectureDiagram: { type: Type.STRING },
            risks: { type: Type.ARRAY, items: { type: Type.STRING } },
            recommendedMethodology: { type: Type.STRING, enum: ["V-Model", "Agile", "Waterfall", "LangGraph"] }
        },
        required: ["summary", "techStack", "wireframeCode", "architectureDiagram", "risks", "recommendedMethodology"]
    };

    try {
        const result = await ai.models.generateContent({
            model: 'gemini-3-pro-preview',
            contents: prompt,
            config: {
                // NOTE: googleSearch is DISABLED here because responseSchema is used.
                // The API does not support tools and structured output simultaneously.
                responseMimeType: 'application/json',
                responseSchema: responseSchema
            }
        });

        apiMonitor.logRequest(Date.now() - startTime);

        return JSON.parse(result.text || "{}") as ProjectPreview;
    } catch (e) {
        apiMonitor.logRequest(Date.now() - startTime, true);
        throw e;
    }
}

export async function interrogateAgent(agent: Agent, question: string, history: ChatMessage[], context: string, artifacts: Artifact[], useInternet: boolean): Promise<string> {
    // Construct a rich system context for the agent
    let systemContext = `
    IDENTITY:
    You are ${agent.name}, a world-class ${agent.role}.
    
    YOUR GOAL:
    ${agent.goal}
    
    YOUR BACKSTORY:
    ${agent.backstory}
    
    PROJECT CONTEXT:
    ${context}
    
    AVAILABLE ARTIFACTS:
    ${artifacts.map(a => `- ${a.title}: ${a.summary || 'No summary available'}`).join('\n')}
    
    INSTRUCTIONS:
    - Answer the user's question from the perspective of your role.
    - Use your specific expertise to provide high-quality, actionable advice.
    - Reference the project context and artifacts where relevant.
    - Be professional, concise, and helpful.
    `;

    // Use backend API
    if (USE_BACKEND_API) {
        try {
            const result = await callBackendAPI('/api/llm/chat', {
                message: question,
                history: history,
                agentRole: agent.role,
                systemContext: systemContext,
                useInternet: useInternet,
                // Pass project context implicitly via systemContext, 
                // but also pass projectState for logging/tracking if we had it.
                // Since this function signature doesn't have projectState object, we rely on the context string.
            });

            if (result.success && result.response) {
                return result.response;
            }
        } catch (error) {
            console.error('Agent interrogation via backend failed:', error);
            // Fall through to fallback
        }
    }

    // Fallback if backend fails (only if direct access allowed, otherwise throw)
    console.warn('Backend API failed or disabled, attempting direct generation (NOT RECOMMENDED for production)');

    const prompt = `
    ${systemContext}
    
    USER QUESTION: ${question}
    
    Answer the question based on your role and the project context.
    `;

    const result = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt
    });

    return result.text || "I cannot answer that right now.";
}

export async function enhanceUserPrompt(input: string, useInternet: boolean = false): Promise<string> {
    // Backend API call (mock removed)

    // Use backend API (required for security)
    if (!USE_BACKEND_API) {
        throw new Error('Backend API is required. Direct API calls from frontend are disabled for security. Please ensure the backend server is running.');
    }

    try {
        const result = await callBackendAPI('/api/llm/enhance-prompt', { input, useInternet });
        if (result.success && result.data?.enhanced) {
            return result.data.enhanced;
        }
        throw new Error(result.message || 'Backend API returned unsuccessful response');
    } catch (error: any) {
        console.error('Enhance prompt failed:', error);
        // Re-throw with more context for UI error handling
        const errorMessage = error?.message || 'Failed to enhance prompt';
        throw new Error(errorMessage);
    }
}

export async function performDeepResearch(query: string): Promise<string> {
    // Backend API call (mock removed)

    // Use backend API (required for security)
    if (!USE_BACKEND_API) {
        throw new Error('Backend API is required. Direct API calls from frontend are disabled for security. Please ensure the backend server is running.');
    }

    try {
        const result = await callBackendAPI('/api/llm/deep-research', { query });
        if (result.success && result.data?.research) {
            return result.data.research;
        }
        throw new Error(result.message || 'Backend API returned unsuccessful response');
    } catch (error: any) {
        console.error('Deep research failed:', error);
        // Re-throw with more context for UI error handling
        const errorMessage = error?.message || 'Failed to perform deep research';
        throw new Error(errorMessage);
    }
}

export async function generateEmbedding(text: string): Promise<number[]> {
    // Validate input - return empty array if text is empty or invalid
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
        console.warn('[generateEmbedding] Empty or invalid text provided, returning empty embedding');
        return [];
    }

    // SECURITY: Use backend API instead of direct calls
    const result = await callBackendAPI('/api/llm/generate-embedding', {
        text: text.trim()
    });

    if (!result.success || !result.data) {
        throw new Error(result.error?.message || 'Failed to generate embedding');
    }

    return result.data.embedding || [];
}

export async function modifyTaskWithAI(task: Task, instruction: string): Promise<{ title: string; description: string }> {
    // Backend API call (mock removed)

    const prompt = `
    Original Task Title: ${task.title}
    Original Description: ${task.description}
    
    Instruction: ${instruction}
    
    Update the task title and description based on the instruction.
    `;

    const schema: Schema = {
        type: Type.OBJECT,
        properties: {
            title: { type: Type.STRING },
            description: { type: Type.STRING }
        }
    };

    const result = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
            responseMimeType: 'application/json',
            responseSchema: schema
        }
    });

    return JSON.parse(result.text || "{}");
}

export async function chatWithOrchestrator(message: string, history: ChatMessage[], projectState: ProjectState): Promise<{ text: string, action?: any }> {
    // Backend API call (mock removed)

    // Try backend API first
    if (USE_BACKEND_API) {
        try {
            const result = await callBackendAPI('/api/llm/chat', {
                message,
                history,
                projectState
            });
            if (result.success && result.data) {
                return { text: result.data.text || "I received your message." };
            }
        } catch (error) {
            console.warn('Backend API failed, falling back to direct API:', error);
            // Fall through to direct API call
        }
    }

    // Fallback to direct API call
    const prompt = `
    You are the Project Orchestrator.
    User Message: ${message}
    Project State Summary: Phase ${projectState.currentPhase}, Tasks: ${projectState.tasks.length}
    `;

    const result = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt
    });

    return { text: result.text || "I received your message." };
}

export async function searchProjectKnowledge(query: string, artifacts: Artifact[]): Promise<Artifact[]> {
    // Simple text search for now, replacing with vector search logic if backend supports it
    const lowerQuery = query.toLowerCase();
    return artifacts.filter(a =>
        (a.title && a.title.toLowerCase().includes(lowerQuery)) ||
        (a.content && a.content.toLowerCase().includes(lowerQuery))
    );
}

export async function validateProjectScope(description: string): Promise<string> {
    const result = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Validate this project scope for feasibility and clarity: ${description}`
    });
    return result.text || "Scope validation complete.";
}

// Helper function to convert MCP schema to Gemini format
function convertMCPSchemaToGemini(schema: any): any {
    if (schema.type === 'object') {
        const properties: Record<string, any> = {};
        const required: string[] = schema.required || [];

        if (schema.properties) {
            for (const [key, value] of Object.entries(schema.properties)) {
                properties[key] = convertMCPSchemaToGemini(value as any);
            }
        }

        return {
            type: 'object',
            properties,
            required
        };
    } else if (schema.type === 'array') {
        return {
            type: 'array',
            items: schema.items ? convertMCPSchemaToGemini(schema.items) : { type: 'string' }
        };
    } else {
        return {
            type: schema.type || 'string',
            description: schema.description
        };
    }
}

export async function extractMCPTools(description: string, mcpServers: MCPServer[]): Promise<string[]> {
    return ["mock_tool_1", "mock_tool_2"];
}


export async function generateAgentProfile(role: string, context: string): Promise<Agent> {
    return {
        id: Math.random().toString(36).substring(7),
        name: role.split(' ')[0],
        role: role,
        mode: Mode.DETERMINISTIC,
        avatar: `https://api.dicebear.com/9.x/bottts-neutral/svg?seed=${role}`,
        description: `Specialist ${role}`,
        goal: "Execute tasks",
        backstory: "Mock backstory"
    };
}


export async function generateQuickSuggestions(input: string, history: ChatMessage[]): Promise<{ label: string, prompt: string }[]> {
    // Backend API call (mock removed)

    // Use optimized backend API endpoint for faster response
    try {
        if (!input || input.trim().length < 3) {
            return [];
        }

        const response = await callBackendAPI('/api/llm/quick-suggestions', {
            input: input.trim(),
            history: history.slice(-3) // Only send last 3 messages for context
        });

        // New endpoint returns structured data directly - no parsing needed!
        if (response.success && Array.isArray(response.data)) {
            const filtered = response.data.filter((s: any) => s && s.label && s.prompt);
            if ((import.meta as any).env?.DEV) {
                console.log('[Quick Suggestions] Received', filtered.length, 'suggestions');
            }
            return filtered;
        }

        if ((import.meta as any).env?.DEV) {
            console.warn('[Quick Suggestions] Invalid response format:', response);
        }
        return [];
    } catch (error: any) {
        // Log error details for debugging
        console.error('[Quick Suggestions] Failed to generate suggestions:', error);
        if (error.isConnectionError) {
            console.warn('[Quick Suggestions] Backend connection error - suggestions unavailable');
        }
        return [];
    }
}

export async function generateAppTheme(description: string, projectContext?: string): Promise<any> {
    // Use backend API if available
    if (USE_BACKEND_API) {
        try {
            // Build comprehensive project context from state if available
            const fullContext = projectContext || '';
            const result = await callBackendAPI('/api/llm/generate-theme', {
                description,
                projectContext: fullContext
            });
            if (result.success && result.data) {
                return result.data;
            }
        } catch (error) {
            console.error('Theme generation via backend failed:', error);
            // Fall through to error return
        }
    }

    // Fallback error
    console.error('Theme generation failed - backend API unavailable');
    return {
        id: 'generated-' + Math.random().toString(36).substring(7),
        label: 'AI Generated Theme',
        primary: '#6366f1',
        secondary: '#8b5cf6',
        accent: '#ec4899',
        background: '#f8fafc',
        textColor: '#1e293b',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        graphics: '',
        styles: '',
        wireframeHtml: '',
        themeCss: '',
        assetDescription: ''
    };
}