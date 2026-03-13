/**
 * Validation Tests
 * Tests for input validation across all validators
 */

import { describe, it, expect } from 'vitest';
import { createProjectSchema, updateProjectSchema } from '../validators/project.validator.js';
import { createTaskSchema, updateTaskSchema } from '../validators/task.validator.js';
import { executeAgentTaskSchema } from '../validators/agent.validator.js';

describe('Project Validators', () => {
  describe('createProjectSchema', () => {
    it('should accept valid project data', () => {
      const validData = {
        name: 'My Project',
        description: 'Project description',
        methodology: 'V-Model',
        estimatedSprints: 5
      };
      expect(() => createProjectSchema.parse(validData)).not.toThrow();
    });

    it('should reject project name too short', () => {
      const invalidData = {
        name: 'ab', // Too short
        description: 'Test'
      };
      expect(() => createProjectSchema.parse(invalidData)).toThrow();
    });

    it('should reject project name too long', () => {
      const invalidData = {
        name: 'x'.repeat(201), // Too long
        description: 'Test'
      };
      expect(() => createProjectSchema.parse(invalidData)).toThrow();
    });

    it('should reject invalid methodology', () => {
      const invalidData = {
        name: 'My Project',
        methodology: 'InvalidMethodology'
      };
      expect(() => createProjectSchema.parse(invalidData)).toThrow();
    });
  });

  describe('updateProjectSchema', () => {
    it('should accept valid update data', () => {
      const validData = {
        name: 'Updated Project',
        currentPhase: 'Implementation'
      };
      expect(() => updateProjectSchema.parse(validData)).not.toThrow();
    });

    it('should accept partial updates', () => {
      const validData = {
        name: 'Updated Name Only'
      };
      expect(() => updateProjectSchema.parse(validData)).not.toThrow();
    });
  });
});

describe('Task Validators', () => {
  describe('createTaskSchema', () => {
    it('should accept valid task data', () => {
      const validData = {
        title: 'My Task',
        description: 'Task description',
        agentId: 'a1',
        priority: 'high',
        estimatedHours: 8
      };
      expect(() => createTaskSchema.parse(validData)).not.toThrow();
    });

    it('should reject task title too short', () => {
      const invalidData = {
        title: 'ab', // Too short
        agentId: 'a1'
      };
      expect(() => createTaskSchema.parse(invalidData)).toThrow();
    });

    it('should reject invalid status', () => {
      const invalidData = {
        title: 'My Task',
        status: 'invalid-status'
      };
      expect(() => updateTaskSchema.parse(invalidData)).toThrow();
    });
  });
});

describe('Agent Validators', () => {
  describe('executeAgentTaskSchema', () => {
    it('should accept valid agent execution data', () => {
      const validData = {
        agentId: 'a1',
        projectId: '507f1f77bcf86cd799439011',
        prompt: 'Execute this task',
        useInternet: true
      };
      expect(() => executeAgentTaskSchema.parse(validData)).not.toThrow();
    });

    it('should reject missing required fields', () => {
      const invalidData = {
        agentId: 'a1'
        // Missing projectId and prompt
      };
      expect(() => executeAgentTaskSchema.parse(invalidData)).toThrow();
    });

    it('should reject prompt too long', () => {
      const invalidData = {
        agentId: 'a1',
        projectId: '507f1f77bcf86cd799439011',
        prompt: 'x'.repeat(10001) // Too long
      };
      expect(() => executeAgentTaskSchema.parse(invalidData)).toThrow();
    });
  });
});


