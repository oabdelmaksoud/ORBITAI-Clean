# OrbitAI Project Review

> Code quality metrics, known issues, and progress against the feature roadmap.
> For architecture details see [docs/ARCHITECTURE.md](ARCHITECTURE.md).

---

## Code Quality Metrics

| Area | Files | LOC (approx.) | Notes |
|------|-------|---------------|-------|
| Backend routes | 136 | ~45,000 | Layered; some integration routes still inline |
| Backend services | 196 | ~110,000 | Core business logic |
| Backend models | 70 | ~8,000 | Mongoose schemas |
| Frontend components | 221 | ~150,000 | Some large monolithic files (see Tech Debt) |
| Shared types | — | ~2,000 | |

---

## Test Coverage

Current test coverage is significantly below acceptable production thresholds.

| Layer | Files with tests | Total files | Coverage |
|-------|-----------------|-------------|----------|
| Server routes | ~8 | 136 | ~6% |
| Server services | ~9 | 196 | ~5% |
| Client components | ~3 | 221 | ~1% |
| **Overall** | | | **< 3%** |

### Priority gaps

- LLM Router (`llmRouterAI.service.ts`, `llmRouterAutoTune.service.ts`) — 1,430+ LOC, no tests.
- CUA service (`cua.service.ts`) — 1,844 LOC, no tests.
- WebSocket services — 958+ LOC, no tests.
- Test-generation services (`testGeneration.service.ts`, etc.) — 2,000+ LOC, no tests.
- Frontend components — only 3 of 221 have test files.

### Recommended targets

- Backend critical path (auth, projects, LLM router): ≥ 80% line coverage.
- Backend services overall: ≥ 60% line coverage.
- Frontend core components: ≥ 40% line coverage.

---

## Known Issues (open)

The following issues are tracked in GitHub Issues. This is a summary; refer to the issue tracker for up-to-date status.

### Bugs

| # | Summary | Severity |
|---|---------|----------|
| #24 | A/B test configurations lost on server restart (in-memory storage) → **Fixed** | High |

### Feature Gaps

| # | Summary | Status |
|---|---------|--------|
| #25 | Pipecat voice integration not production-ready | Open |
| #26 | Weaviate vector DB integration non-operational | Open |
| #27 | MCP tool execution protocol not implemented | Open |
| #28 | Neo4j knowledge graph queries minimal | Open |
| #29 | Multi-cloud env vars not documented | Open |
| #30 | LangGraph RAG workflow endpoint returns stub | Open |
| #44 | 18 frontend components are UI-only stubs | Open |
| #45 | AWS and GCP deployment return mock URLs | Open |
| #46 | i18n coverage < 1% | Open |

### Tech Debt

| # | Summary | Effort |
|---|---------|--------|
| #31 | `App.tsx` (6,720 lines) — god object must be refactored | High |
| #32 | `NeuralStreamChat.tsx` (7,651 lines) — monolithic component | High |
| #33 | MS Teams integration has no service layer | Medium |
| #34 | Slack integration has no service layer | Medium |

### Documentation

| # | Summary |
|---|---------|
| #40 | `docs/ARCHITECTURE.md` and `docs/PROJECT_REVIEW.md` missing → **Fixed** |
| #41 | `.env.example` missing 19 env vars → **Fixed** |
| #42 | `POLICY.md` referenced but missing → **Fixed** |
| #43 | Pipecat deployment not documented | Open |

---

## Roadmap Progress

### Phase 1 — Foundation ✅

- [x] Express backend with JWT authentication
- [x] MongoDB + Mongoose models (70+ schemas)
- [x] React frontend with Vite
- [x] Multi-LLM router (14 providers)
- [x] Project creation wizard
- [x] Real-time WebSocket chat
- [x] Docker Compose deployment

### Phase 2 — Intelligence Layer ✅

- [x] LangChain service integration
- [x] LangGraph multi-agent workflow execution
- [x] CrewAI agent collaboration
- [x] A/B testing for LLM router (now persisted to MongoDB)
- [x] Code generation pipeline
- [x] Prototype asset generator

### Phase 3 — Integrations (In Progress)

- [x] GitHub OAuth + repository management
- [x] Slack OAuth route (service layer in progress)
- [x] MS Teams OAuth route (service layer in progress)
- [ ] Weaviate vector search (non-operational)
- [ ] Neo4j knowledge graph queries (minimal)
- [ ] MCP tool execution protocol (health checks only)
- [ ] Pipecat voice agent (not production-ready)

### Phase 4 — Cloud Deployment (In Progress)

- [x] Vercel deployment
- [x] Railway deployment
- [x] Render deployment
- [ ] AWS deployment (mock responses)
- [ ] GCP deployment (mock responses)
- [ ] Multi-cloud load balancing / failover

### Phase 5 — Quality & Observability (Planned)

- [ ] Test coverage ≥ 60% for critical backend paths
- [ ] Frontend component test coverage ≥ 40%
- [ ] i18n coverage ≥ 80% of UI strings
- [ ] Structured logging + Sentry integration
- [ ] Performance benchmarking and regression tracking

---

## Refactoring Priorities

1. **Split `App.tsx`** — decompose into feature-level route modules and lazy-loaded views.
2. **Split `NeuralStreamChat.tsx`** — extract message rendering, toolbar, and agent panel into separate components.
3. **Add service layers** for Slack and MS Teams routes.
4. **Implement MCP tool execution** — wire JSON-RPC 2.0 handler into `mcp.service.ts`.
5. **Implement AWS/GCP deployment** — replace stub responses with real SDK calls.
