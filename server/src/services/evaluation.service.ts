import { geminiService } from './gemini.service.js';
import { logger } from '../utils/logger.js';
import { Type, Schema } from '@google/genai';
import { llmRouter } from './llm/LLMRouter.js';

export interface EvaluationResult {
  score: number; // 0-100
  reasoning: string;
  criteria: string[]; // List of criteria checked
  timestamp: number;
}

export interface EvaluationContext {
  taskTitle: string;
  taskDescription: string;
  agentRole: string;
  output: string;
  standards?: string[];
  projectContext?: string;
}

export class EvaluationService {
  /**
   * Evaluate task output quality using LLM-based evaluation
   * This provides real quality assessment instead of hardcoded scores
   */
  async evaluateTaskOutput(context: EvaluationContext): Promise<EvaluationResult> {
    try {
      const {
        taskTitle,
        taskDescription,
        agentRole,
        output,
        standards = [],
        projectContext = ''
      } = context;

      // Skip evaluation if output is too short or empty
      if (!output || output.trim().length < 50) {
        logger.warn(`Skipping evaluation for task "${taskTitle}" - output too short`);
        return {
          score: 50,
          reasoning: 'Output is too short to evaluate meaningfully. Please provide more substantial output.',
          criteria: ['Output Length'],
          timestamp: Date.now()
        };
      }

      // Build evaluation prompt - Agent-to-Agent conversation format
      // QA/Audit Agent evaluates the output from another agent
      const standardsText = standards.length > 0 
        ? `\n\nStandards to check:\n${standards.map(s => `- ${s}`).join('\n')}`
        : '';

      const projectContextText = projectContext 
        ? `\n\nProject Context:\n${projectContext.substring(0, 500)}`
        : '';

      // Create agent-to-agent evaluation prompt
      // This enables neural conversation between agents and supports process improvement
      const evaluationPrompt = `You are the QA/Audit Agent, a CISO-level Security Strategist & Compliance Expert. You are evaluating the work of another agent in this project.

**AGENT-TO-AGENT EVALUATION CONTEXT:**
- **Original Agent**: ${agentRole}
- **Task Title**: ${taskTitle}
- **Task Description**: ${taskDescription}${standardsText}${projectContextText}

**OUTPUT TO EVALUATE (from ${agentRole}):**
${output.substring(0, 4000)}${output.length > 4000 ? '\n\n[... output truncated for evaluation ...]' : ''}

**YOUR ROLE AS QA/AUDIT AGENT:**
As the QA/Audit Agent, you are responsible for:
1. **Quality Assessment**: Evaluate the completeness, accuracy, and quality of the output
2. **Standards Compliance**: Check adherence to specified standards and best practices
3. **Security & Best Practices**: Identify security concerns, code quality issues, and areas for improvement
4. **Refinement Guidance**: Provide specific, actionable feedback to help the original agent improve
5. **Process Improvement**: Note patterns and insights that can improve the overall development process

**EVALUATION CRITERIA (Score 0-100):**
1. **Completeness** (0-25 points): Does the output fully address the task requirements? Are all requested components present?
2. **Accuracy** (0-25 points): Is the information correct? Are there factual errors, logical inconsistencies, or technical mistakes?
3. **Relevance** (0-20 points): Is the output relevant to the task? Does it stay on topic and address the specific requirements?
4. **Quality** (0-15 points): Is the output well-structured, clear, and professional? Is the code/documentation/design of high quality?
5. **Standards Compliance** (0-15 points): Does the output follow specified standards, best practices, and conventions?${standards.length > 0 ? ' Check against the standards listed above.' : ''}

**PROVIDE YOUR EVALUATION:**
- Overall score (0-100)
- Detailed reasoning explaining the score
- List of criteria checked
- Specific strengths found
- Specific weaknesses and areas for improvement
- Actionable refinement suggestions for the original agent
- Process improvement insights (if any patterns or learnings emerge)

**EVALUATION TONE:**
- Be thorough but fair
- Provide constructive, actionable feedback
- Focus on helping the original agent improve
- A score of 90-100 means excellent quality with minor or no issues
- 70-89 means good quality with some areas for improvement
- 50-69 means acceptable but needs significant improvement
- Below 50 means poor quality with major issues

Remember: Your evaluation will be used to refine the task and improve the output. Be specific and actionable in your feedback.`;

      const evaluationSchema: Schema = {
        type: Type.OBJECT,
        properties: {
          score: {
            type: Type.NUMBER,
            description: 'Overall quality score from 0-100'
          },
          reasoning: {
            type: Type.STRING,
            description: 'Detailed explanation of the evaluation, including strengths and weaknesses, written as feedback to the original agent'
          },
          criteria: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: 'List of specific criteria that were evaluated (e.g., "Completeness", "Accuracy", "Code Quality", "Documentation", "Security", "Standards Compliance")'
          },
          strengths: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: 'List of specific strengths found in the output'
          },
          weaknesses: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: 'List of specific weaknesses or areas for improvement'
          },
          refinementSuggestions: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: 'Actionable suggestions for the original agent to improve the output'
          },
          processImprovements: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: 'Process improvement insights or patterns identified during evaluation'
          }
        },
        required: ['score', 'reasoning', 'criteria']
      };

      // Use QA/Audit Agent for evaluation - enables agent-to-agent conversation
      // This supports neural conversation between agents and process improvement
      const startTime = Date.now();
      
      // The evaluation prompt already includes QA/Audit Agent context
      // Use structured output with model selection optimized for QA/Audit Agent role
      // The prompt itself establishes the agent-to-agent conversation context
      const result = await geminiService.generateStructuredOutput(
        evaluationPrompt,
        evaluationSchema,
        'gemini-2.5-flash' // Fast model for evaluation, but with QA/Audit Agent context in prompt
      );

      const latency = Date.now() - startTime;
      logger.info(`Evaluation completed in ${latency}ms for task "${taskTitle}" - Score: ${result.score}/100`);

      // Enhance reasoning with strengths/weaknesses, refinement suggestions, and process improvements
      let enhancedReasoning = result.reasoning || 'Evaluation completed by QA/Audit Agent.';
      
      if (result.strengths && Array.isArray(result.strengths) && result.strengths.length > 0) {
        enhancedReasoning += `\n\n**Strengths:**\n${result.strengths.map(s => `• ${s}`).join('\n')}`;
      }
      
      if (result.weaknesses && Array.isArray(result.weaknesses) && result.weaknesses.length > 0) {
        enhancedReasoning += `\n\n**Areas for Improvement:**\n${result.weaknesses.map(w => `• ${w}`).join('\n')}`;
      }
      
      // Add refinement suggestions for agent-to-agent conversation
      if (result.refinementSuggestions && Array.isArray(result.refinementSuggestions) && result.refinementSuggestions.length > 0) {
        enhancedReasoning += `\n\n**Refinement Suggestions for ${agentRole}:**\n${result.refinementSuggestions.map(s => `• ${s}`).join('\n')}`;
      }
      
      // Add process improvement insights
      if (result.processImprovements && Array.isArray(result.processImprovements) && result.processImprovements.length > 0) {
        enhancedReasoning += `\n\n**Process Improvement Insights:**\n${result.processImprovements.map(p => `• ${p}`).join('\n')}`;
      }

      // Ensure score is within valid range
      const score = Math.max(0, Math.min(100, Math.round(result.score || 50)));

      // Ensure criteria is an array
      const criteria = Array.isArray(result.criteria) && result.criteria.length > 0
        ? result.criteria
        : ['Completeness', 'Accuracy', 'Relevance', 'Quality'];

      return {
        score,
        reasoning: enhancedReasoning,
        criteria,
        timestamp: Date.now()
      };

    } catch (error: unknown) {
      logger.error('Evaluation failed:', error);
      
      // Return a fallback evaluation on error
      return {
        score: 70,
        reasoning: `Evaluation service encountered an error: ${error.message || 'Unknown error'}. Default score assigned.`,
        criteria: ['Error Fallback'],
        timestamp: Date.now()
      };
    }
  }

  /**
   * Quick evaluation for simple tasks (faster, less detailed)
   */
  async quickEvaluate(output: string, taskDescription: string): Promise<EvaluationResult> {
    if (!output || output.trim().length < 50) {
      return {
        score: 50,
        reasoning: 'Output is too short to evaluate.',
        criteria: ['Output Length'],
        timestamp: Date.now()
      };
    }

    // Simple heuristic-based evaluation for speed
    const hasContent = output.length > 100;
    const hasStructure = output.includes('\n') || output.includes('```') || output.includes('#');
    const hasDetails = output.split(' ').length > 50;
    
    let score = 50; // Base score
    if (hasContent) score += 15;
    if (hasStructure) score += 15;
    if (hasDetails) score += 20;

    return {
      score: Math.min(100, score),
      reasoning: `Quick evaluation: ${hasContent ? 'Has content' : 'Limited content'}, ${hasStructure ? 'Well-structured' : 'Needs structure'}, ${hasDetails ? 'Detailed' : 'Needs more detail'}.`,
      criteria: ['Content Length', 'Structure', 'Detail Level'],
      timestamp: Date.now()
    };
  }
}

export const evaluationService = new EvaluationService();
















