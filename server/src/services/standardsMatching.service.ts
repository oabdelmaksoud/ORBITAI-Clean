/**
 * Standards Matching Service
 * Automatically matches quality standards to projects based on type, category, and description
 */

import { QualityStandard, IQualityStandard } from '../models/QualityStandard.model.js';
import { llamaindexService } from './llamaindex.service.js';
import { vectorSearchService } from './vectorSearch.service.js';
import { logger } from '../utils/logger.js';
import crypto from 'crypto';

export interface ProjectContext {
  name: string;
  description: string;
  methodology?: string;
  category?: string;
  projectType?: string;
  industry?: string;
  region?: string;
  tags?: string[];
  complexity?: 'simple' | 'moderate' | 'complex';
}

export interface StandardMatch {
  standard: IQualityStandard;
  score: number;
  reasoning: string;
  matchFactors: {
    category?: number;
    projectType?: number;
    industry?: number;
    semantic?: number;
    keyword?: number;
  };
  securitySafetyAssessment?: {
    needsCybersecurity: boolean;
    needsSafety: boolean;
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    indicators: string[];
  };
}

export interface StandardsRecommendation {
  required: StandardMatch[];
  recommended: StandardMatch[];
  optional: StandardMatch[];
  allMatches: StandardMatch[];
}

class StandardsMatchingService {
  private initialized: boolean = false;
  // OPTIMIZATION: Cache for standards matching results
  private cache: Map<string, { standards: string[]; timestamp: number }> = new Map();
  private readonly cacheTTL = 60 * 60 * 1000; // 1 hour TTL

  /**
   * Initialize the service
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Ensure standards are indexed in vector search
      await this.indexStandards();
      this.initialized = true;
      logger.info('✅ Standards Matching service initialized');
    } catch (error: unknown) {
      logger.error('Failed to initialize Standards Matching service:', error);
      throw error;
    }
  }

  /**
   * Index all standards in vector search
   */
  private async indexStandards(): Promise<void> {
    try {
      // OPTIMIZATION: Use .lean() for faster queries
      const standards = await QualityStandard.find({ isActive: true }).lean().exec() as any;

      for (const standard of standards) {
        const textToIndex = `${standard.name} ${standard.description} ${standard.fullDescription || ''} ${standard.keywords.join(' ')}`;

        await vectorSearchService.addDocument({
          id: `standard_${standard.id}`,
          content: textToIndex,
          metadata: {
            type: 'quality_standard',
            standardId: standard.id,
            name: standard.name,
            category: standard.category,
            projectTypes: standard.projectTypes,
            industries: standard.industries,
          },
        });
      }

      logger.debug(`Indexed ${standards.length} quality standards`);
    } catch (error: unknown) {
      logger.warn('Failed to index standards, continuing without vector search:', (error instanceof Error ? error.message : String(error)));
    }
  }

  /**
   * Detect if cybersecurity/safety is needed based on project characteristics
   */
  private detectSecuritySafetyNeeds(context: ProjectContext, text: string): {
    needsCybersecurity: boolean;
    needsSafety: boolean;
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    indicators: string[];
  } {
    const indicators: string[] = [];
    let needsCybersecurity = false;
    let needsSafety = false;
    let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';

    // Complexity-based detection
    const complexity = context.complexity || this.estimateComplexity(text);
    const isComplex = complexity === 'complex';

    // Cybersecurity indicators
    const cybersecurityIndicators = [
      /\b(payment|credit.*card|pci|transaction|financial.*data)\b/,
      /\b(user.*data|personal.*information|pii|gdpr|privacy)\b/,
      /\b(authentication|authorization|login|password|encryption)\b/,
      /\b(api|web.*service|public.*endpoint|network)\b/,
      /\b(cloud|saas|multi.*tenant|shared.*infrastructure)\b/,
      /\b(e-commerce|online.*store|shopping.*cart)\b/,
      /\b(healthcare|medical.*record|hipaa|phi)\b/,
      /\b(government|public.*sector|citizen.*data)\b/,
      /\b(enterprise|large.*scale|mission.*critical)\b/,
    ];

    // Safety indicators
    const safetyIndicators = [
      /\b(safety.*critical|mission.*critical|life.*critical)\b/,
      /\b(automotive|vehicle|car|truck|asil|iso26262)\b/,
      /\b(medical.*device|healthcare|patient.*safety|iec62304)\b/,
      /\b(aerospace|aviation|aircraft|do178c)\b/,
      /\b(railway|train|rail|en50128)\b/,
      /\b(nuclear|power.*plant|safety.*system)\b/,
      /\b(embedded|firmware|real.*time|control.*system)\b/,
      /\b(regulated|certification|compliance|audit)\b/,
    ];

    // Check for cybersecurity needs
    const cybersecurityMatches = cybersecurityIndicators.filter(pattern => pattern.test(text)).length;
    if (cybersecurityMatches > 0 || isComplex) {
      needsCybersecurity = true;
      if (cybersecurityMatches > 0) {
        indicators.push(`Found ${cybersecurityMatches} cybersecurity indicator(s)`);
      }
      if (isComplex) {
        indicators.push('High project complexity requires security measures');
      }
    }

    // Check for safety needs
    const safetyMatches = safetyIndicators.filter(pattern => pattern.test(text)).length;
    if (safetyMatches > 0 || (isComplex && text.match(/\b(embedded|firmware|control|device)\b/))) {
      needsSafety = true;
      if (safetyMatches > 0) {
        indicators.push(`Found ${safetyMatches} safety-critical indicator(s)`);
      }
      if (isComplex) {
        indicators.push('Complex embedded/control systems require safety standards');
      }
    }

    // Determine risk level
    if (safetyMatches >= 2 || (needsSafety && isComplex)) {
      riskLevel = 'critical';
    } else if (safetyMatches >= 1 || cybersecurityMatches >= 3 || (needsCybersecurity && isComplex)) {
      riskLevel = 'high';
    } else if (cybersecurityMatches >= 2 || isComplex) {
      riskLevel = 'medium';
    } else if (cybersecurityMatches >= 1) {
      riskLevel = 'low';
    }

    return { needsCybersecurity, needsSafety, riskLevel, indicators };
  }

  /**
   * Estimate project complexity from text
   */
  private estimateComplexity(text: string): 'simple' | 'moderate' | 'complex' {
    const complexityIndicators = {
      simple: [
        /\b(simple|basic|small|minimal|single|one|static|landing|page)\b/,
      ],
      complex: [
        /\b(complex|enterprise|large|scale|distributed|microservices|multi)\b/,
        /\b(safety-critical|mission-critical|critical|regulated)\b/,
        /\b(ai|machine-learning|ml|neural|deep-learning)\b/,
        /\b(real-time|embedded|firmware|control.*system)\b/,
      ],
    };

    const simpleCount = complexityIndicators.simple.filter(pattern => pattern.test(text)).length;
    const complexCount = complexityIndicators.complex.filter(pattern => pattern.test(text)).length;

    if (complexCount > simpleCount && complexCount >= 2) {
      return 'complex';
    } else if (simpleCount > complexCount && simpleCount >= 2) {
      return 'simple';
    }
    return 'moderate';
  }

  /**
   * Extract project metadata from context
   * Enhanced to automatically infer all characteristics from project description
   */
  private extractProjectMetadata(context: ProjectContext): {
    category: string[];
    projectType: string[];
    industry: string[];
    keywords: string[];
    needsCybersecurity: boolean;
    needsSafety: boolean;
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    complexity: 'simple' | 'moderate' | 'complex';
  } {
    const fullText = `${context.name} ${context.description} ${context.tags?.join(' ') || ''}`;
    const text = fullText.toLowerCase();

    // Detect security/safety needs
    const securitySafety = this.detectSecuritySafetyNeeds(context, text);

    // ENHANCEMENT: Enhanced category detection with more patterns
    const categories: string[] = [];
    if (text.match(/\b(automotive|vehicle|car|truck|automobile|driving|autonomous|self-driving|adas)\b/)) {
      categories.push('automotive');
    }
    if (text.match(/\b(medical|healthcare|health|hospital|patient|doctor|clinic|pharmacy|telemedicine|ehr)\b/)) {
      categories.push('medical');
    }
    if (text.match(/\b(web|website|webapp|web-app|web\s+application|web\s+platform|online|portal|saas)\b/)) {
      categories.push('web');
    }
    if (text.match(/\b(security|secure|cyber|hack|encryption|authentication|authorization|data\s+protection)\b/) ||
      securitySafety.needsCybersecurity) {
      categories.push('security');
    }
    if (text.match(/\b(mobile|ios|android|iphone|ipad|smartphone|tablet|app\s+store)\b/)) {
      categories.push('mobile');
    }
    if (text.match(/\b(embedded|iot|device|hardware|firmware|microcontroller|sensor|internet\s+of\s+things)\b/)) {
      categories.push('embedded');
    }
    if (text.match(/\b(finance|banking|payment|financial|transaction|credit\s+card|bank|fintech|trading)\b/)) {
      categories.push('finance');
    }
    if (text.match(/\b(e-commerce|ecommerce|retail|shopping|store|marketplace|online\s+store)\b/)) {
      categories.push('e-commerce');
    }
    if (securitySafety.needsSafety) {
      categories.push('safety');
    }

    // ENHANCEMENT: Enhanced project type detection
    const projectTypes: string[] = [];
    if (text.match(/\b(web|website|webapp|web-app|web\s+application|web\s+platform|online|portal|saas)\b/)) {
      projectTypes.push('web-app');
    }
    if (text.match(/\b(mobile|ios|android|iphone|ipad|smartphone|tablet|app\s+store|play\s+store)\b/)) {
      projectTypes.push('mobile-app');
    }
    if (text.match(/\b(api|rest\s+api|graphql|microservice|backend\s+service|service\s+layer)\b/)) {
      projectTypes.push('api');
    }
    if (text.match(/\b(embedded|firmware|device|hardware|iot|microcontroller|sensor)\b/)) {
      projectTypes.push('embedded');
    }
    if (text.match(/\b(desktop|windows\s+app|mac\s+app|linux\s+app|standalone\s+application)\b/)) {
      projectTypes.push('desktop-app');
    }
    if (text.match(/\b(cloud|serverless|aws|azure|gcp|google\s+cloud|amazon|microsoft\s+azure)\b/)) {
      projectTypes.push('cloud');
    }

    // ENHANCEMENT: Enhanced industry detection
    const industries: string[] = [];
    if (text.match(/\b(automotive|car|vehicle|truck|automobile|driving|autonomous|self-driving|adas)\b/)) {
      industries.push('automotive');
    }
    if (text.match(/\b(healthcare|medical|health|hospital|patient|doctor|clinic|pharmacy|telemedicine|ehr)\b/)) {
      industries.push('healthcare');
    }
    if (text.match(/\b(finance|banking|financial|payment|transaction|credit\s+card|bank|fintech|trading|investment)\b/)) {
      industries.push('finance');
    }
    if (text.match(/\b(retail|e-commerce|ecommerce|shopping|store|marketplace|online\s+store)\b/)) {
      industries.push('retail');
    }
    if (text.match(/\b(education|school|university|college|learning|student|course|training)\b/)) {
      industries.push('education');
    }
    if (text.match(/\b(government|public\s+sector|gov|municipal|federal)\b/)) {
      industries.push('government');
    }
    if (text.match(/\b(aerospace|aviation|aircraft|airplane|flight|avionics|space|satellite)\b/)) {
      industries.push('aerospace');
    }
    if (text.match(/\b(railway|rail|train|railroad|metro|subway|transit)\b/)) {
      industries.push('railway');
    }

    // Extract keywords
    const keywords = [
      ...categories,
      ...projectTypes,
      ...industries,
      ...(context.tags || []),
      // Add security/safety keywords if needed
      ...(securitySafety.needsCybersecurity ? ['security', 'cybersecurity', 'owasp'] : []),
      ...(securitySafety.needsSafety ? ['safety', 'safety-critical', 'functional-safety'] : []),
    ].filter((v, i, a) => a.indexOf(v) === i);

    // Estimate complexity if not provided
    const complexity = context.complexity || this.estimateComplexity(text);

    return {
      category: categories.length > 0 ? categories : ['general'],
      projectType: projectTypes.length > 0 ? projectTypes : ['general'],
      industry: industries.length > 0 ? industries : ['general'],
      keywords,
      needsCybersecurity: securitySafety.needsCybersecurity,
      needsSafety: securitySafety.needsSafety,
      riskLevel: securitySafety.riskLevel,
      complexity,
    };
  }

  /**
   * Find matching standards for a project
   */
  async findMatchingStandards(
    context: ProjectContext,
    options: {
      maxResults?: number;
      minScore?: number;
      includeOptional?: boolean;
    } = {}
  ): Promise<StandardsRecommendation> {
    if (!this.initialized) {
      await this.initialize();
    }

    const maxResults = options.maxResults || 10;
    const minScore = options.minScore || 0.3;
    const includeOptional = options.includeOptional ?? true;

    try {
      // Extract project metadata
      const metadata = this.extractProjectMetadata(context);

      // Build search query
      const searchText = `${context.name} ${context.description} ${metadata.keywords.join(' ')}`;

      // 1. Semantic search using vector search
      const semanticResults = await vectorSearchService.vectorSearch(
        searchText,
        maxResults * 2,
        { type: 'quality_standard' }
      );

      // 2. Keyword-based search in database
      const keywordQuery: any = {
        isActive: true,
        $or: [
          { keywords: { $in: metadata.keywords } },
          { category: { $in: metadata.category } },
          { projectTypes: { $in: metadata.projectType } },
          { industries: { $in: metadata.industry } },
        ],
      };

      // OPTIMIZATION: Use .lean() for faster queries
      const keywordResults = await QualityStandard.find(keywordQuery).lean().exec() as any;

      // Escape special characters for regex
      const escapedSearchText = searchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

      // 3. Text search in name and description (use .lean() for speed)
      const textResults = await QualityStandard.find({
        isActive: true,
        $or: [
          { name: { $regex: escapedSearchText, $options: 'i' } },
          { description: { $regex: escapedSearchText, $options: 'i' } },
          { fullDescription: { $regex: escapedSearchText, $options: 'i' } },
        ],
      }).limit(maxResults).lean().exec() as any;

      // Combine and deduplicate results
      const allStandards = new Map<string, IQualityStandard>();

      // Add semantic results
      for (const result of semanticResults) {
        const standardId = result.metadata?.standardId;
        if (standardId) {
          const standard = await QualityStandard.findOne({ id: standardId }).exec();
          if (standard) {
            allStandards.set(standard.id, standard);
          }
        }
      }

      // Add keyword results
      for (const standard of keywordResults) {
        allStandards.set(standard.id, standard);
      }

      // Add text search results
      for (const standard of textResults) {
        allStandards.set(standard.id, standard);
      }

      // Score and rank standards
      const matches: StandardMatch[] = [];

      for (const standard of allStandards.values()) {
        const match = this.scoreStandard(standard, context, metadata, semanticResults);

        if (match.score >= minScore) {
          matches.push(match);
        }
      }

      // Sort by score
      matches.sort((a, b) => b.score - a.score);

      // Categorize by compliance level
      const required = matches.filter(m => m.standard.complianceLevel === 'required');
      const recommended = matches.filter(m => m.standard.complianceLevel === 'recommended');
      const optional = includeOptional
        ? matches.filter(m => m.standard.complianceLevel === 'optional')
        : [];

      return {
        required: required.slice(0, maxResults),
        recommended: recommended.slice(0, maxResults),
        optional: optional.slice(0, maxResults),
        allMatches: matches.slice(0, maxResults * 2),
      };
    } catch (error: unknown) {
      logger.error('Failed to find matching standards:', error);
      return {
        required: [],
        recommended: [],
        optional: [],
        allMatches: [],
      };
    }
  }

  /**
   * Get industry-specific standard requirements based on research
   */
  private getIndustryStandardRequirements(
    industry: string[],
    projectType: string[],
    metadata: ReturnType<typeof this.extractProjectMetadata>,
    context?: ProjectContext
  ): { required: string[]; recommended: string[] } {
    const required: string[] = [];
    const recommended: string[] = [];
    const industries = industry.map(i => i.toLowerCase());
    const types = projectType.map(t => t.toLowerCase());

    // Automotive Industry
    if (industries.some(i => ['automotive', 'vehicle', 'car'].includes(i)) ||
      metadata.keywords.some(k => ['automotive', 'vehicle', 'car', 'truck', 'asil', 'iso26262'].includes(k.toLowerCase()))) {
      required.push('iso26262', 'aspice');
      if (types.some(t => ['web-app', 'api'].includes(t))) {
        recommended.push('owasp');
      }
    }

    // Healthcare/Medical Device Industry
    if (industries.some(i => ['healthcare', 'medical', 'health'].includes(i)) ||
      metadata.keywords.some(k => ['medical', 'healthcare', 'health', 'hospital', 'patient', 'hipaa', 'iec62304'].includes(k.toLowerCase()))) {
      required.push('iec62304');
      if (metadata.needsCybersecurity || metadata.keywords.some(k => ['patient', 'health', 'data'].includes(k.toLowerCase()))) {
        required.push('hipaa');
      }
      if (types.some(t => ['web-app', 'mobile-app'].includes(t))) {
        recommended.push('owasp', 'wcag');
      }
    }

    // Aerospace Industry
    if (industries.some(i => ['aerospace', 'aviation'].includes(i)) ||
      metadata.keywords.some(k => ['aerospace', 'aviation', 'aircraft', 'do178c', 'flight'].includes(k.toLowerCase()))) {
      required.push('do178c');
    }

    // Railway Industry
    if (industries.some(i => ['railway', 'rail'].includes(i)) ||
      metadata.keywords.some(k => ['railway', 'rail', 'train', 'en50128'].includes(k.toLowerCase()))) {
      required.push('en50128');
    }

    // Financial Services Industry
    if (industries.some(i => ['finance', 'banking', 'financial'].includes(i)) ||
      metadata.keywords.some(k => ['finance', 'banking', 'payment', 'pci', 'credit', 'card', 'transaction', 'fintech'].includes(k.toLowerCase()))) {
      if (metadata.keywords.some(k => ['payment', 'pci', 'credit', 'card', 'transaction'].includes(k.toLowerCase()))) {
        required.push('pci-dss');
      }
      if (metadata.keywords.some(k => ['public', 'traded', 'sox', 'sarbanes'].includes(k.toLowerCase()))) {
        required.push('sox');
      }
      recommended.push('iso27001', 'owasp', 'iso12207');
      if (types.some(t => ['web-app', 'api', 'cloud'].includes(t))) {
        recommended.push('soc2');
      }
    }

    // Web Applications (all industries)
    if (types.some(t => ['web-app', 'api'].includes(t))) {
      recommended.push('owasp');
      if (metadata.keywords.some(k => ['public', 'government', 'accessibility', 'wcag'].includes(k.toLowerCase()))) {
        recommended.push('wcag');
      }
      if (metadata.needsCybersecurity || metadata.complexity === 'complex') {
        recommended.push('iso27001', 'nist');
      }
      if (types.some(t => ['cloud', 'saas'].includes(t))) {
        recommended.push('soc2', 'iso20000');
      }
    }

    // Mobile Applications
    if (types.includes('mobile-app')) {
      recommended.push('owasp'); // OWASP Mobile Top 10
      if (metadata.keywords.some(k => ['public', 'accessibility'].includes(k.toLowerCase()))) {
        recommended.push('wcag');
      }
    }

    // Data Protection & Privacy
    if (metadata.keywords.some(k => ['eu', 'europe', 'gdpr', 'personal', 'data', 'privacy'].includes(k.toLowerCase())) ||
      (context?.region && ((context.region as any).some)((r: any) => ['EU', 'Europe'].includes(r)))) {
      required.push('gdpr');
    }
    if (metadata.keywords.some(k => ['california', 'ccpa', 'consumer', 'privacy'].includes(k.toLowerCase())) ||
      (context?.region && ((context.region as any).some)((r: any) => ['US', 'California'].includes(r)))) {
      recommended.push('ccpa');
    }
    if (metadata.keywords.some(k => ['canada', 'pipeda'].includes(k.toLowerCase())) ||
      (context?.region && ((context.region as any).some)((r: any) => ['Canada'].includes(r)))) {
      recommended.push('pipeda');
    }
    // General data protection for any project handling user data
    if (metadata.keywords.some(k => ['user', 'data', 'personal', 'information', 'pii', 'privacy'].includes(k.toLowerCase()))) {
      recommended.push('gdpr', 'iso27001');
    }

    // Embedded Systems & IoT
    if (types.includes('embedded') || metadata.keywords.some(k => ['embedded', 'firmware', 'iot', 'device'].includes(k.toLowerCase()))) {
      if (metadata.needsSafety) {
        required.push('iec61508');
      }
      recommended.push('iso12207', 'iso29119');
    }

    // Nuclear & Energy
    if (industries.some(i => ['nuclear', 'energy', 'power'].includes(i)) ||
      metadata.keywords.some(k => ['nuclear', 'power', 'plant', 'energy', 'iec61513'].includes(k.toLowerCase()))) {
      required.push('iec61513');
    }

    // Cloud & SaaS
    if (types.some(t => ['cloud', 'saas'].includes(t)) ||
      metadata.keywords.some(k => ['cloud', 'saas', 'multi-tenant', 'hosting'].includes(k.toLowerCase()))) {
      recommended.push('soc2', 'iso20000', 'iso27001');
    }

    // General Software Development (always recommended)
    recommended.push('iso12207', 'iso29119', 'iso25010');

    // Project Management (for complex projects)
    if (metadata.complexity === 'complex' || metadata.keywords.some(k => ['project', 'management', 'pmbok'].includes(k.toLowerCase()))) {
      recommended.push('iso21500', 'iso10006', 'pmbok');
    }

    // Process Improvement (for enterprise projects)
    if (metadata.complexity === 'complex' || metadata.keywords.some(k => ['enterprise', 'large', 'scale', 'cmmi'].includes(k.toLowerCase()))) {
      recommended.push('cmmi', 'iso9001');
    }

    // Quality Assurance (always recommended)
    recommended.push('iso25010', 'ieee1012', 'ieee1028');

    return { required, recommended };
  }

  /**
   * Score a standard against project context
   * Enhanced with industry-specific rules based on research
   */
  private scoreStandard(
    standard: IQualityStandard,
    context: ProjectContext,
    metadata: ReturnType<typeof this.extractProjectMetadata>,
    semanticResults: Array<{ id: string; score: number; metadata?: any }>
  ): StandardMatch {
    let score = 0;
    const matchFactors: StandardMatch['matchFactors'] = {};

    // Get industry-specific requirements
    const industryRequirements = this.getIndustryStandardRequirements(
      metadata.industry,
      metadata.projectType,
      metadata
    );

    // HIGH PRIORITY: Check if standard is required by industry
    const standardId = standard.id.toLowerCase();
    if (industryRequirements.required.includes(standardId)) {
      score += 0.5; // Major boost for required standards
      logger.debug(`[Standards Matching] Standard '${standard.name}' is REQUIRED for this industry/project type`);
    }

    // MEDIUM PRIORITY: Check if standard is recommended by industry
    if (industryRequirements.recommended.includes(standardId)) {
      score += 0.3; // Significant boost for recommended standards
      logger.debug(`[Standards Matching] Standard '${standard.name}' is RECOMMENDED for this industry/project type`);
    }

    // Category match (0-0.15, reduced weight due to industry rules)
    const categoryMatch = this.calculateSetOverlap(
      standard.category,
      metadata.category
    );
    matchFactors.category = categoryMatch;
    score += categoryMatch * 0.15;

    // Project type match (0-0.15, reduced weight)
    const projectTypeMatch = this.calculateSetOverlap(
      standard.projectTypes,
      metadata.projectType
    );
    matchFactors.projectType = projectTypeMatch;
    score += projectTypeMatch * 0.15;

    // Industry match (0-0.15, reduced weight)
    const industryMatch = this.calculateSetOverlap(
      standard.industries,
      metadata.industry
    );
    matchFactors.industry = industryMatch;
    score += industryMatch * 0.15;

    // Semantic similarity (0-0.15, reduced weight)
    const semanticMatch = semanticResults.find(r =>
      r.metadata?.standardId === standard.id
    );
    matchFactors.semantic = semanticMatch ? semanticMatch.score : 0;
    score += (semanticMatch?.score || 0) * 0.15;

    // Keyword match (0-0.10)
    const keywordMatch = this.calculateSetOverlap(
      standard.keywords,
      metadata.keywords
    );
    matchFactors.keyword = keywordMatch;
    score += keywordMatch * 0.10;

    // Boost for required standards (from database)
    if (standard.complianceLevel === 'required') {
      score += 0.2;
    }

    // ENHANCEMENT: Boost security/safety standards based on complexity and risk level
    // Research-based: Comprehensive security standards detection
    const isSecurityStandard = standard.category.includes('security') ||
      standard.keywords.some(k => ['security', 'cybersecurity', 'owasp', 'iso27001', 'pci-dss', 'soc2', 'nist', 'iso20000'].includes(k.toLowerCase())) ||
      standardId.includes('owasp') || standardId.includes('pci') || standardId.includes('iso27001') ||
      standardId.includes('soc2') || standardId.includes('nist') || standardId.includes('iso20000');
    // Research-based: Comprehensive safety standards detection
    const isSafetyStandard = standard.category.includes('safety') ||
      standard.keywords.some(k => ['safety', 'safety-critical', 'functional-safety', 'iso26262', 'aspice', 'do178c', 'iec62304', 'en50128', 'iec61508', 'iec61513', 'do254', 'arp4754a'].includes(k.toLowerCase())) ||
      standardId.includes('iso26262') || standardId.includes('aspice') || standardId.includes('do178c') ||
      standardId.includes('iec62304') || standardId.includes('en50128') || standardId.includes('iec61508') ||
      standardId.includes('iec61513') || standardId.includes('do254') || standardId.includes('arp4754a');

    if (isSecurityStandard && metadata.needsCybersecurity) {
      // Boost security standards for projects needing cybersecurity
      const complexityBoost = metadata.complexity === 'complex' ? 0.15 : metadata.complexity === 'moderate' ? 0.10 : 0.05;
      const riskBoost = metadata.riskLevel === 'critical' ? 0.10 : metadata.riskLevel === 'high' ? 0.07 : metadata.riskLevel === 'medium' ? 0.05 : 0.02;
      score += complexityBoost + riskBoost;
      logger.debug(`[Standards Matching] Boosted security standard '${standard.name}' by ${((complexityBoost + riskBoost) * 100).toFixed(0)}% due to cybersecurity needs`);
    }

    if (isSafetyStandard && metadata.needsSafety) {
      // Boost safety standards for projects needing safety
      const complexityBoost = metadata.complexity === 'complex' ? 0.20 : metadata.complexity === 'moderate' ? 0.12 : 0.06;
      const riskBoost = metadata.riskLevel === 'critical' ? 0.15 : metadata.riskLevel === 'high' ? 0.10 : metadata.riskLevel === 'medium' ? 0.05 : 0.02;
      score += complexityBoost + riskBoost;
      logger.debug(`[Standards Matching] Boosted safety standard '${standard.name}' by ${((complexityBoost + riskBoost) * 100).toFixed(0)}% due to safety needs`);
    }

    // ENHANCEMENT: Methodology-specific boosts
    if (context.methodology) {
      const methodology = context.methodology.toLowerCase();
      // V-Model and safety standards
      if ((methodology === 'v-model' || methodology === 'waterfall') && isSafetyStandard) {
        score += 0.1;
      }
      // Agile and security/quality standards
      if ((methodology === 'agile' || methodology === 'scrum') && (isSecurityStandard || standardId.includes('owasp') || standardId.includes('wcag'))) {
        score += 0.05;
      }
    }

    // Generate reasoning
    const reasoning = this.generateReasoning(standard, matchFactors, metadata);

    // Get security/safety assessment
    const text = `${context.name} ${context.description}`.toLowerCase();
    const securitySafety = this.detectSecuritySafetyNeeds(context, text);

    return {
      standard,
      score: Math.min(score, 1.0), // Cap at 1.0
      reasoning,
      matchFactors,
      securitySafetyAssessment: {
        needsCybersecurity: metadata.needsCybersecurity,
        needsSafety: metadata.needsSafety,
        riskLevel: metadata.riskLevel,
        indicators: securitySafety.indicators,
      },
    };
  }

  /**
   * Calculate overlap between two sets (Jaccard similarity)
   */
  private calculateSetOverlap(set1: string[], set2: string[]): number {
    if (set1.length === 0 && set2.length === 0) return 1.0;
    if (set1.length === 0 || set2.length === 0) return 0.0;

    const intersection = set1.filter(x => set2.includes(x)).length;
    const union = new Set([...set1, ...set2]).size;

    return intersection / union;
  }

  /**
   * Generate human-readable reasoning for match
   * Enhanced with industry-specific explanations
   */
  private generateReasoning(
    standard: IQualityStandard,
    factors: StandardMatch['matchFactors'],
    metadata: ReturnType<typeof this.extractProjectMetadata>
  ): string {
    const reasons: string[] = [];
    const standardId = standard.id.toLowerCase();

    // Check industry-specific requirements first
    const industryRequirements = this.getIndustryStandardRequirements(
      metadata.industry,
      metadata.projectType,
      metadata
    );

    if (industryRequirements.required.includes(standardId)) {
      reasons.push('REQUIRED by industry regulations');
    } else if (industryRequirements.recommended.includes(standardId)) {
      reasons.push('RECOMMENDED for this industry/project type');
    }

    if (factors.category && factors.category > 0.5) {
      reasons.push(`Strong category match (${(factors.category * 100).toFixed(0)}%)`);
    }

    if (factors.projectType && factors.projectType > 0.5) {
      reasons.push(`Matches project type (${(factors.projectType * 100).toFixed(0)}%)`);
    }

    if (factors.industry && factors.industry > 0.5) {
      reasons.push(`Relevant for industry (${(factors.industry * 100).toFixed(0)}%)`);
    }

    if (factors.semantic && factors.semantic > 0.5) {
      reasons.push(`Semantically relevant (${(factors.semantic * 100).toFixed(0)}%)`);
    }

    if (standard.complianceLevel === 'required') {
      reasons.push('Required compliance standard');
    }

    // Add specific explanations based on standard type
    if (standardId.includes('iso26262') || standardId.includes('aspice')) {
      reasons.push('Essential for automotive functional safety');
    } else if (standardId.includes('iec62304')) {
      reasons.push('Mandatory for medical device software');
    } else if (standardId.includes('do178c')) {
      reasons.push('Required for aviation software certification');
    } else if (standardId.includes('en50128')) {
      reasons.push('Required for railway control systems');
    } else if (standardId.includes('pci-dss') || standardId.includes('pci')) {
      reasons.push('Required for payment card data processing');
    } else if (standardId.includes('hipaa')) {
      reasons.push('Required for US healthcare data protection');
    } else if (standardId.includes('gdpr')) {
      reasons.push('Required for EU user data protection');
    } else if (standardId.includes('owasp')) {
      reasons.push('Essential for web/mobile application security');
    } else if (standardId.includes('wcag')) {
      reasons.push('Recommended for public-facing applications');
    }

    if (reasons.length === 0) {
      return 'General relevance based on project description';
    }

    return reasons.join(', ');
  }

  /**
   * Auto-enroll standards for a project
   * Enhanced to prioritize industry-required standards
   */
  async autoEnrollStandards(
    context: ProjectContext,
    options: {
      autoEnrollRequired?: boolean;
      autoEnrollRecommended?: boolean;
      maxStandards?: number;
    } = {}
  ): Promise<string[]> {
    const {
      autoEnrollRequired = true,
      autoEnrollRecommended = true,
      maxStandards = 5,
    } = options;

    try {
      // OPTIMIZATION: Check cache first
      const cacheKey = crypto.createHash('sha256')
        .update(`${context.name}|${context.description.substring(0, 500)}|${context.methodology || ''}|${maxStandards}`)
        .digest('hex');

      const cached = this.cache.get(cacheKey);
      if (cached && (Date.now() - cached.timestamp) < this.cacheTTL) {
        logger.debug(`[Standards Cache] Cache HIT for project: ${context.name}`);
        return cached.standards;
      }

      // OPTIMIZATION: Try keyword-based matching first for simple cases (early exit)
      const metadata = this.extractProjectMetadata(context);
      const industryRequirements = this.getIndustryStandardRequirements(
        metadata.industry,
        metadata.projectType,
        metadata
      );

      // If we have clear industry requirements, use them directly (skip expensive vector search)
      if (industryRequirements.required.length > 0 || industryRequirements.recommended.length > 0) {
        const quickStandards = [
          ...industryRequirements.required,
          ...industryRequirements.recommended.slice(0, maxStandards - industryRequirements.required.length)
        ].slice(0, maxStandards);

        // Verify standards exist in database (use .lean() for speed)
        const validStandards: string[] = [];
        for (const stdId of quickStandards) {
          const standard = await QualityStandard.findOne({ id: stdId, isActive: true }).lean().exec() as any;
          if (standard) {
            validStandards.push(stdId);
          }
        }

        if (validStandards.length > 0) {
          // Cache the result
          this.cache.set(cacheKey, { standards: validStandards, timestamp: Date.now() });
          logger.debug(`[Standards Cache] Early exit with ${validStandards.length} standards from industry requirements`);
          return validStandards;
        }
      }

      // Fall back to full matching if keyword-based didn't find enough
      const recommendation = await this.findMatchingStandards(context, {
        maxResults: maxStandards * 3, // Get more results to ensure we find required standards
        minScore: 0.3, // Lower threshold to catch required standards
      });

      const enrolled: string[] = [];

      // HIGH PRIORITY: Auto-enroll industry-required standards (even if not in recommendation)
      if (autoEnrollRequired) {
        // First, add standards marked as required in database
        enrolled.push(...recommendation.required.map(m => m.standard.id));

        // Then, add industry-required standards that might not be in the database yet
        for (const requiredStdId of industryRequirements.required) {
          if (!enrolled.includes(requiredStdId)) {
            // Try to find the standard in the database (use .lean() for speed)
            const standard = await QualityStandard.findOne({
              id: requiredStdId,
              isActive: true
            }).lean().exec() as any;
            if (standard) {
              enrolled.push(requiredStdId);
              logger.info(`Auto-enrolled industry-required standard: ${standard.name}`);
            } else {
              // Standard not in database, but still add it (will be handled by frontend)
              enrolled.push(requiredStdId);
              logger.warn(`Industry-required standard '${requiredStdId}' not found in database, but adding to enrollment list`);
            }
          }
        }
      }

      // MEDIUM PRIORITY: Auto-enroll industry-recommended standards
      if (autoEnrollRecommended) {
        // Add industry-recommended standards
        for (const recommendedStdId of industryRequirements.recommended) {
          if (!enrolled.includes(recommendedStdId) && enrolled.length < maxStandards) {
            const standard = await QualityStandard.findOne({
              id: recommendedStdId,
              isActive: true
            }).lean().exec() as any;
            if (standard) {
              enrolled.push(recommendedStdId);
              logger.info(`Auto-enrolled industry-recommended standard: ${standard.name}`);
            }
          }
        }

        // Then add top-scoring recommended standards from matching service
        const recommended = recommendation.recommended
          .filter(m => !enrolled.includes(m.standard.id)) // Exclude already enrolled
          .slice(0, maxStandards - enrolled.length)
          .map(m => m.standard.id);
        enrolled.push(...recommended);
      }

      // Remove duplicates and limit to maxStandards
      const uniqueEnrolled = Array.from(new Set(enrolled)).slice(0, maxStandards);

      // OPTIMIZATION: Cache the result
      this.cache.set(cacheKey, { standards: uniqueEnrolled, timestamp: Date.now() });

      // Clean up old cache entries (keep cache size manageable)
      if (this.cache.size > 1000) {
        const now = Date.now();
        for (const [key, value] of this.cache.entries()) {
          if (now - value.timestamp > this.cacheTTL) {
            this.cache.delete(key);
          }
        }
      }

      logger.info(`Auto-enrolled ${uniqueEnrolled.length} standards for project: ${context.name}`, {
        required: industryRequirements.required.filter(id => uniqueEnrolled.includes(id)),
        recommended: industryRequirements.recommended.filter(id => uniqueEnrolled.includes(id)),
        total: uniqueEnrolled.length
      });

      return uniqueEnrolled;
    } catch (error: unknown) {
      logger.error('Failed to auto-enroll standards:', error);
      return [];
    }
  }

  /**
   * Search for standards (even if not in current list)
   */
  async searchStandards(
    query: string,
    filters?: {
      category?: string[];
      projectType?: string[];
      industry?: string[];
      complianceLevel?: string[];
    }
  ): Promise<StandardMatch[]> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      // Use RAG to find relevant standards
      // @ts-ignore TS6133
      const _ragResults = await llamaindexService.query({
        query: `Find quality standards and compliance requirements for: ${query}`,
        topK: 10,
      });

      // Also search database
      const dbQuery: any = {
        isActive: true,
        $or: [
          { name: { $regex: query, $options: 'i' } },
          { description: { $regex: query, $options: 'i' } },
          { keywords: { $in: [query.toLowerCase()] } },
        ],
      };

      if (filters) {
        if (filters.category) {
          dbQuery.category = { $in: filters.category };
        }
        if (filters.projectType) {
          dbQuery.projectTypes = { $in: filters.projectType };
        }
        if (filters.industry) {
          dbQuery.industries = { $in: filters.industry };
        }
        if (filters.complianceLevel) {
          dbQuery.complianceLevel = { $in: filters.complianceLevel };
        }
      }

      // OPTIMIZATION: Use .lean() for faster queries
      const dbResults = await QualityStandard.find(dbQuery).limit(20).lean().exec() as any;

      // Combine and score results
      const matches: StandardMatch[] = [];

      for (const standard of dbResults) {
        const match: StandardMatch = {
          standard,
          score: 0.7, // Base score for database matches
          reasoning: `Found in standards database matching "${query}"`,
          matchFactors: {},
        };
        matches.push(match);
      }

      // Sort by score
      matches.sort((a, b) => b.score - a.score);

      return matches;
    } catch (error: unknown) {
      logger.error('Failed to search standards:', error);
      return [];
    }
  }
}

export const standardsMatchingService = new StandardsMatchingService();

