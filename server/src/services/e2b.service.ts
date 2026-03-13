import { Sandbox } from '@e2b/code-interpreter';
import { apiKeyProvider } from './apiKeyProvider.service.js';

export class E2BService {
  private apiKey: string | null = null;
  private sandbox: Sandbox | null = null;

  /**
   * Get API key from database ONLY (no env fallback for security)
   */
  async getApiKey(): Promise<string | null> {
    // Use apiKeyProvider to get key from database only
    const key = await apiKeyProvider.getApiKey('e2b');
    this.apiKey = key;
    return key;
  }

  /**
   * Get API key synchronously (uses cached value from database)
   */
  getApiKeySync(): string | null {
    return this.apiKey;
  }

  async isConfigured(): Promise<boolean> {
    const key = await this.getApiKey();
    return !!key && key.trim().length > 0;
  }

  /**
   * Get or create a sandbox instance
   */
  async getSandbox(): Promise<Sandbox> {
    // Get API key from database only
    const apiKey = await this.getApiKey();
    if (!apiKey) {
      throw new Error('E2B API key is not configured. Please add it via Admin Console → Settings → API Keys');
    }

    // If sandbox exists but API key changed, recreate it
    if (this.sandbox && this.apiKey !== apiKey) {
      await this.close();
    }

    if (!this.sandbox) {
      this.sandbox = await Sandbox.create({
        apiKey: apiKey
      });
    }

    return this.sandbox;
  }

  /**
   * Write a file to the sandbox
   */
  async writeFile(path: string, content: string): Promise<string> {
    try {
      const sandbox = await this.getSandbox();
      await sandbox.filesystem.write(path, content);
      return `File written successfully: ${path}`;
    } catch (error) {
      throw new Error(`Failed to write file: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Read a file from the sandbox
   */
  async readFile(path: string): Promise<string> {
    try {
      const sandbox = await this.getSandbox();
      const content = await sandbox.filesystem.read(path);
      return content;
    } catch (error) {
      throw new Error(`Failed to read file: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * List directory contents
   */
  async listDir(path: string = '/'): Promise<string[]> {
    try {
      const sandbox = await this.getSandbox();
      const entries = await sandbox.filesystem.list(path);
      return entries.map(entry => entry.name);
    } catch (error) {
      throw new Error(`Failed to list directory: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * List directory contents (alias for listDir)
   */
  async listDirectory(path: string = '/'): Promise<string[]> {
    return this.listDir(path);
  }

  /**
   * Execute a shell command using Python subprocess
   * E2B code-interpreter is designed for Python code, so we wrap shell commands in Python
   */
  async runCommand(command: string): Promise<{ output: string; error?: string }> {
    try {
      const sandbox = await this.getSandbox();
      
      // Use Python subprocess to execute shell commands
      // Escape command properly for Python
      const escapedCommand = command.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\$/g, '\\$');
      const pythonCode = `import subprocess
import sys

try:
    result = subprocess.run(
        "${escapedCommand}",
        shell=True,
        capture_output=True,
        text=True,
        timeout=30
    )
    output = result.stdout or ""
    error = result.stderr or ""
    exit_code = result.returncode
    
    if exit_code != 0:
        print(f"Error (exit code {exit_code}): {error}", file=sys.stderr)
        sys.exit(exit_code)
    
    print(output)
except Exception as e:
    print(f"Exception: {str(e)}", file=sys.stderr)
    sys.exit(1)`;

      // Execute Python code using runCode method
      const result = await sandbox.runCode(pythonCode);
      
      // Extract output from results - runCode returns execution result
      // Check various possible output locations and handle different structures
      let output = '';
      let error: string | undefined = undefined;
      
      // Try to get output from various result properties
      if (result.text) {
        output = String(result.text);
      } else if (result.results && Array.isArray(result.results) && result.results[0]?.text) {
        output = String(result.results[0].text);
      } else if (result.logs) {
        // Handle logs if it's an array or object
        if (Array.isArray(result.logs)) {
          output = result.logs.join('\n');
        } else if (typeof result.logs === 'string') {
          output = result.logs;
        }
      } else if (result.output) {
        output = String(result.output);
      }
      
      // Try to get error
      if (result.error) {
        error = String(result.error);
      } else if (result.results && Array.isArray(result.results) && result.results[0]?.error) {
        error = String(result.results[0].error);
      } else if (result.exitCode !== 0 && result.exitCode !== undefined) {
        error = `Command exited with code ${result.exitCode}`;
      }
      
      return {
        output: output.trim(),
        error: error?.trim()
      };
    } catch (error) {
      throw new Error(`Failed to execute command: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Execute Python code for notebook cells with data science library support
   * This method is optimized for notebook-style execution with visualization support
   */
  async executeNotebookCell(
    code: string,
    options?: {
      saveImages?: boolean; // Save matplotlib/plotly images
      returnData?: boolean; // Return structured data
    }
  ): Promise<{
    output: string;
    error?: string;
    images?: string[]; // Base64 encoded images
    data?: any;
  }> {
    try {
      const sandbox = await this.getSandbox();
      
      // Prepare code with data science library support
      const enhancedCode = `
import pandas as pd
import numpy as np
import matplotlib
matplotlib.use('Agg')  # Non-interactive backend
import matplotlib.pyplot as plt
import json
import sys
from io import StringIO
import base64

# User code
${code}

# Save any matplotlib figures
try:
    import os
    images = []
    for i in range(plt.get_fignums().__len__()):
        fig = plt.figure(i+1)
        buf = StringIO()
        fig.savefig(buf, format='png', bbox_inches='tight')
        buf.seek(0)
        img_base64 = base64.b64encode(buf.read()).decode('utf-8')
        images.append(f"data:image/png;base64,{img_base64}")
        plt.close(fig)
    if images:
        print(f"\\n__NOTEBOOK_IMAGES__:{json.dumps(images)}")
except Exception as e:
    pass  # No figures to save
`;

      const result = await sandbox.runCode(enhancedCode);
      
      let output = '';
      let error: string | undefined;
      const images: string[] = [];
      let data: any = undefined;

      // Extract text output
      if (result.text) {
        output = String(result.text);
      } else if (result.results && Array.isArray(result.results)) {
        output = result.results
          .map((r: any) => r.text || r.output || '')
          .filter(Boolean)
          .join('\n');
      }

      // Extract images from output (marked with __NOTEBOOK_IMAGES__)
      const imageMatch = output.match(/__NOTEBOOK_IMAGES__:(\[.*?\])/);
      if (imageMatch) {
        try {
          const imageArray = JSON.parse(imageMatch[1]);
          images.push(...imageArray);
          // Remove the marker from output
          output = output.replace(/__NOTEBOOK_IMAGES__:\[.*?\]\n?/, '');
        } catch (e) {
          // Failed to parse images
        }
      }

      // Extract error
      if (result.error) {
        error = String(result.error);
      } else if (result.results && Array.isArray(result.results)) {
        const errorResult = result.results.find((r: any) => r.error);
        if (errorResult) {
          error = String(errorResult.error);
        }
      }

      // Try to extract structured data
      if (output && options?.returnData) {
        try {
          const jsonMatch = output.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
          if (jsonMatch) {
            data = JSON.parse(jsonMatch[0]);
          }
        } catch (e) {
          // Not JSON
        }
      }

      return {
        output: output.trim(),
        error: error?.trim(),
        images: images.length > 0 ? images : undefined,
        data: data
      };
    } catch (err: any) {
      throw new Error(`Failed to execute notebook cell: ${err.message || String(err)}`);
    }
  }

  /**
   * Close the sandbox
   * Note: E2B code-interpreter sandboxes may auto-close or have different lifecycle
   */
  async close(): Promise<void> {
    if (this.sandbox) {
      // Check if close method exists (it may not be available in code-interpreter)
      if (typeof (this.sandbox as any).close === 'function') {
        await (this.sandbox as any).close();
      }
      this.sandbox = null;
    }
  }
}

export const e2bService = new E2BService();

