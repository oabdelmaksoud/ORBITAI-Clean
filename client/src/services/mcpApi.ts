/**
 * MCP API Service - Frontend service for MCP tool discovery and execution
 */

import { MCPServer } from '@orbitai/shared';

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: any;
}

/**
 * Discover MCP tools from active servers
 */
export async function discoverMCPTools(
  servers: MCPServer[]
): Promise<Record<string, MCPTool[]>> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/mcp/discover`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Bypass-Tunnel-Reminder': 'true' },
      body: JSON.stringify({ servers }),
      signal: AbortSignal.timeout(5000) // 5 second timeout
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Failed to discover MCP tools' }));
      throw new Error(error.message || 'Failed to discover MCP tools');
    }

    const result = await response.json();
    return result.data || {};
  } catch (error: any) {
    console.error('MCP tool discovery failed:', error);

    // Check if it's a network error (server down)
    const isNetworkError = error.name === 'AbortError' ||
      error.message?.includes('Failed to fetch') ||
      error.message?.includes('NetworkError') ||
      error.message?.includes('network') ||
      error.message?.includes('ECONNREFUSED');

    if (isNetworkError) {
      // Re-throw network errors so they can be handled by the caller
      throw new Error('Backend server is not running or unreachable');
    }

    // Return empty object on other errors to allow graceful degradation
    return {};
  }
}

/**
 * Test an MCP server to verify it's functional
 * Uses the discover endpoint as a fallback if test endpoint requires auth
 */
export async function testMCPServer(
  serverId: string,
  server?: MCPServer
): Promise<{ success: boolean; status: 'connected' | 'error' | 'not_configured' | 'degraded'; tools: MCPTool[]; message: string }> {
  try {
    // First, check if backend server is reachable
    try {
      const healthCheck = await fetch(`${API_BASE_URL}/health`, {
        method: 'GET',
        headers: { 'Bypass-Tunnel-Reminder': 'true' },
        signal: AbortSignal.timeout(3000) // 3 second timeout
      });
      if (!healthCheck.ok) {
        throw new Error('Backend server health check failed');
      }
    } catch (healthError: any) {
      // Server is not running or unreachable
      return {
        success: false,
        status: 'error',
        tools: [],
        message: 'Backend server is not running or unreachable. Please start the server.'
      };
    }

    // Get auth token using the same method as other API calls
    let token: string | null = null;
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const { getAuthToken } = await import('@src/services/api');
        token = getAuthToken();
      } catch (e) {
        // Fallback to direct localStorage access (try both keys)
        token = window.localStorage.getItem('authToken') || window.localStorage.getItem('token');
      }
    }

    // Check health endpoint first to see if server is not configured
    try {
      const healthResponse = await fetch(`${API_BASE_URL}/api/mcp-servers/${serverId}/health`, {
        method: 'GET',
        headers: { 'Bypass-Tunnel-Reminder': 'true', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) },
        signal: AbortSignal.timeout(3000) // 3 second timeout
      });

      if (healthResponse.ok) {
        const healthData = await healthResponse.json();
        const healthStatus = healthData.data?.status;
        if (healthStatus === 'not_configured') {
          return {
            success: false,
            status: 'not_configured',
            tools: [],
            message: healthData.data?.message || 'E2B_API_KEY not configured (optional feature)'
          };
        }
        // If status is 'degraded', return it (working but with limitations)
        if (healthStatus === 'degraded') {
          return {
            success: true, // Still working, just degraded
            status: 'degraded',
            tools: [],
            message: healthData.data?.message || 'Working with limitations (using fallback mode)'
          };
        }
      }
    } catch (healthError) {
      // Health check failed, continue with test endpoint
      console.log(`Health check failed for ${serverId}, continuing with test...`);
    }

    // Try the test endpoint first (requires auth)
    if (token) {
      try {
        const response = await fetch(`${API_BASE_URL}/api/mcp-servers/${serverId}/test`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Bypass-Tunnel-Reminder': 'true',
            'Authorization': `Bearer ${token}`
          },
          signal: AbortSignal.timeout(5000) // 5 second timeout
        });

        if (response.ok) {
          const result = await response.json();
          // Map backend status to frontend status
          const backendStatus = result.data?.status || 'error';
          const frontendStatus = backendStatus === 'not_configured' ? 'not_configured' :
            backendStatus === 'degraded' ? 'degraded' :
              backendStatus === 'connected' || backendStatus === 'healthy' ? 'connected' :
                'error';
          return {
            success: result.success,
            status: frontendStatus,
            tools: result.data?.tools || [],
            message: result.data?.message || result.message || 'Test completed'
          };
        } else if (response.status === 401) {
          // Auth failed, fall through to discover endpoint
          console.log(`Test endpoint requires auth for ${serverId}, using discover endpoint...`);
        }
      } catch (authError: any) {
        // Check if it's a network error
        if (authError.name === 'AbortError' || authError.message?.includes('Failed to fetch') || authError.message?.includes('network')) {
          return {
            success: false,
            status: 'error',
            tools: [],
            message: 'Backend server is not running or unreachable'
          };
        }
        // If request fails for other reasons, try discover endpoint as fallback
        console.log(`Test endpoint failed for ${serverId}, trying discover endpoint...`);
      }
    } else {
      // No token available, skip test endpoint and use discover
      console.log(`No auth token available for ${serverId}, using discover endpoint...`);
    }

    // Fallback: Use discover endpoint to test if server is functional
    // This doesn't require auth and works for system servers
    try {
      // Use provided server object, or try to find it from DEFAULT_MCP_SERVERS, or create minimal one
      let serverToTest: MCPServer;
      if (server) {
        // Use the provided server object (best case - preserves all fields including source)
        serverToTest = server;
      } else {
        // Try to import DEFAULT_MCP_SERVERS to get full server definition
        try {
          const { DEFAULT_MCP_SERVERS } = await import('@orbitai/shared');
          const foundServer = DEFAULT_MCP_SERVERS.find(s => s.id === serverId);
          if (foundServer) {
            serverToTest = foundServer;
          } else {
            // Fallback: create minimal server object with source field
            const isSystemServer = serverId.startsWith('mcp-sys-');
            serverToTest = {
              id: serverId,
              status: 'active',
              source: isSystemServer ? 'system' : 'user',
              name: isSystemServer ? (serverId === 'mcp-sys-1' ? 'E2B Sandbox' : serverId === 'mcp-sys-2' ? 'Knowledge Graph' : 'Google Search') : 'Unknown',
              description: '',
              tools: []
            };
          }
        } catch (importError) {
          // If constants can't be imported, create minimal server object
          const isSystemServer = serverId.startsWith('mcp-sys-');
          serverToTest = {
            id: serverId,
            status: 'active',
            source: isSystemServer ? 'system' : 'user',
            name: isSystemServer ? (serverId === 'mcp-sys-1' ? 'E2B Sandbox' : serverId === 'mcp-sys-2' ? 'Knowledge Graph' : 'Google Search') : 'Unknown',
            description: '',
            tools: []
          };
        }
      }

      const tools = await discoverMCPTools([serverToTest]);
      const serverTools = tools[serverId] || [];

      // Check if we got any tools - if not, server might be down
      if (serverTools.length === 0) {
        return {
          success: false,
          status: 'error',
          tools: [],
          message: 'No tools discovered - server may be offline or misconfigured'
        };
      }

      return {
        success: true,
        status: 'connected',
        tools: serverTools,
        message: `Connected - ${serverTools.length} tools available`
      };
    } catch (discoverError: any) {
      console.error(`[MCP API] Discover failed for ${serverId}:`, discoverError);

      // Check if it's a network error (server down)
      const isNetworkError = discoverError.message?.includes('Backend server is not running') ||
        discoverError.message?.includes('Failed to fetch') ||
        discoverError.message?.includes('NetworkError') ||
        discoverError.message?.includes('network') ||
        discoverError.name === 'TypeError' ||
        discoverError.name === 'AbortError' ||
        discoverError.message?.includes('ECONNREFUSED') ||
        discoverError.message?.includes('timeout');

      return {
        success: false,
        status: 'error',
        tools: [],
        message: isNetworkError
          ? 'Backend server is not running or unreachable'
          : (discoverError.message || 'Failed to discover tools')
      };
    }
  } catch (error: any) {
    console.error('MCP server test failed:', error);

    // Check if it's a network error (server down)
    const isNetworkError = error.message?.includes('Backend server is not running') ||
      error.message?.includes('Failed to fetch') ||
      error.name === 'AbortError' ||
      error.message?.includes('timeout') ||
      error.message?.includes('ECONNREFUSED');

    return {
      success: false,
      status: 'error',
      tools: [],
      message: isNetworkError
        ? 'Backend server is not running or unreachable'
        : (error.message || 'Failed to test MCP server')
    };
  }
}

/**
 * Call an MCP tool
 */
export async function callMCPTool(
  serverId: string,
  toolName: string,
  args: Record<string, any>
): Promise<any> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/mcp/call`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Bypass-Tunnel-Reminder': 'true' },
      body: JSON.stringify({
        serverId,
        toolName,
        args
      })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Failed to call MCP tool' }));
      throw new Error(error.message || 'Failed to call MCP tool');
    }

    const result = await response.json();
    return result.data;
  } catch (error) {
    console.error('MCP tool call failed:', error);
    throw error;
  }
}

