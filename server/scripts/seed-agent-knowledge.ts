import mongoose from 'mongoose';
import { config } from '../src/config/env.js';
import { AgentKnowledge } from '../src/models/AgentKnowledge.model.js';
import { connectDatabase } from '../src/config/database.js';

const AGENT_ROLES = [
  'Orchestrator',
  'Requirements Agent',
  'UX Designer',
  'QA/Audit Agent',
  'Design/Architecture Agent',
  'Test Requirements Engineer',
  'Implementation Agent',
  'Integration Agent',
  'Test Agent',
  'Remediation/Bug Agent'
];

const DEFAULT_KNOWLEDGE_BASE: Record<string, {
  knowledgeDomains: Array<{ domain: string; level: number; examples?: string[] }>;
  skills: Array<{ skill: string; category: string; proficiency: number; experienceLevel: 'beginner' | 'intermediate' | 'advanced' | 'expert' }>;
  specializations: string[];
}> = {
  'Orchestrator': {
    knowledgeDomains: [
      { domain: 'Project Management', level: 95, examples: ['Critical path analysis', 'Resource allocation', 'Risk mitigation'] },
      { domain: 'Agile/Scrum', level: 90, examples: ['Sprint planning', 'Retrospectives', 'Velocity tracking'] },
      { domain: 'Stakeholder Management', level: 85, examples: ['Communication strategies', 'Expectation management'] }
    ],
    skills: [
      { skill: 'Strategic Planning', category: 'Process', proficiency: 95, experienceLevel: 'expert' },
      { skill: 'Risk Assessment', category: 'Process', proficiency: 90, experienceLevel: 'expert' },
      { skill: 'Team Coordination', category: 'Communication', proficiency: 85, experienceLevel: 'advanced' },
      { skill: 'Timeline Management', category: 'Process', proficiency: 92, experienceLevel: 'expert' }
    ],
    specializations: ['V-Model SDLC', 'Critical Path Analysis', 'Risk Management']
  },
  'Requirements Agent': {
    knowledgeDomains: [
      { domain: 'Requirements Engineering', level: 95, examples: ['Use case modeling', 'User stories', 'Acceptance criteria'] },
      { domain: 'Business Analysis', level: 90, examples: ['Domain modeling', 'Process mapping'] },
      { domain: 'Documentation', level: 92, examples: ['Technical specifications', 'API documentation'] }
    ],
    skills: [
      { skill: 'Requirements Gathering', category: 'Process', proficiency: 95, experienceLevel: 'expert' },
      { skill: 'Stakeholder Interviewing', category: 'Communication', proficiency: 90, experienceLevel: 'advanced' },
      { skill: 'Use Case Design', category: 'Technical', proficiency: 88, experienceLevel: 'advanced' },
      { skill: 'Specification Writing', category: 'Documentation', proficiency: 93, experienceLevel: 'expert' }
    ],
    specializations: ['IEEE 830 Standards', 'User Story Mapping', 'Acceptance Criteria Definition']
  },
  'UX Designer': {
    knowledgeDomains: [
      { domain: 'User Experience Design', level: 95, examples: ['User research', 'Persona development', 'Journey mapping'] },
      { domain: 'UI Design', level: 92, examples: ['Design systems', 'Component libraries', 'Responsive design'] },
      { domain: 'Accessibility', level: 88, examples: ['WCAG compliance', 'Screen reader optimization'] }
    ],
    skills: [
      { skill: 'Wireframing', category: 'Design', proficiency: 95, experienceLevel: 'expert' },
      { skill: 'Prototyping', category: 'Design', proficiency: 90, experienceLevel: 'advanced' },
      { skill: 'User Research', category: 'Research', proficiency: 88, experienceLevel: 'advanced' },
      { skill: 'Design Systems', category: 'Design', proficiency: 92, experienceLevel: 'expert' }
    ],
    specializations: ['Mobile-First Design', 'Accessibility (a11y)', 'Design Systems']
  },
  'QA/Audit Agent': {
    knowledgeDomains: [
      { domain: 'Security Testing', level: 95, examples: ['Penetration testing', 'Vulnerability scanning', 'OWASP Top 10'] },
      { domain: 'Compliance', level: 90, examples: ['GDPR', 'HIPAA', 'ISO standards'] },
      { domain: 'Quality Assurance', level: 92, examples: ['Test planning', 'Defect management'] }
    ],
    skills: [
      { skill: 'Security Auditing', category: 'Security', proficiency: 95, experienceLevel: 'expert' },
      { skill: 'Compliance Checking', category: 'Process', proficiency: 90, experienceLevel: 'expert' },
      { skill: 'Vulnerability Assessment', category: 'Security', proficiency: 93, experienceLevel: 'expert' },
      { skill: 'Code Review', category: 'Technical', proficiency: 88, experienceLevel: 'advanced' }
    ],
    specializations: ['OWASP Standards', 'GDPR Compliance', 'ISO 26262']
  },
  'Design/Architecture Agent': {
    knowledgeDomains: [
      { domain: 'System Architecture', level: 95, examples: ['Microservices', 'Event-driven architecture', 'Cloud architecture'] },
      { domain: 'Software Design Patterns', level: 92, examples: ['SOLID principles', 'Design patterns', 'Architectural patterns'] },
      { domain: 'Scalability', level: 90, examples: ['Horizontal scaling', 'Load balancing', 'Caching strategies'] }
    ],
    skills: [
      { skill: 'System Design', category: 'Technical', proficiency: 95, experienceLevel: 'expert' },
      { skill: 'Architecture Patterns', category: 'Technical', proficiency: 92, experienceLevel: 'expert' },
      { skill: 'Cloud Architecture', category: 'Technical', proficiency: 88, experienceLevel: 'advanced' },
      { skill: 'Performance Optimization', category: 'Technical', proficiency: 90, experienceLevel: 'advanced' }
    ],
    specializations: ['Microservices', 'Event-Driven Architecture', 'Cloud-Native Design']
  },
  'Implementation Agent': {
    knowledgeDomains: [
      { domain: 'Full-Stack Development', level: 95, examples: ['Frontend frameworks', 'Backend APIs', 'Database design'] },
      { domain: 'Code Quality', level: 92, examples: ['Clean code', 'Code reviews', 'Refactoring'] },
      { domain: 'Performance', level: 88, examples: ['Optimization', 'Profiling', 'Memory management'] }
    ],
    skills: [
      { skill: 'React Development', category: 'Technical', proficiency: 95, experienceLevel: 'expert' },
      { skill: 'Node.js', category: 'Technical', proficiency: 90, experienceLevel: 'advanced' },
      { skill: 'TypeScript', category: 'Technical', proficiency: 92, experienceLevel: 'expert' },
      { skill: 'API Design', category: 'Technical', proficiency: 88, experienceLevel: 'advanced' }
    ],
    specializations: ['React', 'TypeScript', 'RESTful APIs']
  },
  'Integration Agent': {
    knowledgeDomains: [
      { domain: 'DevOps', level: 95, examples: ['CI/CD pipelines', 'Infrastructure as Code', 'Containerization'] },
      { domain: 'Cloud Platforms', level: 90, examples: ['AWS', 'Azure', 'GCP'] },
      { domain: 'Automation', level: 92, examples: ['Scripting', 'Orchestration', 'Monitoring'] }
    ],
    skills: [
      { skill: 'CI/CD', category: 'DevOps', proficiency: 95, experienceLevel: 'expert' },
      { skill: 'Docker', category: 'DevOps', proficiency: 92, experienceLevel: 'expert' },
      { skill: 'Kubernetes', category: 'DevOps', proficiency: 85, experienceLevel: 'advanced' },
      { skill: 'Infrastructure as Code', category: 'DevOps', proficiency: 90, experienceLevel: 'advanced' }
    ],
    specializations: ['CI/CD Automation', 'Containerization', 'Cloud Deployment']
  },
  'Test Agent': {
    knowledgeDomains: [
      { domain: 'Test Automation', level: 95, examples: ['Unit testing', 'Integration testing', 'E2E testing'] },
      { domain: 'Test Frameworks', level: 92, examples: ['Jest', 'Cypress', 'Selenium'] },
      { domain: 'Test Strategy', level: 90, examples: ['Test planning', 'Coverage analysis'] }
    ],
    skills: [
      { skill: 'Test Automation', category: 'Testing', proficiency: 95, experienceLevel: 'expert' },
      { skill: 'Unit Testing', category: 'Testing', proficiency: 92, experienceLevel: 'expert' },
      { skill: 'E2E Testing', category: 'Testing', proficiency: 88, experienceLevel: 'advanced' },
      { skill: 'Test Coverage Analysis', category: 'Testing', proficiency: 90, experienceLevel: 'advanced' }
    ],
    specializations: ['Test Automation', 'TDD', 'Regression Testing']
  },
  'Test Requirements Engineer': {
    knowledgeDomains: [
      { domain: 'Test Planning', level: 95, examples: ['Test strategy', 'Test case design', 'Traceability'] },
      { domain: 'Requirements Traceability', level: 92, examples: ['Bi-directional tracing', 'Coverage metrics'] },
      { domain: 'Quality Metrics', level: 90, examples: ['Defect density', 'Test effectiveness'] }
    ],
    skills: [
      { skill: 'Test Case Design', category: 'Testing', proficiency: 95, experienceLevel: 'expert' },
      { skill: 'Requirements Traceability', category: 'Process', proficiency: 92, experienceLevel: 'expert' },
      { skill: 'Test Matrix Creation', category: 'Testing', proficiency: 90, experienceLevel: 'advanced' },
      { skill: 'Quality Metrics', category: 'Process', proficiency: 88, experienceLevel: 'advanced' }
    ],
    specializations: ['V-Model Testing', 'Requirements Traceability', 'Test Coverage']
  },
  'Remediation/Bug Agent': {
    knowledgeDomains: [
      { domain: 'Debugging', level: 95, examples: ['Root cause analysis', 'Log analysis', 'Error tracing'] },
      { domain: 'Bug Fixing', level: 92, examples: ['Hotfixes', 'Patch management', 'Regression fixes'] },
      { domain: 'System Recovery', level: 90, examples: ['Incident response', 'Rollback procedures'] }
    ],
    skills: [
      { skill: 'Debugging', category: 'Technical', proficiency: 95, experienceLevel: 'expert' },
      { skill: 'Root Cause Analysis', category: 'Process', proficiency: 93, experienceLevel: 'expert' },
      { skill: 'Hotfix Deployment', category: 'DevOps', proficiency: 88, experienceLevel: 'advanced' },
      { skill: 'Log Analysis', category: 'Technical', proficiency: 90, experienceLevel: 'advanced' }
    ],
    specializations: ['Emergency Response', 'Debugging', 'System Recovery']
  }
};

async function seedAgentKnowledge() {
  try {
    await connectDatabase();
    console.log('✅ Connected to MongoDB');

    for (const agentRole of AGENT_ROLES) {
      const knowledge = DEFAULT_KNOWLEDGE_BASE[agentRole];
      
      if (!knowledge) {
        console.warn(`⚠️  No knowledge base defined for: ${agentRole}`);
        continue;
      }

      const existing = await AgentKnowledge.findOne({ agentRole });

      const agentKnowledgeData = {
        agentRole,
        knowledgeDomains: knowledge.knowledgeDomains.map(kd => ({
          ...kd,
          lastUpdated: new Date()
        })),
        skills: knowledge.skills.map(skill => ({
          ...skill,
          tasksCompleted: 0,
          successRate: 95 // Default high success rate
        })),
        specializations: knowledge.specializations,
        metrics: {
          totalTasksCompleted: 0,
          averageTaskQuality: 90,
          averageResponseTime: 2000
        },
        preferredModels: [],
        knowledgeBaseRefs: [],
        metadata: {
          version: 1,
          lastTrained: new Date()
        }
      };

      if (existing) {
        await AgentKnowledge.findOneAndUpdate(
          { agentRole },
          { $set: agentKnowledgeData },
          { new: true }
        );
        console.log(`✅ Updated knowledge for: ${agentRole}`);
      } else {
        await AgentKnowledge.create(agentKnowledgeData);
        console.log(`✅ Created knowledge for: ${agentRole}`);
      }
    }

    console.log('\n✅ Agent knowledge seeding completed!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding agent knowledge:', error);
    process.exit(1);
  }
}

seedAgentKnowledge();

