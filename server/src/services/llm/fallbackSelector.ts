/**
 * Fallback model selection (resilience — dimension 12).
 *
 * Pure, testable helper that chooses a fallback model after a provider failure, preferring a
 * configured default provider, then Gemini, then anything available — while EXCLUDING the provider
 * that just failed so a failover actually moves to a different backend (the old inline logic could
 * re-pick the same failing provider).
 */

export interface FallbackCandidate {
  provider: string;
  modelIdentifier?: string;
  name?: string;
  [key: string]: any;
}

export function pickFallbackModel(
  activeModels: FallbackCandidate[],
  opts: { defaultProvider?: string; excludeProvider?: string } = {}
): FallbackCandidate | null {
  if (!Array.isArray(activeModels) || activeModels.length === 0) return null;

  const { defaultProvider = 'gemini', excludeProvider } = opts;

  // Prefer models NOT from the failed provider; if excluding leaves nothing, allow the full list.
  const filtered = excludeProvider
    ? activeModels.filter(m => m.provider !== excludeProvider)
    : activeModels;
  const pool = filtered.length > 0 ? filtered : activeModels;

  return (
    pool.find(m => m.provider === defaultProvider) ||
    pool.find(m => m.provider === 'gemini') ||
    pool[0] ||
    null
  );
}

/**
 * Ordered multi-hop fallback chain (dim 12 → 5): default provider → Gemini → the rest, deduped by
 * provider so each hop tries a different backend, excluding the just-failed provider, capped at `max`.
 */
export function pickFallbackChain(
  activeModels: FallbackCandidate[],
  opts: { defaultProvider?: string; excludeProvider?: string; max?: number } = {}
): FallbackCandidate[] {
  if (!Array.isArray(activeModels) || activeModels.length === 0) return [];
  const { defaultProvider = 'gemini', excludeProvider, max = 3 } = opts;
  const pool = excludeProvider ? activeModels.filter(m => m.provider !== excludeProvider) : [...activeModels];

  const seen = new Set<string>();
  const ordered: FallbackCandidate[] = [];
  const push = (m?: FallbackCandidate): void => {
    if (m && !seen.has(m.provider)) {
      seen.add(m.provider);
      ordered.push(m);
    }
  };
  push(pool.find(m => m.provider === defaultProvider));
  push(pool.find(m => m.provider === 'gemini'));
  for (const m of pool) push(m);
  return ordered.slice(0, Math.max(1, max));
}
