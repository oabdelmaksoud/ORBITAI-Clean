/**
 * Agent Discovery Service
 * Automatically discovers new agents from projects and creates/updates knowledge profiles
 * Ensures agents are reusable across all projects for all users
 */

import { AgentKnowledge } from '../models/AgentKnowledge.model.js';
import { Project } from '../models/Project.model.js';
import { logger } from '../utils/logger.js';

export interface DiscoveredAgent {
  agentRole: string;
  name?: string;
  description?: string;
  goal?: string;
  backstory?: string;
}

export class AgentDiscoveryService {
  /**
   * Discover all agents from all projects and create knowledge profiles
   */
  async discoverAgentsFromProjects(): Promise<DiscoveredAgent[]> {
    try {
      logger.info('Discovering agents from all projects...');

      const projects = await Project.find({}).lean();
      const discoveredAgents = new Map<string, DiscoveredAgent>();

      // Extract agents from all projects
      for (const project of projects) {
        if (Array.isArray(project.agents) && project.agents.length > 0) {
          for (const agent of project.agents) {
            const agentRole = agent.role || agent.agentRole || 'Unknown Agent';
            
            if (!discoveredAgents.has(agentRole)) {
              discoveredAgents.set(agentRole, {
                agentRole,
                name: agent.name,
                description: agent.description,
                goal: agent.goal,
                backstory: agent.backstory
              });
            }
          }
        }
      }

      const agentsArray = Array.from(discoveredAgents.values());
      logger.info(`Discovered ${agentsArray.length} unique agents from projects`);

      // Create/update knowledge profiles for discovered agents
      for (const agent of agentsArray) {
        await this.ensureAgentKnowledgeProfile(agent);
      }

      return agentsArray;
    } catch (error: unknown) {
      logger.error('Failed to discover agents from projects:', error);
      throw error;
    }
  }

  /**
   * Ensure agent knowledge profile exists, create if not
   */
  async ensureAgentKnowledgeProfile(agent: DiscoveredAgent): Promise<void> {
    try {
      let agentKnowledge = await AgentKnowledge.findOne({ agentRole: agent.agentRole });

      if (!agentKnowledge) {
        // Create new knowledge profile with initial data
        const initialKnowledge = this.generateInitialKnowledge(agent);
        
        agentKnowledge = await AgentKnowledge.create({
          agentRole: agent.agentRole,
          knowledgeDomains: initialKnowledge.knowledgeDomains,
          skills: initialKnowledge.skills,
          specializations: initialKnowledge.specializations,
          metrics: {
            totalTasksCompleted: 0,
            averageTaskQuality: 0,
            averageResponseTime: 0
          },
          preferredModels: [],
          knowledgeBaseRefs: [],
          metadata: {
            version: 1,
            lastTrained: new Date(),
            notes: agent.description || `Auto-discovered from projects`
          }
        });

        logger.info(`Created knowledge profile for new agent: ${agent.agentRole}`);
      } else {
        // Update metadata if new information is available
        if (agent.description && !agentKnowledge.metadata?.notes) {
          agentKnowledge.metadata = agentKnowledge.metadata || { version: 1 };
          agentKnowledge.metadata.notes = agent.description;
          await agentKnowledge.save();
        }
      }
    } catch (error: unknown) {
      logger.error(`Failed to ensure knowledge profile for ${agent.agentRole}:`, error);
    }
  }

  /**
   * Generate initial knowledge profile from agent information
   * Made public for use in other services
   */
  generateInitialKnowledge(agent: DiscoveredAgent): {
    knowledgeDomains: Array<{ domain: string; level: number; examples?: string[] }>;
    skills: Array<{ skill: string; category: string; proficiency: number; experienceLevel: 'beginner' | 'intermediate' | 'advanced' | 'expert' }>;
    specializations: string[];
  } {
    const role = agent.agentRole.toLowerCase();
    const description = (agent.description || agent.goal || '').toLowerCase();

    // Infer knowledge domains from role and description
    const knowledgeDomains: Array<{ domain: string; level: number; examples?: string[] }> = [];
    const skills: Array<{ skill: string; category: string; proficiency: number; experienceLevel: 'beginner' | 'intermediate' | 'advanced' | 'expert' }> = [];
    const specializations: string[] = [];

    // Role-based knowledge inference
    if (role.includes('orchestrat') || role.includes('manager') || role.includes('coordinator')) {
      knowledgeDomains.push({ domain: 'Project Management', level: 85, examples: ['Coordination', 'Planning'] });
      knowledgeDomains.push({ domain: 'Stakeholder Management', level: 80 });
      skills.push({ skill: 'Strategic Planning', category: 'Process', proficiency: 85, experienceLevel: 'advanced' });
      skills.push({ skill: 'Team Coordination', category: 'Communication', proficiency: 80, experienceLevel: 'advanced' });
    }

    if (role.includes('requirement') || role.includes('analysis')) {
      knowledgeDomains.push({ domain: 'Requirements Engineering', level: 90 });
      knowledgeDomains.push({ domain: 'Business Analysis', level: 85 });
      skills.push({ skill: 'Requirements Gathering', category: 'Process', proficiency: 90, experienceLevel: 'expert' });
      skills.push({ skill: 'Specification Writing', category: 'Documentation', proficiency: 85, experienceLevel: 'advanced' });
    }

    if (role.includes('design') || role.includes('ux') || role.includes('ui')) {
      knowledgeDomains.push({ domain: 'User Experience Design', level: 90 });
      knowledgeDomains.push({ domain: 'UI Design', level: 85 });
      skills.push({ skill: 'Wireframing', category: 'Design', proficiency: 90, experienceLevel: 'expert' });
      skills.push({ skill: 'Prototyping', category: 'Design', proficiency: 85, experienceLevel: 'advanced' });
    }

    if (role.includes('qa') || role.includes('audit') || role.includes('test')) {
      knowledgeDomains.push({ domain: 'Quality Assurance', level: 90 });
      knowledgeDomains.push({ domain: 'Security Testing', level: 85 });
      skills.push({ skill: 'Test Automation', category: 'Testing', proficiency: 90, experienceLevel: 'expert' });
      skills.push({ skill: 'Security Auditing', category: 'Security', proficiency: 85, experienceLevel: 'advanced' });
    }

    if (role.includes('implement') || role.includes('developer') || role.includes('code')) {
      knowledgeDomains.push({ domain: 'Software Development', level: 90 });
      knowledgeDomains.push({ domain: 'Code Quality', level: 85 });
      skills.push({ skill: 'Full-Stack Development', category: 'Technical', proficiency: 90, experienceLevel: 'expert' });
      skills.push({ skill: 'Code Review', category: 'Technical', proficiency: 85, experienceLevel: 'advanced' });
    }

    if (role.includes('integration') || role.includes('deploy') || role.includes('devops')) {
      knowledgeDomains.push({ domain: 'DevOps', level: 90 });
      knowledgeDomains.push({ domain: 'Cloud Platforms', level: 85 });
      skills.push({ skill: 'CI/CD', category: 'DevOps', proficiency: 90, experienceLevel: 'expert' });
      skills.push({ skill: 'Containerization', category: 'DevOps', proficiency: 85, experienceLevel: 'advanced' });
    }

    // Infer from description text
    if (description.includes('react') || description.includes('frontend')) {
      skills.push({ skill: 'React Development', category: 'Technical', proficiency: 80, experienceLevel: 'advanced' });
      specializations.push('React');
    }

    if (description.includes('node') || description.includes('backend')) {
      skills.push({ skill: 'Node.js', category: 'Technical', proficiency: 80, experienceLevel: 'advanced' });
      specializations.push('Node.js');
    }

    if (description.includes('typescript')) {
      skills.push({ skill: 'TypeScript', category: 'Technical', proficiency: 85, experienceLevel: 'advanced' });
      specializations.push('TypeScript');
    }

    // Default values if nothing inferred
    if (knowledgeDomains.length === 0) {
      knowledgeDomains.push({ domain: 'General Development', level: 70 });
    }

    if (skills.length === 0) {
      skills.push({ skill: 'General Problem Solving', category: 'Technical', proficiency: 70, experienceLevel: 'intermediate' });
    }

    return { knowledgeDomains, skills, specializations };
  }

  /**
   * Process a single project and discover/create agents
   */
  async processProject(projectId: string): Promise<DiscoveredAgent[]> {
    try {
      const project = await Project.findById(projectId).lean();
      
      if (!project || !Array.isArray(project.agents)) {
        return [];
      }

      const discoveredAgents: DiscoveredAgent[] = [];

      for (const agent of project.agents) {
        const agentRole = agent.role || agent.agentRole || 'Unknown Agent';
        
        const discoveredAgent: DiscoveredAgent = {
          agentRole,
          name: agent.name,
          description: agent.description,
          goal: agent.goal,
          backstory: agent.backstory
        };

        await this.ensureAgentKnowledgeProfile(discoveredAgent);
        discoveredAgents.push(discoveredAgent);
      }

      return discoveredAgents;
    } catch (error: unknown) {
      logger.error(`Failed to process project ${projectId} for agent discovery:`, error);
      return [];
    }
  }

  /**
   * Get all available agents (for reuse across projects)
   */
  async getAllAvailableAgents(): Promise<Array<{
    agentRole: string;
    metrics: any;
    skillsCount: number;
    domainsCount: number;
    lastActive?: Date;
  }>> {
    try {
      const agents = await AgentKnowledge.find({})
        .select('agentRole metrics skills knowledgeDomains')
        .sort({ 'metrics.totalTasksCompleted': -1 })
        .lean();

      return agents.map(agent => ({
        agentRole: agent.agentRole,
        metrics: agent.metrics,
        skillsCount: agent.skills?.length || 0,
        domainsCount: agent.knowledgeDomains?.length || 0,
        lastActive: agent.metrics?.lastActiveDate
      }));
    } catch (error: unknown) {
      logger.error('Failed to get all available agents:', error);
      return [];
    }
  }
}

export const agentDiscovery = new AgentDiscoveryService();

