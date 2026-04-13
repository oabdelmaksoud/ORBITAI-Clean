# ORBIT Project-Start Framework

When a project starts in ORBITAI, a rich multi-layer framework fires automatically. This document details every layer in full.

---

## Summary Flow

```
User submits project name + description
         │
         ▼
  SDLC Auto-Config  ──→  Methodology + Sprint Estimate
         │
         ▼
  Standards Matching  ──→  Up to 8 compliance standards
         │
         ▼
  Architecture Analysis  ──→  Backend / Admin Panel / Mobile needs
         │
         ▼
  Scope Detection  ──→  mvp / simple / standard / full
         │
         ▼
  Project saved to DB (Phase: Initiation, Sprint: 1)
         │
         ▼
  Agent Discovery  ──→  Knowledge profiles created / updated
         │
         ▼
  Architecture Tasks auto-created (if needed)
         │
         ▼
  11-agent team ready to execute across 9 SDLC phases
```

---

## Layer 1 — SDLC Auto-Configuration

**Service:** `server/src/services/sdlcMatching.service.ts`  
**Triggered by:** Project creation (`POST /api/projects`)

The very first thing that runs is automatic SDLC methodology selection via `SDLCMatchingService.autoConfigureSDLC()`.

### Metadata Extraction

The service parses the project name, description, and optional fields (industry, complexity, team size, timeline, requirements list) and extracts the following automatically from natural language:

| Extracted Field | Examples |
|---|---|
| **Project type** | web-app, mobile-app, API, embedded, desktop, cloud, game |
| **Industry** | automotive, healthcare, finance, aerospace, railway, nuclear, retail, education, government |
| **Complexity** | simple / moderate / complex (inferred from text length, keywords, feature count) |
| **Team size** | extracted from description or inferred from description length |
| **Timeline** | extracted from phrases like "deliver in 3 months" |
| **Requirements count** | counted from sentences, bullet points, feature keywords |

### Methodology Scoring

11 methodologies are scored using a **multi-factor model**:

| Methodology | Best For | Typical Sprints |
|---|---|---|
| **V-Model** | Safety-critical systems (automotive, aerospace, medical) | 7 |
| **Agile** | Web apps, SaaS, startups with flexible requirements | 7 |
| **Scrum** | Structured Agile teams with fixed-length sprint cycles | 7 |
| **Waterfall** | Fixed requirements, government projects, legacy systems | 4 |
| **Spiral** | High-risk, complex projects with uncertain requirements | 5 |
| **DevOps** | Cloud-native, CI/CD, microservices architectures | 5 |
| **Iterative** | Large, evolving enterprise projects | 6 |
| **RAD** | Time-sensitive, well-understood requirements | 3 |
| **Prototyping** | Unclear requirements, POC/validation | 3 |
| **Lean** | Startups, MVP development, waste elimination | 6 |
| **ASD** | Highly uncertain, rapidly changing requirements | 7 |

**Scoring factors per methodology:**

- Industry overlap: 0–25 points
- Project type overlap: 0–25 points
- Keyword match: 0–20 points
- Standards match: 0–15 points
- Priority boost: 0, +10, or +20 points
- Requirements stability / flexibility modifier: ±10 points
- Project size factor: ±8 points
- Complexity factor: ±7 points

The highest-scoring methodology is auto-applied to the project. Sprint estimates are then calculated using AI-powered analysis (industry average: 6.8 sprints, default fallback: 7).

---

## Layer 2 — Standards Auto-Enrollment

**Service:** `server/src/services/standardsMatching.service.ts`  
**Triggered by:** Project creation and project description updates

Immediately after methodology selection, Orbit auto-enrolls **up to 8 quality/compliance standards** using vector search + semantic matching.

### Supported Standards Library

| Domain | Standards |
|---|---|
| **Automotive / Functional Safety** | ISO 26262, ASPICE, IEC 61508 |
| **Aerospace / Aviation** | DO-178C, DO-254, ARP 4754A |
| **Railway** | EN 50128, IEC 62279 |
| **Healthcare / Medical Devices** | IEC 62304, HIPAA, FDA 21 CFR Part 820, ISO 13485 |
| **Web Security / Accessibility** | OWASP Top 10, WCAG 2.1, ISO 27001, NIST Cybersecurity Framework |
| **Data Privacy** | GDPR, CCPA, PIPEDA |
| **Financial / Payment** | PCI-DSS, SOX, Basel III |
| **Cloud / SaaS** | SOC 2, ISO 20000 |
| **Software Lifecycle** | ISO/IEC 12207, ISO/IEC 29119, IEEE 830, ISO/IEC 25010 |
| **Project Management** | ISO 21500, ISO 10006, PMBOK |
| **Process Improvement** | CMMI, ISO 9001 |
| **Nuclear / Energy** | IEC 61513 |
| **General Software Quality** | ISO/IEC 9126, IEEE 1012, IEEE 1028 |

Standards are indexed in a vector database and matched via semantic similarity + keyword scoring. Required, recommended, and optional standards are ranked and merged with any user-provided standards (no duplicates). The `maxStandards` cap is 8.

---

## Layer 3 — Architecture Analysis

**Service:** `server/src/services/projectArchitectureAnalyzer.service.ts`  
**Triggered by:** Project creation

Orbit uses the **LLM Router** to analyze the project description and determine its architectural needs.

### Detected Features

| Feature | Description |
|---|---|
| `dataStorage` | Project requires a database or persistent storage |
| `userManagement` | Users / accounts / profiles are needed |
| `authentication` | Login, OAuth, JWT, or session management |
| `apiEndpoints` | Exposes or consumes REST/GraphQL APIs |
| `realTimeFeatures` | WebSockets, live updates, notifications |
| `fileUploads` | File or media upload handling |
| `reporting` | Reports, dashboards, data exports |
| `analytics` | Usage tracking, analytics events |
| `contentManagement` | CMS, pages, rich text content |
| `ecommerce` | Shopping cart, payments, inventory |
| `multiTenancy` | Multiple organizations or tenants |
| `mobileAccess` | Mobile-responsive or native mobile access needed |
| `offlineSupport` | Offline-first or PWA functionality |
| `pushNotifications` | Mobile or browser push notifications |

### Output Decisions

| Decision | Action Triggered |
|---|---|
| `needsBackend: true` | Backend API tasks are auto-created in the project |
| `needsAdminPanel: true` | Admin dashboard tasks are auto-created |
| `needsMobileApp: true` | Mobile app tasks are auto-created |

### Recommendations Generated

- **Backend:** framework, database, authentication strategy, deployment target
- **Admin panel:** framework + features list
- **Mobile app:** framework (React Native / Flutter / native iOS / native Android), platform (iOS / Android / both)

A confidence score (0–1) is attached to every analysis result.

---

## Layer 4 — Scope Detection

**Service:** `server/src/services/scopeDetection.service.ts`  
**Stored on:** `Project.projectScope`, `Project.scopeAutoDetected`, `Project.scopeDetectionReasoning`

Orbit assigns a **project scope level** to prevent over-engineering, driven by keyword patterns in the project description.

| Scope | Trigger Keywords | Feature Count Range |
|---|---|---|
| **`mvp`** | "mvp", "proof of concept", "poc", "bare bones", "simplest possible" | 1–5 |
| **`simple`** | "simple", "basic", "hobby", "side project", "for fun", "beginner" | 3–8 |
| **`standard`** | "production", "startup", "launch", "customers", "professional", "business" | 8–20 |
| **`full`** | "enterprise", "scalable", "multi-tenant", "millions of users", "high availability", "24/7" | 20+ |

The scope is auto-detected from text (`scopeAutoDetected: true`) and can be manually overridden by the user (`scopeAutoDetected: false`).

---

## Layer 5 — Agent Discovery

**Service:** `server/src/services/agentDiscovery.service.ts`  
**Triggered by:** After project is saved

After the project is created, Orbit automatically runs **agent discovery** to:

1. Extract all agent definitions referenced in the project
2. Create or update **AgentKnowledge profiles** in the database for each discovered agent role
3. Knowledge profiles are **reusable across all projects for all users**
4. If new agent information is available (description, goal, backstory), the profile is updated

---

## Layer 6 — Architecture Task Auto-Creation

**Triggered by:** `architecture.needsBackend === true` or `architecture.needsAdminPanel === true`

If the architecture analysis flags that a backend or admin panel is needed, **tasks are automatically injected** into the project so the AI agent team has structured work items to begin executing immediately.

---

## Layer 7 — The 9-Phase SDLC Pipeline

Every project, regardless of the chosen methodology, is structured around **9 ordered phases**:

```
Initiation → Requirements → Architecture → Test Planning →
Implementation → Integration → System/Acceptance → Release Prep → Post-Release
```

All projects start at **Phase: Initiation** on **Sprint: 1**.

| Phase | Description | Icon |
|---|---|---|
| **Initiation** | Define scope, objectives, and initial requirements. Align stakeholders on vision and success criteria. | 🚀 |
| **Requirements** | Gather and document functional and non-functional requirements. Create user stories and acceptance criteria. | 📋 |
| **Architecture** | Design system architecture, database schemas, API contracts, and technical stack. | 🏗️ |
| **Test Planning** | Define test strategy, create test cases, and establish quality gates. | 🧪 |
| **Implementation** | Develop features, write code, build components. Execute unit tests and code reviews. | 💻 |
| **Integration** | Integrate components, run integration tests, validate system interfaces. | 🔗 |
| **System/Acceptance** | Conduct system testing and UAT. Validate against requirements and user expectations. | ✅ |
| **Release Prep** | Prepare deployment artifacts, documentation, and release notes. Final quality checks. | 📦 |
| **Post-Release** | Monitor production, gather feedback, address issues. Plan iterations and continuous improvement. | 🔄 |

---

## Layer 8 — The AI Agent Team

Every project has a pre-defined team of **11 AI agents**, each with a rich persona, role, mode, goal, and backstory.

| Agent | Role | Mode | Description |
|---|---|---|---|
| **Raed** | Orchestrator | Reasoning | Distinguished Program Director with 20+ years driving digital transformation. |
| **Nour** | Requirements Agent | Reasoning | Elite Requirements Architect & Domain Expert with 18+ years bridging business and tech. |
| **Karim** | UI/UX Designer | Reasoning | Visionary Product Design Lead with 15+ years shaping human-computer interaction. |
| **Sherif** | QA/Audit Agent | Reasoning | CISO-level Security Strategist & Compliance Expert (Former White-hat Hacker). |
| **Tarek** | Design/Architecture Agent | Reasoning | Distinguished System Architect with 20+ years designing hyper-scale distributed systems. |
| **Salma** | Test Requirements Engineer | Reasoning | Principal QA Strategist specializing in Chaos Engineering and TDD. |
| **Omar** | Implementation Agent | Deterministic | Principal Staff Engineer (Polyglot). 15+ years shipping production-grade kernels and engines. |
| **Dina** | Integration Agent | Deterministic | Director of DevOps & SRE. 15+ years in CI/CD automation. |
| **Ziad** | Test Agent | Deterministic | Lead SDET. Expert in automated test frameworks and ML-driven testing. |
| **Youssef** | Remediation/Bug Agent | Reasoning | Principal Sustaining Engineer. Surgical debugger for live production systems. |
| **Maya** | Notebook Agent | Reasoning | Data Scientist & Research Analyst. Specializes in interactive analysis and data visualization. |

Each agent carries **UNIVERSAL_AGENT_WISDOM** — hard-coded best-practice rules baked into their decision-making (e.g., "Ambiguity is the enemy. Define 'done' criteria explicitly." — Requirements Agent).

**Agent modes:**

- **Reasoning** — Agent thinks through problems step by step before acting (used for planning, analysis, design, QA)
- **Deterministic** — Agent executes with precision and predictability (used for coding, integration, testing)

---

## Layer 9 — Supporting Infrastructure

When a project runs, these additional services power the agent execution:

| Service | File | Purpose |
|---|---|---|
| **LangGraph** | `langgraph.service.ts` | Stateful graph-based agent orchestration using `@langchain/langgraph`. Supports conditional edges and state machines. |
| **WorkflowEngine** | `workflowEngine.service.ts` | BPMN-inspired workflow execution with start → task → gateway → end node types. |
| **Background AutoPilot** | `backgroundAutoPilotService.ts` | Continues AI execution even when the browser is closed. Auto-stops after 15 minutes to protect budget. |
| **LLM Router** | `llm/LLMRouter.ts` | Routes tasks to the best available LLM (GPT-4o, Gemini, etc.) based on task type, cost, and performance. |
| **MCP Servers** | `mcp.service.ts` | Three default servers: E2B Sandbox (code execution), Knowledge Graph (RAG/vector memory), Google Search (live web). |

### Default MCP Servers

| Server | Tools |
|---|---|
| **E2B Sandbox** | `write_file`, `read_file`, `list_directory`, `run_shell_command` |
| **Knowledge Graph** | `recall_context`, `vector_search` |
| **Google Search** | `google_search` |

---

## Data Model Reference

Key fields stored on the `Project` document at creation:

```typescript
{
  userId: string,
  name: string,
  description: string,
  currentPhase: 'Initiation',         // Always starts here
  currentSprint: 1,                    // Always starts at sprint 1
  methodology: Methodology,            // Auto-assigned
  estimatedSprints: number,            // AI-estimated
  projectScope: 'mvp' | 'simple' | 'standard' | 'full',
  scopeAutoDetected: boolean,
  scopeDetectionReasoning: string,
  selectedStandards: string[],         // Up to 8 auto-enrolled IDs
  architecture: {
    needsBackend: boolean,
    needsAdminPanel: boolean,
    needsMobileApp: boolean,
    backendType: 'REST' | 'GraphQL' | 'gRPC' | 'Microservices' | 'Serverless',
    adminPanelType: 'Web Dashboard' | 'Mobile App' | 'Desktop App' | 'CLI Tool',
    mobileAppType: 'react-native' | 'flutter' | 'native-ios' | 'native-android',
    confidence: number,                // 0–1
    detectedFeatures: { ... },
    recommendations: { ... }
  },
  agents: Agent[],
  tasks: Task[],
  status: 'draft',
  budget: { cap: 1000, spent: 0 }
}
```
