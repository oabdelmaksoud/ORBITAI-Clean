

import React from 'react';
import { Phase, Methodology } from '@orbitai/shared';
import { PHASE_ORDER } from '@orbitai/shared';
import { FileSearch, Hexagon, FileText, Terminal, GitMerge, ShieldCheck, Flag, Activity, Lightbulb, Repeat, RotateCw, PlayCircle, Network, Share2, Target } from 'lucide-react';

interface PhaseNodeProps {
    phase: Phase;
    label: string;
    x: number;
    y: number;
    align?: 'left' | 'right' | 'center';
    icon: any;
    status: 'completed' | 'active' | 'pending';
    nodeType?: 'standard' | 'diamond' | 'circle';
}

const PhaseNode: React.FC<PhaseNodeProps> = ({ 
    phase, 
    label, 
    x, 
    y, 
    align = 'center',
    icon: Icon,
    status,
    nodeType = 'standard'
}) => {
    let baseClasses = "absolute transform -translate-y-1/2 flex items-center gap-1.5 px-2 py-1.5 rounded-md border text-[9px] font-bold uppercase tracking-wider transition-all duration-500 backdrop-blur-md shadow-lg z-10 whitespace-nowrap group cursor-default max-w-[120px]";
    
    // Override shape for iterative methodologies (Agile, Scrum, etc.)
    if (nodeType === 'diamond') {
        baseClasses = "absolute transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center justify-center w-16 h-16 rounded-lg rotate-45 border text-[8px] font-bold uppercase transition-all duration-500 backdrop-blur-md shadow-lg z-10 group cursor-default";
    } else if (nodeType === 'circle') {
        baseClasses = "absolute transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center justify-center w-12 h-12 rounded-full border text-[8px] font-bold uppercase transition-all duration-500 backdrop-blur-md shadow-lg z-10 group cursor-default";
    }

    let colorClasses = "bg-white/80 border-slate-200 text-slate-500 hover:text-slate-700";
    
    if (status === 'completed') {
        colorClasses = "bg-primary/5 border-primary/30 text-primary/70 shadow-[0_0_10px_rgba(37,99,235,0.1)]";
    } else if (status === 'active') {
        colorClasses = "bg-white border-primary text-primary shadow-[0_0_20px_rgba(37,99,235,0.3)] ring-1 ring-primary/50 scale-105";
    }

    // Adjust horizontal alignment styles (Only for standard nodes)
    let alignmentStyle = {};
    if (nodeType === 'standard') {
        alignmentStyle = align === 'left' 
        ? { left: `${x}%`, top: `${y}%`, transform: 'translate(-100%, -50%)', paddingRight: '12px' } 
        : align === 'right' 
            ? { left: `${x}%`, top: `${y}%`, transform: 'translate(0%, -50%)', paddingLeft: '12px' }
            : { left: `${x}%`, top: `${y}%`, transform: 'translate(-50%, -50%)' };
    } else {
        alignmentStyle = { left: `${x}%`, top: `${y}%` };
    }

    return (
      <div 
        className={`${baseClasses} ${colorClasses}`} 
        style={alignmentStyle}
      >
        <div className={`relative shrink-0 ${status === 'active' ? 'animate-pulse' : ''} ${nodeType === 'diamond' ? '-rotate-45' : ''}`}>
           <Icon size={nodeType === 'standard' ? 10 : 14} strokeWidth={2.5} />
        </div>
        {nodeType !== 'circle' && (
            <span className={`truncate ${nodeType === 'diamond' ? '-rotate-45 mt-1' : ''}`}>{label}</span>
        )}
        
        {/* Connection Dot */}
        {nodeType === 'standard' && (
            <div className={`absolute w-1.5 h-1.5 rounded-full bg-white border border-slate-400 top-1/2 -translate-y-1/2 transition-colors duration-500
                ${align === 'left' ? '-right-[3px]' : align === 'right' ? '-left-[3px]' : 'hidden'}
                ${status === 'completed' || status === 'active' ? 'bg-primary border-primary shadow-[0_0_5px_#2563eb]' : ''}
            `} />
        )}
      </div>
    );
};

interface VModelVisualizerProps {
  currentPhase: Phase;
  currentSprint?: number;
  estimatedSprints?: number; // Total estimated sprints for the project
  methodology?: Methodology;
}

const VModelVisualizer: React.FC<VModelVisualizerProps> = ({ currentPhase, currentSprint = 1, estimatedSprints, methodology = 'V-Model' }) => {
  const currentIndex = PHASE_ORDER.indexOf(currentPhase);

  const getPhaseStatus = (phase: Phase) => {
    const phaseIndex = PHASE_ORDER.indexOf(phase);
    if (phaseIndex < currentIndex) return 'completed';
    if (phaseIndex === currentIndex) return 'active';
    return 'pending';
  };

  // --- MODEL SPECIFIC PATHS ---
  
  // V-Model: Classic V Shape
  const vPoints = [
      [18, 20],  // Initiation (New)
      [28, 30], // Req
      [36, 45], // Arch
      [44, 60], // TestPlan
      [50, 85], // Impl
      [56, 60], // Integ
      [64, 45], // Acceptance
      [72, 30]  // Release
  ];

  // Agile: Iterative Loop (Infinity-ish or Circular)
  const agilePoints = [
      [20, 50], // Initiation
      [30, 30], // Req
      [50, 20], // Arch
      [70, 30], // TestPlan
      [80, 50], // Impl
      [70, 70], // Integ
      [50, 80], // Acceptance
      [30, 70]  // Release
  ];

  // Iterative methodologies (Agile, Scrum, DevOps, etc.): Cyclic workflows
  // Nodes: Start, Router, Agents (Parallel), Critic, End
  // Phases are mapped to these nodes conceptually
  const iterativeMethodologyPoints = [
      [10, 50],  // Initiation (Start)
      [30, 50],  // Requirements (Router/Plan)
      [50, 25],  // Architecture (Agent A)
      [50, 75],  // TestPlan (Agent B)
      [70, 50],  // Implementation (Action)
      [50, 50],  // Integration (Reflection/Router Center) - Visual only? No, flow goes back here
      [85, 50],  // Acceptance (Critic)
      [95, 50]   // Release (End)
  ];

  // Iterative methodologies have custom edges, not just a line
  const renderIterativeEdges = () => (
      <>
        {/* Start -> Plan */}
        <path d="M 10 50 L 30 50" stroke="#cbd5e1" strokeWidth="1.5" markerEnd="url(#arrow)" />
        
        {/* Plan -> Agent A & Agent B (Split) */}
        <path d="M 30 50 C 40 50 40 25 50 25" stroke="#cbd5e1" strokeWidth="1.5" markerEnd="url(#arrow)" />
        <path d="M 30 50 C 40 50 40 75 50 75" stroke="#cbd5e1" strokeWidth="1.5" markerEnd="url(#arrow)" />
        
        {/* Agents -> Action (Merge) */}
        <path d="M 50 25 C 60 25 60 50 70 50" stroke="#cbd5e1" strokeWidth="1.5" markerEnd="url(#arrow)" />
        <path d="M 50 75 C 60 75 60 50 70 50" stroke="#cbd5e1" strokeWidth="1.5" markerEnd="url(#arrow)" />
        
        {/* Action -> Critic */}
        <path d="M 70 50 L 85 50" stroke="#cbd5e1" strokeWidth="1.5" markerEnd="url(#arrow)" />
        
        {/* Critic -> End */}
        <path d="M 85 50 L 95 50" stroke="#cbd5e1" strokeWidth="1.5" markerEnd="url(#arrow)" />
        
        {/* Cyclic Feedback Loop (Critic -> Plan) */}
        <path d="M 85 50 C 85 90 30 90 30 50" stroke="#cbd5e1" strokeWidth="1.5" strokeDasharray="4,4" markerEnd="url(#arrow)" />
      </>
  );

  // Define iterative methodologies that use cyclic visualization
  const iterativeMethodologies = ['Agile', 'Scrum', 'DevOps', 'RAD', 'Lean', 'ASD', 'Iterative', 'Prototyping'];
  
  let points = vPoints;
  if (iterativeMethodologies.includes(methodology)) {
    points = iterativeMethodologyPoints;
  }

  const isLoop = iterativeMethodologies.includes(methodology);
  
  const pathData = isLoop 
    ? `M ${points[0].join(',')} C 20,20 80,20 ${points[4].join(',')} C 80,80 20,80 ${points[0].join(',')}` 
    : `M ${points.map(p => p.join(',')).join(' L ')}`;

  // Calculate active path length for progress effect (V-Model/Agile only)
  const activePointIndex = Math.min(Math.max(currentIndex, 0), points.length - 1);
  const activePathData = `M ${points.slice(0, activePointIndex + 1).map(p => p.join(',')).join(' L ')}`;

  return (
    <div className="relative h-56 w-full bg-slate-50 border-b border-slate-200 overflow-hidden select-none group py-6">
       
       {/* Tech Grid Background */}
       <div className="absolute inset-0 opacity-20 pointer-events-none" 
            style={{ 
                backgroundImage: 'radial-gradient(circle at 50% 100%, rgba(37,99,235,0.15), transparent 70%), linear-gradient(rgba(37,99,235,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(37,99,235,0.03) 1px, transparent 1px)',
                backgroundSize: '100% 100%, 20px 20px, 20px 20px'
            }} 
       />
       
       {/* SVG Layer */}
       <svg className="absolute inset-0 w-full h-full pointer-events-none" preserveAspectRatio="none" viewBox="0 0 100 100">
          <defs>
             <filter id="glow">
                <feGaussianBlur stdDeviation="1.5" result="coloredBlur"/>
                <feMerge>
                    <feMergeNode in="coloredBlur"/>
                    <feMergeNode in="SourceGraphic"/>
                </feMerge>
             </filter>
             <marker id="arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                <path d="M0,0 L0,6 L6,3 z" fill="#cbd5e1" />
             </marker>
          </defs>

          {/* Render appropriate path logic */}
          {iterativeMethodologies.includes(methodology) ? (
              renderIterativeEdges()
          ) : (
              <>
                <path d={pathData} fill="none" stroke="#cbd5e1" strokeWidth="1" strokeDasharray="3,3" />
                {currentIndex >= 0 && (
                    <path 
                        d={activePathData} 
                        fill="none" 
                        stroke="#2563eb" 
                        strokeWidth="1.5" 
                        filter="url(#glow)" 
                        className="opacity-60 transition-all duration-1000"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                )}
              </>
          )}
          
          {/* V-Model Specific: Horizontal Verification Connectors */}
          {methodology === 'V-Model' && (
              <>
                <line x1="28" y1="30" x2="72" y2="30" stroke="#94a3b8" strokeWidth="0.5" strokeDasharray="2,2" opacity="0.3" />
                <line x1="36" y1="45" x2="64" y2="45" stroke="#94a3b8" strokeWidth="0.5" strokeDasharray="2,2" opacity="0.3" />
                <line x1="44" y1="60" x2="56" y2="60" stroke="#94a3b8" strokeWidth="0.5" strokeDasharray="2,2" opacity="0.3" />
              </>
          )}

       </svg>

       {/* Phase Nodes */}
       {points.map((p, i) => {
           const phase = PHASE_ORDER[i];
           // Determine alignment based on position relative to center
           const align = methodology === 'Agile' 
                ? 'center' 
                : i < 4 ? 'left' : i === 4 ? 'center' : 'right';
           
           // Icons map
           const icons = [Lightbulb, FileSearch, Hexagon, FileText, Terminal, GitMerge, ShieldCheck, Flag];
           
           // Calculate status here
           const status = getPhaseStatus(phase);

           // Iterative methodology specific labels/types
           let label = phase === Phase.INITIATION ? 'Init' : phase === Phase.SYSTEM_ACCEPTANCE ? 'UAT' : phase.split(' ')[0];
           let nodeType: 'standard' | 'diamond' | 'circle' = 'standard';
           
           if (methodology === 'LangGraph') {
               if (i === 0) { label = 'Start'; nodeType = 'circle'; }
               else if (i === 1) { label = 'Router'; nodeType = 'diamond'; }
               else if (i === 2 || i === 3) { label = i === 2 ? 'Agent A' : 'Agent B'; }
               else if (i === 4) { label = 'Execute'; }
               else if (i === 5) { label = 'Sync'; nodeType = 'circle'; } // Integration
               else if (i === 6) { label = 'Reflector'; nodeType = 'diamond'; }
               else if (i === 7) { label = 'End'; nodeType = 'circle'; }
           }

           return (
                <PhaseNode 
                    key={phase} 
                    phase={phase} 
                    label={label} 
                    x={p[0]} 
                    y={p[1]} 
                    align={align} 
                    icon={methodology === 'LangGraph' ? (i === 1 || i === 6 ? Network : i === 0 || i === 7 ? PlayCircle : icons[i]) : icons[i] || Activity}
                    status={status}
                    nodeType={nodeType}
                />
           );
       })}

       {/* Floating Status Label */}
       <div className="absolute bottom-2 left-2 flex flex-col gap-1 pointer-events-none">
           <div className="flex items-center gap-2 px-2 py-1 bg-white/80 rounded border border-slate-200 backdrop-blur z-20 w-fit">
                {methodology === 'Agile' || methodology === 'Scrum' || methodology === 'DevOps' || methodology === 'RAD' || methodology === 'Lean' || methodology === 'ASD' ? <RotateCw size={10} className="text-secondary animate-spin-slow" /> : 
                 methodology === 'Spiral' || methodology === 'Iterative' || methodology === 'Prototyping' ? <Target size={10} className="text-secondary" /> : 
                 <ShieldCheck size={10} className="text-secondary" />}
                <span className="text-[9px] text-slate-400 font-mono tracking-wider">
                    MODEL: <span className="text-slate-700 font-bold uppercase">{methodology}</span>
                </span>
           </div>
           <div className="flex items-center gap-2 px-2 py-1 bg-white/80 rounded border border-slate-200 backdrop-blur z-20 w-fit">
              <Repeat size={10} className="text-primary" />
              <span className="text-[9px] text-slate-400 font-mono tracking-wider">
                SPRINT: <span className="text-slate-600 font-bold">{currentSprint}{estimatedSprints ? ` / ${estimatedSprints}` : ''}</span>
              </span>
           </div>
       </div>
    </div>
  );
};

export default VModelVisualizer;