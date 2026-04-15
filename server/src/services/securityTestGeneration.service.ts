/**
 * Security Test Case Generation Service
 * Auto-generates security test cases (SQL injection, XSS, CSRF, auth bypass, etc.)
 */

import { logger } from '../utils/logger.js';
import { llmRouter } from './llm/LLMRouter.js';
import { Type, Schema } from '@google/genai';

export interface SecurityTestCase {
  id: string;
  type: 'sql_injection' | 'xss' | 'csrf' | 'auth_bypass' | 'authorization' | 'input_validation' | 'path_traversal' | 'command_injection';
  title: string;
  description: string;
  testCode: string;
  language: string;
  framework: string;
  expectedResult: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  targetEndpoint?: string;
  targetParameter?: string;
}

export interface SecurityTestSuite {
  projectId: string;
  language: string;
  framework: string;
  testCases: SecurityTestCase[];
  coverage: {
    sqlInjection: number;
    xss: number;
    csrf: number;
    auth: number;
    inputValidation: number;
    total: number;
  };
  generatedAt: Date;
}

class SecurityTestGenerationService {
  /**
   * Generate security test suite
   */
  async generateTestSuite(
    code: string,
    language: string,
    framework: string,
    endpoints?: Array<{ method: string; path: string; parameters: string[] }>
  ): Promise<SecurityTestSuite> {
    try {
      logger.info(`Generating security test suite for ${language} using ${framework}`);

      const testCases: SecurityTestCase[] = [];

      // Generate tests for each vulnerability type
      const vulnerabilityTypes: SecurityTestCase['type'][] = [
        'sql_injection',
        'xss',
        'csrf',
        'auth_bypass',
        'authorization',
        'input_validation',
        'path_traversal',
        'command_injection'
      ];

      for (const vulnType of vulnerabilityTypes) {
        const tests = await this.generateTestsForVulnerability(
          code,
          language,
          framework,
          vulnType,
          endpoints
        );
        testCases.push(...tests);
      }

      // Calculate coverage
      const coverage = {
        sqlInjection: testCases.filter(t => t.type === 'sql_injection').length,
        xss: testCases.filter(t => t.type === 'xss').length,
        csrf: testCases.filter(t => t.type === 'csrf').length,
        auth: testCases.filter(t => t.type === 'auth_bypass' || t.type === 'authorization').length,
        inputValidation: testCases.filter(t => t.type === 'input_validation').length,
        total: testCases.length
      };

      return {
        projectId: '', // Will be set by caller
        language,
        framework,
        testCases,
        coverage,
        generatedAt: new Date()
      };
    } catch (error: unknown) {
      logger.error('Failed to generate security test suite:', error);
      throw error;
    }
  }

  /**
   * Generate tests for a specific vulnerability type
   */
  private async generateTestsForVulnerability(
    code: string,
    language: string,
    framework: string,
    vulnType: SecurityTestCase['type'],
    endpoints?: Array<{ method: string; path: string; parameters: string[] }>
  ): Promise<SecurityTestCase[]> {
    const prompt = this.getVulnerabilityPrompt(vulnType, code, language, framework, endpoints);

    const schema: Schema = {
      type: Type.OBJECT,
      properties: {
        tests: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              description: { type: Type.STRING },
              testCode: { type: Type.STRING },
              expectedResult: { type: Type.STRING },
              targetEndpoint: { type: Type.STRING },
              targetParameter: { type: Type.STRING }
            },
            required: ['title', 'description', 'testCode', 'expectedResult']
          }
        }
      },
      required: ['tests']
    };

    try {
      const response = await (llmRouter as any).routeAndExecute({
        prompt,
        taskType: 'test_generation',
        agentRole: 'Test Agent',
        context: {
          agentRole: 'Test Agent',
          tools: []
        },
        requiredOutputFormat: 'json',
        schema
      });

      const parsed = JSON.parse(response.content);
      return (parsed.tests || []).map((test: any, index: number) => ({
        id: `${vulnType}-${index + 1}`,
        type: vulnType,
        title: test.title,
        description: test.description,
        testCode: test.testCode,
        language,
        framework,
        expectedResult: test.expectedResult,
        severity: this.getSeverityForType(vulnType),
        targetEndpoint: test.targetEndpoint,
        targetParameter: test.targetParameter
      }));
    } catch (error: unknown) {
      logger.warn(`Failed to generate ${vulnType} tests:`, (error instanceof Error ? error.message : String(error)));
      return [];
    }
  }

  /**
   * Get prompt for vulnerability type
   */
  private getVulnerabilityPrompt(
    vulnType: SecurityTestCase['type'],
    code: string,
    language: string,
    framework: string,
    endpoints?: Array<{ method: string; path: string; parameters: string[] }>
  ): string {
    const endpointInfo = endpoints && endpoints.length > 0
      ? `\n\nAPI Endpoints to test:\n${endpoints.map(e => `- ${e.method} ${e.path} (params: ${e.parameters.join(', ')})`).join('\n')}`
      : '';

    switch (vulnType) {
      case 'sql_injection':
        return `Generate SQL injection test cases for the following ${language} code using ${framework}:

\`\`\`${language}
${code.substring(0, 6000)}
\`\`\`
${endpointInfo}

Create test cases that attempt SQL injection attacks:
- Single quote injection: ' OR '1'='1
- Union-based: ' UNION SELECT * FROM users--
- Boolean-based: ' AND 1=1--
- Time-based: '; WAITFOR DELAY '00:00:05'--

For each test, provide:
- Test code using ${framework}
- Expected result (should reject/escape the input)
- Target endpoint and parameter if applicable`;

      case 'xss':
        return `Generate XSS (Cross-Site Scripting) test cases for the following ${language} code using ${framework}:

\`\`\`${language}
${code.substring(0, 6000)}
\`\`\`
${endpointInfo}

Create test cases that attempt XSS attacks:
- Script tag: <script>alert('XSS')</script>
- Event handler: <img src=x onerror=alert('XSS')>
- JavaScript protocol: javascript:alert('XSS')
- Encoded payloads: %3Cscript%3Ealert('XSS')%3C/script%3E

For each test, provide:
- Test code using ${framework}
- Expected result (should sanitize/escape the input)
- Target endpoint and parameter if applicable`;

      case 'csrf':
        return `Generate CSRF (Cross-Site Request Forgery) test cases for the following ${language} code using ${framework}:

\`\`\`${language}
${code.substring(0, 6000)}
\`\`\`
${endpointInfo}

Create test cases that test CSRF protection:
- Missing CSRF token
- Invalid CSRF token
- CSRF token from different session
- Origin header validation

For each test, provide:
- Test code using ${framework}
- Expected result (should reject requests without valid CSRF token)
- Target endpoint if applicable`;

      case 'auth_bypass':
        return `Generate authentication bypass test cases for the following ${language} code using ${framework}:

\`\`\`${language}
${code.substring(0, 6000)}
\`\`\`
${endpointInfo}

Create test cases that attempt authentication bypass:
- Missing authentication token
- Invalid/expired token
- Token manipulation
- Privilege escalation attempts

For each test, provide:
- Test code using ${framework}
- Expected result (should reject unauthorized access)
- Target endpoint if applicable`;

      case 'authorization':
        return `Generate authorization test cases for the following ${language} code using ${framework}:

\`\`\`${language}
${code.substring(0, 6000)}
\`\`\`
${endpointInfo}

Create test cases that test authorization:
- Accessing resources without proper permissions
- Horizontal privilege escalation (accessing other user's data)
- Vertical privilege escalation (accessing admin functions)
- Role-based access control validation

For each test, provide:
- Test code using ${framework}
- Expected result (should enforce proper authorization)
- Target endpoint if applicable`;

      case 'input_validation':
        return `Generate input validation test cases for the following ${language} code using ${framework}:

\`\`\`${language}
${code.substring(0, 6000)}
\`\`\`
${endpointInfo}

Create test cases that test input validation:
- Oversized inputs
- Special characters
- Null/undefined values
- Type mismatches
- Boundary values

For each test, provide:
- Test code using ${framework}
- Expected result (should validate and reject invalid input)
- Target endpoint and parameter if applicable`;

      case 'path_traversal':
        return `Generate path traversal test cases for the following ${language} code using ${framework}:

\`\`\`${language}
${code.substring(0, 6000)}
\`\`\`
${endpointInfo}

Create test cases that attempt path traversal:
- ../etc/passwd
- ..\\..\\windows\\system32
- Encoded: %2e%2e%2f
- Null byte: ..%00/

For each test, provide:
- Test code using ${framework}
- Expected result (should sanitize file paths)
- Target endpoint and parameter if applicable`;

      case 'command_injection':
        return `Generate command injection test cases for the following ${language} code using ${framework}:

\`\`\`${language}
${code.substring(0, 6000)}
\`\`\`
${endpointInfo}

Create test cases that attempt command injection:
- Command chaining: ; ls
- Pipe: | cat /etc/passwd
- Substitution: $(whoami)
- Backticks: \`id\`

For each test, provide:
- Test code using ${framework}
- Expected result (should sanitize command inputs)
- Target endpoint and parameter if applicable`;

      default:
        return '';
    }
  }

  /**
   * Get severity for vulnerability type
   */
  private getSeverityForType(type: SecurityTestCase['type']): SecurityTestCase['severity'] {
    const severityMap: Record<SecurityTestCase['type'], SecurityTestCase['severity']> = {
      'sql_injection': 'critical',
      'xss': 'high',
      'csrf': 'high',
      'auth_bypass': 'critical',
      'authorization': 'high',
      'input_validation': 'medium',
      'path_traversal': 'high',
      'command_injection': 'critical'
    };
    return severityMap[type] || 'medium';
  }
}

export const securityTestGenerationService = new SecurityTestGenerationService();



