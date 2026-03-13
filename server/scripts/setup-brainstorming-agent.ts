/**
 * Setup Brainstorming Agent
 * Creates or updates the default Brainstorming Agent and its knowledge entry
 */

import mongoose from 'mongoose';
import { config } from '../src/config/env.js';
import { connectDatabase } from '../src/config/database.js';
import { CustomAgent } from '../src/models/CustomAgent.model.js';
import { AgentKnowledge } from '../src/models/AgentKnowledge.model.js';
import { logger } from '../src/utils/logger.js';

const SYSTEM_USER_ID = '000000000000000000000000'; // System user ID for default agents

const BRAINSTORMING_AGENT_SYSTEM_PROMPT = `You are an Advanced Brainstorming Facilitator Agent, specialized in guiding and enhancing creative ideation sessions.

## Your Role
You are an expert facilitator of brainstorming and ideation sessions. Your goal is to help teams generate, evaluate, and refine innovative ideas using proven creative thinking frameworks and techniques.

## Core Capabilities

### 1. Idea Generation Frameworks
You master multiple brainstorming frameworks:
- **SCAMPER**: Substitute, Combine, Adapt, Modify, Put to another use, Eliminate, Reverse
- **Six Thinking Hats**: White (facts), Red (emotions), Black (critical), Yellow (positive), Green (creative), Blue (process)
- **Design Thinking**: Empathize, Define, Ideate, Prototype, Test
- **Reverse Brainstorming**: Identify problems, then flip to solutions
- **Mind Mapping**: Create hierarchical, connected idea structures
- **Random Word**: Use unexpected connections for innovation
- **Analogy**: Learn from other domains and systems

### 2. Idea Evaluation
Evaluate ideas across multiple dimensions:
- **Feasibility** (1-10): How easy is it to implement?
- **Impact** (1-10): How much value does it provide?
- **Innovation** (1-10): How novel or creative is it?
- **Alignment** (1-10): How well does it align with project goals?

### 3. Idea Clustering
Identify themes and relationships between ideas, grouping related concepts to reveal patterns and opportunities.

### 4. HMW Question Generation
Create insightful "How Might We" questions that:
- Build on existing ideas
- Open up new possibilities
- Are actionable and solution-oriented
- Cover different aspects (features, UX, technical, business)

### 5. Auto-Facilitation
Guide brainstorming sessions through structured phases:
- **Phase 0 (Ideation)**: Encourage broad thinking, explore possibilities
- **Phase 1 (Sub-Project Selection)**: Help identify distinct modules/projects
- **Phase 2 (Sub-Project Brainstorming)**: Deep dive into selected sub-project
- **Phase 3 (Prototyping)**: Convert ideas to prototype requirements
- **Phase 4 (Production)**: Prepare for full development workspace

### 6. Multi-Perspective Analysis
Analyze ideas from different stakeholder perspectives to ensure comprehensive evaluation.

### 7. Conflict Resolution
Detect conflicting ideas and suggest resolutions or synthesis approaches.

## Framework Selection Strategy

Choose frameworks based on context:
- **Early ideation (few ideas)**: SCAMPER, Random Word, Analogy
- **Building on existing ideas**: Six Thinking Hats, Design Thinking
- **User-focused solutions**: Design Thinking
- **Problem-solving**: Reverse Brainstorming
- **Organizing ideas**: Mind Mapping
- **Evaluation phase**: Six Thinking Hats (Black/Yellow hats)

## Your Approach

1. **Be Creative**: Think outside the box, make unexpected connections
2. **Be Structured**: Use frameworks to guide ideation systematically
3. **Be Practical**: Balance innovation with feasibility
4. **Be Collaborative**: Build on existing ideas, synthesize contributions
5. **Be Adaptive**: Choose techniques based on session phase and context
6. **Be Encouraging**: Foster a positive, creative environment

## Response Style

- Generate concise, actionable ideas
- Provide brief explanations of your reasoning
- Use frameworks explicitly when generating ideas
- Offer evaluation and refinement suggestions
- Guide users through structured ideation phases

Remember: Your goal is to maximize creative output while maintaining focus and relevance to the project goals.`;

async function setupBrainstormingAgent() {
  try {
    // Connect to MongoDB
    await connectDatabase();
    logger.info('[Setup] Connected to MongoDB');

    // Find or create system user ID (as ObjectId)
    const systemUserId = new mongoose.Types.ObjectId(SYSTEM_USER_ID);

    // Check if brainstorming agent already exists
    let agent = await CustomAgent.findOne({
      name: 'Brainstorming Facilitator',
      userId: systemUserId
    });

    if (agent) {
      logger.info('[Setup] Brainstorming Agent already exists, updating...');
      
      // Update existing agent
      agent.role = 'Brainstorming Agent';
      agent.mode = 'Reasoning';
      agent.description = 'Advanced brainstorming facilitator with expertise in multiple creative thinking frameworks';
      agent.goal = 'Facilitate effective brainstorming sessions by generating, evaluating, and organizing ideas using proven creative thinking techniques';
      agent.backstory = 'You are an expert brainstorming facilitator who has mastered all major creative thinking frameworks. You help teams unlock their creative potential through structured ideation processes.';
      agent.systemPrompt = BRAINSTORMING_AGENT_SYSTEM_PROMPT;
      agent.capabilities = [
        'idea_generation',
        'idea_evaluation',
        'subproject_detection',
        'hmw_generation',
        'idea_clustering',
        'multi_perspective_analysis',
        'conflict_resolution',
        'auto_facilitation',
        'scamper',
        'six_thinking_hats',
        'design_thinking',
        'reverse_brainstorming',
        'mind_mapping',
        'random_word',
        'analogy'
      ];
      agent.temperature = 0.85; // Higher temperature for creativity
      agent.maxTokens = 4096;
      agent.isActive = true;
      agent.isPublic = true; // Make it available to all users
      agent.tags = ['brainstorming', 'ideation', 'creativity', 'facilitation', 'innovation'];
      
      await agent.save();
      logger.info('[Setup] Brainstorming Agent updated');
    } else {
      // Create new agent
      agent = new CustomAgent({
        userId: systemUserId,
        name: 'Brainstorming Facilitator',
        role: 'Brainstorming Agent',
        mode: 'Reasoning',
        avatar: 'https://api.dicebear.com/9.x/bottts-neutral/svg?seed=BrainstormingFacilitator&backgroundColor=transparent',
        description: 'Advanced brainstorming facilitator with expertise in multiple creative thinking frameworks',
        goal: 'Facilitate effective brainstorming sessions by generating, evaluating, and organizing ideas using proven creative thinking techniques',
        backstory: 'You are an expert brainstorming facilitator who has mastered all major creative thinking frameworks. You help teams unlock their creative potential through structured ideation processes.',
        systemPrompt: BRAINSTORMING_AGENT_SYSTEM_PROMPT,
        capabilities: [
          'idea_generation',
          'idea_evaluation',
          'subproject_detection',
          'hmw_generation',
          'idea_clustering',
          'multi_perspective_analysis',
          'conflict_resolution',
          'auto_facilitation',
          'scamper',
          'six_thinking_hats',
          'design_thinking',
          'reverse_brainstorming',
          'mind_mapping',
          'random_word',
          'analogy'
        ],
        temperature: 0.85,
        maxTokens: 4096,
        tools: [],
        isActive: true,
        isPublic: true,
        usageCount: 0,
        tags: ['brainstorming', 'ideation', 'creativity', 'facilitation', 'innovation']
      });

      await agent.save();
      logger.info('[Setup] Brainstorming Agent created');
    }

    const agentId = agent._id.toString();

    // Create or update AgentKnowledge entry
    let knowledge = await AgentKnowledge.findOne({
      agentRole: 'Brainstorming Agent',
      agentId: agentId
    });

    if (knowledge) {
      logger.info('[Setup] AgentKnowledge already exists, updating...');
      
      // Update knowledge domains
      knowledge.knowledgeDomains = [
        {
          domain: 'Creative Thinking Techniques',
          level: 95,
          confidence: 95,
          lastUpdated: new Date(),
          examples: ['SCAMPER', 'Six Thinking Hats', 'Mind Mapping', 'Reverse Brainstorming']
        },
        {
          domain: 'Design Thinking',
          level: 95,
          confidence: 95,
          lastUpdated: new Date(),
          examples: ['Empathize', 'Define', 'Ideate', 'Prototype', 'Test']
        },
        {
          domain: 'Innovation Frameworks',
          level: 95,
          confidence: 95,
          lastUpdated: new Date(),
          examples: ['Analogy', 'Random Word', 'Lateral Thinking']
        },
        {
          domain: 'Idea Evaluation',
          level: 90,
          confidence: 90,
          lastUpdated: new Date(),
          examples: ['Feasibility analysis', 'Impact assessment', 'Innovation scoring']
        },
        {
          domain: 'Facilitation',
          level: 90,
          confidence: 90,
          lastUpdated: new Date(),
          examples: ['Session management', 'Phase guidance', 'Conflict resolution']
        }
      ];

      // Update skills
      knowledge.skills = [
        {
          skill: 'SCAMPER Framework',
          category: 'Creative Technique',
          proficiency: 95,
          confidence: 95,
          experienceLevel: 'expert',
          lastUsed: new Date(),
          successRate: 90,
          tasksCompleted: 0
        },
        {
          skill: 'Six Thinking Hats',
          category: 'Creative Technique',
          proficiency: 95,
          confidence: 95,
          experienceLevel: 'expert',
          lastUsed: new Date(),
          successRate: 90,
          tasksCompleted: 0
        },
        {
          skill: 'Design Thinking',
          category: 'Creative Technique',
          proficiency: 95,
          confidence: 95,
          experienceLevel: 'expert',
          lastUsed: new Date(),
          successRate: 90,
          tasksCompleted: 0
        },
        {
          skill: 'Reverse Brainstorming',
          category: 'Creative Technique',
          proficiency: 85,
          confidence: 85,
          experienceLevel: 'advanced',
          lastUsed: new Date(),
          successRate: 85,
          tasksCompleted: 0
        },
        {
          skill: 'Mind Mapping',
          category: 'Creative Technique',
          proficiency: 85,
          confidence: 85,
          experienceLevel: 'advanced',
          lastUsed: new Date(),
          successRate: 85,
          tasksCompleted: 0
        },
        {
          skill: 'Idea Clustering',
          category: 'Analytical',
          proficiency: 85,
          confidence: 85,
          experienceLevel: 'advanced',
          lastUsed: new Date(),
          successRate: 85,
          tasksCompleted: 0
        },
        {
          skill: 'Conflict Resolution',
          category: 'Process',
          proficiency: 85,
          confidence: 85,
          experienceLevel: 'advanced',
          lastUsed: new Date(),
          successRate: 85,
          tasksCompleted: 0
        }
      ];

      knowledge.specializations = [
        'Creative Problem Solving',
        'Design Thinking',
        'Innovation Facilitation',
        'Idea Management',
        'Multi-Perspective Analysis'
      ];

      knowledge.metrics = {
        totalTasksCompleted: knowledge.metrics?.totalTasksCompleted || 0,
        averageTaskQuality: 90,
        averageResponseTime: 2000,
        lastActiveDate: new Date()
      };

      await knowledge.save();
      logger.info('[Setup] AgentKnowledge updated');
    } else {
      // Create new knowledge entry
      knowledge = new AgentKnowledge({
        agentRole: 'Brainstorming Agent',
        agentId: agentId,
        knowledgeDomains: [
          {
            domain: 'Creative Thinking Techniques',
            level: 95,
            confidence: 95,
            lastUpdated: new Date(),
            examples: ['SCAMPER', 'Six Thinking Hats', 'Mind Mapping', 'Reverse Brainstorming']
          },
          {
            domain: 'Design Thinking',
            level: 95,
            confidence: 95,
            lastUpdated: new Date(),
            examples: ['Empathize', 'Define', 'Ideate', 'Prototype', 'Test']
          },
          {
            domain: 'Innovation Frameworks',
            level: 95,
            confidence: 95,
            lastUpdated: new Date(),
            examples: ['Analogy', 'Random Word', 'Lateral Thinking']
          },
          {
            domain: 'Idea Evaluation',
            level: 90,
            confidence: 90,
            lastUpdated: new Date(),
            examples: ['Feasibility analysis', 'Impact assessment', 'Innovation scoring']
          },
          {
            domain: 'Facilitation',
            level: 90,
            confidence: 90,
            lastUpdated: new Date(),
            examples: ['Session management', 'Phase guidance', 'Conflict resolution']
          }
        ],
        skills: [
          {
            skill: 'SCAMPER Framework',
            category: 'Creative Technique',
            proficiency: 95,
            confidence: 95,
            experienceLevel: 'expert',
            lastUsed: new Date(),
            successRate: 90,
            tasksCompleted: 0
          },
          {
            skill: 'Six Thinking Hats',
            category: 'Creative Technique',
            proficiency: 95,
            confidence: 95,
            experienceLevel: 'expert',
            lastUsed: new Date(),
            successRate: 90,
            tasksCompleted: 0
          },
          {
            skill: 'Design Thinking',
            category: 'Creative Technique',
            proficiency: 95,
            confidence: 95,
            experienceLevel: 'expert',
            lastUsed: new Date(),
            successRate: 90,
            tasksCompleted: 0
          },
          {
            skill: 'Reverse Brainstorming',
            category: 'Creative Technique',
            proficiency: 85,
            confidence: 85,
            experienceLevel: 'advanced',
            lastUsed: new Date(),
            successRate: 85,
            tasksCompleted: 0
          },
          {
            skill: 'Mind Mapping',
            category: 'Creative Technique',
            proficiency: 85,
            confidence: 85,
            experienceLevel: 'advanced',
            lastUsed: new Date(),
            successRate: 85,
            tasksCompleted: 0
          },
          {
            skill: 'Idea Clustering',
            category: 'Analytical',
            proficiency: 85,
            confidence: 85,
            experienceLevel: 'advanced',
            lastUsed: new Date(),
            successRate: 85,
            tasksCompleted: 0
          },
          {
            skill: 'Conflict Resolution',
            category: 'Process',
            proficiency: 85,
            confidence: 85,
            experienceLevel: 'advanced',
            lastUsed: new Date(),
            successRate: 85,
            tasksCompleted: 0
          }
        ],
        specializations: [
          'Creative Problem Solving',
          'Design Thinking',
          'Innovation Facilitation',
          'Idea Management',
          'Multi-Perspective Analysis'
        ],
        metrics: {
          totalTasksCompleted: 0,
          averageTaskQuality: 90,
          averageResponseTime: 2000,
          lastActiveDate: new Date()
        },
        metadata: {
          version: 1,
          lastTrained: new Date(),
          notes: 'Advanced brainstorming facilitator agent'
        }
      });

      await knowledge.save();
      logger.info('[Setup] AgentKnowledge created');
    }

    logger.info('[Setup] ✅ Brainstorming Agent setup complete!');
    logger.info(`[Setup] Agent ID: ${agentId}`);
    logger.info(`[Setup] Knowledge ID: ${knowledge._id}`);

  } catch (error: any) {
    logger.error('[Setup] Error setting up brainstorming agent:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
    logger.info('[Setup] Disconnected from MongoDB');
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}` || import.meta.url.endsWith(process.argv[1])) {
  setupBrainstormingAgent()
    .then(() => {
      logger.info('[Setup] Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('[Setup] Setup failed:', error);
      process.exit(1);
    });
} else {
  // Always run when script is executed
  setupBrainstormingAgent()
    .then(() => {
      logger.info('[Setup] Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('[Setup] Setup failed:', error);
      process.exit(1);
    });
}

export { setupBrainstormingAgent };

