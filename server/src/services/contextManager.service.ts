/**
 * Context Manager (dimension 6) — token-budgeted conversation history.
 *
 * Replaces the harness's naive "use the whole history" / fixed slice(-10) behaviour with a real
 * token budget: keep the most recent messages that fit within a budget, always retaining the latest
 * turn. Prevents unbounded prompts from overflowing a model's context window and inflating cost.
 *
 * (Summarization/compaction of the dropped prefix is the dim-6 "5" stretch; this provides the
 * budget-aware trimming foundation.)
 */

export interface ChatMessage {
  role: string;
  content: string;
}

const DEFAULT_TOKEN_BUDGET = 6000;
const PER_MESSAGE_OVERHEAD = 4; // rough role/separator overhead per message

class ContextManager {
  /** Cheap token estimate (~4 chars/token). Good enough for budgeting, not billing. */
  estimateTokens(text: string): number {
    return Math.ceil((text?.length || 0) / 4);
  }

  /**
   * Keep the most recent messages whose combined estimated tokens fit within `maxTokens`.
   * Always keeps at least the latest message (even if it alone exceeds the budget), and preserves
   * chronological order in the returned array.
   */
  trimHistory(history: ChatMessage[], maxTokens: number = DEFAULT_TOKEN_BUDGET): ChatMessage[] {
    if (!Array.isArray(history) || history.length === 0) return [];

    const kept: ChatMessage[] = [];
    let total = 0;
    for (let i = history.length - 1; i >= 0; i--) {
      const message = history[i];
      const cost = this.estimateTokens(message?.content) + PER_MESSAGE_OVERHEAD;
      if (total + cost > maxTokens && kept.length > 0) break;
      kept.unshift(message);
      total += cost;
    }
    return kept;
  }

  /**
   * Compaction (dim 6 → 5): like trimHistory, but instead of silently dropping the older prefix,
   * replace it with a single synthetic summary message so the model retains a trace of earlier
   * context. `summarize` defaults to a deterministic, no-LLM heuristic; pass an LLM-backed summarizer
   * for a richer recap.
   */
  async compactHistory(
    history: ChatMessage[],
    maxTokens: number = DEFAULT_TOKEN_BUDGET,
    summarize: (dropped: ChatMessage[]) => Promise<string> | string = defaultSummarize
  ): Promise<ChatMessage[]> {
    if (!Array.isArray(history) || history.length === 0) return [];
    const kept = this.trimHistory(history, maxTokens);
    if (kept.length >= history.length) return kept; // nothing was dropped

    const dropped = history.slice(0, history.length - kept.length);
    let summary = '';
    try {
      summary = (await summarize(dropped)).trim();
    } catch {
      summary = defaultSummarize(dropped);
    }
    if (!summary) return kept;
    return [{ role: 'system', content: `[Earlier conversation summary] ${summary}` }, ...kept];
  }
}

/** Deterministic, no-LLM recap of the omitted prefix (count + compact role/snippet list). */
function defaultSummarize(dropped: ChatMessage[]): string {
  const snippets = dropped
    .map(m => `${m.role}: ${(m.content || '').replace(/\s+/g, ' ').slice(0, 80)}`)
    .join(' | ');
  return `${dropped.length} earlier message(s) omitted. ${snippets}`.slice(0, 600);
}

export const contextManager = new ContextManager();
