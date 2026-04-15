import { logger } from '../utils/logger.js';
import { e2bService } from './e2b.service.js';

// Notebook cell interface (matches frontend types)
export interface NotebookCell {
  id: string;
  type: 'code' | 'markdown' | 'output';
  content: string;
  language?: 'python' | 'javascript' | 'sql';
  executionCount?: number;
  outputs?: Array<{
    type: 'text' | 'image' | 'chart' | 'error' | 'data';
    data: any;
    metadata?: Record<string, any>;
  }>;
}

export interface NotebookExecutionResult {
  success: boolean;
  output?: string;
  error?: string;
  images?: string[]; // Base64 encoded images
  data?: any; // Structured data output
  executionTime?: number;
}

export class NotebookService {
  /**
   * Execute a notebook cell and return structured output
   */
  async executeCell(
    code: string,
    language: 'python' | 'javascript' | 'sql' = 'python'
  ): Promise<NotebookExecutionResult> {
    const startTime = Date.now();

    try {
      if (language !== 'python') {
        throw new Error(`Language ${language} not yet supported. Only Python is supported.`);
      }

      // Check if E2B is configured
      const isConfigured = await e2bService.isConfigured();
      if (!isConfigured) {
        throw new Error(
          'E2B sandbox is not configured. Please configure E2B API key in Admin Console.'
        );
      }

      // Prepare Python code with data science library imports
      const enhancedCode = this.preparePythonCode(code);

      // Execute code in E2B sandbox
      const result = await e2bService.getSandbox().then(async sandbox => {
        return await sandbox.runCode(enhancedCode);
      });

      const executionTime = Date.now() - startTime;

      // Parse output from E2B result
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

      // Extract error
      if ((result as any).error) {
        error = String((result as any).error);
      } else if (result.results && Array.isArray(result.results)) {
        const errorResult = result.results.find((r: any) => r.error);
        if (errorResult) {
          error = String((errorResult as any).error);
        }
      }

      // Check for image outputs (matplotlib/plotly)
      if (result.results && Array.isArray(result.results)) {
        for (const r of result.results) {
          if ((r as any).images && Array.isArray((r as any).images)) {
            images.push(...(r as any).images);
          }
          // Check for base64 encoded images in output
          if (r.text && typeof r.text === 'string') {
            const base64Matches = r.text.match(/data:image\/[^;]+;base64,[A-Za-z0-9+/=]+/g);
            if (base64Matches) {
              images.push(...base64Matches);
            }
          }
        }
      }

      // Try to extract structured data (JSON, CSV, etc.)
      if (output) {
        try {
          // Check if output is JSON
          const jsonMatch = output.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
          if (jsonMatch) {
            data = JSON.parse(jsonMatch[0]);
          }
        } catch (e: unknown) {
          // Not JSON, that's okay
        }
      }

      return {
        success: !error,
        output: output || undefined,
        error: error || undefined,
        images: images.length > 0 ? images : undefined,
        data: data,
        executionTime,
      };
    } catch (err: any) {
      logger.error('Notebook cell execution failed:', err);
      return {
        success: false,
        error: err.message || 'Failed to execute notebook cell',
        executionTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Prepare Python code with necessary imports and setup for data science
   */
  private preparePythonCode(code: string): string {
    // Check if code already has imports
    const hasImports = /^(import|from)\s+/.test(code.trim());

    // Default imports for data science
    const defaultImports = `
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import matplotlib
matplotlib.use('Agg')  # Use non-interactive backend
import json
import sys
from io import StringIO
`;

    // If code doesn't have imports, add default ones
    if (!hasImports) {
      return defaultImports + '\n\n' + code;
    }

    // Ensure matplotlib uses non-interactive backend
    if (code.includes('matplotlib') && !code.includes("matplotlib.use('Agg')")) {
      return `import matplotlib\nmatplotlib.use('Agg')\n` + code;
    }

    return code;
  }

  /**
   * Convert notebook cells to Jupyter notebook format (.ipynb)
   */
  convertToJupyterNotebook(cells: NotebookCell[]): any {
    const jupyterCells = cells.map(cell => {
      if (cell.type === 'markdown') {
        return {
          cell_type: 'markdown',
          metadata: {},
          source: cell.content.split('\n'),
        };
      } else if (cell.type === 'code') {
        const outputs: any[] = [];

        if (cell.outputs) {
          for (const output of cell.outputs) {
            if (output.type === 'text') {
              outputs.push({
                output_type: 'stream',
                name: 'stdout',
                text: String(output.data).split('\n'),
              });
            } else if (output.type === 'error') {
              outputs.push({
                output_type: 'error',
                ename: 'Error',
                evalue: String(output.data),
                traceback: String(output.data).split('\n'),
              });
            } else if (output.type === 'image') {
              outputs.push({
                output_type: 'display_data',
                data: {
                  'image/png': output.data.replace(/^data:image\/[^;]+;base64,/, ''),
                },
                metadata: {},
              });
            } else if (output.type === 'data') {
              outputs.push({
                output_type: 'execute_result',
                data: {
                  'text/plain': [JSON.stringify(output.data, null, 2)],
                },
                metadata: {},
                execution_count: cell.executionCount || null,
              });
            }
          }
        }

        return {
          cell_type: 'code',
          execution_count: cell.executionCount || null,
          metadata: {},
          source: cell.content.split('\n'),
          outputs: outputs,
        };
      } else {
        // Output cell - convert to code cell with outputs
        return {
          cell_type: 'code',
          execution_count: cell.executionCount || null,
          metadata: {},
          source: [],
          outputs:
            cell.outputs?.map(out => ({
              output_type: out.type === 'error' ? 'error' : 'display_data',
              data:
                out.type === 'image'
                  ? { 'image/png': out.data.replace(/^data:image\/[^;]+;base64,/, '') }
                  : { 'text/plain': [String(out.data)] },
              metadata: {},
            })) || [],
        };
      }
    });

    return {
      cells: jupyterCells,
      metadata: {
        kernelspec: {
          display_name: 'Python 3',
          language: 'python',
          name: 'python3',
        },
        language_info: {
          name: 'python',
          version: '3.10',
        },
      },
      nbformat: 4,
      nbformat_minor: 4,
    };
  }

  /**
   * Parse Jupyter notebook format to internal format
   */
  parseFromJupyterNotebook(jupyterNotebook: any): NotebookCell[] {
    const cells: NotebookCell[] = [];

    for (const jupyterCell of jupyterNotebook.cells || []) {
      if (jupyterCell.cell_type === 'markdown') {
        cells.push({
          id: `cell-${Date.now()}-${Math.random().toString(36).substring(7)}`,
          type: 'markdown',
          content: Array.isArray(jupyterCell.source)
            ? jupyterCell.source.join('\n')
            : String(jupyterCell.source || ''),
        });
      } else if (jupyterCell.cell_type === 'code') {
        const outputs: NotebookCell['outputs'] = [];

        for (const output of jupyterCell.outputs || []) {
          if (output.output_type === 'stream') {
            outputs.push({
              type: 'text',
              data: Array.isArray(output.text) ? output.text.join('\n') : String(output.text || ''),
            });
          } else if (output.output_type === 'error') {
            outputs.push({
              type: 'error',
              data: output.evalue || String(output),
            });
          } else if (
            output.output_type === 'display_data' ||
            output.output_type === 'execute_result'
          ) {
            if (output.data && output.data['image/png']) {
              outputs.push({
                type: 'image',
                data: `data:image/png;base64,${output.data['image/png']}`,
              });
            } else if (output.data && output.data['text/plain']) {
              outputs.push({
                type: 'text',
                data: Array.isArray(output.data['text/plain'])
                  ? output.data['text/plain'].join('\n')
                  : String(output.data['text/plain'] || ''),
              });
            }
          }
        }

        cells.push({
          id: `cell-${Date.now()}-${Math.random().toString(36).substring(7)}`,
          type: 'code',
          content: Array.isArray(jupyterCell.source)
            ? jupyterCell.source.join('\n')
            : String(jupyterCell.source || ''),
          language: 'python',
          executionCount: jupyterCell.execution_count || undefined,
          outputs: outputs.length > 0 ? outputs : undefined,
        });
      }
    }

    return cells;
  }

  /**
   * Create a new notebook cell
   */
  createCell(
    type: 'code' | 'markdown',
    content: string,
    language?: 'python' | 'javascript' | 'sql'
  ): NotebookCell {
    return {
      id: `cell-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      type,
      content,
      language: type === 'code' ? language || 'python' : undefined,
    };
  }

  /**
   * Execute a notebook and return updated cells with outputs
   */
  async executeNotebook(cells: NotebookCell[]): Promise<NotebookCell[]> {
    const updatedCells: NotebookCell[] = [];
    let executionCount = 1;

    for (const cell of cells) {
      if (cell.type === 'code' && cell.language === 'python') {
        // Execute code cell
        const result = await this.executeCell(cell.content, cell.language);

        const outputs: NotebookCell['outputs'] = [];

        if ((result as any).error) {
          outputs.push({
            type: 'error',
            data: (result as any).error,
          });
        }

        if (result.output) {
          outputs.push({
            type: 'text',
            data: result.output,
          });
        }

        if ((result as any).images && (result as any).images.length > 0) {
          for (const image of (result as any).images) {
            outputs.push({
              type: 'image',
              data: image,
            });
          }
        }

        if (result.data) {
          outputs.push({
            type: 'data',
            data: result.data,
          });
        }

        updatedCells.push({
          ...cell,
          executionCount: executionCount++,
          outputs: outputs.length > 0 ? outputs : undefined,
        });
      } else {
        // Markdown or other cells - just copy
        updatedCells.push(cell);
      }
    }

    return updatedCells;
  }
}

export const notebookService = new NotebookService();
