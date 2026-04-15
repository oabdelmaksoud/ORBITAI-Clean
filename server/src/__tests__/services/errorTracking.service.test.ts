/**
 * Error Tracking Service Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { captureException, captureMessage, setUser } from '../../services/errorTracking.service.js';

// Mock logger
vi.mock('../../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

describe('Error Tracking Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset Sentry initialization
    process.env.SENTRY_DSN = '';
  });

  describe('captureException', () => {
    it('should capture error without throwing', () => {
      const error = new Error('Test error');
      const context = { userId: 'user123' };

      expect(() => {
        captureException(error, context);
      }).not.toThrow();
    });

    it('should handle errors gracefully when Sentry is not configured', () => {
      const error = new Error('Test error');

      expect(() => {
        captureException(error);
      }).not.toThrow();
    });
  });

  describe('captureMessage', () => {
    it('should capture message without throwing', () => {
      expect(() => {
        captureMessage('Test message', 'info');
      }).not.toThrow();
    });
  });

  describe('setUser', () => {
    it('should set user context', () => {
      const user = { id: 'user123', email: 'test@example.com' };

      expect(() => {
        setUser(user);
      }).not.toThrow();
    });
  });
});

