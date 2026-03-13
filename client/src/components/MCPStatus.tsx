import React, { useState, useEffect, useCallback } from 'react';
import { MCPServer } from '@orbitai/shared';
import { Server, Wifi, Play, Activity, Lock, Cpu, CloudLightning, CheckCircle2, XCircle, Loader2, RefreshCw } from 'lucide-react';
import { testMCPServer } from '../services/mcpApi';

interface MCPStatusProps {
  servers: MCPServer[];
}

interface ServerTestStatus {
  status: 'idle' | 'testing' | 'connected' | 'error' | 'not_configured' | 'degraded';
  tools: number;
  message?: string;
}

const MCPStatus: React.FC<MCPStatusProps> = ({ servers }) => {
  const [testStatuses, setTestStatuses] = useState<Record<string, ServerTestStatus>>({});
  const [testingServers, setTestingServers] = useState<Set<string>>(new Set());

  const testServer = useCallback(async (server: MCPServer) => {
    const serverId = server.id;
    setTestingServers(prev => new Set(prev).add(serverId));
    setTestStatuses(prev => ({
      ...prev,
      [serverId]: { status: 'testing', tools: 0 }
    }));

    try {
      // Pass the full server object to ensure source field is preserved
      const result = await testMCPServer(serverId, server);
      setTestStatuses(prev => ({
        ...prev,
        [serverId]: {
          status: result.status === 'connected' ? 'connected' : 'error',
          tools: result.tools.length,
          message: result.message
        }
      }));
    } catch (error: any) {
      console.error(`MCP server test failed for ${serverId}:`, error);
      setTestStatuses(prev => ({
        ...prev,
        [serverId]: {
          status: 'error',
          tools: 0,
          message: error.message || 'Test failed'
        }
      }));
    } finally {
      setTestingServers(prev => {
        const next = new Set(prev);
        next.delete(serverId);
        return next;
      });
    }
  }, []); // Empty dependency array - testServer doesn't depend on any props/state

  // Test servers: in-use servers frequently, standby servers occasionally for health checks
  useEffect(() => {
    console.log('[MCPStatus] Component mounted/updated, servers:', servers.length, servers.map(s => ({ id: s.id, name: s.name, status: s.status, inUse: s.inUse, source: s.source })));
    
    const testInUseServers = async () => {
      // Test servers that are marked as in use (actively connected for tasks)
      const inUseServers = servers.filter(s => s.status === 'active' && s.inUse === true);
      console.log('[MCPStatus] Servers in use:', inUseServers.length);
      
      for (const server of inUseServers) {
        console.log(`[MCPStatus] Testing server in use: ${server.id} (${server.name})`);
        await testServer(server);
        // Small delay between tests to avoid overwhelming the API
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      console.log('[MCPStatus] All in-use servers tested');
    };
    
    const testStandbyServers = async () => {
      // Test standby servers occasionally to check for errors (less frequent)
      const standbyServers = servers.filter(s => s.status === 'active' && s.inUse !== true);
      console.log('[MCPStatus] Standby servers:', standbyServers.length);
      
      if (standbyServers.length === 0) {
        return;
      }
      
      // Test one standby server per cycle to avoid overwhelming the API
      const serverToTest = standbyServers[Math.floor(Math.random() * standbyServers.length)];
      console.log(`[MCPStatus] Health check for standby server: ${serverToTest.id} (${serverToTest.name})`);
      await testServer(serverToTest);
    };
    
    if (servers.length > 0) {
      // Test in-use servers immediately
      testInUseServers();
      
      // Test standby servers occasionally (health check)
      testStandbyServers();
      
      // Refresh in-use servers every 10 seconds (more frequent since they're active)
      const inUseIntervalId = setInterval(() => {
        const inUseCount = servers.filter(s => s.status === 'active' && s.inUse === true).length;
        if (inUseCount > 0) {
          console.log('[MCPStatus] Periodic refresh triggered for in-use servers');
          testInUseServers();
        }
      }, 10000); // 10 seconds for active connections
      
      // Health check standby servers every 60 seconds (less frequent)
      const standbyIntervalId = setInterval(() => {
        const standbyCount = servers.filter(s => s.status === 'active' && s.inUse !== true).length;
        if (standbyCount > 0) {
          console.log('[MCPStatus] Health check for standby servers');
          testStandbyServers();
        }
      }, 60000); // 60 seconds for standby health checks
      
      // Cleanup intervals on unmount
      return () => {
        console.log('[MCPStatus] Cleaning up intervals');
        clearInterval(inUseIntervalId);
        clearInterval(standbyIntervalId);
      };
    } else {
      console.log('[MCPStatus] No servers to test, skipping');
    }
  }, [servers.length, testServer, servers.map(s => s.inUse).join(',')]); // Re-run when server count, inUse status, or testServer changes

  if (servers.length === 0) return null;

  return (
    <div className="mt-4 px-3">
       <div className="flex items-center justify-between mb-2">
         <h3 className="text-[10px] font-bold text-success uppercase tracking-widest flex items-center gap-2">
            <Server size={12} /> Active MCPs
         </h3>
         <span className="text-[10px] bg-white border border-slate-200 px-1.5 py-0.5 rounded text-success">{servers.length}</span>
       </div>
       
       <div className="mb-2 p-2 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded flex items-center gap-2 shadow-sm">
            <CloudLightning size={12} className="text-blue-600 animate-pulse" />
            <div>
                <div className="text-[9px] font-bold text-blue-700 uppercase tracking-wide">E2B Cloud Uplink</div>
                <div className="text-[8px] text-blue-500">Secure Sandbox Environment: Available (connects on use)</div>
            </div>
       </div>

       <div className="space-y-2">
         {servers.map(server => {
            const isSystem = server.source === 'system';
            const testStatus = testStatuses[server.id] || { status: 'idle' as const, tools: 0 };
            const isTesting = testingServers.has(server.id);
            const isInUse = server.inUse === true; // Server is actively connected for a task
            const isConnected = isInUse && testStatus.status === 'connected'; // Only show connected if in use
            const hasError = testStatus.status === 'error'; // Error status (regardless of inUse)
            const isNotConfigured = testStatus.status === 'not_configured'; // Optional feature not configured
            const isDegraded = testStatus.status === 'degraded'; // Working but with limitations (e.g., fallback mode)
            const isStandby = !isInUse && !hasError && !isNotConfigured && !isDegraded; // Standby: not in use and no errors
            
            return (
            <div key={server.id} className={`p-2 rounded border group transition-colors relative overflow-hidden ${isSystem ? 'bg-slate-100 border-slate-200 hover:bg-slate-200' : isInUse && isConnected ? 'bg-white border-success/30 hover:border-success/50 shadow-sm' : hasError ? 'bg-white border-red-200 hover:border-red-300' : isNotConfigured ? 'bg-white border-amber-200 hover:border-amber-300' : isDegraded ? 'bg-white border-blue-200 hover:border-blue-300' : isStandby ? 'bg-white border-slate-200 hover:border-slate-300' : 'bg-white border-slate-200 hover:border-slate-300'}`}>
                <div className="flex justify-between items-start relative z-10">
                    <div className="min-w-0 flex-1">
                        <div className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
                            <span className="truncate">{server.name}</span>
                            {isSystem ? <Lock size={8} className="text-slate-400 opacity-50 shrink-0" /> : isTesting ? <Loader2 size={8} className="text-blue-500 animate-spin shrink-0" /> : isConnected && isInUse ? <CheckCircle2 size={8} className="text-success shrink-0" /> : hasError ? <XCircle size={8} className="text-red-500 shrink-0" /> : isNotConfigured ? <Activity size={8} className="text-amber-500 shrink-0" /> : isDegraded ? <Activity size={8} className="text-blue-500 shrink-0" /> : isStandby ? <Activity size={8} className="text-slate-400 shrink-0" /> : <Activity size={8} className="text-slate-400 shrink-0" />}
                        </div>
                        <div className="text-[9px] text-slate-500 mt-0.5 flex flex-wrap gap-1">
                            {isTesting ? (
                                <span className="text-blue-500 italic">Testing...</span>
                            ) : isConnected && isInUse ? (
                                <>
                                    <span className="text-success font-bold">{testStatus.tools} tools</span>
                                    <span className="text-[8px] text-success italic">(in use)</span>
                                    {server.tools.slice(0, 2).map((t, i) => (
                                        <span key={i} className="bg-slate-50 border border-slate-200 px-1 rounded truncate max-w-[80px]" title={t}>{t}</span>
                                    ))}
                                    {server.tools.length > 2 && <span>+{server.tools.length - 2}</span>}
                                </>
                            ) : hasError ? (
                                <>
                                    <span className="text-red-500 font-bold text-[8px]">ERROR</span>
                                    <span className="text-red-500 italic text-[8px]">{testStatus.message || 'Connection failed'}</span>
                                </>
                            ) : isNotConfigured ? (
                                <>
                                    <span className="text-amber-500 font-bold text-[8px]">OPTIONAL</span>
                                    <span className="text-amber-600 italic text-[8px]">{testStatus.message || 'Not configured'}</span>
                                </>
                            ) : isDegraded ? (
                                <>
                                    <span className="text-blue-500 font-bold text-[8px]">DEGRADED</span>
                                    <span className="text-blue-600 italic text-[8px]">{testStatus.message || 'Working with limitations'}</span>
                                </>
                            ) : isStandby ? (
                                <>
                                    <span className="text-[8px] text-slate-400 italic">Standby</span>
                                    {server.tools.slice(0, 2).map((t, i) => (
                                        <span key={i} className="bg-slate-50 border border-slate-200 px-1 rounded truncate max-w-[80px]" title={t}>{t}</span>
                                    ))}
                                    {server.tools.length > 2 && <span>+{server.tools.length - 2}</span>}
                                </>
                            ) : (
                                <>
                                    <span className="text-[8px] text-slate-400 italic">Available</span>
                                    {server.tools.slice(0, 2).map((t, i) => (
                                        <span key={i} className="bg-slate-50 border border-slate-200 px-1 rounded truncate max-w-[80px]" title={t}>{t}</span>
                                    ))}
                                    {server.tools.length > 2 && <span>+{server.tools.length - 2}</span>}
                                </>
                            )}
                        </div>
                        <div className="mt-1.5 flex items-center gap-2 text-[8px] font-mono text-slate-400 uppercase font-bold">
                            {isSystem ? (
                                <span className="flex items-center gap-0.5 text-blue-500">SYSTEM CORE</span>
                            ) : server.source === 'agent' ? (
                                <span className="flex items-center gap-0.5 text-purple-600">AGENT CREATED</span>
                            ) : (
                                <span className="flex items-center gap-0.5 text-green-600">USER PROCESS</span>
                            )}
                        </div>
                    </div>
                    <div className="flex flex-col items-center gap-1 ml-2 mt-0.5 shrink-0">
                        {isTesting ? (
                            <>
                                <Loader2 size={12} className="text-blue-500 animate-spin" />
                                <span className="text-[7px] font-bold text-blue-500 uppercase">TESTING</span>
                            </>
                        ) : isConnected && isInUse ? (
                            <>
                                <div className="w-2 h-2 rounded-full bg-success animate-pulse shadow-[0_0_5px_#10b981]"></div>
                                <span className="text-[7px] font-bold text-success uppercase">IN USE</span>
                            </>
                        ) : hasError ? (
                            <>
                                <XCircle size={12} className="text-red-500" />
                                <span className="text-[7px] font-bold text-red-500 uppercase">ERROR</span>
                            </>
                        ) : isStandby ? (
                            <>
                                <div className="w-1.5 h-1.5 rounded-full bg-slate-400"></div>
                                <span className="text-[7px] font-bold text-slate-500 uppercase">STANDBY</span>
                            </>
                        ) : isSystem ? (
                            <>
                                <div className="w-1.5 h-1.5 rounded-full bg-slate-400"></div>
                                <span className="text-[7px] font-bold text-slate-500 uppercase">STANDBY</span>
                            </>
                        ) : (
                            <>
                                <div className="w-2 h-2 rounded-full bg-slate-300"></div>
                                <span className="text-[7px] font-bold text-slate-400 uppercase">STANDBY</span>
                            </>
                        )}
                        {!isSystem && !isTesting && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    testServer(server);
                                }}
                                className="mt-1 p-1 hover:bg-slate-100 rounded transition-colors"
                                title="Test MCP Server"
                            >
                                <RefreshCw size={10} className="text-slate-400 hover:text-primary" />
                            </button>
                        )}
                    </div>
                </div>
            </div>
            );
         })}
       </div>
    </div>
  );
};

export default MCPStatus;