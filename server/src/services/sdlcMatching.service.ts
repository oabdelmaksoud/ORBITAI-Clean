/**
 * SDLC Methodology Matching Service
 * Automatically selects the best SDLC methodology and estimates sprint count
 * based on project characteristics
 */

import { logger } from '../utils/logger.js';
import { apiKeyProvider } from './apiKeyProvider.service.js';
import { ChatOpenAI } from '@langchain/openai';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { llmRouter } from './llm/LLMRouter.js';
import { enhancePrompt } from './promptEngineering.service.js';

export type Methodology =
  | 'V-Model'
  | 'Agile'
  | 'Waterfall'
  | 'Spiral'
  | 'DevOps'
  | 'Iterative'
  | 'Prototyping'
  | 'RAD'
  | 'Scrum'
  | 'Lean'
  | 'ASD';

export interface ProjectContext {
  name: string;
  description: string;
  category?: string;
  projectType?: string;
  industry?: string;
  standards?: string[];
  complexity?: 'simple' | 'moderate' | 'complex';
  teamSize?: number;
  timeline?: string;
  requirements?: string[];
}

export interface SDLCRecommendation {
  methodology: Methodology;
  estimatedSprints: number;
  reasoning: string;
  matchFactors: {
    projectType?: number;
    industry?: number;
    complexity?: number;
    standards?: number;
    timeline?: number;
  };
  methodologyDetails: {
    description: string;
    phases: string[];
    typicalSprintCount: number;
    bestFor: string[];
  };
}

export interface SprintEstimation {
  totalSprints: number;
  sprintsPerPhase: Record<string, number>;
  reasoning: string;
  factors: {
    complexity: number;
    methodology: number;
    teamSize: number;
    requirements: number;
    projectType?: number;
    featureCount?: number;
    [key: string]: number | undefined;
  };
}

class SDLCMatchingService {
  // @ts-ignore TS6133
  private _llm: any = null;
  private initialized: boolean = false;

  /**
   * Initialize the service
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Initialize LLM for methodology analysis (using database-stored API keys)
      const openaiKey = await apiKeyProvider.getApiKey('openai');
      const geminiKey = await apiKeyProvider.getApiKey('gemini');

      if (openaiKey) {
        this._llm = new ChatOpenAI({
          modelName: 'gpt-4o',
          temperature: 0.7,
          openAIApiKey: openaiKey,
        });
      } else if (geminiKey) {
        this._llm = new ChatGoogleGenerativeAI({
          model: 'gemini-3-pro-preview',
          temperature: 0.7,
          apiKey: geminiKey,
        });
      } else {
        throw new Error(
          'No LLM API key configured for SDLC matching. Add API keys via Admin Console → Settings → API Keys'
        );
      }

      this.initialized = true;
      logger.info('✅ SDLC Matching service initialized');
    } catch (error: unknown) {
      logger.error('Failed to initialize SDLC Matching service:', error);
      throw error;
    }
  }

  /**
   * Extract project metadata from description
   * Enhanced to automatically infer all project characteristics from natural language
   */
  extractProjectMetadata(context: ProjectContext): {
    projectType: string[];
    industry: string[];
    complexity: 'simple' | 'moderate' | 'complex';
    keywords: string[];
    teamSize?: number;
    timeline?: string;
    requirementsCount?: number;
  } {
    const fullText = `${context.name} ${context.description} ${context.requirements?.join(' ') || ''}`;
    const text = fullText.toLowerCase();

    // ENHANCEMENT: Extract team size from description
    let teamSize: number | undefined = context.teamSize;
    if (!teamSize) {
      const teamSizeMatch = text.match(
        /\b(?:team|developers?|engineers?|programmers?)\s*(?:of|with|:)?\s*(\d+)\b/i
      );
      if (teamSizeMatch) {
        teamSize = parseInt(teamSizeMatch[1]);
      } else {
        // Infer from description length and complexity
        const descLength = context.description?.length || 0;
        if (descLength > 2000)
          teamSize = 5; // Large description = larger team
        else if (descLength > 1000) teamSize = 3;
        else if (descLength > 500) teamSize = 2;
        else teamSize = 1;
      }
    }

    // ENHANCEMENT: Extract timeline from description
    let timeline: string | undefined = context.timeline;
    if (!timeline) {
      const timelinePatterns = [
        /\b(\d+)\s*(?:weeks?|wks?)\b/i,
        /\b(\d+)\s*(?:months?|mos?)\b/i,
        /\b(\d+)\s*(?:sprints?)\b/i,
        /\b(?:deadline|due|deliver|launch|release)\s*(?:in|by|within)?\s*(\d+)\s*(?:weeks?|months?)\b/i,
      ];
      for (const pattern of timelinePatterns) {
        const match = fullText.match(pattern);
        if (match) {
          const value = match[1];
          const unit = match[0].toLowerCase().includes('month')
            ? 'month'
            : match[0].toLowerCase().includes('sprint')
              ? 'sprint'
              : 'week';
          timeline = `${value} ${unit}${parseInt(value) > 1 ? 's' : ''}`;
          break;
        }
      }
    }

    // ENHANCEMENT: Estimate requirements count from description
    let requirementsCount: number | undefined = context.requirements?.length;
    if (!requirementsCount || requirementsCount === 0) {
      // Count feature mentions, user stories, or requirement indicators
      const featurePatterns = [
        /\b(feature|functionality|function|capability|requirement|need|must|should)\b/gi,
        /\b(user\s+can|user\s+should|system\s+must|system\s+should)\b/gi,
        /\b(?:implement|build|create|develop|add|include)\s+[^.!?]+/gi,
      ];
      let featureCount = 0;
      for (const pattern of featurePatterns) {
        const matches = fullText.match(pattern);
        if (matches) featureCount += matches.length;
      }
      // Estimate based on description structure
      const sentences = fullText.split(/[.!?]+/).filter(s => s.trim().length > 20);
      const bulletPoints = fullText.split(/\n|\r/).filter(line => /^[\s]*[-*•]\s/.test(line));
      requirementsCount = Math.max(
        featureCount,
        Math.ceil(sentences.length * 0.3), // ~30% of sentences are requirements
        bulletPoints.length
      );
      // Cap at reasonable maximum
      requirementsCount = Math.min(requirementsCount, 50);
    }

    // ENHANCEMENT: Enhanced project type detection with more patterns
    const projectTypes: string[] = [];
    if (
      text.match(
        /\b(web|website|webapp|web-app|saas|web\s+application|web\s+platform|online|portal)\b/
      )
    ) {
      projectTypes.push('web-app');
    }
    if (
      text.match(/\b(mobile|ios|android|iphone|ipad|smartphone|tablet|app\s+store|play\s+store)\b/)
    ) {
      projectTypes.push('mobile-app');
    }
    if (text.match(/\b(api|rest\s+api|graphql|microservice|backend\s+service|service\s+layer)\b/)) {
      projectTypes.push('api');
    }
    if (
      text.match(
        /\b(embedded|firmware|device|hardware|iot|internet\s+of\s+things|sensor|microcontroller)\b/
      )
    ) {
      projectTypes.push('embedded');
    }
    if (text.match(/\b(desktop|windows\s+app|mac\s+app|linux\s+app|standalone\s+application)\b/)) {
      projectTypes.push('desktop-app');
    }
    if (
      text.match(/\b(cloud|serverless|aws|azure|gcp|google\s+cloud|amazon|microsoft\s+azure)\b/)
    ) {
      projectTypes.push('cloud');
    }
    if (text.match(/\b(game|gaming|video\s+game|interactive|playable)\b/)) {
      projectTypes.push('game');
    }

    // ENHANCEMENT: Enhanced industry detection with more patterns
    const industries: string[] = [];
    if (
      text.match(
        /\b(automotive|car|vehicle|truck|automobile|driving|autonomous|self-driving|adas)\b/
      )
    ) {
      industries.push('automotive');
    }
    if (
      text.match(
        /\b(healthcare|medical|health|hospital|patient|doctor|clinic|pharmacy|telemedicine|ehr|electronic\s+health)\b/
      )
    ) {
      industries.push('healthcare');
    }
    if (
      text.match(
        /\b(finance|banking|financial|payment|transaction|credit\s+card|bank|fintech|trading|investment)\b/
      )
    ) {
      industries.push('finance');
    }
    if (text.match(/\b(aerospace|aviation|aircraft|airplane|flight|avionics|space|satellite)\b/)) {
      industries.push('aerospace');
    }
    if (text.match(/\b(railway|rail|train|railroad|metro|subway|transit)\b/)) {
      industries.push('railway');
    }
    if (text.match(/\b(nuclear|power-plant|energy|power\s+generation)\b/)) {
      industries.push('nuclear');
    }
    if (text.match(/\b(e-commerce|ecommerce|retail|shopping|store|marketplace|online\s+store)\b/)) {
      industries.push('retail');
    }
    if (text.match(/\b(education|school|university|college|learning|student|course|training)\b/)) {
      industries.push('education');
    }
    if (text.match(/\b(government|public\s+sector|gov|municipal|federal)\b/)) {
      industries.push('government');
    }

    // ENHANCEMENT: Enhanced complexity estimation with more indicators
    let complexity: 'simple' | 'moderate' | 'complex' = context.complexity || 'moderate';

    const complexityIndicators = {
      simple: [
        /\b(simple|basic|small|minimal|single|one|straightforward|easy)\b/,
        /\b(landing\s+page|static|brochure|portfolio|single\s+page)\b/,
        /\b(prototype|poc|proof\s+of\s+concept|mvp|minimal\s+viable)\b/,
        /\b(quick|fast|simple\s+app|basic\s+website)\b/,
      ],
      complex: [
        /\b(complex|enterprise|large|scale|distributed|microservices|multi|multiple)\b/,
        /\b(safety-critical|mission-critical|critical|regulated|certification|compliance)\b/,
        /\b(ai|machine-learning|ml|neural|deep-learning|artificial\s+intelligence)\b/,
        /\b(real-time|real-time\s+system|embedded\s+system|firmware)\b/,
        /\b(integration|integrate|multiple\s+systems|legacy|migration)\b/,
        /\b(enterprise|large\s+scale|distributed|scalable|high\s+availability)\b/,
      ],
    };

    const simpleCount = complexityIndicators.simple.filter(pattern => pattern.test(text)).length;
    const complexCount = complexityIndicators.complex.filter(pattern => pattern.test(text)).length;

    // ENHANCEMENT: Use description length and structure to infer complexity
    const descLength = context.description?.length || 0;
    const hasMultipleFeatures =
      (fullText.match(/\b(and|also|additionally|plus|including)\b/gi) || []).length > 3;
    const hasTechnicalTerms =
      (
        fullText.match(
          /\b(database|api|authentication|encryption|deployment|infrastructure)\b/gi
        ) || []
      ).length > 2;

    if (
      complexCount > simpleCount &&
      (complexCount >= 2 || descLength > 1500 || hasTechnicalTerms)
    ) {
      complexity = 'complex';
    } else if (
      simpleCount > complexCount &&
      simpleCount >= 2 &&
      descLength < 500 &&
      !hasMultipleFeatures
    ) {
      complexity = 'simple';
    } else if (descLength > 2000 || hasMultipleFeatures || requirementsCount > 15) {
      complexity = 'complex';
    } else if (descLength < 300 && requirementsCount < 5) {
      complexity = 'simple';
    }

    // Extract keywords with enhanced patterns
    const keywords = [...projectTypes, ...industries, ...(context.standards || [])].filter(
      (v, i, a) => a.indexOf(v) === i
    );

    return {
      projectType: projectTypes.length > 0 ? projectTypes : ['general'],
      industry: industries.length > 0 ? industries : ['general'],
      complexity,
      keywords,
      teamSize,
      timeline,
      requirementsCount,
    };
  }

  /**
   * Recommend SDLC methodology
   */
  async recommendMethodology(context: ProjectContext): Promise<SDLCRecommendation> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const metadata = this.extractProjectMetadata(context);

      // Methodology selection logic
      let methodology: Methodology = 'V-Model';
      // @ts-expect-error TS6133 - score assigned for methodology scoring
      let _score = 0;
      const matchFactors: SDLCRecommendation['matchFactors'] = {};

      // ENHANCEMENT: Research-based methodology selection with priority rules

      // V-Model indicators - REQUIRED for safety-critical industries
      const vModelIndicators = {
        industries: ['automotive', 'aerospace', 'railway', 'nuclear', 'healthcare'],
        projectTypes: ['embedded', 'firmware'],
        keywords: [
          'safety-critical',
          'mission-critical',
          'regulated',
          'certification',
          'compliance',
          'functional-safety',
        ],
        standards: ['iso26262', 'aspice', 'do178c', 'iec62304', 'en50128'],
        // Research-based: V-Model is REQUIRED when:
        // - Safety-critical systems (automotive, aerospace, medical devices)
        // - Regulated industries requiring certification
        // - Fixed requirements with high documentation needs
        // - Low risk tolerance
        priority: 'high', // High priority for safety-critical
      };

      // Agile indicators - BEST for flexible, evolving requirements
      const agileIndicators = {
        industries: ['general', 'e-commerce', 'saas', 'startup', 'retail'],
        projectTypes: ['web-app', 'mobile-app', 'api', 'cloud'],
        keywords: [
          'iterative',
          'rapid',
          'flexible',
          'user-feedback',
          'mvp',
          'startup',
          'evolving',
          'changing',
        ],
        // Research-based: Agile is BEST when:
        // - Requirements are unclear or evolving
        // - Need for flexibility and adaptability
        // - High customer involvement needed
        // - Medium to large projects with changing priorities
        // - Cross-functional teams
        priority: 'medium',
      };

      // Waterfall indicators - BEST for fixed requirements, small projects
      const waterfallIndicators = {
        industries: ['government', 'defense', 'legacy'],
        projectTypes: ['desktop-app', 'legacy'],
        keywords: [
          'fixed-requirements',
          'sequential',
          'documentation-heavy',
          'contract',
          'well-defined',
          'stable',
        ],
        // Research-based: Waterfall is BEST when:
        // - Requirements are well-defined and stable
        // - Small to medium projects
        // - Fixed deadlines and budgets
        // - Low risk tolerance
        // - Limited customer involvement
        priority: 'low', // Lower priority, but good for specific cases
      };

      // Spiral indicators - BEST for high-risk, complex projects
      const spiralIndicators = {
        industries: ['aerospace', 'defense', 'healthcare'],
        projectTypes: ['embedded', 'complex-system'],
        keywords: ['high-risk', 'risk-analysis', 'complex', 'uncertain-requirements', 'prototype'],
        // Research-based: Spiral is BEST when:
        // - High-risk projects requiring ongoing risk assessment
        // - Complex systems with uncertain requirements
        // - Need for prototyping and iterative risk management
        priority: 'medium',
      };

      // DevOps indicators - BEST for cloud-native, CI/CD projects
      const devOpsIndicators = {
        industries: ['general', 'saas', 'cloud', 'e-commerce'],
        projectTypes: ['cloud', 'microservices', 'api', 'web-app'],
        keywords: [
          'continuous-integration',
          'continuous-deployment',
          'ci-cd',
          'automation',
          'infrastructure',
          'microservices',
        ],
        // Research-based: DevOps is BEST when:
        // - Cloud-native applications
        // - Need for continuous delivery
        // - Microservices architecture
        // - Infrastructure automation required
        priority: 'medium',
      };

      // Iterative indicators - BEST for large projects with evolving requirements
      const iterativeIndicators = {
        industries: ['general', 'e-commerce', 'enterprise'],
        projectTypes: ['web-app', 'mobile-app', 'api'],
        keywords: ['iterative', 'incremental', 'evolutionary', 'refinement', 'large', 'enterprise'],
        // Research-based: Iterative is BEST when:
        // - Large projects that need to evolve incrementally
        // - Evolving requirements
        // - Incremental delivery needed
        priority: 'medium',
      };

      // Prototyping indicators - BEST for unclear requirements, validation
      const prototypingIndicators = {
        industries: ['general', 'startup'],
        projectTypes: ['web-app', 'mobile-app'],
        keywords: [
          'prototype',
          'proof-of-concept',
          'poc',
          'user-feedback',
          'validation',
          'unclear',
        ],
        // Research-based: Prototyping is BEST when:
        // - Unclear user needs
        // - Need for early validation
        // - Proof of concept required
        // - Early feedback needed
        priority: 'low',
      };

      // RAD indicators - BEST for time-sensitive, well-understood requirements
      const radIndicators = {
        industries: ['general', 'e-commerce', 'startup'],
        projectTypes: ['web-app', 'mobile-app', 'api'],
        keywords: [
          'rapid',
          'fast-development',
          'quick-delivery',
          'time-sensitive',
          'well-understood',
        ],
        // Research-based: RAD is BEST when:
        // - Time-sensitive projects
        // - Well-understood requirements
        // - Quick delivery needed
        priority: 'medium',
      };

      // Scrum indicators - BEST for structured Agile teams
      const scrumIndicators = {
        industries: ['general', 'saas', 'e-commerce', 'enterprise'],
        projectTypes: ['web-app', 'mobile-app', 'api'],
        keywords: ['scrum', 'sprint', 'product-owner', 'scrum-master', 'agile', 'structured'],
        // Research-based: Scrum is BEST when:
        // - Need structure within Agile approach
        // - Cross-functional teams
        // - Product development
        // - Regular sprint cycles
        priority: 'high', // High priority for Agile projects
      };

      // Lean indicators - BEST for startups, MVP development
      const leanIndicators = {
        industries: ['general', 'startup', 'saas'],
        projectTypes: ['web-app', 'mobile-app', 'api'],
        keywords: ['lean', 'waste-elimination', 'minimal-viable', 'mvp', 'efficiency', 'startup'],
        // Research-based: Lean is BEST when:
        // - Startups and MVP development
        // - Waste elimination focus
        // - Maximum efficiency needed
        // - Minimal viable product approach
        priority: 'medium',
      };

      // ASD (Adaptive Software Development) indicators - BEST for high uncertainty
      const asdIndicators = {
        industries: ['general', 'startup', 'saas', 'e-commerce'],
        projectTypes: ['web-app', 'mobile-app', 'api', 'cloud'],
        keywords: [
          'adaptive',
          'uncertain',
          'changing',
          'evolving',
          'speculate',
          'collaborate',
          'learn',
          'high-uncertainty',
          'rapid-change',
        ],
        // Research-based: ASD is BEST when:
        // - High uncertainty and rapidly changing requirements
        // - Need for continuous adaptation
        // - Learning-oriented development
        // - Replaces linear cycles with speculate-collaborate-learn
        priority: 'medium',
      };

      // Score methodologies
      const vModelScore = this.scoreMethodology(vModelIndicators, metadata, context);
      const agileScore = this.scoreMethodology(agileIndicators, metadata, context);
      const waterfallScore = this.scoreMethodology(waterfallIndicators, metadata, context);
      const spiralScore = this.scoreMethodology(spiralIndicators, metadata, context);
      const devOpsScore = this.scoreMethodology(devOpsIndicators, metadata, context);
      const iterativeScore = this.scoreMethodology(iterativeIndicators, metadata, context);
      const prototypingScore = this.scoreMethodology(prototypingIndicators, metadata, context);
      const radScore = this.scoreMethodology(radIndicators, metadata, context);
      const scrumScore = this.scoreMethodology(scrumIndicators, metadata, context);
      const leanScore = this.scoreMethodology(leanIndicators, metadata, context);
      const asdScore = this.scoreMethodology(asdIndicators, metadata, context);

      // Select best methodology
      const scores = [
        { methodology: 'V-Model' as Methodology, score: vModelScore },
        { methodology: 'Agile' as Methodology, score: agileScore },
        { methodology: 'Waterfall' as Methodology, score: waterfallScore },
        { methodology: 'Spiral' as Methodology, score: spiralScore },
        { methodology: 'DevOps' as Methodology, score: devOpsScore },
        { methodology: 'Iterative' as Methodology, score: iterativeScore },
        { methodology: 'Prototyping' as Methodology, score: prototypingScore },
        { methodology: 'RAD' as Methodology, score: radScore },
        { methodology: 'Scrum' as Methodology, score: scrumScore },
        { methodology: 'Lean' as Methodology, score: leanScore },
        { methodology: 'ASD' as Methodology, score: asdScore },
      ];

      scores.sort((a, b) => b.score - a.score);
      methodology = scores[0].methodology;
      _score = scores[0].score;

      // Calculate match factors
      matchFactors.projectType = this.calculateMatch(
        metadata.projectType,
        this.getMethodologyProjectTypes(methodology)
      );
      matchFactors.industry = this.calculateMatch(
        metadata.industry,
        this.getMethodologyIndustries(methodology)
      );
      matchFactors.complexity =
        metadata.complexity === 'complex' ? 1.0 : metadata.complexity === 'moderate' ? 0.5 : 0.2;
      matchFactors.standards = context.standards
        ? this.calculateStandardsMatch(context.standards, methodology)
        : 0;

      // ENHANCEMENT: Use extracted metadata for sprint estimation
      const enhancedContext = {
        ...context,
        teamSize: metadata.teamSize || context.teamSize,
        timeline: metadata.timeline || context.timeline,
        requirements:
          context.requirements ||
          (metadata.requirementsCount
            ? Array(metadata.requirementsCount)
                .fill(0)
                .map((_, i) => `Requirement ${i + 1}`)
            : undefined),
      };

      // Estimate sprints
      const sprintEstimation = await this.estimateSprints(methodology, metadata, enhancedContext);

      // Get methodology details
      const methodologyDetails = this.getMethodologyDetails(methodology);

      // Generate reasoning
      const reasoning = this.generateReasoning(methodology, metadata, context, scores);

      return {
        methodology,
        estimatedSprints: sprintEstimation.totalSprints,
        reasoning,
        matchFactors,
        methodologyDetails,
      };
    } catch (error: unknown) {
      logger.error('SDLC recommendation failed:', error);
      // Fallback to V-Model
      return {
        methodology: 'V-Model',
        estimatedSprints: 7, // Research: Industry average 6.8 sprints (rounded to 7)
        reasoning: 'Default to V-Model (fallback)',
        matchFactors: {},
        methodologyDetails: this.getMethodologyDetails('V-Model'),
      };
    }
  }

  /**
   * Score a methodology against project context
   * Enhanced with research-based priority rules and additional factors
   */
  private scoreMethodology(
    indicators: {
      industries?: string[];
      projectTypes?: string[];
      keywords?: string[];
      standards?: string[];
      priority?: string;
    },
    metadata: ReturnType<typeof this.extractProjectMetadata>,
    context: ProjectContext
  ): number {
    let score = 0;

    // ENHANCEMENT: Priority-based base score
    const priorityBoost =
      indicators.priority === 'high' ? 20 : indicators.priority === 'medium' ? 10 : 0;
    score += priorityBoost;

    // Industry match (0-25, reduced from 30 to make room for other factors)
    if (indicators.industries) {
      const industryMatch = this.calculateSetOverlap(metadata.industry, indicators.industries);
      score += industryMatch * 25;
    }

    // Project type match (0-25)
    if (indicators.projectTypes) {
      const typeMatch = this.calculateSetOverlap(metadata.projectType, indicators.projectTypes);
      score += typeMatch * 25;
    }

    // Keyword match (0-20, reduced from 25)
    if (indicators.keywords) {
      const text = `${context.name} ${context.description}`.toLowerCase();
      const keywordMatches = indicators.keywords.filter(keyword => text.includes(keyword)).length;
      score += (keywordMatches / indicators.keywords.length) * 20;
    }

    // Standards match (0-15)
    if (indicators.standards && context.standards) {
      const standardsMatch = this.calculateSetOverlap(context.standards, indicators.standards);
      score += standardsMatch * 15;
    }

    // ENHANCEMENT: Requirements stability factor
    const text = `${context.name} ${context.description}`.toLowerCase();
    const stabilityKeywords = ['fixed', 'stable', 'well-defined', 'clear', 'unchanging'];
    const flexibilityKeywords = [
      'evolving',
      'changing',
      'flexible',
      'iterative',
      'unclear',
      'uncertain',
    ];
    const hasStability = stabilityKeywords.some(k => text.includes(k));
    const hasFlexibility = flexibilityKeywords.some(k => text.includes(k));

    // Waterfall/V-Model benefit from stability
    if (
      (indicators.keywords?.some(k =>
        ['fixed-requirements', 'sequential', 'documentation-heavy'].includes(k)
      ) ||
        indicators.priority === 'low') &&
      hasStability
    ) {
      score += 10;
    }
    // Agile/Scrum benefit from flexibility
    if (
      (indicators.keywords?.some(k => ['iterative', 'flexible', 'rapid'].includes(k)) ||
        indicators.priority === 'high' ||
        indicators.priority === 'medium') &&
      hasFlexibility
    ) {
      score += 10;
    }

    // ENHANCEMENT: Project size factor
    const requirementsCount = context.requirements?.length || 0;
    const teamSize = context.teamSize || 1;

    // Large projects favor Agile/Iterative
    if (
      (requirementsCount > 20 || teamSize >= 5) &&
      indicators.keywords?.some(k => ['iterative', 'agile', 'scrum'].includes(k))
    ) {
      score += 8;
    }
    // Small projects favor Waterfall
    if (
      requirementsCount < 10 &&
      teamSize <= 2 &&
      indicators.keywords?.some(k => ['fixed-requirements', 'sequential'].includes(k))
    ) {
      score += 8;
    }

    // ENHANCEMENT: Complexity factor
    if (metadata.complexity === 'complex') {
      // Complex projects favor Agile/Spiral/Iterative
      if (
        indicators.keywords?.some(k =>
          ['iterative', 'agile', 'risk-analysis', 'complex'].includes(k)
        )
      ) {
        score += 7;
      }
    } else if (metadata.complexity === 'simple') {
      // Simple projects favor Waterfall/Prototyping
      if (indicators.keywords?.some(k => ['fixed-requirements', 'prototype', 'poc'].includes(k))) {
        score += 7;
      }
    }

    return score;
  }

  /**
   * Calculate set overlap (Jaccard similarity)
   */
  private calculateSetOverlap(set1: string[], set2: string[]): number {
    if (set1.length === 0 && set2.length === 0) return 1.0;
    if (set1.length === 0 || set2.length === 0) return 0.0;

    const intersection = set1.filter(x => set2.includes(x)).length;
    const union = new Set([...set1, ...set2]).size;

    return intersection / union;
  }

  /**
   * Calculate match percentage
   */
  private calculateMatch(set1: string[], set2: string[]): number {
    return this.calculateSetOverlap(set1, set2);
  }

  /**
   * Calculate standards match for methodology
   */
  private calculateStandardsMatch(standards: string[], methodology: Methodology): number {
    const methodologyStandards: Record<Methodology, string[]> = {
      'V-Model': ['iso26262', 'aspice', 'do178c', 'iec62304', 'en50128', 'iec61508'],
      Agile: ['owasp', 'wcag', 'iso25010'],
      Waterfall: ['ieee830', 'iso90003'],
      Spiral: ['iso25010', 'cmmi', 'ieee830'],
      DevOps: ['owasp', 'iso27001', 'pci-dss'],
      Iterative: ['owasp', 'iso25010'],
      Prototyping: ['owasp', 'wcag'],
      RAD: ['owasp', 'iso25010'],
      Scrum: ['owasp', 'iso25010', 'cmmi'],
      Lean: ['owasp', 'iso25010'],
      ASD: ['owasp', 'iso25010'],
    };

    const expectedStandards = methodologyStandards[methodology] || [];
    return this.calculateSetOverlap(standards, expectedStandards);
  }

  /**
   * Get project types for methodology
   */
  private getMethodologyProjectTypes(methodology: Methodology): string[] {
    const types: Record<Methodology, string[]> = {
      'V-Model': ['embedded', 'firmware', 'automotive-software', 'medical-device'],
      Agile: ['web-app', 'mobile-app', 'api', 'cloud'],
      Waterfall: ['desktop-app', 'legacy', 'hardware'],
      Spiral: ['embedded', 'complex-system', 'aerospace-software'],
      DevOps: ['cloud', 'microservices', 'api', 'web-app'],
      Iterative: ['web-app', 'mobile-app', 'api'],
      Prototyping: ['web-app', 'mobile-app'],
      RAD: ['web-app', 'mobile-app', 'api'],
      Scrum: ['web-app', 'mobile-app', 'api', 'cloud'],
      Lean: ['web-app', 'mobile-app', 'api'],
      ASD: ['web-app', 'mobile-app', 'api', 'cloud'],
    };
    return types[methodology] || [];
  }

  /**
   * Get industries for methodology
   */
  private getMethodologyIndustries(methodology: Methodology): string[] {
    const industries: Record<Methodology, string[]> = {
      'V-Model': ['automotive', 'aerospace', 'railway', 'nuclear', 'healthcare'],
      Agile: ['general', 'e-commerce', 'saas', 'startup'],
      Waterfall: ['government', 'defense', 'legacy'],
      Spiral: ['aerospace', 'defense', 'healthcare'],
      DevOps: ['general', 'saas', 'cloud', 'e-commerce'],
      Iterative: ['general', 'e-commerce'],
      Prototyping: ['general', 'startup'],
      RAD: ['general', 'e-commerce', 'startup'],
      Scrum: ['general', 'saas', 'e-commerce'],
      Lean: ['general', 'startup', 'saas'],
      ASD: ['general', 'startup', 'saas', 'e-commerce'],
    };
    return industries[methodology] || [];
  }

  /**
   * Get methodology details
   */
  private getMethodologyDetails(
    methodology: Methodology
  ): SDLCRecommendation['methodologyDetails'] {
    const details: Record<Methodology, SDLCRecommendation['methodologyDetails']> = {
      'V-Model': {
        description:
          'Sequential development model with verification and validation phases. Best for safety-critical and regulated systems.',
        phases: [
          'Initiation',
          'Requirements',
          'Architecture',
          'Test Planning',
          'Implementation',
          'Integration',
          'System/Acceptance',
          'Release Prep',
          'Post-Release',
        ],
        typicalSprintCount: 7, // Research: Small 4-6, Medium 6-10, Large 10-16 (average ~7)
        bestFor: [
          'Safety-critical systems',
          'Regulated industries',
          'Embedded software',
          'Medical devices',
        ],
      },
      Agile: {
        description:
          'Iterative and incremental development with short sprints. Best for flexible requirements and rapid delivery.',
        phases: ['Sprint Planning', 'Development', 'Testing', 'Review', 'Retrospective'],
        typicalSprintCount: 7, // Research: Industry average 6.8 sprints, standard projects 4-8 sprints
        bestFor: ['Web applications', 'Mobile apps', 'SaaS products', 'Startups'],
      },
      Waterfall: {
        description:
          'Sequential phases with distinct deliverables. Best for fixed requirements and well-defined projects.',
        phases: ['Requirements', 'Design', 'Implementation', 'Verification', 'Maintenance'],
        typicalSprintCount: 4, // Research: 3-5 milestones if adapted to sprints
        bestFor: ['Fixed requirements', 'Legacy systems', 'Government projects'],
      },
      Spiral: {
        description:
          'Risk-driven iterative model combining design and prototyping. Best for complex, high-risk projects with uncertain requirements.',
        phases: [
          'Planning',
          'Risk Analysis',
          'Engineering',
          'Evaluation',
          'Planning (Next Iteration)',
        ],
        typicalSprintCount: 5, // Research: 3-4 cycles (small), 4-6 (medium), 6-8 (large)
        bestFor: [
          'Complex systems',
          'High-risk projects',
          'Uncertain requirements',
          'Large-scale projects',
        ],
      },
      DevOps: {
        description:
          'Combines development and operations with continuous integration and deployment. Best for cloud-native and microservices architectures.',
        phases: ['Plan', 'Code', 'Build', 'Test', 'Release', 'Deploy', 'Operate', 'Monitor'],
        typicalSprintCount: 5, // Research: 4-8 sprints (infrastructure + development)
        bestFor: [
          'Cloud applications',
          'Microservices',
          'Continuous delivery',
          'Infrastructure automation',
        ],
      },
      Iterative: {
        description:
          'Repeated cycles of design, implementation, and testing. Best for large projects that need to evolve incrementally.',
        phases: ['Planning', 'Analysis & Design', 'Implementation', 'Testing', 'Evaluation'],
        typicalSprintCount: 6, // Research: 3-5 (small), 5-8 (medium), 8-12 (large)
        bestFor: ['Large projects', 'Evolving requirements', 'Incremental delivery'],
      },
      Prototyping: {
        description:
          'Early prototype development to gather user feedback and refine requirements. Best when user needs are unclear.',
        phases: [
          'Requirements Gathering',
          'Quick Design',
          'Prototype Building',
          'User Evaluation',
          'Refinement',
          'Implementation',
        ],
        typicalSprintCount: 3, // Research: 2-4 sprints (very fast delivery)
        bestFor: ['Unclear requirements', 'User validation', 'Proof of concept', 'Early feedback'],
      },
      RAD: {
        description:
          'Rapid Application Development with emphasis on quick delivery. Best for time-sensitive projects with well-understood requirements.',
        phases: [
          'Business Modeling',
          'Data Modeling',
          'Process Modeling',
          'Application Generation',
          'Testing & Turnover',
        ],
        typicalSprintCount: 3, // Research: 2-4 sprints (rapid delivery)
        bestFor: ['Time-sensitive projects', 'Well-understood requirements', 'Quick delivery'],
      },
      Scrum: {
        description:
          'Agile framework with fixed-length sprints, roles, and ceremonies. Best for teams needing structure within Agile approach.',
        phases: [
          'Sprint Planning',
          'Daily Scrum',
          'Sprint Development',
          'Sprint Review',
          'Sprint Retrospective',
        ],
        typicalSprintCount: 7, // Research: Industry average 6.8 sprints (Scrum is Agile framework)
        bestFor: ['Structured Agile teams', 'Product development', 'Cross-functional teams'],
      },
      Lean: {
        description:
          'Focuses on waste elimination and value delivery. Best for startups and projects requiring maximum efficiency.',
        phases: [
          'Define Value',
          'Map Value Stream',
          'Create Flow',
          'Establish Pull',
          'Pursue Perfection',
        ],
        typicalSprintCount: 6, // Research: MVP-focused 3-10 sprints (mid-range)
        bestFor: [
          'Startups',
          'MVP development',
          'Waste elimination',
          'Efficiency-focused projects',
        ],
      },
      ASD: {
        description:
          'Adaptive Software Development with speculate-collaborate-learn cycles. Best for high uncertainty and rapidly changing requirements.',
        phases: ['Speculate', 'Collaborate', 'Learn', 'Refine', 'Release'],
        typicalSprintCount: 7, // Research: High uncertainty 5-9 sprints (mid-range)
        bestFor: [
          'High uncertainty projects',
          'Rapidly changing requirements',
          'Learning-oriented development',
        ],
      },
    };
    return details[methodology];
  }

  /**
   * Estimate sprint count using AI-powered analysis
   * AI analyzes:
   * 1. Project description (features, technical requirements, scope)
   * 2. Project type (web-app, mobile-app, embedded, etc.)
   * 3. Methodology (V-Model, Agile, etc.)
   * 4. Complexity (simple, moderate, complex)
   * 5. Team size, requirements count, timeline constraints
   *
   * Research sources: SDLC_SPRINT_ANALYSIS.md, 2015 State of Scrum Report (6.8 sprints average)
   */
  async estimateSprints(
    methodology: Methodology,
    metadata: ReturnType<typeof this.extractProjectMetadata>,
    context: ProjectContext
  ): Promise<SprintEstimation> {
    try {
      // AI-POWERED: Use LLM to analyze project and estimate sprints
      return await this.aiEstimateSprints(methodology, metadata, context);
    } catch (error: unknown) {
      logger.error('AI sprint estimation failed, falling back to rule-based:', error);
      // Fallback to rule-based estimation if AI fails
      return await this.ruleBasedEstimateSprints(methodology, metadata, context);
    }
  }

  /**
   * AI-powered sprint estimation using LLM analysis
   */
  private async aiEstimateSprints(
    methodology: Methodology,
    metadata: ReturnType<typeof this.extractProjectMetadata>,
    context: ProjectContext
  ): Promise<SprintEstimation> {
    try {
      // Get methodology details for context
      const methodologyDetails = this.getMethodologyDetails(methodology);
      const sprintRanges = this.getMethodologySprintRanges(methodology);

      // Build comprehensive prompt for AI analysis
      const analysisPrompt = `
You are an expert software project estimator with deep knowledge of SDLC methodologies and sprint planning.

PROJECT INFORMATION:
- Name: ${context.name}
- Description: ${context.description}
- Category: ${context.category || 'Not specified'}
- Project Type: ${metadata.projectType.join(', ') || 'general'}
- Industry: ${metadata.industry.join(', ') || 'general'}
- Initial Complexity Assessment: ${metadata.complexity}
- Team Size: ${metadata.teamSize || context.teamSize || 'Not specified'}
- Timeline: ${metadata.timeline || context.timeline || 'Not specified'}
- Requirements Count: ${metadata.requirementsCount || context.requirements?.length || 0}
- Selected Standards: ${context.standards?.join(', ') || 'None'}

METHODOLOGY: ${methodology}
- Description: ${methodologyDetails.description}
- Phases: ${methodologyDetails.phases.join(', ')}
- Typical Sprint Count: ${methodologyDetails.typicalSprintCount}
- Best For: ${methodologyDetails.bestFor.join(', ')}

RESEARCH-BASED METHODOLOGY SPRINT RANGES:
- Simple: ${sprintRanges.simple} sprints
- Moderate: ${sprintRanges.moderate} sprints
- Complex: ${sprintRanges.complex} sprints

TASK:
Analyze this project comprehensively and estimate the optimal number of sprints. Consider:
1. Project description depth, feature count, and technical complexity
2. Project type (embedded/IoT need more time, APIs need less)
3. Team size impact (solo needs 50% more, optimal is 3-4 members)
4. Requirements count and scope
5. Methodology-specific sprint ranges (provided above)
6. Industry standards and compliance requirements
7. Timeline constraints (if provided)

OUTPUT FORMAT (JSON):
{
  "totalSprints": <number>,
  "reasoning": "<detailed explanation>",
  "complexityAssessment": "<simple|moderate|complex>",
  "keyFactors": ["<factor1>", "<factor2>", ...],
  "methodologyAlignment": "<assessment>",
  "riskFactors": ["<risk1>", "<risk2>", ...]
}

Be precise and justify your estimate with specific observations from the project description.`;

      // Enhance prompt using prompt engineering service
      const enhancedPrompt = enhancePrompt(analysisPrompt, {
        role: 'Expert Software Project Estimator',
        task: 'Analyze project and estimate sprints',
        outputFormat:
          'JSON with totalSprints, reasoning, complexityAssessment, keyFactors, methodologyAlignment, riskFactors',
        qualityCriteria: [
          'Estimate must align with methodology-specific ranges',
          'Consider all project characteristics',
          'Provide detailed reasoning',
          'Identify key factors influencing the estimate',
        ],
      });

      // Call LLM Router for intelligent analysis
      const llmResponse = await llmRouter.executeWithFallback({
        prompt: enhancedPrompt.prompt,
        context: {
          agentRole: 'Project Estimator',
          taskType: 'analysis',
          systemInstruction: enhancedPrompt.systemInstruction,
        },
        routingContext: {
          userPreferences: {
            costPreference: 'balanced',
            preferredModels: ['gemini-3-pro', 'gpt-4o', 'claude-3-5-sonnet'],
          },
        },
        requestType: 'sprint-estimation',
        contextType: 'workspace',
      });

      // Parse AI response
      const aiAnalysis = this.parseAIEstimationResponse(llmResponse.text);

      // Validate and refine the AI estimate
      const validatedEstimate = this.validateAndRefineAIEstimate(
        aiAnalysis,
        methodology,
        metadata,
        context
      );

      // Calculate sprints per phase
      const sprintsPerPhase = this.calculateSprintsPerPhase(
        methodology,
        validatedEstimate.totalSprints
      );

      return {
        totalSprints: validatedEstimate.totalSprints,
        sprintsPerPhase,
        reasoning: `🤖 AI-POWERED ESTIMATION:\n\n${validatedEstimate.reasoning}\n\n📊 Complexity Assessment: ${validatedEstimate.complexityAssessment}\n🎯 Methodology Alignment: ${validatedEstimate.methodologyAlignment}\n\n✅ Key Factors:\n${validatedEstimate.keyFactors.map(f => `  • ${f}`).join('\n')}\n\n⚠️ Risk Factors:\n${validatedEstimate.riskFactors.map(f => `  • ${f}`).join('\n')}`,
        factors: {
          complexity:
            validatedEstimate.complexityAssessment === 'complex'
              ? 1.0
              : validatedEstimate.complexityAssessment === 'moderate'
                ? 0.5
                : 0.2,
          methodology: 1.0,
          projectType: this.getProjectTypeMultiplier(metadata.projectType[0] || 'web-app'),
          featureCount: this.countFeatures(context.description || ''),
          teamSize:
            (metadata.teamSize || context.teamSize || 1) <= 2
              ? 1.3
              : (metadata.teamSize || context.teamSize || 1) >= 5
                ? 0.8
                : 1.0,
          requirements:
            (metadata.requirementsCount || context.requirements?.length || 0) > 20
              ? 1.2
              : (metadata.requirementsCount || context.requirements?.length || 0) < 5
                ? 0.8
                : 1.0,
        },
      };
    } catch (error: unknown) {
      logger.error('AI sprint estimation error:', error);
      throw error; // Re-throw to trigger fallback
    }
  }

  /**
   * Parse AI estimation response
   */
  private parseAIEstimationResponse(responseText: string): {
    totalSprints: number;
    reasoning: string;
    complexityAssessment: 'simple' | 'moderate' | 'complex';
    keyFactors: string[];
    methodologyAlignment: string;
    riskFactors: string[];
  } {
    try {
      // Try to extract JSON from response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          totalSprints: parsed.totalSprints || 7,
          reasoning: parsed.reasoning || 'AI analysis completed',
          complexityAssessment: parsed.complexityAssessment || 'moderate',
          keyFactors: parsed.keyFactors || [],
          methodologyAlignment: parsed.methodologyAlignment || 'Good fit',
          riskFactors: parsed.riskFactors || [],
        };
      }

      // Fallback: try to extract number from text
      const sprintMatch = responseText.match(/(\d+)\s*sprints?/i);
      const totalSprints = sprintMatch ? parseInt(sprintMatch[1]) : 7;

      return {
        totalSprints,
        reasoning: responseText.substring(0, 500),
        complexityAssessment: 'moderate',
        keyFactors: [],
        methodologyAlignment: 'Analysis completed',
        riskFactors: [],
      };
    } catch (error: unknown) {
      logger.error('Failed to parse AI response:', error);
      return {
        totalSprints: 7,
        reasoning: 'AI analysis completed (parsing error)',
        complexityAssessment: 'moderate',
        keyFactors: [],
        methodologyAlignment: 'Analysis completed',
        riskFactors: [],
      };
    }
  }

  /**
   * Validate and refine AI estimate against methodology ranges
   */
  private validateAndRefineAIEstimate(
    aiAnalysis: ReturnType<typeof this.parseAIEstimationResponse>,
    methodology: Methodology,
    metadata: ReturnType<typeof this.extractProjectMetadata>,
    _context: ProjectContext
  ): ReturnType<typeof this.parseAIEstimationResponse> {
    const sprintRanges = this.getMethodologySprintRanges(methodology);
    const complexity = aiAnalysis.complexityAssessment || metadata.complexity;

    const range = sprintRanges[complexity] || sprintRanges.moderate;
    const minSprints = range;
    const maxSprints = complexity === 'complex' ? 24 : complexity === 'moderate' ? 12 : 8;

    // Validate AI estimate is within reasonable bounds
    let validatedSprints = aiAnalysis.totalSprints;

    if (validatedSprints < minSprints) {
      logger.warn(
        `AI estimate ${validatedSprints} below minimum ${minSprints} for ${complexity} ${methodology}. Adjusting.`
      );
      validatedSprints = minSprints;
    } else if (validatedSprints > maxSprints) {
      logger.warn(
        `AI estimate ${validatedSprints} above maximum ${maxSprints} for ${complexity} ${methodology}. Capping.`
      );
      validatedSprints = maxSprints;
    }

    return {
      ...aiAnalysis,
      totalSprints: validatedSprints,
    };
  }

  /**
   * Get methodology sprint ranges
   */
  private getMethodologySprintRanges(methodology: Methodology): {
    simple: number;
    moderate: number;
    complex: number;
  } {
    const sprintRanges: Record<Methodology, { simple: number; moderate: number; complex: number }> =
      {
        'V-Model': { simple: 4, moderate: 7, complex: 13 },
        Agile: { simple: 4, moderate: 7, complex: 12 },
        Waterfall: { simple: 3, moderate: 4, complex: 5 },
        Spiral: { simple: 4, moderate: 6, complex: 9 },
        DevOps: { simple: 4, moderate: 5, complex: 7 },
        Iterative: { simple: 4, moderate: 6, complex: 10 },
        Prototyping: { simple: 2, moderate: 3, complex: 4 },
        RAD: { simple: 2, moderate: 3, complex: 5 },
        Scrum: { simple: 4, moderate: 7, complex: 12 },
        Lean: { simple: 3, moderate: 6, complex: 10 },
        ASD: { simple: 5, moderate: 7, complex: 9 },
      };
    return sprintRanges[methodology] || sprintRanges['Agile'];
  }

  /**
   * Get project type multiplier
   */
  private getProjectTypeMultiplier(projectType: string): number {
    const multipliers: Record<string, number> = {
      embedded: 1.3,
      firmware: 1.4,
      iot: 1.3,
      blockchain: 1.2,
      'ai/ml': 1.25,
      game: 0.9,
      'mobile-app': 1.1,
      'web-app': 1.0,
      api: 0.95,
      'desktop-app': 1.1,
      cloud: 1.15,
    };
    return multipliers[projectType] || 1.0;
  }

  /**
   * Count features in description
   */
  private countFeatures(description: string): number {
    const featureIndicators = [
      'authentication',
      'user management',
      'dashboard',
      'analytics',
      'reporting',
      'payment',
      'billing',
      'subscription',
      'shopping cart',
      'checkout',
      'messaging',
      'chat',
      'notification',
      'email',
      'sms',
      'search',
      'filter',
      'sort',
      'pagination',
      'upload',
      'download',
      'file management',
      'media library',
      'api',
      'integration',
      'webhook',
      'third-party',
      'admin panel',
      'admin dashboard',
      'admin portal',
      'mobile app',
      'ios',
      'android',
      'cross-platform',
      'real-time',
      'websocket',
      'socket.io',
      'live',
      'ai',
      'machine learning',
      'ml',
      'neural',
      'nlp',
      'chatbot',
      'blockchain',
      'smart contract',
      'crypto',
      'nft',
      'iot',
      'device',
      'sensor',
      'firmware',
      'video',
      'streaming',
      'encoding',
      'transcoding',
      'database',
      'data migration',
      'etl',
      'data pipeline',
      'security',
      'encryption',
      'ssl',
      'tls',
      'oauth',
      'multi-tenant',
      'multi-vendor',
      'marketplace',
      'workflow',
      'approval',
      'permissions',
      'roles',
      'testing',
      'qa',
      'automated testing',
      'ci/cd',
    ];
    const lowerDesc = description.toLowerCase();
    return featureIndicators.filter(indicator => lowerDesc.includes(indicator)).length;
  }

  /**
   * Rule-based sprint estimation (fallback)
   */
  /**
   * Rule-based sprint estimation (fallback)
   */
  private async ruleBasedEstimateSprints(
    methodology: Methodology,
    metadata: ReturnType<typeof this.extractProjectMetadata>,
    context: ProjectContext
  ): Promise<SprintEstimation> {
    try {
      // STEP 1: Analyze project description for feature count and scope
      const description = (context.description || '').toLowerCase();
      const projectName = (context.name || '').toLowerCase();
      const fullText = `${projectName} ${description}`;
      const descLength = description.length;
      const wordCount = description.split(/\s+/).length;

      // Count major features/components mentioned in description
      const featureIndicators = [
        'authentication',
        'user management',
        'dashboard',
        'analytics',
        'reporting',
        'payment',
        'billing',
        'subscription',
        'shopping cart',
        'checkout',
        'messaging',
        'chat',
        'notification',
        'email',
        'sms',
        'search',
        'filter',
        'sort',
        'pagination',
        'upload',
        'download',
        'file management',
        'media library',
        'api',
        'integration',
        'webhook',
        'third-party',
        'admin panel',
        'admin dashboard',
        'admin portal',
        'mobile app',
        'ios',
        'android',
        'cross-platform',
        'real-time',
        'websocket',
        'socket.io',
        'live',
        'ai',
        'machine learning',
        'ml',
        'neural',
        'nlp',
        'chatbot',
        'blockchain',
        'smart contract',
        'crypto',
        'nft',
        'iot',
        'device',
        'sensor',
        'firmware',
        'video',
        'streaming',
        'encoding',
        'transcoding',
        'database',
        'data migration',
        'etl',
        'data pipeline',
        'security',
        'encryption',
        'ssl',
        'tls',
        'oauth',
        'multi-tenant',
        'multi-vendor',
        'marketplace',
        'workflow',
        'approval',
        'permissions',
        'roles',
        'testing',
        'qa',
        'automated testing',
        'ci/cd',
      ];

      const featureCount = featureIndicators.filter(indicator =>
        fullText.includes(indicator)
      ).length;

      // Analyze description length and structure
      // const _sentenceCount = (description.match(/[.!?]+/g) || []).length;
      const hasMultipleFeatures =
        (fullText.match(/\b(and|also|additionally|plus|including|features|includes)\b/gi) || [])
          .length > 3;

      // STEP 2: Project type-specific base adjustments
      // Different project types have different inherent complexity
      const projectTypeMultipliers: Record<string, number> = {
        embedded: 1.3, // Embedded systems need more time for hardware integration
        firmware: 1.4, // Firmware requires extensive testing
        iot: 1.3, // IoT needs device integration and testing
        blockchain: 1.2, // Blockchain requires security audits
        'ai/ml': 1.25, // AI/ML needs model training and tuning
        game: 0.9, // Games can be more focused
        'mobile-app': 1.1, // Mobile apps need platform-specific work
        'web-app': 1.0, // Baseline
        api: 0.95, // APIs are more focused
        'desktop-app': 1.1, // Desktop apps need OS integration
        cloud: 1.15, // Cloud needs infrastructure setup
      };

      const primaryProjectType = metadata.projectType[0] || 'web-app';
      let projectTypeMultiplier = projectTypeMultipliers[primaryProjectType] || 1.0;

      // Special handling for AI/ML projects
      if (
        fullText.includes('ai') ||
        fullText.includes('machine learning') ||
        fullText.includes('ml') ||
        fullText.includes('neural') ||
        fullText.includes('chatbot') ||
        fullText.includes('nlp')
      ) {
        projectTypeMultiplier = Math.max(projectTypeMultiplier, projectTypeMultipliers['ai/ml']);
      }

      // STEP 3: RESEARCH-BASED: Methodology-specific sprint ranges by complexity
      // Based on SDLC_SPRINT_ANALYSIS.md research
      const sprintRanges: Record<
        Methodology,
        {
          simple: number; // Lower bound for simple projects
          moderate: number; // Mid-range for moderate projects
          complex: number; // Upper bound for complex projects
        }
      > = {
        'V-Model': {
          simple: 4, // Research: Small projects 4-6 sprints
          moderate: 7, // Research: Medium projects 6-10 sprints (mid-range)
          complex: 13, // Research: Large projects 10-16 sprints (mid-range)
        },
        Agile: {
          simple: 4, // Research: Standard projects 4-8 sprints (lower)
          moderate: 7, // Research: Industry average 6.8 sprints (rounded)
          complex: 12, // Research: Complex projects 8-16 sprints (mid-range)
        },
        Waterfall: {
          simple: 3, // Research: Small 3-4 milestones
          moderate: 4, // Research: Medium 4-5 milestones
          complex: 5, // Research: Large 5-6 milestones
        },
        Spiral: {
          simple: 4, // Research: Small 3-4 cycles (each cycle = 1-2 sprints, avg 1.3)
          moderate: 6, // Research: Medium 4-6 cycles (mid-range)
          complex: 9, // Research: Large 6-8 cycles (mid-range)
        },
        DevOps: {
          simple: 4, // Research: Infrastructure + development, lower range
          moderate: 5, // Research: Mid-range 4-6 sprints
          complex: 7, // Research: Upper range 6-8 sprints
        },
        Iterative: {
          simple: 4, // Research: Small 3-5 iterations (mid-range)
          moderate: 6, // Research: Medium 5-8 iterations (mid-range)
          complex: 10, // Research: Large 8-12 iterations (mid-range)
        },
        Prototyping: {
          simple: 2, // Research: Very fast delivery 2-4 sprints (lower)
          moderate: 3, // Research: Mid-range
          complex: 4, // Research: Upper range
        },
        RAD: {
          simple: 2, // Research: Rapid delivery 2-4 sprints (lower)
          moderate: 3, // Research: Mid-range 3-5 sprints
          complex: 5, // Research: Upper range 4-6 sprints
        },
        Scrum: {
          simple: 4, // Research: Standard Agile projects 4-8 sprints (lower)
          moderate: 7, // Research: Industry average 6.8 sprints (rounded)
          complex: 12, // Research: Complex projects 8-16 sprints (mid-range)
        },
        Lean: {
          simple: 3, // Research: MVP-focused 2-4 sprints (mid-range)
          moderate: 6, // Research: Standard 4-8 sprints (mid-range)
          complex: 10, // Research: Complex 8-12 sprints (mid-range)
        },
        ASD: {
          simple: 5, // Research: High uncertainty 4-6 sprints (mid-range)
          moderate: 7, // Research: Standard 6-8 sprints (mid-range)
          complex: 9, // Research: Complex 8-10 sprints (mid-range)
        },
      };

      // STEP 3: Refine complexity based on description analysis
      // Analyze description to refine complexity assessment BEFORE selecting base sprints
      let refinedComplexity = metadata.complexity;
      const hasTechnicalTerms =
        (
          fullText.match(
            /\b(database|api|authentication|encryption|deployment|infrastructure)\b/gi
          ) || []
        ).length > 2;

      // Feature count analysis - more features = higher complexity
      if (featureCount >= 15 || (featureCount >= 10 && hasTechnicalTerms)) {
        refinedComplexity = 'complex';
      } else if (featureCount >= 8) {
        refinedComplexity = refinedComplexity === 'simple' ? 'moderate' : refinedComplexity;
      } else if (featureCount <= 3 && metadata.complexity === 'complex' && descLength < 1000) {
        // Few features but marked complex - might be overestimated
        refinedComplexity = 'moderate';
      }

      // Description length and structure analysis
      if (descLength > 2000 || wordCount > 300 || hasMultipleFeatures) {
        refinedComplexity = refinedComplexity === 'simple' ? 'moderate' : 'complex';
      } else if (descLength < 200 || wordCount < 50) {
        refinedComplexity = refinedComplexity === 'complex' ? 'moderate' : 'simple';
      }

      // STEP 4: Select base sprint count from methodology and REFINED complexity
      const range = sprintRanges[methodology] || sprintRanges['Agile'];
      let totalSprints: number;

      switch (refinedComplexity) {
        case 'simple':
          totalSprints = range.simple;
          break;
        case 'complex':
          totalSprints = range.complex;
          break;
        case 'moderate':
        default:
          totalSprints = range.moderate;
          break;
      }

      // STEP 5: Apply project type multiplier BEFORE other adjustments
      totalSprints = Math.ceil(totalSprints * projectTypeMultiplier);

      // STEP 6: Feature count adjustment (beyond base complexity)
      // More features = more sprints, but with diminishing returns
      if (featureCount > 0) {
        // Feature adjustment: +0.1 sprints per feature, capped at +4 sprints
        const featureAdjustment = Math.min(featureCount * 0.1, 4);
        totalSprints = Math.ceil(totalSprints + featureAdjustment);
      }

      // STEP 7: Description depth adjustment
      // Longer, more detailed descriptions indicate more work
      if (descLength > 1500 && wordCount > 200) {
        totalSprints = Math.ceil(totalSprints * 1.1); // +10% for detailed descriptions
      } else if (descLength < 300 && wordCount < 50) {
        totalSprints = Math.ceil(totalSprints * 0.9); // -10% for brief descriptions
      }

      // RESEARCH-BASED: Team size adjustment (based on team velocity research)
      // Research: Optimal team size is 3-7 members, smaller teams have lower velocity
      const teamSize = context.teamSize || metadata.teamSize || 1;
      if (teamSize === 1) {
        totalSprints = Math.ceil(totalSprints * 1.5); // Research: Solo developers need 50% more time
      } else if (teamSize === 2) {
        totalSprints = Math.ceil(totalSprints * 1.25); // Research: Small teams need 25% more time
      } else if (teamSize >= 3 && teamSize <= 4) {
        // Research: Optimal team size (3-4 members) = baseline
        totalSprints = totalSprints;
      } else if (teamSize >= 5 && teamSize <= 7) {
        // Research: Larger teams can parallelize effectively
        totalSprints = Math.ceil(totalSprints * 0.9); // 10% reduction due to parallelization
      } else if (teamSize >= 8 && teamSize <= 10) {
        // Research: Very large teams have coordination overhead
        totalSprints = Math.ceil(totalSprints * 0.85); // 15% reduction (diminishing returns)
      } else if (teamSize > 10) {
        // Research: Extremely large teams have significant coordination overhead
        totalSprints = Math.ceil(totalSprints * 0.9); // Less benefit due to overhead
      }

      // STEP 8: Requirements count adjustment
      // Research: Story points estimation: Simple 40, Medium 120, Complex 240, Enterprise 480
      const requirementsCount = context.requirements?.length || metadata.requirementsCount || 0;
      if (requirementsCount === 0) {
        // Already analyzed description length above, skip duplicate analysis
        // Description length adjustments were already applied in STEP 7
      } else {
        // RESEARCH-BASED: Explicit requirements count adjustment
        // Research: More requirements = more sprints, with realistic scaling
        if (requirementsCount >= 30) {
          totalSprints = Math.ceil(totalSprints * 1.4); // Research: Enterprise-level (40% increase)
        } else if (requirementsCount >= 20) {
          totalSprints = Math.ceil(totalSprints * 1.25); // Research: Large project (25% increase)
        } else if (requirementsCount >= 10) {
          totalSprints = Math.ceil(totalSprints * 1.1); // Research: Medium project (10% increase)
        } else if (requirementsCount >= 5) {
          // Research: Small-medium project (baseline)
          totalSprints = totalSprints;
        } else if (requirementsCount < 5 && requirementsCount > 0) {
          totalSprints = Math.ceil(totalSprints * 0.8); // Research: Very small project (20% reduction)
        }
      }

      // RESEARCH-BASED: Timeline adjustment (based on industry sprint duration standards)
      // Research: 2-week sprints are most common (60-70% of teams), Agile uses 1-4 weeks
      if (context.timeline || metadata.timeline) {
        const timeline = context.timeline || metadata.timeline || '';
        const timelineMatch = timeline.match(/(\d+)\s*(week|month|sprint)/i);
        if (timelineMatch) {
          const value = parseInt(timelineMatch[1]);
          const unit = timelineMatch[2].toLowerCase();

          // RESEARCH-BASED: Sprint lengths by methodology
          // Research: Agile methodologies use 1-2 week sprints (typically 2 weeks)
          // Research: Traditional methodologies use 3-4 week phases (typically 4 weeks)
          const agileMethodologies = [
            'Agile',
            'Scrum',
            'DevOps',
            'RAD',
            'Prototyping',
            'Lean',
            'Iterative',
          ];
          const isAgile = agileMethodologies.includes(methodology);

          if (unit.includes('week')) {
            // Research: Agile = 2 weeks/sprint, Traditional = 4 weeks/phase
            const weeksPerSprint = isAgile ? 2 : 4;
            const estimatedSprints = Math.ceil(value / weeksPerSprint);

            // RESEARCH-BASED: Minimum sprints by complexity
            // Research: Simple: 2-4 sprints, Medium: 4-8 sprints, Complex: 8-16 sprints
            const minSprintsForComplexity =
              metadata.complexity === 'complex' ? 8 : metadata.complexity === 'moderate' ? 4 : 2;
            if (estimatedSprints < minSprintsForComplexity) {
              logger.warn(
                `Timeline may be too aggressive: ${estimatedSprints} sprints for ${metadata.complexity} complexity. Using minimum ${minSprintsForComplexity} sprints.`
              );
              totalSprints = Math.max(totalSprints, minSprintsForComplexity);
            } else {
              // Use timeline-based estimate, but ensure it's reasonable
              totalSprints = Math.max(totalSprints, estimatedSprints);
            }
          } else if (unit.includes('month')) {
            // RESEARCH-BASED: Sprints per month
            // Research: Agile teams do 2 sprints/month (2-week sprints), Traditional do 1 phase/month
            const sprintsPerMonth = isAgile ? 2 : 1;
            const estimatedSprints = value * sprintsPerMonth;

            // RESEARCH-BASED: Validate against complexity minimums
            const minSprintsForComplexity =
              metadata.complexity === 'complex' ? 8 : metadata.complexity === 'moderate' ? 4 : 2;
            if (estimatedSprints < minSprintsForComplexity) {
              logger.warn(
                `Timeline constraint too aggressive for complexity. Using minimum ${minSprintsForComplexity} sprints.`
              );
              totalSprints = Math.max(totalSprints, minSprintsForComplexity);
            } else {
              totalSprints = Math.max(totalSprints, estimatedSprints);
            }
          } else if (unit.includes('sprint')) {
            // RESEARCH-BASED: Direct sprint count - validate against complexity
            const minSprintsForComplexity =
              metadata.complexity === 'complex' ? 8 : metadata.complexity === 'moderate' ? 4 : 2;
            totalSprints = Math.max(totalSprints, Math.max(value, minSprintsForComplexity));
          }
        }
      }

      // RESEARCH-BASED: Ensure minimum sprints based on complexity
      // Research: Simple projects: 2-4 sprints, Medium: 4-8 sprints, Complex: 8-16 sprints
      const minSprints =
        metadata.complexity === 'complex' ? 8 : metadata.complexity === 'moderate' ? 4 : 2;
      totalSprints = Math.max(totalSprints, minSprints);

      // RESEARCH-BASED: Cap maximum sprints to prevent unrealistic estimates
      // Research: Industry distribution shows 35% use 7-10 sprints, 20% use 11+ sprints
      // Research: Enterprise projects can go up to 24+ sprints
      const maxSprints =
        metadata.complexity === 'complex' ? 24 : metadata.complexity === 'moderate' ? 12 : 8;
      totalSprints = Math.min(totalSprints, maxSprints);

      // RESEARCH-BASED: Add 10% buffer for unexpected issues (industry best practice)
      totalSprints = Math.ceil(totalSprints * 1.1);

      // Calculate sprints per phase
      const sprintsPerPhase = this.calculateSprintsPerPhase(methodology, totalSprints);

      // Generate reasoning
      const reasoning = this.generateSprintReasoning(totalSprints, metadata, context, methodology);

      return {
        totalSprints,
        sprintsPerPhase,
        reasoning,
        factors: {
          complexity:
            metadata.complexity === 'complex'
              ? 1.0
              : metadata.complexity === 'moderate'
                ? 0.5
                : 0.2,
          methodology: 1.0,
          teamSize: teamSize <= 2 ? 1.3 : teamSize >= 5 ? 0.8 : 1.0,
          requirements: requirementsCount > 20 ? 1.2 : requirementsCount < 5 ? 0.8 : 1.0,
        },
      };
    } catch (error: unknown) {
      logger.error('Sprint estimation failed:', error);
      return {
        totalSprints: 7, // Research: Industry average 6.8 sprints (rounded to 7)
        sprintsPerPhase: {},
        reasoning: 'Default estimation (fallback) - Industry average: 6.8 sprints',
        factors: {
          complexity: 0.5,
          methodology: 1.0,
          teamSize: 1.0,
          requirements: 1.0,
        },
      };
    }
  }

  /**
   * Calculate sprints per phase
   */
  private calculateSprintsPerPhase(
    methodology: Methodology,
    totalSprints: number
  ): Record<string, number> {
    const phaseDistribution: any = {
      'V-Model': {
        Initiation: 1,
        Requirements: 1,
        Architecture: 1,
        'Test Planning': 1,
        Implementation: 2,
        Integration: 1,
        'System/Acceptance': 1,
        'Release Prep': 0.5,
        'Post-Release': 0.5,
      },
      Agile: {
        'Sprint Planning': 0.2,
        Development: 0.4,
        Testing: 0.2,
        Review: 0.1,
        Retrospective: 0.1,
      },
      Waterfall: {
        Requirements: 1,
        Design: 1,
        Implementation: 2,
        Verification: 1,
        Maintenance: 0,
      },
      Spiral: {
        Planning: 1,
        'Risk Analysis': 1,
        Engineering: 2,
        Evaluation: 1,
        'Planning (Next Iteration)': 1,
      },
      DevOps: {
        Plan: 0.5,
        Code: 1,
        Build: 0.5,
        Test: 0.5,
        Release: 0.5,
        Deploy: 0.5,
        Operate: 0.3,
        Monitor: 0.2,
      },
      Iterative: {
        Planning: 1,
        'Analysis & Design': 1,
        Implementation: 2,
        Testing: 0.8,
        Evaluation: 0.2,
      },
      Prototyping: {
        'Requirements Gathering': 0.3,
        'Quick Design': 0.3,
        'Prototype Building': 1,
        'User Evaluation': 0.5,
        Refinement: 0.5,
        Implementation: 0.4,
      },
      RAD: {
        'Business Modeling': 0.5,
        'Data Modeling': 0.5,
        'Process Modeling': 0.5,
        'Application Generation': 1,
        'Testing & Turnover': 0.5,
      },
      Scrum: {
        'Sprint Planning': 0.2,
        'Daily Scrum': 0.1,
        'Sprint Development': 0.5,
        'Sprint Review': 0.1,
        'Sprint Retrospective': 0.1,
      },
      Lean: {
        'Define Value': 0.3,
        'Map Value Stream': 0.3,
        'Create Flow': 0.8,
        'Establish Pull': 0.8,
        'Pursue Perfection': 0.8,
      },
    };

    const distribution = phaseDistribution[methodology];
    const totalWeight = (Object.values(distribution) as number[]).reduce(
      (sum, weight) => sum + weight,
      0
    );

    const sprintsPerPhase: Record<string, number> = {};
    for (const [phase, weight] of Object.entries(distribution)) {
      sprintsPerPhase[phase] = Math.max(
        1,
        Math.round(((weight as number) / (totalWeight as number)) * totalSprints)
      );
    }

    return sprintsPerPhase;
  }

  /**
   * Generate reasoning for methodology selection
   */
  private generateReasoning(
    _methodology: Methodology,
    metadata: ReturnType<typeof this.extractProjectMetadata>,
    context: ProjectContext,
    scores: Array<{ methodology: Methodology; score: number }>
  ): string {
    const reasons: string[] = [];

    const topScore = scores[0].score;
    const secondScore = scores[1]?.score || 0;
    const scoreDifference = topScore - secondScore;

    if (scoreDifference > 20) {
      reasons.push(`Strong match (${Math.round(topScore)}% confidence)`);
    } else if (scoreDifference > 10) {
      reasons.push(`Good match (${Math.round(topScore)}% confidence)`);
    } else {
      reasons.push(
        `Moderate match (${Math.round(topScore)}% confidence, close to ${scores[1]?.methodology})`
      );
    }

    // Add specific reasons
    if (metadata.industry.includes('automotive') || metadata.industry.includes('aerospace')) {
      reasons.push('Industry requires safety-critical development');
    }

    if (metadata.projectType.includes('embedded')) {
      reasons.push('Embedded systems benefit from V-Model verification');
    }

    if (metadata.projectType.includes('web-app') || metadata.projectType.includes('mobile-app')) {
      reasons.push('Web/mobile projects benefit from Agile flexibility');
    }

    if (context.standards?.some(s => ['iso26262', 'aspice', 'do178c'].includes(s))) {
      reasons.push('Standards require structured V-Model approach');
    }

    if (metadata.complexity === 'complex') {
      reasons.push('Complex project requires structured methodology');
    }

    return reasons.join(', ');
  }

  /**
   * Generate sprint reasoning
   * Enhanced with research-based explanations
   */
  private generateSprintReasoning(
    totalSprints: number,
    metadata: ReturnType<typeof this.extractProjectMetadata>,
    context: ProjectContext,
    methodology: Methodology,
    refinedComplexity?: 'simple' | 'moderate' | 'complex',
    featureCount?: number,
    projectType?: string
  ): string {
    const reasons: string[] = [];

    // RESEARCH-BASED: Methodology explanation
    const agileMethodologies = [
      'Agile',
      'Scrum',
      'DevOps',
      'RAD',
      'Prototyping',
      'Lean',
      'Iterative',
    ];
    const isAgile = agileMethodologies.includes(methodology);
    // Research: Agile uses 1-2 week sprints (typically 2 weeks), Traditional uses 3-4 week phases
    const sprintLength = isAgile ? '2-week' : '4-week';
    const estimatedDuration = isAgile ? Math.ceil(totalSprints / 2) : totalSprints;
    const durationUnit = 'months';

    const finalComplexity = refinedComplexity || metadata.complexity;
    reasons.push(
      `Estimated ${totalSprints} sprints (${sprintLength} each, ~${estimatedDuration} ${durationUnit} total) based on:`
    );
    reasons.push(`- Methodology: ${methodology}`);
    reasons.push(
      `- Complexity: ${finalComplexity} (refined from ${metadata.complexity} based on description analysis)`
    );
    if (projectType) {
      reasons.push(`- Project Type: ${projectType}`);
    }
    if (featureCount !== undefined && featureCount > 0) {
      reasons.push(`- Features Detected: ${featureCount} major components/features`);
    }
    reasons.push(`Industry average: 6.8 sprints per project (2015 State of Scrum Report)`);

    // RESEARCH-BASED: Complexity explanation
    if (finalComplexity === 'complex') {
      reasons.push(
        `Complex projects require 75% more sprints (research: 8-16 sprints vs 4-8 for medium)`
      );
    } else if (metadata.complexity === 'simple') {
      reasons.push(
        `Simple projects require 35% fewer sprints (research: 2-4 sprints vs 4-8 for medium)`
      );
    }

    // Team size explanation
    const teamSize = context.teamSize || 1;
    if (teamSize === 1) {
      reasons.push(`Solo developer requires 50% more time due to limited parallelization`);
    } else if (teamSize === 2) {
      reasons.push(`Small team (2 members) requires 30% more time`);
    } else if (teamSize >= 3 && teamSize <= 4) {
      reasons.push(`Optimal team size (3-4 members) for efficient development`);
    } else if (teamSize >= 5 && teamSize <= 7) {
      reasons.push(`Larger team (5-7 members) can parallelize work, reducing sprint count by 15%`);
    } else if (teamSize >= 8) {
      reasons.push(
        `Very large team (8+ members) benefits from parallelization but with diminishing returns`
      );
    }

    // Requirements count explanation
    const requirementsCount = context.requirements?.length || 0;
    if (requirementsCount >= 30) {
      reasons.push(
        `High number of requirements (${requirementsCount}+) increases sprint count by 40%`
      );
    } else if (requirementsCount >= 20) {
      reasons.push(`Many requirements (${requirementsCount}) increase sprint count by 25%`);
    } else if (requirementsCount >= 10) {
      reasons.push(`Moderate requirements (${requirementsCount}) slightly increase sprint count`);
    } else if (requirementsCount < 5 && requirementsCount > 0) {
      reasons.push(`Few requirements (${requirementsCount}) allow for faster delivery`);
    }

    // Timeline constraint explanation
    if (context.timeline) {
      reasons.push(`Timeline constraint considered in estimation`);
    }

    // Methodology-specific notes
    if (isAgile) {
      reasons.push(`Agile methodologies use shorter sprints (1-2 weeks) for rapid iteration`);
    } else {
      reasons.push(
        `Traditional methodologies use longer phases (3-4 weeks) for comprehensive planning`
      );
    }

    return reasons.join('. ');
  }

  /**
   * Auto-configure SDLC for project
   */
  async autoConfigureSDLC(context: ProjectContext): Promise<{
    methodology: Methodology;
    estimatedSprints: number;
    recommendation: SDLCRecommendation;
  }> {
    const recommendation = await this.recommendMethodology(context);

    return {
      methodology: recommendation.methodology,
      estimatedSprints: recommendation.estimatedSprints,
      recommendation,
    };
  }
}

export const sdlcMatchingService = new SDLCMatchingService();
