import { describe, it, expect } from 'vitest';
import { requestContext } from '../requestContext.js';

describe('requestContext (observability, dim 13)', () => {
  it('returns undefined outside any run scope', () => {
    expect(requestContext.getTraceId()).toBeUndefined();
  });

  it('exposes the traceId inside run(), including across awaits', async () => {
    const seen = await requestContext.run('trace-123', async () => {
      await Promise.resolve();
      return requestContext.getTraceId();
    });
    expect(seen).toBe('trace-123');
  });

  it('isolates the traceId between concurrent runs', async () => {
    const a = requestContext.run('A', async () => {
      await new Promise(r => setTimeout(r, 5));
      return requestContext.getTraceId();
    });
    const b = requestContext.run('B', async () => requestContext.getTraceId());
    const [ra, rb] = await Promise.all([a, b]);
    expect(ra).toBe('A');
    expect(rb).toBe('B');
  });
});
