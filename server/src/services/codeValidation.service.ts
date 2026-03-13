/**
 * Code Validation Service
 * Validates generated code for syntax errors, type checking, and best practices
 */

import { logger } from '../utils/logger.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { v4 as uuidv4 } from 'uuid';

const execAsync = promisify(exec);

export interface ValidationResult {
  valid: boolean;
  syntaxErrors: SyntaxError[];
  typeErrors: TypeError[];
  lintWarnings: LintWarning[];
  securityIssues: SecurityIssue[];
  qualityScore: number;
  summary: string;
}

export interface SyntaxError {
  file: string;
  line: number;
  column: number;
  message: string;
  severity: 'error' | 'warning';
}

export interface TypeError {
  file: string;
  line: number;
  column: number;
  message: string;
  code: string;
}

export interface LintWarning {
  file: string;
  line: number;
  rule: string;
  message: string;
  severity: 'error' | 'warning' | 'info';
  fixable: boolean;
}

export interface SecurityIssue {
  file: string;
  line?: number;
  severity: 'critical' | 'high' | 'medium' | 'low';
  type: string;
  message: string;
  recommendation: string;
}

export interface GeneratedFile {
  path: string;
  content: string;
  fileType: string;
}

class CodeValidationService {
  private tempDir: string;

  constructor() {
    this.tempDir = path.join(os.tmpdir(), 'orbitai-validation');
  }

  /**
   * Validate all generated files
   */
  async validateProject(
    files: GeneratedFile[],
    language: 'typescript' | 'javascript' | 'python' | 'go' = 'typescript'
  ): Promise<ValidationResult> {
    const projectId = uuidv4();
    const projectPath = path.join(this.tempDir, projectId);

    try {
      logger.info(`🔍 Validating ${files.length} files...`);

      // Create temp directory and write files
      await fs.mkdir(projectPath, { recursive: true });
      
      for (const file of files) {
        const filePath = path.join(projectPath, file.path);
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        await fs.writeFile(filePath, file.content);
      }

      // Run validation based on language
      let result: ValidationResult;
      switch (language) {
        case 'typescript':
        case 'javascript':
          result = await this.validateTypeScript(projectPath, files, language === 'typescript');
          break;
        case 'python':
          result = await this.validatePython(projectPath, files);
          break;
        case 'go':
          result = await this.validateGo(projectPath, files);
          break;
        default:
          result = await this.validateGeneric(files);
      }

      // Run security checks
      const securityIssues = await this.runSecurityChecks(files);
      result.securityIssues = securityIssues;

      // Calculate quality score
      result.qualityScore = this.calculateQualityScore(result);
      result.summary = this.generateSummary(result);

      logger.info(`✅ Validation complete. Score: ${result.qualityScore}/100`);

      return result;
    } catch (error: unknown) {
      logger.error(`Validation failed: ${error.message}`);
      return {
        valid: false,
        syntaxErrors: [{ file: 'unknown', line: 0, column: 0, message: error.message, severity: 'error' }],
        typeErrors: [],
        lintWarnings: [],
        securityIssues: [],
        qualityScore: 0,
        summary: `Validation failed: ${error.message}`,
      };
    } finally {
      // Cleanup temp directory
      try {
        await fs.rm(projectPath, { recursive: true, force: true });
      } catch (e) {
        // Ignore cleanup errors
      }
    }
  }

  /**
   * Validate TypeScript/JavaScript code
   */
  private async validateTypeScript(
    projectPath: string,
    files: GeneratedFile[],
    isTypeScript: boolean
  ): Promise<ValidationResult> {
    const syntaxErrors: SyntaxError[] = [];
    const typeErrors: TypeError[] = [];
    const lintWarnings: LintWarning[] = [];

    // Create package.json if not exists
    const hasPackageJson = files.some(f => f.path === 'package.json');
    if (!hasPackageJson) {
      await fs.writeFile(
        path.join(projectPath, 'package.json'),
        JSON.stringify({ name: 'validation-project', version: '1.0.0' })
      );
    }

    // Run syntax validation using esbuild or similar
    for (const file of files) {
      if (!file.path.match(/\.(ts|tsx|js|jsx)$/)) continue;

      const errors = this.validateJSSyntax(file.content, file.path);
      syntaxErrors.push(...errors);
    }

    // Run TypeScript type checking if TS files
    if (isTypeScript) {
      try {
        // Create minimal tsconfig
        const tsConfig = {
          compilerOptions: {
            target: 'ES2020',
            module: 'ESNext',
            strict: true,
            noEmit: true,
            skipLibCheck: true,
            esModuleInterop: true,
            moduleResolution: 'bundler',
          },
          include: ['**/*.ts', '**/*.tsx'],
        };
        await fs.writeFile(
          path.join(projectPath, 'tsconfig.json'),
          JSON.stringify(tsConfig, null, 2)
        );

        // Try to run tsc
        try {
          const { stderr } = await execAsync('npx tsc --noEmit 2>&1 || true', {
            cwd: projectPath,
            timeout: 30000,
          });

          // Parse TypeScript errors
          const tsErrors = this.parseTypeScriptErrors(stderr);
          typeErrors.push(...tsErrors);
        } catch (e) {
          // TypeScript not available, skip type checking
          logger.debug('TypeScript compiler not available, skipping type checking');
        }
      } catch (e) {
        // Continue without type checking
      }
    }

    // Run ESLint-style checks
    for (const file of files) {
      if (!file.path.match(/\.(ts|tsx|js|jsx)$/)) continue;

      const warnings = this.runLintChecks(file.content, file.path);
      lintWarnings.push(...warnings);
    }

    return {
      valid: syntaxErrors.filter(e => e.severity === 'error').length === 0,
      syntaxErrors,
      typeErrors,
      lintWarnings,
      securityIssues: [],
      qualityScore: 0,
      summary: '',
    };
  }

  /**
   * Validate Python code
   */
  private async validatePython(
    projectPath: string,
    files: GeneratedFile[]
  ): Promise<ValidationResult> {
    const syntaxErrors: SyntaxError[] = [];
    const typeErrors: TypeError[] = [];
    const lintWarnings: LintWarning[] = [];

    for (const file of files) {
      if (!file.path.endsWith('.py')) continue;

      // Python syntax validation
      const errors = this.validatePythonSyntax(file.content, file.path);
      syntaxErrors.push(...errors);

      // Python lint checks
      const warnings = this.runPythonLintChecks(file.content, file.path);
      lintWarnings.push(...warnings);
    }

    // Try to run pyflakes/pylint if available
    try {
      const { stderr } = await execAsync('python3 -m py_compile *.py 2>&1 || true', {
        cwd: projectPath,
        timeout: 30000,
      });

      if (stderr) {
        const errors = this.parsePythonErrors(stderr);
        syntaxErrors.push(...errors);
      }
    } catch (e) {
      // Python not available
    }

    return {
      valid: syntaxErrors.filter(e => e.severity === 'error').length === 0,
      syntaxErrors,
      typeErrors,
      lintWarnings,
      securityIssues: [],
      qualityScore: 0,
      summary: '',
    };
  }

  /**
   * Validate Go code
   */
  private async validateGo(
    projectPath: string,
    files: GeneratedFile[]
  ): Promise<ValidationResult> {
    const syntaxErrors: SyntaxError[] = [];
    const lintWarnings: LintWarning[] = [];

    for (const file of files) {
      if (!file.path.endsWith('.go')) continue;

      // Basic Go syntax checks
      const errors = this.validateGoSyntax(file.content, file.path);
      syntaxErrors.push(...errors);
    }

    // Try to run go vet if available
    try {
      await execAsync('go mod init validation-project', {
        cwd: projectPath,
        timeout: 10000,
      });

      const { stderr } = await execAsync('go vet ./... 2>&1 || true', {
        cwd: projectPath,
        timeout: 30000,
      });

      if (stderr) {
        const errors = this.parseGoErrors(stderr);
        syntaxErrors.push(...errors);
      }
    } catch (e) {
      // Go not available
    }

    return {
      valid: syntaxErrors.filter(e => e.severity === 'error').length === 0,
      syntaxErrors,
      typeErrors: [],
      lintWarnings,
      securityIssues: [],
      qualityScore: 0,
      summary: '',
    };
  }

  /**
   * Generic validation for other file types
   */
  private async validateGeneric(files: GeneratedFile[]): Promise<ValidationResult> {
    const syntaxErrors: SyntaxError[] = [];

    for (const file of files) {
      if (file.path.endsWith('.json')) {
        try {
          JSON.parse(file.content);
        } catch (e: any) {
          syntaxErrors.push({
            file: file.path,
            line: 1,
            column: 0,
            message: `Invalid JSON: ${e.message}`,
            severity: 'error',
          });
        }
      }

      if (file.path.endsWith('.yaml') || file.path.endsWith('.yml')) {
        // Basic YAML validation
        if (file.content.includes('\t')) {
          syntaxErrors.push({
            file: file.path,
            line: 1,
            column: 0,
            message: 'YAML should use spaces, not tabs',
            severity: 'warning',
          });
        }
      }
    }

    return {
      valid: syntaxErrors.filter(e => e.severity === 'error').length === 0,
      syntaxErrors,
      typeErrors: [],
      lintWarnings: [],
      securityIssues: [],
      qualityScore: 0,
      summary: '',
    };
  }

  /**
   * Validate JavaScript/TypeScript syntax
   */
  private validateJSSyntax(content: string, filePath: string): SyntaxError[] {
    const errors: SyntaxError[] = [];

    // Check for common syntax issues
    const lines = content.split('\n');
    let braceCount = 0;
    let parenCount = 0;
    let bracketCount = 0;
    let inString = false;
    let stringChar = '';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      for (let j = 0; j < line.length; j++) {
        const char = line[j];
        const prevChar = j > 0 ? line[j - 1] : '';

        // Skip if inside string
        if (inString) {
          if (char === stringChar && prevChar !== '\\') {
            inString = false;
            stringChar = '';
          }
          continue;
        }

        // Track strings
        if ((char === '"' || char === "'" || char === '`') && prevChar !== '\\') {
          inString = true;
          stringChar = char;
          continue;
        }

        // Track brackets
        if (char === '{') braceCount++;
        if (char === '}') braceCount--;
        if (char === '(') parenCount++;
        if (char === ')') parenCount--;
        if (char === '[') bracketCount++;
        if (char === ']') bracketCount--;
      }

      // Check for common issues
      if (line.includes(';;')) {
        errors.push({
          file: filePath,
          line: i + 1,
          column: line.indexOf(';;') + 1,
          message: 'Double semicolon detected',
          severity: 'warning',
        });
      }

      // Check for console.log in production code (warning)
      if (line.includes('console.log') && !filePath.includes('test')) {
        errors.push({
          file: filePath,
          line: i + 1,
          column: line.indexOf('console.log') + 1,
          message: 'console.log should be removed in production code',
          severity: 'warning',
        });
      }
    }

    // Check for unmatched brackets
    if (braceCount !== 0) {
      errors.push({
        file: filePath,
        line: lines.length,
        column: 0,
        message: `Unmatched braces: ${braceCount > 0 ? 'missing }' : 'extra }'}`,
        severity: 'error',
      });
    }

    if (parenCount !== 0) {
      errors.push({
        file: filePath,
        line: lines.length,
        column: 0,
        message: `Unmatched parentheses: ${parenCount > 0 ? 'missing )' : 'extra )'}`,
        severity: 'error',
      });
    }

    if (bracketCount !== 0) {
      errors.push({
        file: filePath,
        line: lines.length,
        column: 0,
        message: `Unmatched brackets: ${bracketCount > 0 ? 'missing ]' : 'extra ]'}`,
        severity: 'error',
      });
    }

    return errors;
  }

  /**
   * Run lint-style checks on JavaScript/TypeScript
   */
  private runLintChecks(content: string, filePath: string): LintWarning[] {
    const warnings: LintWarning[] = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Check for var usage (prefer let/const)
      if (/\bvar\s+/.test(line)) {
        warnings.push({
          file: filePath,
          line: i + 1,
          rule: 'no-var',
          message: 'Use let or const instead of var',
          severity: 'warning',
          fixable: true,
        });
      }

      // Check for == instead of ===
      if (/[^!=]==[^=]/.test(line) && !/===/.test(line)) {
        warnings.push({
          file: filePath,
          line: i + 1,
          rule: 'eqeqeq',
          message: 'Use === instead of ==',
          severity: 'warning',
          fixable: true,
        });
      }

      // Check for != instead of !==
      if (/!=[^=]/.test(line) && !/!==/.test(line)) {
        warnings.push({
          file: filePath,
          line: i + 1,
          rule: 'eqeqeq',
          message: 'Use !== instead of !=',
          severity: 'warning',
          fixable: true,
        });
      }

      // Check line length
      if (line.length > 120) {
        warnings.push({
          file: filePath,
          line: i + 1,
          rule: 'max-len',
          message: `Line exceeds 120 characters (${line.length})`,
          severity: 'info',
          fixable: false,
        });
      }

      // Check for TODO comments
      if (/\/\/\s*TODO/.test(line)) {
        warnings.push({
          file: filePath,
          line: i + 1,
          rule: 'no-warning-comments',
          message: 'TODO comment found',
          severity: 'info',
          fixable: false,
        });
      }
    }

    return warnings;
  }

  /**
   * Validate Python syntax
   */
  private validatePythonSyntax(content: string, filePath: string): SyntaxError[] {
    const errors: SyntaxError[] = [];
    const lines = content.split('\n');

    let indentStack: number[] = [0];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Skip empty lines and comments
      if (!line.trim() || line.trim().startsWith('#')) continue;

      // Check indentation
      const indent = line.match(/^(\s*)/)?.[1].length || 0;
      
      // Check for tabs
      if (line.startsWith('\t')) {
        errors.push({
          file: filePath,
          line: i + 1,
          column: 0,
          message: 'Use spaces for indentation, not tabs',
          severity: 'error',
        });
      }

      // Check for mixed spaces/tabs
      if (/^\s*\t/.test(line) && /^\s* /.test(line)) {
        errors.push({
          file: filePath,
          line: i + 1,
          column: 0,
          message: 'Mixed spaces and tabs in indentation',
          severity: 'error',
        });
      }

      // Check for incorrect indentation (not multiple of 4)
      if (indent > 0 && indent % 4 !== 0) {
        errors.push({
          file: filePath,
          line: i + 1,
          column: 0,
          message: 'Indentation should be a multiple of 4 spaces',
          severity: 'warning',
        });
      }
    }

    return errors;
  }

  /**
   * Run Python lint checks
   */
  private runPythonLintChecks(content: string, filePath: string): LintWarning[] {
    const warnings: LintWarning[] = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Check line length (PEP 8)
      if (line.length > 79) {
        warnings.push({
          file: filePath,
          line: i + 1,
          rule: 'E501',
          message: `Line too long (${line.length} > 79 characters)`,
          severity: 'warning',
          fixable: false,
        });
      }

      // Check for print statements (should use logging)
      if (/\bprint\s*\(/.test(line) && !filePath.includes('test')) {
        warnings.push({
          file: filePath,
          line: i + 1,
          rule: 'T001',
          message: 'Use logging instead of print() in production code',
          severity: 'warning',
          fixable: false,
        });
      }

      // Check for except without exception type
      if (/except\s*:/.test(line)) {
        warnings.push({
          file: filePath,
          line: i + 1,
          rule: 'E722',
          message: 'Do not use bare except, specify exception type',
          severity: 'error',
          fixable: false,
        });
      }
    }

    return warnings;
  }

  /**
   * Validate Go syntax
   */
  private validateGoSyntax(content: string, filePath: string): SyntaxError[] {
    const errors: SyntaxError[] = [];
    const lines = content.split('\n');

    let braceCount = 0;
    let hasPackage = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Check for package declaration
      if (/^package\s+\w+/.test(line)) {
        hasPackage = true;
      }

      // Count braces
      braceCount += (line.match(/{/g) || []).length;
      braceCount -= (line.match(/}/g) || []).length;

      // Check for common Go issues
      if (/\t/.test(line) === false && line.trim().length > 0 && i > 0) {
        // Go uses tabs for indentation
      }
    }

    if (!hasPackage) {
      errors.push({
        file: filePath,
        line: 1,
        column: 0,
        message: 'Go files must have a package declaration',
        severity: 'error',
      });
    }

    if (braceCount !== 0) {
      errors.push({
        file: filePath,
        line: lines.length,
        column: 0,
        message: `Unmatched braces: ${braceCount}`,
        severity: 'error',
      });
    }

    return errors;
  }

  /**
   * Run security checks on code
   */
  private async runSecurityChecks(files: GeneratedFile[]): Promise<SecurityIssue[]> {
    const issues: SecurityIssue[] = [];

    for (const file of files) {
      const content = file.content;
      const lines = content.split('\n');

      // Check for hardcoded secrets
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // API keys and tokens
        if (/['"](?:api[_-]?key|apikey|token|secret|password|auth)['"]\s*[:=]\s*['"][^'"]{8,}['"]/i.test(line)) {
          issues.push({
            file: file.path,
            line: i + 1,
            severity: 'critical',
            type: 'hardcoded-secret',
            message: 'Potential hardcoded secret/API key detected',
            recommendation: 'Use environment variables for sensitive data',
          });
        }

        // SQL injection vulnerability
        if (/query\s*\([^)]*\+/.test(line) || /execute\s*\([^)]*\+/.test(line)) {
          issues.push({
            file: file.path,
            line: i + 1,
            severity: 'high',
            type: 'sql-injection',
            message: 'Potential SQL injection vulnerability (string concatenation in query)',
            recommendation: 'Use parameterized queries or prepared statements',
          });
        }

        // XSS vulnerability
        if (/innerHTML\s*=/.test(line) && !line.includes('sanitize')) {
          issues.push({
            file: file.path,
            line: i + 1,
            severity: 'high',
            type: 'xss',
            message: 'Potential XSS vulnerability (innerHTML assignment)',
            recommendation: 'Use textContent or sanitize HTML before assignment',
          });
        }

        // Eval usage
        if (/\beval\s*\(/.test(line)) {
          issues.push({
            file: file.path,
            line: i + 1,
            severity: 'high',
            type: 'code-injection',
            message: 'eval() usage detected - potential code injection vulnerability',
            recommendation: 'Avoid using eval() with user input',
          });
        }

        // Insecure HTTP
        if (/['"]http:\/\/(?!localhost|127\.0\.0\.1)/.test(line)) {
          issues.push({
            file: file.path,
            line: i + 1,
            severity: 'medium',
            type: 'insecure-protocol',
            message: 'Insecure HTTP protocol used',
            recommendation: 'Use HTTPS for secure communication',
          });
        }

        // Weak crypto
        if (/\bmd5\b|\bsha1\b/i.test(line) && !line.includes('//')) {
          issues.push({
            file: file.path,
            line: i + 1,
            severity: 'medium',
            type: 'weak-crypto',
            message: 'Weak cryptographic algorithm (MD5/SHA1) detected',
            recommendation: 'Use SHA-256 or stronger hashing algorithms',
          });
        }
      }
    }

    return issues;
  }

  /**
   * Parse TypeScript compiler errors
   */
  private parseTypeScriptErrors(output: string): TypeError[] {
    const errors: TypeError[] = [];
    const lines = output.split('\n');

    for (const line of lines) {
      // Format: file.ts(10,5): error TS2322: Type 'string' is not assignable to type 'number'.
      const match = line.match(/(.+?)\((\d+),(\d+)\):\s*(error|warning)\s+(TS\d+):\s*(.+)/);
      if (match) {
        errors.push({
          file: match[1],
          line: parseInt(match[2]),
          column: parseInt(match[3]),
          code: match[5],
          message: match[6],
        });
      }
    }

    return errors;
  }

  /**
   * Parse Python errors
   */
  private parsePythonErrors(output: string): SyntaxError[] {
    const errors: SyntaxError[] = [];
    const lines = output.split('\n');

    for (const line of lines) {
      // Format: File "test.py", line 10
      const match = line.match(/File "(.+?)", line (\d+)/);
      if (match) {
        const nextLine = lines[lines.indexOf(line) + 1] || '';
        errors.push({
          file: match[1],
          line: parseInt(match[2]),
          column: 0,
          message: nextLine.trim() || 'Syntax error',
          severity: 'error',
        });
      }
    }

    return errors;
  }

  /**
   * Parse Go errors
   */
  private parseGoErrors(output: string): SyntaxError[] {
    const errors: SyntaxError[] = [];
    const lines = output.split('\n');

    for (const line of lines) {
      // Format: file.go:10:5: error message
      const match = line.match(/(.+?):(\d+):(\d+):\s*(.+)/);
      if (match) {
        errors.push({
          file: match[1],
          line: parseInt(match[2]),
          column: parseInt(match[3]),
          message: match[4],
          severity: 'error',
        });
      }
    }

    return errors;
  }

  /**
   * Calculate quality score based on validation results
   */
  private calculateQualityScore(result: ValidationResult): number {
    let score = 100;

    // Deduct for syntax errors
    score -= result.syntaxErrors.filter(e => e.severity === 'error').length * 20;
    score -= result.syntaxErrors.filter(e => e.severity === 'warning').length * 5;

    // Deduct for type errors
    score -= result.typeErrors.length * 10;

    // Deduct for lint warnings
    score -= result.lintWarnings.filter(w => w.severity === 'error').length * 10;
    score -= result.lintWarnings.filter(w => w.severity === 'warning').length * 3;
    score -= result.lintWarnings.filter(w => w.severity === 'info').length * 1;

    // Deduct for security issues
    score -= result.securityIssues.filter(i => i.severity === 'critical').length * 30;
    score -= result.securityIssues.filter(i => i.severity === 'high').length * 20;
    score -= result.securityIssues.filter(i => i.severity === 'medium').length * 10;
    score -= result.securityIssues.filter(i => i.severity === 'low').length * 5;

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Generate summary of validation results
   */
  private generateSummary(result: ValidationResult): string {
    const parts: string[] = [];

    if (result.valid) {
      parts.push('✅ Code is syntactically valid.');
    } else {
      parts.push('❌ Code has syntax errors that need to be fixed.');
    }

    const errorCount = result.syntaxErrors.filter(e => e.severity === 'error').length;
    const warningCount = result.syntaxErrors.filter(e => e.severity === 'warning').length + 
                         result.lintWarnings.length;
    const securityCount = result.securityIssues.length;

    if (errorCount > 0) {
      parts.push(`Found ${errorCount} error(s).`);
    }

    if (warningCount > 0) {
      parts.push(`Found ${warningCount} warning(s).`);
    }

    if (securityCount > 0) {
      parts.push(`Found ${securityCount} security issue(s).`);
    }

    parts.push(`Quality score: ${result.qualityScore}/100`);

    return parts.join(' ');
  }

  /**
   * Quick syntax check without full validation
   */
  async quickSyntaxCheck(code: string, language: 'typescript' | 'javascript' | 'python' | 'go'): Promise<{
    valid: boolean;
    errors: string[];
  }> {
    let errors: SyntaxError[] = [];

    switch (language) {
      case 'typescript':
      case 'javascript':
        errors = this.validateJSSyntax(code, 'inline.ts');
        break;
      case 'python':
        errors = this.validatePythonSyntax(code, 'inline.py');
        break;
      case 'go':
        errors = this.validateGoSyntax(code, 'inline.go');
        break;
    }

    return {
      valid: errors.filter(e => e.severity === 'error').length === 0,
      errors: errors.map(e => `Line ${e.line}: ${e.message}`),
    };
  }
}

export const codeValidationService = new CodeValidationService();
