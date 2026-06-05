# OrbitAI — Internal Agent Harness: Architecture & Wiring Map

> **What this document is.** A wiring map of the agent-runtime ("harness") embedded in the OrbitAI backend (`server/src`). It traces the *live request path*, marks every component as **wired / shallow / dead**, and isolates the disconnects — because the disconnects are the real story. Evidence is cited as `file:line`. (For the project-level architecture, see `ARCHITECTURE.md`; this doc is narrower and harness-specific.)
>
> **Coverage boundary.** This covers the LLM router, the function-call loop, MCP, sub-agent/orchestration code, computer-use, CLI delegation, guardrails, state, eval, and observability. It does **not** deeply trace the Pipecat/voice agent surface (`server/pipecat-service/`) or the client-side agent UI beyond where it hands off to the backend.

---

## Verdict (answering "is OrbitAI a harness?")

OrbitAI is an **agentic product** — "The Autonomous Software Architect" — that **embeds the *scaffolding* of an agent harness**, some of it genuinely wired, much of it aspirational or disconnected.

- **Genuinely wired & working:** a rules-based weighted **model router** across 12 providers; a **multi-turn function-call loop** (reachable via `/api/llm/chat`); a real **MCP client** (stdio/SSE/HTTP/WS); an **LLM-as-judge eval rubric**; **Codex-CLI delegation**; and **cost/usage telemetry**.
- **Built but off the call path:** the entire "AI/ML routing" stack (RL bandit, predictive, auto-tune, A/B, cost-opt), the whole **multi-agent orchestration cluster** (collaboration/conflict/health/rollback), the **CUA vision loop**, and the fallback-chain machinery — all have **zero reachable callers** or are gated out in steady state.
- **Broken on the main agent path:** the primary route `/api/llm/execute-task` **hardcodes `tools = []`** and ignores the tool schemas the client sends, so on that route the model is never given tool declarations.

So: **not a harness as a *category*** (it isn't a reusable runtime like Claude Code or LangGraph), and **not yet a fully-wired harness *internally*** — it's a product carrying a broad but partially-connected harness skeleton. See `HARNESS_COMPLETENESS_SCORECARD.md` for per-dimension scoring.

---

## The live request path (what actually runs)

```
                          ┌─────────────────────────── CLIENT ───────────────────────────┐
                          │ geminiService.ts:533-620 builds REAL tool schemas             │
                          │   (MCP→Gemini convert :567-577 + create_mcp_server :585-620)  │
                          │ sends them to /execute-task  (geminiService.ts:748-760)        │
                          └───────────────┬───────────────────────────────┬───────────────┘
                                          │                               │
                       POST /api/llm/chat │                               │ POST /api/llm/execute-task
              (forwards context.tools     │                               │ ⚠ DROPS tools — hardcodes
               llmChat.routes.ts:48,109)  │                               │   `tools = []` (llm.routes.ts:447)
                                          ▼                               ▼
                          ┌───────────────────────────────────────────────────────────────┐
                          │                LLMRouter.executeWithFallback                    │
                          │                (LLMRouter.ts:125)                               │
                          │  1. TaskAnalyzer.analyzeTask  (keyword heuristics, TA.ts:49)    │
                          │  2. RoutingEngine.selectModel (RE.ts:85)  ◀── THE real decider  │
                          │       rules + weighted cost/latency/quality score (RE.ts:665)   │
                          │  3. ResponseCache.get  (SHA-256 key, ResponseCache.ts:47-62)    │
                          │  4. retry loop (LLMRouter.ts:251) → executeWithProvider (:254)  │
                          └───────────────┬───────────────────────────────────────────────┘
                                          ▼
                          ┌───────────────────────────────────────────────────────────────┐
                          │  executeWithProvider (LLMRouter.ts:579)                         │
                          │   • provider circuit breaker (CircuitBreaker.ts:196) — used     │
                          │   • ~470-line if/else dispatch → provider singleton             │
                          │     (Gemini / OpenAI / Anthropic / …12 providers)               │
                          │   • OpenAI may delegate to Codex CLI (OpenAIService.ts:54)       │
                          └───────────────┬───────────────────────────────────────────────┘
                                          ▼
                          ┌───────────────────────────────────────────────────────────────┐
                          │  normalize → cost calc → ResponseCache.set                      │
                          │  UsageTracker.trackUsage (UsageTracker.ts:60, fire-and-forget)  │
                          │     ├─ RL reward update      (UsageTracker.ts:86)               │
                          │     └─ knowledge learning    (UsageTracker.ts:114)              │
                          └───────────────┬───────────────────────────────────────────────┘
                                          ▼ (only if response has functionCalls)
                          ┌───────────────────────────────────────────────────────────────┐
                          │  FunctionCallProcessor.processWithFunctionCalls (FCP.ts:56)     │
                          │   while functionCalls && iteration < 5   (FCP.ts:50,76)         │
                          │     for each call (SEQUENTIAL, FCP.ts:82):                       │
                          │       google_search → mcpService.callTool('mcp-sys-3') (FCP:89) │
                          │       else          → agentFunctionHandler (FCP:100)            │
                          │                        └ only create_mcp_server implemented      │
                          │     results → STRINGIFIED into a prompt (FCP.ts:176-196)        │
                          │     re-call model (continueConversation, FCP.ts:201)            │
                          └───────────────────────────────────────────────────────────────┘
```

**Reading the path:**
- The **router is the strongest link** — `RoutingEngine.computeModelScore` (`RoutingEngine.ts:665`) is a genuine, configurable weighted scorer over cost/latency/quality with context-aware boosts. This is what actually picks the model.
- The **loop mechanics are real** but its *fuel* is thin: native function-calling works only for **Gemini** (`gemini.service.ts:252-288`); OpenAI/Anthropic/DeepSeek/Grok fall back to a **regex hardcoded to one function name**, `create_mcp_server` (`FunctionCallProcessor.ts:351,367`), and the default economy model has `functionCalling: false` (`ModelRegistry.ts:76`). Anthropic never even forwards `tools` to its SDK (`AnthropicService.ts:58-69`).
- The **executable tool surface of the loop is two functions**: `create_mcp_server` (`agentFunctionHandler.service.ts:35-50`) and `google_search` (`FunctionCallProcessor.ts:87`).
- Tool results are passed back as a **stringified prompt** (`FunctionCallProcessor.ts:176-196`), not native tool-result message parts — so provider-side tool/call linkage and history are lost.

---

## Component map (by layer, with wired/shallow/dead status)

### 1. Model & provider layer — *mostly wired, abstraction is messy*
| Component | Status | Notes |
|---|---|---|
| `LLMRouter` (`LLMRouter.ts:125`) | **Wired** | Public entry; analyze→select→cache→dispatch→track. |
| `RoutingEngine` rules + weighted scoring (`RoutingEngine.ts:665`) | **Wired (solid)** | The real decision-maker. Configurable weights, schedule-gated rules, subscription gating. |
| 12 providers (`providers/`) | **Wired** | No shared base class/interface; unified by a 470-line `if/else` + duck-typing. Each re-declares its own `LLMResponse`/`LLMConfig`. |
| Streaming | **Shallow** | Real only for Gemini + OpenAI; all 10 others degrade to a single chunk (`LLMRouter.ts:526-538`). |
| `CircuitBreaker` (provider-keyed) (`CircuitBreaker.ts:196`) | **Wired** | Proper CLOSED/OPEN/HALF_OPEN; used in hot path. |
| `ResponseCache` (`ResponseCache.ts:47-62`) | **Wired (shallow)** | In-memory only (per-process), 24h TTL, SHA-256 key; semantic `findSimilar` never called. |
| `UsageTracker` → `LLMUsage` (`UsageTracker.ts:60`) | **Wired (solid)** | Per-call tokens/cost persisted, well-indexed; drives RL reward + knowledge cron. |

### 2. Tool & protocol layer — *MCP client real, integration broken*
| Component | Status | Notes |
|---|---|---|
| Function-call loop (`FunctionCallProcessor.ts:56`) | **Wired (via `/chat`)** | Multi-turn ≤5; sequential; string-concat results. Starved on `/execute-task`. |
| MCP **client** (`mcp.service.ts:858-915, 1032-1087`) | **Wired (genuine)** | Official SDK; stdio + SSE/HTTP + WebSocket; connect/list/call/close + health checks. |
| MCP **server** (OrbitAI exposing itself) | **Absent** | No `@modelcontextprotocol/sdk/server` anywhere. |
| "System MCP servers" (`mcp.service.ts:582-602`) | **Misnomer** | `mcp-sys-1/2/3` are direct calls to E2B / vector search / Google Search — not MCP. |
| `agentMCPServerCreator` (`agentMCPServerCreator.ts:34-92`) | **CRUD** | "Creating a server" = a Mongo insert; nothing is spawned or code-generated. |
| `dynamicToolingService` (`dynamicTooling.service.ts:80`) | **Orphan** | Parallel catalog; never imported by the loop; runtime `createDynamicTool` unreachable. |

### 3. Sub-agent / orchestration layer — *catalog + telemetry; no execution engine*
| Component | Status | Notes |
|---|---|---|
| `CustomAgent` (`CustomAgent.model.ts:3-30`) | **CRUD catalog** | Config rows (role/goal/systemPrompt/tools); **never loaded to run**. |
| `/api/agent/execute` (`agent.routes.ts:15-68`) | **Stub** | No-op; returns "use /api/gemini/execute-task". |
| `intelligentAgentAssignment` (`aiAgentAssignment.routes.ts:281`) | **Wired (real)** | LLM picks needed roles, reuses/creates a catalog row — *provisioning*, not coordination. |
| `agentKnowledgeLearning` cron (`index.ts:407` → `agentKnowledgeAggregator.ts:106-163`) | **Wired (real)** | Genuinely updates skill/proficiency running-averages from completed tasks. |
| `AgentKnowledge` (`AgentKnowledge.model.ts:3-67`) | **Shallow** | Plain key-store (not RAG); **never retrieved into an agent's prompt at runtime**. |
| `brainstormingAgent` (`brainstormingAgent.service.ts`) | **Shallow** | One-shot LLM call per phase + a hardcoded phase switch; `tools:[]`; ignores its own stored systemPrompt; persists mock ideas on error (`:204-267`). |

### 4. Execution surfaces & ops — *Codex real; CUA is a prototype tester; guardrails thin*
| Component | Status | Notes |
|---|---|---|
| `CodexCLIService` (`CodexCLIService.ts:122`) | **Wired (real)** | Spawns `codex` binary, gated by `USE_CODEX_CLI`; routed via OpenAI provider. ⚠ no timeout/kill (`:120-137`). |
| Claude CLI delegation | **Absent** | No equivalent exists in `server/src`. |
| CUA (`cua.service.ts:1261-1690`) | **Wired (real, but not "computer use")** | Playwright prototype-tester: DOM→AI scenarios→actions→LLM HTML auto-fix→retry. Uses Gemini directly (bypasses router). |
| Guardrails | **Shallow** | JWT auth + IP rate-limit + feature flags. **No spend cap, no HITL/approval, no tool allowlist.** Guest tokens bypass verification (`auth.ts:38-46`). |
| Eval (`evaluation.service.ts:22-209`) | **Wired (shallow)** | Real LLM-as-judge rubric in autopilot/task paths; but self-grades with Gemini, fails open to score 70 (`:201-208`). |
| State / resumability | **Persisted, not resumable** | State in Mongo, but execution loops are in-memory (`backgroundAutoPilotService.ts:104`); no checkpoint/resume after crash. |
| Observability | **Shallow** | Structured winston logs + cost telemetry real; no per-run trace; `traceId` declared but never set; `RoutingDecisionLog` read but never written. |

---

## Built but NOT on any call path (the orphan sidebar)

These are implemented (often elaborately) but have **zero reachable callers**, are **gated out**, or read **collections nothing writes**. They inflate the apparent surface area without affecting runtime behavior:

- **"AI/ML routing" intelligence** — RL bandit *selection* fires only at cold-start (gated by predictive, `RoutingEngine.ts:136`); RL `persistState()` is a no-op (`llmRouterRL.service.ts:329-336`); predictive is a heuristic mislabeled "ML"; auto-tune computes settings that are **never applied**; A/B testing **fabricates** config-B metrics (`llmRouterAutoTune.service.ts:355-360`); `rollback` is a no-op (`:421`); `llmCostOptimization.service.ts` is unimported dead code with a `record.cost` vs `totalCost` field bug that would report $0.
- **Fallback-chain machinery + the second (model-keyed) circuit breaker** in `RoutingEngine` (`:471, :933-988, :1032-1079`) — no external consumers; the live retry loop retries the *same* model.
- **Multi-agent orchestration cluster** — `agentCollaboration`, `agentConflictResolution`, `agentHealthMonitoring`, `agentRollback`, `agentCommunication`: **no reachable callers**, and they read `AgentExecution` / `AgentMessage` collections that **no reachable code writes** (the only `AgentExecution` writer, `agentRollback.service.ts:43`, is itself uncalled). `resolveByLLM` (`agentConflictResolution.service.ts:281-335`) is genuinely good — and genuinely unused.
- **CUA vision loop** — `getNextAction` / `analyzeScreenshot` / `findElementSelector` (`cua-llm.service.ts:139,62,334`): the "screenshot→model→action" capability exists but has no callers.
- **Dead tool code** — native OpenAI tool-call parsing + `convertToolsToOpenAIFormat` (`FunctionCallProcessor.ts:391-439`) built then abandoned; phantom `processFunctionCalls` call (`llm/management.routes.ts:146`) to a method that doesn't exist.
- **`RoutingDecisionLog`** — read by admin dashboards, never written.

---

## ⚠ Security-critical path (documented here, tracked separately)

The one place the harness's incompleteness becomes a *liability*, not just a gap:

- **Unsandboxed arbitrary command execution.** `executeStdioMCPTool` spawns `config.command` with **`env: { ...process.env }`** (`mcp.service.ts:1047-1051`; health-check variant `:994-997`). The `command` comes from a DB record creatable via the `create_mcp_server` tool (`agentFunctionHandler.service.ts:92-94`) or `POST /api/mcp-servers` — by an agent or any authenticated/guest user — with **no allowlist and no confirmation**. This hands full-environment (secrets-inheriting) shell execution to model/user input.
- **Plaintext secrets.** MCP server `config.apiKey` is stored unencrypted, acknowledged in-code (`MCPServer.model.ts:72`).
- **CUA runs Chromium with `--no-sandbox`** (`cua.service.ts:83`) under optional/guest auth and no rate limit (`cua.routes.ts:26,233`).

These belong in a dedicated security pass, not this architecture doc — flagged so they aren't lost.
