/**
 * Code Editor Component with Gradual Rollout
 * Demonstrates real-world gradual rollout implementation
 */

import { useNewCodeEditor } from '../hooks/useNewCodeEditor';
import { FeatureFlagUser } from '../services/featureFlagAdapter';
import CodeEditor from './CodeEditor';

interface CodeEditorWithRolloutProps {
  user?: FeatureFlagUser;
  code: string;
  onChange: (code: string) => void;
  language?: string;
}

export function CodeEditorWithRollout({ 
  user, 
  code, 
  onChange, 
  language = 'typescript' 
}: CodeEditorWithRolloutProps) {
  const { enabled, loading, useNewEditor, useOldEditor } = useNewCodeEditor(user, {
    rolloutPercentage: 25, // 25% of users get new editor
    targetPlans: ['pro', 'enterprise']
  });

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-50">
        <div className="text-gray-500">Loading editor...</div>
      </div>
    );
  }

  // New Editor (for users in rollout)
  if (useNewEditor) {
    return (
      <div className="w-full h-full relative">
        <div className="absolute top-2 right-2 z-10 px-2 py-1 bg-green-100 text-green-800 text-xs rounded">
          ✨ New Editor
        </div>
        <CodeEditor
          code={code}
          onChange={onChange}
          language={language}
          // Add new editor features here
          theme="vs-dark"
          options={{
            minimap: { enabled: true },
            fontSize: 14,
            wordWrap: 'on',
            // New features for rolled-out users
            suggestOnTriggerCharacters: true,
            quickSuggestions: true
          }}
        />
      </div>
    );
  }

  // Old Editor (for users not in rollout)
  if (useOldEditor) {
    return (
      <div className="w-full h-full relative">
        <CodeEditor
          code={code}
          onChange={onChange}
          language={language}
          theme="vs-dark"
          options={{
            minimap: { enabled: false },
            fontSize: 14,
            wordWrap: 'on'
          }}
        />
      </div>
    );
  }

  // Fallback
  return (
    <CodeEditor
      code={code}
      onChange={onChange}
      language={language}
    />
  );
}

