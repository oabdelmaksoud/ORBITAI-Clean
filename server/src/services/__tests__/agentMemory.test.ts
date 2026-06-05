import { describe, it, expect, vi, beforeEach } from 'vitest';

const { vectorSearch, addDocument } = vi.hoisted(() => ({
  vectorSearch: vi.fn(),
  addDocument: vi.fn(),
}));

vi.mock('../vectorSearch.service.js', () => ({
  vectorSearchService: { vectorSearch, addDocument },
}));
vi.mock('../../utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { agentMemory } from '../agentMemory.service.js';

beforeEach(() => {
  vectorSearch.mockReset();
  addDocument.mockReset();
  process.env.HARNESS_MEMORY_ENABLED = 'true';
});

describe('agentMemory (RAG, dimension 7)', () => {
  it('returns empty and does not query when disabled', async () => {
    process.env.HARNESS_MEMORY_ENABLED = 'false';
    const r = await agentMemory.retrieveRelevantMemory('Impl', 'build login');
    expect(r).toBe('');
    expect(vectorSearch).not.toHaveBeenCalled();
  });

  it('retrieves, role-scopes, and formats memory for prompt injection', async () => {
    vectorSearch.mockResolvedValue([
      { id: '1', content: 'Used JWT with refresh tokens', score: 0.9, metadata: { agentRole: 'Impl', score: 88 } },
      { id: '2', content: 'belongs to another role', score: 0.8, metadata: { agentRole: 'QA' } },
    ]);
    const r = await agentMemory.retrieveRelevantMemory('Impl', 'auth', 3);
    expect(vectorSearch).toHaveBeenCalledWith('auth', 9, { type: 'agent-experience' });
    expect(r).toContain('Used JWT with refresh tokens');
    expect(r).toContain('prior quality 88/100');
    expect(r).not.toContain('belongs to another role'); // filtered out by agentRole
  });

  it('returns empty (never throws) when vector search fails', async () => {
    vectorSearch.mockRejectedValue(new Error('boom'));
    const r = await agentMemory.retrieveRelevantMemory('Impl', 'auth');
    expect(r).toBe('');
  });

  it('records an experience as a vector document with role-scoped metadata', async () => {
    addDocument.mockResolvedValue(undefined);
    await agentMemory.recordExperience({
      agentRole: 'Impl',
      taskTitle: 'Login',
      output: 'Built JWT auth',
      score: 90,
      projectId: 'p1',
    });
    expect(addDocument).toHaveBeenCalledTimes(1);
    const doc = addDocument.mock.calls[0][0];
    expect(doc.content).toContain('Login');
    expect(doc.metadata).toMatchObject({
      type: 'agent-experience',
      agentRole: 'Impl',
      score: 90,
      projectId: 'p1',
    });
  });

  it('does not record when disabled', async () => {
    process.env.HARNESS_MEMORY_ENABLED = 'false';
    await agentMemory.recordExperience({ agentRole: 'Impl', taskTitle: 'x', output: 'y' });
    expect(addDocument).not.toHaveBeenCalled();
  });
});
