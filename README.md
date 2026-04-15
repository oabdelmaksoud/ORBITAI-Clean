# OrbitAI: The Autonomous Software Architect

[![License: Private](https://img.shields.io/badge/License-Private-red.svg)](LICENSE)
[![Stack: MERN](https://img.shields.io/badge/Stack-MERN-blue.svg)](https://mongodb.com)
[![AI: Multi-LLM](https://img.shields.io/badge/AI-Multi--LLM-orange.svg)](https://gemini.google.com)

OrbitAI is a high-performance, autonomous software architecture and project generation platform. It empowers developers and architects to brainstorm, prototype, and deploy complex systems through an intelligent, agent-driven workflow.

---

## Core Pillars

### Intelligent Brainstorming
Interactive AI-driven ideation sessions that transition from abstract concepts to structured requirements. Featuring real-time mind map visualization to organize complex thoughts.

### Multi-LLM Orchestration
A robust LLM Router that intelligently distributes workloads across Gemini, OpenAI, and Anthropic. Optimized for performance, cost-effectiveness, and reliability.

### Instant Prototyping
Automatically generate live-preview project artifacts from requirements. Go from "Idea" to "Visual Prototype" in seconds with the integrated `PrototypeAssetGenerator`.

### Mission Control & Voice
Advanced monitoring via a centralized Mission Control dashboard and interactive voice-enabled agents using Pipecat and WebSockets.

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Client (Vite + React 18 + TypeScript)  :5173               │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTP / WebSocket
┌──────────────────────────▼──────────────────────────────────┐
│  Server (Node.js + Express)  :3001                          │
│  ┌──────────────┐  ┌───────────────┐  ┌──────────────────┐ │
│  │  LLM Router  │  │  Auth/RBAC    │  │  Agent Engine    │ │
│  └──────────────┘  └───────────────┘  └──────────────────┘ │
└──────────┬──────────────────────────────────────────────────┘
           │
   ┌───────┴───────┐
   │               │
┌──▼──────┐  ┌─────▼──────┐
│ MongoDB │  │   Redis     │
│  :27017 │  │   :6379     │
└─────────┘  └────────────┘
```

- **Frontend (`/client`)**: React 18, TypeScript, Vite, Framer Motion, TailwindCSS
- **Backend (`/server`)**: Node.js 22, Express, MongoDB (Mongoose), Redis
- **Shared (`/shared`)**: Shared types, validation schemas, utility libraries
- **CUA Sidecar**: Computer-Use Agent for autonomous task execution

---

## Prerequisites

| Requirement | Version | Notes |
|-------------|---------|-------|
| Node.js | 22+ | Required |
| MongoDB | 7+ | Required — local or Docker |
| Redis | 7+ | Required — local or Docker |
| npm | 10+ | Included with Node 22 |

**Required environment variables** — the server will exit at startup if these are missing:

| Variable | Description |
|----------|-------------|
| `MONGO_URI` | Full MongoDB connection URI |
| `MONGO_USERNAME` | MongoDB username |
| `MONGO_PASSWORD` | MongoDB password (strong) |
| `JWT_SECRET` | JWT signing secret (32+ chars) |
| `SHARE_LINK_SECRET` | Share link signing secret |

---

## Quick Start (Docker)

```bash
# 1. Copy and fill environment variables
cp .env.example .env
# Edit .env: set MONGO_ROOT_PASSWORD, JWT_SECRET, API keys, etc.

# 2. Start all services
docker compose up -d

# 3. Open the app
open http://localhost:5173
```

Services started: `app` (Express), `mongo` (MongoDB 7), `redis` (Redis 7), `nginx` (reverse proxy).

---

## Quick Start (Manual)

```bash
# 1. Install all dependencies
npm install

# 2. Copy environment config
cp server/.env.example server/.env
# Edit server/.env with your values (see Environment Variables below)

# 3. Start MongoDB and Redis (if not using Docker)
mongod --dbpath ./data/db &
redis-server &

# 4. Build shared types
cd shared && npm run build && cd ..

# 5. Start dev servers (client + server concurrently)
chmod +x start-all.sh && ./start-all.sh
```

| Service | URL |
|---------|-----|
| Frontend | http://localhost:5173 |
| Backend API | http://localhost:3001 |
| API Docs (dev only) | http://localhost:3001/api-docs |

---

## API

**Base URL:** `/api/v1/` (versioned) or `/api/` (legacy)

**Authentication:** All protected endpoints require a bearer token:
```
Authorization: Bearer <token>
```

Obtain a token via `POST /api/auth/login` or `POST /api/auth/register`.

**API Documentation:** Available at `/api-docs` in development/staging only (Swagger UI). Not exposed in production.

---

## Environment Variables

Full reference for `server/.env`:

| Variable | Required | Description |
|----------|----------|-------------|
| `NODE_ENV` | Yes | `development`, `staging`, or `production` |
| `PORT` | No | Server port (default: `3001`) |
| `MONGO_URI` | Yes | MongoDB connection string |
| `MONGO_USERNAME` | Yes | MongoDB auth username |
| `MONGO_PASSWORD` | Yes | MongoDB auth password |
| `MONGO_ROOT_PASSWORD` | Yes (Docker) | MongoDB root password for Docker init |
| `JWT_SECRET` | Yes | JWT signing secret (min 32 chars) |
| `SHARE_LINK_SECRET` | Yes | Share link HMAC secret |
| `REDIS_URL` | Yes | Redis connection URL (e.g. `redis://localhost:6379`) |
| `GEMINI_API_KEY` | No | Google Gemini API key |
| `OPENAI_API_KEY` | No | OpenAI API key |
| `ANTHROPIC_API_KEY` | No | Anthropic Claude API key |
| `CORS_ORIGINS` | No | Comma-separated allowed origins |
| `SESSION_SECRET` | No | Express session secret |

See `server/.env.example` for a complete template with descriptions.

---

## Running Tests

```bash
# Server unit + integration tests
cd server && npm test

# Server tests with coverage report
cd server && npm run test:coverage

# Client tests
cd client && npm test
```

Coverage thresholds (enforced in CI): 40% lines/functions/statements, 30% branches.

---

## Documentation & Guides

- **[Deployment Guide](DEPLOYMENT.md)** — Production readiness and cloud deployment
- **[System Walkthrough](docs/WALKTHROUGH.md)** — Deep dive into architecture and security
- **[Integration Testing](USER_JOURNEY_TEST_REPORT.md)** — Test reports and quality metrics

---

## Security

This repository is **PRIVATE** and contains proprietary software. Access is restricted to authorized contributors.

Key security practices enforced:
- Secrets scanning on every PR (TruffleHog)
- No hardcoded credentials — all secrets via environment variables
- CSP with per-request nonces (no `unsafe-inline`)
- Rate limiting on all public endpoints
- MongoDB `$regex` inputs escaped (ReDoS prevention)

---

*Built by the OrbitAI Team*
