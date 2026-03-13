/**
 * Logger Utility Tests
 */

import { describe, it, expect, vi } from 'vitest';
import { logger } from '../../utils/logger.js';

describe('Logger Utility', () => {
  it('should have info method', () => {
    expect(typeof logger.info).toBe('function');
    expect(() => logger.info('Test message')).not.toThrow();
  });

  it('should have error method', () => {
    expect(typeof logger.error).toBe('function');
    expect(() => logger.error('Test error')).not.toThrow();
  });

  it('should have warn method', () => {
    expect(typeof logger.warn).toBe('function');
    expect(() => logger.warn('Test warning')).not.toThrow();
  });

  it('should have debug method', () => {
    expect(typeof logger.debug).toBe('function');
    expect(() => logger.debug('Test debug')).not.toThrow();
  });
});


