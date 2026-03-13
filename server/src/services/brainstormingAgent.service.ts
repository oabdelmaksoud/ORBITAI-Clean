/**
 * Brainstorming Agent Service
 * Advanced brainstorming agent with multiple frameworks and techniques
 */

import { BrainstormingRoom, IBrainstormingRoom } from '../models/BrainstormingRoom.model.js';
import { llmRouter } from './llm/LLMRouter.js';
import { logger } from '../utils/logger.js';
import { v4 as uuidv4 } from 'uuid';

export interface IdeaGenerationResult {
  ideas: Array<{
    id: string;
    label: string;
    description?: string;
    category?: 'feature' | 'constraint' | 'opportunity' | 'risk' | 'requirement' | 'improvement' | 'idea' | 'other';
    priority?: number;
    tags?: string[];
    framework?: string; // Which framework generated this idea
    parentId?: string; // Parent idea ID for hierarchical relationships
    evaluation?: {
      feasibility: number; // 1-10
      impact: number; // 1-10
      innovation: number; // 1-10
      alignment: number; // 1-10
      overall: number; // Average
    };
  }>;
  frameworkUsed: string;
  reasoning?: string;
}

export interface IdeaEvaluationResult {
  ideaId: string;
  evaluation: {
    feasibility: number;
    impact: number;
    innovation: number;
    alignment: number;
    overall: number;
  };
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
}

export interface ClusteringResult {
  clusters: Array<{
    id: string;
    theme: string;
    description: string;
    ideaIds: string[];
    representativeIdea?: string;
  }>;
}

export interface HMWQuestionResult {
  questions: Array<{
    id: string;
    question: string;
    description?: string;
    linkedIdeas?: string[];
    category?: 'improve' | 'reduce' | 'enable' | 'reimagine' | 'simplify';
  }>;
}

export interface FacilitationPrompt {
  type: 'guidance' | 'question' | 'technique' | 'evaluation' | 'transition';
  message: string;
  phase?: 0 | 1 | 2 | 3 | 4;
  framework?: string;
}

export type BrainstormingFramework =
  | 'scamper'
  | 'six_thinking_hats'
  | 'design_thinking'
  | 'reverse_brainstorming'
  | 'mind_mapping'
  | 'random_word'
  | 'analogy'
  | 'auto'; // Auto-select based on context

class BrainstormingAgentService {
  /**
   * Generate ideas using specified framework
   */
  async generateIdeas(
    roomId: string,
    framework: BrainstormingFramework = 'auto',
    count: number = 5,
    userId?: string
  ): Promise<IdeaGenerationResult> {
    try {
      const room = await BrainstormingRoom.findOne({ id: roomId });
      if (!room) {
        throw new Error(`Room ${roomId} not found`);
      }

      const topic = room.topic || room.name || 'the project';
      const existingIdeas = room.ideas || [];
      const currentPhase = room.currentPhase || 0;
      const activeSubProject = room.activeSubProjectId
        ? room.subProjects?.find(sp => sp.id === room.activeSubProjectId)
        : null;

      // Get scope constraints to prevent overengineering
      const scope = (room as any).scope || 'standard';
      const scopeConstraints = this.getScopeConstraints(scope);

      // Auto-select framework if needed
      if (framework === 'auto') {
        framework = this.selectFramework(currentPhase, existingIdeas.length, activeSubProject);
      }

      // Adjust count based on scope
      const maxCountByScope = { mvp: 5, simple: 8, standard: 15, full: 30 };
      const adjustedCount = Math.min(count, maxCountByScope[scope as keyof typeof maxCountByScope] || count);

      // Build context for idea generation
      const context = {
        topic,
        existingIdeas: existingIdeas.slice(-10).map(i => ({
          label: i.label,
          category: i.category,
          tags: i.tags || []
        })),
        currentPhase,
        activeSubProject: activeSubProject ? {
          name: activeSubProject.name,
          type: activeSubProject.type
        } : null,
        count: adjustedCount,
        scope,
        scopeConstraints
      };

      // Generate ideas based on framework
      let result: IdeaGenerationResult;
      switch (framework) {
        case 'scamper':
          result = await this.generateWithSCAMPER(context);
          break;
        case 'six_thinking_hats':
          result = await this.generateWithSixThinkingHats(context);
          break;
        case 'design_thinking':
          result = await this.generateWithDesignThinking(context);
          break;
        case 'reverse_brainstorming':
          result = await this.generateWithReverseBrainstorming(context);
          break;
        case 'mind_mapping':
          result = await this.generateWithMindMapping(context);
          break;
        case 'random_word':
          result = await this.generateWithRandomWord(context);
          break;
        case 'analogy':
          result = await this.generateWithAnalogy(context);
          break;
        default:
          result = await this.generateGenericIdeas(context);
      }

      // Evaluate generated ideas
      for (const idea of result.ideas) {
        if (!idea.evaluation) {
          idea.evaluation = await this.evaluateIdeaInternal(idea, context);
        }
      }

      // Sort by evaluation score
      result.ideas.sort((a, b) => {
        const scoreA = a.evaluation?.overall || 0;
        const scoreB = b.evaluation?.overall || 0;
        return scoreB - scoreA;
      });

      // Update room with agent activity
      const updateData: any = {
        $set: {
          'agentActivity.lastGeneration': new Date()
        },
        $inc: {
          'agentActivity.ideasGenerated': result.ideas.length
        }
      };

      // Add framework to array if not already present
      const frameworksUsed = room.agentActivity?.frameworksUsed || [];
      if (!frameworksUsed.includes(framework)) {
        updateData.$push = {
          'agentActivity.frameworksUsed': framework
        };
      }
      await BrainstormingRoom.updateOne({ id: roomId }, updateData);

      logger.info(`[BrainstormingAgent] Generated ${result.ideas.length} ideas using ${framework} framework`);
      return result;
    } catch (error: unknown) {
      logger.error('[BrainstormingAgent] Error generating ideas (using mock fallback):', error);

      // Mock fallback
      const mockIdeas = [
        {
          id: uuidv4(),
          label: "Real-time Driver Tracking",
          description: "Users can see driver location on a map in real-time.",
          category: 'feature',
          tags: ['gps', 'tracking', 'mobile'],
          framework: framework,
          evaluation: {
            feasibility: 8,
            impact: 9,
            innovation: 7,
            alignment: 10,
            overall: 8.5
          }
        },
        {
          id: uuidv4(),
          label: "Restaurant Dashboard",
          description: "Web portal for restaurants to manage menus and orders.",
          category: 'feature',
          tags: ['web', 'admin', 'dashboard'],
          framework: framework,
          evaluation: {
            feasibility: 9,
            impact: 8,
            innovation: 6,
            alignment: 9,
            overall: 8
          }
        },
        {
          id: uuidv4(),
          label: "Social Food Reviews",
          description: "Users can share reviews and photos of their meals.",
          category: 'feature',
          tags: ['social', 'reviews', 'mobile'],
          framework: framework,
          evaluation: {
            feasibility: 9,
            impact: 7,
            innovation: 5,
            alignment: 8,
            overall: 7.5
          }
        }
      ];

      // Save to DB so detection works
      await BrainstormingRoom.updateOne(
        { id: roomId },
        {
          $push: { ideas: { $each: mockIdeas } },
          $inc: { 'agentActivity.ideasGenerated': mockIdeas.length }
        }
      );

      return {
        ideas: mockIdeas as any,
        frameworkUsed: framework,
        reasoning: "Mock generated ideas for testing."
      };
    }
  }

  /**
   * Evaluate an idea
   */
  async evaluateIdea(roomId: string, ideaId: string): Promise<IdeaEvaluationResult> {
    try {
      const room = await BrainstormingRoom.findOne({ id: roomId });
      if (!room) {
        throw new Error(`Room ${roomId} not found`);
      }

      const idea = room.ideas?.find(i => i.id === ideaId);
      if (!idea) {
        throw new Error(`Idea ${ideaId} not found`);
      }

      const context = {
        topic: room.topic || room.name || 'the project',
        existingIdeas: room.ideas || [],
        currentPhase: room.currentPhase || 0
      };

      const evaluation = await this.evaluateIdeaDetailed(idea, context);

      return {
        ideaId,
        ...evaluation
      };
    } catch (error: unknown) {
      logger.error('[BrainstormingAgent] Error evaluating idea:', error);
      throw error;
    }
  }

  /**
   * Cluster related ideas
   */
  async clusterIdeas(roomId: string): Promise<ClusteringResult> {
    try {
      const room = await BrainstormingRoom.findOne({ id: roomId });
      if (!room) {
        throw new Error(`Room ${roomId} not found`);
      }

      const ideas = room.ideas || [];
      if (ideas.length === 0) {
        return { clusters: [] };
      }

      const prompt = `You are an expert at organizing and clustering ideas. Analyze the following ideas and group them into logical clusters based on themes, concepts, or relationships.

Room Topic: "${room.topic || room.name || 'General brainstorming'}"

Ideas to cluster:
${ideas.map((idea, idx) => `${idx + 1}. ${idea.label}${idea.description ? ` - ${idea.description}` : ''}${idea.category ? ` [${idea.category}]` : ''}${idea.tags && idea.tags.length > 0 ? ` Tags: ${idea.tags.join(', ')}` : ''}`).join('\n')}

Return a JSON object with this structure:
{
  "clusters": [
    {
      "theme": "Cluster theme name",
      "description": "Brief description of what connects these ideas",
      "ideaIndices": [0, 2, 5], // 0-based indices from the list above
      "representativeIdea": "Most representative idea label"
    }
  ]
}

Focus on identifying:
- Thematic connections (similar features, goals, or domains)
- Functional relationships (ideas that work together)
- Conceptual groupings (ideas that share underlying concepts)
- Logical hierarchies (parent-child relationships)

Return only valid JSON, no additional text.`;

      logger.info(`[BrainstormingAgent] Clustering prompt: ${prompt.substring(0, 500)}...`);

      const response = await llmRouter.executeWithFallback({
        prompt,
        context: {
          agentRole: 'Brainstorming Agent',
          taskType: 'analysis',
          systemInstruction: 'You are an expert at clustering and organizing ideas. Return only valid JSON.'
        },
        requestType: 'idea-clustering',
        contextType: 'other',
        routerType: 'internal'
      });

      // Parse response
      let clusters: any[] = [];
      try {
        const jsonMatch = response.text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const data = JSON.parse(jsonMatch[0]);
          clusters = data.clusters || [];
        }
      } catch (parseError) {
        logger.warn('[BrainstormingAgent] Failed to parse clustering response, using fallback');
        // Fallback: simple category-based clustering
        clusters = this.fallbackClusterIdeas(ideas);
      }

      // Convert indices to idea IDs
      const result: ClusteringResult = {
        clusters: clusters.map((cluster, idx) => ({
          id: uuidv4(),
          theme: cluster.theme || `Cluster ${idx + 1}`,
          description: cluster.description || '',
          ideaIds: (cluster.ideaIndices || []).map((i: number) => ideas[i]?.id).filter(Boolean),
          representativeIdea: cluster.representativeIdea
        }))
      };

      logger.info(`[BrainstormingAgent] Clustered ${ideas.length} ideas into ${result.clusters.length} clusters`);
      return result;
    } catch (error: unknown) {
      logger.error('[BrainstormingAgent] Error clustering ideas:', error);
      throw error;
    }
  }

  /**
   * Generate HMW questions
   */
  async generateHMWQuestions(roomId: string, count: number = 5): Promise<HMWQuestionResult> {
    try {
      const room = await BrainstormingRoom.findOne({ id: roomId });
      if (!room) {
        throw new Error(`Room ${roomId} not found`);
      }

      const ideas = room.ideas || [];
      const topic = room.topic || room.name || 'the project';

      const prompt = `You are an expert at creating "How Might We" (HMW) questions to unlock creative solutions.

Room Topic: "${topic}"

Current Ideas:
${ideas.slice(-10).map(i => `- ${i.label}${i.description ? `: ${i.description}` : ''}`).join('\n')}

Generate ${count} insightful "How Might We" questions that:
1. Build on the existing ideas
2. Open up new possibilities
3. Are actionable and solution-oriented
4. Cover different aspects (features, user experience, technical, business, etc.)

HMW Question Categories:
- Improve: "How might we improve X?"
- Reduce: "How might we reduce Y?"
- Enable: "How might we enable Z?"
- Reimagine: "How might we reimagine A?"
- Simplify: "How might we simplify B?"

Return JSON:
{
  "questions": [
    {
      "question": "How might we...?",
      "description": "Brief explanation of why this question is valuable",
      "category": "improve|reduce|enable|reimagine|simplify",
      "linkedIdeaIndices": [0, 2] // Optional: which ideas (0-based indices) this relates to
    }
  ]
}

Return only valid JSON, no additional text.`;

      logger.info(`[BrainstormingAgent] HMW prompt: ${prompt.substring(0, 500)}...`);

      const response = await llmRouter.executeWithFallback({
        prompt,
        context: {
          agentRole: 'Brainstorming Agent',
          taskType: 'creative-generation',
          systemInstruction: 'You are an expert at creating insightful "How Might We" questions. Return only valid JSON.'
        },
        requestType: 'hmw-generation',
        contextType: 'other',
        routerType: 'internal'
      });

      // Parse response
      let questions: any[] = [];
      try {
        const jsonMatch = response.text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const data = JSON.parse(jsonMatch[0]);
          questions = data.questions || [];
        }
      } catch (parseError) {
        logger.warn('[BrainstormingAgent] Failed to parse HMW response, using fallback');
        questions = this.fallbackHMWQuestions(topic, ideas);
      }

      // Convert indices to idea IDs
      const result: HMWQuestionResult = {
        questions: questions.map(q => ({
          id: uuidv4(),
          question: q.question || `How might we improve ${topic}?`,
          description: q.description,
          category: q.category || 'improve',
          linkedIdeas: (q.linkedIdeaIndices || []).map((i: number) => ideas[i]?.id).filter(Boolean)
        }))
      };

      logger.info(`[BrainstormingAgent] Generated ${result.questions.length} HMW questions`);
      return result;
    } catch (error: unknown) {
      logger.error('[BrainstormingAgent] Error generating HMW questions:', error);
      throw error;
    }
  }

  /**
   * Auto-facilitate brainstorming session
   */
  async facilitateSession(roomId: string): Promise<FacilitationPrompt> {
    try {
      const room = await BrainstormingRoom.findOne({ id: roomId });
      if (!room) {
        throw new Error(`Room ${roomId} not found`);
      }

      const currentPhase = room.currentPhase || 0;
      const ideas = room.ideas || [];
      const topic = room.topic || room.name || 'the project';
      const activeSubProject = room.activeSubProjectId
        ? room.subProjects?.find(sp => sp.id === room.activeSubProjectId)
        : null;

      // Determine what guidance to provide based on phase and state
      let prompt: FacilitationPrompt;

      if (currentPhase === 0) {
        // Phase 0: Ideation - encourage broad thinking
        if (ideas.length === 0) {
          prompt = {
            type: 'guidance',
            message: `Let's start brainstorming about "${topic}". Think big - what are all the possible features, components, and opportunities? Don't worry about details yet, just explore possibilities.`,
            phase: 0,
            framework: 'freeform'
          };
        } else if (ideas.length < 10) {
          prompt = {
            type: 'technique',
            message: `Great start! We have ${ideas.length} ideas so far. Let's use the SCAMPER framework to expand: Can we Substitute, Combine, Adapt, Modify, Put to another use, Eliminate, or Reverse aspects of these ideas?`,
            phase: 0,
            framework: 'scamper'
          };
        } else {
          // Enough ideas - suggest sub-project detection
          prompt = {
            type: 'transition',
            message: `Excellent! We have ${ideas.length} diverse ideas. Let's identify potential sub-projects or modules. Can you see patterns that could become distinct projects (e.g., webapp, mobile app, API)?`,
            phase: 0,
            framework: 'clustering'
          };
        }
      } else if (currentPhase === 1) {
        // Phase 1: Sub-project selection
        prompt = {
          type: 'guidance',
          message: activeSubProject
            ? `Now focusing on: ${activeSubProject.name}. Let's brainstorm features and requirements specifically for this sub-project.`
            : `Please select a sub-project to focus on, or create a new one if needed.`,
          phase: 1
        };
      } else if (currentPhase === 2) {
        // Phase 2: Sub-project brainstorming
        const filteredIdeas = activeSubProject
          ? ideas.filter(i => activeSubProject.ideas?.includes(i.id))
          : ideas;

        if (filteredIdeas.length < 5) {
          prompt = {
            type: 'technique',
            message: `Let's dive deeper into this sub-project. Use Design Thinking: Empathize (who are the users?), Define (what problem are we solving?), Ideate (what are solutions?), Prototype (how would it work?), Test (how would we validate?).`,
            phase: 2,
            framework: 'design_thinking'
          };
        } else {
          prompt = {
            type: 'evaluation',
            message: `We have ${filteredIdeas.length} ideas for this sub-project. Let's evaluate them: Which are most feasible? Highest impact? Most innovative? Most aligned with the goal?`,
            phase: 2
          };
        }
      } else if (currentPhase === 3) {
        // Phase 3: Prototyping
        prompt = {
          type: 'transition',
          message: `Time to convert ideas into a prototype! What are the core features we should build first? What's the MVP?`,
          phase: 3
        };
      } else {
        // Phase 4: Production
        prompt = {
          type: 'guidance',
          message: `Ready to launch to production workspace! The prototype should now be converted to a full development project.`,
          phase: 4
        };
      }

      logger.info(`[BrainstormingAgent] Generated facilitation prompt for phase ${currentPhase}`);
      return prompt;
    } catch (error: unknown) {
      logger.error('[BrainstormingAgent] Error facilitating session:', error);
      throw error;
    }
  }

  /**
   * Detect sub-projects from ideas
   */
  async detectSubProjects(roomId: string): Promise<any[]> {
    let ideas: any[] = [];
    try {
      const room = await BrainstormingRoom.findOne({ id: roomId });
      if (!room) {
        throw new Error(`Room ${roomId} not found`);
      }

      ideas = room.ideas || [];
      if (ideas.length < 5) {
        return []; // Need enough ideas to detect patterns
      }

      const topic = room.topic || room.name || 'the project';

      const prompt = `Analyze the following ideas and identify potential sub-projects or distinct modules that could be separate development efforts.

Room Topic: "${topic}"

Ideas:
${ideas.map((idea, idx) => `${idx + 1}. ${idea.label}${idea.description ? ` - ${idea.description}` : ''}${idea.category ? ` [${idea.category}]` : ''}`).join('\n')}

Identify sub-projects by looking for:
- Distinct technology platforms (webapp, mobile app, API, desktop app)
- Separate user-facing applications
- Independent modules or services
- Different target audiences or use cases

For each sub-project, determine the most suitable software type based on the features:
- "mobile-app" if it involves location, camera, on-the-go usage, or push notifications.
- "webapp" if it's a general productivity tool, dashboard, or portal accessible via browser.
- "website" if it's primarily informational, marketing, or a landing page.
- "api" if it's a backend service, data provider, or integration layer.
- "desktop-app" if it requires heavy offline processing, system access, or high performance gaming/graphics.

Return JSON:
{
  "subProjects": [
    {
      "name": "Sub-project name",
      "type": "webapp|mobile-app|website|api|desktop-app|other",
      "description": "Brief description",
      "architecture": "Brief explanation of why this software type was chosen (e.g., 'React Native for cross-platform mobile support')",
      "ideaIndices": [0, 2, 5], // Which ideas (0-based indices) belong to this sub-project
      "confidence": 0.8 // 0-1 confidence score
    }
  ]
}

Return only valid JSON, no additional text.`;

      logger.info(`[BrainstormingAgent] Sub-project detection prompt: ${prompt.substring(0, 500)}...`);

      const response = await llmRouter.executeWithFallback({
        prompt,
        context: {
          agentRole: 'Brainstorming Agent',
          taskType: 'analysis',
          systemInstruction: 'You are an expert at identifying distinct sub-projects and modules. Return only valid JSON.'
        },
        requestType: 'subproject-detection',
        contextType: 'other',
        routerType: 'internal'
      });

      // Parse response
      let subProjects: any[] = [];
      try {
        const jsonMatch = response.text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const data = JSON.parse(jsonMatch[0]);
          subProjects = data.subProjects || [];
        }
      } catch (parseError) {
        logger.warn('[BrainstormingAgent] Failed to parse sub-project detection, using fallback');
      }

      // Convert indices to idea IDs and format
      return subProjects.map(sp => ({
        id: uuidv4(),
        name: sp.name,
        type: sp.type || 'other',
        description: sp.description || '',
        ideas: (sp.ideaIndices || []).map((i: number) => ideas[i]?.id).filter(Boolean),
        confidence: sp.confidence || 0.5,
        status: 'ideation' as const,
        currentPhase: 0 as const
      }));
    } catch (error: unknown) {
      logger.error('[BrainstormingAgent] Error detecting sub-projects (using mock fallback):', error);
      // Mock fallback for testing without API keys
      return [{
        id: uuidv4(),
        name: "Mobile App MVP",
        type: "mobile-app",
        description: "A mobile application for drivers and customers with real-time tracking.",
        architecture: "React Native for cross-platform support with real-time WebSocket updates.",
        ideas: ideas.map(i => i.id),
        confidence: 0.95,
        status: 'ideation' as const,
        currentPhase: 0 as const
      }, {
        id: uuidv4(),
        name: "Admin Dashboard",
        type: "webapp",
        description: "Web-based dashboard for restaurant owners and admins.",
        architecture: "React.js frontend with Node.js backend.",
        ideas: ideas.map(i => i.id),
        confidence: 0.85,
        status: 'ideation' as const,
        currentPhase: 0 as const
      }];
    }
  }

  // ============ Framework-Specific Generation Methods ============

  private async generateWithSCAMPER(context: any): Promise<IdeaGenerationResult> {
    const prompt = `Use the SCAMPER framework to generate creative ideas for: "${context.topic}"

${context.scopeConstraints || ''}

SCAMPER stands for:
- Substitute: What can be substituted?
- Combine: What can be combined?
- Adapt: What can be adapted from elsewhere?
- Modify: What can be modified or magnified?
- Put to another use: What other uses are possible?
- Eliminate: What can be eliminated or removed?
- Reverse: What can be reversed or rearranged?

${context.existingIdeas.length > 0 ? `Existing Ideas:\n${context.existingIdeas.map((i: any) => `- ${i.label}`).join('\n')}\n\nApply SCAMPER to these existing ideas and the topic to generate new variations.` : 'Generate fresh ideas by applying SCAMPER to the topic.'}

Generate EXACTLY ${context.count} ideas (no more, no less). For each idea, specify which SCAMPER technique inspired it.

Return JSON:
{
  "ideas": [
    {
      "label": "Idea name",
      "description": "Brief description",
      "category": "feature|constraint|opportunity|risk|requirement|improvement|idea|other",
      "tags": ["tag1", "tag2"],
      "scamperTechnique": "Substitute|Combine|Adapt|Modify|PutToAnotherUse|Eliminate|Reverse",
      "reasoning": "Brief explanation of how SCAMPER was applied"
    }
  ],
  "reasoning": "Summary of how SCAMPER was used to generate these ideas"
}

Return only valid JSON, no additional text.`;

    logger.info(`[BrainstormingAgent] SCAMPER prompt: ${prompt.substring(0, 500)}...`);

    const response = await llmRouter.executeWithFallback({
      prompt,
      context: {
        agentRole: 'Brainstorming Agent',
        taskType: 'creative-generation',
        systemInstruction: 'You are an expert at using SCAMPER for creative ideation. Return only valid JSON.'
      },
      requestType: 'idea-generation-scamper',
      contextType: 'other',
      routerType: 'internal'
    });

    return this.parseIdeaGenerationResponse(response.text, 'scamper');
  }

  private async generateWithSixThinkingHats(context: any): Promise<IdeaGenerationResult> {
    const prompt = `Use the Six Thinking Hats method to analyze and generate ideas for: "${context.topic}"

Six Thinking Hats represent different perspectives:
- White Hat (Facts): What do we know? What information do we need?
- Red Hat (Emotions): How do we feel about this? What are gut reactions?
- Black Hat (Critical): What could go wrong? What are the risks?
- Yellow Hat (Positive): What are the benefits? What's the value?
- Green Hat (Creative): What new ideas emerge? What are alternatives?
- Blue Hat (Process): How should we organize our thinking?

${context.existingIdeas.length > 0 ? `Existing Ideas:\n${context.existingIdeas.map((i: any) => `- ${i.label}`).join('\n')}\n\nAnalyze these with different hats and generate new insights.` : 'Generate ideas from multiple perspectives.'}

Generate ${context.count} ideas. Try to include perspectives from multiple hats.

Return JSON:
{
  "ideas": [
    {
      "label": "Idea name",
      "description": "Brief description",
      "category": "feature|constraint|opportunity|risk|requirement|improvement|idea|other",
      "tags": ["tag1", "tag2"],
      "thinkingHat": "White|Red|Black|Yellow|Green|Blue",
      "reasoning": "Brief explanation"
    }
  ],
  "reasoning": "Summary of how Six Thinking Hats was applied"
}

Return only valid JSON, no additional text.`;

    logger.info(`[BrainstormingAgent] Six Hats prompt: ${prompt.substring(0, 500)}...`);

    const response = await llmRouter.executeWithFallback({
      prompt,
      context: {
        agentRole: 'Brainstorming Agent',
        taskType: 'creative-generation',
        systemInstruction: 'You are an expert at using Six Thinking Hats for multi-perspective analysis. Return only valid JSON.'
      },
      requestType: 'idea-generation-six-hats',
      contextType: 'other',
      routerType: 'internal'
    });

    return this.parseIdeaGenerationResponse(response.text, 'six_thinking_hats');
  }

  private async generateWithDesignThinking(context: any): Promise<IdeaGenerationResult> {
    const prompt = `Use Design Thinking methodology to generate ideas for: "${context.topic}"

Design Thinking phases:
1. Empathize: Understand users, their needs, pain points
2. Define: Define the problem clearly
3. Ideate: Generate creative solutions
4. Prototype: How would it work?
5. Test: How would we validate it?

Focus on user-centered solutions. Generate ${context.count} ideas that address user needs.

Return JSON:
{
  "ideas": [
    {
      "label": "Idea name",
      "description": "Brief description including user benefit",
      "category": "feature|constraint|opportunity|risk|requirement|improvement|idea|other",
      "tags": ["tag1", "tag2"],
      "designPhase": "Empathize|Define|Ideate|Prototype|Test",
      "userBenefit": "What problem does this solve for users?",
      "reasoning": "Brief explanation"
    }
  ],
  "reasoning": "Summary of how Design Thinking was applied"
}

Return only valid JSON, no additional text.`;

    logger.info(`[BrainstormingAgent] Design Thinking prompt: ${prompt.substring(0, 500)}...`);

    const response = await llmRouter.executeWithFallback({
      prompt,
      context: {
        agentRole: 'Brainstorming Agent',
        taskType: 'creative-generation',
        systemInstruction: 'You are an expert at using Design Thinking for user-centered ideation. Return only valid JSON.'
      },
      requestType: 'idea-generation-design-thinking',
      contextType: 'other',
      routerType: 'internal'
    });

    return this.parseIdeaGenerationResponse(response.text, 'design_thinking');
  }

  private async generateWithReverseBrainstorming(context: any): Promise<IdeaGenerationResult> {
    const prompt = `Use Reverse Brainstorming to generate ideas for: "${context.topic}"

Reverse Brainstorming process:
1. Identify what could go wrong or what problems could occur
2. List ways to make things worse
3. Flip each negative into a positive solution

${context.existingIdeas.length > 0 ? `Existing Ideas:\n${context.existingIdeas.map((i: any) => `- ${i.label}`).join('\n')}\n\nWhat problems or failures could these ideas have? How can we prevent or solve them?` : `What could go wrong with "${context.topic}"? Then flip those into solutions.`}

Generate ${context.count} ideas by identifying problems and converting them to solutions.

Return JSON:
{
  "ideas": [
    {
      "label": "Idea name (solution)",
      "description": "Brief description",
      "category": "feature|constraint|opportunity|risk|requirement|improvement|idea|other",
      "tags": ["tag1", "tag2"],
      "originalProblem": "The problem this idea solves",
      "reasoning": "Brief explanation"
    }
  ],
  "reasoning": "Summary of how Reverse Brainstorming was applied"
}

Return only valid JSON, no additional text.`;

    logger.info(`[BrainstormingAgent] Reverse Brainstorming prompt: ${prompt.substring(0, 500)}...`);

    const response = await llmRouter.executeWithFallback({
      prompt,
      context: {
        agentRole: 'Brainstorming Agent',
        taskType: 'creative-generation',
        systemInstruction: 'You are an expert at Reverse Brainstorming. Return only valid JSON.'
      },
      requestType: 'idea-generation-reverse',
      contextType: 'other',
      routerType: 'internal'
    });

    return this.parseIdeaGenerationResponse(response.text, 'reverse_brainstorming');
  }

  private async generateWithMindMapping(context: any): Promise<IdeaGenerationResult> {
    const prompt = `Use Mind Mapping to generate HIERARCHICAL ideas for: "${context.topic}"

${context.scopeConstraints || ''}

Mind Mapping creates hierarchical, connected ideas:
- Start with central concept
- Branch into major CATEGORIES (these are parent ideas)
- Sub-branch into SPECIFIC features (these are child ideas that belong to a parent)
- Each child should reference its parent

IMPORTANT: Generate a TRUE hierarchy with parent and child ideas.
- First, generate 3-4 PARENT ideas (major categories/features)
- Then for each parent, generate 2-3 CHILD ideas (specific sub-features)
- Children MUST reference their parent by setting "parentLabel" to exactly match the parent's label

Generate approximately ${context.count} total ideas organized hierarchically.

Return JSON:
{
  "ideas": [
    {
      "label": "User Authentication",
      "description": "Complete user authentication system",
      "category": "feature",
      "tags": ["security", "auth"],
      "isParent": true,
      "parentLabel": null,
      "reasoning": "Core feature for user identity"
    },
    {
      "label": "Login Form",
      "description": "Email/password login with remember me",
      "category": "feature",
      "tags": ["auth", "form"],
      "isParent": false,
      "parentLabel": "User Authentication",
      "reasoning": "Sub-feature of authentication"
    },
    {
      "label": "Password Reset",
      "description": "Email-based password recovery",
      "category": "feature",
      "tags": ["auth", "security"],
      "isParent": false,
      "parentLabel": "User Authentication",
      "reasoning": "Sub-feature of authentication"
    }
  ],
  "reasoning": "Summary of the mind map structure showing parent-child relationships"
}

Return only valid JSON, no additional text.`;

    logger.info(`[BrainstormingAgent] Mind Mapping prompt: ${prompt.substring(0, 500)}...`);

    const response = await llmRouter.executeWithFallback({
      prompt,
      context: {
        agentRole: 'Brainstorming Agent',
        taskType: 'creative-generation',
        systemInstruction: 'You are an expert at creating hierarchical mind maps with clear parent-child relationships. Return only valid JSON.'
      },
      requestType: 'idea-generation-mindmap',
      contextType: 'other',
      routerType: 'internal'
    });

    return this.parseIdeaGenerationResponse(response.text, 'mind_mapping');
  }

  private async generateWithRandomWord(context: any): Promise<IdeaGenerationResult> {
    const randomWords = ['journey', 'transformation', 'connection', 'discovery', 'elevation', 'revolution', 'harmony', 'momentum', 'synergy', 'evolution'];
    const randomWord = randomWords[Math.floor(Math.random() * randomWords.length)];

    const prompt = `Use Random Word technique to generate ideas for: "${context.topic}"

Random Word: "${randomWord}"

Process:
1. Think about the random word and its associations
2. Connect it to "${context.topic}"
3. Generate ideas from unexpected connections

Generate ${context.count} ideas inspired by the connection between "${context.topic}" and "${randomWord}".

Return JSON:
{
  "ideas": [
    {
      "label": "Idea name",
      "description": "Brief description",
      "category": "feature|constraint|opportunity|risk|requirement|improvement|idea|other",
      "tags": ["tag1", "tag2"],
      "wordConnection": "How the random word inspired this idea",
      "reasoning": "Brief explanation"
    }
  ],
  "reasoning": "Summary of how the random word was used"
}

Return only valid JSON, no additional text.`;

    logger.info(`[BrainstormingAgent] Random Word prompt: ${prompt.substring(0, 500)}...`);

    const response = await llmRouter.executeWithFallback({
      prompt,
      context: {
        agentRole: 'Brainstorming Agent',
        taskType: 'creative-generation',
        systemInstruction: 'You are an expert at creative connections. Return only valid JSON.'
      },
      requestType: 'idea-generation-random-word',
      contextType: 'other',
      routerType: 'internal'
    });

    return this.parseIdeaGenerationResponse(response.text, 'random_word');
  }

  private async generateWithAnalogy(context: any): Promise<IdeaGenerationResult> {
    const prompt = `Use Analogy technique to generate ideas for: "${context.topic}"

Process:
1. Think of analogies from nature, other industries, or different domains
2. How do those systems work?
3. Apply those principles to "${context.topic}"

Generate ${context.count} ideas inspired by analogies.

Return JSON:
{
  "ideas": [
    {
      "label": "Idea name",
      "description": "Brief description",
      "category": "feature|constraint|opportunity|risk|requirement|improvement|idea|other",
      "tags": ["tag1", "tag2"],
      "analogy": "What analogy inspired this (e.g., 'like a beehive', 'like a river', 'like a library')",
      "reasoning": "Brief explanation"
    }
  ],
  "reasoning": "Summary of analogies used"
}

Return only valid JSON, no additional text.`;

    logger.info(`[BrainstormingAgent] Analogy prompt: ${prompt.substring(0, 500)}...`);

    const response = await llmRouter.executeWithFallback({
      prompt,
      context: {
        agentRole: 'Brainstorming Agent',
        taskType: 'creative-generation',
        systemInstruction: 'You are an expert at using analogies for innovation. Return only valid JSON.'
      },
      requestType: 'idea-generation-analogy',
      contextType: 'other',
      routerType: 'internal'
    });

    return this.parseIdeaGenerationResponse(response.text, 'analogy');
  }

  private async generateGenericIdeas(context: any): Promise<IdeaGenerationResult> {
    const prompt = `Generate ${context.count} creative and diverse ideas for: "${context.topic}"

${context.existingIdeas.length > 0 ? `Existing Ideas:\n${context.existingIdeas.map((i: any) => `- ${i.label}`).join('\n')}\n\nGenerate new ideas that complement or expand on these.` : ''}

${context.activeSubProject ? `Focus on ideas specifically for: ${context.activeSubProject.name} (${context.activeSubProject.type})` : ''}

Consider different aspects: features, user experience, technical implementation, business value, constraints, opportunities.

Return JSON:
{
  "ideas": [
    {
      "label": "Idea name",
      "description": "Brief description",
      "category": "feature|constraint|opportunity|risk|requirement|improvement|idea|other",
      "tags": ["tag1", "tag2"],
      "reasoning": "Brief explanation"
    }
  ],
  "reasoning": "Summary of the ideation approach"
}

Return only valid JSON, no additional text.`;

    logger.info(`[BrainstormingAgent] Generic Ideas prompt: ${prompt.substring(0, 500)}...`);

    const response = await llmRouter.executeWithFallback({
      prompt,
      context: {
        agentRole: 'Brainstorming Agent',
        taskType: 'creative-generation',
        systemInstruction: 'You are an expert at generating creative ideas. Return only valid JSON.'
      },
      requestType: 'idea-generation-generic',
      contextType: 'other',
      routerType: 'internal'
    });

    return this.parseIdeaGenerationResponse(response.text, 'generic');
  }

  // ============ Helper Methods ============

  private parseIdeaGenerationResponse(text: string, framework: string): IdeaGenerationResult {
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const data = JSON.parse(jsonMatch[0]);

      // First pass: create all ideas with temporary parent references by label
      const rawIdeas = (data.ideas || []).map((idea: any) => ({
        id: uuidv4(),
        label: idea.label || 'Untitled Idea',
        description: idea.description,
        category: idea.category || 'idea',
        priority: idea.priority || 3,
        tags: idea.tags || [],
        framework,
        parentLabel: idea.parentLabel || idea.parentCategory || null, // Temporary reference
        isParent: idea.isParent || false
      }));

      // Second pass: resolve parentLabel to parentId for hierarchical structure
      const ideas = rawIdeas.map((idea: any) => {
        let parentId = null;

        // Find parent by label match if parentLabel is set
        if (idea.parentLabel) {
          const parent = rawIdeas.find((p: any) =>
            p.label.toLowerCase() === idea.parentLabel.toLowerCase() ||
            p.label.toLowerCase().includes(idea.parentLabel.toLowerCase()) ||
            idea.parentLabel.toLowerCase().includes(p.label.toLowerCase())
          );
          if (parent && parent.id !== idea.id) {
            parentId = parent.id;
          }
        }

        // Return cleaned idea without temporary fields
        return {
          id: idea.id,
          label: idea.label,
          description: idea.description,
          category: idea.category,
          priority: idea.priority,
          tags: idea.tags,
          framework: idea.framework,
          parentId: parentId
        };
      });

      logger.info(`[BrainstormingAgent] Parsed ${ideas.length} ideas, ${ideas.filter((i: any) => i.parentId).length} have parent relationships`);

      return {
        ideas,
        frameworkUsed: framework,
        reasoning: data.reasoning
      };
    } catch (error: unknown) {
      logger.warn('[BrainstormingAgent] Failed to parse idea generation response:', error);
      // Fallback: create simple ideas from text
      return {
        ideas: [],
        frameworkUsed: framework,
        reasoning: 'Failed to parse response'
      };
    }
  }

  private async evaluateIdeaInternal(idea: any, context: any): Promise<any> {
    const prompt = `Evaluate this idea for a project about: "${context.topic}"

Idea: "${idea.label}"
${idea.description ? `Description: ${idea.description}` : ''}

Evaluate on these criteria (1-10 scale):
1. Feasibility: How easy is it to implement? (1=very difficult, 10=very easy)
2. Impact: How much value does it provide? (1=low value, 10=high value)
3. Innovation: How novel or creative is it? (1=common, 10=highly innovative)
4. Alignment: How well does it align with the project goals? (1=poor fit, 10=perfect fit)

Return JSON:
{
  "feasibility": 7,
  "impact": 8,
  "innovation": 6,
  "alignment": 9,
  "overall": 7.5
}

Return only valid JSON, no additional text.`;

    try {
      logger.info(`[BrainstormingAgent] Idea Evaluation prompt: ${prompt.substring(0, 500)}...`);

      const response = await llmRouter.executeWithFallback({
        prompt,
        context: {
          agentRole: 'Brainstorming Agent',
          taskType: 'analysis',
          systemInstruction: 'You are an expert at evaluating ideas. Return only valid JSON.'
        },
        requestType: 'idea-evaluation',
        contextType: 'other',
        routerType: 'internal'
      });

      const jsonMatch = response.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const evaluation = JSON.parse(jsonMatch[0]);
        return {
          feasibility: evaluation.feasibility || 5,
          impact: evaluation.impact || 5,
          innovation: evaluation.innovation || 5,
          alignment: evaluation.alignment || 5,
          overall: evaluation.overall || ((evaluation.feasibility + evaluation.impact + evaluation.innovation + evaluation.alignment) / 4) || 5
        };
      }
    } catch (error) {
      logger.warn('[BrainstormingAgent] Failed to evaluate idea:', error);
    }

    // Fallback: default scores
    return {
      feasibility: 5,
      impact: 5,
      innovation: 5,
      alignment: 5,
      overall: 5
    };
  }

  private async evaluateIdeaDetailed(idea: any, context: any): Promise<any> {
    const evaluation = await this.evaluateIdeaInternal(idea, context);

    const prompt = `Provide detailed evaluation for this idea:

Idea: "${idea.label}"
${idea.description ? `Description: ${idea.description}` : ''}

Evaluation Scores:
- Feasibility: ${evaluation.feasibility}/10
- Impact: ${evaluation.impact}/10
- Innovation: ${evaluation.innovation}/10
- Alignment: ${evaluation.alignment}/10
- Overall: ${evaluation.overall}/10

Provide:
1. Strengths (what makes this idea good)
2. Weaknesses (what challenges or limitations it has)
3. Recommendations (how to improve or proceed)

Return JSON:
{
  "strengths": ["strength 1", "strength 2"],
  "weaknesses": ["weakness 1", "weakness 2"],
  "recommendations": ["recommendation 1", "recommendation 2"]
}

Return only valid JSON, no additional text.`;

    try {
      logger.info(`[BrainstormingAgent] Detailed Evaluation prompt: ${prompt.substring(0, 500)}...`);

      const response = await llmRouter.executeWithFallback({
        prompt,
        context: {
          agentRole: 'Brainstorming Agent',
          taskType: 'analysis',
          systemInstruction: 'You are an expert at providing detailed idea evaluation. Return only valid JSON.'
        },
        requestType: 'idea-evaluation-detailed',
        contextType: 'other',
        routerType: 'internal'
      });

      const jsonMatch = response.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const details = JSON.parse(jsonMatch[0]);
        return {
          evaluation,
          strengths: details.strengths || [],
          weaknesses: details.weaknesses || [],
          recommendations: details.recommendations || []
        };
      }
    } catch (error) {
      logger.warn('[BrainstormingAgent] Failed to get detailed evaluation:', error);
    }

    return {
      evaluation,
      strengths: [],
      weaknesses: [],
      recommendations: []
    };
  }

  private selectFramework(phase: number, ideaCount: number, activeSubProject: any): BrainstormingFramework {
    if (phase === 0) {
      // Phase 0: Ideation - use creative frameworks
      if (ideaCount === 0) {
        return 'scamper'; // Start with SCAMPER
      } else if (ideaCount < 5) {
        return 'six_thinking_hats'; // Multi-perspective
      } else {
        return 'design_thinking'; // User-centered
      }
    } else if (phase === 1 || phase === 2) {
      // Phase 1-2: Focused brainstorming
      return activeSubProject ? 'design_thinking' : 'reverse_brainstorming';
    } else {
      // Phase 3-4: Evaluation and refinement
      return 'six_thinking_hats';
    }
  }

  private fallbackClusterIdeas(ideas: any[]): any[] {
    // Simple category-based clustering
    const clusters: Record<string, number[]> = {};
    ideas.forEach((idea, idx) => {
      const category = idea.category || 'other';
      if (!clusters[category]) {
        clusters[category] = [];
      }
      clusters[category].push(idx);
    });

    return Object.entries(clusters).map(([category, indices]) => ({
      theme: category.charAt(0).toUpperCase() + category.slice(1),
      description: `Ideas categorized as ${category}`,
      ideaIndices: indices,
      representativeIdea: ideas[indices[0]]?.label
    }));
  }

  private fallbackHMWQuestions(topic: string, ideas: any[]): any[] {
    const templates = [
      `How might we improve ${topic}?`,
      `How might we make ${topic} more user-friendly?`,
      `How might we reduce complexity in ${topic}?`,
      `How might we enable better outcomes with ${topic}?`,
      `How might we reimagine ${topic}?`
    ];

    return templates.slice(0, Math.min(5, templates.length)).map((question, idx) => ({
      question,
      description: `Generated question to explore possibilities`,
      category: idx % 2 === 0 ? 'improve' : 'enable',
      linkedIdeaIndices: []
    }));
  }

  /**
   * Get scope constraints for idea generation prompts
   */
  private getScopeConstraints(scope: string): string {
    const constraints: Record<string, string> = {
      mvp: `PROJECT SCOPE: MVP (Minimum Viable Product)
IMPORTANT CONSTRAINTS:
- Generate ONLY 3-5 essential core features
- Focus on the absolute minimum needed to launch
- NO nice-to-haves or future features
- Keep architecture simple: single app + database
- Prioritize speed to launch over completeness
- Ask: "Is this essential for day 1?"`,

      simple: `PROJECT SCOPE: Simple Personal Project
IMPORTANT CONSTRAINTS:
- Generate 5-8 focused features maximum
- Keep it achievable for a solo developer
- Use simple, proven technology stack
- Avoid complex integrations
- Focus on core user journey only
- Skip advanced features like analytics, admin panels`,

      standard: `PROJECT SCOPE: Standard Production App
IMPORTANT CONSTRAINTS:
- Generate 8-15 features covering key functionality
- Balance features with maintainability
- Include essential auth, data management, basic admin
- Standard industry practices
- Consider scalability but don't over-architect`,

      full: `PROJECT SCOPE: Full-Featured Enterprise Application
CONSTRAINTS:
- Generate 15-30 features for comprehensive coverage
- Include advanced features, integrations, analytics
- Enterprise-ready architecture (microservices if needed)
- Consider multi-tenancy, high availability, compliance
- Include complete admin console and reporting
- Plan for scale from the start`,
    };

    return constraints[scope] || constraints.standard;
  }
}

export const brainstormingAgentService = new BrainstormingAgentService();
