import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { approvalGate } from '../approvalGate.service.js';

beforeEach(() => {
  process.env.HARNESS_HITL_ENABLED = 'true';
});

describe('approvalGate (HITL, guardrails dim 10 → 5)', () => {
  it('requires approval only for high-risk action types when enabled', () => {
    expect(approvalGate.requiresApproval('deploy')).toBe(true);
    expect(approvalGate.requiresApproval('delete')).toBe(true);
    expect(approvalGate.requiresApproval('read')).toBe(false);
  });

  it('never requires approval when HITL is disabled', () => {
    process.env.HARNESS_HITL_ENABLED = 'false';
    expect(approvalGate.requiresApproval('deploy')).toBe(false);
  });

  it('request → pending, approve → approved/isApproved', () => {
    const rec = approvalGate.request('a1', { type: 'deploy' });
    expect(rec.status).toBe('pending');
    expect(approvalGate.isApproved('a1')).toBe(false);
    approvalGate.approve('a1');
    expect(approvalGate.getStatus('a1')).toBe('approved');
    expect(approvalGate.isApproved('a1')).toBe(true);
  });

  it('reject → rejected; listPending excludes resolved', () => {
    approvalGate.request('a2');
    approvalGate.reject('a2');
    expect(approvalGate.getStatus('a2')).toBe('rejected');
    expect(approvalGate.listPending().some(r => r.id === 'a2')).toBe(false);
  });

  it('approving an unknown id returns null', () => {
    expect(approvalGate.approve('does-not-exist')).toBeNull();
  });
});
