import { describe, it, expect } from 'vitest';
import { contextManager } from '../contextManager.service.js';

describe('contextManager (dim 6)', () => {
  it('estimates tokens at roughly chars/4', () => {
    expect(contextManager.estimateTokens('abcd')).toBe(1);
    expect(contextManager.estimateTokens('')).toBe(0);
  });

  it('returns [] for empty or invalid history', () => {
    expect(contextManager.trimHistory([])).toEqual([]);
    expect(contextManager.trimHistory(undefined as any)).toEqual([]);
  });

  it('keeps all messages when within budget, preserving chronological order', () => {
    const h = [
      { role: 'user', content: 'a' },
      { role: 'assistant', content: 'b' },
      { role: 'user', content: 'c' },
    ];
    expect(contextManager.trimHistory(h, 1000)).toEqual(h);
  });

  it('drops the oldest messages beyond the budget, keeping the most recent', () => {
    const big = 'x'.repeat(400); // ~101 tokens each (+4 overhead = ~105)
    const h = [
      { role: 'user', content: big + '1' },
      { role: 'user', content: big + '2' },
      { role: 'user', content: big + '3' },
    ];
    const trimmed = contextManager.trimHistory(h, 210); // fits ~2 messages
    expect(trimmed.length).toBe(2);
    expect(trimmed[0].content).toContain('2');
    expect(trimmed[1].content).toContain('3'); // newest retained
  });

  it('always keeps at least the latest message even if it alone exceeds the budget', () => {
    const huge = 'x'.repeat(100000);
    const h = [
      { role: 'user', content: 'old' },
      { role: 'user', content: huge },
    ];
    const trimmed = contextManager.trimHistory(h, 10);
    expect(trimmed.length).toBe(1);
    expect(trimmed[0].content).toBe(huge);
  });

  it('compacts the dropped prefix into a summary message (compactHistory)', async () => {
    const big = 'x'.repeat(400);
    const h = [
      { role: 'user', content: big + '1' },
      { role: 'user', content: big + '2' },
      { role: 'user', content: big + '3' },
    ];
    const out = await contextManager.compactHistory(h, 210);
    expect(out[0].role).toBe('system');
    expect(out[0].content).toContain('Earlier conversation summary');
    expect(out[out.length - 1].content).toContain('3'); // recent message retained
  });

  it('uses an injected summarizer when provided', async () => {
    const big = 'x'.repeat(400);
    const h = [
      { role: 'user', content: big + '1' },
      { role: 'user', content: big + '2' },
      { role: 'user', content: big + '3' },
    ];
    const out = await contextManager.compactHistory(h, 210, async () => 'CUSTOM RECAP');
    expect(out[0].content).toContain('CUSTOM RECAP');
  });

  it('adds no summary when nothing is dropped', async () => {
    const h = [{ role: 'user', content: 'a' }];
    const out = await contextManager.compactHistory(h, 1000);
    expect(out).toEqual(h);
  });
});
