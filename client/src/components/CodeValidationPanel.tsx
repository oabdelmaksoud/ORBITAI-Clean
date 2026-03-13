/**
 * Code Validation Panel Component
 * UI for validating generated code - syntax, types, best practices, security
 */

import React, { useState, useCallback } from 'react';
import { 
  CheckCircle2, XCircle, AlertTriangle, AlertCircle, Loader2, 
  FileCode, Shield, Sparkles, Play, RefreshCw, ChevronDown, ChevronRight,
  Code, Bug, Lightbulb, Lock, FileText, Copy, Check
} from 'lucide-react';
import { useFeatureAccess } from '../hooks/useFeatureAccess';

interface ValidationError {
  line: number;
  column: number;
  message: string;
  severity: 'error' | 'warning' | 'info';
  rule?: string;
}

interface ValidationResult {
  path: string;
  language: string;
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
  suggestions?: string[];
}

interface SecurityIssue {
  type: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  message: string;
  line?: number;
  recommendation: string;
}

interface CodeValidationPanelProps {
  projectId?: string;
  files?: Array<{ path: string; content: string; language?: string }>;
  token?: string;
  userRole?: string;
}

const CodeValidationPanel: React.FC<CodeValidationPanelProps> = ({
  projectId,
  files = [],
  token,
  userRole = 'user'
}) => {
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'syntax' | 'lint' | 'security' | 'practices'>('syntax');
  const [results, setResults] = useState<ValidationResult[]>([]);
  const [securityResults, setSecurityResults] = useState<SecurityIssue[]>([]);
  const [practicesResults, setPracticesResults] = useState<any>(null);
  const [codeInput, setCodeInput] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState('typescript');
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());
  const [copiedCode, setCopiedCode] = useState(false);

  const canValidate = useFeatureAccess('code_generation', userRole);

  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3002';
  const authToken = token || localStorage.getItem('authToken');

  const languages = [
    { id: 'typescript', name: 'TypeScript', extensions: ['.ts', '.tsx'] },
    { id: 'javascript', name: 'JavaScript', extensions: ['.js', '.jsx'] },
    { id: 'python', name: 'Python', extensions: ['.py'] },
    { id: 'go', name: 'Go', extensions: ['.go'] },
    { id: 'rust', name: 'Rust', extensions: ['.rs'] },
    { id: 'java', name: 'Java', extensions: ['.java'] },
    { id: 'csharp', name: 'C#', extensions: ['.cs'] },
    { id: 'ruby', name: 'Ruby', extensions: ['.rb'] },
    { id: 'php', name: 'PHP', extensions: ['.php'] },
    { id: 'swift', name: 'Swift', extensions: ['.swift'] },
    { id: 'kotlin', name: 'Kotlin', extensions: ['.kt'] },
  ];

  const validateSyntax = useCallback(async () => {
    if (!codeInput.trim() && files.length === 0) return;

    setLoading(true);
    try {
      const filesToValidate = codeInput.trim() 
        ? [{ path: 'input.ts', content: codeInput, language: selectedLanguage }]
        : files;

      const response = await fetch(`${apiUrl}/api/code-validation/validate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          projectId,
          files: filesToValidate,
          language: selectedLanguage
        })
      });

      const data = await response.json();
      if (data.success) {
        setResults(data.data.results);
      }
    } catch (error) {
      console.error('Validation failed:', error);
    } finally {
      setLoading(false);
    }
  }, [codeInput, files, selectedLanguage, projectId, apiUrl, authToken]);

  const runLinting = useCallback(async () => {
    if (!codeInput.trim()) return;

    setLoading(true);
    try {
      const response = await fetch(`${apiUrl}/api/code-validation/lint`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          code: codeInput,
          language: selectedLanguage
        })
      });

      const data = await response.json();
      if (data.success) {
        setResults([{
          path: 'input',
          language: selectedLanguage,
          isValid: data.data.issues?.length === 0,
          errors: data.data.issues?.filter((i: any) => i.severity === 'error') || [],
          warnings: data.data.issues?.filter((i: any) => i.severity === 'warning') || [],
          suggestions: data.data.suggestions || []
        }]);
      }
    } catch (error) {
      console.error('Linting failed:', error);
    } finally {
      setLoading(false);
    }
  }, [codeInput, selectedLanguage, apiUrl, authToken]);

  const runSecurityScan = useCallback(async () => {
    if (!codeInput.trim() && files.length === 0) return;

    setLoading(true);
    try {
      const response = await fetch(`${apiUrl}/api/code-validation/security-scan`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          code: codeInput || undefined,
          files: files.length > 0 ? files : undefined,
          language: selectedLanguage
        })
      });

      const data = await response.json();
      if (data.success) {
        setSecurityResults(data.data.vulnerabilities || data.data || []);
      }
    } catch (error) {
      console.error('Security scan failed:', error);
    } finally {
      setLoading(false);
    }
  }, [codeInput, files, selectedLanguage, apiUrl, authToken]);

  const checkBestPractices = useCallback(async () => {
    if (!codeInput.trim()) return;

    setLoading(true);
    try {
      const response = await fetch(`${apiUrl}/api/code-validation/best-practices`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          code: codeInput,
          language: selectedLanguage
        })
      });

      const data = await response.json();
      if (data.success) {
        setPracticesResults(data.data);
      }
    } catch (error) {
      console.error('Best practices check failed:', error);
    } finally {
      setLoading(false);
    }
  }, [codeInput, selectedLanguage, apiUrl, authToken]);

  const handleValidate = () => {
    switch (activeTab) {
      case 'syntax':
        validateSyntax();
        break;
      case 'lint':
        runLinting();
        break;
      case 'security':
        runSecurityScan();
        break;
      case 'practices':
        checkBestPractices();
        break;
    }
  };

  const toggleFileExpand = (path: string) => {
    setExpandedFiles(prev => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const copyCode = async (code: string) => {
    await navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'error':
      case 'critical':
      case 'high':
        return 'text-red-500 bg-red-500/10';
      case 'warning':
      case 'medium':
        return 'text-yellow-500 bg-yellow-500/10';
      case 'info':
      case 'low':
        return 'text-blue-500 bg-blue-500/10';
      default:
        return 'text-gray-500 bg-gray-500/10';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'error':
      case 'critical':
      case 'high':
        return <XCircle className="w-4 h-4" />;
      case 'warning':
      case 'medium':
        return <AlertTriangle className="w-4 h-4" />;
      case 'info':
      case 'low':
        return <AlertCircle className="w-4 h-4" />;
      default:
        return <AlertCircle className="w-4 h-4" />;
    }
  };

  if (!canValidate.enabled) {
    return (
      <div className="p-6 bg-gray-800 rounded-lg text-center">
        <Lock className="w-12 h-12 mx-auto text-gray-500 mb-4" />
        <h3 className="text-lg font-semibold text-white mb-2">Code Validation Locked</h3>
        <p className="text-gray-400">Upgrade your plan to access code validation features.</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 rounded-lg border border-gray-700 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-gray-700 bg-gray-800/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/20 rounded-lg">
              <Code className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Code Validation</h2>
              <p className="text-sm text-gray-400">Validate syntax, lint, security, and best practices</p>
            </div>
          </div>
          <button
            onClick={handleValidate}
            disabled={loading || (!codeInput.trim() && files.length === 0)}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Play className="w-4 h-4" />
            )}
            Validate
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mt-4">
          {[
            { id: 'syntax', label: 'Syntax', icon: FileCode },
            { id: 'lint', label: 'Lint', icon: Bug },
            { id: 'security', label: 'Security', icon: Shield },
            { id: 'practices', label: 'Best Practices', icon: Sparkles },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Code Input */}
      <div className="p-4 border-b border-gray-700">
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-gray-300">Code Input</label>
          <div className="flex items-center gap-2">
            <select
              value={selectedLanguage}
              onChange={(e) => setSelectedLanguage(e.target.value)}
              className="bg-gray-700 border border-gray-600 rounded px-3 py-1 text-sm text-white"
            >
              {languages.map(lang => (
                <option key={lang.id} value={lang.id}>{lang.name}</option>
              ))}
            </select>
            <button
              onClick={() => copyCode(codeInput)}
              className="p-1.5 text-gray-400 hover:text-white transition-colors"
              title="Copy code"
            >
              {copiedCode ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        </div>
        <textarea
          value={codeInput}
          onChange={(e) => setCodeInput(e.target.value)}
          placeholder="Paste your code here to validate..."
          className="w-full h-48 bg-gray-800 border border-gray-600 rounded-lg p-3 text-white font-mono text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
        />
      </div>

      {/* Results */}
      <div className="p-4">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
            <span className="ml-3 text-gray-400">Validating code...</span>
          </div>
        ) : activeTab === 'security' ? (
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-gray-300 flex items-center gap-2">
              <Shield className="w-4 h-4 text-purple-400" />
              Security Scan Results
            </h3>
            {securityResults.length === 0 ? (
              <div className="flex items-center gap-3 p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
                <CheckCircle2 className="w-5 h-5 text-green-500" />
                <span className="text-green-400">No security vulnerabilities detected</span>
              </div>
            ) : (
              securityResults.map((issue, idx) => (
                <div
                  key={idx}
                  className={`p-3 rounded-lg border ${getSeverityColor(issue.severity)} border-current/20`}
                >
                  <div className="flex items-start gap-3">
                    {getSeverityIcon(issue.severity)}
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-white">{issue.type}</span>
                        <span className={`text-xs px-2 py-0.5 rounded ${getSeverityColor(issue.severity)}`}>
                          {issue.severity.toUpperCase()}
                        </span>
                      </div>
                      <p className="text-sm text-gray-300 mt-1">{issue.message}</p>
                      {issue.line && (
                        <p className="text-xs text-gray-500 mt-1">Line {issue.line}</p>
                      )}
                      <div className="mt-2 p-2 bg-gray-800/50 rounded text-sm">
                        <span className="text-gray-400">💡 </span>
                        <span className="text-blue-400">{issue.recommendation}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : activeTab === 'practices' ? (
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-gray-300 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-400" />
              Best Practices Analysis
            </h3>
            {practicesResults ? (
              <div className="space-y-4">
                {practicesResults.score !== undefined && (
                  <div className="flex items-center gap-4 p-4 bg-gray-800 rounded-lg">
                    <div className="text-4xl font-bold text-purple-400">
                      {practicesResults.score}%
                    </div>
                    <div>
                      <div className="text-white font-medium">Quality Score</div>
                      <div className="text-sm text-gray-400">Based on {practicesResults.checksRun || 0} checks</div>
                    </div>
                  </div>
                )}
                {practicesResults.suggestions?.map((suggestion: string, idx: number) => (
                  <div key={idx} className="flex items-start gap-3 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                    <Lightbulb className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-gray-300">{suggestion}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">Run validation to see best practices analysis</p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-gray-300 flex items-center gap-2">
              <FileCode className="w-4 h-4 text-purple-400" />
              Validation Results
            </h3>
            {results.length === 0 ? (
              <p className="text-gray-500 text-center py-8">Run validation to see results</p>
            ) : (
              results.map((result, idx) => (
                <div key={idx} className="border border-gray-700 rounded-lg overflow-hidden">
                  <button
                    onClick={() => toggleFileExpand(result.path)}
                    className="w-full flex items-center justify-between p-3 bg-gray-800 hover:bg-gray-700/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {expandedFiles.has(result.path) ? (
                        <ChevronDown className="w-4 h-4 text-gray-400" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-gray-400" />
                      )}
                      <FileText className="w-4 h-4 text-blue-400" />
                      <span className="text-white font-medium">{result.path}</span>
                      <span className="text-xs text-gray-500 bg-gray-700 px-2 py-0.5 rounded">
                        {result.language}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {result.isValid ? (
                        <span className="flex items-center gap-1 text-green-400 text-sm">
                          <CheckCircle2 className="w-4 h-4" /> Valid
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-red-400 text-sm">
                          <XCircle className="w-4 h-4" /> {result.errors.length} errors
                        </span>
                      )}
                      {result.warnings.length > 0 && (
                        <span className="flex items-center gap-1 text-yellow-400 text-sm">
                          <AlertTriangle className="w-4 h-4" /> {result.warnings.length}
                        </span>
                      )}
                    </div>
                  </button>
                  
                  {expandedFiles.has(result.path) && (
                    <div className="p-3 space-y-2 bg-gray-800/30">
                      {result.errors.map((error, eIdx) => (
                        <div key={eIdx} className="flex items-start gap-2 text-sm p-2 bg-red-500/10 border border-red-500/20 rounded">
                          <XCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                          <div>
                            <span className="text-red-400">
                              Line {error.line}:{error.column}
                            </span>
                            <span className="text-gray-300 ml-2">{error.message}</span>
                            {error.rule && (
                              <span className="text-gray-500 ml-2 text-xs">({error.rule})</span>
                            )}
                          </div>
                        </div>
                      ))}
                      {result.warnings.map((warning, wIdx) => (
                        <div key={wIdx} className="flex items-start gap-2 text-sm p-2 bg-yellow-500/10 border border-yellow-500/20 rounded">
                          <AlertTriangle className="w-4 h-4 text-yellow-500 flex-shrink-0 mt-0.5" />
                          <div>
                            <span className="text-yellow-400">
                              Line {warning.line}:{warning.column}
                            </span>
                            <span className="text-gray-300 ml-2">{warning.message}</span>
                          </div>
                        </div>
                      ))}
                      {result.suggestions && result.suggestions.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-gray-700">
                          <h4 className="text-xs font-medium text-gray-400 mb-2">Suggestions</h4>
                          {result.suggestions.map((suggestion, sIdx) => (
                            <div key={sIdx} className="flex items-start gap-2 text-sm p-2 bg-blue-500/10 border border-blue-500/20 rounded mb-1">
                              <Lightbulb className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                              <span className="text-gray-300">{suggestion}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default CodeValidationPanel;
