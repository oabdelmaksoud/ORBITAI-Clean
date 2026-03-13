import { codebaseIndexer, CodeSymbol, IndexedFile } from './codebaseIndexer';
import { Artifact } from '@orbitai/shared';

const API_BASE_URL = ((import.meta as any)?.env?.VITE_API_URL) || '';

export interface SearchResult {
  file: IndexedFile;
  symbols: CodeSymbol[];
  relevance: number;
  matchType: 'exact' | 'partial' | 'semantic';
}

export interface CodebaseSearchRequest {
  query: string;
  type?: 'symbol' | 'file' | 'semantic' | 'all';
  limit?: number;
}

/**
 * Search the codebase
 */
export async function searchCodebase(
  artifacts: Artifact[],
  request: CodebaseSearchRequest
): Promise<SearchResult[]> {
  // Ensure codebase is indexed
  await codebaseIndexer.indexArtifacts(artifacts);

  const { query, type = 'all', limit = 20 } = request;
  const results: SearchResult[] = [];

  // Symbol search
  if (type === 'symbol' || type === 'all') {
    const symbols = codebaseIndexer.findSymbol(query);
    const symbolFiles = new Set<string>();
    
    for (const symbol of symbols) {
      symbolFiles.add(symbol.filePath);
    }

    for (const filePath of symbolFiles) {
      const file = codebaseIndexer.getFile(filePath);
      if (file) {
        const fileSymbols = file.symbols.filter(s => 
          s.name.toLowerCase().includes(query.toLowerCase())
        );
        results.push({
          file,
          symbols: fileSymbols,
          relevance: fileSymbols.length > 0 ? 1.0 : 0.5,
          matchType: 'exact'
        });
      }
    }
  }

  // File search
  if (type === 'file' || type === 'all') {
    const files = codebaseIndexer.searchFiles(query);
    for (const file of files) {
      // Avoid duplicates
      if (!results.find(r => r.file.path === file.path)) {
        const matchingSymbols = file.symbols.filter(s =>
          s.name.toLowerCase().includes(query.toLowerCase()) ||
          file.path.toLowerCase().includes(query.toLowerCase())
        );
        results.push({
          file,
          symbols: matchingSymbols,
          relevance: file.path.toLowerCase().includes(query.toLowerCase()) ? 0.8 : 0.6,
          matchType: 'partial'
        });
      }
    }
  }

  // Semantic search (if embeddings available)
  if (type === 'semantic' || type === 'all') {
    try {
      const semanticResults = await semanticSearch(query, artifacts);
      results.push(...semanticResults);
    } catch (error) {
      console.warn('Semantic search failed:', error);
    }
  }

  // Sort by relevance and limit
  return results
    .sort((a, b) => b.relevance - a.relevance)
    .slice(0, limit);
}

/**
 * Semantic search using embeddings
 */
async function semanticSearch(
  query: string,
  artifacts: Artifact[]
): Promise<SearchResult[]> {
  try {
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem('authToken') : null;
    
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    const response = await fetch(`${API_BASE_URL}/api/codebase/search`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ query, artifacts })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const result = await response.json();
    return result.data || [];
  } catch (error: any) {
    console.error('Semantic search failed:', error);
    return [];
  }
}

/**
 * Find definition of a symbol
 */
export async function findDefinition(symbolName: string, artifacts: Artifact[]): Promise<CodeSymbol | null> {
  await codebaseIndexer.indexArtifacts(artifacts);
  const symbols = codebaseIndexer.findSymbol(symbolName);
  return symbols.length > 0 ? symbols[0] : null;
}

/**
 * Find all references to a symbol
 */
export async function findReferences(symbolName: string, artifacts: Artifact[]): Promise<CodeSymbol[]> {
  await codebaseIndexer.indexArtifacts(artifacts);
  return codebaseIndexer.findSymbol(symbolName);
}

