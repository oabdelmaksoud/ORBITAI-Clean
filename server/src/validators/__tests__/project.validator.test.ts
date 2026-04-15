import { describe, it, expect } from 'vitest';
import { createProjectSchema, updateProjectSchema } from '../project.validator.js';

describe('Project Validator', () => {
  describe('createProjectSchema', () => {
    it('should validate a valid project', () => {
      const validProject = {
        userId: '507f1f77bcf86cd799439011',
        name: 'Test Project',
        description: 'A test project',
        currentPhase: 'Initiation',
        currentSprint: 1,
        methodology: 'V-Model',
        agents: [],
        tasks: [],
        artifacts: [],
        logs: [],
        selectedStandards: [],
        useInternet: false,
        budget: { cap: 1000, spent: 0 },
        mcpServers: []
      };

      expect(() => createProjectSchema.parse(validProject)).not.toThrow();
    });

    it('should accept project with only name (other fields optional)', () => {
      const minimalProject = {
        name: 'Test Project'
        // Other fields are optional due to passthrough()
      };

      // Schema uses passthrough() and makes most fields optional, so this should pass
      expect(() => createProjectSchema.parse(minimalProject)).not.toThrow();
    });

    it('should reject description exceeding 5000 characters', () => {
      const longDescription = 'a'.repeat(6000);
      const project = {
        userId: '507f1f77bcf86cd799439011',
        name: 'Test',
        description: longDescription,
        currentPhase: 'Initiation',
        currentSprint: 1,
        methodology: 'V-Model',
        agents: [],
        tasks: [],
        artifacts: [],
        logs: [],
        selectedStandards: [],
        useInternet: false,
        budget: { cap: 1000, spent: 0 },
        mcpServers: []
      };

      // Schema validates max length but doesn't truncate - should throw validation error
      expect(() => createProjectSchema.parse(project)).toThrow();
    });

    it('should accept all project fields (passthrough)', () => {
      const projectWithExtraFields = {
        userId: '507f1f77bcf86cd799439011',
        name: 'Test Project',
        description: 'Test',
        currentPhase: 'Initiation',
        currentSprint: 1,
        methodology: 'V-Model',
        agents: [],
        tasks: [],
        artifacts: [],
        logs: [],
        selectedStandards: [],
        useInternet: false,
        budget: { cap: 1000, spent: 0 },
        mcpServers: [],
        // Extra fields that should be allowed
        id: '507f1f77bcf86cd799439011',
        createdAt: new Date(),
        lastModified: new Date(),
        isProcessing: false
      };

      expect(() => createProjectSchema.parse(projectWithExtraFields)).not.toThrow();
    });
  });

  describe('updateProjectSchema', () => {
    it('should validate partial project update', () => {
      const partialUpdate = {
        name: 'Updated Name',
        description: 'Updated description'
      };

      expect(() => updateProjectSchema.parse(partialUpdate)).not.toThrow();
    });

    it('should allow empty update object', () => {
      expect(() => updateProjectSchema.parse({})).not.toThrow();
    });

    it('should validate currentPhase enum', () => {
      const validPhase = {
        currentPhase: 'Initiation'
      };

      expect(() => updateProjectSchema.parse(validPhase)).not.toThrow();

      const invalidPhase = {
        currentPhase: 'InvalidPhase'
      };

      expect(() => updateProjectSchema.parse(invalidPhase)).toThrow();
    });
  });
});

