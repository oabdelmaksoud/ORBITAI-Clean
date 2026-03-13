import React from 'react';
import { CheckCircle2, Circle, Rocket, Lightbulb, Sparkles, Code2, Settings } from 'lucide-react';

interface PhaseIndicatorProps {
  currentPhase: 0 | 1 | 2 | 3 | 4;
  activeSubProjectName?: string;
  className?: string;
}

const PhaseIndicator: React.FC<PhaseIndicatorProps> = ({
  currentPhase,
  activeSubProjectName,
  className = ''
}) => {
  const phases = [
    { id: 0, name: 'Exploration', icon: Lightbulb, description: 'Brainstorm ideas and identify path' },
    { id: 1, name: 'Definition', icon: Sparkles, description: 'Define requirements and architecture' },
    { id: 2, name: 'Prototyping', icon: Settings, description: 'Generate code and preview' },
    { id: 3, name: 'Launch', icon: Rocket, description: 'Finalize and export to workspace' },
  ];

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {phases.map((phase, index) => {
        const Icon = phase.icon;
        const isCompleted = currentPhase > phase.id;
        const isCurrent = currentPhase === phase.id;
        const isPast = currentPhase > phase.id;

        return (
          <React.Fragment key={phase.id}>
            <div
              className={`flex flex-col items-center gap-1 relative ${isCurrent ? 'scale-110' : ''
                } transition-transform`}
              title={`${phase.name}: ${phase.description}`}
            >
              <div
                className={`p-2 rounded-full transition-all ${isCompleted
                    ? 'bg-green-100 text-green-600'
                    : isCurrent
                      ? 'bg-primary/20 text-primary ring-2 ring-primary'
                      : 'bg-slate-100 text-slate-400'
                  }`}
              >
                {isCompleted ? (
                  <CheckCircle2 className="w-4 h-4" />
                ) : (
                  <Icon className={`w-4 h-4 ${isCurrent ? 'animate-pulse' : ''}`} />
                )}
              </div>
              <span
                className={`text-[9px] font-medium text-center max-w-[60px] line-clamp-2 ${isCurrent ? 'text-primary font-bold' : isPast ? 'text-green-600' : 'text-slate-400'
                  }`}
              >
                {phase.name}
              </span>
              {isCurrent && (
                <div className="absolute -top-1 -right-1 w-2 h-2 bg-primary rounded-full animate-ping" />
              )}
            </div>
            {index < phases.length - 1 && (
              <div
                className={`h-0.5 w-8 transition-colors ${isPast ? 'bg-green-500' : 'bg-slate-200'
                  }`}
              />
            )}
          </React.Fragment>
        );
      })}

      {activeSubProjectName && currentPhase > 0 && (
        <div className="ml-4 px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">
          {activeSubProjectName}
        </div>
      )}
    </div>
  );
};

export default PhaseIndicator;


