import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Golden-set regression test for the evaluation harness (dim: evaluation -> scope 5).
 *
 * Pins the CONTRACT of EvaluationService.evaluateTaskOutput so that future changes
 * cannot silently regress its behavior. The LLM judge is fully mocked: NO real LLM
 * calls are made. Each test feeds a controlled structured output (or forces an error)
 * and asserts the deterministic transformation the service applies.
 *
 * Covered contract:
 *  (a) score is clamped to the 0-100 range
 *  (b) fails CLOSED to score 0 when the judge throws
 *  (c) returns score 50 (without calling the judge) for too-short output
 *  (d) preserves / forwards the judge's criteria
 *  (e) enhances reasoning with strengths/weaknesses (and other arrays) when present
 *  + Task 1: judge model is configurable via EVAL_JUDGE_MODEL (default gemini-2.5-flash)
 */

// Mock the real judge target. Hoisted so the mock fn is available to vi.mock factory.
const { generateStructuredOutput } = vi.hoisted(() => ({
  generateStructuredOutput: vi.fn(),
}));

vi.mock('../gemini.service.js', () => ({
  geminiService: { generateStructuredOutput },
}));

// Defensive: importing evaluation.service pulls in the LLM router at module load.
// Stub it so provider import-time side effects don't break/hang the test.
vi.mock('../llm/LLMRouter.js', () => ({
  llmRouter: { route: vi.fn(), generateStructuredOutput: vi.fn() },
}));

vi.mock('../utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { evaluationService } from '../evaluation.service.js';
import type { EvaluationContext } from '../evaluation.service.js';

// A valid, substantial output (> 50 chars) so the too-short guard does not trigger.
const SUBSTANTIAL_OUTPUT =
  'This is a sufficiently long output produced by the agent under test, with enough content to be evaluated meaningfully by the judge.';

function makeContext(overrides: Partial<EvaluationContext> = {}): EvaluationContext {
  return {
    taskTitle: 'Implement feature X',
    taskDescription: 'Build the X module per spec',
    agentRole: 'Backend Engineer Agent',
    output: SUBSTANTIAL_OUTPUT,
    standards: ['OWASP'],
    projectContext: 'OrbitAI harness',
    ...overrides,
  };
}

const ORIGINAL_ENV = process.env.EVAL_JUDGE_MODEL;

beforeEach(() => {
  generateStructuredOutput.mockReset();
});

afterEach(() => {
  if (ORIGINAL_ENV === undefined) {
    delete process.env.EVAL_JUDGE_MODEL;
  } else {
    process.env.EVAL_JUDGE_MODEL = ORIGINAL_ENV;
  }
});

describe('evaluateTaskOutput contract (golden set, evaluation dim -> scope 5)', () => {
  // (a) clamp score to 0-100
  it('clamps an over-range judge score down to 100', async () => {
    generateStructuredOutput.mockResolvedValue({
      score: 150,
      reasoning: 'Outstanding.',
      criteria: ['Completeness'],
    });

    const result = await evaluationService.evaluateTaskOutput(makeContext());

    expect(result.score).toBe(100);
  });

  it('clamps a negative judge score up to 0', async () => {
    // NOTE: -10 is truthy so it survives `result.score || 50` and reaches the clamp.
    // (A literal 0 would be coerced to 50 by that falsy-default, so it is not used here.)
    generateStructuredOutput.mockResolvedValue({
      score: -10,
      reasoning: 'Very poor.',
      criteria: ['Accuracy'],
    });

    const result = await evaluationService.evaluateTaskOutput(makeContext());

    expect(result.score).toBe(0);
  });

  it('rounds and passes through an in-range score', async () => {
    generateStructuredOutput.mockResolvedValue({
      score: 87.6,
      reasoning: 'Good.',
      criteria: ['Quality'],
    });

    const result = await evaluationService.evaluateTaskOutput(makeContext());

    expect(result.score).toBe(88);
  });

  // (b) fail closed to 0 on judge error
  it('fails CLOSED with score 0 when the judge throws', async () => {
    generateStructuredOutput.mockRejectedValue(new Error('judge unavailable'));

    const result = await evaluationService.evaluateTaskOutput(makeContext());

    expect(result.score).toBe(0);
    expect(result.criteria).toEqual(['Evaluation Error']);
    expect(result.reasoning).toContain('judge unavailable');
    expect(result.reasoning.toLowerCase()).toContain('withheld');
  });

  // (c) too-short output returns 50 WITHOUT calling the judge
  it('returns 50 for too-short output and never invokes the judge', async () => {
    const result = await evaluationService.evaluateTaskOutput(makeContext({ output: 'too short' }));

    expect(result.score).toBe(50);
    expect(result.criteria).toEqual(['Output Length']);
    expect(generateStructuredOutput).not.toHaveBeenCalled();
  });

  it('treats empty output as too-short (returns 50, no judge call)', async () => {
    const result = await evaluationService.evaluateTaskOutput(makeContext({ output: '' }));

    expect(result.score).toBe(50);
    expect(generateStructuredOutput).not.toHaveBeenCalled();
  });

  // (d) preserve / forward criteria
  it('preserves the judge-provided criteria verbatim', async () => {
    const criteria = ['Completeness', 'Security', 'Standards Compliance'];
    generateStructuredOutput.mockResolvedValue({
      score: 75,
      reasoning: 'Solid.',
      criteria,
    });

    const result = await evaluationService.evaluateTaskOutput(makeContext());

    expect(result.criteria).toEqual(criteria);
  });

  it('falls back to default criteria when the judge omits them', async () => {
    generateStructuredOutput.mockResolvedValue({
      score: 70,
      reasoning: 'No criteria returned.',
      criteria: [],
    });

    const result = await evaluationService.evaluateTaskOutput(makeContext());

    expect(result.criteria).toEqual(['Completeness', 'Accuracy', 'Relevance', 'Quality']);
  });

  // (e) enhance reasoning with strengths/weaknesses (and other arrays) when present
  it('enhances reasoning with strengths and weaknesses when present', async () => {
    generateStructuredOutput.mockResolvedValue({
      score: 80,
      reasoning: 'Base reasoning.',
      criteria: ['Quality'],
      strengths: ['Clear structure', 'Good test coverage'],
      weaknesses: ['Missing error handling'],
    });

    const result = await evaluationService.evaluateTaskOutput(makeContext());

    expect(result.reasoning).toContain('Base reasoning.');
    expect(result.reasoning).toContain('**Strengths:**');
    expect(result.reasoning).toContain('Clear structure');
    expect(result.reasoning).toContain('Good test coverage');
    expect(result.reasoning).toContain('**Areas for Improvement:**');
    expect(result.reasoning).toContain('Missing error handling');
  });

  it('appends refinement suggestions and process improvements when present', async () => {
    generateStructuredOutput.mockResolvedValue({
      score: 65,
      reasoning: 'Base.',
      criteria: ['Completeness'],
      refinementSuggestions: ['Add input validation'],
      processImprovements: ['Adopt TDD earlier'],
    });

    const result = await evaluationService.evaluateTaskOutput(makeContext());

    expect(result.reasoning).toContain('Refinement Suggestions for Backend Engineer Agent');
    expect(result.reasoning).toContain('Add input validation');
    expect(result.reasoning).toContain('Process Improvement Insights');
    expect(result.reasoning).toContain('Adopt TDD earlier');
  });

  it('does not append optional sections when arrays are absent', async () => {
    generateStructuredOutput.mockResolvedValue({
      score: 90,
      reasoning: 'Just reasoning.',
      criteria: ['Quality'],
    });

    const result = await evaluationService.evaluateTaskOutput(makeContext());

    expect(result.reasoning).toBe('Just reasoning.');
    expect(result.reasoning).not.toContain('**Strengths:**');
  });
});

describe('judge-family configuration (EVAL_JUDGE_MODEL, Task 1)', () => {
  it('defaults the judge model to gemini-2.5-flash when EVAL_JUDGE_MODEL is unset', async () => {
    delete process.env.EVAL_JUDGE_MODEL;
    generateStructuredOutput.mockResolvedValue({
      score: 70,
      reasoning: 'ok',
      criteria: ['Quality'],
    });

    await evaluationService.evaluateTaskOutput(makeContext());

    expect(generateStructuredOutput).toHaveBeenCalledTimes(1);
    const [, , modelArg] = generateStructuredOutput.mock.calls[0];
    expect(modelArg).toBe('gemini-2.5-flash');
  });

  it('uses EVAL_JUDGE_MODEL as the judge model when set (judge-family diversity)', async () => {
    process.env.EVAL_JUDGE_MODEL = 'gpt-4o-mini';
    generateStructuredOutput.mockResolvedValue({
      score: 70,
      reasoning: 'ok',
      criteria: ['Quality'],
    });

    await evaluationService.evaluateTaskOutput(makeContext());

    const [, , modelArg] = generateStructuredOutput.mock.calls[0];
    expect(modelArg).toBe('gpt-4o-mini');
  });
});
