# OrbitAI — Project Review

> Last Updated: April 2026  
> See also: `docs/ARCHITECTURE.md`, `docs/WALKTHROUGH.md §14`

---

## Executive Summary

OrbitAI is a feature-rich AI-powered platform covering project management, multi-LLM orchestration, voice agents, deployment automation, and real-time collaboration. The codebase is functional and deployable, but several documented features are stubs or partial implementations. This document captures the current state of known gaps and their resolution status.

---

## Gap Resolution Status

| # | Area | Issue | Status |
|---|------|--------|--------|
| 1 | A/B Tests | Data lost on restart (in-memory Map) | **Fixed** — `ABTest.model.ts` |
| 2 | Voice Sessions | Lost on restart (in-memory Map) | **Fixed** — `VoiceSession.model.ts` |
| 3 | Pipecat | No docs on Python service setup | **Fixed** — `DEPLOYMENT.md §Pipecat` |
| 4 | Pipecat | Missing env vars in `.env.example` | **Fixed** — `PIPECAT_HOST/PORT/ENABLED` added |
| 5 | LangGraph | RAG workflow returned stub | **Fixed** — `vectorSearch` wired to `createRAGWorkflow` |
| 6 | Teams | Logic inline in routes | **Fixed** — `msteams.service.ts` extracted |
| 7 | Slack | Logic inline in routes | **Fixed** — `slack.service.ts` extracted |
| 8 | AWS/GCP | Fake success URL returned | **Fixed** — throws "not yet implemented" |
| 9 | Multi-cloud | Load-balancer route propagated 500 | **Fixed** — returns 501 |
| 10 | `.env.example` | 19 env vars missing | **Fixed** — all optional services documented |
| 11 | POLICY.md | Referenced in README but missing | **Fixed** — `POLICY.md` created |
| 12 | ARCHITECTURE.md | Referenced in WALKTHROUGH but missing | **Fixed** — `docs/ARCHITECTURE.md` created |
| 13 | PROJECT_REVIEW.md | Referenced in WALKTHROUGH but missing | **Fixed** — this file |

---

## Remaining Open Items

### High Priority

| Area | Description | Tracking |
|------|-------------|---------|
| `App.tsx` | ~6,700-line god object — needs extraction into sub-components | Issue #28 |
| `NeuralStreamChat.tsx` | ~7,600-line monolithic component | Issue #27 |
| i18n | 36 keys cover < 1% of UI surface | Issue #36 |
| LLM Router tests | 0 unit tests for 1,430-line core router | Issue #32 |
| CUA tests | 0 tests for 1,844-line Playwright service | Issue #31 |

### Medium Priority

| Area | Description |
|------|-------------|
| Frontend stub components | 18 components with hardcoded empty state |
| WebSocket integration tests | Socket.io events untested |
| Test generation services | Test-gen services have no tests themselves |

### Low Priority

| Area | Description |
|------|-------------|
| AWS SDK deployment | Credential handling in place; SDK calls pending |
| GCP SDK deployment | Credential handling in place; SDK calls pending |
| Weaviate package | `weaviate-ts-client` not in dependencies; falls back to in-memory |
| Neo4j usage | Connection works; query API surface is minimal |
| MCP tool execution | Only health-check implemented; no protocol messaging |

---

## Test Coverage Summary (as of April 2026)

| Area | Coverage |
|------|----------|
| Server routes | ~5% (9 of 169 route/service files have tests) |
| Client components | ~1.4% (3 of 221 components have tests) |
| LLM Router | 0% |
| CUA service | 0% |
| Voice/Pipecat | Partial (bridge service has tests, routes have tests) |
| Auth routes | Good coverage |

---

## Architecture Health

- **Security**: JWT auth, Zod validation on all public inputs, Slack webhook HMAC verification, bcrypt passwords — no known critical vulnerabilities.
- **Scalability**: Redis caching, MongoDB indexes, rate limiting — ready for horizontal scaling behind a load balancer.
- **Observability**: Winston logger, Sentry DSN support, PM2 monitoring — production-ready logging pipeline.
- **Reliability**: MongoDB session persistence (voice sessions, A/B tests, API keys), circuit breaker pattern in LLM router.
