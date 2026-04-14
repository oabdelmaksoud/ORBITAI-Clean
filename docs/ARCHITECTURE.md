# OrbitAI — Architecture Reference

> Last Updated: April 2026  
> See also: `docs/WALKTHROUGH.md` (detailed implementation notes), `DEPLOYMENT.md` (deployment guide)

---

## 1. High-Level Overview

OrbitAI is a full-stack AI-powered project management and agent orchestration platform built on the MERN stack with multi-LLM support.

```
┌──────────────────────────────────────────────────────┐
│                     Client (React 18)                 │
│  Vite + TypeScript + TailwindCSS + shadcn/ui          │
│  App.tsx → Pages → Components → hooks/services       │
└────────────────────┬─────────────────────────────────┘
                     │  REST + WebSocket (Socket.io)
┌────────────────────▼─────────────────────────────────┐
│                Express API Server (Node.js)           │
│  Routes → Middleware → Services → Models             │
│  JWT Auth · Rate Limiting · Zod Validation           │
└────┬────────────┬──────────────┬──────────────────────┘
     │            │              │
  MongoDB      Redis          Optional Services
  (Mongoose)  (cache/      ┌─ Pipecat (Python, port 8000)
               sessions)   ├─ Neo4j (graph DB)
                            ├─ Weaviate (vector DB)
                            └─ LangGraph (StateGraph)
```

---

## 2. Directory Structure

```
ORBITAI-Clean/
├── client/                   # React frontend
│   ├── src/
│   │   ├── components/       # 280+ UI components
│   │   ├── pages/            # Route-level pages
│   │   ├── hooks/            # Custom React hooks
│   │   ├── services/         # Frontend API clients
│   │   ├── store/            # Zustand state store
│   │   └── i18n/             # Internationalisation (5 locales)
│   └── vite.config.ts
│
├── server/                   # Express backend
│   ├── src/
│   │   ├── config/           # env, database, Redis setup
│   │   ├── middleware/       # auth, error handler, validation
│   │   ├── models/           # Mongoose schemas
│   │   ├── routes/           # Express route handlers
│   │   ├── services/         # Business logic
│   │   │   └── llm/          # LLM router (14 providers)
│   │   ├── types/            # Shared TypeScript types
│   │   ├── utils/            # logger, crypto helpers
│   │   └── validators/       # Zod schemas
│   └── src/__tests__/        # Vitest test suite
│
├── docs/                     # Technical documentation
├── cua-main/                 # Python Computer-Use Agent service
├── docker/                   # Docker Compose configs
├── k8s/                      # Kubernetes manifests
├── .env.example              # All supported environment variables
├── DEPLOYMENT.md             # Deployment guide
└── POLICY.md                 # Compliance & usage policy
```

---

## 3. LLM Router Architecture

The LLM router (`server/src/services/llm/`) supports 14 providers:

| Provider | Identifier |
|---|---|
| OpenAI | `openai` |
| Anthropic | `anthropic` |
| Google Gemini | `gemini` |
| DeepSeek | `deepseek` |
| Grok (xAI) | `grok` |
| Mistral | `mistral` |
| Qwen (Alibaba) | `qwen` |
| OpenRouter | `openrouter` |
| Groq | `groq` |
| Vertex AI | `vertex` |
| Azure OpenAI | `azure` |
| Ollama (local) | `ollama` |
| VLLM (local) | `vllm` |
| OpenAI-Compatible | `openai-compatible` |

Routing pipeline: `TaskAnalyzer` → `RoutingEngine` → provider-specific adapter → `ResponseCache` / `CircuitBreaker`

---

## 4. Key Services

| Service | File | Purpose |
|---|---|---|
| LLM Router | `services/llm/LLMRouter.ts` | Multi-provider AI routing |
| Vector Search | `services/vectorSearch.service.ts` | Semantic document retrieval |
| LangGraph | `services/langgraph.service.ts` | Stateful agent workflows |
| Pipecat Bridge | `services/pipecatBridge.service.ts` | Voice agent session management |
| Deployment Orchestrator | `services/deploymentOrchestrator.service.ts` | Multi-cloud deploy (Vercel, Railway, Render) |
| API Key Provider | `services/apiKeyProvider.service.ts` | DB-backed key retrieval |
| WebSocket | `services/websocket.service.ts` | Real-time collaboration events |
| CUA | `services/cua.service.ts` | Playwright-based computer use agent |

---

## 5. Authentication Flow

```
Client → POST /api/auth/login
       ← JWT (signed with JWT_SECRET, expires in JWT_EXPIRE)

Subsequent requests → Authorization: Bearer <token>
                   → authenticateToken middleware (server/src/middleware/auth.ts)
                   → req.user = { id, email, role }
```

Admin routes additionally require `requireAdmin` middleware which checks `req.user.role === 'admin'`.

---

## 6. Data Models (MongoDB)

Core collections:

| Collection | Model File | Description |
|---|---|---|
| `users` | `User.model.ts` | Authentication & profile |
| `projects` | `Project.model.ts` | Project + agents + tasks |
| `chatconversations` | `ChatConversation.model.ts` | Chat history |
| `voicesessions` | `VoiceSession.model.ts` | Pipecat voice session lifecycle |
| `abtests` | `ABTest.model.ts` | LLM router A/B tests |
| `llmusages` | `LLMUsage.model.ts` | Per-request cost/latency tracking |
| `apikeys` | `ApiKey.model.ts` | Encrypted provider API keys |

---

## 7. Real-Time Communication

- **Socket.io** on the same HTTP server as Express
- Events: project updates, agent status, brainstorming room collaboration
- Voice sessions use a separate WebSocket connection to the Pipecat Python service (port 8000 by default)

---

## 8. Known Architectural Limitations

1. **App.tsx** (~6,700 lines) — god-object component, tracked in issue #28
2. **NeuralStreamChat.tsx** (~7,600 lines) — monolithic chat component, tracked in issue #27
3. **AWS / GCP deployment** — credential checks in place but SDK integration not yet implemented
4. **i18n** — only 36 keys cover the ~280 component UI surface; tracked in issue #36

For full technical debt tracking see `docs/WALKTHROUGH.md §14`.
