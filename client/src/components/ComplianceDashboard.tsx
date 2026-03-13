
import React, { useState } from 'react';
import { Artifact, Phase, QualityStandard, Task, TaskStatus, AgentRole } from '@orbitai/shared';
import { QUALITY_STANDARDS } from '@orbitai/shared';
import { ShieldCheck, AlertTriangle, CheckCircle, FileText, Play, Plus, Activity, Lock, X, PieChart, BarChart3, AlertCircle, Trash2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface ComplianceDashboardProps {
  activeStandards: string[];
  artifacts: Artifact[];
  tasks: Task[];
  onAddStandard: (id: string) => void;
  onRemoveStandard: (id: string) => void;
  onRunAudit: (standardId: string) => void;
  isProcessing: boolean;
}

const ComplianceDashboard: React.FC<ComplianceDashboardProps> = ({ 
  activeStandards, artifacts, tasks, onAddStandard, onRemoveStandard, onRunAudit, isProcessing 
}) => {
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [selectedReport, setSelectedReport] = useState<Artifact | null>(null);

  // Filter artifacts for audit reports
  const auditReports = artifacts.filter(a => a.type === 'audit-report');

  // Find available standards not yet active
  const availableStandards = QUALITY_STANDARDS.filter(s => !activeStandards.includes(s.id));

  const getLatestReportForStandard = (stdId: string) => {
    const stdName = QUALITY_STANDARDS.find(s => s.id === stdId)?.name || stdId;
    // Match partial names to be robust
    return auditReports.find(a => a.title.includes(stdName) || (a.traceRefs && a.traceRefs.includes(stdId)));
  };

  // Helper to parse report data
  const parseAuditReport = (report: Artifact | undefined) => {
      if (!report) return { status: 'pending', issues: 0, score: 0 };
      
      const content = report.content;
      
      // 1. Try JSON Metadata Parsing
      const metadataMatch = content.match(/<!-- AUDIT_METADATA\s*([\s\S]*?)\s*-->/);
      if (metadataMatch) {
          try {
              const meta = JSON.parse(metadataMatch[1]);
              return {
                  status: (meta.status === 'PASS' ? 'pass' : 'fail') as 'pass' | 'fail' | 'pending',
                  issues: typeof meta.critical_issues === 'number' ? meta.critical_issues : 0,
                  score: typeof meta.score === 'number' ? meta.score : 0
              };
          } catch (e) {
              console.error("Metadata parse error", e);
          }
      }

      // 2. Fallback Regex Parsing (Legacy)
      const lower = content.toLowerCase();
      let status: 'pass' | 'fail' | 'pending' = 'pass';
      let issues = 0;
      
      const failureRegex = /(status:\s*fail)|(compliance:\s*fail)|(result:\s*fail)|(non-compliant)|(violations? found)|(issues? detected)|(gaps? detected)|(critical issues?:?\s*yes)/i;
      const tableFail = /\|\s*fail\s*\|/i.test(lower) || /\|\s*no\s*\|/i.test(lower);
      
      if (lower.includes('overall status: fail') || lower.includes('overall status: failed') || failureRegex.test(lower) || tableFail) {
          status = 'fail';
          issues = 1; // At least one
      }
      
      return { status, issues, score: status === 'pass' ? 100 : 50 };
  };

  const getAuditStatus = (stdId: string) => {
    const stdName = QUALITY_STANDARDS.find(s => s.id === stdId)?.name || stdId;
    const runningTask = tasks.find(t => 
        t.status === TaskStatus.IN_PROGRESS && 
        t.title.includes('Audit') && 
        t.title.includes(stdName)
    );
    if (runningTask) return 'running';
    
    const report = getLatestReportForStandard(stdId);
    if (report) {
        return parseAuditReport(report).status;
    }
    return 'pending';
  };

  // Calculate Metrics based on Parsed Data
  const totalActive = activeStandards.length;
  const metrics = activeStandards.map(id => {
      const report = getLatestReportForStandard(id);
      return parseAuditReport(report);
  });

  const passedCount = metrics.filter(m => m.status === 'pass').length;
  const failedCount = metrics.filter(m => m.status === 'fail').length;
  const totalIssues = metrics.reduce((acc, m) => acc + m.issues, 0);
  const pendingCount = activeStandards.filter(id => getAuditStatus(id) === 'pending').length;
  
  // Score calculation
  const complianceScore = totalActive > 0 ? Math.round((passedCount / totalActive) * 100) : 0;

  return (
    <div className="h-full flex flex-col bg-slate-50 relative">
      
      {/* Report Viewer Modal */}
      {selectedReport && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-8 animate-in fade-in duration-200">
              <div className="bg-white w-full max-w-3xl h-full max-h-[80vh] rounded-xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95">
                  <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                      <div>
                          <h3 className="text-sm font-bold text-slate-800">{selectedReport.title}</h3>
                          <div className="text-[10px] text-slate-500 font-mono flex items-center gap-2">
                              <span>{new Date(selectedReport.timestamp).toLocaleTimeString()}</span>
                              <span>•</span>
                              <span>{selectedReport.createdBy}</span>
                          </div>
                      </div>
                      <button onClick={() => setSelectedReport(null)} className="p-1 hover:bg-slate-200 rounded text-slate-500">
                          <X size={20} />
                      </button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                      <div className="prose prose-sm max-w-none prose-p:text-slate-700 prose-headings:text-slate-900 prose-li:text-slate-700">
                        <ReactMarkdown>{selectedReport.content}</ReactMarkdown>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* Header */}
      <div className="p-6 bg-white border-b border-slate-200 shadow-sm flex items-center justify-between shrink-0 z-10">
         <div>
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <ShieldCheck className="text-primary" /> Compliance Control Center
            </h2>
            <p className="text-xs text-slate-500 mt-1">
                Monitor adherence to industry standards and trigger quality audits.
            </p>
         </div>
         
         <div className="relative">
            <button 
                onClick={() => setShowAddMenu(!showAddMenu)}
                className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-slate-700 transition-colors shadow-sm"
            >
                <Plus size={14} /> Add Standard
            </button>
            
            {showAddMenu && (
                <div className="absolute top-full right-0 mt-2 w-64 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in-95">
                    <div className="p-2 bg-slate-50 border-b border-slate-100 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                        Available Standards
                    </div>
                    <div className="max-h-48 overflow-y-auto">
                        {availableStandards.length === 0 ? (
                            <div className="p-4 text-center text-xs text-slate-400">All standards active</div>
                        ) : (
                            availableStandards.map(std => (
                                <button
                                    key={std.id}
                                    onClick={() => {
                                        onAddStandard(std.id);
                                        setShowAddMenu(false);
                                    }}
                                    className="w-full text-left px-4 py-2 hover:bg-slate-50 text-xs font-medium text-slate-700 border-b border-slate-100 last:border-0"
                                >
                                    {std.name}
                                </button>
                            ))
                        )}
                    </div>
                </div>
            )}
         </div>
      </div>

      {/* Metrics Dashboard */}
      {activeStandards.length > 0 && (
          <div className="grid grid-cols-4 gap-4 p-6 pb-2">
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center border border-slate-200 relative">
                        <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                            <path className="text-slate-200" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="4" />
                            <path className={complianceScore < 50 ? "text-error" : "text-primary"} strokeDasharray={`${complianceScore}, 100`} d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="4" />
                        </svg>
                        <span className="absolute text-[10px] font-bold text-slate-700">{complianceScore}%</span>
                  </div>
                  <div>
                      <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Compliance Score</div>
                      <div className="text-lg font-bold text-slate-800">{complianceScore >= 80 ? 'Excellent' : complianceScore >= 50 ? 'Moderate' : 'Critical'}</div>
                  </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-2">
                      <PieChart size={12} /> Active Standards
                  </div>
                  <div className="text-2xl font-bold text-slate-800">{totalActive}</div>
                  <div className="text-[10px] text-slate-500">{pendingCount} Pending Audit</div>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                   <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-2">
                      <CheckCircle size={12} className="text-success" /> Passing
                  </div>
                  <div className="text-2xl font-bold text-success">{passedCount}</div>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                   <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-2">
                      <AlertCircle size={12} className="text-error" /> Total Issues
                  </div>
                  <div className="text-2xl font-bold text-error">{totalIssues + failedCount}</div>
              </div>
          </div>
      )}

      <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
         {/* Active Standards Grid */}
         {activeStandards.length === 0 ? (
             <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50 text-slate-400 mt-8">
                 <ShieldCheck size={48} className="mb-4 opacity-50" />
                 <p className="text-sm font-bold text-slate-500">No Compliance Standards Active</p>
                 <p className="text-xs mt-1 text-slate-400">Add a standard to enable specialized audits.</p>
             </div>
         ) : (
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {activeStandards.map(stdId => {
                    const std = QUALITY_STANDARDS.find(s => s.id === stdId);
                    const status = getAuditStatus(stdId);
                    const report = getLatestReportForStandard(stdId);
                    const parsedData = parseAuditReport(report);
                    
                    if (!std) return null;

                    return (
                        <div key={stdId} className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden group hover:shadow-md transition-shadow flex flex-col">
                            <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-start">
                                <div>
                                    <h3 className="font-bold text-slate-800 text-sm">{std.name}</h3>
                                    <p className="text-[10px] text-slate-500 mt-0.5 line-clamp-1">{std.description}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className={`w-2 h-2 rounded-full ${
                                        status === 'pass' ? 'bg-success shadow-[0_0_5px_#10b981]' : 
                                        status === 'fail' ? 'bg-error shadow-[0_0_5px_#ef4444]' : 
                                        status === 'running' ? 'bg-primary animate-pulse' : 
                                        'bg-slate-300'
                                    }`} />
                                    <button 
                                        onClick={() => onRemoveStandard(stdId)}
                                        className="text-slate-300 hover:text-error transition-colors"
                                        title="Remove Standard"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>
                            
                            <div className="p-4 flex-1">
                                {status === 'running' ? (
                                    <div className="flex flex-col items-center justify-center py-4 text-primary">
                                        <Activity size={24} className="animate-pulse mb-2" />
                                        <span className="text-xs font-bold uppercase tracking-wider">Audit In Progress...</span>
                                    </div>
                                ) : report ? (
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between text-xs text-slate-600">
                                            <div className="flex items-center gap-2">
                                                {status === 'pass' ? <CheckCircle size={16} className="text-success" /> : <AlertTriangle size={16} className="text-error" />}
                                                <span className="font-bold">{status === 'pass' ? 'Compliance Verified' : 'Issues Detected'}</span>
                                            </div>
                                            {parsedData.issues > 0 && (
                                                <span className="bg-error/10 text-error px-2 py-0.5 rounded-full text-[10px] font-bold">
                                                    {parsedData.issues} Issues
                                                </span>
                                            )}
                                        </div>
                                        <div className="text-[10px] text-slate-500 line-clamp-3 bg-slate-50 p-2 rounded border border-slate-100 font-mono">
                                            {report.content.replace(/<!--[\s\S]*?-->/g, '').substring(0, 150)}...
                                        </div>
                                        <button 
                                            onClick={() => setSelectedReport(report)}
                                            className="text-[10px] text-primary hover:underline font-bold"
                                        >
                                            View Full Report
                                        </button>
                                    </div>
                                ) : (
                                    <div className="text-center py-4 text-slate-400 text-xs italic">
                                        No audit reports generated yet.
                                    </div>
                                )}
                            </div>

                            <div className="p-3 bg-slate-50 border-t border-slate-100 flex justify-end">
                                <button 
                                    onClick={() => onRunAudit(stdId)}
                                    disabled={isProcessing || status === 'running'}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:border-primary hover:text-primary rounded text-[10px] font-bold uppercase tracking-wider transition-colors disabled:opacity-50 shadow-sm"
                                >
                                    {status === 'running' ? 'Running...' : 'Run Audit'} <Play size={10} className="fill-current" />
                                </button>
                            </div>
                        </div>
                    );
                })}
             </div>
         )}
      </div>
    </div>
  );
};

export default ComplianceDashboard;
