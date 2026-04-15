# 🚀 OrbitAI: The Autonomous Software Architect

[![License: Private](https://img.shields.io/badge/License-Private-red.svg)](LICENSE)
[![Stack: MERN](https://img.shields.io/badge/Stack-MERN-blue.svg)](https://mongodb.com)
[![AI: Multi--LLM](https://img.shields.io/badge/AI-Multi--LLM-orange.svg)](https://gemini.google.com)

OrbitAI is a high-performance, autonomous software architecture and project generation platform. It empowers developers and architects to brainstorm, prototype, and deploy complex systems through an intelligent, agent-driven workflow.

---

## ✨ Core Pillars

### 🧠 Intelligent Brainstorming
Interactive AI-driven ideation sessions that transition from abstract concepts to structured requirements. Featuring real-time mind map visualization to organize complex thoughts.

### 🔄 Multi-LLM Orchestration
A robust LLM Router that intelligently distributes workloads across Gemini, OpenAI, and Anthropic. Optimized for performance, cost-effectiveness, and reliability.

### 🎨 Instant Prototyping
Automatically generate live-preview project artifacts from requirements. Go from "Idea" to "Visual Prototype" in seconds with the integrated `PrototypeAssetGenerator`.

### 🎙️ Mission Control & Voice
Advanced monitoring via a centralized Mission Control dashboard and interactive voice-enabled agents using Pipecat and WebSockets.

---

## 🏗️ System Architecture

OrbitAI is built as a highly modular monorepo:

- **Frontend (`/client`)**: React 18, TypeScript, Vite, Framer Motion, and TailwindCSS.
- **Backend (`/server`)**: Node.js, Express, MongoDB (Mongoose), Redis (Caching/Queues).
- **Core Engine (`/shared`)**: Shared types, validation schemas, and utility libraries.
- **Extensions**: Support for MCP (Model Context Protocol), Docker integration, and automated deployments.

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+)
- MongoDB (Running locally or via Docker)
- Redis (Optional, for advanced queue support)

### Installation

1. **Clone & Install Dependencies:**
   ```bash
   npm install
   ```

2. **Environment Configuration:**
   Copy `.env.example` to `.env` in both root and `/server` directories and fill in your API keys.

3. **Launch the Platform:**
   ```bash
   chmod +x start-all.sh
   ./start-all.sh
   ```

**Frontend:** [http://localhost:5173](http://localhost:5173)
**Backend:** [http://localhost:3002](http://localhost:3002)

---

## 📖 Documentation & Guides

- **[Deployment Guide](DEPLOYMENT.md)** - Production readiness and cloud deployment.
- **[System Walkthrough](docs/WALKTHROUGH.md)** - Deep dive into architecture and security.
- **[Integration Testing](USER_JOURNEY_TEST_REPORT.md)** - Detailed test reports and quality metrics.

---

## 🔒 Security & Policy
This repository is **PRIVATE** and contains proprietary software. Access is restricted to authorized contributors. Refer to `POLICY.md` for compliance and usage guidelines.

---

*Built with ❤️ by the OrbitAI Team*
