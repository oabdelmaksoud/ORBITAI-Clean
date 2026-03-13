import { Artifact } from '@orbitai/shared';
import { generateEmbedding } from './geminiService';

export interface CodeSymbol {
  name: string;
  type: 'function' | 'class' | 'variable' | 'interface' | 'type' | 'component';
  filePath: string;
  line: number;
  signature?: string;
  description?: string;
}

export interface IndexedFile {
  path: string;
  content: string;
  language: string;
  symbols: CodeSymbol[];
  embedding?: number[];
  lastIndexed: number;
}

class CodebaseIndexer {
  private index: Map<string, IndexedFile> = new Map();
  private symbolIndex: Map<string, CodeSymbol[]> = new Map(); // symbol name -> symbols

  /**
   * Index artifacts from the project
   */
  async indexArtifacts(artifacts: Artifact[]): Promise<void> {
    for (const artifact of artifacts) {
      if (artifact.type === 'code') {
        await this.indexFile(artifact.title, artifact.content, this.getLanguageFromTitle(artifact.title));
      }
    }
  }

  /**
   * Index a single file
   */
  async indexFile(path: string, content: string, language: string): Promise<void> {
    const symbols = this.extractSymbols(content, language, path);
    
    // Generate embedding for semantic search
    let embedding: number[] | undefined;
    try {
      const embeddingText = this.getEmbeddingText(content, symbols);
      embedding = await generateEmbedding(embeddingText);
    } catch (error) {
      console.warn('Failed to generate embedding for file:', path, error);
    }

    const indexedFile: IndexedFile = {
      path,
      content,
      language,
      symbols,
      embedding,
      lastIndexed: Date.now()
    };

    this.index.set(path, indexedFile);

    // Update symbol index
    for (const symbol of symbols) {
      if (!this.symbolIndex.has(symbol.name)) {
        this.symbolIndex.set(symbol.name, []);
      }
      this.symbolIndex.get(symbol.name)!.push(symbol);
    }
  }

  /**
   * Extract symbols from code
   */
  private extractSymbols(content: string, language: string, filePath: string): CodeSymbol[] {
    const symbols: CodeSymbol[] = [];
    const lines = content.split('\n');

    // Simple regex-based extraction (can be enhanced with proper parsers)
    if (language === 'typescript' || language === 'javascript') {
      // Functions
      const functionRegex = /(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(/g;
      let match;
      let lineNum = 0;
      for (const line of lines) {
        lineNum++;
        while ((match = functionRegex.exec(line)) !== null) {
          symbols.push({
            name: match[1],
            type: 'function',
            filePath,
            line: lineNum,
            signature: line.trim()
          });
        }
        functionRegex.lastIndex = 0;
      }

      // Classes
      const classRegex = /(?:export\s+)?class\s+(\w+)/g;
      lineNum = 0;
      for (const line of lines) {
        lineNum++;
        while ((match = classRegex.exec(line)) !== null) {
          symbols.push({
            name: match[1],
            type: 'class',
            filePath,
            line: lineNum,
            signature: line.trim()
          });
        }
        classRegex.lastIndex = 0;
      }

      // Interfaces/Types
      const interfaceRegex = /(?:export\s+)?(?:interface|type)\s+(\w+)/g;
      lineNum = 0;
      for (const line of lines) {
        lineNum++;
        while ((match = interfaceRegex.exec(line)) !== null) {
          symbols.push({
            name: match[1],
            type: line.includes('interface') ? 'interface' : 'type',
            filePath,
            line: lineNum,
            signature: line.trim()
          });
        }
        interfaceRegex.lastIndex = 0;
      }

      // React Components
      const componentRegex = /(?:export\s+)?(?:const|function)\s+(\w+)\s*[:=]\s*(?:React\.)?(?:FC|Component|forwardRef)/g;
      lineNum = 0;
      for (const line of lines) {
        lineNum++;
        while ((match = componentRegex.exec(line)) !== null) {
          symbols.push({
            name: match[1],
            type: 'component',
            filePath,
            line: lineNum,
            signature: line.trim()
          });
        }
        componentRegex.lastIndex = 0;
      }
    }

    return symbols;
  }

  /**
   * Get text for embedding generation
   */
  private getEmbeddingText(content: string, symbols: CodeSymbol[]): string {
    const symbolDescriptions = symbols.map(s => 
      `${s.type} ${s.name}${s.signature ? `: ${s.signature}` : ''}`
    ).join('\n');
    
    return `File content:\n${content.substring(0, 2000)}\n\nSymbols:\n${symbolDescriptions}`;
  }

  /**
   * Get language from file path/name
   */
  private getLanguageFromTitle(title: string): string {
    const lower = title.toLowerCase();
    if (lower.endsWith('.ts') || lower.endsWith('.tsx')) return 'typescript';
    if (lower.endsWith('.js') || lower.endsWith('.jsx')) return 'javascript';
    if (lower.endsWith('.py')) return 'python';
    if (lower.endsWith('.java')) return 'java';
    if (lower.endsWith('.cs')) return 'csharp';
    if (lower.endsWith('.cpp') || lower.endsWith('.c')) return 'cpp';
    return 'text';
  }

  /**
   * Search for symbols by name
   */
  findSymbol(name: string): CodeSymbol[] {
    return this.symbolIndex.get(name) || [];
  }

  /**
   * Get all symbols in a file
   */
  getFileSymbols(filePath: string): CodeSymbol[] {
    return this.index.get(filePath)?.symbols || [];
  }

  /**
   * Get file by path
   */
  getFile(filePath: string): IndexedFile | undefined {
    return this.index.get(filePath);
  }

  /**
   * Search files by text
   */
  searchFiles(query: string): IndexedFile[] {
    const lowerQuery = query.toLowerCase();
    const results: IndexedFile[] = [];

    for (const file of this.index.values()) {
      if (
        file.path.toLowerCase().includes(lowerQuery) ||
        file.content.toLowerCase().includes(lowerQuery) ||
        file.symbols.some(s => s.name.toLowerCase().includes(lowerQuery))
      ) {
        results.push(file);
      }
    }

    return results;
  }

  /**
   * Clear index
   */
  clear(): void {
    this.index.clear();
    this.symbolIndex.clear();
  }
}

// Singleton instance
export const codebaseIndexer = new CodebaseIndexer();
















