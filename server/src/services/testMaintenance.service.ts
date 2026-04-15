/**
 * Test Maintenance Service
 * Auto-updates tests when code changes
 */

import { logger } from '../utils/logger.js';
import { Artifact, IArtifact } from '../models/Artifact.model.js';
import { llmRouter } from './llm/LLMRouter.js';
// import { Type, Schema } from '@google/genai';

export interface TestUpdate {
  testId: string;
  testName: string;
  updateType: 'modified' | 'added' | 'removed' | 'refactored';
  oldCode?: string;
  newCode: string;
  reason: string;
  confidence: number; // 0-100
}

export interface TestMaintenanceReport {
  projectId: string;
  codeChanges: number;
  testsUpdated: number;
  testsAdded: number;
  testsRemoved: number;
  coverageMaintained: boolean;
  updates: TestUpdate[];
  generatedAt: Date;
}

class TestMaintenanceService {
  /**
   * Maintain tests when code changes
   */
  async maintainTests(
    projectId: string,
    codeArtifactId: string,
    previousCode?: string
  ): Promise<TestMaintenanceReport> {
    try {
      logger.info(`Maintaining tests for code artifact ${codeArtifactId}`);

      const codeArtifact = await Artifact.findOne({ _id: codeArtifactId, projectId });
      if (!codeArtifact) {
        throw new Error('Code artifact not found');
      }

      // Get test artifacts
      const testArtifacts = await Artifact.find({
        projectId,
        type: 'test-plan'
      }).lean() as any;

      if (testArtifacts.length === 0) {
        return {
          projectId,
          codeChanges: 0,
          testsUpdated: 0,
          testsAdded: 0,
          testsRemoved: 0,
          coverageMaintained: true,
          updates: [],
          generatedAt: new Date()
        };
      }

      // Detect code changes
      const codeChanges = previousCode
        ? this.detectCodeChanges(previousCode, codeArtifact.content)
        : { added: [], modified: [], removed: [] };

      const updates: TestUpdate[] = [];

      // Update existing tests
      for (const testArtifact of testArtifacts) {
        const update = await this.updateTestForCodeChanges(
          testArtifact,
          codeArtifact,
          codeChanges
        );
        if (update) {
          updates.push(update);
          
          // Apply update
          if (update.updateType !== 'removed') {
            testArtifact.content = update.newCode;
            await testArtifact.save();
          }
        }
      }

      // Generate new tests for new code
      const newTests = await this.generateTestsForNewCode(
        codeArtifact,
        codeChanges.added
      );

      for (const newTest of newTests) {
        // Create new test artifact
        const testArtifact = new Artifact({
          title: `Test: ${newTest.testName}`,
          content: newTest.newCode,
          type: 'test-plan',
          projectId: codeArtifact.projectId,
          userId: codeArtifact.userId,
          createdBy: 'Test Maintenance Agent',
          traceRefs: [codeArtifact._id]
        });

        await testArtifact.save();

        updates.push({
          testId: testArtifact._id.toString(),
          testName: newTest.testName,
          updateType: 'added',
          newCode: newTest.newCode,
          reason: 'New code detected, test generated',
          confidence: 80
        });
      }

      return {
        projectId,
        codeChanges: codeChanges.added.length + codeChanges.modified.length + codeChanges.removed.length,
        testsUpdated: updates.filter(u => u.updateType === 'modified').length,
        testsAdded: updates.filter(u => u.updateType === 'added').length,
        testsRemoved: updates.filter(u => u.updateType === 'removed').length,
        coverageMaintained: updates.length > 0,
        updates,
        generatedAt: new Date()
      };
    } catch (error: unknown) {
      logger.error('Failed to maintain tests:', error);
      throw error;
    }
  }

  /**
   * Detect code changes
   */
  private detectCodeChanges(
    oldCode: string,
    newCode: string
  ): { added: string[]; modified: string[]; removed: string[] } {
    const oldLines = oldCode.split('\n');
    const newLines = newCode.split('\n');

    // Simple diff (can be enhanced with proper diff algorithm)
    const added: string[] = [];
    const modified: string[] = [];
    const removed: string[] = [];

    const oldSet = new Set(oldLines.map(l => l.trim()));
    const newSet = new Set(newLines.map(l => l.trim()));

    for (const line of newLines) {
      const trimmed = line.trim();
      if (trimmed && !oldSet.has(trimmed)) {
        if (trimmed.match(/(?:function|const|let|var|class)\s+\w+/)) {
          added.push(trimmed);
        }
      }
    }

    for (const line of oldLines) {
      const trimmed = line.trim();
      if (trimmed && !newSet.has(trimmed)) {
        if (trimmed.match(/(?:function|const|let|var|class)\s+\w+/)) {
          removed.push(trimmed);
        }
      }
    }

    // Modified: lines that changed
    const maxLen = Math.max(oldLines.length, newLines.length);
    for (let i = 0; i < maxLen; i++) {
      if (oldLines[i] && newLines[i] && oldLines[i].trim() !== newLines[i].trim()) {
        if (oldLines[i].trim().match(/(?:function|const|let|var|class)\s+\w+/)) {
          modified.push(newLines[i].trim());
        }
      }
    }

    return { added, modified, removed };
  }

  /**
   * Update test for code changes
   */
  private async updateTestForCodeChanges(
    testArtifact: IArtifact,
    codeArtifact: IArtifact,
    _codeChanges: { added: string[]; modified: string[]; removed: string[] }
  ): Promise<TestUpdate | null> {
    // Check if test needs updates based on code changes
    const testContent = testArtifact.content || '';
    const codeContent = codeArtifact.content || '';

    // Check if tested functions were modified or removed
    const testedFunctions = this.extractTestedFunctions(testContent);
    const codeFunctions = this.extractFunctions(codeContent);

    let needsUpdate = false;
    let updateType: TestUpdate['updateType'] = 'modified';
    let reason = '';

    // Check for removed functions
    for (const func of testedFunctions) {
      if (!codeFunctions.includes(func)) {
        needsUpdate = true;
        updateType = 'removed';
        reason = `Function ${func} was removed from code`;
        break;
      }
    }

    // Check for modified functions
    if (!needsUpdate) {
      for (const func of testedFunctions) {
        if (codeFunctions.includes(func)) {
          // Function still exists, but might be modified
          const oldFuncCode = this.extractFunctionCode(codeContent, func);
          // Simple check: if function signature or body changed significantly
          if (oldFuncCode && oldFuncCode.length > 100) {
            needsUpdate = true;
            updateType = 'modified';
            reason = `Function ${func} was modified`;
            break;
          }
        }
      }
    }

    if (!needsUpdate) {
      return null;
    }

    // Generate updated test
    const updatedTest = await this.generateUpdatedTest(
      testContent,
      codeContent,
      updateType,
      reason
    );

    return {
      testId: testArtifact._id.toString(),
      testName: testArtifact.title,
      updateType,
      oldCode: updateType === 'removed' ? testContent : undefined,
      newCode: updatedTest,
      reason,
      confidence: 85
    };
  }

  /**
   * Extract tested functions from test code
   */
  private extractTestedFunctions(testCode: string): string[] {
    const functions: string[] = [];
    const patterns = [
      /(?:test|it|describe)\s*\(['"](?:should|test)\s+(.+?)['"]/gi,
      /(?:expect|assert)\((.+?)\(/gi
    ];

    for (const pattern of patterns) {
      const matches = testCode.matchAll(pattern);
      for (const match of matches) {
        const funcName = match[1]?.split(/\s+/).pop();
        if (funcName && funcName.length > 2) {
          functions.push(funcName);
        }
      }
    }

    return Array.from(new Set(functions));
  }

  /**
   * Extract functions from code
   */
  private extractFunctions(code: string): string[] {
    const functions: string[] = [];
    const patterns = [
      /(?:function|const|let|var)\s+(\w+)\s*[=:\(]/g,
      /class\s+(\w+)/g
    ];

    for (const pattern of patterns) {
      const matches = code.matchAll(pattern);
      for (const match of matches) {
        functions.push(match[1]);
      }
    }

    return Array.from(new Set(functions));
  }

  /**
   * Extract function code
   */
  private extractFunctionCode(code: string, functionName: string): string | null {
    const pattern = new RegExp(`(?:function|const|let|var)\\s+${functionName}\\s*[=:]?\\s*[({][\\s\\S]*?\\n\\}`, 'm');
    const match = code.match(pattern);
    return match ? match[0] : null;
  }

  /**
   * Generate updated test
   */
  private async generateUpdatedTest(
    oldTestCode: string,
    newCode: string,
    updateType: TestUpdate['updateType'],
    reason: string
  ): Promise<string> {
    const prompt = `Update the following test code based on code changes:

Reason: ${reason}
Update Type: ${updateType}

Old Test Code:
\`\`\`javascript
${oldTestCode.substring(0, 4000)}
\`\`\`

New Code:
\`\`\`javascript
${newCode.substring(0, 4000)}
\`\`\`

${updateType === 'removed' 
  ? 'Remove tests for deleted functions, keep tests for remaining functions.'
  : 'Update tests to match the modified code. Keep test structure but update assertions and mocks as needed.'
}

Return the updated test code.`;

    try {
      const response = await (llmRouter as any).routeAndExecute({
        prompt,
        taskType: 'test_generation',
        agentRole: 'Test Agent',
        context: {
          agentRole: 'Test Agent',
          tools: []
        }
      });

      return response.content;
    } catch (error: unknown) {
      logger.warn('Test update generation failed:', (error instanceof Error ? error.message : String(error)));
      return oldTestCode; // Return original if update fails
    }
  }

  /**
   * Generate tests for new code
   */
  private async generateTestsForNewCode(
    codeArtifact: IArtifact,
    newCodeLines: string[]
  ): Promise<Array<{ testName: string; newCode: string }>> {
    if (newCodeLines.length === 0) {
      return [];
    }

    const newFunctions = newCodeLines
      .filter(line => line.match(/(?:function|const|let|var|class)\s+\w+/))
      .map(line => {
        const match = line.match(/(?:function|const|let|var|class)\s+(\w+)/);
        return match ? match[1] : null;
      })
      .filter((f): f is string => f !== null);

    const tests: Array<{ testName: string; newCode: string }> = [];

    for (const funcName of newFunctions.slice(0, 5)) { // Limit to 5 new tests
      const testCode = await this.generateTestForFunction(codeArtifact.content, funcName);
      if (testCode) {
        tests.push({
          testName: `Test ${funcName}`,
          newCode: testCode
        });
      }
    }

    return tests;
  }

  /**
   * Generate test for a function
   */
  private async generateTestForFunction(code: string, functionName: string): Promise<string | null> {
    const prompt = `Generate a test for the function "${functionName}" in the following code:

\`\`\`javascript
${code.substring(0, 4000)}
\`\`\`

Generate a comprehensive test using Jest that covers:
- Happy path
- Edge cases
- Error handling

Return only the test code.`;

    try {
      const response = await (llmRouter as any).routeAndExecute({
        prompt,
        taskType: 'test_generation',
        agentRole: 'Test Agent',
        context: {
          agentRole: 'Test Agent',
          tools: []
        }
      });

      return response.content;
    } catch (error: unknown) {
      logger.warn(`Failed to generate test for ${functionName}:`, (error instanceof Error ? error.message : String(error)));
      return null;
    }
  }
}

export const testMaintenanceService = new TestMaintenanceService();



