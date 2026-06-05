# OrbitAI Harness — P0 + P1 Implementation Plan

> Turns the P0/P1 remediation list from `HARNESS_COMPLETENESS_SCORECARD.md` into concrete, code-grounded work items. Each item has: objective, current state (with `file:line`), the exact change (with code sketches), dependencies, risks, tests, and effort (S ≤ ½ day · M = 1–2 days · L = 3–5 days, single dev).
>
> **Goal of P0+P1:** make the agent loop *actually run with tools on the main route, across providers, safely* — moving the scorecard's loop/tools/MCP/guardrails rows from 1–2 toward 3. Runner is **vitest** (`server/vitest.config.ts`), not jest — all new tests are vitest.

---

## Sequencing (read this first)

```
        WI-1 ──────────────► WI-3a ─────────────► WI-3c (optional/defer)
   (un-starve route)     (OpenAI continuation)   (message threading)
        │
        ├──────────────► WI-3b (Anthropic native)
        │
        ▼
   WI-2 (SECURITY) ──── must land BEFORE ──► WI-5 (MCP tools reachable)
        │                                         ▲
        │                                         │
        └─────────────► WI-4 (tool registry) ─────┘
                        (validation + allowlist)

   WI-6 (ergonomics: maxIter / parallel / timeouts) — independent, slot anytime
```

**Hard ordering constraint:** **WI-2 (security) must merge before WI-5.** WI-5 lets the *model* trigger `mcpService.callTool`, which for `stdio` servers spawns shell commands with inherited secrets (`mcp.service.ts:1047`). Wiring that path before the exec hole is closed turns a latent vuln into a live, model-reachable RCE.

### Milestones
- **M-A "Loop breathes"** → WI-1 + WI-3a + WI-6a (configurable `maxIterations` + Codex timeout). Outcome: **Gemini & OpenAI tool loop works end-to-end on `/execute-task`.**
- **M-B "All providers, safe exec"** → WI-3b (Anthropic) + WI-2 (security) + WI-4 (registry/validation/allowlist).
- **M-C "Full tool reach + ergonomics"** → WI-5 (MCP reachable) + WI-6b (parallel calls, provider timeout) + WI-3c (message threading, optional).

---

## WI-1 (P0) — Un-starve the loop & align the request contract  ·  Effort: **S**

**Objective.** Stop discarding the tools the client already sends, so the model receives tool declarations on the primary route.

**Current state.**
- Client sends a full payload incl. `tools` + `functionDeclarations` (`client/src/services/geminiService.ts:748-762`); `functionDeclarations` is a flat `[{name, description, parameters}]` array built at `:533-620` (MCP-discovered tools + `create_mcp_server`).
- Server destructures only `{ task, projectState, useInternet, mcpServers, selectedStandards }` (`server/src/routes/llm.routes.ts:433`) and hardcodes `const tools: any[] = []` (`:447`).
- **Contract mismatches** (silent bugs): client sends `projectContext` (server reads `projectState`) and `standards` (server reads `selectedStandards`) → `projectState?.id`/`?.description` and standards are always undefined today.

**Changes — `server/src/routes/llm.routes.ts` (execute-task, 431-488):**
```ts
const {
  task, projectState, projectContext, useInternet, mcpServers,
  selectedStandards, standards, tools: clientTools, functionDeclarations,
} = req.body;

const project = projectState ?? projectContext;                 // reconcile contract
const standardsList = selectedStandards ?? standards ?? [];

// `functionDeclarations` (flat [{name,description,parameters}]) is the SOURCE OF TRUTH: it's
// always populated (MCP tools + create_mcp_server) and the wrapped shape below works for all
// three provider converters. Do NOT blindly prefer `clientTools` — its shape is built at an
// UNREAD line (geminiService.ts:736) and may be flat. If it's flat, convertToolsToOpenAIFormat
// finds no `.functionDeclarations` per element and emits ZERO tools — silently re-starving the
// exact providers M-A is trying to unblock.
const tools: any[] =
  Array.isArray(functionDeclarations) && functionDeclarations.length
    ? [{ functionDeclarations }]                                  // shape consumed by Gemini + OpenAI/Anthropic converters
    : (Array.isArray(clientTools) && clientTools.length ? clientTools /* ONLY once its shape is verified wrapped */ : []);
```
Then replace later uses of `projectState?.…` with `project?.…` and `selectedStandards` with `standardsList`.

**Verify both directions (do not assume) — this is the make-or-break of M-A:**
1. **Down-path:** `LLMRouter.executeWithProvider` forwards `context.tools` into each provider's `generateContent` config. OpenAI consumes `configOptions.tools` (`OpenAIService.ts:91-102`); Gemini reads `config.tools`. If any active branch drops it, add the pass-through.
2. **Up-path:** `executeWithFallback`'s normalized return must propagate `functionCalls` back up — the route only enters the loop on `responseWithFunctionCalls.functionCalls?.length` (`llm.routes.ts:468`). If `executeWithProvider`'s normalization drops `functionCalls`, M-A fails even with tools flowing down and providers parsing correctly. Confirm the normalized response carries `functionCalls` through.

**Depends on:** none. **Risks:** provider SDKs reject a malformed `tools` shape → validate shape; keep the empty-array→`undefined` guard the router already uses. **Tests:** route unit test asserting `functionDeclarations` in → non-empty `tools` reaches `executeWithFallback` (spy); regression test for the `projectContext`/`standards` aliasing. **Outcome:** Gemini + OpenAI (whose providers already parse tool calls) can emit function calls on the first turn.

---

## WI-2 (P0) — Close the execution hole (security)  ·  Effort: **M–L**  ·  *spun off*

**Objective.** Remove the model/user-reachable RCE and secret-leak before the loop can trigger MCP execution.

**Already filed** as a separate task (see chip "Fix unsandboxed MCP stdio RCE + plaintext secrets"). Scope recap, all with evidence in `HARNESS_ARCHITECTURE.md → Security-critical path`:
- Drop `env: { ...process.env }` on spawned MCP processes; pass an explicit minimal allowlist (`mcp.service.ts:1047-1051`, health-check `:994-997`).
- Allowlist permitted stdio commands; make stdio-server creation admin-only/approved (block agents + guests).
- Encrypt MCP `config.apiKey` at rest + redact on read (`MCPServer.model.ts:72`).
- Remove guest bypass on state-changing/agent routes (`auth.ts:38-46`).
- Re-enable CUA sandbox + require auth/rate-limit (`cua.service.ts:83`, `cua.routes.ts:26`).

**Sequencing:** **must precede WI-5.** **Tests:** non-allowlisted command rejected; spawned env carries no secrets; guest/agent cannot create stdio servers; stored keys encrypted/redacted.

---

## WI-3 (P1) — Native function-calling on the continuation turns  ·  Effort: **3a S · 3b M · 3c L**

**Objective.** Make the loop detect real tool calls on *every* turn for OpenAI/Anthropic, not just turn 1 — replacing the regex hardcoded to `create_mcp_server` (`FunctionCallProcessor.ts:351,367`).

### WI-3a — OpenAI continuation (small; provider already supports it)
`OpenAIService.generateContent` already converts tools and parses `tool_calls`, returning `functionCalls` (`OpenAIService.ts:90-126`). The loop throws that away: `continueOpenAIConversation` (`FunctionCallProcessor.ts:288-307`) omits `tools` and runs `extractFunctionCallsFromText`.
```ts
// FunctionCallProcessor.continueOpenAIConversation
const result = await openAIService.generateContent(prompt, model, {
  systemInstruction, temperature: 0.7,
  tools: tools.length ? tools : undefined,            // ← pass tools
});
return {
  text: result.text,
  functionCalls: result.functionCalls?.length ? result.functionCalls : undefined,  // ← native
  usage: { promptTokens: result.usage.promptTokens, candidatesTokens: result.usage.completionTokens, totalTokens: result.usage.totalTokens },
  modelUsed: model, provider: 'openai',
};
```
(DeepSeek/Grok ride this same path — `:222,226`.) Delete the now-unused `extractFunctionCallsFrom*` + `convertToolsToOpenAIFormat` copies in FCP (`:346-439`) once Anthropic no longer needs the text fallback.

### WI-3b — Anthropic native tool use (real work)
Anthropic provider has **no** tool support: `LLMConfig` lacks `tools`, `messages.create` omits them, and only text blocks are read (`AnthropicService.ts:28-32,58-74`).
- Add `tools?: any[]` to `AnthropicService.LLMConfig`; add `functionCalls?` to its `LLMResponse`.
- Convert Gemini-shape `functionDeclarations` → Anthropic shape and pass through:
```ts
const anthropicTools = (configOptions?.tools ?? []).flatMap((t: any) =>
  (t.functionDeclarations ?? []).map((f: any) => ({
    name: f.name, description: f.description, input_schema: f.parameters ?? { type: 'object', properties: {} },
  })));
const response = await client.messages.create({
  model, max_tokens: configOptions?.maxTokens || 4096, temperature: configOptions?.temperature || 0.7,
  system: configOptions?.systemInstruction,
  tools: anthropicTools.length ? anthropicTools : undefined,
  messages: [{ role: 'user', content: prompt }],
});
const functionCalls = response.content
  .filter((b: any) => b.type === 'tool_use')
  .map((b: any) => ({ name: b.name, args: b.input ?? {} }));
```
- `continueAnthropicConversation` (`FunctionCallProcessor.ts:313`): pass `tools`, return provider `functionCalls`.
- Forward `context.tools` in the router's Anthropic branch (same check as WI-1).

### WI-3c — Thread a real message history (optional in P1; can defer to P2)
Today results are flattened into a fresh prompt each turn via `buildContinuationPrompt` (`FunctionCallProcessor.ts:176-196`), losing tool-call/result linkage and history. The durable fix: carry a `messages[]` array (assistant tool_call → tool result parts) through the loop and provider calls. This is the heaviest change (new message-based provider entrypoints) and **does not block tool execution** — schedule after M-A/M-B if time-boxed.

**Depends on:** WI-1. **Risks:** per-provider tool-schema drift → centralize conversion (feeds WI-4). **Tests:** mocked-SDK unit tests per provider: tool in → parsed `functionCalls` out; loop test that a 2nd-turn tool call is detected for OpenAI + Anthropic.

---

## WI-4 (P1) — Server-side tool registry the loop reads (+ arg validation + allowlist)  ·  Effort: **M–L**

**Objective.** Give the loop a real, validated, permissioned tool surface instead of the two hardcoded functions (`agentFunctionHandler.service.ts:35-50` only does `create_mcp_server`; `FunctionCallProcessor.ts:87-100` only adds `google_search`).

**Current state.** A registry already exists but is orphaned: `dynamicToolingService` has `registeredTools`/`toolExecutors` Maps and a `DynamicTool` type (`dynamicTooling.service.ts:17-95`) — never imported by the loop.

**Changes.**
1. **Resolver** — new `server/src/services/toolRegistry.service.ts` that builds a per-request map `toolName → { kind: 'mcp'|'builtin'|'create_mcp_server', serverId?, schema }` from:
   - MCP tools discovered for the request's `mcpServers` (names + `inputSchema`),
   - `dynamicToolingService` built-ins,
   - the `create_mcp_server` special case.
2. **Validation** — validate `functionCall.args` against the tool's JSON schema (add `ajv`) before dispatch; on failure feed a structured error back into the loop (the loop already tolerates `{error}` results, `FunctionCallProcessor.ts:122-128`).
3. **Allowlist** — only dispatch tools that were **declared to the model this request** (the `functionDeclarations` name set) and permitted for the agent role. Unknown/contraband name → refuse with an error result, never execute.
4. **Dispatch** — replace the `else → agentFunctionHandler` branch (`FunctionCallProcessor.ts:98-121`) with `toolRegistry.dispatch(functionCall, ctx)`; keep `create_mcp_server` behind the WI-2 authorization gate.

**Depends on:** WI-1 (tools flowing). **Pairs with:** WI-5 (MCP execution). **Risks:** schema gaps for MCP tools with empty `inputSchema` → treat empty schema as "no validation" but still allowlist-gate. **Tests:** arg-validation reject; non-allowlisted tool refused; builtin + MCP tool both dispatch.

---

## WI-5 (P1) — Make MCP-client tools reachable from the loop  ·  Effort: **M**  ·  *after WI-2 + WI-4*

**Objective.** Let the model actually call user MCP tools, not just `google_search`. The real client already works — `mcpService.callTool(serverId, toolName, args)` routes `mcp-user-*` to the live MCP client (`mcp.service.ts:577-602` → `executeUserMCPServerTool`); it's just not reachable from the loop.

**Changes.** In the WI-4 resolver, map each MCP tool name → its `serverId` (from discovery), and have `dispatch` call `mcpService.callTool(serverId, toolName, args)` for `kind:'mcp'`. Generalize the existing `google_search`→`mcp-sys-3` special-case (`FunctionCallProcessor.ts:87-93`) into this path.

**Discovery-source decision (required for the name→serverId map to have data).** Today the *client* did MCP tool discovery (`geminiService.ts:566-578`); the server has no name→serverId map. WI-4/5 must choose one: (a) **re-discover server-side** by connecting to the request's `mcpServers` and listing tools (a real connect cost per request — cache it), or (b) **trust a client-supplied** `{toolName: serverId}` map sent alongside `functionDeclarations` (cheap, but the allowlist in WI-4 becomes the trust boundary). Recommended: (a) with a short-TTL cache, mirroring the client's existing tool cache.

**Depends on:** **WI-2 (mandatory)** + WI-4. **Risks:** a hung MCP server → relies on WI-6 timeout; tool-name collisions across servers → qualify by serverId in the resolver. **Tests:** loop calls a mocked `mcp-user-*` tool end-to-end; stdio server still blocked unless WI-2-authorized.

---

## WI-6 (P1) — Loop ergonomics: iterations, parallelism, timeouts  ·  Effort: **6a S · 6b M**

### WI-6a — configurable iteration cap + Codex timeout (small, do in M-A)
- `FunctionCallProcessor.maxIterations` is a hardcoded `5` (`:50`). Make it configurable (constructor/env `FCP_MAX_ITERATIONS`, optional per-call override) — agentic multi-step tasks need more headroom.
- **Codex CLI has no timeout** — `spawnAndWait` only handles `error`/`exit` (`CodexCLIService.ts:120-137`), so a hung `codex exec` hangs the request. Add a timer + kill:
```ts
const TIMEOUT_MS = Number(process.env.CODEX_CLI_TIMEOUT_MS) || 120_000;
const timer = setTimeout(() => { child.kill('SIGTERM'); reject(new Error('Codex CLI timed out')); }, TIMEOUT_MS);
child.on('exit', () => clearTimeout(timer));   // clear on both exit and error
```

### WI-6b — parallel tool calls + provider-call timeout
- The loop executes calls **sequentially** (`FunctionCallProcessor.ts:82`). Run independent calls concurrently with `Promise.all`, preserving result order:
```ts
const functionResponses = await Promise.all(
  currentResponse.functionCalls.map(fc => executeOne(fc).catch(e => ({ name: fc.name, response: { error: e.message } })))
);
```
- Add a **per-request provider timeout** on the live path (`Promise.race` wrapper in `LLMRouter.executeWithProvider`). A timeout deadline exists today only in the dead `RoutingEngine.executeWithFallback` — bring a minimal version into the hot path.

**Depends on:** none (6a); WI-4/5 benefit from 6b. **Risks:** parallel tool calls with side effects → only parallelize read-style tools, or gate by a `parallelizable` flag in the registry. **Tests:** timeout fires and rejects cleanly (Codex + provider); parallel results keep input order; iteration cap honored.

---

## Cross-cutting

- **Feature-flag the new path.** Guard "tools actually flow + dispatch" behind an env flag (e.g. `HARNESS_TOOLS_ENABLED`) so M-A can ship dark and be canaried; default off until WI-2 lands.
- **Centralize tool-schema conversion** (Gemini ⇄ OpenAI ⇄ Anthropic) in one module — WI-3 and WI-4 both need it; avoid the current per-file duplication.
- **Tests:** vitest only. Remove/replace the orphan root `jest.config.js` (jest isn't installed) so CI reflects reality (scorecard #15).
- **Observability hook (cheap add):** set a `traceId` per execute-task run and log it through the loop (the field already exists in audit models, just never set) — makes WI-3/4/5 debuggable.

## Definition of done (P0 + P1)
- [ ] WI-1: `functionDeclarations` from the client reach the provider; `projectContext`/`standards` aliases fixed; verified the router forwards `context.tools`.
- [ ] WI-2: security task merged + tests green (RCE path closed) **before** WI-5.
- [ ] WI-3: OpenAI + Anthropic emit/parse native tool calls on continuation turns; create_mcp_server regex retired.
- [ ] WI-4: registry dispatch with JSON-schema arg validation + declared-tool allowlist.
- [ ] WI-5: model can invoke a user MCP tool end-to-end (stdio gated by WI-2).
- [ ] WI-6: configurable iteration cap; Codex + provider timeouts; parallel (read-safe) tool calls.
- [ ] Scorecard re-rated: target Agent loop 2→3, Tool system 1→3, MCP 2→3, Guardrails 2→3.
```
