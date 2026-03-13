

export enum Phase {
  INITIATION = 'Initiation',
  REQUIREMENTS = 'Requirements',
  ARCHITECTURE = 'Architecture',
  TEST_PLANNING = 'Test Planning',
  IMPLEMENTATION = 'Implementation',
  INTEGRATION = 'Integration',
  SYSTEM_ACCEPTANCE = 'System/Acceptance',
  RELEASE_PREP = 'Release Prep',
  POST_RELEASE = 'Post-Release',
}

// Converted from strict enum to const object to allow dynamic string roles
export const AgentRole = {
  ORCHESTRATOR: 'Orchestrator',
  REQUIREMENTS_AGENT: 'Requirements Agent',
  UX_DESIGNER: 'UI/UX Designer',
  QA_AUDIT_AGENT: 'QA/Audit Agent',
  DESIGN_ARCH_AGENT: 'Design/Architecture Agent',
  TEST_REQ_ENGINEER: 'Test Requirements Engineer',
  IMPLEMENTATION_AGENT: 'Implementation Agent',
  INTEGRATION_AGENT: 'Integration Agent',
  TEST_AGENT: 'Test Agent',
  REMEDIATION_AGENT: 'Remediation/Bug Agent',
  NOTEBOOK_AGENT: 'Notebook Agent',
} as const;

export type AgentRoleType = typeof AgentRole[keyof typeof AgentRole] | string;

// Consolidated Idea interface - single source of truth for brainstorming ideas
export type IdeaCategory =
  | 'feature'
  | 'technology'
  | 'ux'
  | 'data'
  | 'business'
  | 'community'
  | 'platform'
  | 'risk'
  | 'opportunity'
  | 'constraint'
  | 'requirement'
  | 'improvement'
  | 'idea'
  | 'technical'
  | 'market'
  | 'design'
  | 'general'
  | 'other';

export interface Idea {
  id: string;
  label: string;
  title?: string; // Alias for label (some components use title)
  description?: string;
  parentId?: string | null;
  priority?: number; // 1-5 scale
  category?: IdeaCategory;
  notes?: string;
  connections?: string[];
  state?: 'new' | 'developing' | 'refined' | 'merged';
  tags?: string[];
  createdAt?: number;
  updatedAt?: number;
  relevance?: 'high' | 'medium' | 'low' | string;
  researchData?: string; // Enriched context from online research
}

export type Methodology =
  | 'V-Model'
  | 'Agile'
  | 'Waterfall'
  | 'Spiral'
  | 'DevOps'
  | 'Iterative'
  | 'Prototyping'
  | 'RAD'
  | 'Scrum'
  | 'Lean'
  | 'ASD'; // Adaptive Software Development

export enum Mode {
  REASONING = 'Reasoning',
  DETERMINISTIC = 'Deterministic',
}

export enum TaskStatus {
  PENDING = 'Pending',
  IN_PROGRESS = 'In Progress',
  REVIEW = 'Review',
  COMPLETED = 'Completed',
  FAILED = 'Failed', // Requires Remediation
  PAUSED = 'Paused', // Interrupted or Stopped by User
}

export interface Agent {
  id: string;
  name: string;
  role: AgentRoleType;
  mode: Mode;
  avatar: string;
  description: string;
  // CrewAI Specific Attributes
  goal: string;
  backstory: string;
}

export interface NotebookCell {
  id: string;
  type: 'code' | 'markdown' | 'output';
  content: string;
  language?: 'python' | 'javascript' | 'sql';
  executionCount?: number;
  outputs?: Array<{
    type: 'text' | 'image' | 'chart' | 'error' | 'data';
    data: any;
    metadata?: Record<string, any>;
  }>;
}

export interface Artifact {
  id: string;
  title: string;
  content: string; // Markdown or Code, or JSON stringified NotebookCell[] for notebook type
  type: 'requirement' | 'design' | 'code' | 'test-plan' | 'audit-report' | 'defect' | 'build' | 'mcp' | 'image' | 'audio' | 'video' | 'react-native' | 'flutter' | 'ios-swift' | 'android-kotlin' | 'notebook';
  phase: Phase;
  createdBy: AgentRoleType;
  timestamp: number;
  tags: string[];
  traceRefs?: string[]; // Requirement IDs or upstream refs
  embedding?: number[]; // RAG Vector
  notebookCells?: NotebookCell[]; // For notebook type artifacts
}

export interface DialogueEvent {
  id: string;
  sender: AgentRoleType;
  receiver: AgentRoleType;
  message: string;
  type: 'draft' | 'critique' | 'refinement';
  timestamp: number;
}

export interface TokenUsage {
  promptTokens: number;
  candidatesTokens: number;
  totalTokens: number;
}

export interface EvaluationResult {
  score: number; // 0-100
  reasoning: string;
  criteria: string[]; // List of criteria checked
  timestamp: number;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  assignedTo: AgentRoleType;
  phase: Phase;
  status: TaskStatus;
  dependencies: string[]; // Task IDs
  outputArtifactId?: string;
  logs: string[];
  progress: number;
  traceRefs?: string[]; // IDs to link to (e.g. REQ-101)
  resources?: string[]; // URLs/Sources found during execution
  collaboration?: DialogueEvent[]; // AutoGen conversation history
  evaluation?: EvaluationResult; // Genkit Eval Score

  // Cost Estimator (LLM KPIs)
  tokenUsage?: TokenUsage;
  modelUsed?: string;
  cost?: number; // Estimated API cost in USD
  sprint?: number; // Agile Sprint Tracking

  // Timing & Estimation
  startTime?: number;
  endTime?: number;
  estimatedDuration?: number; // milliseconds
}

export interface LogEntry {
  id: string;
  timestamp: number;
  agent: AgentRoleType;
  message: string;
  type: 'info' | 'action' | 'error' | 'success' | 'warning';
}

export interface MCPServer {
  id: string;
  name: string;
  description: string;
  status: 'active' | 'inactive';
  tools: string[]; // List of tool names provided by this server
  source: 'system' | 'user' | 'agent'; // System = Default, User = Created by User, Agent = Created by Agent
  inUse?: boolean; // True when server is currently connected and being used for a task
  lastUsed?: number; // Timestamp of last usage
}

export interface QualityStandard {
  id: string;
  name: string;
  description: string;
}

export interface ProjectBudget {
  total: number;
  used: number; // Total Cost Incurred
  currency: string;
  totalTokens: number;
  lastUpdated: number;
}

// User Subscription Types
export type PlanTier = 'Starter' | 'Pro' | 'Enterprise';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatar: string;
  plan: PlanTier;
  subscriptionStatus: 'active' | 'past_due' | 'canceled';
  memberSince: number;
  role?: 'admin' | 'user' | 'editor' | 'superadmin' | 'guest'; // User role for permissions
  token?: string;
  selectedTheme?: string;
  theme?: string;
}

export interface ProjectFolder {
  id: string;
  userId: string;
  name: string;
  description?: string;
  platforms?: ('web' | 'android' | 'ios' | 'desktop' | 'api' | 'other')[];
  metadata?: Record<string, any>;
  conversationIds: string[];
  createdAt: number;
  updatedAt: number;
}

export interface ProjectState {
  id: string; // Unique Project ID
  name: string;
  description: string;
  created: number;
  lastModified: number;
  folderId?: string; // Workspace Folder ID
  userId?: string; // User ID who owns this project
  status?: 'draft' | 'in-progress' | 'completed' | 'deployed'; // Project completion status
  completedAt?: number; // Timestamp when project was completed

  currentPhase: Phase;
  currentSprint: number; // Agile Sprint Counter
  methodology: Methodology; // New: SDLC Type
  estimatedSprints?: number; // Estimated total sprints based on project analysis
  agents: Agent[];
  tasks: Task[];
  artifacts: Artifact[];
  logs: LogEntry[];
  isProcessing: boolean;
  useInternet: boolean; // Controls Google Search Grounding
  selectedStandards: string[]; // IDs of selected Quality Standards
  mcpServers: MCPServer[]; // Virtual registry of MCP servers
  budget: ProjectBudget; // Cost Estimator
  selectedTheme?: string; // Selected theme ID for the project

  techStack: string[]; // Tech stack used in the project

  // Sharing tokens for project collaboration
  shareTokens?: Array<{
    token: string;
    createdAt: number;
    expiresAt?: number;
    permissions: 'read' | 'write' | 'admin';
  }>;

  // Wizard metadata for project creation flow
  wizardMetadata?: {
    step?: number;
    completed?: boolean;
    data?: Record<string, any>;
    templateId?: string;
    templateName?: string;
    projectPreview?: any;
    selectedTemplate?: any;
    customizations?: Record<string, any>;
    conversationId?: string;
    selectedPath?: string;
    customThemes?: any[];
    selectedTheme?: string;
    uploadedFiles?: any[];
  };

  // Architecture requirements (from agent analysis)
  architecture?: {
    needsBackend?: boolean;
    needsAdminPanel?: boolean;
    needsMobileApp?: boolean;
    backendType?: 'REST' | 'GraphQL' | 'gRPC' | 'Microservices' | 'Serverless';
    adminPanelType?: 'Web Dashboard' | 'Mobile App' | 'Desktop App' | 'CLI Tool';
    mobileAppType?: 'react-native' | 'flutter' | 'native-ios' | 'native-android';
    reasoning?: string;
    confidence?: number;
    recommendations?: {
      mobileApp?: {
        framework?: 'react-native' | 'flutter' | 'native-ios' | 'native-android';
        platform?: 'ios' | 'android' | 'both';
        reasoning?: string;
      };
    };
  };
}

export interface ProjectTemplate {
  id: string;
  name: string;
  description: string;
  category?: string;
  methodology?: Methodology; // Optional - will be auto-determined if not provided
  estimatedSprints?: number; // Optional - will be auto-determined if not provided
  agents: Agent[];
  selectedStandards?: string[]; // Optional - will be auto-determined if not provided
  mcpServers: MCPServer[];
  budget: ProjectBudget;
  createdAt: number;
  tags?: string[];
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'agent' | 'system';
  text: string;
  timestamp: number;
  agentId?: string; // Optional: to link message to a specific agent avatar
  isLogEvent?: boolean; // If true, this is an automated system event/log, not a direct chat message
  mindmapText?: string; // AI-optimized version for mindmapping (project-relevant content only)
  attachments?: Array<{
    name: string;
    type: string;
    content: string; // Base64 data URL for images, text content for text files
  }>;
}

export interface AppSettings {
  executionSpeed: 'slow' | 'normal' | 'fast';
  maxRetries: number;
  autoScrollLogs: boolean;
  maxTasksPerPhase: number;
  maxParallelTasks: number;
  enableHumanInTheLoop: boolean;
}

// --- Chat Command Types ---
export interface OrchestratorAction {
  type: 'CREATE_TASK' | 'CHANGE_PHASE' | 'RUN_BATCH' | 'NONE';
  payload?: any;
  reasoning?: string;
}

export interface OrchestratorResponse {
  text: string;
  userImpactSummary?: string; // New field to track impact
  action?: OrchestratorAction;
  resources?: string[];
}

// Feature Coverage Report for tracking brainstormed idea implementation
export interface FeatureCoverage {
  totalFeatures: number;
  coveredFeatures: number;
  coveragePercentage: number;
  features: Array<{
    featureId: string;
    featureLabel: string;
    covered: boolean;
    confidence: number;
    matchedKeywords: string[];
    parentId?: string | null; // For hierarchical display
  }>;
  generatedAt: number;
}

export interface ProjectPreview {
  // Core fields from Service
  id?: string; // Optional ID for tracking updates
  summary: string;
  techStack: string[];
  wireframeCode: string;
  architectureDiagram?: string;
  risks: string[];
  recommendedMethodology?: Methodology | string;
  recommendedStandards?: string[];
  estimatedSprints?: number;
  projectName?: string;
  featureCoverage?: FeatureCoverage; // Coverage report for brainstormed features
  mobileCode?: {
    reactNative?: string;
    flutter?: string;
    iosSwift?: string;
    androidKotlin?: string;
  };

  // UI Extension fields (Optional to handle backend mismatch)
  appName?: string; // Can fallback to projectName
  tagline?: string;
  features?: string[];
  colors?: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    text: string;
  };
  estimatedEffort?: string;

  // Extended Architecture Fields
  backendArchitecture?: any;
  adminConsole?: any;
  infrastructure?: any;
  securityArchitecture?: any;
  databaseArchitecture?: any;
  apiDesign?: any;

  // Game Mechanics Generation
  gameMechanics?: {
    mechanicsId: string;
    engine: 'unity' | 'godot' | 'phaser';
    files: Array<{
      filename: string;
      content: string;
      language: string;
    }>;
    setupInstructions: string;
    mechanics: {
      movement?: boolean;
      combat?: boolean;
      ai?: boolean;
      progression?: {
        xp?: boolean;
        inventory?: boolean;
        quests?: boolean;
      };
    };
  };

  // NEW: Multi-view preview structure
  // Provides End User and Admin Console views with wireframe variants
  views?: {
    endUser?: {
      preview: string;      // Full interactive HTML for end-user preview
      wireframe?: string;   // Low-fidelity wireframe HTML (grayscale, annotations)
    };
    adminConsole?: {
      preview: string;      // Full interactive HTML for admin console
      wireframe?: string;   // Low-fidelity wireframe HTML
    };
  };
}

// ==================== GAME ASSET GENERATION TYPES ====================

export interface GameAsset {
  id: string;
  projectId: string;
  userId: string;
  assetType: '2D' | '3D';
  category: 'character' | 'prop' | 'environment' | 'ui';
  prompt: string;
  fileUrl: string;
  thumbnailUrl?: string;
  format: 'GLB' | 'PNG' | 'FBX' | 'GLTF' | 'JPG' | 'SVG';
  status: 'generating' | 'ready' | 'failed';
  metadata: Asset3DMetadata | Asset2DMetadata;
  provider?: 'tripo' | 'flux' | 'sloyd' | 'other';
  createdAt: number;
  updatedAt: number;
}

export interface Asset3DMetadata {
  polyCount?: number;
  vertexCount?: number;
  triangleCount?: number;
  fileSize: number;
  textures?: string[];
  animations?: string[];
  dimensions?: {
    width: number;
    height: number;
    depth: number;
  };
}

export interface Asset2DMetadata {
  width: number;
  height: number;
  fileSize: number;
  hasTransparency?: boolean;
  colorDepth?: number;
}

export interface AssetGenerationJob {
  id: string;
  projectId: string;
  userId: string;
  gameType: '2D' | '3D';
  genre: string;
  theme: string;
  assetList: Array<{
    type: '2D' | '3D';
    category: 'character' | 'prop' | 'environment' | 'ui';
    description: string;
    priority?: number;
  }>;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  totalAssets: number;
  completedAssets: number;
  failedAssets: number;
  results: string[];  // Asset IDs
  errorLog: Array<{
    asset: string;
    error: string;
    timestamp: number;
  }>;
  startedAt?: number;
  completedAt?: number;
  estimatedTimeRemaining?: number;
}

export interface GenerateAssetsRequest {
  projectId: string;
  gameType: '2D' | '3D';
  genre: string;
  theme: string;
  assetList?: Array<{
    type: '2D' | '3D';
    category: 'character' | 'prop' | 'environment' | 'ui';
    description: string;
  }>;
}
