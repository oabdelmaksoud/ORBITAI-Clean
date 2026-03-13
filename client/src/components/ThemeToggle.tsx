import React from 'react';
import { Moon, Sun, Monitor } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

export const ThemeToggle: React.FC = () => {
  const { theme, setTheme } = useTheme();

  return (
    <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
      <button
        onClick={() => setTheme('light')}
        className={`p-2 rounded transition-colors ${
          theme === 'light' 
            ? 'bg-white dark:bg-slate-700 text-primary shadow-sm' 
            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
        }`}
        aria-label="Light theme"
        title="Light theme"
      >
        <Sun size={16} />
      </button>
      <button
        onClick={() => setTheme('dark')}
        className={`p-2 rounded transition-colors ${
          theme === 'dark' 
            ? 'bg-white dark:bg-slate-700 text-primary shadow-sm' 
            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
        }`}
        aria-label="Dark theme"
        title="Dark theme"
      >
        <Moon size={16} />
      </button>
      <button
        onClick={() => setTheme('system')}
        className={`p-2 rounded transition-colors ${
          theme === 'system' 
            ? 'bg-white dark:bg-slate-700 text-primary shadow-sm' 
            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
        }`}
        aria-label="System theme"
        title="System theme"
      >
        <Monitor size={16} />
      </button>
    </div>
  );
};






