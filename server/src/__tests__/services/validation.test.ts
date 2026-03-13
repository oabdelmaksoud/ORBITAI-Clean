/**
 * Validation Utilities Tests
 */

import { describe, it, expect } from 'vitest';
import { validateEmail, validatePassword } from '../../utils/validation.js';

describe('Validation Utilities', () => {
  describe('validateEmail', () => {
    it('should validate correct email addresses', () => {
      expect(validateEmail('test@example.com')).toBe(true);
      expect(validateEmail('user.name@domain.co.uk')).toBe(true);
    });

    it('should reject invalid email addresses', () => {
      expect(validateEmail('invalid')).toBe(false);
      expect(validateEmail('@example.com')).toBe(false);
      expect(validateEmail('test@')).toBe(false);
    });
  });

  describe('validatePassword', () => {
    it('should validate strong passwords', () => {
      expect(validatePassword('Password123!')).toBe(true);
      expect(validatePassword('StrongP@ssw0rd')).toBe(true);
    });

    it('should reject weak passwords', () => {
      expect(validatePassword('short')).toBe(false);
      expect(validatePassword('12345678')).toBe(false);
      expect(validatePassword('noNumbers!')).toBe(false);
    });
  });
});


