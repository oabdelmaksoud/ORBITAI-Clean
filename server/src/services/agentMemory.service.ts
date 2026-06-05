/**
 * Agent Memory (RAG) — dimension 7 of the harness scorecard.
 *
 * Closes the "write-only knowledge" gap: agents now (a) RETRIEVE relevant past experiences via
 * vector search and have them injected into their prompt, and (b) RECORD each task's outcome as an
 * embedded document for future retrieval. This turns cross-session knowledge from a dead key-store
 * into actual retrieval-augmented context that reaches the model at execution time.
 *
 * Backed by the existing vectorSearchService (Weaviate in prod, in-memory + embeddings fallback).
 * Gated behind HARNESS_MEMORY_ENABLED so it stays dark until an embedding/vector backend is
 * configured; every path degrades gracefully (retrieval returns '' and recording no-ops on error).
 */

import { logger } from '../utils/logger.js';
import { vectorSearchService } from './vectorSearch.service.js';

const MEMORY_TYPE = 'agent-experience';

function memoryEnabled(): boolean {
  // dim 7 → 5: on by default (degrades gracefully without a vector backend — retrieval returns ''
  // and recording no-ops on error). Set HARNESS_MEMORY_ENABLED=false to disable.
  return (process.env.HARNESS_MEMORY_ENABLED || '').toLowerCase() !== 'false';
}

export interface RecordExperienceParams {
  agentRole: string;
  taskTitle: string;
  output: string;
  score?: number;
  projectId?: string;
}

class AgentMemoryService {
  /**
   * Retrieve the most relevant past experiences for an agent + current task, formatted as a context
   * block ready to append to a system instruction. Returns '' when disabled, empty, or on error.
   */
  async retrieveRelevantMemory(agentRole: string, query: string, limit = 3): Promise<string> {
    if (!memoryEnabled() || !query || !query.trim()) return '';
    try {
      // Over-fetch then post-filter by agentRole (the vector filter API is typed to type/project/user).
      const results = await vectorSearchService.vectorSearch(query, limit * 3, {
        type: MEMORY_TYPE,
      });
      // Relevance tuning (dim 7 → 5): role-scope, drop low-similarity hits, dedup by content.
      const minRelevance = Number(process.env.MEMORY_MIN_RELEVANCE) || 0;
      const seen = new Set<string>();
      const scoped = (results || [])
        .filter(r => !agentRole || r.metadata?.agentRole === agentRole)
        .filter(r => typeof r.score !== 'number' || r.score >= minRelevance)
        .filter(r => {
          const key = (r.content || '').trim();
          if (!key || seen.has(key)) return false;
          seen.add(key);
          return true;
        })
        .slice(0, limit);
      if (scoped.length === 0) return '';

      const lines = scoped
        .map((r, i) => {
          const score =
            typeof r.metadata?.score === 'number' ? ` (prior quality ${r.metadata.score}/100)` : '';
          return `${i + 1}.${score} ${r.content}`;
        })
        .join('\n');
      return `\n\n[RELEVANT PAST EXPERIENCE — retrieved from agent memory]\n${lines}\n[END PAST EXPERIENCE]\n`;
    } catch (error) {
      logger.warn('[AgentMemory] Retrieval failed; continuing without memory:', error);
      return '';
    }
  }

  /**
   * Record a completed task's outcome so future runs of the same agent can retrieve it.
   * Fire-and-forget; never throws into the caller.
   */
  async recordExperience(params: RecordExperienceParams): Promise<void> {
    if (!memoryEnabled()) return;
    const { agentRole, taskTitle, output, score, projectId } = params;
    if (!output || !output.trim()) return;
    // Quality gate (dim 7 → 5): only store reasonably good outcomes so memory stays high-signal and
    // we avoid embedding every low-quality output. MEMORY_MIN_RECORD_SCORE (default 60); no-score passes.
    const minRecordScore = Number(process.env.MEMORY_MIN_RECORD_SCORE) || 60;
    if (typeof score === 'number' && score < minRecordScore) return;
    try {
      const id = `exp-${agentRole}-${Date.now()}-${Math.round(Math.random() * 1_000_000)}`;
      const content = `Task: ${taskTitle}\nApproach & outcome: ${output.substring(0, 4000)}`;
      await vectorSearchService.addDocument({
        id,
        content,
        metadata: { type: MEMORY_TYPE, agentRole, score, projectId, title: taskTitle },
      });
      logger.info(`[AgentMemory] Recorded experience for "${agentRole}" (score ${score ?? 'n/a'})`);
    } catch (error) {
      logger.warn('[AgentMemory] Recording failed (non-fatal):', error);
    }
  }
}

export const agentMemory = new AgentMemoryService();
