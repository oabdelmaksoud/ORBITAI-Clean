/**
 * Request Context (observability — dimension 13).
 *
 * Carries a per-request traceId across async boundaries via AsyncLocalStorage so every log line
 * emitted while handling a request can be correlated to that single run — without threading a
 * traceId parameter through every function. The logger reads getTraceId() and stamps it onto each
 * entry; the route middleware establishes the context and returns the id as an `x-trace-id` header.
 */

import { AsyncLocalStorage } from 'async_hooks';

interface RequestStore {
  traceId: string;
}

const storage = new AsyncLocalStorage<RequestStore>();

export const requestContext = {
  /** Run `fn` (and everything it awaits) within a context carrying `traceId`. */
  run<T>(traceId: string, fn: () => T): T {
    return storage.run({ traceId }, fn);
  },

  /** The traceId for the current async context, if any. */
  getTraceId(): string | undefined {
    return storage.getStore()?.traceId;
  },
};
