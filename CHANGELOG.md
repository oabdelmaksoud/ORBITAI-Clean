# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.0] - 2026-04-14

### Security
- Removed hardcoded JWT and ShareLink fallback values — server now fails fast on missing env vars
- Removed MongoDB default credentials — production exits if `MONGODB_URI` is unset
- Escaped MongoDB `$regex` inputs across 6 routes to prevent injection attacks
- Tightened rate limiter thresholds (was max:1000, now sensible per-route limits)
- Removed CSP `unsafe-inline` directive — replaced with nonce-based content security policy
- Gated Swagger UI behind non-production environment check
- Added TruffleHog secrets scanning to CI pipeline

### Infrastructure
- Fixed Docker Compose to use `${VAR:?required}` syntax — hardcoded passwords removed
- Fixed Dockerfile build order: TypeScript compilation now runs before switching to production dependencies
- Health endpoint now checks MongoDB and Redis connectivity (was always returning HTTP 200)
- CI/CD deploy stubs replaced with real SSH-based deployment scripts
- Added Redis session persistence for Pipecat voice sessions

### Features
- Implemented email service via nodemailer SMTP — invitation emails are now actually delivered
- TypeScript build fixed: 0 errors in production source (test files excluded from tsconfig)
- Added 10 new route test files with enforced coverage thresholds
- Stub endpoints now return proper HTTP 501 Not Implemented responses
- README expanded with prerequisites, quick-start guide, architecture overview, and env var reference table

### Changed
- Replaced all `console.log` calls with structured `logger` throughout the server codebase
- Registered v001 database migration covering schema indexes
- Removed streaming chat mock fallback — real implementation only
- Removed duplicate route registrations

### Refactored
- `NeuralStreamChatProps` interface moved to `neural-stream-chat/types.ts` — eliminates duplicate interface definition
- Resize panel logic extracted from `App.tsx` into `useAppState` hook where the state it manages lives
- Deleted backup files and dead code from the source tree

[1.0.0]: https://github.com/oabdelmaksoud/ORBITAI-Clean/releases/tag/v1.0.0
