/**
 * TaskAnalyzer Unit Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TaskAnalyzer, taskAnalyzer, buildRoutingSignals } from '../TaskAnalyzer.js';
import type { TaskAnalysis, TaskContext } from '../TaskAnalyzer.js';

describe('TaskAnalyzer', () => {
  let analyzer: TaskAnalyzer;

  beforeEach(() => {
    analyzer = new TaskAnalyzer();
  });

  // ─── Task Type Detection ─────────────────────────────────────────────────────

  describe('task type detection', () => {
    it('detects code-generation for "generate" keyword', () => {
      const result = analyzer.analyzeTask('Generate a React component');
      expect(result.taskType).toBe('code-generation');
    });

    it('detects code-generation for "implement" keyword', () => {
      const result = analyzer.analyzeTask('Implement a binary search algorithm');
      expect(result.taskType).toBe('code-generation');
    });

    it('detects code-generation for "code" keyword', () => {
      const result = analyzer.analyzeTask('Write code for a REST API');
      expect(result.taskType).toBe('code-generation');
    });

    it('detects chat type from prompt keyword', () => {
      const result = analyzer.analyzeTask('Start a chat about TypeScript');
      expect(result.taskType).toBe('chat');
    });

    it('detects documentation type from prompt keyword', () => {
      const result = analyzer.analyzeTask('Write documentation for this module');
      expect(result.taskType).toBe('documentation');
    });

    it('detects analysis type from prompt keyword', () => {
      const result = analyzer.analyzeTask('Analyze the performance of this function');
      expect(result.taskType).toBe('analysis');
    });

    it('defaults to conversation when no specific keyword matches', () => {
      const result = analyzer.analyzeTask('Tell me something interesting');
      expect(result.taskType).toBe('conversation');
    });

    it('uses explicitly provided taskType over detection', () => {
      const result = analyzer.analyzeTask('Something about code', 'documentation');
      expect(result.taskType).toBe('documentation');
    });
  });

  // ─── Complexity Estimation ───────────────────────────────────────────────────

  describe('complexity estimation', () => {
    it('returns simple for very short prompt', () => {
      const result = analyzer.analyzeTask('hello');
      expect(result.complexity).toBe('simple');
    });

    it('returns simple for prompts starting with greeting words', () => {
      const result = analyzer.analyzeTask('hi there, how are you?');
      expect(result.complexity).toBe('simple');
    });

    it('returns complex for prompts with architecture keywords (sufficient length)', () => {
      // Needs >= 20 words to bypass the short-prompt 'simple' guard before complex-indicators check
      const result = analyzer.analyzeTask(
        'Please design the overall system architecture for a distributed microservices platform with complex integration patterns and multiple external service dependencies now.'
      );
      expect(result.complexity).toBe('complex');
    });

    it('returns complex for code-generation task type (sufficient prompt length)', () => {
      // Short prompts (< 20 words) are classified simple regardless of task type;
      // use a longer prompt so the task-type check is reached.
      const result = analyzer.analyzeTask(
        'Please write a function that implements binary search for a sorted array of integers and returns the index of the found element or negative one.',
        'code-generation'
      );
      expect(result.complexity).toBe('complex');
    });

    it('returns complex for project-preview task type (sufficient prompt length)', () => {
      const result = analyzer.analyzeTask(
        'Please show me the complete project preview overview including all phases milestones and deliverables for this entire software development initiative.',
        'project-preview'
      );
      expect(result.complexity).toBe('complex');
    });

    it('returns moderate for a medium-length prompt without special indicators', () => {
      // >= 20 words, no complex indicators, not a complex task type
      const prompt =
        'Could you please explain how asynchronous programming works in Node.js and describe the best practices for managing promises effectively in production applications today?';
      const result = analyzer.analyzeTask(prompt);
      expect(result.complexity).toBe('moderate');
    });
  });

  // ─── Latency Requirements ────────────────────────────────────────────────────

  describe('latency requirements', () => {
    it('returns fast for chat task type', () => {
      const result = analyzer.analyzeTask('Hello', 'chat');
      expect(result.latencyRequirement).toBe('fast');
    });

    it('returns fast for conversation task type', () => {
      const result = analyzer.analyzeTask('Hello', 'conversation');
      expect(result.latencyRequirement).toBe('fast');
    });

    it('returns fast for analysis task type', () => {
      const result = analyzer.analyzeTask('Evaluate this data', 'analysis');
      expect(result.latencyRequirement).toBe('fast');
    });

    it('returns real-time when prompt contains "real-time" keyword', () => {
      const result = analyzer.analyzeTask('I need a real-time streaming response');
      expect(result.latencyRequirement).toBe('real-time');
    });

    it('returns real-time for "instant" keyword', () => {
      const result = analyzer.analyzeTask('Provide an instant reply');
      expect(result.latencyRequirement).toBe('real-time');
    });

    it('returns fast for "quick" keyword in prompt', () => {
      const result = analyzer.analyzeTask('Give me a quick summary', 'documentation');
      expect(result.latencyRequirement).toBe('fast');
    });

    it('returns normal for code-generation without speed keywords', () => {
      const result = analyzer.analyzeTask('Implement a linked list', 'code-generation');
      expect(result.latencyRequirement).toBe('normal');
    });
  });

  // ─── Cost Sensitivity ────────────────────────────────────────────────────────

  describe('cost sensitivity', () => {
    it('returns medium when no context is provided', () => {
      const result = analyzer.analyzeTask('Just a regular prompt');
      expect(result.costSensitivity).toBe('medium');
    });

    it('returns high when prompt contains "budget" keyword', () => {
      const result = analyzer.analyzeTask('Use a budget-friendly approach');
      expect(result.costSensitivity).toBe('high');
    });

    it('returns high when prompt asks for "cheap" option', () => {
      const result = analyzer.analyzeTask('Find a cheap solution for this problem');
      expect(result.costSensitivity).toBe('high');
    });

    it('returns low when prompt says "cost is not a concern"', () => {
      const result = analyzer.analyzeTask('Use the best model, cost is not a concern');
      expect(result.costSensitivity).toBe('low');
    });

    it('returns low for Enterprise package', () => {
      const context: TaskContext = { userPackage: 'Enterprise' };
      const result = analyzer.analyzeTask('Run a complex analysis', undefined, context);
      expect(result.costSensitivity).toBe('low');
    });

    it('returns high when budget usage is over 80%', () => {
      const context: TaskContext = {
        projectBudget: 100,
        budgetUsed: 85,
      };
      const result = analyzer.analyzeTask('Analyze this data', undefined, context);
      expect(result.costSensitivity).toBe('high');
    });

    it('returns high when project budget is below $100', () => {
      const context: TaskContext = {
        projectBudget: 50,
        budgetUsed: 10,
      };
      const result = analyzer.analyzeTask('Generate a component', undefined, context);
      expect(result.costSensitivity).toBe('high');
    });
  });

  // ─── Required Capabilities ───────────────────────────────────────────────────

  describe('required capabilities', () => {
    it('includes codeGeneration for code-generation task', () => {
      const result = analyzer.analyzeTask('Write a function', 'code-generation');
      expect(result.requiredCapabilities).toContain('codeGeneration');
    });

    it('includes structuredOutput when output type is structured', () => {
      const result = analyzer.analyzeTask('Respond with valid JSON with fields name and age');
      expect(result.requiredCapabilities).toContain('structuredOutput');
    });

    it('includes fastResponse for chat task type', () => {
      const result = analyzer.analyzeTask('Hello', 'chat');
      expect(result.requiredCapabilities).toContain('fastResponse');
    });

    it('includes longContext for documentation task type', () => {
      const result = analyzer.analyzeTask('Document this module', 'documentation');
      expect(result.requiredCapabilities).toContain('longContext');
    });

    it('includes functionCalling when valid tools with functionDeclarations are provided', () => {
      const tools = [
        { functionDeclarations: [{ name: 'search', parameters: {} }] }
      ];
      const context: TaskContext = { tools };
      const result = analyzer.analyzeTask('Search for something', undefined, context);
      expect(result.requiredCapabilities).toContain('functionCalling');
    });

    it('does NOT include functionCalling for empty tools array', () => {
      const context: TaskContext = { tools: [] };
      const result = analyzer.analyzeTask('A prompt', undefined, context);
      expect(result.requiredCapabilities).not.toContain('functionCalling');
    });

    it('includes reasoning capability when prompt contains "step by step"', () => {
      const result = analyzer.analyzeTask('Solve this step by step');
      expect(result.requiredCapabilities).toContain('reasoning');
    });
  });

  // ─── Output Type ─────────────────────────────────────────────────────────────

  describe('output type determination', () => {
    it('returns code output type for code-generation tasks', () => {
      const result = analyzer.analyzeTask('Write a function', 'code-generation');
      expect(result.outputType).toBe('code');
    });

    it('returns structured for project-preview tasks', () => {
      const result = analyzer.analyzeTask('Show me the project preview', 'project-preview');
      expect(result.outputType).toBe('structured');
    });

    it('returns structured when prompt includes "json format"', () => {
      const result = analyzer.analyzeTask('Return the data in json format');
      expect(result.outputType).toBe('structured');
    });

    it('returns diagram for mermaid-related prompts', () => {
      const result = analyzer.analyzeTask('Create a mermaid diagram for this flow');
      expect(result.outputType).toBe('diagram');
    });

    it('returns text for general conversation', () => {
      const result = analyzer.analyzeTask('Tell me a story', 'conversation');
      expect(result.outputType).toBe('text');
    });
  });

  // ─── Priority Calculation ────────────────────────────────────────────────────

  describe('priority calculation', () => {
    it('returns priority 1 for simple tasks', () => {
      const result = analyzer.analyzeTask('hi');
      expect(result.priority).toBe(1);
    });

    it('returns priority 3 for complex tasks', () => {
      // Needs >= 20 words to avoid simple check; includes 'architecture' for complex indicator
      const result = analyzer.analyzeTask(
        'Please design the overall system architecture for a distributed microservices platform with complex integration patterns and multiple external service dependencies.',
        'code-generation'
      );
      expect(result.priority).toBe(3);
    });

    it('boosts priority for Orchestrator agent role', () => {
      const context: TaskContext = { agentRole: 'Orchestrator' };
      const result = analyzer.analyzeTask('hi', undefined, context);
      expect(result.priority).toBeGreaterThanOrEqual(2);
    });
  });

  // ─── Exported singleton ──────────────────────────────────────────────────────

  describe('exported taskAnalyzer singleton', () => {
    it('is an instance of TaskAnalyzer', () => {
      expect(taskAnalyzer).toBeInstanceOf(TaskAnalyzer);
    });

    it('analyzeTask returns a well-formed TaskAnalysis object', () => {
      const result = taskAnalyzer.analyzeTask('Hello world');
      expect(result).toHaveProperty('taskType');
      expect(result).toHaveProperty('complexity');
      expect(result).toHaveProperty('domain');
      expect(result).toHaveProperty('outputType');
      expect(result).toHaveProperty('latencyRequirement');
      expect(result).toHaveProperty('costSensitivity');
      expect(result).toHaveProperty('estimatedTokens');
      expect(result).toHaveProperty('requiredCapabilities');
      expect(result).toHaveProperty('priority');
    });
  });

  // ─── buildRoutingSignals ─────────────────────────────────────────────────────

  describe('buildRoutingSignals', () => {
    const baseTask: TaskAnalysis = {
      taskType: 'chat',
      complexity: 'moderate',
      domain: 'conversation',
      outputType: 'text',
      latencyRequirement: 'fast',
      costSensitivity: 'medium',
      estimatedTokens: 200,
      requiredCapabilities: [],
      priority: 2,
    };

    it('returns costPressure 0.9 for high cost sensitivity', () => {
      const task = { ...baseTask, costSensitivity: 'high' as const };
      const signals = buildRoutingSignals(task);
      expect(signals.costPressure).toBe(0.9);
    });

    it('returns costPressure 0.1 for low cost sensitivity', () => {
      const task = { ...baseTask, costSensitivity: 'low' as const };
      const signals = buildRoutingSignals(task);
      expect(signals.costPressure).toBe(0.1);
    });

    it('returns qualityNeed 0.9 for complex tasks', () => {
      const task = { ...baseTask, complexity: 'complex' as const };
      const signals = buildRoutingSignals(task);
      expect(signals.qualityNeed).toBe(0.9);
    });

    it('returns latencyTarget 500ms for real-time tasks', () => {
      const task = { ...baseTask, latencyRequirement: 'real-time' as const };
      const signals = buildRoutingSignals(task);
      expect(signals.latencyTarget).toBe(500);
    });

    it('returns latencyTarget 1000ms for fast tasks', () => {
      const task = { ...baseTask, latencyRequirement: 'fast' as const };
      const signals = buildRoutingSignals(task);
      expect(signals.latencyTarget).toBe(1000);
    });

    it('increases costPressure when budget usage ratio > 80%', () => {
      const routingContext = {
        packageLimits: { maxMonthlyBudget: 100 },
        projectState: { currentPhase: 'dev', budgetUsed: 85, tokensUsed: 0 },
      };
      const signals = buildRoutingSignals(baseTask, routingContext);
      expect(signals.costPressure).toBeGreaterThanOrEqual(0.9);
    });

    it('sets agentRolePriority 1.5 for Orchestrator role', () => {
      const task = { ...baseTask, agentRole: 'Orchestrator' };
      const signals = buildRoutingSignals(task);
      expect(signals.agentRolePriority).toBe(1.5);
    });
  });
});
