/**
 * Process Improvement Agent Assessment Service
 * Uses AI agents to assess and approve process improvements automatically
 */

import { IProcessImprovement } from '../models/ProcessImprovement.model.js';
import { llmRouter } from './llm/LLMRouter.js';
import { logger } from '../utils/logger.js';

export interface AgentAssessmentResult {
  decision: 'approve' | 'work-on' | 'reject';
  reasoning: string;
  improvements?: {
    title?: string;
    description?: string;
    content?: string;
    structuredContent?: IProcessImprovement['structuredContent'];
    tags?: string[];
    keywords?: string[];
  };
  rejectionReason?: string; // Required if decision is 'reject'
  confidence: number; // 0-100
}

class ProcessImprovementAgentAssessmentService {
  /**
   * Assess a process improvement using an AI agent
   */
  async assessImprovement(improvement: IProcessImprovement): Promise<AgentAssessmentResult> {
    const startTime = Date.now();
    const ASSESSMENT_TIMEOUT = 90000; // 90 second timeout for assessment
    
    try {
      logger.info(`Starting agent assessment for improvement: ${improvement.id}`);

      const assessmentPrompt = this.buildAssessmentPrompt(improvement);
      
      // Create a timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Assessment timeout after ${ASSESSMENT_TIMEOUT}ms`));
        }, ASSESSMENT_TIMEOUT);
      });
      
      // Use intelligent LLM router to automatically select best model for assessment
      // The router will analyze the task and select the optimal model based on:
      // - Agent role (QA/Audit Agent)
      // - Task type (analysis)
      // - Required capabilities (structured output)
      // - Cost constraints
      // - User preferences
      const response = await Promise.race([
        llmRouter.executeWithFallback({
          prompt: assessmentPrompt + '\n\nIMPORTANT: Respond with valid JSON only in this format:\n{\n  "decision": "approve" or "work-on" or "reject",\n  "reasoning": "detailed reasoning",\n  "improvements": { "title": "...", "description": "...", "content": "...", "tags": [...], "keywords": [...] } (only if decision is work-on),\n  "rejectionReason": "detailed reason for rejection" (only if decision is reject),\n  "confidence": 0-100\n}',
          context: {
            agentRole: 'QA/Audit Agent',
            taskType: 'analysis',
            systemInstruction: this.getSystemInstruction()
            // No model specified - let intelligent routing select the best one
          }
        }),
        timeoutPromise
      ]);

      // Parse JSON from response (handle markdown code blocks if present)
      let jsonText = response.text.trim();
      const jsonMatch = jsonText.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
      if (jsonMatch) {
        jsonText = jsonMatch[1];
      }
      
      const assessment = JSON.parse(jsonText) as AgentAssessmentResult;

      const duration = Date.now() - startTime;
      logger.info(`Agent assessment complete for ${improvement.id}: ${assessment.decision} (confidence: ${assessment.confidence}%) in ${duration}ms`);

      return assessment;
    } catch (error: unknown) {
      const duration = Date.now() - startTime;
      logger.error(`Agent assessment failed for ${improvement.id} after ${duration}ms:`, error);
      // Default to approval if assessment fails (fail-safe)
      return {
        decision: 'approve',
        reasoning: `Assessment service unavailable (${(error instanceof Error ? error.message : String(error))}), defaulting to approval`,
        confidence: 50
      };
    }
  }

  /**
   * Work on and refine a process improvement
   * Throws error on failure so calling code can handle it
   */
  async refineImprovement(
    improvement: IProcessImprovement,
    assessment: AgentAssessmentResult
  ): Promise<Partial<IProcessImprovement>> {
    const startTime = Date.now();
    const REFINEMENT_TIMEOUT = 60000; // 60 second timeout
    
    try {
      logger.info(`Agent refining improvement: ${improvement.id}`);

      if (!assessment.improvements) {
        // No specific improvements suggested, return original
        logger.info(`No improvements suggested for ${improvement.id}, returning empty refinement`);
        return {};
      }

      const refinementPrompt = this.buildRefinementPrompt(improvement, assessment);
      
      // Create a timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Refinement timeout after ${REFINEMENT_TIMEOUT}ms`));
        }, REFINEMENT_TIMEOUT);
      });
      
      // Race between LLM call and timeout
      const response = await Promise.race([
        llmRouter.executeWithFallback({
          prompt: refinementPrompt + '\n\nIMPORTANT: Respond with valid JSON only in this format:\n{\n  "title": "refined title",\n  "description": "refined description",\n  "content": "refined content",\n  "tags": [...],\n  "keywords": [...]\n}',
          context: {
            agentRole: 'Requirements Agent',
            taskType: 'documentation',
            systemInstruction: this.getRefinementSystemInstruction()
            // Let the router select the best model instead of hardcoding
          }
        }),
        timeoutPromise
      ]);

      // Parse JSON from response (handle markdown code blocks if present)
      let jsonText = response.text.trim();
      const jsonMatch = jsonText.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
      if (jsonMatch) {
        jsonText = jsonMatch[1];
      }
      
      const refined = JSON.parse(jsonText);
      
      const duration = Date.now() - startTime;
      logger.info(`Agent refinement complete for ${improvement.id} in ${duration}ms`);
      
      return refined;
    } catch (error: unknown) {
      const duration = Date.now() - startTime;
      logger.error(`Agent refinement failed for ${improvement.id} after ${duration}ms:`, error);
      
      // If we have assessment improvements, use them as fallback
      if (assessment.improvements && Object.keys(assessment.improvements).length > 0) {
        logger.info(`Using assessment improvements as fallback for ${improvement.id}`);
        return assessment.improvements;
      }
      
      // Re-throw the error so calling code knows refinement failed
      throw new Error(`Refinement failed: ${(error instanceof Error ? error.message : String(error))}`);
    }
  }

  /**
   * Build assessment prompt
   */
  private buildAssessmentPrompt(improvement: IProcessImprovement): string {
    return `You are an expert QA/Audit Agent assessing a process improvement proposal.

PROCESS IMPROVEMENT TO ASSESS:
Title: ${improvement.title}
Category: ${improvement.category}
Type: ${improvement.type}
Status: ${improvement.status}
Priority: ${improvement.priority}

Description:
${improvement.description}

Content:
${improvement.content}

Quality Metrics:
- Completeness: ${improvement.quality.completeness}%
- Clarity: ${improvement.quality.clarity}%
- Usefulness: ${improvement.quality.usefulness}%

Applicable To:
- Agent Roles: ${improvement.applicableTo?.agentRoles?.join(', ') || 'All'}
- Methodologies: ${improvement.applicableTo?.methodologies?.join(', ') || 'All'}
- Project Types: ${improvement.applicableTo?.projectTypes?.join(', ') || 'All'}

Tags: ${improvement.tags?.join(', ') || 'None'}
Keywords: ${improvement.keywords?.join(', ') || 'None'}

YOUR TASK:
1. Assess the quality, completeness, and usefulness of this process improvement
2. Determine if it's ready for approval or needs refinement
3. If it needs work, provide specific improvements

DECISION CRITERIA:
- APPROVE if: Content is clear, complete, useful, and follows best practices
- WORK-ON if: Content needs clarification, expansion, better structure, or quality improvements (but is salvageable)
- REJECT if: Content is fundamentally flawed, incorrect, violates security/compliance, contains harmful information, is duplicate/redundant, or cannot be salvaged

REJECTION CRITERIA (Use REJECT when):
❌ Content contains incorrect or misleading information that cannot be fixed
❌ Violates security best practices or compliance requirements
❌ Contains harmful, inappropriate, or malicious content
❌ Is a duplicate or near-duplicate of existing content
❌ Quality metrics are extremely low (<30% across all dimensions) and content cannot be improved
❌ Content is not suitable for the platform or target audience
❌ Contains practices that would cause harm if implemented

Provide your assessment with:
- Decision: "approve", "work-on", or "reject"
- Detailed reasoning for your decision
- If "work-on": Specific improvements (title, description, content, tags, keywords)
- If "reject": Detailed rejectionReason explaining why it cannot be approved
- Confidence level (0-100)`;
  }

  /**
   * Build refinement prompt
   */
  private buildRefinementPrompt(
    improvement: IProcessImprovement,
    assessment: AgentAssessmentResult
  ): string {
    return `You are a Requirements Agent refining a process improvement based on assessment feedback.

ORIGINAL IMPROVEMENT:
Title: ${improvement.title}
Description: ${improvement.description}
Content: ${improvement.content}

ASSESSMENT FEEDBACK:
${assessment.reasoning}

SUGGESTED IMPROVEMENTS:
${JSON.stringify(assessment.improvements, null, 2)}

YOUR TASK:
Refine the process improvement by incorporating the assessment feedback and suggested improvements.
Maintain the original intent and structure while improving clarity, completeness, and quality.

Return the refined version with:
- Improved title (if needed)
- Enhanced description
- Refined content
- Updated tags and keywords (if needed)`;
  }

  /**
   * Get system instruction for assessment
   */
  private getSystemInstruction(): string {
    return `You are an expert QA/Audit Agent specialized in evaluating process improvements, guidelines, and best practices.

Your role:
- Assess the quality, completeness, and usefulness of process improvements
- Identify areas that need refinement or enhancement
- Make objective decisions based on content quality, not personal preferences
- Provide constructive feedback and specific improvement suggestions

Assessment principles:
- Clarity: Is the content clear and easy to understand?
- Completeness: Does it cover all necessary aspects?
- Usefulness: Will it help agents/users achieve their goals?
- Best practices: Does it follow industry standards and best practices?
- Structure: Is it well-organized and logical?
- Security: Does it violate security or compliance requirements?
- Accuracy: Is the information correct and reliable?

Decision guidelines:
- APPROVE: Content meets quality standards and is ready for use
- WORK-ON: Content has potential but needs refinement (salvageable)
- REJECT: Content is fundamentally flawed, incorrect, harmful, or cannot be salvaged

Be thorough and objective. Since human interaction is limited, you must make clear decisions:
- Don't hesitate to REJECT content that is incorrect, harmful, or violates standards
- Use WORK-ON for content that can be improved through refinement
- Only APPROVE content that truly meets quality standards

Your decisions directly impact the platform quality - be strict but fair.`;
  }

  /**
   * Get system instruction for refinement
   */
  private getRefinementSystemInstruction(): string {
    return `You are a Requirements Agent specialized in refining and improving process documentation.

Your role:
- Refine process improvements based on assessment feedback
- Enhance clarity, completeness, and quality
- Maintain the original intent and structure
- Incorporate best practices and industry standards

Refinement principles:
- Preserve the core message and intent
- Improve clarity and readability
- Add missing details or context
- Enhance structure and organization
- Update tags and keywords for better discoverability

Focus on making the improvement more useful and actionable while maintaining its original purpose.`;
  }
}

export const processImprovementAgentAssessment = new ProcessImprovementAgentAssessmentService();

