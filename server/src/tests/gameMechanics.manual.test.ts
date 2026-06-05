/**
 * Game Mechanics Service - Test Examples
 * Manual testing scenarios for validating the mechanics generation
 */

import gameMechanicsService from '../services/gameMechanicsService.js';
import { logger } from '../utils/logger.js';

/**
 * Test cases for manual validation
 * Run with: node --loader ts-node/esm server/src/tests/gameMechanics.manual.test.ts
 */

export const testCases = [
  {
    name: 'Unity 2D Platformer',
    request: {
      gameDescription: '2D platformer',
      targetEngine: 'unity' as const,
      complexity: 'standard' as const,
    },
    expectedFiles: ['PlayerController.cs'],
    expectedMechanics: { movement: true, combat: false },
  },
  {
    name: 'Unity Platformer with Combat',
    request: {
      gameDescription: '2D platformer with enemies and combat',
      targetEngine: 'unity' as const,
    },
    expectedFiles: ['PlayerController.cs', 'CombatSystem.cs'],
    expectedMechanics: { movement: true, combat: true },
  },
  {
    name: 'Godot Platformer',
    request: {
      gameDescription: ' platformer game',
      targetEngine: 'godot' as const,
    },
    expectedFiles: ['player_controller.gd'],
    expectedMechanics: { movement: true, combat: false },
  },
  {
    name: 'Phaser Web Game',
    request: {
      gameDescription: 'web platformer',
      targetEngine: 'phaser' as const,
    },
    expectedFiles: ['PlayerController.js'],
    expectedMechanics: { movement: true, combat: false },
  },
  {
    name: 'Double Jump Customization',
    request: {
      gameDescription: '2D platformer',
      targetEngine: 'unity' as const,
      customization: ['double jump'],
    },
    expectedFiles: ['PlayerController.cs'],
    expectedVariableValue: { MAX_JUMPS: 2 },
  },
];

/**
 * Run a single test case
 */
async function runTest(testCase: (typeof testCases)[0]) {
  try {
    logger.info(`\n=== Testing: ${testCase.name} ===`);

    const result = await gameMechanicsService.generateMechanics(testCase.request);

    // Validate files
    const fileNames = result.files.map(f => f.filename);
    logger.info(`Files generated: ${fileNames.join(', ')}`);

    for (const expectedFile of testCase.expectedFiles) {
      if (!fileNames.includes(expectedFile)) {
        throw new Error(`Expected file ${expectedFile} not found`);
      }
    }

    // Validate mechanics
    if (testCase.expectedMechanics) {
      if (result.mechanics.movement !== testCase.expectedMechanics.movement) {
        throw new Error(`Movement mechanics mismatch`);
      }
      if (result.mechanics.combat !== testCase.expectedMechanics.combat) {
        throw new Error(`Combat mechanics mismatch`);
      }
    }

    // Validate variable values (if specified)
    if (testCase.expectedVariableValue) {
      const firstFile = result.files[0];
      for (const [varName, expectedValue] of Object.entries(testCase.expectedVariableValue)) {
        if (!firstFile.content.includes(String(expectedValue))) {
          logger.warn(`Variable ${varName} may not have expected value ${expectedValue}`);
        }
      }
    }

    logger.info(`✅ Test passed: ${testCase.name}`);
    logger.info(`   Mechanics ID: ${result.mechanicsId}`);
    logger.info(`   Files: ${result.files.length}`);
    logger.info(`   Dependencies: ${result.dependencies.join(', ') || 'none'}`);

    return true;
  } catch (error: any) {
    logger.error(`❌ Test failed: ${testCase.name}`);
    logger.error(`   Error: ${error.message}`);
    return false;
  }
}

/**
 * Run all test cases
 */
export async function runAllTests() {
  logger.info('Starting Game Mechanics Service Tests\n');

  let passed = 0;
  let failed = 0;

  for (const testCase of testCases) {
    const result = await runTest(testCase);
    if (result) {
      passed++;
    } else {
      failed++;
    }
  }

  logger.info(`\n=== Test Results ===`);
  logger.info(`Total: ${testCases.length}`);
  logger.info(`Passed: ${passed}`);
  logger.info(`Failed: ${failed}`);

  return { passed, failed, total: testCases.length };
}

/**
 * Template validation tests
 */
export function validateTemplates() {
  logger.info('\n=== Validating Templates ===');

  const templates = gameMechanicsService.getAvailableTemplates();
  logger.info(`Total templates: ${templates.length}`);

  for (const template of templates) {
    logger.info(`\n Template: ${template.name}`);
    logger.info(`   ID: ${template.id}`);
    logger.info(`   Engine: ${template.engine}`);
    logger.info(`   Category: ${template.category}`);
    logger.info(`   Variables: ${template.variables.map(v => v.name).join(', ')}`);
    logger.info(`   Dependencies: ${template.dependencies.join(', ') || 'none'}`);
    logger.info(`   Code length: ${template.code.length} characters`);
  }

  return templates.length;
}

/**
 * Manual test runner
 * Uncomment to run tests manually:
 *
 * import { runAllTests, validateTemplates } from './tests/gameMechanics.manual.test.js';
 *
 * async function main() {
 *   validateTemplates();
 *   await runAllTests();
 * }
 *
 * main().catch(console.error);
 */

// This file is a MANUAL script (run via node loader), not an automated suite.
// It matches the *.test.ts glob, so we register a skipped placeholder to avoid
// vitest's "No test suite found" error without running the manual scenarios.
import { describe, it } from 'vitest';

describe.skip('Game Mechanics (manual script — not run automatically)', () => {
  it('is exercised manually via runAllTests/validateTemplates', () => {});
});
