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
}

export const contextManager = new ContextManager();
