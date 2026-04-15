/**
 * Secrets Scanning Service
 * Scans for hardcoded credentials and suggests secure alternatives
 */

import { logger } from '../utils/logger.js';
import { llmRouter } from './llm/LLMRouter.js';
import { Type, Schema } from '@google/genai';

export interface SecretFinding {
  type:
    | 'api_key'
    | 'password'
    | 'token'
    | 'credential'
    | 'private_key'
    | 'database_url'
    | 'aws_key'
    | 'other';
  severity: 'critical' | 'high' | 'medium' | 'low';
  value: string; // Masked value
  location: string; // File path or artifact ID
  line?: number;
  description: string;
  recommendation: string;
  secureAlternative: {
    method: 'environment_variable' | 'secrets_manager' | 'vault' | 'config_service';
    example: string;
    implementation: string;
  };
}

// Common secret patterns (TruffleHog, GitGuardian patterns)
const SECRET_PATTERNS = {
  api_key: [
    /api[_-]?key\s*[=:]\s*['"]([a-zA-Z0-9_\-]{20,})['"]/gi,
    /apikey\s*[=:]\s*['"]([a-zA-Z0-9_\-]{20,})['"]/gi,
  ],
  password: [
    /password\s*[=:]\s*['"]([^'"]{8,})['"]/gi,
    /pwd\s*[=:]\s*['"]([^'"]{8,})['"]/gi,
    /pass\s*[=:]\s*['"]([^'"]{8,})['"]/gi,
  ],
  token: [
    /token\s*[=:]\s*['"]([a-zA-Z0-9_\-]{32,})['"]/gi,
    /bearer\s+([a-zA-Z0-9_\-\.]{32,})/gi,
    /access[_-]?token\s*[=:]\s*['"]([a-zA-Z0-9_\-]{32,})['"]/gi,
  ],
  aws_key: [
    /aws[_-]?access[_-]?key[_-]?id\s*[=:]\s*['"](AKIA[0-9A-Z]{16})['"]/gi,
    /aws[_-]?secret[_-]?access[_-]?key\s*[=:]\s*['"]([a-zA-Z0-9/+=]{40})['"]/gi,
  ],
  database_url: [
    /(?:postgres|mysql|mongodb|redis):\/\/[^:]+:[^@]+@/gi,
    /connection[_-]?string\s*[=:]\s*['"]([^'"]*:[^'"]*@[^'"]+)['"]/gi,
  ],
  private_key: [
    /-----BEGIN\s+(?:RSA\s+)?PRIVATE\s+KEY-----/gi,
    /-----BEGIN\s+EC\s+PRIVATE\s+KEY-----/gi,
  ],
};

class SecretsScanningService {
  /**
   * Scan code for hardcoded secrets
   */
  async scanForSecrets(
    code: string,
    language: string,
    filePath?: string
  ): Promise<SecretFinding[]> {
    try {
      logger.info(`Scanning for secrets in ${language} code`);

      // Pattern-based scanning
      const patternFindings = this.scanWithPatterns(code, filePath);

      // LLM-based scanning for context-aware detection
      const llmFindings = await this.scanWithLLM(code, language, filePath);

      // Merge and deduplicate
      const allFindings = [...patternFindings, ...llmFindings];
      const uniqueFindings = this.deduplicateFindings(allFindings);

      return uniqueFindings;
    } catch (error: unknown) {
      logger.error('Failed to scan for secrets:', error);
      return [];
    }
  }

  /**
   * Scan with pattern matching
   */
  private scanWithPatterns(code: string, filePath?: string): SecretFinding[] {
    const findings: SecretFinding[] = [];
    const lines = code.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Check each pattern type
      for (const [type, patterns] of Object.entries(SECRET_PATTERNS)) {
        for (const pattern of patterns) {
          const matches = line.matchAll(pattern);
          for (const match of matches) {
            const value = match[1] || match[0];
            const maskedValue = this.maskSecret(value);

            findings.push({
              type: type as SecretFinding['type'],
              severity: this.determineSeverity(type as string),
              value: maskedValue,
              location: filePath || 'unknown',
              line: i + 1,
              description: `Hardcoded ${type} found in code`,
              recommendation: `Remove hardcoded ${type} and use secure storage`,
              secureAlternative: this.getSecureAlternative(type as string, 'unknown'),
            });
          }
        }
      }
    }

    return findings;
  }

  /**
   * Scan with LLM for context-aware detection
   */
  private async scanWithLLM(
    code: string,
    language: string,
    filePath?: string
  ): Promise<SecretFinding[]> {
    const prompt = `Analyze the following ${language} code for hardcoded secrets, credentials, API keys, tokens, or sensitive information:

\`\`\`${language}
${code.substring(0, 8000)}
\`\`\`

Identify any:
- API keys
- Passwords
- Tokens (access tokens, refresh tokens, JWT secrets)
- Database connection strings with credentials
- AWS keys
- Private keys
- OAuth secrets
- Encryption keys

For each finding, provide:
- Type of secret
- Severity (critical for production secrets, high for API keys, medium for test credentials)
- Location (line number if possible)
- Recommendation for secure storage
- Example of secure alternative

Return as JSON array.`;

    const schema: Schema = {
      type: Type.OBJECT,
      properties: {
        findings: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              type: { type: Type.STRING },
              severity: { type: Type.STRING },
              location: { type: Type.STRING },
              line: { type: Type.NUMBER },
              description: { type: Type.STRING },
              recommendation: { type: Type.STRING },
              secureMethod: { type: Type.STRING },
              example: { type: Type.STRING },
            },
            required: ['type', 'severity', 'description', 'recommendation'],
          },
        },
      },
      required: ['findings'],
    };

    try {
      const response = await (llmRouter as any).routeAndExecute({
        prompt,
        taskType: 'security_audit',
        agentRole: 'QA/Audit Agent',
        context: {
          agentRole: 'QA/Audit Agent',
          tools: [],
        },
        requiredOutputFormat: 'json',
        schema,
      });

      const parsed = JSON.parse(response.content);
      return (parsed.findings || []).map((finding: any) => ({
        type: this.normalizeSecretType(finding.type),
        severity: finding.severity || 'high',
        value: '***REDACTED***',
        location: finding.location || filePath || 'unknown',
        line: finding.line,
        description: finding.description,
        recommendation: finding.recommendation,
        secureAlternative: {
          method: this.parseSecureMethod(finding.secureMethod),
          example: finding.example || '',
          implementation: this.generateImplementation(finding.secureMethod, language),
        },
      }));
    } catch (error: unknown) {
      logger.warn(
        'LLM secret scanning failed:',
        error instanceof Error ? error.message : String(error)
      );
      return [];
    }
  }

  /**
   * Mask secret value
   */
  private maskSecret(value: string): string {
    if (value.length <= 8) {
      return '***';
    }
    return value.substring(0, 4) + '***' + value.substring(value.length - 4);
  }

  /**
   * Determine severity
   */
  private determineSeverity(type: string): SecretFinding['severity'] {
    if (type === 'private_key' || type === 'aws_key') return 'critical';
    if (type === 'api_key' || type === 'token' || type === 'password') return 'high';
    if (type === 'database_url') return 'high';
    return 'medium';
  }

  /**
   * Get secure alternative
   */
  private getSecureAlternative(
    type: string,
    _language: string
  ): SecretFinding['secureAlternative'] {
    const method =
      type === 'aws_key'
        ? 'secrets_manager'
        : type === 'private_key'
          ? 'vault'
          : 'environment_variable';

    let example = '';
    let implementation = '';

    switch (method) {
      case 'environment_variable':
        example = `process.env.${type.toUpperCase().replace(/-/g, '_')}`;
        implementation = `// Use environment variable\nconst ${type} = process.env.${type.toUpperCase().replace(/-/g, '_')};\nif (!${type}) throw new Error('${type} not configured');`;
        break;
      case 'secrets_manager':
        example = 'AWS Secrets Manager or similar';
        implementation = `// Use secrets manager\nimport { SecretsManager } from '@aws-sdk/client-secrets-manager';\nconst client = new SecretsManager({ region: 'us-east-1' });\nconst secret = await client.getSecretValue({ SecretId: '${type}' });`;
        break;
      case 'vault':
        example = 'HashiCorp Vault or similar';
        implementation = `// Use vault\nimport vault from 'node-vault';\nconst client = vault({ endpoint: process.env.VAULT_ADDR });\nconst secret = await client.read('secret/${type}');`;
        break;
    }

    return { method, example, implementation };
  }

  /**
   * Normalize secret type
   */
  private normalizeSecretType(type: string): SecretFinding['type'] {
    const t = type.toLowerCase();
    if (t.includes('api') && t.includes('key')) return 'api_key';
    if (t.includes('password') || t.includes('pwd')) return 'password';
    if (t.includes('token')) return 'token';
    if (t.includes('aws')) return 'aws_key';
    if (t.includes('database') || t.includes('connection')) return 'database_url';
    if (t.includes('private') && t.includes('key')) return 'private_key';
    if (t.includes('credential')) return 'credential';
    return 'other';
  }

  /**
   * Parse secure method
   */
  private parseSecureMethod(method: string): SecretFinding['secureAlternative']['method'] {
    const m = method.toLowerCase();
    if (m.includes('vault')) return 'vault';
    if (m.includes('secrets') || m.includes('manager')) return 'secrets_manager';
    if (m.includes('config')) return 'config_service';
    return 'environment_variable';
  }

  /**
   * Generate implementation example
   */
  private generateImplementation(method: string, _language: string): string {
    // Implementation examples would be generated here
    return `// Secure implementation using ${method}`;
  }

  /**
   * Deduplicate findings
   */
  private deduplicateFindings(findings: SecretFinding[]): SecretFinding[] {
    const seen = new Set<string>();
    const unique: SecretFinding[] = [];

    for (const finding of findings) {
      const key = `${finding.type}-${finding.location}-${finding.line}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(finding);
      }
    }

    return unique;
  }
}

export const secretsScanningService = new SecretsScanningService();
