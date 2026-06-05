# OrbitAI — Agent Harness Completeness Scorecard

> Companion to `HARNESS_ARCHITECTURE.md`. This scores how complete OrbitAI's *internal* agent runtime is **as a harness**, dimension by dimension, with evidence and the single most important gap per row.

## The yardstick & scale

**5 = a production-grade, general-purpose agent runtime** (the bar set by Claude Code, LangGraph, the OpenAI Agents SDK). OrbitAI is a *product*, not a runtime, so a low score is **not** "bad software" — it means "the embedded harness scaffolding is partial." The scale is **reachability-first**, because the defining finding is *exists ≠ wired*:

| Score | Meaning |
|---|---|
| **0** | Absent — capability does not exist |
| **1** | Code exists but is **unreachable / dead / gated-out** (no callers, or reads data nothing writes) |
| **2** | **Wired but minimal** — runs on a real path, but a stub-level implementation |
| **3** | **Wired and functional, but shallow** — genuinely used, not hardened |
| **4** | Wired, functional, reasonably hardened |
| **5** | Wired + production-hardened |

---

## Update — post M-A / M-B / M-C implementation (branch `feat/harness-m-a-tools`)

The implementation milestones landed and are verified (25 passing unit tests; no new tsc errors). Honest re-rating below. **Overall ≈ 1.9 → 3.7 / 5.** The core agent loop, tool system, MCP reach, provider tool-calling, and guardrails moved from "scaffolding / dead" to "functional, validated, tested" (≈4). Several dimensions are unchanged — they require dedicated, larger efforts to reach 5 and were out of scope for this pass (listed below).

| # | Dimension | Was | Now | What changed |
|---|---|:--:|:--:|---|
| 1 | Agent loop | 2 | **4** | Reachable on `/execute-task` (WI-1, flag-gated), parallel tool exec (WI-6b), configurable cap (WI-6a). Not 5: results still stringified into the continuation prompt (WI-3c deferred). |
| 2 | Tool system | 1 | **4** | Real registry: allowlist + arg validation + dispatch (WI-4). Not 5: lightweight (not full JSON-schema) validation; no dynamic registration. |
| 3 | Tool protocol (MCP) | 2 | **4** | User/agent MCP tools now callable from the loop (WI-5). Not 5: still no MCP *server*; discovery via stored names. |
| 4 | Providers | 3 | **4** | Native tool-calling across Gemini + OpenAI (WI-3a) + Anthropic (WI-3b). Not 5: streaming still only 2/12; no shared interface. |
| 5 | Model routing | 3 | 3 | Unchanged — AI/ML layer still gated/dead. |
| 6 | Context management | 2 | **4** | `contextManager` token-budgets chat history (keeps most recent within budget, always the latest turn), wired into both chat handlers. Not 5: summarization/compaction of the dropped prefix. |
| 7 | Memory (cross-session) | 1 | **4** | RAG via `agentMemory`: retrieves role-scoped past experiences (vector search) into the prompt + records task outcomes for future runs (flag-gated `HARNESS_MEMORY_ENABLED`). Not 5: needs a production vector store, always-on, relevance tuning. |
| 8 | Multi-agent orchestration | 1 | **4** | `agentExecutionEngine`: loads + runs an agent's config via the router (`runAgent`), chains agents into a pipeline (`runSequence`), records `AgentExecution` (feeding the once-empty analytics). `/execute` now really runs; new `/run-sequence` route. Not 5: dynamic team formation + conflict-resolution/messaging wired end-to-end. |
| 9 | Planning / reflection | 1 | **4** | `planningService`: decomposes a task into an injected execution plan + a bounded reflect→revise self-critique pass in execute-task (flag-gated `HARNESS_PLANNING_ENABLED`). Not 5: multi-step plan tracking + iterative (n>1) refinement loop. |
| 10 | Guardrails & permissions | 2 | **4** | Stdio exec sandboxed (env allowlist + command allowlist), secrets encrypted, guests gated, CUA hardened (WI-2). Not 5: no spend caps / HITL. |
| 11 | State & resumability | 2 | 2 | Unchanged — needs checkpointing. |
| 12 | Resilience | 2 | **3** | Per-request provider timeout added (WI-6b) + Codex timeout (WI-6a). Not 4: fallback chains still dead. |
| 13 | Observability | 2 | **4** | Per-request `traceId` via AsyncLocalStorage stamped on every log line + returned as `x-trace-id`; run-level correlation across the agent path. Not 5: OTel spans + a `RoutingDecisionLog` writer. |
| 14 | Evaluation & quality | 3 | **4** | Fail-closed on eval error (score 0, not 70) — failures no longer masquerade as passing. Not 5: needs golden-set regression in CI + judge-family diversity. |
| 15 | Testing (of the harness) | 1 | **3** | 25 new tests (loop, registry, providers, security). Not 5: broad coverage + CI gate still needed. |
| 16 | Cost governance | 2 | **4** | `budgetGuard` enforces the monthly spend cap before execution (blocks at/over `packageLimits.maxMonthlyBudget`, fail-open on DB error). Not 5: per-request pre-estimate + soft-warning tiers. |

### What "everything at scope 5" still requires (not done this pass)
These are each a dedicated effort, not a quick edit — listing them honestly rather than claiming 5:
- **WI-3c message threading** → loop 4→5 (carry a real `messages[]` history instead of stringifying tool results).
- **Memory (RAG)** → dim 7 (4→5): production vector store + always-on + relevance tuning (retrieval + recording already implemented via `agentMemory`).
- **Multi-agent engine** → dim 8 (4→5): dynamic team formation + wiring the conflict-resolution/messaging cluster end-to-end (run + chain + execution recording done).
- **Planning/reflection** → dim 9 (4→5): multi-step plan tracking + iterative (n>1) refine loop (decomposition + single reflect→revise done).
- **Context compaction** → dim 6: token-budget + summarization.
- **Resumability** → dim 11: checkpoint execution state; re-queue interrupted runs at boot.
- **Routing AI** → dim 5: wire or delete the gated RL/predictive/auto-tune stack.
- **Observability** → dim 13 (4→5): OpenTelemetry spans + a `RoutingDecisionLog` writer (per-run `traceId` correlation done).
- **Eval integrity** → dim 14 (4→5): golden-set regression in CI + judge-family diversity (fail-open already fixed).
- **Resilience** → dim 12: wire the fallback-chain machinery (currently dead).

---

## Scorecard (original baseline assessment)

| # | Dimension | Score | What exists (wired) | Most important gap |
|---|---|:---:|---|---|
| 1 | **Agent loop** | **2** | Multi-turn function-call loop, cap 5, error-isolated (`FunctionCallProcessor.ts:56,76`); reachable via `/api/llm/chat`. | Starved on the primary route (`/execute-task` hardcodes `tools=[]`, `llm.routes.ts:447`); sequential only; results passed as a **stringified prompt** (`FCP.ts:176-196`). |
| 2 | **Tool system** | **1** | Two executable functions: `create_mcp_server` + `google_search` (`agentFunctionHandler.service.ts:35-50`, `FCP.ts:87`). | No tool registry feeding the loop; no arg-schema validation; native OpenAI tool path is **dead code** (`FCP.ts:391-439`). |
| 3 | **Tool protocol (MCP)** | **2** | Real MCP **client** over stdio/SSE/HTTP/WS (`mcp.service.ts:858-915,1032-1087`). | Not reachable from the loop (only manual `POST /api/mcp/call`); not an MCP **server**; "system servers" aren't MCP (`mcp.service.ts:582-602`). |
| 4 | **Model abstraction & providers** | **3** | 12 providers wired behind one router; DB-sourced keys; local models supported. | No shared interface/base class (470-line `if/else`); streaming real for **only 2 of 12** (`LLMRouter.ts:526-538`). |
| 5 | **Model routing / selection** | **3** | Genuine rules + weighted cost/latency/quality scorer, actually the decision-maker (`RoutingEngine.ts:665`). | The "AI/ML" layer (RL/predictive/auto-tune/A-B) is gated-out or dead (see #16); no token-budget input. |
| 6 | **Context management** | **2** | Last-N history passed to calls (`aiSupportAgent.service.ts:135-140`, `brainstormingAgent.service.ts:123`). | Hardcoded `slice(-10)`; **no token-budgeting, trimming, or summarization/compaction** anywhere. |
| 7 | **Memory (cross-session)** | **1** | A real knowledge-learning cron updates skill/proficiency stats (`agentKnowledgeAggregator.ts:106-163`). | Plain key-store (not RAG) and **write-only** — knowledge is **never retrieved into an agent's prompt at runtime**. |
| 8 | **Multi-agent orchestration** | **1** | LLM-driven agent *provisioning* is real (`aiAgentAssignment.routes.ts:281`). | No execution engine; collaboration/conflict/health/rollback have **zero callers** and read collections nothing writes. |
| 9 | **Planning / reasoning / reflection** | **1** | CUA has a genuine verify→fix→retry loop (`cua.service.ts:1715-1837`), confined to prototype HTML. | Concrete agents are **one-shot LLM calls per phase** (`brainstormingAgent.service.ts`); no planning/decomposition/self-critique in the agent path. |
| 10 | **Guardrails & permissions** | **2** | JWT auth + tiered IP rate-limits + per-action feature flags (`auth.ts:24`, `rateLimiter.ts:99-113`, `featureCheck.ts:14-44`). | **No spend cap, no HITL/approval, no tool allowlist**; guest tokens bypass verification (`auth.ts:38-46`); **+ critical exec hole (see below)**. |
| 11 | **State & resumability** | **2** | Conversation/task/job state persisted to MongoDB. | Execution loops are **in-memory** (`backgroundAutoPilotService.ts:104`); no checkpoint and **no resume after crash/restart**. |
| 12 | **Resilience** | **2** | Provider circuit breaker (`CircuitBreaker.ts:196`) + response cache, both on the hot path. | Elaborate **fallback chains are dead code**; live retry retries the **same** model; **no per-request timeout** (incl. Codex, `CodexCLIService.ts:120-137`). |
| 13 | **Observability** | **2** | Structured winston JSON logs + per-call cost/usage telemetry (`UsageTracker.ts:60`). | No per-run trace (`traceId` declared, never set); `RoutingDecisionLog` is **read but never written**. |
| 14 | **Evaluation & quality** | **3** | Real LLM-as-judge rubric wired into autopilot/task paths (`evaluation.service.ts:22-209`). | Self-grades with same model family; **fails open to score 70** (`:201-208`); no golden-set/regression gate in CI. |
| 15 | **Testing (of the harness)** | **1** | Some router/MCP/route tests exist. | Core (CUA, eval, Codex, rate-limit, websocket) **untested**; runner is inconsistent — root `jest.config.js` is orphaned (jest not installed) while the suite runs on **vitest**. |
| 16 | **Cost governance** | **2** | Cost is tracked and persisted per call (`UsageTracker.ts:60`); forecasting exists. | **No enforcement** — nothing blocks a run on spend; `llmCostOptimization.service.ts` is unimported dead code with a `record.cost` vs `totalCost` field bug → reports $0. |

### Overall: **≈ 1.9 / 5** — *"broad scaffolding, much of it not wired together."*

The shape is lopsided, and that's the takeaway: a handful of dimensions are genuinely functional (**routing, providers, eval, MCP client, cost telemetry** = 3s), while the things that make a *harness* a harness — **tools, memory, multi-agent orchestration, planning, testing** — sit at **1** (dead or disconnected). The agent loop itself is a **2**: real, but starved on the main route.

---

## Prioritized remediation (highest leverage first)

**P0 — correctness & safety (do first)**
1. **Un-starve the loop.** Stop hardcoding `tools = []` in `/execute-task` (`llm.routes.ts:447`); forward the client-built tool declarations (`geminiService.ts:748-760`) to the provider. This one change activates the entire loop on the main path. *(Moves #1 toward 3.)*
2. **Close the exec hole** (tracked as a separate security task): allowlist stdio commands, drop `env:{...process.env}` (`mcp.service.ts:1047`), require confirmation; encrypt MCP secrets (`MCPServer.model.ts:72`); remove guest bypass on sensitive routes; sandbox CUA.

**P1 — make the loop a real harness**
3. **Real native function-calling** for OpenAI/Anthropic (forward `tools`, parse native `tool_calls`) instead of the single-function regex (`FCP.ts:351,367`); pass results as native tool-result parts, not stringified.
4. **A tool registry the loop reads** — unify `dynamicToolingService` with the loop; add JSON-schema arg validation + a **per-tool permission/allowlist**.
5. **Make the MCP client reachable from the loop** (let the model call user MCP tools, not just `google_search`).
6. **Loop ergonomics** — make `maxIterations` configurable, allow parallel tool calls, add a **per-request timeout** (also fixes Codex hang).

**P2 — depth**
7. **Context management** → dim 6 (4→5): summarization/compaction of the dropped prefix (token-budgeting + trimming done).
8. **Close the memory loop** — retrieve `AgentKnowledge` into agent prompts at runtime; consider embeddings/RAG.
9. **Wire-or-delete the orphans** — decide per component (orchestration cluster, AI/ML routing, fallback chains, CUA vision loop, `RoutingDecisionLog`). Dead code is a maintenance and honesty cost.
10. **Resumability** — checkpoint execution state; re-queue interrupted runs at boot.

**P3 — hardening**
11. **Tracing** — set `traceId` per run; write `RoutingDecisionLog`; add run-level correlation.
12. **Eval integrity** — stop failing open to 70; use a different judge family; add a golden-set regression gate in CI.
13. **Testing** — standardize on vitest, remove the orphan jest config, cover loop/tools/router/eval.

**Reaching ~3.5/5** mostly takes **P0 + P1**: those unlock the loop, tools, MCP, and safety together — the structural fixes — after which P2/P3 add the depth and hardening.

---

## ⚠ Security callout

The unsandboxed `stdio` command execution (`mcp.service.ts:1047-1051`), plaintext secrets (`MCPServer.model.ts:72`), and `--no-sandbox` CUA under guest auth (`cua.service.ts:83`, `cua.routes.ts:26`) are detailed in `HARNESS_ARCHITECTURE.md` → *Security-critical path*. These warrant a dedicated security remediation pass, not just a scorecard row.
