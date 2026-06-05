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
