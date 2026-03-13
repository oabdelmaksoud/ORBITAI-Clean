import React, { useState, useEffect } from 'react';
import { Globe, Smartphone, Monitor, Server, Code, Sparkles, CheckCircle2 } from 'lucide-react';
import { brainstormingRoomApi } from '@src/services/brainstormingRoomApi';
import { toast } from '../services/toastService';

interface DetectedSubProject {
  id: string;
  name: string;
  type: 'webapp' | 'mobile-app' | 'website' | 'api' | 'desktop-app' | 'other';
  confidence: number;
  matchedIdeas?: string[];
  keywords?: string[];
}

interface SubProjectDetectorProps {
  roomId: string;
  ideas: Array<{ id: string; label: string; description?: string; tags?: string[] }>;
  topic?: string;
  onSubProjectSelected?: (subProject: DetectedSubProject) => void;
  onSubProjectCreated?: (subProjectId: string) => void;
}

const SubProjectDetector: React.FC<SubProjectDetectorProps> = ({
  roomId,
  ideas,
  topic,
  onSubProjectSelected,
  onSubProjectCreated
}) => {
  const [detectedSubProjects, setDetectedSubProjects] = useState<DetectedSubProject[]>([]);
  const [isDetecting, setIsDetecting] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const typeIcons = {
    'webapp': Globe,
    'mobile-app': Smartphone,
    'website': Globe,
    'api': Server,
    'desktop-app': Monitor,
    'other': Code,
  };

  const typeColors = {
    'webapp': 'bg-blue-100 text-blue-700 border-blue-200',
    'mobile-app': 'bg-purple-100 text-purple-700 border-purple-200',
    'website': 'bg-green-100 text-green-700 border-green-200',
    'api': 'bg-orange-100 text-orange-700 border-orange-200',
    'desktop-app': 'bg-indigo-100 text-indigo-700 border-indigo-200',
    'other': 'bg-slate-100 text-slate-700 border-slate-200',
  };

  useEffect(() => {
    // Auto-detect when ideas change significantly (more than 3 ideas)
    // Auto-detect immediately for testing (was >= 3)
    if (ideas.length >= 0 && roomId) {
      const timeoutId = setTimeout(() => {
        detectSubProjects();
      }, 2000); // Debounce detection

      return () => clearTimeout(timeoutId);
    } else {
      setDetectedSubProjects([]);
    }
  }, [ideas.length, topic, roomId]);

  const detectSubProjects = async () => {
    if (!roomId) return;

    try {
      setIsDetecting(true);
      // --- MOCK START ---
      // Silently return for now to prevent 401s and potential redirects
      await new Promise(resolve => setTimeout(resolve, 500));
      // Optionally return mock data here if needed later
      return;
      // --- MOCK END ---

      /*
      const response = await fetch(`/api/brainstorming-rooms/${roomId}/detect-sub-projects`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (!response.ok) {
        // Silently fail for 401/404 - detection is optional and backend may not be available
        if (response.status === 401 || response.status === 404) {
          return;
        }
        throw new Error('Failed to detect sub-projects');
      }

      const data = await response.json();
      setDetectedSubProjects(data.subProjects || []);
      */
    } catch (error: any) {
      // Silently fail - detection is optional and backend may not be available
      // Don't log errors to console - they're expected when backend is down
    } finally {
      setIsDetecting(false);
    }
  };

  const handleSelectSubProject = async (subProject: DetectedSubProject) => {
    try {
      setIsCreating(true);
      const response = await fetch(`/api/brainstorming-rooms/${roomId}/sub-projects`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          name: subProject.name,
          type: subProject.type,
          ideas: subProject.matchedIdeas || [],
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create sub-project');
      }

      const data = await response.json();
      toast.success(`Sub-project "${subProject.name}" created!`);

      if (onSubProjectSelected) {
        onSubProjectSelected(subProject);
      }

      if (onSubProjectCreated) {
        onSubProjectCreated(data.subProject.id);
      }

      // Hide detection panel after selection
      setDetectedSubProjects([]);
    } catch (error: any) {
      console.error('Error creating sub-project:', error);
      toast.error(error.message || 'Failed to create sub-project');
    } finally {
      setIsCreating(false);
    }
  };

  if (detectedSubProjects.length === 0 && !isDetecting) {
    return null;
  }

  return (
    <div className="bg-gradient-to-br from-purple-50 to-blue-50 border border-purple-200 rounded-lg p-4 mb-4 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="w-5 h-5 text-purple-600" />
        <h3 className="text-sm font-bold text-purple-900">Potential Sub-Projects Detected</h3>
        {isDetecting && (
          <span className="text-xs text-purple-600 animate-pulse">Detecting...</span>
        )}
      </div>

      <p className="text-xs text-purple-700 mb-3">
        Based on your ideas, we detected potential sub-projects. Select one to begin focused brainstorming:
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
        {detectedSubProjects.map((subProject) => {
          const Icon = typeIcons[subProject.type];
          const colorClass = typeColors[subProject.type];

          return (
            <button
              key={subProject.id}
              onClick={() => handleSelectSubProject(subProject)}
              disabled={isCreating}
              className={`p-3 rounded-lg border-2 transition-all hover:shadow-md hover:scale-105 ${colorClass
                } ${isCreating ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <div className="flex items-start gap-2 mb-2">
                <Icon className="w-5 h-5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm mb-1">{subProject.name}</div>
                  <div className="text-xs opacity-75">
                    {Math.round(subProject.confidence * 100)}% confidence
                  </div>
                </div>
                {isCreating && (
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-current border-t-transparent" />
                )}
              </div>
              {subProject.keywords && subProject.keywords.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {subProject.keywords.slice(0, 3).map((keyword, idx) => (
                    <span
                      key={idx}
                      className="text-[10px] px-1.5 py-0.5 bg-white/50 rounded"
                    >
                      {keyword}
                    </span>
                  ))}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default SubProjectDetector;

