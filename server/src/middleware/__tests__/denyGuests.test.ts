import { describe, it, expect, vi } from 'vitest';
import { denyGuests } from '../auth.js';
import { AppError } from '../errorHandler.js';

function run(user: any) {
  const req: any = { user };
  const res: any = {};
  const next = vi.fn();
  denyGuests(req, res, next);
  return next;
}

describe('denyGuests middleware', () => {
  it('returns 403 (via AppError) for a guest by role', () => {
    const next = run({ id: 'guest', role: 'guest' });
    expect(next).toHaveBeenCalledTimes(1);
    const err = next.mock.calls[0][0];
    expect(err).toBeInstanceOf(AppError);
    expect(err.statusCode).toBe(403);
  });

  it('returns 403 for a user whose id is "guest"', () => {
    const next = run({ id: 'guest', role: undefined });
    const err = next.mock.calls[0][0];
    expect(err).toBeInstanceOf(AppError);
    expect(err.statusCode).toBe(403);
  });

  it('passes through (no error) for an authenticated non-guest user', () => {
    const next = run({ id: 'user-123', role: 'user' });
    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0]).toBeUndefined();
  });

  it('passes through (no error) for an admin', () => {
    const next = run({ id: 'admin-1', role: 'admin' });
    expect(next.mock.calls[0][0]).toBeUndefined();
  });
});
