import React, { useState } from 'react';
import { Artifact, NotebookCell } from '@orbitai/shared';
import { 
  Play, Square, Download, FileCode, FileText, Image as ImageIcon, 
  AlertCircle, CheckCircle, Loader2, Copy, Check
} from 'lucide-react';
import Editor from '@monaco-editor/react';
import ReactMarkdown from 'react-markdown';

interface NotebookViewerProps {
  artifact: Artifact;
  onSave?: (cells: NotebookCell[]) => void;
  readOnly?: boolean;
}

const NotebookViewer: React.FC<NotebookViewerProps> = ({ 
  artifact, 
  onSave,
  readOnly = false 
}) => {
  const [cells, setCells] = useState<NotebookCell[]>(() => {
    if (artifact.notebookCells) {
      return artifact.notebookCells;
    }
    // Try to parse from content if it's JSON
    try {
      const parsed = JSON.parse(artifact.content);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    } catch (e) {
      // Not JSON, create a single markdown cell
      return [{
        id: 'cell-1',
        type: 'markdown',
        content: artifact.content
      }];
    }
    return [];
  });
  const [executingCellId, setExecutingCellId] = useState<string | null>(null);
  const [copiedCellId, setCopiedCellId] = useState<string | null>(null);

  const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3002';

  const executeCell = async (cellId: string) => {
    const cell = cells.find(c => c.id === cellId);
    if (!cell || cell.type !== 'code') return;

    setExecutingCellId(cellId);
    try {
      const token = localStorage.getItem('token') || localStorage.getItem('admin_token') || '';
      
      const response = await fetch(`${API_BASE_URL}/api/notebook/execute-cell`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          code: cell.content,
          language: cell.language || 'python'
        })
      });

      if (!response.ok) {
        throw new Error('Failed to execute cell');
      }

      const result = await response.json();
      
      // Update cell with outputs
      setCells(prevCells => 
        prevCells.map(c => {
          if (c.id === cellId) {
            const outputs: NotebookCell['outputs'] = [];
            
            if (result.error) {
              outputs.push({
                type: 'error',
                data: result.error
              });
            }
            
            if (result.output) {
              outputs.push({
                type: 'text',
                data: result.output
              });
            }
            
            if (result.images && result.images.length > 0) {
              result.images.forEach((img: string) => {
                outputs.push({
                  type: 'image',
                  data: img
                });
              });
            }
            
            if (result.data) {
              outputs.push({
                type: 'data',
                data: result.data
              });
            }

            return {
              ...c,
              executionCount: (c.executionCount || 0) + 1,
              outputs: outputs.length > 0 ? outputs : undefined
            };
          }
          return c;
        })
      );

      if (onSave) {
        const updatedCells = cells.map(c => 
          c.id === cellId 
            ? { ...c, executionCount: (c.executionCount || 0) + 1, outputs: result }
            : c
        );
        onSave(updatedCells);
      }
    } catch (error: any) {
      console.error('Failed to execute cell:', error);
      // Add error output to cell
      setCells(prevCells => 
        prevCells.map(c => {
          if (c.id === cellId) {
            return {
              ...c,
              outputs: [{
                type: 'error',
                data: error.message || 'Failed to execute cell'
              }]
            };
          }
          return c;
        })
      );
    } finally {
      setExecutingCellId(null);
    }
  };

  const exportToJupyter = async () => {
    try {
      const token = localStorage.getItem('token') || localStorage.getItem('admin_token') || '';
      
      const response = await fetch(`${API_BASE_URL}/api/notebook/export`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ cells })
      });

      if (!response.ok) {
        throw new Error('Failed to export notebook');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${artifact.title || 'notebook'}.ipynb`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error: any) {
      console.error('Failed to export notebook:', error);
      alert('Failed to export notebook: ' + error.message);
    }
  };

  const copyCellContent = (cellId: string) => {
    const cell = cells.find(c => c.id === cellId);
    if (cell) {
      navigator.clipboard.writeText(cell.content);
      setCopiedCellId(cellId);
      setTimeout(() => setCopiedCellId(null), 2000);
    }
  };

  const renderCellOutput = (outputs: NotebookCell['outputs']) => {
    if (!outputs || outputs.length === 0) return null;

    return (
      <div className="mt-2 space-y-2">
        {outputs.map((output, idx) => {
          if (output.type === 'text') {
            return (
              <pre key={idx} className="bg-slate-50 p-3 rounded-lg text-sm font-mono overflow-x-auto border border-slate-200">
                {String(output.data)}
              </pre>
            );
          } else if (output.type === 'error') {
            return (
              <div key={idx} className="bg-red-50 border border-red-200 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <AlertCircle size={16} className="text-red-600 mt-0.5" />
                  <pre className="text-red-800 text-sm font-mono flex-1 overflow-x-auto">
                    {String(output.data)}
                  </pre>
                </div>
              </div>
            );
          } else if (output.type === 'image') {
            return (
              <div key={idx} className="bg-white border border-slate-200 rounded-lg p-2">
                <img 
                  src={output.data} 
                  alt="Cell output" 
                  className="max-w-full h-auto rounded"
                />
              </div>
            );
          } else if (output.type === 'data') {
            return (
              <pre key={idx} className="bg-slate-50 p-3 rounded-lg text-sm font-mono overflow-x-auto border border-slate-200">
                {JSON.stringify(output.data, null, 2)}
              </pre>
            );
          }
          return null;
        })}
      </div>
    );
  };

  return (
    <div className="w-full h-full flex flex-col bg-white">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-slate-50">
        <div>
          <h2 className="text-lg font-bold text-slate-800">{artifact.title}</h2>
          <p className="text-sm text-slate-500">
            {cells.length} cell{cells.length !== 1 ? 's' : ''} • 
            {cells.filter(c => c.type === 'code').length} code cell{cells.filter(c => c.type === 'code').length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={exportToJupyter}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center gap-2"
          >
            <Download size={16} />
            Export .ipynb
          </button>
        </div>
      </div>

      {/* Cells */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {cells.map((cell, idx) => (
          <div 
            key={cell.id} 
            className="border border-slate-200 rounded-lg overflow-hidden bg-white shadow-sm"
          >
            {/* Cell Header */}
            <div className="bg-slate-50 px-4 py-2 flex items-center justify-between border-b border-slate-200">
              <div className="flex items-center gap-2">
                {cell.type === 'code' ? (
                  <FileCode size={16} className="text-blue-600" />
                ) : (
                  <FileText size={16} className="text-green-600" />
                )}
                <span className="text-sm font-medium text-slate-700">
                  {cell.type === 'code' ? 'Code' : 'Markdown'}
                  {cell.executionCount && ` [${cell.executionCount}]`}
                </span>
                {cell.language && (
                  <span className="text-xs px-2 py-0.5 bg-slate-200 rounded text-slate-600">
                    {cell.language}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {!readOnly && cell.type === 'code' && (
                  <button
                    onClick={() => executeCell(cell.id)}
                    disabled={executingCellId === cell.id}
                    className="p-1.5 hover:bg-blue-100 rounded transition-colors disabled:opacity-50"
                    title="Execute cell"
                  >
                    {executingCellId === cell.id ? (
                      <Loader2 size={16} className="text-blue-600 animate-spin" />
                    ) : (
                      <Play size={16} className="text-blue-600" />
                    )}
                  </button>
                )}
                <button
                  onClick={() => copyCellContent(cell.id)}
                  className="p-1.5 hover:bg-slate-200 rounded transition-colors"
                  title="Copy cell content"
                >
                  {copiedCellId === cell.id ? (
                    <Check size={16} className="text-green-600" />
                  ) : (
                    <Copy size={16} className="text-slate-600" />
                  )}
                </button>
              </div>
            </div>

            {/* Cell Content */}
            <div className="p-4">
              {cell.type === 'code' ? (
                <div>
                  <Editor
                    height="200px"
                    defaultLanguage={cell.language || 'python'}
                    value={cell.content}
                    theme="vs-light"
                    options={{
                      readOnly: readOnly,
                      minimap: { enabled: false },
                      scrollBeyondLastLine: false,
                      fontSize: 14,
                      lineNumbers: 'on',
                      wordWrap: 'on'
                    }}
                    onChange={(value) => {
                      if (!readOnly && value !== undefined) {
                        setCells(prevCells =>
                          prevCells.map(c =>
                            c.id === cell.id ? { ...c, content: value } : c
                          )
                        );
                      }
                    }}
                  />
                </div>
              ) : (
                <div className="prose prose-sm max-w-none">
                  <ReactMarkdown>{cell.content}</ReactMarkdown>
                </div>
              )}

              {/* Cell Outputs */}
              {cell.outputs && cell.outputs.length > 0 && (
                <div className="mt-4 pt-4 border-t border-slate-200">
                  {renderCellOutput(cell.outputs)}
                </div>
              )}

              {/* Execution Status */}
              {executingCellId === cell.id && (
                <div className="mt-2 flex items-center gap-2 text-sm text-blue-600">
                  <Loader2 size={14} className="animate-spin" />
                  <span>Executing...</span>
                </div>
              )}
            </div>
          </div>
        ))}

        {cells.length === 0 && (
          <div className="text-center py-12 text-slate-500">
            <FileCode size={48} className="mx-auto mb-4 opacity-50" />
            <p>No cells in this notebook</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default NotebookViewer;




