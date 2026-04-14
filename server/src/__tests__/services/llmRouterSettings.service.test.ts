/**
 * LLM Router Settings Service Tests (#56)
 * Tests for llmRouterSettings.service.ts — testRoutingRule logic is pure (no mocks needed for conditions)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../models/LLMRouterSettings.model.js', () => ({
  LLMRouterSettings: {
    findOne: vi.fn().mockReturnValue({
      populate: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue(null),
    }),
    findOneAndUpdate: vi.fn().mockResolvedValue({}),
  },
}));

vi.mock('../../models/RoutingRule.model.js', () => ({
  RoutingRule: {
    find: vi.fn().mockReturnValue({
      sort: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue([]) }),
    }),
  },
}));

vi.mock('../../utils/logger.js', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import mongoose from 'mongoose';
vi.mock('mongoose', () => ({
  default: { Types: { ObjectId: { isValid: vi.fn().mockReturnValue(true) } } },
  Types: { ObjectId: { isValid: vi.fn().mockReturnValue(true) } },
}));

describe('LLMRouterSettingsService – testRoutingRule', () => {
  let svc: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import('../../services/llmRouterSettings.service.js');
    svc = mod.llmRouterSettingsService;
  });

  it('returns matches=false when rule has no conditions', async () => {
    const result = await svc.testRoutingRule({}, { agentRole: 'developer' });
    expect(result.matches).toBe(false);
    expect(result.reason).toContain('no conditions');
  });

  it('returns matches=true when all conditions are satisfied', async () => {
    const rule = {
      conditions: {
        agentRoles: ['developer'],
        taskTypes: ['code'],
        complexity: ['moderate'],
      },
    };
    const result = await svc.testRoutingRule(rule, {
      agentRole: 'developer',
      taskType: 'code',
      complexity: 'moderate',
    });
    expect(result.matches).toBe(true);
    expect(result.reason).toBe('Rule matches');
  });

  it('returns matches=false when agentRole is not in allowed list', async () => {
    const result = await svc.testRoutingRule(
      { conditions: { agentRoles: ['admin'] } },
      { agentRole: 'developer' }
    );
    expect(result.matches).toBe(false);
    expect(result.reason).toContain('Agent role');
  });

  it('returns matches=false when taskType is not in allowed list', async () => {
    const result = await svc.testRoutingRule(
      { conditions: { taskTypes: ['analysis'] } },
      { taskType: 'code' }
    );
    expect(result.matches).toBe(false);
    expect(result.reason).toContain('Task type');
  });

  it('enforces minTokens — below minimum fails, above passes', async () => {
    const rule = { conditions: { minTokens: 100 } };
    const below = await svc.testRoutingRule(rule, { estimatedTokens: 50 });
    expect(below.matches).toBe(false);
    expect(below.reason).toContain('below minimum');
    const above = await svc.testRoutingRule(rule, { estimatedTokens: 200 });
    expect(above.matches).toBe(true);
  });

  it('enforces maxTokens — above maximum fails, below passes', async () => {
    const rule = { conditions: { maxTokens: 500 } };
    const over = await svc.testRoutingRule(rule, { estimatedTokens: 1000 });
    expect(over.matches).toBe(false);
    expect(over.reason).toContain('above maximum');
    const ok = await svc.testRoutingRule(rule, { estimatedTokens: 300 });
    expect(ok.matches).toBe(true);
  });

  it('enforces complexity condition', async () => {
    const rule = { conditions: { complexity: ['complex'] } };
    const mismatch = await svc.testRoutingRule(rule, { complexity: 'simple' });
    expect(mismatch.matches).toBe(false);
    const match = await svc.testRoutingRule(rule, { complexity: 'complex' });
    expect(match.matches).toBe(true);
  });

  it('enforces projectPhases condition', async () => {
    const rule = { conditions: { projectPhases: ['design', 'build'] } };
    const match = await svc.testRoutingRule(rule, { projectPhase: 'design' });
    expect(match.matches).toBe(true);
    const noMatch = await svc.testRoutingRule(rule, { projectPhase: 'testing' });
    expect(noMatch.matches).toBe(false);
  });

  it('getEffectiveSettings returns defaults when no DB settings exist', async () => {
    const result = await svc.getEffectiveSettings();
    expect(result).toHaveProperty('enabled', true);
    expect(result).toHaveProperty('routingRules');
    expect(Array.isArray(result.routingRules)).toBe(true);
    expect(result).toHaveProperty('enableIntelligentRouting');
  });

  it('getGlobalSettings returns null when no settings found', async () => {
    const result = await svc.getGlobalSettings();
    expect(result).toBeNull();
  });
});
