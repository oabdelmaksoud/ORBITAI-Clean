import React from 'react';

export enum DesignStage {
  EMPATHIZE = 'EMPATHIZE',
  DEFINE = 'DEFINE',
  IDEATE = 'IDEATE',
  PROTOTYPE = 'PROTOTYPE',
  TEST = 'TEST'
}

interface StageConfig {
  id: DesignStage;
  label: string;
  icon: string;
  color: string;
  textColor: string;
  description: string;
  activities: string[];
}

export const STAGES: Record<DesignStage, StageConfig> = {
  [DesignStage.EMPATHIZE]: {
    id: DesignStage.EMPATHIZE,
    label: 'Empathize',
    icon: 'fa-comments',
    color: 'bg-[#EAD1C6]',
    textColor: 'text-[#8A6A5C]',
    description: 'Understand the people you are designing for.',
    activities: ['Observe and interview', 'Listen', 'Ask questions', 'Learn about audience']
  },
  [DesignStage.DEFINE]: {
    id: DesignStage.DEFINE,
    label: 'Define',
    icon: 'fa-bullseye',
    color: 'bg-[#BC9C84]',
    textColor: 'text-white',
    description: 'Frame the problem you want to solve.',
    activities: ['Define your scope', 'Look for patterns', 'Question assumptions', 'Frame your POV']
  },
  [DesignStage.IDEATE]: {
    id: DesignStage.IDEATE,
    label: 'Ideate',
    icon: 'fa-filter',
    color: 'bg-[#EEDDAA]',
    textColor: 'text-[#8C7D40]',
    description: 'Generate a wide range of ideas.',
    activities: ['Come up with solutions', 'Experiment', 'Collaborate', 'Brainstorm']
  },
  [DesignStage.PROTOTYPE]: {
    id: DesignStage.PROTOTYPE,
    label: 'Prototype',
    icon: 'fa-hammer',
    color: 'bg-[#B0B5D6]',
    textColor: 'text-[#4A5080]',
    description: 'Build real, tactile representations of ideas.',
    activities: ['Think big, act small', 'Fail fast', 'Learn from users', 'Refine']
  },
  [DesignStage.TEST]: {
    id: DesignStage.TEST,
    label: 'Test',
    icon: 'fa-cog',
    color: 'bg-[#CDE8E3]',
    textColor: 'text-[#4A7A70]',
    description: 'Return to users for feedback.',
    activities: ['User testing', 'Surveys', 'Evaluate', 'Gather learnings']
  }
};

interface StageSelectorProps {
  currentStage: DesignStage;
  onSelectStage: (stage: DesignStage) => void;
}

// SVG icons for each stage
const getStageIcon = (stage: DesignStage): React.ReactNode => {
  const iconSize = 24;
  const iconClass = "w-6 h-6 md:w-8 md:h-8";
  
  switch (stage) {
    case DesignStage.EMPATHIZE:
      return (
        <svg className={iconClass} fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
          <path d="M2 5a2 2 0 012-2h7a2 2 0 012 2v4a2 2 0 01-2 2H9l-3 3v-3H4a2 2 0 01-2-2V5z" />
          <path d="M15 7v2a4 4 0 01-4 4H9.828l-1.766 1.767c.28.149.599.233.938.233h2l3 3v-3h2a2 2 0 002-2V9a2 2 0 00-2-2h-1z" />
        </svg>
      );
    case DesignStage.DEFINE:
      return (
        <svg className={iconClass} fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm0-2a6 6 0 100-12 6 6 0 000 12zm0-2a4 4 0 100-8 4 4 0 000 8zm0-1.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" clipRule="evenodd" />
          <circle cx="10" cy="10" r="1" fill="currentColor" />
        </svg>
      );
    case DesignStage.IDEATE:
      return (
        <svg className={iconClass} fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
          <path fillRule="evenodd" d="M3 3a1 1 0 011-1h12a1 1 0 011 1v3a1 1 0 01-.293.707L12 11.414V15a1 1 0 01-.293.707l-2 2A1 1 0 018 17v-5.586L3.293 6.707A1 1 0 013 6V3z" clipRule="evenodd" />
        </svg>
      );
    case DesignStage.PROTOTYPE:
      return (
        <svg className={iconClass} fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
          <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
        </svg>
      );
    case DesignStage.TEST:
      return (
        <svg className={iconClass} fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
          <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
        </svg>
      );
    default:
      return null;
  }
};

const DesignThinkingStageSelector: React.FC<StageSelectorProps> = ({ currentStage, onSelectStage }) => {
  const stageKeys = Object.values(DesignStage);

  return (
    <div className="w-full mb-6">
      <div className="flex flex-wrap justify-center items-center gap-4 md:gap-6 p-4">
        {stageKeys.map((key) => {
          const stage = STAGES[key];
          const isActive = currentStage === key;
          
          return (
            <button
              key={key}
              onClick={() => onSelectStage(key)}
              className={`
                relative flex flex-col items-center justify-center
                w-20 h-20 md:w-28 md:h-28 rounded-full transition-all duration-300 ease-out
                border-4 shadow-sm hover:shadow-lg
                ${isActive ? 'scale-110 z-10 border-white ring-4 ring-opacity-30 ring-gray-400' : 'scale-100 border-transparent opacity-70 hover:opacity-100'}
                ${stage.color}
              `}
              aria-label={`Select ${stage.label} stage`}
            >
              <div className={`text-xl md:text-2xl mb-1 ${stage.textColor}`}>
                {getStageIcon(key)}
              </div>
              <span className={`text-xs font-bold uppercase tracking-wider ${stage.textColor}`}>
                {stage.label}
              </span>
              
              {/* Active Indicator Dot */}
              {isActive && (
                <div className="absolute -bottom-2 w-2 h-2 bg-gray-600 rounded-full animate-bounce"></div>
              )}
            </button>
          );
        })}
      </div>
      
      {/* Active Stage Details Banner */}
      <div className="max-w-3xl mx-auto mt-2 text-center">
        <h2 className="text-xl md:text-2xl font-bold text-gray-800">{STAGES[currentStage].label}</h2>
        <p className="text-gray-600 italic mb-2 text-sm md:text-base">{STAGES[currentStage].description}</p>
        <div className="flex flex-wrap justify-center gap-2 text-xs text-gray-500">
           {STAGES[currentStage].activities.map((activity, idx) => (
             <span key={idx} className="bg-white px-2 py-1 rounded-md shadow-sm border border-gray-100">
               • {activity}
             </span>
           ))}
        </div>
      </div>
    </div>
  );
};

export default DesignThinkingStageSelector;



