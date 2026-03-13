import { describe, it, expect, beforeEach } from 'vitest';
import { Project } from '../../models/Project.model.js';
import { Types } from 'mongoose';

describe('Project Model', () => {
  beforeEach(async () => {
    await Project.deleteMany({});
  });

  describe('Project Creation', () => {
    it('should create a project with valid data', async () => {
      const projectData = {
        userId: new Types.ObjectId().toString(),
        name: 'Test Project',
        description: 'Test Description',
        currentPhase: 'planning',
        methodology: 'Agile'
      };

      const project = await Project.create(projectData);

      expect(project).toBeDefined();
      expect(project.name).toBe(projectData.name);
      expect(project.description).toBe(projectData.description);
      expect(project.currentPhase).toBe(projectData.currentPhase);
      expect(project.methodology).toBe(projectData.methodology);
    });

    it('should set default values', async () => {
      const project = await Project.create({
        userId: new Types.ObjectId().toString(),
        name: 'Default Project'
      });

      expect(project.currentPhase).toBe('Initiation');
      expect(project.currentSprint).toBe(1);
      expect(project.methodology).toBe('V-Model');
      expect(project.agents).toEqual([]);
      expect(project.tasks).toEqual([]);
      expect(project.artifacts).toEqual([]);
      expect(project.selectedStandards).toEqual([]);
      expect(project.useInternet).toBe(false);
      expect(project.budget.cap).toBe(1000);
      expect(project.budget.spent).toBe(0);
      expect(project.isSample).toBe(false);
    });

    it('should require userId', async () => {
      await expect(
        Project.create({
          name: 'Test Project'
        })
      ).rejects.toThrow();
    });

    it('should require name', async () => {
      await expect(
        Project.create({
          userId: new Types.ObjectId().toString()
        })
      ).rejects.toThrow();
    });

    it('should validate methodology enum', async () => {
      await expect(
        Project.create({
          userId: new Types.ObjectId().toString(),
          name: 'Test Project',
          methodology: 'InvalidMethodology'
        })
      ).rejects.toThrow();
    });

    it('should accept valid methodologies', async () => {
      const validMethodologies = ['V-Model', 'Agile', 'Waterfall', 'Spiral', 'DevOps', 'Scrum'];
      
      for (const methodology of validMethodologies) {
        const project = await Project.create({
          userId: new Types.ObjectId().toString(),
          name: `Test ${methodology}`,
          methodology
        });
        expect(project.methodology).toBe(methodology);
      }
    });
  });

  describe('Project Properties', () => {
    it('should track budget', async () => {
      const project = await Project.create({
        userId: new Types.ObjectId().toString(),
        name: 'Budget Project',
        budget: {
          cap: 5000,
          spent: 1000
        }
      });

      expect(project.budget.cap).toBe(5000);
      expect(project.budget.spent).toBe(1000);
    });

    it('should mark project as sample', async () => {
      const project = await Project.create({
        userId: new Types.ObjectId().toString(),
        name: 'Sample Project',
        isSample: true
      });

      expect(project.isSample).toBe(true);
    });

    it('should track selected standards', async () => {
      const project = await Project.create({
        userId: new Types.ObjectId().toString(),
        name: 'Standards Project',
        selectedStandards: ['ISO 27001', 'SOC 2']
      });

      expect(project.selectedStandards).toHaveLength(2);
      expect(project.selectedStandards).toContain('ISO 27001');
      expect(project.selectedStandards).toContain('SOC 2');
    });
  });
});

