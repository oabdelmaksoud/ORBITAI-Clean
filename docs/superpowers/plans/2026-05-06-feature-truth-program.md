# Feature Truth Program Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the evidence-ledger workflow and complete the first Core App Foundation Feature Truth Map checkpoint for OrbitAI.

**Architecture:** Create durable Markdown audit summaries under `docs/audits/feature-truth/` and canonical state under `.omc/state/feature-truth/`. Use shell-first repository discovery, existing npm scripts, Playwright probes, and GitHub CLI mutation to produce evidence-backed feature rows without fixing implementation gaps.

**Tech Stack:** Node.js/npm workspaces, React/Vite client, Express server, Vitest, Playwright, GitHub CLI, Markdown, JSON, CSV.

---

## Scope Check

The approved design covers a staged full program. This plan implements the first independently reviewable unit only: Stage 1 audit machinery plus the Core App Foundation checkpoint. Later domains and Stage 2/Stage 3 wave planning should get separate plans after this checkpoint is reviewed.

## Files And Responsibilities

- Create `docs/audits/feature-truth/README.md`: human-readable program index and checkpoint status.
- Create `docs/audits/feature-truth/core-foundation.md`: Core App Foundation checkpoint summary, evidence table, verification results, blockers, and GitHub issue summary.
- Create `.omc/state/feature-truth/feature-truth-map.json`: canonical feature-row ledger.
- Create `.omc/state/feature-truth/feature-truth-map.csv`: spreadsheet-friendly export of the same rows.
- Create `.omc/state/feature-truth/github-sync-log.json`: GitHub auth, milestone, label, issue creation, and update log.
- Create `.omc/state/feature-truth/raw/`: raw command outputs used as audit evidence.
- Do not modify product code during this plan.
- Do not stage pre-existing changes such as `server/src/config/routes.config.ts`, `.claude/`, `.omc/`, `.tldr/`, `.tldrignore`, or `server/.omc/` unless the user explicitly expands scope.

## Feature Row Contract

Every row in `.omc/state/feature-truth/feature-truth-map.json` must use this object shape:

```json
{
  "id": "CORE-AUTH-001",
  "domain": "core-foundation",
  "feature_name": "Authentication route registration",
  "feature_type": "server_route",
  "claim_sources": [],
  "implementation_evidence": [],
  "test_evidence": [],
  "runtime_evidence": [],
  "security_privacy_compliance_notes": [],
  "status": "unknown",
  "readiness_verdict": "needs_verification",
  "severity": "P2",
  "credential_requirement": "none",
  "github_issue": null,
  "github_prs": [],
  "last_verified_at": "2026-05-06",
  "notes": ""
}
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

---

### Task 1: Preflight And Evidence Directories

**Files:**
- Create: `docs/audits/feature-truth/README.md`
- Create: `docs/audits/feature-truth/core-foundation.md`
- Create: `.omc/state/feature-truth/feature-truth-map.json`
- Create: `.omc/state/feature-truth/feature-truth-map.csv`
- Create: `.omc/state/feature-truth/github-sync-log.json`
- Create: `.omc/state/feature-truth/raw/git-status.txt`

- [ ] **Step 1: Capture the dirty working tree before touching owned files**

Run:

```bash
git -c safe.directory='/Users/omar/GITHUB REPOS/OrbitAI/ORBITAI-Clean' status --short > .omc/state/feature-truth/raw/git-status.txt
cat .omc/state/feature-truth/raw/git-status.txt
```

Expected: output includes the current pre-existing dirty entries, including `server/src/config/routes.config.ts` and untracked local state directories. Treat those as user-owned unless the user says otherwise.

- [ ] **Step 2: Create the audit directories**

Run:

```bash
mkdir -p docs/audits/feature-truth .omc/state/feature-truth/raw
```

Expected: command exits `0`.

- [ ] **Step 3: Add the program index**

Create `docs/audits/feature-truth/README.md` with:

```markdown
# Feature Truth Audit

Date started: 2026-05-06
Milestone: `production-readiness-feature-truth`
Design spec: `docs/superpowers/specs/2026-05-06-feature-truth-program-design.md`

## Program Scope

This audit compares discoverable OrbitAI feature claims against implementation evidence, verification evidence, and production-readiness criteria.

## Checkpoints

| Checkpoint | Status | Artifact |
|---|---|---|
| Core App Foundation | In progress | `docs/audits/feature-truth/core-foundation.md` |

## Canonical State

| File | Purpose |
|---|---|
| `.omc/state/feature-truth/feature-truth-map.json` | Canonical feature ledger |
| `.omc/state/feature-truth/feature-truth-map.csv` | Spreadsheet export |
| `.omc/state/feature-truth/github-sync-log.json` | GitHub mutation log |
```

- [ ] **Step 4: Add the Core Foundation checkpoint shell**

Create `docs/audits/feature-truth/core-foundation.md` with:

```markdown
# Core App Foundation Feature Truth Checkpoint

Date started: 2026-05-06
Scope: authentication, setup wizard, project lifecycle, workspace, persistence, routing

## Summary

This checkpoint is in progress.

## Feature Rows

The canonical rows live in `.omc/state/feature-truth/feature-truth-map.json`.

## Verification Commands

Verification output is captured under `.omc/state/feature-truth/raw/`.

## Blockers

No blockers have been classified yet.

## GitHub Sync

GitHub sync has not run yet.
```

- [ ] **Step 5: Add empty machine-state files**

Create `.omc/state/feature-truth/feature-truth-map.json` with:

```json
{
  "version": 1,
  "checkpoint": "core-foundation",
  "generated_at": "2026-05-06",
  "rows": []
}
```

Create `.omc/state/feature-truth/feature-truth-map.csv` with:

```csv
id,domain,feature_name,feature_type,status,readiness_verdict,severity,credential_requirement,github_issue,last_verified_at,notes
```

Create `.omc/state/feature-truth/github-sync-log.json` with:

```json
{
  "version": 1,
  "milestone": "production-readiness-feature-truth",
  "labels": [],
  "operations": [],
  "blocked": []
}
```

- [ ] **Step 6: Validate the initial JSON files**

Run:

```bash
node -e "JSON.parse(require('fs').readFileSync('.omc/state/feature-truth/feature-truth-map.json','utf8')); JSON.parse(require('fs').readFileSync('.omc/state/feature-truth/github-sync-log.json','utf8')); console.log('json ok')"
```

Expected: prints `json ok`.

- [ ] **Step 7: Commit the scaffold**

Run:

```bash
git -c safe.directory='/Users/omar/GITHUB REPOS/OrbitAI/ORBITAI-Clean' add docs/audits/feature-truth/README.md docs/audits/feature-truth/core-foundation.md .omc/state/feature-truth/feature-truth-map.json .omc/state/feature-truth/feature-truth-map.csv .omc/state/feature-truth/github-sync-log.json
git -c safe.directory='/Users/omar/GITHUB REPOS/OrbitAI/ORBITAI-Clean' commit -m "docs: scaffold feature truth checkpoint"
```

Expected: commit includes only the five owned artifact files from this task.

---

### Task 2: Harvest Local Feature Claims

**Files:**
- Modify: `.omc/state/feature-truth/feature-truth-map.json`
- Modify: `.omc/state/feature-truth/feature-truth-map.csv`
- Modify: `docs/audits/feature-truth/core-foundation.md`
- Create: `.omc/state/feature-truth/raw/local-claims.txt`
- Create: `.omc/state/feature-truth/raw/core-foundation-files.txt`
- Create: `.omc/state/feature-truth/raw/route-config.txt`

- [ ] **Step 1: Capture local feature claims**

Run:

```bash
rg -n "auth|authentication|admin auth|OAuth|JWT|setup wizard|wizard|project lifecycle|project creation|workspace|persistence|localStorage|UserSettings|routing|viewMode|route config|React Router|MongoDB" README.md DEPLOYMENT.md RELEASE_NOTES.md USER_JOURNEY_TEST_REPORT.md docs client/src server/src shared package.json client/package.json server/package.json shared/package.json .env.example docker-compose.yml playwright.config.ts > .omc/state/feature-truth/raw/local-claims.txt
```

Expected: command exits `0` and writes claim evidence. If `rg` exits `1`, open the output file and record that no matches were found in the checkpoint summary.

- [ ] **Step 2: Capture Core Foundation file candidates**

Run:

```bash
rg --files README.md DEPLOYMENT.md RELEASE_NOTES.md USER_JOURNEY_TEST_REPORT.md docs client/src server/src shared tests package.json client/package.json server/package.json shared/package.json .env.example docker-compose.yml playwright.config.ts | rg "README|DEPLOYMENT|RELEASE|USER_JOURNEY|ARCHITECTURE|PROJECT_REVIEW|WALKTHROUGH|App\\.tsx|AppWrapper|AuthContext|WorkspaceContext|AppState|SetupView|WorkspaceView|OAuthCallback|LandingView|useViewMode|useProject|projectStorage|projectService|userSettingsApi|api\\.ts|auth\\.routes|adminAuth\\.routes|project\\.routes|userSettings\\.routes|config\\.routes|health\\.routes|routes\\.config|auth|project|workspace|login|playwright|e2e" > .omc/state/feature-truth/raw/core-foundation-files.txt
```

Expected: command exits `0` and writes candidate files for tracing.

- [ ] **Step 3: Capture route registration evidence**

Run:

```bash
sed -n '1,260p' server/src/config/routes.config.ts > .omc/state/feature-truth/raw/route-config.txt
```

Expected: file includes imports and route registrations for admin auth, auth, user settings, project, config, health, and related Core Foundation route groups where they exist.

- [ ] **Step 4: Seed the canonical feature rows**

Edit `.omc/state/feature-truth/feature-truth-map.json` so `rows` contains these initial rows:

```json
[
  {
    "id": "CORE-AUTH-001",
    "domain": "core-foundation",
    "feature_name": "Public authentication API route registration",
    "feature_type": "server_route",
    "claim_sources": ["README.md: system architecture lists JWT authentication", "docs/ARCHITECTURE.md: security architecture lists JWT tokens and refresh rotation"],
    "implementation_evidence": ["server/src/config/routes.config.ts imports auth.routes and registers versioned core routes when present", "server/src/routes/auth.routes.ts candidate file"],
    "test_evidence": [],
    "runtime_evidence": [],
    "security_privacy_compliance_notes": ["Verify JWT, refresh token, cookie, and CORS behavior before production-ready verdict"],
    "status": "unknown",
    "readiness_verdict": "needs_verification",
    "severity": "P1",
    "credential_requirement": "user credentials required for full login probe",
    "github_issue": null,
    "github_prs": [],
    "last_verified_at": "2026-05-06",
    "notes": "P1 because auth controls access to protected project data."
  },
  {
    "id": "CORE-AUTH-002",
    "domain": "core-foundation",
    "feature_name": "Client authentication state and role handling",
    "feature_type": "ui_surface",
    "claim_sources": ["README.md: platform requires authorized contributors", "docs/ARCHITECTURE.md: frontend state includes auth context"],
    "implementation_evidence": ["client/src/contexts/AuthContext.tsx candidate file", "client/src/App.tsx role and feature-access handling candidate"],
    "test_evidence": [],
    "runtime_evidence": [],
    "security_privacy_compliance_notes": ["Verify logged-in users do not fall back to stale local state for protected data"],
    "status": "unknown",
    "readiness_verdict": "needs_verification",
    "severity": "P1",
    "credential_requirement": "user credentials required for full runtime probe",
    "github_issue": null,
    "github_prs": [],
    "last_verified_at": "2026-05-06",
    "notes": "Covers client auth context, role refresh, and gated UI behavior."
  },
  {
    "id": "CORE-SETUP-001",
    "domain": "core-foundation",
    "feature_name": "Setup wizard entry and project preview flow",
    "feature_type": "ui_surface",
    "claim_sources": ["README.md: Intelligent Brainstorming pillar", "docs/WALKTHROUGH.md: setup wizard and project preview flow"],
    "implementation_evidence": ["client/src/views/SetupView.tsx candidate file", "client/src/App.tsx setupStage and projectPreview handling candidate"],
    "test_evidence": [],
    "runtime_evidence": [],
    "security_privacy_compliance_notes": ["Verify guest and authenticated setup data handling does not leak prior project state"],
    "status": "unknown",
    "readiness_verdict": "needs_verification",
    "severity": "P1",
    "credential_requirement": "LLM/provider key may be required for full preview generation",
    "github_issue": null,
    "github_prs": [],
    "last_verified_at": "2026-05-06",
    "notes": "Full preview generation is credential-dependent if it calls external LLMs."
  },
  {
    "id": "CORE-PROJECT-001",
    "domain": "core-foundation",
    "feature_name": "Project lifecycle API and persistence",
    "feature_type": "server_route",
    "claim_sources": ["README.md: project generation platform", "docs/ARCHITECTURE.md: project creation flow uses POST /api/projects and MongoDB"],
    "implementation_evidence": ["server/src/routes/project.routes.ts candidate file", "server/src/services/projectFile.service.ts candidate file", "server/src/models/Project.model.ts candidate file if present"],
    "test_evidence": [],
    "runtime_evidence": [],
    "security_privacy_compliance_notes": ["Verify project ownership checks for read, update, delete, export, and share operations"],
    "status": "unknown",
    "readiness_verdict": "needs_verification",
    "severity": "P1",
    "credential_requirement": "MongoDB and user credentials required for full runtime probe",
    "github_issue": null,
    "github_prs": [],
    "last_verified_at": "2026-05-06",
    "notes": "Covers create, load, save, delete, and ownership-sensitive project operations."
  },
  {
    "id": "CORE-WORKSPACE-001",
    "domain": "core-foundation",
    "feature_name": "Workspace loading and restoration",
    "feature_type": "ui_surface",
    "claim_sources": ["README.md: Workspace IDE architecture", "docs/ARCHITECTURE.md: workspace route and localStorage fallback"],
    "implementation_evidence": ["client/src/views/WorkspaceView.tsx candidate file", "client/src/App.tsx workspace restoration handling candidate", "client/src/contexts/WorkspaceContext.tsx candidate file"],
    "test_evidence": [],
    "runtime_evidence": [],
    "security_privacy_compliance_notes": ["Verify authenticated workspace restore does not trust localStorage for protected project selection"],
    "status": "unknown",
    "readiness_verdict": "needs_verification",
    "severity": "P1",
    "credential_requirement": "user credentials and persisted project required for full runtime probe",
    "github_issue": null,
    "github_prs": [],
    "last_verified_at": "2026-05-06",
    "notes": "Covers direct workspace load, hash-based restore, and selected project state."
  },
  {
    "id": "CORE-PERSIST-001",
    "domain": "core-foundation",
    "feature_name": "Project and preference persistence model",
    "feature_type": "client_api",
    "claim_sources": ["docs/ARCHITECTURE.md: persistence lists localStorage and shared context", "README.md: MongoDB backend architecture"],
    "implementation_evidence": ["client/src/services/projectStorage.ts candidate file", "client/src/services/userSettingsApi.ts candidate file", "server/src/routes/userSettings.routes.ts candidate file"],
    "test_evidence": [],
    "runtime_evidence": [],
    "security_privacy_compliance_notes": ["Classify localStorage fallback as implementation evidence, not production proof for authenticated user data"],
    "status": "unknown",
    "readiness_verdict": "needs_verification",
    "severity": "P1",
    "credential_requirement": "MongoDB and user credentials required for authenticated persistence probe",
    "github_issue": null,
    "github_prs": [],
    "last_verified_at": "2026-05-06",
    "notes": "Covers database-backed and browser-backed persistence paths."
  },
  {
    "id": "CORE-ROUTE-001",
    "domain": "core-foundation",
    "feature_name": "Client routing and view-mode navigation",
    "feature_type": "ui_surface",
    "claim_sources": ["docs/ARCHITECTURE.md: key views list Landing, Setup Wizard, Workspace, Admin Console", "docs/WALKTHROUGH.md: frontend views and app workflow"],
    "implementation_evidence": ["client/src/App.tsx viewMode handling candidate", "client/src/hooks/useViewMode.ts candidate file", "client/src/views/LandingView.tsx candidate file", "client/src/views/AdminView.tsx candidate file"],
    "test_evidence": [],
    "runtime_evidence": [],
    "security_privacy_compliance_notes": ["Verify protected views are gated and route aliases do not bypass access controls"],
    "status": "unknown",
    "readiness_verdict": "needs_verification",
    "severity": "P2",
    "credential_requirement": "admin credentials required for protected admin routing probe",
    "github_issue": null,
    "github_prs": [],
    "last_verified_at": "2026-05-06",
    "notes": "Covers user-visible routing for the first checkpoint."
  },
  {
    "id": "CORE-ROUTE-002",
    "domain": "core-foundation",
    "feature_name": "Server route registry and mounted API paths",
    "feature_type": "config",
    "claim_sources": ["docs/ARCHITECTURE.md: backend route layer and API paths", "server/src/config/routes.config.ts: route registry"],
    "implementation_evidence": ["server/src/config/routes.config.ts candidate file"],
    "test_evidence": [],
    "runtime_evidence": [],
    "security_privacy_compliance_notes": ["Verify admin and user route middleware is mounted on sensitive paths"],
    "status": "unknown",
    "readiness_verdict": "needs_verification",
    "severity": "P1",
    "credential_requirement": "none for static trace, credentials for protected route probes",
    "github_issue": null,
    "github_prs": [],
    "last_verified_at": "2026-05-06",
    "notes": "Current working tree already has an uncommitted modification in this file; preserve it."
  }
]
```

- [ ] **Step 5: Export the seeded CSV**

Update `.omc/state/feature-truth/feature-truth-map.csv` with:

```csv
id,domain,feature_name,feature_type,status,readiness_verdict,severity,credential_requirement,github_issue,last_verified_at,notes
CORE-AUTH-001,core-foundation,Public authentication API route registration,server_route,unknown,needs_verification,P1,user credentials required for full login probe,,2026-05-06,P1 because auth controls access to protected project data.
CORE-AUTH-002,core-foundation,Client authentication state and role handling,ui_surface,unknown,needs_verification,P1,user credentials required for full runtime probe,,2026-05-06,Covers client auth context role refresh and gated UI behavior.
CORE-SETUP-001,core-foundation,Setup wizard entry and project preview flow,ui_surface,unknown,needs_verification,P1,LLM/provider key may be required for full preview generation,,2026-05-06,Full preview generation is credential-dependent if it calls external LLMs.
CORE-PROJECT-001,core-foundation,Project lifecycle API and persistence,server_route,unknown,needs_verification,P1,MongoDB and user credentials required for full runtime probe,,2026-05-06,Covers create load save delete and ownership-sensitive project operations.
CORE-WORKSPACE-001,core-foundation,Workspace loading and restoration,ui_surface,unknown,needs_verification,P1,user credentials and persisted project required for full runtime probe,,2026-05-06,Covers direct workspace load hash-based restore and selected project state.
CORE-PERSIST-001,core-foundation,Project and preference persistence model,client_api,unknown,needs_verification,P1,MongoDB and user credentials required for authenticated persistence probe,,2026-05-06,Covers database-backed and browser-backed persistence paths.
CORE-ROUTE-001,core-foundation,Client routing and view-mode navigation,ui_surface,unknown,needs_verification,P2,admin credentials required for protected admin routing probe,,2026-05-06,Covers user-visible routing for the first checkpoint.
CORE-ROUTE-002,core-foundation,Server route registry and mounted API paths,config,unknown,needs_verification,P1,none for static trace credentials for protected route probes,,2026-05-06,Current working tree already has an uncommitted modification in this file preserve it.
```

- [ ] **Step 6: Update the checkpoint summary**

Replace the `## Summary` section in `docs/audits/feature-truth/core-foundation.md` with:

```markdown
## Summary

Initial local claim harvest is complete. The checkpoint contains eight seeded Core App Foundation rows covering authentication, setup, project lifecycle, workspace, persistence, and routing. Verification and GitHub sync are still pending.
```

- [ ] **Step 7: Validate JSON and row count**

Run:

```bash
node -e "const data=JSON.parse(require('fs').readFileSync('.omc/state/feature-truth/feature-truth-map.json','utf8')); if(data.rows.length !== 8) throw new Error('expected 8 rows, got '+data.rows.length); console.log('rows ok')"
```

Expected: prints `rows ok`.

- [ ] **Step 8: Commit the local claim harvest**

Run:

```bash
git -c safe.directory='/Users/omar/GITHUB REPOS/OrbitAI/ORBITAI-Clean' add docs/audits/feature-truth/core-foundation.md .omc/state/feature-truth/feature-truth-map.json .omc/state/feature-truth/feature-truth-map.csv .omc/state/feature-truth/raw/local-claims.txt .omc/state/feature-truth/raw/core-foundation-files.txt .omc/state/feature-truth/raw/route-config.txt
git -c safe.directory='/Users/omar/GITHUB REPOS/OrbitAI/ORBITAI-Clean' commit -m "docs: seed core foundation feature truth rows"
```

Expected: commit includes only owned audit artifacts and raw evidence from this task.

---

### Task 3: Harvest GitHub Claims And Prepare Metadata

**Files:**
- Modify: `.omc/state/feature-truth/github-sync-log.json`
- Modify: `.omc/state/feature-truth/feature-truth-map.json`
- Create: `.omc/state/feature-truth/raw/gh-auth-status.txt`
- Create: `.omc/state/feature-truth/raw/gh-repo.json`
- Create: `.omc/state/feature-truth/raw/gh-labels.json`
- Create: `.omc/state/feature-truth/raw/gh-milestones.json`
- Create: `.omc/state/feature-truth/raw/gh-issues.json`
- Create: `.omc/state/feature-truth/raw/gh-prs.json`

- [ ] **Step 1: Check GitHub authentication**

Run:

```bash
gh auth status > .omc/state/feature-truth/raw/gh-auth-status.txt 2>&1
cat .omc/state/feature-truth/raw/gh-auth-status.txt
```

Expected if authenticated: output includes the active GitHub account. Expected if blocked: output includes an auth failure; record that in `github-sync-log.json` under `blocked`.

- [ ] **Step 2: Capture GitHub repository identity**

Run:

```bash
gh repo view --json nameWithOwner,url --jq '{nameWithOwner: .nameWithOwner, url: .url}' > .omc/state/feature-truth/raw/gh-repo.json
cat .omc/state/feature-truth/raw/gh-repo.json
```

Expected if authenticated: JSON includes `nameWithOwner` and `url`. If this command fails, skip GitHub mutation steps in this task and mark GitHub evidence blocked in `github-sync-log.json`.

- [ ] **Step 3: Capture issues and pull requests**

Run:

```bash
gh issue list --state all --limit 500 --json number,title,state,labels,milestone,url,body,createdAt,updatedAt > .omc/state/feature-truth/raw/gh-issues.json
gh pr list --state all --limit 300 --json number,title,state,labels,milestone,url,body,createdAt,updatedAt,mergedAt > .omc/state/feature-truth/raw/gh-prs.json
```

Expected: both commands exit `0` and produce JSON arrays. If either command fails, record the exact command and failure text in `github-sync-log.json`.

- [ ] **Step 4: Capture and create milestone**

Run:

```bash
gh api repos/$(gh repo view --json nameWithOwner --jq .nameWithOwner)/milestones --paginate > .omc/state/feature-truth/raw/gh-milestones.json
node -e "const fs=require('fs'); const list=JSON.parse(fs.readFileSync('.omc/state/feature-truth/raw/gh-milestones.json','utf8')); process.exit(list.some(m=>m.title==='production-readiness-feature-truth')?0:1)" || gh api repos/$(gh repo view --json nameWithOwner --jq .nameWithOwner)/milestones -f title='production-readiness-feature-truth' -f state='open' -f description='Feature truth and production-readiness audit gaps'
```

Expected: milestone exists after the step. If creation fails, record the exact failure in `github-sync-log.json`.

- [ ] **Step 5: Capture and create labels**

Run:

```bash
gh label list --limit 300 --json name,color,description > .omc/state/feature-truth/raw/gh-labels.json
gh label create feature-truth --color 5319e7 --description "Feature truth audit evidence" || gh label edit feature-truth --color 5319e7 --description "Feature truth audit evidence"
gh label create implementation-gap --color d73a4a --description "Confirmed mismatch between claim and implementation" || gh label edit implementation-gap --color d73a4a --description "Confirmed mismatch between claim and implementation"
gh label create production-readiness --color b60205 --description "Production readiness blocker or verification item" || gh label edit production-readiness --color b60205 --description "Production readiness blocker or verification item"
gh label create blocked-credentials --color fbca04 --description "Verification blocked by missing credentials or access" || gh label edit blocked-credentials --color fbca04 --description "Verification blocked by missing credentials or access"
gh label create blocked-environment --color fef2c0 --description "Verification blocked by local or external environment" || gh label edit blocked-environment --color fef2c0 --description "Verification blocked by local or external environment"
gh label create security --color ee0701 --description "Security-sensitive audit item" || gh label edit security --color ee0701 --description "Security-sensitive audit item"
gh label create privacy --color c2e0c6 --description "Privacy-sensitive audit item" || gh label edit privacy --color c2e0c6 --description "Privacy-sensitive audit item"
gh label create compliance --color 1d76db --description "Compliance-sensitive audit item" || gh label edit compliance --color 1d76db --description "Compliance-sensitive audit item"
gh label create P0 --color b60205 --description "P0 release blocker" || gh label edit P0 --color b60205 --description "P0 release blocker"
gh label create P1 --color d93f0b --description "P1 high severity" || gh label edit P1 --color d93f0b --description "P1 high severity"
gh label create P2 --color fbca04 --description "P2 medium severity" || gh label edit P2 --color fbca04 --description "P2 medium severity"
gh label create P3 --color cfd3d7 --description "P3 low severity" || gh label edit P3 --color cfd3d7 --description "P3 low severity"
```

Expected: all labels exist after this step. If any label command fails, record it in `github-sync-log.json`.

- [ ] **Step 6: Update GitHub sync log**

Edit `.omc/state/feature-truth/github-sync-log.json` so it includes the operations completed in this task. Use this exact shape:

```json
{
  "version": 1,
  "milestone": "production-readiness-feature-truth",
  "labels": [
    "feature-truth",
    "implementation-gap",
    "production-readiness",
    "blocked-credentials",
    "blocked-environment",
    "security",
    "privacy",
    "compliance",
    "P0",
    "P1",
    "P2",
    "P3"
  ],
  "operations": [
    {
      "at": "2026-05-06",
      "operation": "metadata-sync",
      "result": "completed"
    }
  ],
  "blocked": []
}
```

If GitHub auth failed, use:

```json
{
  "version": 1,
  "milestone": "production-readiness-feature-truth",
  "labels": [],
  "operations": [],
  "blocked": [
    {
      "at": "2026-05-06",
      "operation": "github-auth",
      "result": "blocked",
      "evidence_file": ".omc/state/feature-truth/raw/gh-auth-status.txt"
    }
  ]
}
```

- [ ] **Step 7: Commit GitHub metadata evidence**

Run:

```bash
git -c safe.directory='/Users/omar/GITHUB REPOS/OrbitAI/ORBITAI-Clean' add .omc/state/feature-truth/github-sync-log.json .omc/state/feature-truth/raw/gh-auth-status.txt .omc/state/feature-truth/raw/gh-repo.json .omc/state/feature-truth/raw/gh-labels.json .omc/state/feature-truth/raw/gh-milestones.json .omc/state/feature-truth/raw/gh-issues.json .omc/state/feature-truth/raw/gh-prs.json
git -c safe.directory='/Users/omar/GITHUB REPOS/OrbitAI/ORBITAI-Clean' commit -m "docs: capture github feature truth evidence"
```

Expected: commit includes GitHub evidence and sync log only.

---

### Task 4: Trace Implementation Evidence

**Files:**
- Modify: `.omc/state/feature-truth/feature-truth-map.json`
- Modify: `.omc/state/feature-truth/feature-truth-map.csv`
- Modify: `docs/audits/feature-truth/core-foundation.md`
- Create: `.omc/state/feature-truth/raw/auth-trace.txt`
- Create: `.omc/state/feature-truth/raw/setup-trace.txt`
- Create: `.omc/state/feature-truth/raw/project-trace.txt`
- Create: `.omc/state/feature-truth/raw/workspace-trace.txt`
- Create: `.omc/state/feature-truth/raw/persistence-trace.txt`
- Create: `.omc/state/feature-truth/raw/routing-trace.txt`

- [ ] **Step 1: Trace authentication implementation**

Run:

```bash
rg -n "jwt|token|refresh|cookie|login|register|logout|adminToken|adminUser|requireAdmin|authenticate|AuthContext|FeatureAccess" server/src/routes/auth.routes.ts server/src/routes/adminAuth.routes.ts server/src/middleware server/src/services client/src/contexts/AuthContext.tsx client/src/App.tsx client/src/services/api.ts client/src/services/adminApi.ts > .omc/state/feature-truth/raw/auth-trace.txt
```

Expected: command exits `0` if auth implementation files exist. If a listed path is missing, rerun with the existing paths and record the missing path in `CORE-AUTH-001` or `CORE-AUTH-002` notes.

- [ ] **Step 2: Trace setup wizard implementation**

Run:

```bash
rg -n "setupStage|setupMessages|projectPreview|generateProjectPreview|Start Project|preview|wizard|setupInput|recommendedStandards|estimatedSprints" client/src/App.tsx client/src/views/SetupView.tsx client/src/services/geminiService.ts client/src/config/chatFlows.ts server/src/routes/requirements.routes.ts server/src/services/requirementsValidation.service.ts > .omc/state/feature-truth/raw/setup-trace.txt
```

Expected: command exits `0` and captures setup flow evidence.

- [ ] **Step 3: Trace project lifecycle implementation**

Run:

```bash
rg -n "createProject|saveProject|loadProject|deleteProject|export|share|Project|currentProjectId|POST|GET|PUT|DELETE|router\\." server/src/routes/project.routes.ts server/src/services/projectFile.service.ts server/src/services/projectExport.service.ts server/src/models client/src/services/projectService.ts client/src/services/projectStorage.ts client/src/handlers/projectHandlers.ts client/src/hooks/useProjectManagement.ts client/src/hooks/useProjectOperations.ts > .omc/state/feature-truth/raw/project-trace.txt
```

Expected: command exits `0` when project lifecycle files exist. Record missing path evidence if any listed path is absent.

- [ ] **Step 4: Trace workspace implementation**

Run:

```bash
rg -n "Workspace|workspace|viewMode|currentProjectId|restore|selectedProject|#workspace|WorkspaceContext|EnhancedWorkspaceView|WorkspaceView" client/src/App.tsx client/src/views/WorkspaceView.tsx client/src/views/EnhancedWorkspaceView.tsx client/src/contexts/WorkspaceContext.tsx client/src/hooks/useViewMode.ts client/src/hooks/useAppState.ts tests/e2e/workspace/workspace.spec.ts > .omc/state/feature-truth/raw/workspace-trace.txt
```

Expected: command exits `0` and captures workspace load and restore evidence.

- [ ] **Step 5: Trace persistence implementation**

Run:

```bash
rg -n "localStorage|UserSettings|userSettings|savePreferences|currentProjectId|MongoDB|mongoose|Project\\.model|projectStorage|offline|fallback|database-only" client/src/App.tsx client/src/services/projectStorage.ts client/src/services/userSettingsApi.ts server/src/routes/userSettings.routes.ts server/src/models server/src/services > .omc/state/feature-truth/raw/persistence-trace.txt
```

Expected: command exits `0` and captures browser and database persistence evidence.

- [ ] **Step 6: Trace routing implementation**

Run:

```bash
rg -n "path:|router:|filename:|viewMode|hash|pathname|OAuthCallback|LandingView|SetupView|WorkspaceView|AdminView|/api/admin|/api/v1|/api/projects|/api/auth|/health" server/src/config/routes.config.ts server/src/index.ts client/src/App.tsx client/src/AppWrapper.tsx client/src/hooks/useViewMode.ts client/src/views > .omc/state/feature-truth/raw/routing-trace.txt
```

Expected: command exits `0` and captures server and client routing evidence.

- [ ] **Step 7: Update JSON verdicts from trace evidence**

Edit `.omc/state/feature-truth/feature-truth-map.json`:

- Set `status` to `implemented` only when route/component/service evidence exists and is not contradicted by a stub or missing dependency.
- Set `status` to `partial` when the feature exists but depends on fallback state, missing credentials, missing services, or incomplete branch coverage.
- Set `status` to `missing` when the claimed file, route, component, or service is absent.
- Set `status` to `stub` when the evidence returns fixed sample data, hardcoded success, or "not implemented" behavior.
- Set `readiness_verdict` to `needs_verification` until Task 5 or Task 6 adds build, test, or runtime evidence.
- Preserve `P1` for auth, setup preview, project lifecycle, workspace restoration, persistence, and server route registry unless the trace proves the feature is low-risk.

Expected: all eight rows have at least one concrete `implementation_evidence` entry with a file path and line reference from the raw trace files.

- [ ] **Step 8: Sync CSV from JSON**

Run:

```bash
node -e "const fs=require('fs'); const data=JSON.parse(fs.readFileSync('.omc/state/feature-truth/feature-truth-map.json','utf8')); const esc=v=>String(v??'').replaceAll('\"','\"\"'); const lines=['id,domain,feature_name,feature_type,status,readiness_verdict,severity,credential_requirement,github_issue,last_verified_at,notes']; for (const r of data.rows) lines.push([r.id,r.domain,r.feature_name,r.feature_type,r.status,r.readiness_verdict,r.severity,r.credential_requirement,r.github_issue||'',r.last_verified_at,r.notes].map(v=>'\"'+esc(v)+'\"').join(',')); fs.writeFileSync('.omc/state/feature-truth/feature-truth-map.csv', lines.join('\\n')+'\\n'); console.log('csv ok')"
```

Expected: prints `csv ok`.

- [ ] **Step 9: Commit implementation trace evidence**

Run:

```bash
git -c safe.directory='/Users/omar/GITHUB REPOS/OrbitAI/ORBITAI-Clean' add docs/audits/feature-truth/core-foundation.md .omc/state/feature-truth/feature-truth-map.json .omc/state/feature-truth/feature-truth-map.csv .omc/state/feature-truth/raw/auth-trace.txt .omc/state/feature-truth/raw/setup-trace.txt .omc/state/feature-truth/raw/project-trace.txt .omc/state/feature-truth/raw/workspace-trace.txt .omc/state/feature-truth/raw/persistence-trace.txt .omc/state/feature-truth/raw/routing-trace.txt
git -c safe.directory='/Users/omar/GITHUB REPOS/OrbitAI/ORBITAI-Clean' commit -m "docs: trace core foundation implementation evidence"
```

Expected: commit includes only owned audit artifacts and raw trace files.

---

### Task 5: Run Build And Test Verification

**Files:**
- Modify: `.omc/state/feature-truth/feature-truth-map.json`
- Modify: `.omc/state/feature-truth/feature-truth-map.csv`
- Modify: `docs/audits/feature-truth/core-foundation.md`
- Create: `.omc/state/feature-truth/raw/npm-install.log`
- Create: `.omc/state/feature-truth/raw/build-shared.log`
- Create: `.omc/state/feature-truth/raw/build-client.log`
- Create: `.omc/state/feature-truth/raw/build-server.log`
- Create: `.omc/state/feature-truth/raw/test-client.log`
- Create: `.omc/state/feature-truth/raw/test-server.log`
- Create: `.omc/state/feature-truth/raw/e2e-core.log`

- [ ] **Step 1: Install dependencies**

Run:

```bash
npm install > .omc/state/feature-truth/raw/npm-install.log 2>&1
tail -80 .omc/state/feature-truth/raw/npm-install.log
```

Expected: exit `0`. If it fails, record the exact exit status and final 80 lines in `docs/audits/feature-truth/core-foundation.md` under `## Build And Test Evidence`, and mark rows that require local execution as `environment_blocked`.

- [ ] **Step 2: Build the shared package**

Run:

```bash
npm run build --workspace=shared > .omc/state/feature-truth/raw/build-shared.log 2>&1
tail -80 .omc/state/feature-truth/raw/build-shared.log
```

Expected: exit `0`. On failure, record the final 80 lines and mark affected shared-type-dependent rows as `not_ready`.

- [ ] **Step 3: Build the client**

Run:

```bash
npm run build --workspace=client > .omc/state/feature-truth/raw/build-client.log 2>&1
tail -80 .omc/state/feature-truth/raw/build-client.log
```

Expected: exit `0`. On failure, record the final 80 lines and mark UI rows as `not_ready`.

- [ ] **Step 4: Build the server**

Run:

```bash
npm run build --workspace=server > .omc/state/feature-truth/raw/build-server.log 2>&1
tail -80 .omc/state/feature-truth/raw/build-server.log
```

Expected: exit `0`. On failure, record the final 80 lines and mark route/service rows as `not_ready`.

- [ ] **Step 5: Run client tests**

Run:

```bash
npm run test --workspace=client > .omc/state/feature-truth/raw/test-client.log 2>&1
tail -120 .omc/state/feature-truth/raw/test-client.log
```

Expected: exit `0`. On failure, record the final 120 lines and link failures to Core Foundation rows when test names touch auth, setup, project, workspace, persistence, or routing.

- [ ] **Step 6: Run server tests**

Run:

```bash
npm run test --workspace=server > .omc/state/feature-truth/raw/test-server.log 2>&1
tail -120 .omc/state/feature-truth/raw/test-server.log
```

Expected: exit `0`. On failure, record the final 120 lines and link failures to Core Foundation rows when test names touch auth, project, user settings, route config, or health.

- [ ] **Step 7: Run focused Playwright coverage for Core Foundation**

Run:

```bash
npx playwright test tests/e2e/auth/login.spec.ts tests/e2e/project/projects.spec.ts tests/e2e/workspace/workspace.spec.ts --project=chromium > .omc/state/feature-truth/raw/e2e-core.log 2>&1
tail -160 .omc/state/feature-truth/raw/e2e-core.log
```

Expected: exit `0` only if local app, test credentials, and backing services are available. If tests fail because `/login`, `/dashboard`, credentials, MongoDB, or selectors are unavailable, record the exact failure and classify affected rows as `blocked_credentials`, `blocked_environment`, or `not_ready` based on evidence.

- [ ] **Step 8: Update verification evidence**

Edit `.omc/state/feature-truth/feature-truth-map.json`:

- Add build log file paths to `test_evidence` for rows affected by build success or failure.
- Add client and server test log paths to `test_evidence`.
- For failed or blocked tests, copy the shortest useful failure string into `notes`.
- Set `readiness_verdict` to `not_ready` for rows whose build or test failure proves the feature cannot ship.
- Set `readiness_verdict` to `blocked_credentials` when the only blocker is missing credentials.
- Set `readiness_verdict` to `blocked_environment` when MongoDB, Redis, local ports, or other services are unavailable.

Expected: every row has at least one `test_evidence` entry or an explicit blocker in `credential_requirement`.

- [ ] **Step 9: Update Markdown verification section**

Add this section to `docs/audits/feature-truth/core-foundation.md`, replacing command names and result values with the actual results from this task:

```markdown
## Build And Test Evidence

| Command | Result | Evidence |
|---|---|---|
| `npm install` | recorded | `.omc/state/feature-truth/raw/npm-install.log` |
| `npm run build --workspace=shared` | recorded | `.omc/state/feature-truth/raw/build-shared.log` |
| `npm run build --workspace=client` | recorded | `.omc/state/feature-truth/raw/build-client.log` |
| `npm run build --workspace=server` | recorded | `.omc/state/feature-truth/raw/build-server.log` |
| `npm run test --workspace=client` | recorded | `.omc/state/feature-truth/raw/test-client.log` |
| `npm run test --workspace=server` | recorded | `.omc/state/feature-truth/raw/test-server.log` |
| `npx playwright test tests/e2e/auth/login.spec.ts tests/e2e/project/projects.spec.ts tests/e2e/workspace/workspace.spec.ts --project=chromium` | recorded | `.omc/state/feature-truth/raw/e2e-core.log` |
```

- [ ] **Step 10: Commit verification evidence**

Run:

```bash
git -c safe.directory='/Users/omar/GITHUB REPOS/OrbitAI/ORBITAI-Clean' add docs/audits/feature-truth/core-foundation.md .omc/state/feature-truth/feature-truth-map.json .omc/state/feature-truth/feature-truth-map.csv .omc/state/feature-truth/raw/npm-install.log .omc/state/feature-truth/raw/build-shared.log .omc/state/feature-truth/raw/build-client.log .omc/state/feature-truth/raw/build-server.log .omc/state/feature-truth/raw/test-client.log .omc/state/feature-truth/raw/test-server.log .omc/state/feature-truth/raw/e2e-core.log
git -c safe.directory='/Users/omar/GITHUB REPOS/OrbitAI/ORBITAI-Clean' commit -m "docs: record core foundation verification evidence"
```

Expected: commit includes only owned audit artifacts and verification logs.

---

### Task 6: Run Lightweight Runtime Probes

**Files:**
- Modify: `.omc/state/feature-truth/feature-truth-map.json`
- Modify: `.omc/state/feature-truth/feature-truth-map.csv`
- Modify: `docs/audits/feature-truth/core-foundation.md`
- Create: `.omc/state/feature-truth/raw/runtime-probes.md`
- Create: `.omc/state/feature-truth/raw/health-probe.txt`
- Create: `.omc/state/feature-truth/raw/root-probe.txt`
- Create: `.omc/state/feature-truth/raw/auth-probe.txt`

- [ ] **Step 1: Start the dev app for runtime probing**

Run:

```bash
npm run dev > .omc/state/feature-truth/raw/dev-server.log 2>&1 &
echo $! > .omc/state/feature-truth/raw/dev-server.pid
sleep 20
tail -120 .omc/state/feature-truth/raw/dev-server.log
```

Expected: dev server starts frontend on `http://localhost:5173` and backend on the configured port. If startup fails, record the final 120 lines and mark runtime probes as `blocked_environment`.

- [ ] **Step 2: Probe frontend root**

Run:

```bash
curl -i http://localhost:5173/ > .omc/state/feature-truth/raw/root-probe.txt 2>&1
head -40 .omc/state/feature-truth/raw/root-probe.txt
```

Expected: HTTP `200` or a clear dev-server response. If connection is refused, record `blocked_environment` for client routing and setup/workspace UI runtime evidence.

- [ ] **Step 3: Probe backend health on known ports**

Run:

```bash
(curl -i http://localhost:3002/health || curl -i http://localhost:3001/health || true) > .omc/state/feature-truth/raw/health-probe.txt 2>&1
cat .omc/state/feature-truth/raw/health-probe.txt
```

Expected: a health response if the server exposes `/health` on `3002` or `3001`. If both fail, record the port/config contradiction using evidence from `README.md`, `.env.example`, `server/src/config/env.ts`, and `client/vite.config.ts`.

- [ ] **Step 4: Probe auth route availability without credentials**

Run:

```bash
(curl -i -X POST http://localhost:3002/api/auth/login -H 'content-type: application/json' --data '{"email":"audit@example.com","password":"not-a-real-password"}' || curl -i -X POST http://localhost:3001/api/auth/login -H 'content-type: application/json' --data '{"email":"audit@example.com","password":"not-a-real-password"}' || true) > .omc/state/feature-truth/raw/auth-probe.txt 2>&1
cat .omc/state/feature-truth/raw/auth-probe.txt
```

Expected: route returns a controlled authentication failure, validation failure, or protected-route response. Connection refusal, HTML frontend response, or unhandled server error is evidence for `not_ready` or `blocked_environment`.

- [ ] **Step 5: Stop the dev app**

Run:

```bash
kill $(cat .omc/state/feature-truth/raw/dev-server.pid) 2>/dev/null || true
```

Expected: command exits `0`.

- [ ] **Step 6: Write runtime probe summary**

Create `.omc/state/feature-truth/raw/runtime-probes.md` with:

```markdown
# Core Foundation Runtime Probes

Date: 2026-05-06

| Probe | Evidence File | Result |
|---|---|---|
| Frontend root | `.omc/state/feature-truth/raw/root-probe.txt` | recorded |
| Backend health | `.omc/state/feature-truth/raw/health-probe.txt` | recorded |
| Auth login route without credentials | `.omc/state/feature-truth/raw/auth-probe.txt` | recorded |
```

- [ ] **Step 7: Update runtime evidence in JSON**

Edit `.omc/state/feature-truth/feature-truth-map.json`:

- Add `.omc/state/feature-truth/raw/root-probe.txt` to `CORE-SETUP-001`, `CORE-WORKSPACE-001`, and `CORE-ROUTE-001` runtime evidence.
- Add `.omc/state/feature-truth/raw/health-probe.txt` to `CORE-ROUTE-002` runtime evidence.
- Add `.omc/state/feature-truth/raw/auth-probe.txt` to `CORE-AUTH-001` runtime evidence.
- If backend port mismatch is proven, add it to `CORE-ROUTE-002` notes and set `readiness_verdict` to `not_ready` unless both documented ports work.

Expected: runtime evidence is recorded or explicitly blocked for all rows where a local probe was possible.

- [ ] **Step 8: Commit runtime evidence**

Run:

```bash
git -c safe.directory='/Users/omar/GITHUB REPOS/OrbitAI/ORBITAI-Clean' add docs/audits/feature-truth/core-foundation.md .omc/state/feature-truth/feature-truth-map.json .omc/state/feature-truth/feature-truth-map.csv .omc/state/feature-truth/raw/runtime-probes.md .omc/state/feature-truth/raw/dev-server.log .omc/state/feature-truth/raw/root-probe.txt .omc/state/feature-truth/raw/health-probe.txt .omc/state/feature-truth/raw/auth-probe.txt
git -c safe.directory='/Users/omar/GITHUB REPOS/OrbitAI/ORBITAI-Clean' commit -m "docs: record core foundation runtime probes"
```

Expected: commit includes owned runtime evidence files only.

---

### Task 7: Create Or Update GitHub Issues For Confirmed Gaps

**Files:**
- Modify: `.omc/state/feature-truth/github-sync-log.json`
- Modify: `.omc/state/feature-truth/feature-truth-map.json`
- Modify: `.omc/state/feature-truth/feature-truth-map.csv`
- Modify: `docs/audits/feature-truth/core-foundation.md`
- Create: `.omc/state/feature-truth/raw/created-issues.txt`

- [ ] **Step 1: Identify confirmed gaps**

Run:

```bash
node -e "const data=JSON.parse(require('fs').readFileSync('.omc/state/feature-truth/feature-truth-map.json','utf8')); for (const r of data.rows) if (['partial','stub','missing','contradicted','environment_blocked'].includes(r.status) || ['not_ready','blocked_credentials','blocked_environment'].includes(r.readiness_verdict)) console.log(r.id+'\\t'+r.severity+'\\t'+r.status+'\\t'+r.readiness_verdict+'\\t'+r.feature_name)"
```

Expected: prints one line per row that needs issue consideration. P0/P1 rows need static plus build/test/runtime proof where feasible. P2/P3 rows can use strong static proof.

- [ ] **Step 2: Create one issue per confirmed gap**

For each confirmed gap, run this command after replacing the shell variables with that row's actual values from the JSON ledger:

```bash
FEATURE_ID='CORE-ROUTE-002'
TITLE='[Feature Truth] CORE-ROUTE-002 Server route registry and mounted API paths'
BODY_FILE='.omc/state/feature-truth/raw/issue-CORE-ROUTE-002.md'
cat > "$BODY_FILE" <<'ISSUE'
## Feature ID

CORE-ROUTE-002

## Domain

core-foundation

## Claim Source

docs/ARCHITECTURE.md and server/src/config/routes.config.ts claim mounted API route behavior for Core Foundation.

## Implementation Evidence

See `.omc/state/feature-truth/feature-truth-map.json` row `CORE-ROUTE-002` and raw trace files under `.omc/state/feature-truth/raw/`.

## Verification Evidence

See build, test, and runtime evidence under `.omc/state/feature-truth/raw/`.

## Expected Behavior

Documented Core Foundation routes are mounted on the documented backend port and protected middleware is applied to sensitive routes.

## Actual Behavior

Use the row notes from `.omc/state/feature-truth/feature-truth-map.json`.

## Security, Privacy, Compliance

Route middleware and protected paths affect authorization and data exposure.
ISSUE
gh issue create \
  --title "$TITLE" \
  --body-file "$BODY_FILE" \
  --label feature-truth \
  --label implementation-gap \
  --label production-readiness \
  --label P1 \
  --milestone production-readiness-feature-truth | tee -a .omc/state/feature-truth/raw/created-issues.txt
```

Expected: `gh issue create` prints the issue URL. If GitHub mutation is blocked, record the command and failure in `github-sync-log.json`, and leave `github_issue` as `null`.

- [ ] **Step 3: Update row links**

Edit `.omc/state/feature-truth/feature-truth-map.json`:

- Set `github_issue` to the created issue URL for each row with a created issue.
- Leave `github_issue` as `null` for rows whose issue creation was blocked.
- Add a `github-sync` operation entry to `.omc/state/feature-truth/github-sync-log.json` for each created or blocked issue.

Expected: every confirmed gap row either has a GitHub issue URL or a GitHub sync blocker entry.

- [ ] **Step 4: Sync CSV from JSON**

Run:

```bash
node -e "const fs=require('fs'); const data=JSON.parse(fs.readFileSync('.omc/state/feature-truth/feature-truth-map.json','utf8')); const esc=v=>String(v??'').replaceAll('\"','\"\"'); const lines=['id,domain,feature_name,feature_type,status,readiness_verdict,severity,credential_requirement,github_issue,last_verified_at,notes']; for (const r of data.rows) lines.push([r.id,r.domain,r.feature_name,r.feature_type,r.status,r.readiness_verdict,r.severity,r.credential_requirement,r.github_issue||'',r.last_verified_at,r.notes].map(v=>'\"'+esc(v)+'\"').join(',')); fs.writeFileSync('.omc/state/feature-truth/feature-truth-map.csv', lines.join('\\n')+'\\n'); console.log('csv ok')"
```

Expected: prints `csv ok`.

- [ ] **Step 5: Update checkpoint GitHub section**

Replace the `## GitHub Sync` section in `docs/audits/feature-truth/core-foundation.md` with:

```markdown
## GitHub Sync

Milestone: `production-readiness-feature-truth`

GitHub sync results are recorded in `.omc/state/feature-truth/github-sync-log.json`.
Created issue URLs are stored per row in `.omc/state/feature-truth/feature-truth-map.json`.
```

- [ ] **Step 6: Commit GitHub issue links**

Run:

```bash
git -c safe.directory='/Users/omar/GITHUB REPOS/OrbitAI/ORBITAI-Clean' add docs/audits/feature-truth/core-foundation.md .omc/state/feature-truth/feature-truth-map.json .omc/state/feature-truth/feature-truth-map.csv .omc/state/feature-truth/github-sync-log.json .omc/state/feature-truth/raw/created-issues.txt .omc/state/feature-truth/raw/issue-*.md
git -c safe.directory='/Users/omar/GITHUB REPOS/OrbitAI/ORBITAI-Clean' commit -m "docs: sync core foundation feature truth issues"
```

Expected: commit includes owned audit artifacts, issue bodies, and sync logs.

---

### Task 8: Finalize Core Foundation Checkpoint

**Files:**
- Modify: `docs/audits/feature-truth/README.md`
- Modify: `docs/audits/feature-truth/core-foundation.md`
- Modify: `.omc/state/feature-truth/feature-truth-map.json`
- Modify: `.omc/state/feature-truth/feature-truth-map.csv`

- [ ] **Step 1: Generate row counts**

Run:

```bash
node -e "const data=JSON.parse(require('fs').readFileSync('.omc/state/feature-truth/feature-truth-map.json','utf8')); const count=(k,v)=>data.rows.filter(r=>r[k]===v).length; console.log(JSON.stringify({total:data.rows.length,status:Object.fromEntries(['implemented','partial','stub','missing','contradicted','environment_blocked','unknown'].map(s=>[s,count('status',s)])),readiness:Object.fromEntries(['production_ready','needs_verification','not_ready','blocked_credentials','blocked_environment','not_applicable'].map(s=>[s,count('readiness_verdict',s)]))},null,2))" > .omc/state/feature-truth/raw/core-foundation-counts.json
cat .omc/state/feature-truth/raw/core-foundation-counts.json
```

Expected: JSON count summary prints with `total` equal to the current row count.

- [ ] **Step 2: Render the feature table into Markdown**

Run:

```bash
node -e "const fs=require('fs'); const data=JSON.parse(fs.readFileSync('.omc/state/feature-truth/feature-truth-map.json','utf8')); const lines=['| ID | Feature | Status | Readiness | Severity | GitHub |','|---|---|---|---|---|---|']; for (const r of data.rows) lines.push('| '+[r.id,r.feature_name,r.status,r.readiness_verdict,r.severity,r.github_issue||''].map(v=>String(v).replaceAll('|','/')).join(' | ')+' |'); console.log(lines.join('\\n'))" > .omc/state/feature-truth/raw/core-foundation-table.md
cat .omc/state/feature-truth/raw/core-foundation-table.md
```

Expected: Markdown table prints one row per feature row.

- [ ] **Step 3: Update Core Foundation checkpoint document**

Edit `docs/audits/feature-truth/core-foundation.md` so it contains these sections in order:

```markdown
# Core App Foundation Feature Truth Checkpoint

Date started: 2026-05-06
Scope: authentication, setup wizard, project lifecycle, workspace, persistence, routing

## Summary

The Core App Foundation checkpoint contains the row count from `.omc/state/feature-truth/raw/core-foundation-counts.json`. The summary states the strongest supported conclusion from the final ledger counts and verification evidence.

## Feature Rows

Paste the table from `.omc/state/feature-truth/raw/core-foundation-table.md`.

## Build And Test Evidence

Keep the command table from Task 5.

## Runtime Evidence

Keep the runtime probe summary from Task 6.

## Blockers

List every row whose readiness verdict is `blocked_credentials` or `blocked_environment`, with its exact blocker.

## GitHub Sync

Milestone: `production-readiness-feature-truth`

GitHub sync results are recorded in `.omc/state/feature-truth/github-sync-log.json`.
```

The committed file must contain the actual row count and conclusion from the generated evidence, not the instructional sentence above.

- [ ] **Step 4: Update program index**

Change the checkpoint table in `docs/audits/feature-truth/README.md` to:

```markdown
| Checkpoint | Status | Artifact |
|---|---|---|
| Core App Foundation | Ready for review | `docs/audits/feature-truth/core-foundation.md` |
```

- [ ] **Step 5: Run final self-checks**

Run:

```bash
node -e "const fs=require('fs'); const paths=['docs/audits/feature-truth/README.md','docs/audits/feature-truth/core-foundation.md','.omc/state/feature-truth/feature-truth-map.json','.omc/state/feature-truth/github-sync-log.json']; const banned=['TB'+'D','TO'+'DO','FIX'+'ME','implement '+'later','fill '+'in details','Similar '+'to Task','add '+'appropriate','instructional '+'sentence above']; let failed=false; for (const p of paths) { const text=fs.readFileSync(p,'utf8'); for (const b of banned) if (text.includes(b)) { console.error(p+': '+b); failed=true; } } process.exit(failed?1:0)"
node -e "const data=JSON.parse(require('fs').readFileSync('.omc/state/feature-truth/feature-truth-map.json','utf8')); const required=['id','domain','feature_name','feature_type','claim_sources','implementation_evidence','test_evidence','runtime_evidence','security_privacy_compliance_notes','status','readiness_verdict','severity','credential_requirement','github_issue','github_prs','last_verified_at','notes']; for (const [i,row] of data.rows.entries()) for (const key of required) if (!(key in row)) throw new Error('row '+i+' missing '+key); console.log('ledger schema ok')"
```

Expected: first command prints no committed red flags except raw evidence text from external command output; second command prints `ledger schema ok`.

- [ ] **Step 6: Commit final checkpoint**

Run:

```bash
git -c safe.directory='/Users/omar/GITHUB REPOS/OrbitAI/ORBITAI-Clean' add docs/audits/feature-truth/README.md docs/audits/feature-truth/core-foundation.md .omc/state/feature-truth/feature-truth-map.json .omc/state/feature-truth/feature-truth-map.csv .omc/state/feature-truth/raw/core-foundation-counts.json .omc/state/feature-truth/raw/core-foundation-table.md
git -c safe.directory='/Users/omar/GITHUB REPOS/OrbitAI/ORBITAI-Clean' commit -m "docs: finalize core foundation feature truth checkpoint"
```

Expected: commit includes only owned final checkpoint artifacts.

---

## Verification Before Completion

Before claiming the checkpoint is complete, run:

```bash
git -c safe.directory='/Users/omar/GITHUB REPOS/OrbitAI/ORBITAI-Clean' status --short
node -e "const data=JSON.parse(require('fs').readFileSync('.omc/state/feature-truth/feature-truth-map.json','utf8')); if (!data.rows.length) throw new Error('no rows'); for (const r of data.rows) { if (!r.implementation_evidence.length) throw new Error(r.id+' missing implementation evidence'); if (!r.test_evidence.length && !String(r.credential_requirement).includes('required')) throw new Error(r.id+' missing test evidence or blocker'); } console.log('checkpoint evidence ok')"
```

Expected:

- `git status --short` may still show pre-existing user-owned changes.
- The second command prints `checkpoint evidence ok`.

## Handoff

When this plan finishes, report:

- Commit SHAs created by this plan.
- Feature row counts by status and readiness verdict.
- GitHub issues created or blocked.
- Verification commands run and their results.
- Remaining blockers for the next domain checkpoint.
