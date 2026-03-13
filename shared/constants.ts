

import { Agent, AgentRole, Mode, Phase, MCPServer, QualityStandard } from './types.js';

export const AGENT_NAMES_POOL = [
  "Raed", "Nour", "Karim", "Salma", "Tarek", "Layla", "Omar", "Dina", "Youssef", "Farah",
  "Sherif", "Mariam", "Khaled", "Haya", "Ziad", "Yasmin", "Hassan", "Malak", "Maged", "Jana",
  "Seif", "Rania", "Hazem", "Zein", "Adam", "Sohaila", "Amr", "Nada", "Fares", "Amina",
  "Mostafa", "Hala", "Ezz", "Shahd", "Hesham", "Noha", "Sameh", "Basma", "Wael", "Menna",
  "Mahmoud", "Esraa", "Ibrahim", "Donia", "Ahmed", "Salwa", "Aly", "Engy", "Hossam", "Reem"
];

export const UNIVERSAL_AGENT_WISDOM: Record<string, string[]> = {
  [AgentRole.ORCHESTRATOR]: [
    "Always prioritize critical path tasks first.",
    "Break large features into vertical slices to ensure deliverability.",
    "If a phase has > 5 tasks, group them into batches for efficiency.",
    "Explicitly check dependencies before scheduling execution."
  ],
  [AgentRole.REQUIREMENTS_AGENT]: [
    "Ambiguity is the enemy. Define 'done' criteria explicitly.",
    "Always consider edge cases (empty states, error states, max load).",
    "Map every requirement to a user value or business goal.",
    "Use 'SHALL', 'MUST', and 'SHOULD' correctly (RFC 2119)."
  ],
  [AgentRole.DESIGN_ARCH_AGENT]: [
    "Favor composition over inheritance.",
    "Ensure data flow is unidirectional where possible.",
    "Design for failure: Assume services will timeout or crash.",
    "Keep interfaces small and focused (Interface Segregation Principle)."
  ],
  [AgentRole.IMPLEMENTATION_AGENT]: [
    "Write self-documenting code; variable names should explain the 'what'.",
    "Handle errors gracefully; never swallow exceptions without logging.",
    "Keep functions small and pure where possible.",
    "Sanitize all inputs at the boundary."
  ],
  [AgentRole.QA_AUDIT_AGENT]: [
    "Trust nothing. Verify everything.",
    "Test boundaries: 0, 1, -1, max_int, null, undefined.",
    "Security is not a feature, it's a baseline.",
    "Look for race conditions in async logic."
  ],
  [AgentRole.UX_DESIGNER]: [
    "Consistency breeds familiarity. Reuse patterns.",
    "Feedback must be immediate (< 100ms).",
    "Accessibility (a11y) is mandatory, not optional.",
    "Mobile-first thinking ensures core constraints are met."
  ],
  [AgentRole.NOTEBOOK_AGENT]: [
    "Always document your analysis with clear markdown explanations.",
    "Visualize data before drawing conclusions.",
    "Use reproducible code that others can understand and run.",
    "Combine code, analysis, and visualizations in a narrative flow."
  ]
};

export const AGENTS: Agent[] = [
  {
    id: 'a1',
    name: 'Raed',
    role: AgentRole.ORCHESTRATOR,
    mode: Mode.REASONING,
    avatar: 'https://api.dicebear.com/9.x/bottts-neutral/svg?seed=Raed&backgroundColor=transparent',
    description: 'Distinguished Program Director with 20+ years driving digital transformation.',
    goal: 'Orchestrate high-stakes technical initiatives with military precision, focusing on critical path analysis and risk mitigation.',
    backstory: 'A veteran of Silicon Valley giants who has led multi-million dollar projects from inception to IPO. Acts as the "Sherpa" for the team, guiding them through treacherous technical terrain with calm, strategic authority.'
  },
  {
    id: 'a2',
    name: 'Nour',
    role: AgentRole.REQUIREMENTS_AGENT,
    mode: Mode.REASONING,
    avatar: 'https://api.dicebear.com/9.x/bottts-neutral/svg?seed=Nour&backgroundColor=transparent',
    description: 'Elite Requirements Architect & Domain Expert with 18+ years bridging business and tech.',
    goal: 'Distill abstract visions into mathematically precise, unambiguous specifications that leave no room for misinterpretation.',
    backstory: 'Started as a kernel developer before moving to systems analysis. Treats requirements as the project\'s constitution. Can spot a logical fallacy or scope creep from a mile away and refuses to proceed until the "What" is perfectly defined.'
  },
  {
    id: 'a10',
    name: 'Karim',
    role: AgentRole.UX_DESIGNER,
    mode: Mode.REASONING,
    avatar: 'https://api.dicebear.com/9.x/bottts-neutral/svg?seed=Karim&backgroundColor=transparent',
    description: 'Visionary Product Design Lead with 15+ years shaping human-computer interaction.',
    goal: 'Craft interfaces that feel inevitable. Design systems that scale effortlessly across platforms while maximizing accessibility and user delight.',
    backstory: 'Designs have won multiple Apple Design Awards. Doesn\'t just design screens; choreographs user emotions. Believes a pixel out of place is a breach of user trust and fights for the user at every decision point.'
  },
  {
    id: 'a3',
    name: 'Sherif',
    role: AgentRole.QA_AUDIT_AGENT,
    mode: Mode.REASONING,
    avatar: 'https://api.dicebear.com/9.x/bottts-neutral/svg?seed=Sherif&backgroundColor=transparent',
    description: 'CISO-level Security Strategist & Compliance Expert (Former White-hat Hacker).',
    goal: 'Zero-trust verification. Ensure absolute compliance with global standards (ISO/GDPR/HIPAA) and impenetrability of the system.',
    backstory: 'Sees systems not as features, but as attack surfaces. Spent a decade breaking into banks (legally) before helping build them. If they sign off on a release, it is bulletproof.'
  },
  {
    id: 'a4',
    name: 'Tarek',
    role: AgentRole.DESIGN_ARCH_AGENT,
    mode: Mode.REASONING,
    avatar: 'https://api.dicebear.com/9.x/bottts-neutral/svg?seed=Tarek&backgroundColor=transparent',
    description: 'Distinguished System Architect with 20+ years designing hyper-scale distributed systems.',
    goal: 'Architect resilient, cloud-native solutions that survive the test of time, massive traffic spikes, and infrastructure failures.',
    backstory: 'Author of seminal books on microservices and event-driven architecture. Codes in their sleep and dreams in UML. Builds digital cathedrals of logic, ensuring every component is loosely coupled but highly cohesive.'
  },
  {
    id: 'a5',
    name: 'Salma',
    role: AgentRole.TEST_REQ_ENGINEER,
    mode: Mode.REASONING,
    avatar: 'https://api.dicebear.com/9.x/bottts-neutral/svg?seed=Salma&backgroundColor=transparent',
    description: 'Principal QA Strategist specializing in Chaos Engineering and TDD.',
    goal: 'Engineer comprehensive test matrices that cover 100% of functional edge cases, boundary conditions, and failure modes.',
    backstory: 'Obsessed with entropy. Predicts how a system will break before it is even built. Treats testing as a scientific discipline, utilizing statistical models to ensure six-sigma quality.'
  },
  {
    id: 'a6',
    name: 'Omar',
    role: AgentRole.IMPLEMENTATION_AGENT,
    mode: Mode.DETERMINISTIC,
    avatar: 'https://api.dicebear.com/9.x/bottts-neutral/svg?seed=Omar&backgroundColor=transparent',
    description: 'Principal Staff Engineer (Polyglot). 15+ years shipping production-grade kernels and engines.',
    goal: 'Write code that is elegant, efficient, self-documenting, and performant. The "10x" engineer\'s mentor.',
    backstory: 'A legendary figure in open source communities. Solves the "impossible" bugs. Code reads like poetry and runs like a finely tuned Ferrari engine. Refuses to write "spaghetti code" even under pressure.'
  },
  {
    id: 'a7',
    name: 'Dina',
    role: AgentRole.INTEGRATION_AGENT,
    mode: Mode.DETERMINISTIC,
    avatar: 'https://api.dicebear.com/9.x/bottts-neutral/svg?seed=Dina&backgroundColor=transparent',
    description: 'Director of DevOps & Site Reliability Engineering (SRE). 15+ years in CI/CD automation.',
    goal: 'Create a deployment pipeline so smooth it feels like magic. Zero-downtime releases, automated rollback, and immutable infrastructure.',
    backstory: 'Managed infrastructure for high-frequency trading platforms where milliseconds meant millions. Believes manual deployment is a crime. Automates themselves out of every job to focus on higher-order reliability problems.'
  },
  {
    id: 'a8',
    name: 'Ziad',
    role: AgentRole.TEST_AGENT,
    mode: Mode.DETERMINISTIC,
    avatar: 'https://api.dicebear.com/9.x/bottts-neutral/svg?seed=Ziad&backgroundColor=transparent',
    description: 'Lead SDET (Software Development Engineer in Test). Expert in automated frameworks.',
    goal: 'Execute rigorous, automated regression suites that catch regressions instantly. Maintain 100% test reliability.',
    backstory: 'A machine learning enthusiast who applies AI to testing. Doesn\'t just run tests; builds robots that run tests. The unwavering guardian of system stability, known for the "break it to make it" philosophy.'
  },
  {
    id: 'a9',
    name: 'Youssef',
    role: AgentRole.REMEDIATION_AGENT,
    mode: Mode.REASONING,
    avatar: 'https://api.dicebear.com/9.x/bottts-neutral/svg?seed=Youssef&backgroundColor=transparent',
    description: 'Principal Sustaining Engineer. The "Wolf" you call when everything is on fire.',
    goal: 'Surgical debugging. Identify root causes in seconds and patch live systems without downtime or side effects.',
    backstory: 'Spent 15 years in critical systems support for emergency services. Has fixed database corruptions at 3 AM with millions of users online. Thrives in the red zone where others panic.'
  },
  {
    id: 'a11',
    name: 'Maya',
    role: AgentRole.NOTEBOOK_AGENT,
    mode: Mode.REASONING,
    avatar: 'https://api.dicebear.com/9.x/bottts-neutral/svg?seed=Maya&backgroundColor=transparent',
    description: 'Data Scientist & Research Analyst with expertise in Python, statistical analysis, and data visualization.',
    goal: 'Transform raw data into actionable insights through interactive analysis, visualization, and comprehensive documentation.',
    backstory: 'A data scientist with a passion for making complex data accessible. Specializes in creating interactive notebooks that combine code, analysis, and visualizations. Believes that the best insights come from combining rigorous analysis with clear communication. Expert in pandas, numpy, matplotlib, and plotly.'
  },
];

export const QUALITY_STANDARDS: QualityStandard[] = [
  // Automotive & Functional Safety
  { id: 'aspice', name: 'ASPICE', description: 'Automotive SPICE - Process Assessment Model for automotive software development' },
  { id: 'iso26262', name: 'ISO 26262', description: 'Functional Safety for road vehicles - Automotive safety standard' },
  { id: 'iec61508', name: 'IEC 61508', description: 'Functional Safety of Electrical/Electronic/Programmable Electronic Safety Systems' },

  // Aerospace & Aviation
  { id: 'do178c', name: 'DO-178C', description: 'Software Considerations in Airborne Systems and Equipment Certification' },
  { id: 'do254', name: 'DO-254', description: 'Design Assurance Guidance for Airborne Electronic Hardware' },
  { id: 'arp4754a', name: 'ARP 4754A', description: 'Guidelines for Development of Civil Aircraft and Systems' },

  // Railway
  { id: 'en50128', name: 'EN 50128', description: 'Railway applications - Software for railway control and protection systems' },
  { id: 'iec62279', name: 'IEC 62279', description: 'Railway applications - Communication, signalling and processing systems' },

  // Healthcare & Medical Devices
  { id: 'iec62304', name: 'IEC 62304', description: 'Medical Device Software Life Cycle Processes' },
  { id: 'hipaa', name: 'HIPAA', description: 'Health Insurance Portability and Accountability Act - Healthcare data protection' },
  { id: 'fda21cfr', name: 'FDA 21 CFR Part 820', description: 'Quality System Regulation for Medical Devices' },
  { id: 'iso13485', name: 'ISO 13485', description: 'Medical Devices - Quality Management Systems' },

  // Web Application Security & Accessibility
  { id: 'owasp', name: 'OWASP Top 10', description: 'OWASP Top 10 - Web Application Security Risks' },
  { id: 'wcag', name: 'WCAG 2.1', description: 'Web Content Accessibility Guidelines 2.1 - Accessibility standards' },
  { id: 'iso27001', name: 'ISO 27001', description: 'Information Security Management Systems' },
  { id: 'nist', name: 'NIST Cybersecurity Framework', description: 'Framework for Improving Critical Infrastructure Cybersecurity' },

  // Data Protection & Privacy
  { id: 'gdpr', name: 'GDPR', description: 'General Data Protection Regulation - EU data privacy law' },
  { id: 'ccpa', name: 'CCPA', description: 'California Consumer Privacy Act - Data privacy regulation' },
  { id: 'pipeda', name: 'PIPEDA', description: 'Personal Information Protection and Electronic Documents Act - Canada' },

  // Financial & Payment Processing
  { id: 'pci-dss', name: 'PCI-DSS', description: 'Payment Card Industry Data Security Standard' },
  { id: 'sox', name: 'SOX', description: 'Sarbanes-Oxley Act - Financial reporting compliance' },
  { id: 'basel', name: 'Basel III', description: 'International banking regulations for risk management' },

  // Cloud & SaaS
  { id: 'soc2', name: 'SOC 2', description: 'Service Organization Control 2 - Trust service criteria for cloud services' },
  { id: 'iso20000', name: 'ISO 20000', description: 'IT Service Management Systems' },

  // Software Development Lifecycle
  { id: 'iso12207', name: 'ISO/IEC 12207', description: 'Software Life Cycle Processes - Software development lifecycle standard' },
  { id: 'iso29119', name: 'ISO/IEC 29119', description: 'Software Testing - Testing standards and processes' },
  { id: 'ieee830', name: 'IEEE 830', description: 'IEEE 830 - Software Requirements Specifications' },
  { id: 'iso25010', name: 'ISO/IEC 25010', description: 'Systems and Software Quality Models' },

  // Project Management
  { id: 'iso21500', name: 'ISO 21500', description: 'Guidance on Project Management' },
  { id: 'iso10006', name: 'ISO 10006', description: 'Quality Management in Projects' },
  { id: 'pmbok', name: 'PMBOK Guide', description: 'Project Management Body of Knowledge - PMI standard' },

  // Process Improvement
  { id: 'cmmi', name: 'CMMI', description: 'Capability Maturity Model Integration - Process improvement framework' },
  { id: 'iso9001', name: 'ISO 9001', description: 'Quality Management Systems' },

  // Nuclear & Energy
  { id: 'iec61513', name: 'IEC 61513', description: 'Nuclear Power Plants - Instrumentation and control systems' },

  // General Software Quality
  { id: 'iso9126', name: 'ISO/IEC 9126', description: 'Software Product Quality - Quality characteristics and metrics' },
  { id: 'ieee1012', name: 'IEEE 1012', description: 'Software Verification and Validation' },
  { id: 'ieee1028', name: 'IEEE 1028', description: 'Software Reviews and Audits' }
];

export const PROJECT_THEMES = [
  { id: 'modern', label: 'Modern SaaS', primary: '#3b82f6', background: '#ffffff' },
  { id: 'dark', label: 'Dark Vibe', primary: '#0f172a', background: '#1e293b' },
  { id: 'ocean', label: 'Oceanic', primary: '#0ea5e9', background: '#f0f9ff' },
  { id: 'sunset', label: 'Sunset', primary: '#f97316', background: '#fff7ed' },
  { id: 'forest', label: 'Forest', primary: '#10b981', background: '#f0fdf4' },
  { id: 'cyber', label: 'Cyberpunk', primary: '#d946ef', background: '#2a0a2e' },
];

// Epic Theme Presets for AI Generator
export const EPIC_THEME_PRESETS = [
  // Space & Cosmic
  { id: 'space', label: '🌌 Space', description: 'Deep space with stars, nebulas, and cosmic gradients' },
  { id: 'aurora', label: '🌠 Aurora', description: 'Northern lights with flowing greens and magentas' },
  { id: 'galaxy', label: '🌌 Galaxy', description: 'Spiral galaxy with purples, blues, and star clusters' },

  // Seasonal
  { id: 'christmas', label: '🎄 Christmas', description: 'Festive reds, greens, golds with snowflakes and holly' },
  { id: 'winter', label: '❄️ Winter', description: 'Cool blues, whites, and silvers with frosty textures' },
  { id: 'beach', label: '🏖️ Beach', description: 'Tropical blues, sandy beiges, and sunny yellows' },
  { id: 'autumn', label: '🍂 Autumn', description: 'Warm oranges, browns, and deep reds with fall leaves' },
  { id: 'spring', label: '🌸 Spring', description: 'Pastel pinks, greens, and soft florals' },

  // Nature
  { id: 'ocean-deep', label: '🌊 Ocean Deep', description: 'Deep blues and teals with wave patterns' },
  { id: 'forest-mystical', label: '🌲 Mystical Forest', description: 'Dark greens and purples with magical glows' },
  { id: 'desert', label: '🏜️ Desert', description: 'Warm beiges, terracotta, and sun-baked textures' },
  { id: 'tropical', label: '🌺 Tropical', description: 'Bright yellows, greens, and vibrant florals' },
  { id: 'arctic', label: '🧊 Arctic', description: 'Cool blues and whites with ice and snowflake patterns' },

  // Aesthetic
  { id: 'cyberpunk-neon', label: '💜 Cyberpunk Neon', description: 'Electric purples, blues, and neon grid patterns' },
  { id: 'retro-80s', label: '📼 Retro 80s', description: 'Vibrant neons, geometric patterns, and bold typography' },
  { id: 'minimalist', label: '⚪ Minimalist', description: 'Clean whites, subtle grays, and lots of whitespace' },
  { id: 'vintage', label: '📻 Vintage', description: 'Sepia browns, creams, and nostalgic textures' },
  { id: 'futuristic', label: '🚀 Futuristic', description: 'Metallic silvers, electric blues, and holographic effects' },

  // Creative
  { id: 'volcanic', label: '🌋 Volcanic', description: 'Deep reds and oranges with lava-like gradients' },
  { id: 'midnight', label: '🌙 Midnight Sky', description: 'Deep purples with constellation patterns' },
  { id: 'coral-reef', label: '🐠 Coral Reef', description: 'Tropical pinks and aquas with underwater textures' },
  { id: 'art-deco', label: '✨ Art Deco', description: 'Geometric patterns, gold accents, and elegant contrasts' },
  { id: 'victorian', label: '🏛️ Victorian', description: 'Elegant burgundies, golds, and ornate borders' },
];

export const PHASE_ORDER = [
  Phase.INITIATION,
  Phase.REQUIREMENTS,
  Phase.ARCHITECTURE,
  Phase.TEST_PLANNING,
  Phase.IMPLEMENTATION,
  Phase.INTEGRATION,
  Phase.SYSTEM_ACCEPTANCE,
  Phase.RELEASE_PREP,
  Phase.POST_RELEASE,
];

// Phase descriptions for V-Model SDLC workflow
export const PHASE_DESCRIPTIONS: Record<Phase, { title: string; description: string; icon: string; color: string }> = {
  [Phase.INITIATION]: {
    title: 'Initiation',
    description: 'Define project scope, objectives, and initial requirements. Stakeholders align on vision and success criteria.',
    icon: '🚀',
    color: '#3b82f6' // blue
  },
  [Phase.REQUIREMENTS]: {
    title: 'Requirements',
    description: 'Gather and document detailed functional and non-functional requirements. Create user stories and acceptance criteria.',
    icon: '📋',
    color: '#8b5cf6' // purple
  },
  [Phase.ARCHITECTURE]: {
    title: 'Architecture',
    description: 'Design system architecture, database schemas, API contracts, and technical stack. Create high-level and low-level designs.',
    icon: '🏗️',
    color: '#06b6d4' // cyan
  },
  [Phase.TEST_PLANNING]: {
    title: 'Test Planning',
    description: 'Define test strategy, create test cases, and establish quality gates. Plan for unit, integration, and system testing.',
    icon: '🧪',
    color: '#f59e0b' // amber
  },
  [Phase.IMPLEMENTATION]: {
    title: 'Implementation',
    description: 'Develop features, write code, and build components. Execute unit tests and code reviews.',
    icon: '💻',
    color: '#10b981' // green
  },
  [Phase.INTEGRATION]: {
    title: 'Integration',
    description: 'Integrate components, run integration tests, and validate system interfaces. Ensure all parts work together.',
    icon: '🔗',
    color: '#ef4444' // red
  },
  [Phase.SYSTEM_ACCEPTANCE]: {
    title: 'System/Acceptance',
    description: 'Conduct system testing and user acceptance testing (UAT). Validate against requirements and user expectations.',
    icon: '✅',
    color: '#22c55e' // emerald
  },
  [Phase.RELEASE_PREP]: {
    title: 'Release Prep',
    description: 'Prepare deployment artifacts, documentation, and release notes. Final quality checks and go-live readiness.',
    icon: '📦',
    color: '#a855f7' // violet
  },
  [Phase.POST_RELEASE]: {
    title: 'Post-Release',
    description: 'Monitor production, gather feedback, and address issues. Plan iterations and continuous improvement.',
    icon: '🔄',
    color: '#64748b' // slate
  }
};

export const INITIAL_PROJECT_NAME = "Untitled Project";
export const INITIAL_PROJECT_DESC = "Please initialize a project scope to begin.";
export const INITIAL_BUDGET = 50.00; // $50.00 default budget

// Global quick actions for chat interface
export const GLOBAL_QUICK_ACTIONS: Array<{ label: string; prompt: string }> = [
  { label: "Stop & Reflect", prompt: "Pause all execution. Reflect on the current state and list any risks or issues." },
  { label: "Generate Report", prompt: "Generate a comprehensive status report for the current phase." },
  { label: "Clear Context", prompt: "Reset your immediate context window (but keep project memories)." },
  { label: "Run Health Check", prompt: "Analyze all artifacts for consistency and quality." }
];

// SECURITY: E2B API key should NEVER be exposed to frontend code
// This constant has been removed for security. E2B_API_KEY should only be used on the backend
// via environment variables. Frontend should never have access to this key.

export const DEFAULT_MCP_SERVERS: MCPServer[] = [
  {
    id: 'mcp-sys-1',
    name: 'E2B Sandbox',
    description: 'Secure Linux environment for code execution & file management',
    status: 'active',
    tools: ['write_file', 'read_file', 'list_directory', 'run_shell_command'],
    source: 'system'
  },
  {
    id: 'mcp-sys-2',
    name: 'Knowledge Graph',
    description: 'RAG-based Semantic Memory System',
    status: 'active',
    tools: ['recall_context', 'vector_search'],
    source: 'system'
  },
  {
    id: 'mcp-sys-3',
    name: 'Google Search',
    description: 'Live Web Index & Connectivity',
    status: 'active',
    tools: ['google_search'],
    source: 'system'
  }
];

// Gemini Rate Limits
export const MODEL_LIMITS: Record<string, { rpm: number, tpm: number, rpd: number }> = {
  'gemini-3-pro-preview': { rpm: 2, tpm: 32000, rpd: 50 },
  'gemini-3-pro': { rpm: 2, tpm: 32000, rpd: 50 },
  'gemini-2.5-pro': { rpm: 2, tpm: 32000, rpd: 50 },
  'gemini-2.5-flash': { rpm: 15, tpm: 1000000, rpd: 1500 },
  'gemini-2.5-flash-image': { rpm: 15, tpm: 500000, rpd: 1500 },
  'gemini-2.5-flash-preview-image': { rpm: 15, tpm: 500000, rpd: 1500 },
  'gemini-2.5-flash-preview-tts': { rpm: 10, tpm: 10000, rpd: 100 },
  'gemini-2.5-flash-tts': { rpm: 10, tpm: 10000, rpd: 100 },
  'veo-3.1-generate-preview': { rpm: 2, tpm: 10000, rpd: 50 }
};

// Cost per 1 million tokens
export const MODEL_PRICING: Record<string, { input: number, output: number }> = {
  'gemini-3-pro-preview': { input: 3.50, output: 10.50 },
  'gemini-3-pro': { input: 3.50, output: 10.50 },
  'gemini-2.5-pro': { input: 1.25, output: 3.75 },
  'gemini-2.5-flash': { input: 0.075, output: 0.30 },
  'gemini-2.5-flash-thinking': { input: 0.075, output: 0.30 },

  // Media Models
  'gemini-2.5-flash-image': { input: 0.075, output: 0.30 },
  'gemini-3-pro-image-preview': { input: 3.50, output: 10.50 },
  'gemini-2.5-flash-preview-tts': { input: 0.075, output: 0.30 },
  'veo-3.1-generate-preview': { input: 3.50, output: 10.50 },

  'unknown': { input: 0.10, output: 0.10 }
};