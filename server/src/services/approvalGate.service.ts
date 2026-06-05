/**
 * Approval Gate — Human-in-the-Loop (guardrails dim 10 → 5).
 *
 * Complements the existing guardrails (auth, IP rate-limit, feature flags, spend caps) with an HITL
 * checkpoint: high-risk action types require a human approval before they proceed. Callers ask
 * `requiresApproval(type)`; if true they `request(id)` and only proceed once `isApproved(id)`.
 * A human resolves pending requests via the harness-approvals route. Opt-in via HARNESS_HITL_ENABLED.
 */

import { logger } from '../utils/logger.js';

export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

export interface ApprovalRecord {
  id: string;
  status: ApprovalStatus;
  details?: unknown;
  createdAt: number;
  resolvedAt?: number;
}

function hitlEnabled(): boolean {
  return (process.env.HARNESS_HITL_ENABLED || '').toLowerCase() === 'true';
}

/** Action types that require human approval when HITL is on (configurable). */
function highRiskTypes(): string[] {
  return (process.env.HARNESS_HITL_ACTIONS || 'deploy,delete,spend,external_write,stdio_exec')
    .split(',')
    .map(s => s.trim().toLowerCase())
    .filter(Boolean);
}

class ApprovalGate {
  private records = new Map<string, ApprovalRecord>();

  /** Whether an action of this type needs human approval (only when HITL is enabled). */
  requiresApproval(actionType: string): boolean {
    if (!hitlEnabled()) return false;
    return highRiskTypes().includes((actionType || '').toLowerCase());
  }

  /** Register a pending approval (idempotent per id). */
  request(id: string, details?: unknown): ApprovalRecord {
    const existing = this.records.get(id);
    if (existing) return existing;
    const record: ApprovalRecord = { id, status: 'pending', details, createdAt: Date.now() };
    this.records.set(id, record);
    logger.info(`[ApprovalGate] Approval requested: ${id}`);
    return record;
  }

  approve(id: string): ApprovalRecord | null {
    return this.resolve(id, 'approved');
  }

  reject(id: string): ApprovalRecord | null {
    return this.resolve(id, 'rejected');
  }

  private resolve(id: string, status: ApprovalStatus): ApprovalRecord | null {
    const record = this.records.get(id);
    if (!record) return null;
    record.status = status;
    record.resolvedAt = Date.now();
    logger.info(`[ApprovalGate] Approval ${status}: ${id}`);
    return record;
  }

  getStatus(id: string): ApprovalStatus | 'unknown' {
    return this.records.get(id)?.status ?? 'unknown';
  }

  isApproved(id: string): boolean {
    return this.records.get(id)?.status === 'approved';
  }

  listPending(): ApprovalRecord[] {
    return [...this.records.values()].filter(r => r.status === 'pending');
  }
}

export const approvalGate = new ApprovalGate();
