import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { randomUUID } from 'crypto';
import { logger } from '../../../utils/logger.js';

export interface CodexLLMConfig {
  systemInstruction?: string;
  temperature?: number;
  maxTokens?: number;
  responseFormat?: { type: 'json_object' | 'text' };
  tools?: unknown[];
}

export interface CodexLLMResponse {
  text: string;
  functionCalls?: Array<{ name: string; args: Record<string, unknown> }>;
  usage: { promptTokens: number; completionTokens: number; totalTokens: number };
}

/**
 * Local-test LLM backend that shells out to the Codex CLI (`codex exec`)
 * so contributors can validate OrbitAI without provisioning OpenAI/Anthropic
 * API keys. Enable via `USE_CODEX_CLI=true`.
 */
export class CodexCLIService {
  private readonly binary: string;

  constructor(binary: string = process.env.CODEX_CLI_BIN || 'codex') {
    this.binary = binary;
  }

  isEnabled(): boolean {
    return (process.env.USE_CODEX_CLI || '').toLowerCase() === 'true';
  }

  async isAvailable(): Promise<boolean> {
    if (!this.isEnabled()) return false;
    return new Promise(resolve => {
      const child = spawn(this.binary, ['--version'], { stdio: 'ignore' });
      child.on('error', () => resolve(false));
      child.on('exit', code => resolve(code === 0));
    });
  }

  async generateContent(
    prompt: string,
    model: string,
    configOptions?: CodexLLMConfig
  ): Promise<CodexLLMResponse> {
    const composed = this.composePrompt(prompt, configOptions);
    const text = await this.runCodex(composed, model);
    return {
      text,
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
    };
  }

  async generateStructuredOutput(
    prompt: string,
    _schema: unknown,
    model: string
  ): Promise<unknown> {
    const composed = this.composePrompt(
      `${prompt}\n\nReturn ONLY a valid JSON object. No prose, no code fences.`,
      { responseFormat: { type: 'json_object' } }
    );
    const text = await this.runCodex(composed, model);
    return this.parseJson(text);
  }

  async *generateContentStream(
    prompt: string,
    model: string,
    configOptions?: CodexLLMConfig
  ): AsyncGenerator<string, void, unknown> {
    const { text } = await this.generateContent(prompt, model, configOptions);
    yield text;
  }

  private composePrompt(prompt: string, opts?: CodexLLMConfig): string {
    if (!opts?.systemInstruction) return prompt;
    return `[System]\n${opts.systemInstruction}\n\n[User]\n${prompt}`;
  }

  private parseJson(text: string): unknown {
    try {
      return JSON.parse(text);
    } catch {
      const match = text.match(/\{[\s\S]*\}/);
      if (match) return JSON.parse(match[0]);
      throw new Error('CodexCLI: failed to parse JSON from response');
    }
  }

  private async runCodex(prompt: string, model: string): Promise<string> {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'orbitai-codex-'));
    const outFile = path.join(tmpDir, `out-${randomUUID()}.txt`);
    try {
      const args = ['exec', '--skip-git-repo-check', '-o', outFile, '--color', 'never'];
      // Caller-supplied model names (e.g. "gpt-4o", "gpt-5-codex") are upstream
      // OpenAI identifiers and are usually rejected when Codex is authed via a
      // ChatGPT account. Only forward an explicit override via CODEX_CLI_MODEL.
      const forcedModel = process.env.CODEX_CLI_MODEL?.trim();
      if (forcedModel) {
        args.push('-m', forcedModel);
      }
      args.push(prompt);

      await this.spawnAndWait(this.binary, args);
      const text = await fs.readFile(outFile, 'utf8');
      return text.trim();
    } finally {
      fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    }
  }

  private spawnAndWait(cmd: string, args: string[]): Promise<void> {
    // WI-6a: a hung `codex exec` previously hung the request indefinitely (no timeout). Enforce a
    // deadline (env CODEX_CLI_TIMEOUT_MS, default 120s) and kill the child if it overruns.
    const timeoutMs = Number(process.env.CODEX_CLI_TIMEOUT_MS) || 120_000;
    return new Promise((resolve, reject) => {
      const child = spawn(cmd, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        env: process.env,
      });
      let stderr = '';
      let settled = false;
      const finish = (fn: () => void): void => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        fn();
      };
      const timer = setTimeout(() => {
        child.kill('SIGTERM');
        // Escalate to SIGKILL if SIGTERM is ignored.
        setTimeout(() => {
          try {
            child.kill('SIGKILL');
          } catch {
            /* already gone */
          }
        }, 5_000).unref?.();
        logger.error('[CodexCLI] codex exec timed out', { timeoutMs });
        finish(() => reject(new Error(`Codex CLI timed out after ${timeoutMs}ms`)));
      }, timeoutMs);
      timer.unref?.();
      child.stderr.on('data', chunk => {
        stderr += chunk.toString();
      });
      child.stdout.on('data', () => {
        /* drain */
      });
      child.on('error', err => finish(() => reject(err)));
      child.on('exit', code =>
        finish(() => {
          if (code === 0) return resolve();
          const trimmed = stderr.trim().slice(-500) || `exit code ${code}`;
          logger.error('[CodexCLI] codex exec failed', { code, stderr: trimmed });
          reject(new Error(`Codex CLI failed: ${trimmed}`));
        })
      );
    });
  }
}

export const codexCLIService = new CodexCLIService();
