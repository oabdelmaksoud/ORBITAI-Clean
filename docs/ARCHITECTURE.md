# OrbitAI Architecture

> High-level architecture reference. For a full deep-dive see [docs/WALKTHROUGH.md](WALKTHROUGH.md).

---

## System Overview

OrbitAI is a full-stack MERN application that combines an AI-powered project generation platform with a multi-agent orchestration engine. The platform takes users from initial idea through automated code generation, testing, and cloud deployment.

```
┌─────────────────────────────────────────────────────────┐
│                    Client (React/Vite)                   │
│  Views: Landing · Setup Wizard · Workspace · Admin       │
│  State: Context API + useReducer + localStorage          │
└────────────────────────┬────────────────────────────────┘
                         │ HTTPS / WebSocket
┌────────────────────────▼────────────────────────────────┐
│                  Server (Node.js/Express)                 │
│  Routes (136+) → Services (196+) → Models (70+)          │
│  LLM Router · Agent Engine · MCP Protocol               │
└──────┬──────────────────────────────────────┬───────────┘
       │                                      │
┌──────▼──────┐  ┌──────────────┐  ┌─────────▼──────────┐
│  MongoDB    │  │  Redis       │  │  External Services  │
│  Mongoose   │  │  Caching /   │  │  OpenAI / Gemini /  │
│  70+ models │  │  BullMQ      │  │  Anthropic / …      │
└─────────────┘  └──────────────┘  └────────────────────┘
```

---

## Repository Layout

```
ORBITAI-Clean/
├── client/                 # React 18 + TypeScript frontend (Vite)
│   └── src/
│       ├── components/     # 220+ UI components
│       ├── views/          # Top-level page views
│       ├── services/       # API client helpers
│       ├── contexts/       # React Context providers
│       ├── hooks/          # Custom React hooks
│       └── i18n/           # Internationalisation strings
│
├── server/                 # Node.js + Express backend
│   └── src/
│       ├── routes/         # 136+ Express route files
│       ├── services/       # 196+ business-logic services
│       ├── models/         # 70+ Mongoose schemas
│       ├── middleware/      # Auth, rate-limiting, error handling
│       └── config/         # Environment + feature-flag config
│
├── shared/                 # Types & utilities shared by client + server
├── cua-main/               # Python Computer Use Agent (CUA) service
├── docker/                 # Docker Compose files for local + production
├── docs/                   # This documentation folder
└── scripts/                # Utility and seed scripts
```

---

## Frontend Architecture

The frontend is a single-page application built with React 18, TypeScript, and Vite.

### Key Views

| View | Route | Purpose |
|------|-------|---------|
| Landing | `/` | Marketing page and entry point |
| Setup Wizard | `/wizard` | Multi-step project creation flow |
| Workspace | `/workspace/:id` | Full IDE-like development environment |
| Admin Console | `/admin` | LLM router, system config, monitoring |

### State Management

- **Local component state** — `useState` / `useReducer` for UI-only state.
- **Shared context** — `React.createContext` for auth, theme, and workspace state.
- **Persistence** — Critical user preferences are backed up to `localStorage`.

---

## Backend Architecture

The backend is a Node.js Express server with a layered architecture:

```
HTTP Request → Route Handler → Service Layer → Model (Mongoose) → MongoDB
```

### LLM Router

The LLM Router is a central component that intelligently distributes AI workloads:

1. **End-user Router** — selects the cheapest or fastest model for a given task category.
2. **Internal Router** — used by backend services (LangChain, LangGraph, agents) to auto-select a model.
3. **A/B Test Engine** — persists test configurations and metrics in MongoDB (`ABTest` collection).

### Agent Engine

The multi-agent system is built on top of LangGraph and CrewAI:

- Agents are stored as sub-documents inside `Project` records.
- Agent collaboration, conflict resolution, and knowledge sharing are handled by dedicated services.
- The MCP (Model Context Protocol) layer allows agents to call external tools via a JSON-RPC interface.

### WebSocket Layer

Real-time features (chat streaming, agent status, live preview) are delivered over WebSockets managed by `websocket.service.ts` and `voiceWebSocket.service.ts`.

---

## Data Flow

### Project Creation Flow

```
User Input (Wizard)
  → POST /api/projects
  → projectFile.service.ts (creates MongoDB document)
  → backgroundPrototypeGeneration.service.ts (queued job)
  → codeGenerator.service.ts (LLM-powered code generation)
  → WebSocket push to client (live progress)
```

### LLM Request Flow

```
Service calls internalTaskRouter.routeTask(...)
  → Selects provider based on tier / cost / health
  → Calls provider service (gemini.service.ts / openai / etc.)
  → Records LLMUsage document
  → Returns response to caller
```

---

## Security Architecture

- **Authentication** — JWT tokens (short-lived) + refresh token rotation stored in HttpOnly cookies.
- **Authorisation** — Role-based middleware (`requireAdmin`, `checkFeatureAccess`) on protected routes.
- **API Keys** — User-supplied LLM keys are encrypted at rest using `apiKeyEncryption.service.ts`.
- **Rate Limiting** — Per-IP and per-user rate limits enforced via Redis.
- **CORS** — Restricted to the `CLIENT_URL` origin.
- **Helmet** — HTTP security headers applied globally.

---

## Deployment Topology

See [DEPLOYMENT.md](../DEPLOYMENT.md) for full deployment instructions.

```
Internet → Nginx (reverse proxy + SSL termination)
             ├── /           → React static files (served by Nginx)
             ├── /api        → Node.js Express server (port 3001)
             └── /ws         → WebSocket upgrade (same Express server)

Supporting services:
  MongoDB   (port 27017)
  Redis     (port 6379)
  Pipecat   (port 8000, optional Python voice service)
  Neo4j     (port 7687, optional graph database)
  Weaviate  (port 8080, optional vector database)
```

---

## Architecture Decision Records

| Decision | Rationale |
|----------|-----------|
| Express over NestJS | Faster iteration; team familiarity |
| Mongoose over raw MongoDB driver | Schema validation; easier model evolution |
| LangGraph for agent workflows | Stateful graph execution; built-in streaming |
| Redis for caching and queues | Shared state across processes; BullMQ integration |
| Vite over CRA | Faster HMR; better tree-shaking |
| Tailwind CSS | Utility-first; consistent design system without a heavy component library |
