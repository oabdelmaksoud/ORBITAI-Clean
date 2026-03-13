/**
 * LLM Router Natural Language Service
 * Generates routing rules from natural language descriptions using LLM
 */

import { llmRouter } from './llm/LLMRouter.js';
import { RoutingRule, IRoutingRule } from '../models/RoutingRule.model.js';
import { logger } from '../utils/logger.js';

export interface NLRuleGenerationResult {
  rule: Partial<IRoutingRule>;
  confidence: number;
  explanation: string;
  validationErrors?: string[];
}

class LLMRouterNLService {
  /**
   * Generate routing rule from natural language description
   */
  async generateRuleFromDescription(
    description: string,
    context?: {
      existingRules?: IRoutingRule[];
      currentSettings?: any;
    }
  ): Promise<NLRuleGenerationResult> {
    try {
      const prompt = `You are an expert at creating LLM routing rules. Based on the following natural language description, generate a structured routing rule.

Natural Language Description: "${description}"

${context?.existingRules ? `\nExisting Rules (for reference):\n${JSON.stringify(context.existingRules.slice(0, 3), null, 2)}` : ''}

Generate a routing rule with the following structure:
{
  "name": "Descriptive rule name",
  "priority": number (1-10, higher = evaluated first),
  "enabled": true,
  "description": "Human-readable description",
  "conditions": {
    "agentRoles": ["role1", "role2"] (optional array of agent roles),
    "taskTypes": ["type1", "type2"] (optional array of task types),
    "complexity": ["simple", "moderate", "complex"] (optional array),
    "requestTypes": ["chat", "code-generation", etc.] (optional array),
    "minTokens": number (optional minimum token count),
    "maxTokens": number (optional maximum token count),
    "projectPhases": ["phase1", "phase2"] (optional array)
  },
  "actions": {
    "preferredModel": "model-id" (optional preferred model),
    "blockedModels": ["model-id1", "model-id2"] (optional array),
    "preferredProvider": "provider-name" (optional preferred provider),
    "blockedProviders": ["provider1", "provider2"] (optional array),
    "costLimit": number (optional cost limit per request),
    "maxLatency": number (optional max latency in ms),
    "forceProvider": "provider-name" (optional, forces specific provider),
    "costPreference": "low" | "balanced" | "quality" (optional)
  }
}

Return ONLY valid JSON, no markdown formatting, no code blocks.`;

      const result = await llmRouter.executeWithFallback({
        prompt,
        context: {
          agentRole: 'Router Configuration Agent',
          taskType: 'structured-output',
          systemInstruction: 'You are an expert at creating LLM routing rules. Always return valid JSON.'
        },
        routingContext: {},
        requestType: 'structured-output',
        contextType: 'other'
      });

      // Parse the JSON response
      let ruleData: any;
      try {
        // Try to extract JSON from response (handle markdown code blocks)
        const jsonMatch = result.text.match(/```json\s*([\s\S]*?)\s*```/) || 
                         result.text.match(/```\s*([\s\S]*?)\s*```/) ||
                         [null, result.text];
        ruleData = JSON.parse(jsonMatch[1] || jsonMatch[0] || result.text);
      } catch (parseError) {
        // Try direct parse
        ruleData = JSON.parse(result.text);
      }

      // Validate the rule structure
      const validationErrors = this.validateRule(ruleData);

      // Set defaults
      if (!ruleData.priority) ruleData.priority = 5;
      if (ruleData.enabled === undefined) ruleData.enabled = true;
      if (!ruleData.conditions) ruleData.conditions = {};
      if (!ruleData.actions) ruleData.actions = {};

      // Calculate confidence based on completeness
      let confidence = 0.5;
      if (ruleData.name) confidence += 0.1;
      if (ruleData.conditions && Object.keys(ruleData.conditions).length > 0) confidence += 0.2;
      if (ruleData.actions && Object.keys(ruleData.actions).length > 0) confidence += 0.2;
      if (validationErrors.length === 0) confidence = Math.min(confidence + 0.1, 1);

      return {
        rule: ruleData,
        confidence,
        explanation: `Generated rule "${ruleData.name}" with ${Object.keys(ruleData.conditions || {}).length} conditions and ${Object.keys(ruleData.actions || {}).length} actions`,
        validationErrors: validationErrors.length > 0 ? validationErrors : undefined
      };
    } catch (error: unknown) {
      logger.error('Failed to generate rule from natural language:', error);
      throw new Error(`Failed to generate rule: ${error.message}`);
    }
  }

  /**
   * Validate a routing rule structure
   */
  validateRule(rule: any): string[] {
    const errors: string[] = [];

    if (!rule.name || typeof rule.name !== 'string') {
      errors.push('Rule must have a name (string)');
    }

    if (rule.priority !== undefined && (typeof rule.priority !== 'number' || rule.priority < 1 || rule.priority > 10)) {
      errors.push('Priority must be a number between 1 and 10');
    }

    if (rule.conditions) {
      if (rule.conditions.agentRoles && !Array.isArray(rule.conditions.agentRoles)) {
        errors.push('conditions.agentRoles must be an array');
      }
      if (rule.conditions.taskTypes && !Array.isArray(rule.conditions.taskTypes)) {
        errors.push('conditions.taskTypes must be an array');
      }
      if (rule.conditions.complexity && !Array.isArray(rule.conditions.complexity)) {
        errors.push('conditions.complexity must be an array');
      }
      const validComplexity = ['simple', 'moderate', 'complex'];
      if (rule.conditions.complexity) {
        const invalid = rule.conditions.complexity.filter((c: string) => !validComplexity.includes(c));
        if (invalid.length > 0) {
          errors.push(`Invalid complexity values: ${invalid.join(', ')}`);
        }
      }
    }

    if (rule.actions) {
      if (rule.actions.costPreference && !['low', 'balanced', 'quality'].includes(rule.actions.costPreference)) {
        errors.push('actions.costPreference must be one of: low, balanced, quality');
      }
    }

    return errors;
  }

  /**
   * Explain a routing rule in natural language
   */
  async explainRule(rule: IRoutingRule): Promise<string> {
    try {
      const prompt = `Explain the following LLM routing rule in natural language, making it easy to understand:

Rule: ${JSON.stringify(rule, null, 2)}

Provide a clear, concise explanation of what this rule does, when it applies, and what actions it takes.`;

      const result = await llmRouter.executeWithFallback({
        prompt,
        context: {
          agentRole: 'Router Configuration Agent',
          taskType: 'text-generation',
          systemInstruction: 'You are explaining routing rules in simple, clear language.'
        },
        routingContext: {},
        requestType: 'chat',
        contextType: 'other'
      });

      return result.text;
    } catch (error: unknown) {
      logger.error('Failed to explain rule:', error);
      // Fallback to manual explanation
      return this.generateManualExplanation(rule);
    }
  }

  /**
   * Generate manual explanation as fallback
   */
  private generateManualExplanation(rule: IRoutingRule): string {
    const parts: string[] = [];

    parts.push(`Rule: ${rule.name}`);
    if (rule.description) {
      parts.push(`Description: ${rule.description}`);
    }

    if (rule.conditions) {
      const conditions: string[] = [];
      if (rule.conditions.agentRoles && rule.conditions.agentRoles.length > 0) {
        conditions.push(`for agent roles: ${rule.conditions.agentRoles.join(', ')}`);
      }
      if (rule.conditions.taskTypes && rule.conditions.taskTypes.length > 0) {
        conditions.push(`for task types: ${rule.conditions.taskTypes.join(', ')}`);
      }
      if (rule.conditions.complexity && rule.conditions.complexity.length > 0) {
        conditions.push(`with complexity: ${rule.conditions.complexity.join(', ')}`);
      }
      if (conditions.length > 0) {
        parts.push(`Applies ${conditions.join(', ')}`);
      }
    }

    if (rule.actions) {
      const actions: string[] = [];
      if (rule.actions.preferredModel) {
        actions.push(`prefers model: ${rule.actions.preferredModel}`);
      }
      if (rule.actions.preferredProvider) {
        actions.push(`prefers provider: ${rule.actions.preferredProvider}`);
      }
      if (rule.actions.blockedModels && rule.actions.blockedModels.length > 0) {
        actions.push(`blocks models: ${rule.actions.blockedModels.join(', ')}`);
      }
      if (rule.actions.costPreference) {
        actions.push(`cost preference: ${rule.actions.costPreference}`);
      }
      if (actions.length > 0) {
        parts.push(`Actions: ${actions.join(', ')}`);
      }
    }

    return parts.join('\n');
  }

  /**
   * Suggest improvements to an existing rule based on usage data
   */
  async suggestRuleImprovements(
    rule: IRoutingRule,
    usageData?: {
      totalMatches: number;
      avgCost: number;
      avgLatency: number;
      successRate: number;
    }
  ): Promise<{
    suggestions: string[];
    improvedRule?: Partial<IRoutingRule>;
  }> {
    try {
      const prompt = `Analyze this routing rule and suggest improvements:

Rule: ${JSON.stringify(rule, null, 2)}

${usageData ? `Usage Statistics:
- Total matches: ${usageData.totalMatches}
- Average cost: $${usageData.avgCost.toFixed(4)}
- Average latency: ${usageData.avgLatency.toFixed(0)}ms
- Success rate: ${(usageData.successRate * 100).toFixed(1)}%` : ''}

Suggest specific improvements to make this rule more effective, cost-efficient, or performant. Return a JSON object with:
{
  "suggestions": ["suggestion1", "suggestion2", ...],
  "improvedRule": { ... improved rule structure ... }
}`;

      const result = await llmRouter.executeWithFallback({
        prompt,
        context: {
          agentRole: 'Router Optimization Agent',
          taskType: 'structured-output',
          systemInstruction: 'You are optimizing routing rules for better performance and cost efficiency.'
        },
        routingContext: {},
        requestType: 'structured-output',
        contextType: 'other'
      });

      // Parse JSON response
      let suggestions: any;
      try {
        const jsonMatch = result.text.match(/```json\s*([\s\S]*?)\s*```/) || 
                         result.text.match(/```\s*([\s\S]*?)\s*```/) ||
                         [null, result.text];
        suggestions = JSON.parse(jsonMatch[1] || jsonMatch[0] || result.text);
      } catch (parseError) {
        suggestions = JSON.parse(result.text);
      }

      return {
        suggestions: suggestions.suggestions || [],
        improvedRule: suggestions.improvedRule
      };
    } catch (error: unknown) {
      logger.error('Failed to suggest rule improvements:', error);
      // Return basic suggestions based on rule structure
      return {
        suggestions: [
          'Consider adding more specific conditions to improve rule matching',
          'Review cost preferences to optimize spending',
          'Add fallback models for better reliability'
        ]
      };
    }
  }
}

export const llmRouterNLService = new LLMRouterNLService();




