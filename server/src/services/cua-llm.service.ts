/**
 * CUA LLM Service
 * Provides LLM-enhanced capabilities for CUA test execution
 * Uses Gemini Vision for screenshot analysis and intelligent element detection
 *
 * @module services/cua-llm
 */

import { Schema, Type } from '@google/genai';
import { geminiService } from './gemini.service.js';
import { logger } from '../utils/logger.js';

/**
 * Element detected via LLM vision analysis
 */
export interface DetectedElement {
  type: 'button' | 'input' | 'link' | 'dropdown' | 'checkbox' | 'radio' | 'slider' | 'other';
  label: string;
  description: string;
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  confidence: number;
  suggestedAction: string;
  suggestedSelector?: string;
}

/**
 * Test execution decision from LLM
 */
export interface LLMExecutionDecision {
  action: 'click' | 'type' | 'scroll' | 'hover' | 'wait' | 'done';
  target?: string;
  value?: string;
  reasoning: string;
  confidence: number;
}

/**
 * Failure analysis result
 */
export interface FailureAnalysis {
  cause: string;
  suggestion: string;
  severity: 'minor' | 'moderate' | 'critical';
  isRetryable: boolean;
}

/**
 * CUA LLM Service class
 * Provides vision-based analysis and intelligent test execution
 */
class CUALLMService {
  private readonly MODEL = 'gemini-2.0-flash';

  /**
   * Analyze a screenshot to detect interactive UI elements
   */
  async analyzeScreenshot(screenshotBase64: string): Promise<DetectedElement[]> {
    const prompt = `You are a UI testing expert analyzing a screenshot.
        
Analyze this screenshot and identify ALL interactive elements visible on the page.
For each element, provide:
1. Type (button, input, link, dropdown, checkbox, radio, slider, or other)
2. Label (visible text or aria-label)
3. Description (what it appears to do)
4. Approximate position (estimate x, y as percentages of screen)
5. Suggested test action

Focus on:
- Buttons and clickable elements  
- Form inputs and text fields
- Navigation links
- Interactive controls

Return a JSON array of detected elements.`;

    try {
      const schema: Schema = {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            type: {
              type: Type.STRING,
              enum: ['button', 'input', 'link', 'dropdown', 'checkbox', 'radio', 'slider', 'other'],
            },
            label: { type: Type.STRING },
            description: { type: Type.STRING },
            boundingBox: {
              type: Type.OBJECT,
              properties: {
                x: { type: Type.NUMBER },
                y: { type: Type.NUMBER },
                width: { type: Type.NUMBER },
                height: { type: Type.NUMBER },
              },
            },
            confidence: { type: Type.NUMBER },
            suggestedAction: { type: Type.STRING },
            suggestedSelector: { type: Type.STRING },
          },
          required: ['type', 'label', 'description', 'confidence', 'suggestedAction'],
        },
      };

      // Use vision-capable content format
      const visionPrompt = [
        { text: prompt },
        {
          inlineData: {
            mimeType: 'image/jpeg',
            data: screenshotBase64.replace(/^data:image\/\w+;base64,/, ''),
          },
        },
      ];

      const result = await geminiService.generateStructuredOutput(
        JSON.stringify(visionPrompt),
        schema,
        this.MODEL
      );

      logger.info(`[CUA-LLM] Detected ${result?.length || 0} elements from screenshot`);
      return result || [];
    } catch (error: unknown) {
      logger.error('[CUA-LLM] Screenshot analysis failed:', error);
      return [];
    }
  }

  /**
   * Get next action decision based on current screenshot and test goal
   */
  async getNextAction(
    screenshotBase64: string,
    testGoal: string,
    previousActions: string[] = []
  ): Promise<LLMExecutionDecision> {
    const actionsHistory =
      previousActions.length > 0
        ? `\n\nPrevious actions taken:\n${previousActions.map((a, i) => `${i + 1}. ${a}`).join('\n')}`
        : '';

    const prompt = `You are an AI agent performing automated UI testing.

TEST GOAL: ${testGoal}
${actionsHistory}

Analyze the current screenshot and decide the NEXT action to take.
Consider:
- What is visible on screen
- What actions have already been taken
- What needs to be done to complete the test goal

If the test goal appears complete, return action "done".

Provide your reasoning and confidence (0-1).`;

    try {
      const schema: Schema = {
        type: Type.OBJECT,
        properties: {
          action: {
            type: Type.STRING,
            enum: ['click', 'type', 'scroll', 'hover', 'wait', 'done'],
          },
          target: { type: Type.STRING },
          value: { type: Type.STRING },
          reasoning: { type: Type.STRING },
          confidence: { type: Type.NUMBER },
        },
        required: ['action', 'reasoning', 'confidence'],
      };

      // Vision content
      const visionPrompt = [
        { text: prompt },
        {
          inlineData: {
            mimeType: 'image/jpeg',
            data: screenshotBase64.replace(/^data:image\/\w+;base64,/, ''),
          },
        },
      ];

      const result = await geminiService.generateStructuredOutput(
        JSON.stringify(visionPrompt),
        schema,
        this.MODEL
      );

      logger.info(`[CUA-LLM] Next action: ${result?.action} (confidence: ${result?.confidence})`);
      return (
        result || { action: 'done', reasoning: 'Unable to determine next action', confidence: 0 }
      );
    } catch (error: unknown) {
      logger.error('[CUA-LLM] Action decision failed:', error);
      return { action: 'done', reasoning: 'LLM analysis failed', confidence: 0 };
    }
  }

  /**
   * Analyze why a test action failed
   */
  async analyzeFailure(
    screenshotBase64: string,
    action: string,
    error: string
  ): Promise<FailureAnalysis> {
    const prompt = `You are analyzing a UI test failure.

ACTION ATTEMPTED: ${action}
ERROR MESSAGE: ${error}

Analyze the screenshot and determine:
1. Why the action failed
2. What could be done to fix it
3. How severe this failure is
4. Whether the action could succeed on retry

Be specific about the cause based on what you see.`;

    try {
      const schema: Schema = {
        type: Type.OBJECT,
        properties: {
          cause: { type: Type.STRING },
          suggestion: { type: Type.STRING },
          severity: {
            type: Type.STRING,
            enum: ['minor', 'moderate', 'critical'],
          },
          isRetryable: { type: Type.BOOLEAN },
        },
        required: ['cause', 'suggestion', 'severity', 'isRetryable'],
      };

      const visionPrompt = [
        { text: prompt },
        {
          inlineData: {
            mimeType: 'image/jpeg',
            data: screenshotBase64.replace(/^data:image\/\w+;base64,/, ''),
          },
        },
      ];

      const result = await geminiService.generateStructuredOutput(
        JSON.stringify(visionPrompt),
        schema,
        this.MODEL
      );

      logger.info(`[CUA-LLM] Failure analysis: ${result?.cause} (severity: ${result?.severity})`);
      return (
        result || {
          cause: 'Unknown failure',
          suggestion: 'Check element selectors',
          severity: 'moderate',
          isRetryable: true,
        }
      );
    } catch (error: unknown) {
      logger.error('[CUA-LLM] Failure analysis failed:', error);
      return {
        cause: 'Analysis failed',
        suggestion: 'Manual investigation required',
        severity: 'moderate',
        isRetryable: false,
      };
    }
  }

  /**
   * Generate test summary with AI analysis
   */
  async generateTestSummary(
    screenshotBase64: string,
    results: { scenario: string; passed: boolean; error?: string }[]
  ): Promise<string> {
    const passedCount = results.filter(r => r.passed).length;
    const failedCount = results.length - passedCount;

    const resultsText = results
      .map((r, i) => `${i + 1}. ${r.scenario}: ${r.passed ? '✓ PASSED' : `✗ FAILED - ${r.error}`}`)
      .join('\n');

    const prompt = `You are a QA analyst summarizing automated test results.

TEST RESULTS:
${resultsText}

PASSED: ${passedCount}/${results.length}
FAILED: ${failedCount}/${results.length}

Analyze the final screenshot and the test results to provide a concise summary.
Include:
1. Overall status assessment
2. Key issues found (if any)
3. Recommendations for the prototype

Keep it brief but insightful.`;

    try {
      const visionPrompt = [
        { text: prompt },
        {
          inlineData: {
            mimeType: 'image/jpeg',
            data: screenshotBase64.replace(/^data:image\/\w+;base64,/, ''),
          },
        },
      ];

      const result = await geminiService.generateContent(JSON.stringify(visionPrompt), this.MODEL, {
        temperature: 0.3,
      });

      return result.text || `Test completed: ${passedCount}/${results.length} passed`;
    } catch (error: unknown) {
      logger.error('[CUA-LLM] Summary generation failed:', error);
      return `Test completed: ${passedCount}/${results.length} passed, ${failedCount} failed`;
    }
  }

  /**
   * Find element selector using LLM vision
   */
  async findElementSelector(
    screenshotBase64: string,
    elementDescription: string
  ): Promise<{ selector: string | null; confidence: number; alternatives: string[] }> {
    const prompt = `You are helping find a CSS selector for a UI element.

TARGET ELEMENT: "${elementDescription}"

Look at the screenshot and suggest the most likely CSS selector for this element.
Consider:
- ID attributes (e.g., #submit-button)
- Class names (e.g., .btn-primary)
- Role/ARIA attributes (e.g., [role="button"])
- Text content selectors (e.g., button:has-text("Submit"))

Also provide alternative selectors if the primary one might not work.`;

    try {
      const schema: Schema = {
        type: Type.OBJECT,
        properties: {
          selector: { type: Type.STRING },
          confidence: { type: Type.NUMBER },
          alternatives: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
        },
        required: ['selector', 'confidence', 'alternatives'],
      };

      const visionPrompt = [
        { text: prompt },
        {
          inlineData: {
            mimeType: 'image/jpeg',
            data: screenshotBase64.replace(/^data:image\/\w+;base64,/, ''),
          },
        },
      ];

      const result = await geminiService.generateStructuredOutput(
        JSON.stringify(visionPrompt),
        schema,
        this.MODEL
      );

      return result || { selector: null, confidence: 0, alternatives: [] };
    } catch (error: unknown) {
      logger.error('[CUA-LLM] Selector finding failed:', error);
      return { selector: null, confidence: 0, alternatives: [] };
    }
  }

  /**
   * Generate code fix for failing test
   * Analyzes the failure and generates HTML/JS patches to fix the issue
   */
  async generatePrototypeFix(
    originalHtml: string,
    failedTests: { scenario: string; error: string; selector?: string }[],
    screenshotBase64?: string
  ): Promise<{
    success: boolean;
    fixedHtml: string;
    changes: { description: string; type: 'add' | 'modify' | 'remove' }[];
    explanation: string;
  }> {
    const failureDetails = failedTests
      .map(
        (t, i) =>
          `${i + 1}. ${t.scenario}\n   Error: ${t.error}\n   Selector: ${t.selector || 'N/A'}`
      )
      .join('\n\n');

    const prompt = `You are an expert web developer fixing a prototype based on failed automated tests.

FAILED TESTS:
${failureDetails}

ORIGINAL HTML:
\`\`\`html
${originalHtml.substring(0, 15000)}${originalHtml.length > 15000 ? '\n... (truncated)' : ''}
\`\`\`

Analyze the failures and fix the HTML code. Common issues include:
1. Missing elements that tests expect (add buttons, inputs)
2. Incorrect selectors (update IDs, classes)
3. Missing event handlers (add onclick, keydown listeners)
4. Game logic not responding to inputs (add keyboard controls)
5. Elements not visible or interactive

For game prototypes:
- Ensure keyboard controls are properly bound (arrow keys, WASD, space)
- Make sure game starts when Start button is clicked
- Add visible feedback for actions

Provide the COMPLETE fixed HTML code with all corrections applied.`;

    try {
      const schema = {
        type: 'object' as const,
        properties: {
          fixedHtml: { type: 'string' as const },
          changes: {
            type: 'array' as const,
            items: {
              type: 'object' as const,
              properties: {
                description: { type: 'string' as const },
                type: { type: 'string' as const, enum: ['add', 'modify', 'remove'] as const },
              },
              required: ['description', 'type'] as const,
            },
          },
          explanation: { type: 'string' as const },
        },
        required: ['fixedHtml', 'changes', 'explanation'] as const,
      };

      // Build prompt with optional screenshot
      let fullPrompt = prompt;
      if (screenshotBase64) {
        fullPrompt = JSON.stringify([
          { text: prompt },
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: screenshotBase64.replace(/^data:image\/\w+;base64,/, ''),
            },
          },
        ]);
      }

      const result = await geminiService.generateStructuredOutput(
        fullPrompt,
        schema as any,
        this.MODEL,
        { temperature: 0.2 } as any
      );

      if (result?.fixedHtml) {
        logger.info(`[CUA-LLM] Generated fix with ${result.changes?.length || 0} changes`);
        return {
          success: true,
          fixedHtml: result.fixedHtml,
          changes: result.changes || [],
          explanation: result.explanation || 'Fix applied',
        };
      }

      return {
        success: false,
        fixedHtml: originalHtml,
        changes: [],
        explanation: 'Unable to generate fix',
      };
    } catch (error: unknown) {
      logger.error('[CUA-LLM] Fix generation failed:', error);
      return {
        success: false,
        fixedHtml: originalHtml,
        changes: [],
        explanation: `Error: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * Analyze test results and determine if auto-fix is possible
   */
  async canAutoFix(
    failedTests: { scenario: string; error: string }[]
  ): Promise<{ canFix: boolean; confidence: number; reason: string }> {
    // Analyze failure types to determine if they're fixable
    const fixablePatterns = [
      { pattern: /element not found/i, type: 'missing_element', fixable: true },
      { pattern: /selector/i, type: 'selector_issue', fixable: true },
      { pattern: /no observable effect/i, type: 'no_response', fixable: true },
      { pattern: /timeout/i, type: 'timeout', fixable: false },
      { pattern: /network/i, type: 'network', fixable: false },
    ];

    let fixableCount = 0;
    const reasons: string[] = [];

    for (const test of failedTests) {
      let matched = false;
      for (const { pattern, type, fixable } of fixablePatterns) {
        if (pattern.test(test.error)) {
          matched = true;
          if (fixable) {
            fixableCount++;
            reasons.push(`${test.scenario}: ${type} (fixable)`);
          } else {
            reasons.push(`${test.scenario}: ${type} (not auto-fixable)`);
          }
          break;
        }
      }
      if (!matched) {
        // Unknown error type - assume fixable with low confidence
        fixableCount += 0.5;
        reasons.push(`${test.scenario}: unknown issue`);
      }
    }

    const confidence = failedTests.length > 0 ? fixableCount / failedTests.length : 0;

    return {
      canFix: confidence >= 0.5,
      confidence,
      reason: reasons.join('; '),
    };
  }
}

// Export singleton instance
export const cuaLLMService = new CUALLMService();
