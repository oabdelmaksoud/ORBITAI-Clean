# Changelog

All notable changes to OrbitAI will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.0] - 2026-04-13

### 🎉 Initial Release

OrbitAI — The Autonomous Software Architect. A high-performance, autonomous software architecture and project generation platform that empowers developers and architects to brainstorm, prototype, and deploy complex systems through an intelligent, agent-driven workflow.

### Added

#### Core Platform
- **Intelligent Brainstorming**: Interactive AI-driven ideation sessions with real-time mind map visualization
- **Multi-LLM Orchestration**: LLM Router supporting Gemini, OpenAI, and Anthropic with intelligent load distribution
- **Instant Prototyping**: Automated live-preview project artifact generation from requirements
- **Mission Control Dashboard**: Centralized monitoring and management interface
- **Voice-Enabled Agents**: Interactive voice agents using Pipecat and WebSockets

#### Frontend (`/client`) — React 18, TypeScript, Vite
- Full React 18 application with TypeScript and Vite build tooling
- TailwindCSS styling with Framer Motion animations
- Auth context, hooks for workspaces, comments, notifications, and time-tracking
- Feature flag support and multi-cloud service integration
- Comprehensive component library: ErrorBoundary, LandingPage, Logo, and more
- i18n internationalisation support
- Vitest-based test suite (65 tests)

#### Backend (`/server`) — Node.js, Express, MongoDB
- Express REST API with full TypeScript support
- MongoDB (Mongoose) data layer with migrations support
- JWT-based authentication with bcryptjs
- Stripe payment integration
- Neo4j graph database integration
- Google APIs (googleapis) integration
- Redis caching and queue support
- Multi-cloud orchestrator service with load balancing and failover
- Comprehensive middleware: error handling, authentication, rate limiting
- Unit test suite (78 tests across 23 test files)

#### Shared (`/shared`)
- Shared TypeScript types, validation schemas, and utility libraries
- Common interfaces consumed by both client and server

#### Infrastructure
- Docker and Docker Compose support for containerised deployments
- GitHub Actions CI/CD workflows
- Health check endpoint (`healthcheck.js`)
- Deployment documentation (`DEPLOYMENT.md`)

---

## Pending Pull Requests

The following PRs are open and scheduled for inclusion in upcoming releases:

### 🔧 Production Readiness (PR #19)
**"Fix production readiness: builds, tests, and TypeScript config"**
- All 3 packages (shared, server, client) build successfully for production
- 143 tests passing: 65/65 client tests + 78/78 server unit tests
- Relaxed `tsconfig.json` to allow production JS emission
- Fixed `catch (error: unknown)` → `catch (error: any)` across 259 server source files
- Rewrote 10 client test files to match actual hook APIs
- Fixed 4 server test files: async `errorHandler`, JWT secret mocking, Mongoose `.lean()` chain

### 📦 Dependency Updates

#### GitHub Actions (PRs #1–5)
| PR | Update |
|----|--------|
| #1 | `docker/login-action` 3 → 4 |
| #2 | `actions/setup-node` 4 → 6 |
| #3 | `docker/build-push-action` 5 → 7 |
| #4 | `docker/setup-buildx-action` 3 → 4 |
| #5 | `actions/upload-artifact` 3 → 7 |

#### Server Dependencies (PRs #7–16)
| PR | Update |
|----|--------|
| #7  | `@types/multer` 1.4.13 → 2.1.0 |
| #8  | `googleapis` 166.0.0 → 171.4.0 |
| #9  | `@types/bcryptjs` 2.4.6 → 3.0.0 |
| #10 | `eslint` 8.57.1 → 10.0.3 |
| #12 | `neo4j-driver` 5.28.2 → 6.0.1 |
| #13 | `stripe` 17.7.0 → 20.4.1 |
| #14 | `multer` + `@types/multer` (latest) |
| #15 | `express` + `@types/express` (latest) |
| #16 | Minor/patch group (2 packages) |

#### Root/Client Dependencies (PR #22)
| PR | Update |
|----|--------|
| #22 | Minor-and-patch group: 48 packages including `@google/genai` 1.45.0 → 1.49.0 |

---

> **Note**: Major version dependency bumps (neo4j-driver 6.x, stripe 20.x, eslint 10.x) may require API migration work before merging.
