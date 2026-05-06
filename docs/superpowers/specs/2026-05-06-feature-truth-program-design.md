# Feature Truth Program Design

Date: 2026-05-06
Repo: `/Users/omar/GITHUB REPOS/OrbitAI/ORBITAI-Clean`

## Purpose

This design defines a staged audit program for comparing all discoverable OrbitAI feature claims against the actual implementation. The program starts with an implementation-level Feature Truth Map, then uses that map for production-readiness verification, and finally turns confirmed gaps into a GitHub-backed fix backlog.

The audit must be evidence-backed. Documentation claims, UI affordances, route names, services, scripts, configuration, comments, and GitHub issues or pull requests are all valid claim sources. A feature is not considered production-ready because it appears in docs or has a placeholder path.

## Approved Scope

The program has three stages:

1. Stage 1: Feature Truth Map
   Build an implementation-level inventory of every discoverable feature claim. Each row receives a stable feature ID, source evidence, implementation evidence, verification status, readiness verdict, severity, and GitHub linkage.

2. Stage 2: Production Readiness Audit
   Reuse the Stage 1 feature IDs and run build, test, and runtime probes where feasible. Credentialed flows block until credentials or access are provided. Mocks and fallbacks are recorded as evidence, but they do not prove production readiness unless the feature is explicitly scoped as demo-only or offline-only.

3. Stage 3: Gap-To-Fix Backlog
   Convert confirmed gaps into GitHub issues under the milestone `production-readiness-feature-truth`. The default is one GitHub issue per confirmed implementation gap.

The first Stage 1 checkpoint covers Core App Foundation:

- Authentication
- Setup wizard
- Project lifecycle
- Workspace loading and operation
- Persistence
- Routing

## Source Universe

The audit must harvest feature claims from every discoverable local and remote project source:

- `README.md`, `DEPLOYMENT.md`, policy files, release notes, reports, and docs
- UI labels, navigation, tabs, buttons, views, and component names
- Client services, hooks, contexts, handlers, reducers, stores, and configuration
- Server routes, route registration, middleware, services, models, validators, migrations, scripts, and configuration
- Shared types, constants, package scripts, environment examples, Docker files, CI files, and startup scripts
- Inline comments that claim future, partial, stubbed, or production behavior
- GitHub issues and pull requests, subject to authenticated `gh` access

If GitHub authentication or repository access is unavailable, GitHub-sourced evidence is blocked rather than silently skipped.

## Artifact Layout

Durable review artifacts live under:

```text
docs/audits/feature-truth/
```

Machine-readable state and synchronization files live under:

```text
.omc/state/feature-truth/
```

Stage 1 should create or update these files:

```text
docs/audits/feature-truth/README.md
docs/audits/feature-truth/core-foundation.md
.omc/state/feature-truth/feature-truth-map.json
.omc/state/feature-truth/feature-truth-map.csv
.omc/state/feature-truth/github-sync-log.json
```

The Markdown files are for human review. The JSON and CSV files are canonical state for Stage 2 and Stage 3.

## Evidence Ledger Schema

Every feature or gap record must use a stable schema:

```text
id
domain
feature_name
feature_type
claim_sources
implementation_evidence
test_evidence
runtime_evidence
security_privacy_compliance_notes
status
readiness_verdict
severity
credential_requirement
github_issue
github_prs
last_verified_at
notes
```

Recommended `feature_type` values:

```text
doc_claim
ui_surface
client_api
server_route
server_service
model
middleware
script
config
integration
workflow
test
```

Allowed `status` values:

```text
implemented
partial
stub
missing
contradicted
environment_blocked
unknown
```

Allowed `readiness_verdict` values:

```text
production_ready
needs_verification
not_ready
blocked_credentials
blocked_environment
not_applicable
```

Allowed severity values:

```text
P0
P1
P2
P3
```

## Evidence Rules

Static evidence includes concrete file references, exported route config, route handlers, service methods, model definitions, components, hooks, API clients, config flags, env keys, tests, comments, and docs.

Build and test evidence includes install state, typecheck, unit tests, integration tests, client build, server build, shared package build, and existing Playwright or journey tests.

Runtime evidence includes local browser and API probes for key flows in the current checkpoint. For the Core App Foundation checkpoint, runtime probes should cover auth availability, setup wizard entry, project creation and lifecycle behavior, workspace loading, persistence behavior, and app routing where the local environment permits it.

P0 and P1 confirmed gaps require static proof plus build, test, or runtime proof where feasible. If a high-severity path cannot be probed because credentials or services are missing, record the blocker exactly.

P2 and P3 gaps can be opened from strong static evidence, such as an explicit stub response, missing handler, missing service dependency, contradictory documentation, or a route that exists only as a placeholder.

## Blocking Rules

The audit must block instead of guessing when it needs:

- Secrets
- Admin credentials
- User credentials
- Third-party API keys
- GitHub authentication
- MongoDB or Redis availability
- Paid provider access
- External service approval

Blocked rows are not downgraded to working. They receive `environment_blocked`, `blocked_credentials`, or `blocked_environment` as appropriate.

Mocks, demo fallbacks, localStorage fallbacks, hardcoded sample data, and placeholder responses are valid implementation evidence. They are not production-readiness proof unless the feature is explicitly scoped as demo-only or offline-only.

Security, privacy, and compliance concerns must be recorded on every relevant feature row. A feature can be functionally implemented and still fail the `production_ready` verdict because of authorization, secret handling, data retention, auditability, privacy, or compliance risk.

## GitHub Issue Policy

Confirmed gaps should create or update GitHub issues as part of the program.

The program should create or reuse the milestone:

```text
production-readiness-feature-truth
```

The program should create or reuse dedicated labels, including:

```text
feature-truth
implementation-gap
production-readiness
blocked-credentials
blocked-environment
security
privacy
compliance
P0
P1
P2
P3
```

The default issue model is one issue per confirmed implementation gap. Each issue should include:

- Feature ID
- Domain
- Claim source
- Implementation evidence
- Verification evidence or blocker
- Expected behavior
- Actual behavior
- Severity
- Security, privacy, and compliance notes when relevant
- Link back to the local artifact path and row ID

If `gh` is unauthenticated or GitHub mutation fails, record the failure in `.omc/state/feature-truth/github-sync-log.json` and mark the affected rows as GitHub-sync blocked.

## Domain Checkpoint Workflow

Each domain checkpoint follows the same six-step workflow:

1. Claim harvest
   Collect claims from local source files, generated route inventories, docs, comments, and GitHub issues or pull requests.

2. Implementation trace
   Link each claim to concrete code evidence: route registration, handler, service, model, component, hook, API client, script, config, test, or missing implementation.

3. Verification pass
   Run static checks first, then build, test, and runtime probes where feasible. Credentialed flows pause as blocked until access is available.

4. Verdict assignment
   Assign status, readiness verdict, severity, and security/privacy/compliance notes.

5. Issue sync
   Create or update one GitHub issue per confirmed gap, using the milestone and labels defined in this design.

6. Checkpoint review
   Produce Markdown, JSON, CSV, and GitHub sync log artifacts. Stop for review before moving to the next domain.

Stage 1 does not fix implementation gaps. It creates the evidence-backed truth map and issue trail. Fix planning belongs to Stage 3 after Stage 2 has reused the same feature IDs for readiness verification.

## First Checkpoint Success Criteria

The Core App Foundation checkpoint is complete only when it has:

- A populated implementation-level feature map for auth, setup wizard, project lifecycle, workspace, persistence, and routing
- Markdown summary plus JSON and CSV machine artifacts
- Static evidence for every row
- Build, test, and runtime evidence where feasible
- Explicit blocked status for credentialed or environment-dependent checks
- Security, privacy, and compliance notes where relevant
- GitHub issues created or updated for confirmed gaps
- A checkpoint summary listing ready, partial, stubbed, missing, blocked, and unknown items

## Program Success Criteria

The staged program succeeds when:

- Every major domain has completed the checkpoint workflow
- Stage 2 has run readiness probes using the Stage 1 feature IDs
- Stage 3 has produced prioritized fix waves from confirmed gaps
- Confirmed gaps have GitHub issue coverage
- Blocked checks identify the exact credential, service, or environment requirement
- The final artifacts can be used to decide what is implemented, what is production-ready, and what must be fixed before release

## Non-Goals

This design does not authorize implementation fixes.

This design does not treat docs as proof of implementation.

This design does not permit mock or fallback behavior to stand in for production-readiness evidence unless the feature is explicitly scoped that way.

This design does not skip GitHub evidence or mutation silently. If GitHub access is unavailable, the program records a blocker.

## Design-Time Repository Notes

At design time, Git required a per-command `safe.directory` override for this checkout. The working tree also contained pre-existing changes and untracked files outside this design document. Future execution should preserve unrelated user changes and stage only the files it owns.
