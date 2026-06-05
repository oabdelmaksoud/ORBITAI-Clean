/**
 * Routing-decision record builder (observability dim 13 → 5).
 *
 * Pure, testable construction of a RoutingDecisionLog document from a routing decision. The
 * RoutingDecisionLog model was previously read by admin dashboards but never written; LLMRouter now
 * writes one (opt-in HARNESS_DECISION_LOG) using this builder so the routing-decision audit trail is
 * actually populated. Kept pure so the field-coercion (complexity enum, defaults) is unit-tested.
 */

const COMPLEXITIES = ['simple', 'moderate', 'complex'];

export interface DecisionRecordInput {
  requestId: string;
  userId?: string;
  projectId?: string;
  taskType?: string;
  complexity?: string;
  agentRole?: string;
  estimatedTokens?: number;
  requiredCapabilities?: string[];
  selectedModel: string;
  selectedProvider: string;
  fallbackModel?: string;
  confidence?: number;
}

export function buildRoutingDecisionRecord(input: DecisionRecordInput): Record<string, unknown> {
  const complexity = COMPLEXITIES.includes((input.complexity || '').toLowerCase())
    ? (input.complexity as string).toLowerCase()
    : 'moderate';
  return {
    requestId: input.requestId,
    userId: input.userId,
    projectId: input.projectId,
    task: {
      type: input.taskType || 'unknown',
      complexity,
      agentRole: input.agentRole,
      estimatedTokens: input.estimatedTokens || 0,
      requiredCapabilities: input.requiredCapabilities || [],
    },
    selectedModel: input.selectedModel,
    selectedProvider: input.selectedProvider,
    fallbackModel: input.fallbackModel,
    confidence: typeof input.confidence === 'number' ? input.confidence : 0.7,
    decisionPath: [],
    alternatives: [],
  };
}
