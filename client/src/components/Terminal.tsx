import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Terminal as TerminalIcon, X, Maximize2, Minimize2, Loader2, AlertCircle } from 'lucide-react';
import { useFeatureAccess } from '../hooks/useFeatureAccess';

interface TerminalProps {
  projectId?: string;
  onClose?: () => void;
  userRole?: string;
}

const Terminal: React.FC<TerminalProps> = ({ projectId, onClose, userRole = 'user' }) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const [isMaximized, setIsMaximized] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [currentCommand, setCurrentCommand] = useState('');
  const [output, setOutput] = useState<string[]>([]);
  const [cwd, setCwd] = useState('/tmp');
  const inputRef = useRef<HTMLInputElement>(null);

  const canAccessTerminal = useFeatureAccess('terminal_access', userRole);

  // Initialize terminal
  useEffect(() => {
    if (!canAccessTerminal.enabled) return;

    const initTerminal = async () => {
      try {
        const token = localStorage.getItem('authToken');
        const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3002'}/api/terminal/info`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            setCwd(data.data.cwd || '/tmp');
            addOutput(`Welcome to OrbitAI Terminal`);
            addOutput(`Platform: ${data.data.platform}`);
            addOutput(`Current directory: ${data.data.cwd}`);
            addOutput(`User: ${data.data.user}`);
            addOutput(`Shell: ${data.data.shell}`);
            addOutput('');
            addOutput('Type "help" for available commands or "exit" to close.');
            addOutput('');
            prompt();
          }
        }
      } catch (err: any) {
        setError('Failed to initialize terminal');
        console.error('Terminal init error:', err);
      }
    };

    initTerminal();
  }, [canAccessTerminal.enabled]);

  const addOutput = (text: string) => {
    setOutput(prev => [...prev, text]);
  };

  const prompt = () => {
    addOutput(`$ `);
  };

  const executeCommand = async (command: string) => {
    if (!command.trim()) {
      prompt();
      return;
    }

    // Handle built-in commands
    if (command.trim() === 'exit' || command.trim() === 'quit') {
      if (onClose) {
        onClose();
      }
      return;
    }

    if (command.trim() === 'clear' || command.trim() === 'cls') {
      setOutput([]);
      prompt();
      return;
    }

    if (command.trim() === 'help') {
      addOutput('Available commands:');
      addOutput('  ls, pwd, whoami, date, echo, cat, head, tail, grep');
      addOutput('  find, wc, sort, uniq, diff, mkdir, touch, rm, cp, mv');
      addOutput('  chmod, chown, df, du, ps, top, free, uptime, uname');
      addOutput('  git, npm, node, python, python3, pip, pip3');
      addOutput('  curl, wget, tar, zip, unzip, gzip, gunzip');
      addOutput('  cd, env, export, printenv, history, clear');
      addOutput('');
      addOutput('Built-in commands:');
      addOutput('  help - Show this help message');
      addOutput('  clear/cls - Clear terminal output');
      addOutput('  exit/quit - Close terminal');
      addOutput('');
      prompt();
      return;
    }

    if (command.trim() === 'history') {
      if (commandHistory.length === 0) {
        addOutput('No command history');
      } else {
        commandHistory.forEach((cmd, idx) => {
          addOutput(`${idx + 1}  ${cmd}`);
        });
      }
      addOutput('');
      prompt();
      return;
    }

    // Add command to history
    setCommandHistory(prev => [...prev, command]);
    setHistoryIndex(-1);

    // Show command in output
    addOutput(`$ ${command}`);

    setIsLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3002'}/api/terminal/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          command: command.trim(),
          cwd,
          timeout: 30000,
          maxOutputSize: 1024 * 1024, // 1MB
        }),
      });

      const data = await response.json();

      if (data.success) {
        if (data.data.output) {
          addOutput(data.data.output);
        }
        if (data.data.error) {
          addOutput(`Error: ${data.data.error}`);
        }
        
        // Handle cd command specially
        if (command.trim().startsWith('cd ')) {
          const newDir = command.trim().substring(3).trim();
          if (newDir) {
            setCwd(newDir);
          }
        }
      } else {
        addOutput(`Error: ${data.error || 'Command execution failed'}`);
      }
    } catch (err: any) {
      addOutput(`Error: ${err.message || 'Failed to execute command'}`);
      setError(err.message);
    } finally {
      setIsLoading(false);
      prompt();
      
      // Scroll to bottom
      setTimeout(() => {
        if (terminalRef.current) {
          terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
        }
      }, 100);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const command = currentCommand.trim();
      setCurrentCommand('');
      executeCommand(command);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (commandHistory.length > 0) {
        const newIndex = historyIndex === -1 
          ? commandHistory.length - 1 
          : Math.max(0, historyIndex - 1);
        setHistoryIndex(newIndex);
        setCurrentCommand(commandHistory[newIndex]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex >= 0) {
        const newIndex = historyIndex + 1;
        if (newIndex >= commandHistory.length) {
          setHistoryIndex(-1);
          setCurrentCommand('');
        } else {
          setHistoryIndex(newIndex);
          setCurrentCommand(commandHistory[newIndex]);
        }
      }
    }
  };

  if (!canAccessTerminal.enabled && !canAccessTerminal.loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
        <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md m-4 border border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-slate-800">Terminal Access</h3>
            {onClose && (
              <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            )}
          </div>
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
            <AlertCircle size={32} className="mx-auto mb-2 text-yellow-600" />
            <h4 className="font-bold text-yellow-800 mb-1">Feature Disabled</h4>
            <p className="text-sm text-yellow-700">
              Terminal access is not enabled for your role. Contact an administrator to enable this feature.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`fixed ${isMaximized ? 'inset-0' : 'bottom-4 right-4 w-[800px] h-[500px]'} z-50 flex flex-col bg-slate-900 rounded-lg shadow-2xl border border-slate-700 transition-all`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-800 border-b border-slate-700 rounded-t-lg">
        <div className="flex items-center gap-2">
          <TerminalIcon size={16} className="text-green-400" />
          <span className="text-sm font-bold text-slate-200">Terminal</span>
          {cwd && (
            <span className="text-xs text-slate-400 ml-2">({cwd})</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isLoading && (
            <Loader2 size={14} className="text-green-400 animate-spin" />
          )}
          <button
            onClick={() => setIsMaximized(!isMaximized)}
            className="p-1 text-slate-400 hover:text-slate-200 transition-colors"
            title={isMaximized ? 'Minimize' : 'Maximize'}
          >
            {isMaximized ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 text-slate-400 hover:text-red-400 transition-colors"
              title="Close"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Terminal Output */}
      <div
        ref={terminalRef}
        className="flex-1 overflow-y-auto p-4 font-mono text-sm text-green-400 bg-black custom-scrollbar"
        style={{ 
          fontFamily: 'Monaco, Menlo, "Ubuntu Mono", Consolas, "source-code-pro", monospace',
          lineHeight: '1.5',
        }}
      >
        {output.map((line, index) => (
          <div key={index} className="whitespace-pre-wrap break-words">
            {line}
          </div>
        ))}
        {error && (
          <div className="text-red-400 mt-2">
            Error: {error}
          </div>
        )}
      </div>

      {/* Input */}
      <div className="px-4 py-2 bg-slate-800 border-t border-slate-700 rounded-b-lg flex items-center gap-2">
        <span className="text-green-400 font-mono">$</span>
        <input
          ref={inputRef}
          type="text"
          value={currentCommand}
          onChange={(e) => setCurrentCommand(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isLoading}
          className="flex-1 bg-transparent text-green-400 font-mono text-sm outline-none border-none focus:outline-none"
          placeholder="Enter command..."
          autoFocus
        />
      </div>
    </div>
  );
};

export default Terminal;




