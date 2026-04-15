/**
 * Standards Research Service
 * Uses internet search to research quality standards, audit procedures, and compliance evaluation
 */

import { logger } from '../utils/logger.js';
import { apiKeyProvider } from './apiKeyProvider.service.js';
import { ChatOpenAI } from '@langchain/openai';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';

export interface StandardsResearchQuery {
  standardId?: string;
  standardName?: string;
  researchType: 'general' | 'audit' | 'compliance' | 'evaluation' | 'best-practices';
  context?: string;
  projectType?: string;
  industry?: string;
}

export interface ResearchResult {
  summary: string;
  keyPoints: string[];
  sources: Array<{
    title: string;
    url: string;
    snippet?: string;
  }>;
  auditGuidance?: string;
  complianceCriteria?: string[];
  evaluationMethods?: string[];
  lastUpdated?: string;
}

class StandardsResearchService {
  private llm: any = null;
  private initialized: boolean = false;

  /**
   * Initialize the research service
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Initialize LLM with internet search capability (using database-stored API keys)
      const openaiKey = await apiKeyProvider.getApiKey('openai');
      const geminiKey = await apiKeyProvider.getApiKey('gemini');
      
      if (openaiKey) {
        this.llm = new ChatOpenAI({
          modelName: 'gpt-4o',
          temperature: 0.7,
          openAIApiKey: openaiKey,
        });
      } else if (geminiKey) {
        this.llm = new ChatGoogleGenerativeAI({
          model: 'gemini-3-pro-preview',
          temperature: 0.7,
          apiKey: geminiKey,
        });
      } else {
        throw new Error('No LLM API key configured for standards research. Add API keys via Admin Console → Settings → API Keys');
      }

      this.initialized = true;
      logger.info('✅ Standards Research service initialized');
    } catch (error: unknown) {
      logger.error('Failed to initialize Standards Research service:', error);
      throw error;
    }
  }

  /**
   * Research a standard using internet search
   */
  async researchStandard(query: StandardsResearchQuery): Promise<ResearchResult> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const standardName = query.standardName || query.standardId || 'quality standard';
      const researchPrompt = this.buildResearchPrompt(query, standardName);

      // Use LLM with internet search (Google Search grounding for Gemini)
      const response = await this.llm.invoke(researchPrompt);

      // Parse response
      const content = typeof response.content === 'string'
        ? response.content
        : JSON.stringify(response.content);

      return this.parseResearchResult(content, query);
    } catch (error: unknown) {
      logger.error('Standards research failed:', error);
      throw new Error(`Standards research failed: ${(error instanceof Error ? error.message : String(error))}`);
    }
  }

  /**
   * Build research prompt based on research type
   */
  private buildResearchPrompt(query: StandardsResearchQuery, standardName: string): string {
    const basePrompt = `You are a quality standards expert. Research the following quality standard using current, authoritative sources from the internet.`;

    switch (query.researchType) {
      case 'audit':
        return `${basePrompt}

Standard: ${standardName}
${query.context ? `Project Context: ${query.context}` : ''}
${query.projectType ? `Project Type: ${query.projectType}` : ''}
${query.industry ? `Industry: ${query.industry}` : ''}

Research Focus: How to perform audits against this standard
- Audit procedures and methodologies
- Key areas to check
- Common non-compliance issues
- Audit checklist items
- Best practices for conducting audits
- Documentation requirements
- Evidence collection methods

Provide comprehensive guidance on performing audits for this standard.`;

      case 'compliance':
        return `${basePrompt}

Standard: ${standardName}
${query.context ? `Project Context: ${query.context}` : ''}
${query.projectType ? `Project Type: ${query.projectType}` : ''}
${query.industry ? `Industry: ${query.industry}` : ''}

Research Focus: Compliance requirements and criteria
- Specific compliance requirements
- Mandatory vs. recommended practices
- Compliance criteria and checkpoints
- Documentation requirements
- Implementation guidelines
- Regional variations (if applicable)
- Latest version and updates

Provide detailed compliance criteria and requirements.`;

      case 'evaluation':
        return `${basePrompt}

Standard: ${standardName}
${query.context ? `Project Context: ${query.context}` : ''}
${query.projectType ? `Project Type: ${query.projectType}` : ''}
${query.industry ? `Industry: ${query.industry}` : ''}

Research Focus: How to evaluate and judge compliance
- Evaluation methodologies
- Scoring and rating systems
- Pass/fail criteria
- Risk assessment approaches
- Evidence evaluation methods
- Reporting requirements
- Common evaluation pitfalls

Provide comprehensive evaluation and judgment guidance.`;

      case 'best-practices':
        return `${basePrompt}

Standard: ${standardName}
${query.context ? `Project Context: ${query.context}` : ''}
${query.projectType ? `Project Type: ${query.projectType}` : ''}
${query.industry ? `Industry: ${query.industry}` : ''}

Research Focus: Best practices and implementation
- Industry best practices
- Implementation strategies
- Common challenges and solutions
- Success stories and case studies
- Tools and resources
- Training requirements
- Continuous improvement approaches

Provide best practices and implementation guidance.`;

      default: // 'general'
        return `${basePrompt}

Standard: ${standardName}
${query.context ? `Project Context: ${query.context}` : ''}
${query.projectType ? `Project Type: ${query.projectType}` : ''}
${query.industry ? `Industry: ${query.industry}` : ''}

Research Focus: General information about the standard
- Overview and purpose
- Key requirements
- Applicability and scope
- Latest version and updates
- Official sources and documentation
- Related standards

Provide comprehensive information about this standard.`;
    }
  }

  /**
   * Parse research result from LLM response
   */
  private parseResearchResult(content: string, query: StandardsResearchQuery): ResearchResult {
    // Extract summary (first paragraph or section)
    const summaryMatch = content.match(/(?:Summary|Overview|Introduction)[:\s]*([^\n]+(?:\n[^\n]+)*?)(?:\n\n|\n##|$)/i);
    const summary = summaryMatch ? summaryMatch[1].trim() : content.substring(0, 500);

    // Extract key points (bulleted or numbered lists)
    const keyPointsMatch = content.match(/(?:Key Points|Main Points|Requirements)[:\s]*\n((?:[-•*]\s[^\n]+\n?)+)/i);
    const keyPoints = keyPointsMatch
      ? keyPointsMatch[1].split(/\n/).filter(line => line.trim().match(/^[-•*]\s/)).map(line => line.replace(/^[-•*]\s+/, '').trim())
      : [];

    // Extract sources (URLs in content)
    const urlRegex = /(https?:\/\/[^\s\)]+)/g;
    const urls = content.match(urlRegex) || [];
    const sources = urls.slice(0, 10).map((url, index) => ({
      title: `Source ${index + 1}`,
      url: url,
      snippet: this.extractSnippetAroundUrl(content, url),
    }));

    // Extract audit guidance if research type is audit
    let auditGuidance: string | undefined;
    if (query.researchType === 'audit') {
      const auditMatch = content.match(/(?:Audit Guidance|Audit Procedures|How to Audit)[:\s]*\n([^\n]+(?:\n[^\n]+)*?)(?:\n\n|\n##|$)/i);
      auditGuidance = auditMatch ? auditMatch[1].trim() : undefined;
    }

    // Extract compliance criteria if research type is compliance
    let complianceCriteria: string[] | undefined;
    if (query.researchType === 'compliance') {
      const criteriaMatch = content.match(/(?:Compliance Criteria|Requirements|Checklist)[:\s]*\n((?:[-•*]\s[^\n]+\n?)+)/i);
      complianceCriteria = criteriaMatch
        ? criteriaMatch[1].split(/\n/).filter(line => line.trim().match(/^[-•*]\s/)).map(line => line.replace(/^[-•*]\s+/, '').trim())
        : [];
    }

    // Extract evaluation methods if research type is evaluation
    let evaluationMethods: string[] | undefined;
    if (query.researchType === 'evaluation') {
      const methodsMatch = content.match(/(?:Evaluation Methods|Judgment Criteria|Assessment)[:\s]*\n((?:[-•*]\s[^\n]+\n?)+)/i);
      evaluationMethods = methodsMatch
        ? methodsMatch[1].split(/\n/).filter(line => line.trim().match(/^[-•*]\s/)).map(line => line.replace(/^[-•*]\s+/, '').trim())
        : [];
    }

    // Extract last updated date if mentioned
    const dateMatch = content.match(/(?:Last Updated|Version|Updated|Current Version)[:\s]*([0-9]{4}|[A-Za-z]+\s+[0-9]{4})/i);
    const lastUpdated = dateMatch ? dateMatch[1] : undefined;

    return {
      summary,
      keyPoints: keyPoints.length > 0 ? keyPoints : this.extractKeyPoints(content),
      sources,
      auditGuidance,
      complianceCriteria,
      evaluationMethods,
      lastUpdated,
    };
  }

  /**
   * Extract key points from content
   */
  private extractKeyPoints(content: string): string[] {
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 20);
    return sentences.slice(0, 10).map(s => s.trim());
  }

  /**
   * Extract snippet around URL in content
   */
  private extractSnippetAroundUrl(content: string, url: string): string {
    const urlIndex = content.indexOf(url);
    if (urlIndex === -1) return '';

    const start = Math.max(0, urlIndex - 100);
    const end = Math.min(content.length, urlIndex + url.length + 100);
    return content.substring(start, end).trim();
  }

  /**
   * Research audit procedures for a standard
   */
  async researchAuditProcedures(
    standardId: string,
    standardName: string,
    context?: {
      projectType?: string;
      industry?: string;
      projectDescription?: string;
    }
  ): Promise<ResearchResult> {
    return this.researchStandard({
      standardId,
      standardName,
      researchType: 'audit',
      context: context?.projectDescription,
      projectType: context?.projectType,
      industry: context?.industry,
    });
  }

  /**
   * Research compliance criteria for a standard
   */
  async researchComplianceCriteria(
    standardId: string,
    standardName: string,
    context?: {
      projectType?: string;
      industry?: string;
      projectDescription?: string;
    }
  ): Promise<ResearchResult> {
    return this.researchStandard({
      standardId,
      standardName,
      researchType: 'compliance',
      context: context?.projectDescription,
      projectType: context?.projectType,
      industry: context?.industry,
    });
  }

  /**
   * Research evaluation methods for a standard
   */
  async researchEvaluationMethods(
    standardId: string,
    standardName: string,
    context?: {
      projectType?: string;
      industry?: string;
      projectDescription?: string;
    }
  ): Promise<ResearchResult> {
    return this.researchStandard({
      standardId,
      standardName,
      researchType: 'evaluation',
      context: context?.projectDescription,
      projectType: context?.projectType,
      industry: context?.industry,
    });
  }

  /**
   * Get comprehensive research for audit task
   */
  async getComprehensiveAuditResearch(
    standardId: string,
    standardName: string,
    context?: {
      projectType?: string;
      industry?: string;
      projectDescription?: string;
    }
  ): Promise<{
    general: ResearchResult;
    audit: ResearchResult;
    compliance: ResearchResult;
    evaluation: ResearchResult;
  }> {
    const [general, audit, compliance, evaluation] = await Promise.all([
      this.researchStandard({
        standardId,
        standardName,
        researchType: 'general',
        context: context?.projectDescription,
        projectType: context?.projectType,
        industry: context?.industry,
      }),
      this.researchAuditProcedures(standardId, standardName, context),
      this.researchComplianceCriteria(standardId, standardName, context),
      this.researchEvaluationMethods(standardId, standardName, context),
    ]);

    return {
      general,
      audit,
      compliance,
      evaluation,
    };
  }
}

export const standardsResearchService = new StandardsResearchService();













