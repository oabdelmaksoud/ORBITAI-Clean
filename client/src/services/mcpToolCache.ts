/**
 * MCP Tool Cache - In-memory cache for MCP tool discovery results
 */

import { MCPServer } from '@orbitai/shared';
import { MCPTool } from './mcpApi';

interface CacheEntry {
  tools: Record<string, MCPTool[]>;
  timestamp: number;
}

// Cache with TTL of 5 minutes
const CACHE_TTL = 5 * 60 * 1000;
const cache = new Map<string, CacheEntry>();

/**
 * Generate a cache key from server IDs
 */
export function generateServersKey(servers: MCPServer[]): string {
  const serverIds = servers
    .filter(s => s.status === 'active')
    .map(s => s.id)
    .sort()
    .join(',');
  return serverIds;
}

/**
 * Get cached tools for a server key
 */
export function getCachedTools(serversKey: string): Record<string, MCPTool[]> | null {
  const entry = cache.get(serversKey);
  
  if (!entry) {
    return null;
  }

  // Check if cache entry is expired
  const now = Date.now();
  if (now - entry.timestamp > CACHE_TTL) {
    cache.delete(serversKey);
    return null;
  }

  return entry.tools;
}

/**
 * Set cached tools for a server key
 */
export function setCachedTools(serversKey: string, tools: Record<string, MCPTool[]>): void {
  cache.set(serversKey, {
    tools,
    timestamp: Date.now()
  });
}

/**
 * Clear all cached tools
 */
export function clearCache(): void {
  cache.clear();
}

/**
 * Clear expired cache entries
 */
export function clearExpiredCache(): void {
  const now = Date.now();
  for (const [key, entry] of cache.entries()) {
    if (now - entry.timestamp > CACHE_TTL) {
      cache.delete(key);
    }
  }
}

