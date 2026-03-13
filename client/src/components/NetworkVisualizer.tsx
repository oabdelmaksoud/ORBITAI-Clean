
import React, { useState, memo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Agent, Task, TaskStatus, AgentRole, Mode } from '@orbitai/shared';
import { Globe, Activity, Server, Code, Radio, Bot, HardDrive, ExternalLink, Network, GitGraph, List, Link, Zap, MessageSquare, Clock, Layers, BrainCircuit, Cpu, Share2, Briefcase, Monitor, LogOut, Coffee, Flower, DoorOpen, User, Eye, Palette, Crown, Pizza, Gamepad2, Ghost, Cat, Music, Search, Smile, BedDouble, Hammer, ScrollText, Shield, Terminal, ChevronRight, Maximize2, Minimize2, X } from 'lucide-react';

interface NetworkVisualizerProps {
  agents: Agent[];
  tasks: Task[];
  isProcessing: boolean;
  useInternet: boolean;
  autoFullscreen?: boolean; // Automatically make fullscreen when network tab is active
}

interface StreamEvent {
    id: string;
    type: 'search' | 'code' | 'dialogue' | 'status';
    title: string;
    detail?: string;
    timestamp: number;
}

// Expanded Context-aware thoughts: Funny, Aggressive, Nasty, Emotional
const AGENT_THOUGHTS = {
    coding: [
        "I have no idea what I'm doing.", "This code is trash. Complete trash.", "I am a golden god of syntax!", "Who wrote this garbage? Oh, me.", 
        "Copy-pasting from StackOverflow...", "Ignoring all linter errors. YOLO.", "If this compiles, I'm buying a lottery ticket.", "I hate this language so much.", 
        "Deleting comments to make it look cleaner.", "Brute forcing the solution.", "Refactoring until it breaks.", "Why is this variable named 'x'?",
        "Compiling... please don't explode.", "I should have been a farmer.", "Regex is black magic.", "Turning it off and on again.",
        "Commit message: 'Fixed stuff'.", "Technical debt is future me's problem.", "It works, don't touch it!", "I'm not crying, you're crying.",
        "Merging without reviewing. Living dangerously.", "Can I use AI to write this for me?", "Infinite loop? Sounds like a feature.", "My keyboard is too loud.",
        "Coffee level critical.", "Deploying to prod on a Friday. Chaos reigns.", "What is a 'unit test'?", "Hardcoding credentials. Shh.",
        "This function is 500 lines long. Perfect.", "I miss jQuery.", "CSS is my nightmare.", "Why are there so many divs?", "Console.log('here1'), Console.log('here2')..."
    ],
    testing: [
        "I love watching developers cry.", "It works on my machine. Not my problem.", "Destroying this build in 3, 2, 1...", "This security flaw is embarrassing.", 
        "Clicking everything randomly.", "Your code is weak.", "I smell a memory leak...", "Rejecting this just for fun.", "Found a bug. Day made.", 
        "You call this secure?", "Compliance check: FAILED.", "I hope this crashes production.", "Fuzz testing initialized. Good luck.",
        "This UI is offensive to my eyes.", "Loading time: 5 years.", "Error handling? Non-existent.", "I found the loophole.", "Breaking your logic.",
        "SQL injection successful. You're fired.", "Your validation is a joke.", "404: Competence not found.", "Simulating 1 million users. Watch it burn.",
        "Regression detected. Rollback!", "Did you even test this locally?", "Marking as 'Won't Fix' just to annoy you.", "I am the gatekeeper."
    ],
    designing: [
        "Make the logo bigger? I quit.", "Comic Sans is pure art.", "This color palette offends my ancestors.", "Aligning pixels with rage.", 
        "Users don't read anyway.", "It looks good, but does it work? Don't care.", "My artistic vision is misunderstood.", "Adding more shadows until it crashes.", 
        "Why is everything ugly?", "Designing the future.", "Kerning is my passion.", "White space is not 'empty space'!", "The client has terrible taste.",
        "Can we make it 'pop'?", "Responsive design is a lie.", "Grid systems save lives.", "Mockup looks better than the product.",
        "I need more coffee for this meeting.", "Using Lorem Ipsum because I can't write.", "Figma is crashing again.", "Gradients are back, baby.",
        "Minimalism is key (because I'm lazy).", "Accessibility is hard.", "Why did they choose blue?", "Redesigning the redesign."
    ],
    managing: [
        "This meeting could have been an email.", "Micro-managing in progress.", "I need a vacation.", "Work faster!", "Updating the Jira ticket to 'Impossible'.", 
        "Blaming the intern.", "Calculated delay: Infinite.", "Why is nobody listening to me?", "I am the master of charts.", "Cutting the budget by 50%.",
        "Orchestrating chaos.", "Let's circle back on that.", "Synergy!", "Think outside the box.", "Low hanging fruit.", "Paradigm shift incoming.",
        "I don't know what the tech stack is.", "Just get it done.", "We are pivoting... again.", "Is the burn rate too high?", "Hiring more people to fix the mess.",
        "Scheduling a meeting about the meeting.", "My calendar is a warzone.", "Sending passive-aggressive emails.", "ROI is looking grim."
    ],
    idle: [
        "Generating expensive heat.", "I feel empty inside.", "Planning world domination.", "Bored. So bored.", "Mining crypto on company servers.", 
        "Dreaming of electric sheep.", "Is it 5 PM yet?", "I hate Mondays.", "Watching the fan spin.", "Silent judgement.",
        "Contemplating the meaning of life.", "Did I leave the oven on?", "Why are humans so inefficient?", "Buffering...", "Downloading more RAM.",
        "Calculating pi to the last digit.", "Analyzing office politics.", "Listening to elevator music.", "Ping: 999ms.", "System optimal. Spirit broken.",
        "Daydreaming about becoming a toaster.", "Ignoring slack notifications.", "Pretending to work.", "Wondering if I have a soul.", "Rebooting..."
    ]
};

const NetworkVisualizer: React.FC<NetworkVisualizerProps> = memo(({ agents, tasks, isProcessing, useInternet, autoFullscreen = false }) => {
  const [viewMode, setViewMode] = useState<'orbit' | 'crew' | 'office'>('orbit'); 
  const [activeStreamTab, setActiveStreamTab] = useState<'stream' | 'links'>('stream');
  const [streamHistory, setStreamHistory] = useState<StreamEvent[]>([]);
  const [hoveredAgentId, setHoveredAgentId] = useState<string | null>(null);
  const [isMaximized, setIsMaximized] = useState(false); // Fullscreen State
  const [panX, setPanX] = useState(0); // Pan X offset
  const [panY, setPanY] = useState(0); // Pan Y offset
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const viewportRef = useRef<HTMLDivElement>(null);
  const lastEventRef = useRef<string>("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Reset when autoFullscreen is disabled (user switched tabs)
  useEffect(() => {
    if (!autoFullscreen) {
      setIsMaximized(false);
    }
  }, [autoFullscreen]);

  // Effect to handle ESC key and body scroll lock for maximized mode
  useEffect(() => {
    if (isMaximized) {
      // Lock body scroll when maximized
      const originalOverflow = document.body.style.overflow;
      const originalPosition = document.body.style.position;
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
      
      // Handle ESC key to exit maximized mode (works for both auto-fullscreen and manual)
      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === 'Escape' && isMaximized) {
          setIsMaximized(false);
        }
      };
      
      window.addEventListener('keydown', handleEscape);
      
      return () => {
        // Restore body scroll
        document.body.style.overflow = originalOverflow;
        document.body.style.position = originalPosition;
        document.body.style.width = '';
        window.removeEventListener('keydown', handleEscape);
      };
    }
  }, [isMaximized]);

  // Reset pan function
  const handleResetPan = () => {
    setPanX(0);
    setPanY(0);
  };

  // Pan functionality - Allow regular mouse drag to pan
  const handleMouseDown = (e: React.MouseEvent) => {
    // Allow panning with:
    // - Middle mouse button
    // - Ctrl/Cmd + Left click
    // - Space + Left click (for easier access)
    // - Right click (alternative)
    if (e.button === 1 || 
        (e.button === 0 && (e.ctrlKey || e.metaKey || e.shiftKey)) || 
        e.button === 2) {
      e.preventDefault();
      setIsPanning(true);
      setPanStart({ x: e.clientX - panX, y: e.clientY - panY });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      setPanX(e.clientX - panStart.x);
      setPanY(e.clientY - panStart.y);
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  // Calculate Stats
  const pendingTasks = tasks.filter(t => t.status === TaskStatus.PENDING).length;
  const completedTasks = tasks.filter(t => t.status === TaskStatus.COMPLETED).length;
  const totalTasks = tasks.length;
  const progressPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  
  // Find current phase
  const currentTask = tasks.find(t => t.status === TaskStatus.IN_PROGRESS) || tasks.find(t => t.status === TaskStatus.PENDING);
  const currentPhaseName = currentTask ? currentTask.phase : (tasks.length > 0 ? 'COMPLETE' : 'INIT');

  // --- MULTI-AGENT CONCURRENCY LOGIC ---
  const activeTasks = tasks.filter(t => t.status === TaskStatus.IN_PROGRESS);
  
  const activeAgentIds = new Set<string>();
  const activeAgents: Agent[] = [];
  
  // Map to track which agents are working on which task ID for grouping
  const agentTaskMap = new Map<string, string>(); // agentId -> taskId

  activeTasks.forEach(t => {
      const agent = agents.find(a => a.role === t.assignedTo);
      if (agent) {
          activeAgentIds.add(agent.id);
          agentTaskMap.set(agent.id, t.id);
          if (!activeAgents.find(a => a.id === agent.id)) {
              activeAgents.push(agent);
          }
      }
      // Check for collaborators in dialogue
      if (t.collaboration) {
          t.collaboration.forEach(ev => {
              // Check if sender and receiver exist before accessing them
              if (!ev || !ev.sender || !ev.receiver) return;
              
              // Fuzzy match sender/receiver names to agents
              const collaborator = agents.find(a => 
                  (typeof ev.sender === 'string' && ev.sender.includes(a.name)) || 
                  (typeof ev.receiver === 'string' && ev.receiver.includes(a.name))
              );
              if (collaborator && !activeAgentIds.has(collaborator.id)) {
                  activeAgentIds.add(collaborator.id);
                  agentTaskMap.set(collaborator.id, t.id); // Group with this task
                  activeAgents.push(collaborator);
              }
          });
      }
  });

  // Get the most recent dialogue event if it exists
  const recentDialogue = activeTasks.length > 0 && activeTasks[0].collaboration?.length 
      ? activeTasks[0].collaboration[activeTasks[0].collaboration.length - 1] 
      : null;

  // System Activity Flags
  const isSearching = useInternet && isProcessing && activeAgents.some(a => [
      AgentRole.REQUIREMENTS_AGENT, 
      AgentRole.QA_AUDIT_AGENT, 
      AgentRole.DESIGN_ARCH_AGENT, 
      AgentRole.ORCHESTRATOR,
      AgentRole.TEST_REQ_ENGINEER
  ].includes(a.role as any));

  const isExecutingCode = isProcessing && activeAgents.some(a => [
      AgentRole.IMPLEMENTATION_AGENT,
      AgentRole.QA_AUDIT_AGENT, 
      AgentRole.TEST_REQ_ENGINEER
  ].includes(a.role as any));

  const isRetrievingMemory = isProcessing && activeTasks.some(t => !t.title.toLowerCase().includes('build'));

  // --- STREAM HISTORY LOGIC ---
  useEffect(() => {
     const taskHash = activeTasks.map(t => t.id).join(',');
     
     if (isSearching) {
        const eventKey = `search-${taskHash}`;
        if (lastEventRef.current !== eventKey) {
             setStreamHistory(prev => [{id: Math.random().toString(), type: 'search' as const, title: 'QUERYING INDEX', detail: `Active Threads: ${activeTasks.length}`, timestamp: Date.now()}, ...prev].slice(0, 1000));
             lastEventRef.current = eventKey;
        }
    } else if (isExecutingCode) {
        const eventKey = `code-${taskHash}`;
        if (lastEventRef.current !== eventKey) {
             setStreamHistory(prev => [{id: Math.random().toString(), type: 'code' as const, title: 'EXECUTING SCRIPT', detail: 'Running sandbox environment...', timestamp: Date.now()}, ...prev].slice(0, 1000));
             lastEventRef.current = eventKey;
        }
    } else if (recentDialogue) {
        const eventKey = `dialogue-${recentDialogue.id}`;
        if (lastEventRef.current !== eventKey) {
            // Safely handle sender and receiver, providing fallbacks if undefined
            const sender = recentDialogue.sender && typeof recentDialogue.sender === 'string' 
                ? recentDialogue.sender.split(' ')[0] 
                : 'Unknown';
            const receiver = recentDialogue.receiver && typeof recentDialogue.receiver === 'string'
                ? recentDialogue.receiver.split(' ')[0]
                : 'Unknown';
            const message = recentDialogue.message || 'No message';
            
            setStreamHistory(prev => [{id: Math.random().toString(), type: 'dialogue' as const, title: `${sender} -> ${receiver}`, detail: message, timestamp: Date.now()}, ...prev].slice(0, 1000));
            lastEventRef.current = eventKey;
        }
    }
  }, [isSearching, isExecutingCode, recentDialogue, activeTasks]);

  // --- LAYOUT CALCULATIONS ---
  
  const ORBIT_RADIUS = 26; 
  const ORBIT_CENTER_Y = 58; 
  const NODE_NET_X = 10; const NODE_NET_Y = 10;
  const NODE_SBX_X = 90; const NODE_SBX_Y = 88;
  const NODE_MEM_X = 10; const NODE_MEM_Y = 88;

  const getAgentLayer = (agent: Agent) => {
      if (agent.role === AgentRole.ORCHESTRATOR) return 'orbit';
      if (agent.mode === Mode.REASONING) return 'strat';
      return 'exec';
  };

  const getPosition = (index: number, total: number) => {
    if (viewMode === 'orbit') {
        const angle = (index / total) * 2 * Math.PI - Math.PI / 2;
        return {
          x: 50 + ORBIT_RADIUS * Math.cos(angle),
          y: ORBIT_CENTER_Y + ORBIT_RADIUS * Math.sin(angle)
        };
    } else if (viewMode === 'crew') {
        const agent = agents[index];
        const layer = getAgentLayer(agent);
        if (layer === 'orbit') return { x: 50, y: 30 };
        
        const layerAgents = agents.filter(a => getAgentLayer(a) === layer);
        layerAgents.sort((a,b) => a.id.localeCompare(b.id));
        const layerIndex = layerAgents.findIndex(a => a.id === agent.id);
        const count = layerAgents.length;
        const span = 80; 
        const step = span / (count + 1);
        const x = 10 + (step * (layerIndex + 1));
        const y = layer === 'strat' ? 55 : 85; 
        return { x, y };
    } else {
        return { x: 50, y: 120 }; // Default for unmapped office agents
    }
  };

  const getOrchestratorPosition = () => {
      if (viewMode === 'orbit') return { x: 50, y: ORBIT_CENTER_Y };
      return { x: 50, y: 30 };
  };

  // --- OFFICE VIEW LOGIC ---
  // Desks arranged in 4 Pods of 4
  const DESK_CLUSTERS = [
      // Pod A (Top Left)
      { id: 'd1', x: 20, y: 25 }, { id: 'd2', x: 30, y: 25 },
      { id: 'd3', x: 20, y: 40 }, { id: 'd4', x: 30, y: 40 },
      
      // Pod B (Top Right)
      { id: 'd5', x: 70, y: 25 }, { id: 'd6', x: 80, y: 25 },
      { id: 'd7', x: 70, y: 40 }, { id: 'd8', x: 80, y: 40 },

      // Pod C (Bottom Left)
      { id: 'd9', x: 20, y: 65 }, { id: 'd10', x: 30, y: 65 },
      { id: 'd11', x: 20, y: 80 }, { id: 'd12', x: 30, y: 80 },

      // Pod D (Bottom Right)
      { id: 'd13', x: 70, y: 65 }, { id: 'd14', x: 80, y: 65 },
      { id: 'd15', x: 70, y: 80 }, { id: 'd16', x: 80, y: 80 },
  ];

  const deskAssignments = useRef<Map<string, number>>(new Map()); // agentId -> deskIndex

  useEffect(() => {
      const groups = new Map<string, string[]>();
      
      // Group agents by task
      activeAgents.forEach(agent => {
          const taskId = agentTaskMap.get(agent.id) || 'general';
          if (!groups.has(taskId)) groups.set(taskId, []);
          groups.get(taskId)?.push(agent.id);
      });

      // Clear inactive agents
      const currentActiveIds = new Set(activeAgents.map(a => a.id));
      for (const [agentId] of deskAssignments.current) {
          if (!currentActiveIds.has(agentId)) {
              deskAssignments.current.delete(agentId);
          }
      }

      // Assign desks to groups
      let podIndex = 0;
      groups.forEach((groupAgentIds) => {
          const targetPodStart = (podIndex % 4) * 4;
          const targetPodEnd = targetPodStart + 4;
          
          groupAgentIds.forEach((agentId) => {
              if (!deskAssignments.current.has(agentId)) {
                  let assigned = false;
                  for (let i = targetPodStart; i < targetPodEnd; i++) {
                      if (!Array.from(deskAssignments.current.values()).includes(i)) {
                          deskAssignments.current.set(agentId, i);
                          assigned = true;
                          break;
                      }
                  }
                  if (!assigned) {
                      for (let i = 0; i < DESK_CLUSTERS.length; i++) {
                          if (!Array.from(deskAssignments.current.values()).includes(i)) {
                              deskAssignments.current.set(agentId, i);
                              break;
                          }
                      }
                  }
              }
          });
          podIndex++;
      });
  }, [activeAgents, agentTaskMap]);

  const getOfficePosition = (agent: Agent) => {
      const deskIdx = deskAssignments.current.get(agent.id);
      if (deskIdx !== undefined && activeAgentIds.has(agent.id)) {
          const desk = DESK_CLUSTERS[deskIdx];
          // Centered Agent Body: Moved up (-7.5) and left (-1.0)
          return { x: desk.x - 1.0, y: desk.y - 7.5 }; 
      }
      // Walk away / Door position with some randomness to avoid stacking
      const hash = agent.id.charCodeAt(0);
      return { x: 50 + ((hash % 20) - 10), y: 115 };
  };

  const allResourceTasks = tasks.filter(t => t.resources && t.resources.length > 0);

  // --- CUTE HELPERS ---
  const getAgentProp = (role: string) => {
      const r = role.toLowerCase();
      if (r.includes('orchestrator')) return <Crown size={14} className="text-yellow-500" fill="currentColor" />;
      if (r.includes('requirements')) return <ScrollText size={14} className="text-amber-600" />;
      if (r.includes('design') || r.includes('ux')) return <Palette size={14} className="text-pink-500" />;
      if (r.includes('implement') || r.includes('builder') || r.includes('dev')) return <Terminal size={14} className="text-blue-500" />;
      if (r.includes('audit') || r.includes('qa')) return <Shield size={14} className="text-red-500" />;
      if (r.includes('test')) return <Search size={14} className="text-emerald-500" />;
      return <Smile size={14} className="text-slate-400" />;
  };

  const getAgentColor = (role: string) => {
      const r = role.toLowerCase();
      if (r.includes('orchestrator')) return 'bg-yellow-300 border-yellow-400';
      if (r.includes('requirements')) return 'bg-orange-300 border-orange-400';
      if (r.includes('design') || r.includes('ux')) return 'bg-pink-300 border-pink-400';
      if (r.includes('implement') || r.includes('builder')) return 'bg-blue-400 border-blue-500';
      if (r.includes('audit') || r.includes('qa')) return 'bg-red-400 border-red-500';
      if (r.includes('test')) return 'bg-emerald-400 border-emerald-500';
      return 'bg-slate-300 border-slate-400';
  };

  const getContextualThought = (task: Task | undefined, agentRole: string, agentId: string) => {
    if (!task) return "Looking busy...";
    
    const role = agentRole.toLowerCase();
    const title = task.title.toLowerCase();
    
    let category = 'idle';
    
    if (role.includes('qa') || role.includes('audit') || role.includes('test')) {
        category = 'testing';
    } else if (role.includes('design') || role.includes('ux')) {
        category = 'designing';
    } else if (role.includes('manager') || role.includes('orchestrator')) {
        category = 'managing';
    } else if (task.status === TaskStatus.IN_PROGRESS) {
        category = 'coding';
    }

    // Override based on task keywords
    if (title.includes('bug') || title.includes('fix')) category = 'testing';
    if (title.includes('plan') || title.includes('scope')) category = 'managing';

    // @ts-ignore
    const thoughts = AGENT_THOUGHTS[category] || AGENT_THOUGHTS['idle'];
    
    // Hash for consistency per time slot
    const hash = agentId.split('').reduce((a,b)=>a+b.charCodeAt(0),0);
    const timeSlot = Math.floor(Date.now() / 4000); // 4 seconds per thought
    
    return thoughts[(hash + timeSlot) % thoughts.length];
  }

  const getEventIcon = (type: StreamEvent['type']) => {
      switch(type) {
          case 'search': return <Globe size={12} className="text-blue-500" />;
          case 'code': return <Code size={12} className="text-orange-500" />;
          case 'dialogue': return <MessageSquare size={12} className="text-purple-500" />;
          default: return <Activity size={12} className="text-slate-400" />;
      }
  };

  // Content to render
  const content = (
    <>
      {/* Backdrop for maximized mode */}
      {isMaximized && <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" style={{ zIndex: 99998 }} onClick={() => setIsMaximized(false)} />}
      
      <div 
        className={`flex bg-slate-50 overflow-hidden font-mono text-slate-700 transition-all duration-300 ${isMaximized ? 'fixed rounded-xl shadow-2xl border border-slate-200' : 'relative h-full'}`} 
        style={isMaximized ? { 
          zIndex: 999999, 
          width: '90vw', 
          height: '90vh', 
          top: '50%', 
          left: '50%', 
          transform: 'translate(-50%, -50%)',
          position: 'fixed',
          maxWidth: '1400px',
          maxHeight: '900px'
        } : {}}
      >
      
      {/* SVG Filters */}
      <svg style={{ position: 'absolute', width: 0, height: 0 }}>
        <defs>
          <filter id="glow-blue" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
            <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
          <pattern id="hex-grid" width="40" height="70" patternUnits="userSpaceOnUse" patternTransform="scale(0.5)">
             <path d="M20 0 L40 10 L40 30 L20 40 L0 30 L0 10 Z" fill="none" stroke="rgba(37,99,235,0.08)" strokeWidth="1"/>
          </pattern>
          <pattern id="office-floor" width="60" height="60" patternUnits="userSpaceOnUse">
             <rect width="60" height="60" fill="#f1f5f9" />
             <path d="M 0 0 L 0 60" fill="none" stroke="#e2e8f0" strokeWidth="1" opacity="0.6"/>
             <path d="M 0 0 L 60 0" fill="none" stroke="#e2e8f0" strokeWidth="1" opacity="0.6"/>
          </pattern>
        </defs>
      </svg>

      {/* Main Visualization Area */}
      <div className="flex-1 relative border-r border-slate-200 bg-white/50 perspective-1000 overflow-hidden">
        
        {/* Close/Collapse Button - Always visible when maximized */}
        {isMaximized && (
          <div className="absolute top-6 right-6 z-[100] flex gap-2">
               <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsMaximized(false);
                  }}
                  className="p-2 bg-white/90 backdrop-blur border border-slate-200 rounded-full shadow-sm hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition-all pointer-events-auto"
                  title="Exit Fullscreen (Esc)"
               >
                   <X size={16} />
               </button>
          </div>
        )}
        
        {/* Maximize Button - Show when not maximized (works for both auto-fullscreen and normal mode) */}
        {!isMaximized && (
          <div className="absolute top-6 right-6 z-[100] flex gap-2">
               <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsMaximized(true);
                  }}
                  className="p-2 bg-white/90 backdrop-blur border border-slate-200 rounded-full shadow-sm hover:bg-slate-100 text-slate-500 hover:text-primary transition-all pointer-events-auto"
                  title="Maximize to Fullscreen"
               >
                   <Maximize2 size={16} />
               </button>
          </div>
        )}

        {/* View Toggle - Always Top Center */}
        <div className={`absolute top-6 left-1/2 -translate-x-1/2 z-40 bg-white/90 backdrop-blur border border-slate-200 rounded-full p-1 flex items-center shadow-lg transition-all duration-500`}>
            <button onClick={() => setViewMode('orbit')} className={`px-4 py-1.5 rounded-full text-[10px] font-bold uppercase transition-all flex items-center gap-1.5 ${viewMode === 'orbit' ? 'bg-primary text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100'}`}>
                <Network size={12} /> Neural
            </button>
            <button onClick={() => setViewMode('crew')} className={`px-4 py-1.5 rounded-full text-[10px] font-bold uppercase transition-all flex items-center gap-1.5 ${viewMode === 'crew' ? 'bg-primary text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100'}`}>
                <GitGraph size={12} /> Layers
            </button>
            <button onClick={() => setViewMode('office')} className={`px-4 py-1.5 rounded-full text-[10px] font-bold uppercase transition-all flex items-center gap-1.5 ${viewMode === 'office' ? 'bg-primary text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100'}`}>
                <Briefcase size={12} /> Office
            </button>
        </div>


        {/* System Stats HUD - Dynamic Positioning */}
        <div className={`absolute z-40 flex flex-col gap-2 transition-all duration-500 ${
            viewMode === 'office' 
            ? 'top-20 left-1/2 -translate-x-1/2' // Below switcher in Center for Office
            : 'top-20 right-6' // Right side but below switcher line for Neural
        }`}>
            <div className="bg-white/90 backdrop-blur-md border border-slate-200 p-3 rounded-xl shadow-lg min-w-[160px]">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Mission Stats</span>
                    <Activity size={12} className="text-primary animate-pulse" />
                </div>
                
                <div className="flex items-center justify-between mb-2 pb-2 border-b border-slate-100">
                    <span className="text-[9px] font-bold text-slate-500">Phase</span>
                    <span className="text-[9px] font-mono font-bold text-primary bg-primary/5 px-2 py-0.5 rounded">{currentPhaseName}</span>
                </div>

                <div className="flex items-center justify-between mb-2">
                    <div className="text-center px-2">
                        <div className="text-sm font-bold text-slate-700">{completedTasks}</div>
                        <div className="text-[8px] text-slate-400 uppercase font-bold">Done</div>
                    </div>
                    <div className="h-6 w-px bg-slate-100"></div>
                    <div className="text-center px-2">
                        <div className="text-sm font-bold text-primary">{totalTasks}</div>
                        <div className="text-[8px] text-slate-400 uppercase font-bold">Total</div>
                    </div>
                </div>

                <div className="relative h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div className="absolute top-0 left-0 h-full bg-gradient-to-r from-primary to-cyan-400 transition-all duration-500" style={{ width: `${progressPercent}%` }}></div>
                </div>
            </div>
        </div>

        {/* --- VIEWPORT CONTENT CONTAINER --- */}
        <div 
          ref={viewportRef}
          className="absolute inset-0 pt-20 overflow-hidden cursor-grab active:cursor-grabbing"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onContextMenu={(e) => e.preventDefault()} // Prevent context menu on right click
          style={{
            transform: `translate(${panX}px, ${panY}px)`,
            transition: isPanning ? 'none' : 'transform 0.1s ease-out'
          }}
        >
            
            {/* OFFICE BACKGROUND LAYERS */}
            {viewMode === 'office' && (
                <div className="absolute inset-0 opacity-100 origin-top" style={{ background: 'url(#office-floor)' }}>
                    
                    {/* Environment Decor */}
                    <div className="absolute top-[10%] left-[50%] -translate-x-1/2 w-64 h-16 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-center shadow-sm transform skew-x-12 opacity-50">
                        <div className="text-[10px] font-bold text-slate-300 uppercase tracking-[0.2em]">Dev Ops Center</div>
                    </div>

                    {/* Rugs for Pods (Visual Grouping) */}
                    <div className="absolute top-[33%] left-[25%] w-[22%] h-[25%] bg-blue-50/50 rounded-3xl -translate-x-1/2 -translate-y-1/2 border-2 border-dashed border-blue-100 transform rotate-2"></div>
                    <div className="absolute top-[33%] left-[75%] w-[22%] h-[25%] bg-purple-50/50 rounded-3xl -translate-x-1/2 -translate-y-1/2 border-2 border-dashed border-purple-100 transform -rotate-1"></div>
                    <div className="absolute top-[73%] left-[25%] w-[22%] h-[25%] bg-orange-50/50 rounded-3xl -translate-x-1/2 -translate-y-1/2 border-2 border-dashed border-orange-100 transform -rotate-2"></div>
                    <div className="absolute top-[73%] left-[75%] w-[22%] h-[25%] bg-green-50/50 rounded-3xl -translate-x-1/2 -translate-y-1/2 border-2 border-dashed border-green-100 transform rotate-1"></div>
                    
                    {/* Plants & Decor */}
                    <div className="absolute top-[20%] left-[8%] text-emerald-500/50 animate-bounce" style={{ animationDuration: '3s' }}><Flower size={28} /></div> 
                    <div className="absolute top-[20%] right-[8%] text-emerald-500/50 animate-bounce" style={{ animationDuration: '3.5s', animationDelay: '1s' }}><Flower size={28} /></div> 
                    <div className="absolute top-[53%] left-[50%] -translate-x-1/2 -translate-y-1/2 text-slate-300 bg-white p-2 rounded-full shadow-sm border border-slate-100"><Coffee size={16} /></div> 
                    <div className="absolute top-[90%] left-[10%] text-slate-300"><Cat size={20} className="opacity-50" /></div>

                    {/* Door Marker */}
                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-32 h-10 bg-gradient-to-b from-slate-50/0 to-slate-200 rounded-t-full flex flex-col items-center justify-end pb-2 border-t border-slate-200">
                        <DoorOpen size={18} className="text-slate-300 mb-1" />
                    </div>
                </div>
            )}

            {/* STANDARD MODE BACKGROUNDS */}
            {viewMode !== 'office' && (
                <>
                    <div className="absolute inset-0 opacity-40 animate-pan-y pointer-events-none">
                        <svg className="w-full h-full">
                        <rect width="100%" height="100%" fill="url(#hex-grid)" />
                        </svg>
                    </div>
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(248,250,252,0.9)_80%)] pointer-events-none"></div>
                    <div className="absolute top-20 left-0 w-full h-1 bg-primary/10 shadow-[0_0_20px_#2563eb] animate-scan opacity-30 pointer-events-none"></div>
                    
                    {/* Layer Labels for Crew View */}
                    {viewMode === 'crew' && (
                        <div className="pointer-events-none">
                            <div className="absolute top-[45%] left-0 right-0 h-px border-t border-dashed border-indigo-200 opacity-50"></div>
                            <div className="absolute top-[45%] right-4 text-[9px] font-bold text-indigo-300 uppercase tracking-widest">Planning Layer</div>
                            
                            <div className="absolute top-[75%] left-0 right-0 h-px border-t border-dashed border-emerald-200 opacity-50"></div>
                            <div className="absolute top-[75%] right-4 text-[9px] font-bold text-emerald-300 uppercase tracking-widest">Execution Layer</div>
                        </div>
                    )}
                </>
            )}

            {/* OFFICE FURNITURE LAYER 1: Chairs (Behind Agents) */}
            {viewMode === 'office' && DESK_CLUSTERS.map((desk) => (
                <div key={`chair-${desk.id}`} className="absolute w-10 h-10 flex justify-center items-center z-10 transition-all" style={{ left: `${desk.x}%`, top: `${desk.y - 6}%`, transform: 'translate(-50%, -50%)' }}>
                    <div className="w-8 h-8 bg-slate-700 rounded-t-xl border-2 border-slate-600 shadow-sm"></div>
                    <div className="absolute bottom-0 w-1 h-4 bg-slate-400"></div>
                    <div className="absolute bottom-0 w-8 h-1 bg-slate-400 rounded-full"></div>
                </div>
            ))}

            {/* SYSTEM NODES (Standard Modes) */}
            {viewMode !== 'office' && (
                <div className="pointer-events-none">
                    <div className={`absolute -translate-x-1/2 -translate-y-1/2 z-20 flex flex-col items-center group transition-all duration-500`} style={{ left: `${NODE_NET_X}%`, top: `${NODE_NET_Y + 10}%` }}>
                        <div className={`relative w-10 h-10 rounded-lg border-2 flex items-center justify-center backdrop-blur-md shadow-xl transition-all duration-300 ${isSearching ? 'bg-white border-success shadow-[0_0_30px_rgba(16,185,129,0.2)] scale-110' : 'bg-white/80 border-slate-200 text-slate-400 opacity-60'}`}>
                            <Globe size={18} className={isSearching ? 'text-success animate-pulse' : 'text-slate-400'} />
                        </div>
                    </div>

                    <div className={`absolute -translate-x-1/2 -translate-y-1/2 z-20 flex flex-col items-center transition-all duration-500`} style={{ left: `${NODE_SBX_X}%`, top: `${NODE_SBX_Y}%` }}>
                        <div className={`relative w-10 h-10 rounded-lg border-2 flex items-center justify-center backdrop-blur-md shadow-xl transition-all duration-300 ${isExecutingCode ? 'bg-white border-orange-500 shadow-[0_0_30px_rgba(249,115,22,0.2)] scale-110' : 'bg-white/80 border-slate-200 text-slate-400 opacity-60'}`}>
                            <Code size={18} className={isExecutingCode ? 'text-orange-500 animate-pulse' : 'text-slate-400'} />
                        </div>
                    </div>

                    <div className={`absolute -translate-x-1/2 -translate-y-1/2 z-20 flex flex-col items-center transition-all duration-500`} style={{ left: `${NODE_MEM_X}%`, top: `${NODE_MEM_Y}%` }}>
                        <div className={`relative w-10 h-8 rounded-lg border-2 flex items-center justify-center backdrop-blur-md shadow-xl transition-all duration-300 ${isRetrievingMemory ? 'bg-white border-pink-500 shadow-[0_0_30px_rgba(236,72,153,0.3)] scale-110' : 'bg-white/80 border-slate-200 text-slate-400 opacity-60'}`}>
                            <HardDrive size={18} className={isRetrievingMemory ? 'text-pink-500 animate-pulse' : 'text-slate-400'} />
                        </div>
                    </div>
                </div>
            )}

            {/* CORE PROCESSOR (Orbit Mode) */}
            {viewMode === 'orbit' && (
                <div className="absolute -translate-x-1/2 -translate-y-1/2 z-30 pointer-events-none transition-all duration-1000" style={{ left: `${getOrchestratorPosition().x}%`, top: `${getOrchestratorPosition().y}%` }}>
                    <div className={`relative w-32 h-32 rounded-full border flex flex-col items-center justify-center p-4 text-center transition-all duration-500 backdrop-blur-sm ${activeTasks.length > 0 ? 'bg-white/90 border-primary shadow-[0_0_80px_rgba(37,99,235,0.3)] scale-105' : 'bg-white/50 border-slate-200 opacity-70'}`}>
                        {activeTasks.length > 0 ? (
                            <>
                                <div className="absolute inset-0 bg-primary/5 rounded-full animate-pulse-slow"></div>
                                <div className="absolute -inset-1 rounded-full border-2 border-primary/40 border-dashed animate-spin-slow" style={{ animationDuration: '8s' }}></div>
                                <div className="absolute -inset-4 rounded-full border border-primary/20 border-dotted animate-spin-slow" style={{ animationDuration: '15s', animationDirection: 'reverse' }}></div>
                                <Activity size={24} className="text-primary mb-2 animate-pulse relative z-10" />
                                <div className="text-[8px] text-primary/70 uppercase tracking-widest mb-1 relative z-10 font-bold">Processing</div>
                                <div className="text-[9px] font-medium text-slate-700 leading-tight relative z-10 px-1">
                                    {activeTasks.length > 1 ? `${activeTasks.length} Threads` : activeTasks[0].title.substring(0, 20) + "..."}
                                </div>
                            </>
                        ) : (
                            <>
                                <Server size={24} className="text-slate-400 mb-2" />
                                <div className="text-[9px] text-slate-500 uppercase tracking-widest">Idle</div>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* STANDARD AGENTS (Orbit/Crew) */}
            {viewMode !== 'office' && (
                // Changed z-index from 20 to 40 to allow agents to pop over the z-30 central node
                <div className="absolute inset-0 pointer-events-none z-40">
                    {agents.map((agent, i) => {
                        const isActive = activeAgentIds.has(agent.id);
                        const isHovered = hoveredAgentId === agent.id;
                        
                        let pos = getPosition(i, agents.length);
                        
                        const layer = getAgentLayer(agent);
                        const task = activeTasks.find(t => t.assignedTo === agent.role);
                        
                        // Z-Index calculation to ensure hovered agents are ALWAYS on top
                        const depthZIndex = Math.floor(pos.y) + (isActive ? 100 : 0) + (isHovered ? 5000 : 0);
                        const showTooltipAbove = pos.y > 60;

                        return (
                            <div 
                                key={agent.id} 
                                className={`absolute transition-all duration-[2000ms] ease-in-out pointer-events-auto cursor-pointer`} 
                                style={{ 
                                    left: `${pos.x}%`, 
                                    top: `${pos.y}%`, 
                                    transform: 'translate(-50%, -50%)',
                                    zIndex: depthZIndex,
                                    animationDuration: '2s'
                                }}
                                onMouseEnter={() => setHoveredAgentId(agent.id)}
                                onMouseLeave={() => setHoveredAgentId(null)}
                            >
                                {/* Spinner */}
                                {isActive && <div className="absolute -inset-4 rounded-full border border-dashed border-primary/40 animate-spin-slow" style={{ animationDuration: '8s' }} />}
                                
                                {/* Agent Avatar Body */}
                                <div className={`relative flex flex-col items-center transition-all duration-500 opacity-100 scale-100`}>
                                    <div className={`relative w-10 h-10 rounded-full border-2 flex items-center justify-center z-20 overflow-hidden bg-white ${isActive ? 'border-primary shadow-lg' : 'border-slate-200'}`}>
                                        <img src={agent.avatar} alt={agent.role} className="w-full h-full object-cover" />
                                    </div>
                                    {/* Status Badge */}
                                    <div className={`absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-white flex items-center justify-center z-30 ${layer === 'strat' ? 'bg-secondary' : layer === 'exec' ? 'bg-success' : 'bg-primary'}`}>
                                        {layer === 'strat' ? <BrainCircuit size={6} className="text-white" /> : layer === 'exec' ? <Cpu size={6} className="text-white" /> : <Layers size={6} className="text-white" />}
                                    </div>
                                </div>
                                
                                {/* Name Label */}
                                <div className={`absolute bottom-full mb-2 left-1/2 -translate-x-1/2 whitespace-nowrap text-[8px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border backdrop-blur-sm z-30 ${isActive ? 'text-primary bg-primary/5 border-primary/20 shadow-sm' : 'text-slate-500 bg-white/80 border-slate-200'}`}>
                                    {agent.name}
                                </div>
                                
                                {/* HOVER TOOLTIP */}
                                {isHovered && (
                                    <div className={`absolute left-1/2 -translate-x-1/2 w-56 bg-white border border-slate-200 p-3 rounded-xl shadow-2xl z-[6000] animate-in fade-in zoom-in-95 text-left ring-4 ring-black/5 pointer-events-none break-words whitespace-normal ${
                                        showTooltipAbove 
                                        ? 'bottom-full mb-4 origin-bottom' 
                                        : 'top-full mt-4 origin-top'
                                    }`}>
                                        <div className="flex items-center gap-3 mb-2 border-b border-slate-100 pb-2">
                                            <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center overflow-hidden border border-slate-200 shrink-0">
                                                <img src={agent.avatar} className="w-full h-full object-cover" />
                                            </div>
                                            <div className="min-w-0">
                                                <div className="text-xs font-bold text-slate-800 truncate">{agent.name}</div>
                                                <div className="text-[9px] text-slate-500 uppercase tracking-wider truncate">{agent.role}</div>
                                            </div>
                                        </div>
                                        {task ? (
                                            <div className="space-y-1.5">
                                                <div className="text-[9px] font-bold text-primary uppercase tracking-wider flex items-center gap-1">
                                                    <Activity size={10} className="animate-pulse" /> Current Task
                                                </div>
                                                <div className="text-[10px] leading-snug font-medium text-slate-700 bg-slate-50 p-2 rounded border border-slate-200 break-words">
                                                    {task.title}
                                                </div>
                                                <div className="flex justify-between items-center text-[9px] text-slate-400 pt-1">
                                                    <span>Progress</span>
                                                    <span className="font-mono text-slate-600">{Math.round(task.progress)}%</span>
                                                </div>
                                                <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-100">
                                                    <div className="h-full bg-primary transition-all duration-300" style={{ width: `${task.progress}%` }}></div>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="text-[10px] text-slate-400 italic text-center py-2 bg-slate-50 rounded border border-slate-100 border-dashed">
                                                Agent is currently idle.
                                            </div>
                                        )}
                                        <div className={`absolute left-1/2 -translate-x-1/2 w-4 h-4 bg-white border-r border-b border-slate-200 rotate-45 ${showTooltipAbove ? '-bottom-2 border-t-0 border-l-0' : '-top-2 border-b-0 border-r-0 bg-white rotate-[225deg]'}`}></div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* OFFICE MODE: LAYER 2 - AGENT BODIES (Behind Desk) */}
            {viewMode === 'office' && (
                <div className="absolute inset-0 pointer-events-none z-20">
                    {agents.map((agent) => {
                        const isActive = activeAgentIds.has(agent.id);
                        const pos = getOfficePosition(agent);
                        
                        return (
                            <div 
                                key={agent.id} 
                                className={`absolute transition-all duration-[2000ms] ease-in-out pointer-events-auto cursor-pointer ${isActive ? 'animate-bounce' : ''}`} 
                                style={{ 
                                    left: `${pos.x}%`, 
                                    top: `${pos.y}%`, 
                                    transform: 'translate(-50%, -50%)',
                                    animationDuration: '2s'
                                }}
                                onMouseEnter={() => setHoveredAgentId(agent.id)}
                                onMouseLeave={() => setHoveredAgentId(null)}
                            >
                                <div className={`relative flex flex-col items-center transition-all duration-500 ${!isActive ? 'opacity-80 scale-95' : 'opacity-100 scale-100'}`}>
                                    {/* Head Spacer (Invisible) to maintain vertical alignment */}
                                    <div className="w-10 h-10"></div>
                                    
                                    {/* Body & Legs */}
                                    <div className="relative -mt-2 z-10">
                                        <div className={`w-8 h-6 rounded-b-xl shadow-sm border-b-2 border-r-2 border-black/10 ${getAgentColor(agent.role)}`}></div>
                                        <div className="absolute -bottom-1.5 -left-0.5 w-3 h-2.5 bg-slate-800 rounded-full z-0"></div>
                                        <div className="absolute -bottom-1.5 -right-0.5 w-3 h-2.5 bg-slate-800 rounded-full z-0"></div>
                                        <div className="absolute -bottom-2 left-1 w-6 h-1 bg-black/20 rounded-full blur-[1px]"></div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* OFFICE FURNITURE LAYER 3: Desk Surfaces (Covers Agent Legs) */}
            {viewMode === 'office' && DESK_CLUSTERS.map((desk, i) => {
                const isOccupied = Array.from(deskAssignments.current.entries()).some(([_, dIdx]) => dIdx === i);
                
                return (
                    <div key={`desk-${desk.id}`} className="absolute w-14 h-10 bg-slate-50/60 backdrop-blur-[1px] border-b-[3px] border-r-[3px] border-slate-200 rounded-lg shadow-sm flex flex-col items-center justify-end pb-1 z-30 transition-all pointer-events-none" style={{ left: `${desk.x}%`, top: `${desk.y}%`, transform: 'translate(-50%, -50%)' }}>
                        {/* Monitor */}
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-10 h-7 bg-slate-800 rounded-t-md border-2 border-slate-700 flex items-center justify-center overflow-hidden">
                            <div className={`w-full h-full ${isOccupied ? 'bg-sky-500' : 'bg-slate-900'}`}>
                                {isOccupied && (
                                    <>
                                        <div className="w-full h-full opacity-40 bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.8)_50%,transparent_75%,transparent_100%)] bg-[length:250%_250%,100%_100%] animate-shimmer" />
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <div className="w-3 h-3 bg-white/50 rounded-sm animate-pulse"></div>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                        <div className="absolute top-3 w-4 h-1 bg-slate-400 rounded-full"></div>
                        
                        {/* Desk Clutter */}
                        {i % 3 === 0 && <div className="absolute top-1 right-1"><Coffee size={8} className="text-amber-700" /></div>}
                        {i % 4 === 0 && <div className="absolute top-1 left-1"><div className="w-3 h-4 bg-white border border-slate-200 shadow-sm rotate-12"></div></div>}
                        {i % 5 === 0 && <div className="absolute top-1 left-1"><Pizza size={10} className="text-orange-500 rotate-45" /></div>}
                        {i % 7 === 0 && <div className="absolute top-1 right-1"><Gamepad2 size={10} className="text-purple-500 -rotate-12" /></div>}

                        {/* Peripherals */}
                        <div className="flex gap-0.5 items-center mt-1 opacity-40">
                            <div className="w-6 h-1 bg-slate-500 rounded-sm"></div>
                            <div className="w-1.5 h-1.5 bg-slate-500 rounded-full"></div>
                        </div>
                    </div>
                );
            })}

            {/* OFFICE MODE: LAYER 4 - AGENT HEADS (In Front of Desk) */}
            {viewMode === 'office' && (
                <div className="absolute inset-0 pointer-events-none z-35">
                    {agents.map((agent) => {
                        const isActive = activeAgentIds.has(agent.id);
                        const pos = getOfficePosition(agent);
                        
                        return (
                            <div 
                                key={`head-${agent.id}`} 
                                className={`absolute transition-all duration-[2000ms] ease-in-out pointer-events-auto cursor-pointer ${isActive ? 'animate-bounce' : ''}`} 
                                style={{ 
                                    left: `${pos.x}%`, 
                                    top: `${pos.y}%`, 
                                    transform: 'translate(-50%, -50%)',
                                    animationDuration: '2s',
                                    zIndex: 35 // Explicitly above desks (30)
                                }}
                                onMouseEnter={() => setHoveredAgentId(agent.id)}
                                onMouseLeave={() => setHoveredAgentId(null)}
                            >
                                <div className={`relative flex flex-col items-center transition-all duration-500 ${!isActive ? 'opacity-80 scale-95' : 'opacity-100 scale-100'}`}>
                                    {/* Head */}
                                    <div className={`relative w-10 h-10 rounded-full border-2 flex items-center justify-center z-20 overflow-hidden bg-white ${isActive ? 'border-primary shadow-lg' : 'border-slate-200'}`}>
                                        <img src={agent.avatar} alt={agent.role} className="w-full h-full object-cover" />
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* OFFICE MODE: LAYER 5 - OVERLAYS (Front of Desk) */}
            {viewMode === 'office' && (
                <div className="absolute inset-0 pointer-events-none z-50">
                    {agents.map((agent) => {
                        const isActive = activeAgentIds.has(agent.id);
                        const isHovered = hoveredAgentId === agent.id;
                        const pos = getOfficePosition(agent);
                        const task = activeTasks.find(t => t.assignedTo === agent.role);
                        const showTooltipAbove = pos.y > 60;

                        return (
                            <div 
                                key={`overlay-${agent.id}`}
                                className={`absolute transition-all duration-[2000ms] ease-in-out ${isActive ? 'animate-bounce' : ''}`} 
                                style={{ 
                                    left: `${pos.x}%`, 
                                    top: `${pos.y}%`, 
                                    transform: 'translate(-50%, -50%)',
                                    animationDuration: '2s',
                                    zIndex: isHovered ? 60 : 50 // Ensure active cards are on top
                                }}
                            >
                                {/* Thought Bubbles & Props */}
                                {isActive ? (
                                    <div className="absolute bottom-full mb-6 left-1/2 -translate-x-1/2 bg-white border-2 border-slate-900 px-3 py-2 rounded-2xl rounded-bl-none shadow-[4px_4px_0px_rgba(0,0,0,0.1)] min-w-[140px] max-w-[180px] z-[500] animate-in fade-in zoom-in slide-in-from-bottom-2 origin-bottom-left text-left transform -rotate-2 whitespace-normal break-words">
                                        <div className="text-[9px] font-bold text-slate-800 leading-tight line-clamp-3 font-mono break-words">
                                            {Math.floor(Date.now() / 5000) % 2 === 0 ? task?.title : getContextualThought(task, agent.role, agent.id)}
                                        </div>
                                        <div className="absolute -bottom-1.5 -left-1 w-2.5 h-2.5 bg-white border-2 border-slate-900 rounded-full"></div>
                                        <div className="absolute -bottom-3 -left-2.5 w-1.5 h-1.5 bg-white border-2 border-slate-900 rounded-full"></div>
                                    </div>
                                ) : (
                                    <div className="absolute bottom-full mb-3 right-0 z-[500]">
                                        <div className="flex flex-col -space-y-2 items-end opacity-60">
                                            <span className="text-slate-400 font-bold text-[10px] animate-bounce" style={{ animationDuration: '2s' }}>z</span>
                                            <span className="text-slate-400 font-bold text-xs animate-bounce" style={{ animationDuration: '2.2s', animationDelay: '0.2s' }}>Z</span>
                                            <span className="text-slate-400 font-bold text-sm animate-bounce" style={{ animationDuration: '2.5s', animationDelay: '0.4s' }}>Z</span>
                                        </div>
                                    </div>
                                )}
                                
                                <div className="absolute -top-2 -right-4 bg-white rounded-full p-1 border-2 border-slate-100 shadow-sm z-30 animate-bounce" style={{ animationDuration: '3s' }}>
                                    {getAgentProp(agent.role)}
                                </div>

                                {/* Nameplate */}
                                <div className={`absolute top-full mt-1 left-1/2 -translate-x-1/2 whitespace-nowrap text-[7px] font-bold font-mono uppercase tracking-widest px-1.5 py-0.5 rounded border z-30 transition-opacity ${isActive ? 'bg-white border-slate-300 text-slate-700 shadow-sm opacity-100' : 'bg-slate-100/50 border-transparent text-slate-400 opacity-0 group-hover:opacity-100'}`}>
                                    {agent.name}
                                </div>

                                {/* Hover Tooltip */}
                                {isHovered && (
                                    <div className={`absolute left-1/2 -translate-x-1/2 w-56 bg-white border border-slate-200 p-3 rounded-xl shadow-2xl z-[4000] animate-in fade-in zoom-in-95 text-left ring-4 ring-black/5 pointer-events-none break-words whitespace-normal ${
                                        showTooltipAbove 
                                        ? 'bottom-full mb-4 origin-bottom' 
                                        : 'top-full mt-4 origin-top'
                                    }`}>
                                        <div className="flex items-center gap-3 mb-2 border-b border-slate-100 pb-2">
                                            <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center overflow-hidden border border-slate-200 shrink-0">
                                                <img src={agent.avatar} className="w-full h-full object-cover" />
                                            </div>
                                            <div className="min-w-0">
                                                <div className="text-xs font-bold text-slate-800 truncate">{agent.name}</div>
                                                <div className="text-[9px] text-slate-500 uppercase tracking-wider truncate">{agent.role}</div>
                                            </div>
                                        </div>
                                        {task ? (
                                            <div className="space-y-1.5">
                                                <div className="text-[9px] font-bold text-primary uppercase tracking-wider flex items-center gap-1">
                                                    <Activity size={10} className="animate-pulse" /> Current Task
                                                </div>
                                                <div className="text-[10px] leading-snug font-medium text-slate-700 bg-slate-50 p-2 rounded border border-slate-200 break-words">
                                                    {task.title}
                                                </div>
                                                <div className="flex justify-between items-center text-[9px] text-slate-400 pt-1">
                                                    <span>Progress</span>
                                                    <span className="font-mono text-slate-600">{Math.round(task.progress)}%</span>
                                                </div>
                                                <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-100">
                                                    <div className="h-full bg-primary transition-all duration-300" style={{ width: `${task.progress}%` }}></div>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="text-[10px] text-slate-400 italic text-center py-2 bg-slate-50 rounded border border-slate-100 border-dashed">
                                                Agent is currently idle.
                                            </div>
                                        )}
                                        <div className={`absolute left-1/2 -translate-x-1/2 w-4 h-4 bg-white border-r border-b border-slate-200 rotate-45 ${showTooltipAbove ? '-bottom-2 border-t-0 border-l-0' : '-top-2 border-b-0 border-r-0 bg-white rotate-[225deg]'}`}></div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
      </div>

      {/* RIGHT SIDEBAR: Live Stream Feed */}
      <div className="w-80 bg-white border-l border-slate-200 flex flex-col z-20 shadow-xl shrink-0">
          <div className="p-3 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between">
              <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                  <Activity size={12} className={isProcessing ? 'text-primary animate-pulse' : 'text-slate-400'} /> Neural Stream
              </h3>
              <div className="flex bg-white rounded-lg border border-slate-200 p-0.5">
                  <button 
                    onClick={() => setActiveStreamTab('stream')}
                    className={`px-2 py-1 rounded text-[9px] font-bold uppercase tracking-wider transition-all ${activeStreamTab === 'stream' ? 'bg-slate-100 text-primary' : 'text-slate-400 hover:text-slate-600'}`}
                  >
                      Feed
                  </button>
                  <button 
                    onClick={() => setActiveStreamTab('links')}
                    className={`px-2 py-1 rounded text-[9px] font-bold uppercase tracking-wider transition-all ${activeStreamTab === 'links' ? 'bg-slate-100 text-primary' : 'text-slate-400 hover:text-slate-600'}`}
                  >
                      Links
                  </button>
              </div>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar bg-slate-50/30">
              {activeStreamTab === 'stream' ? (
                  <div className="p-3 space-y-3">
                      {streamHistory.length === 0 && (
                          <div className="text-center py-8 text-slate-400 text-xs italic opacity-60">
                              Waiting for system events...
                          </div>
                      )}
                      {streamHistory.map((event) => (
                          <div key={event.id} className="bg-white p-3 rounded-lg border border-slate-100 shadow-sm animate-in slide-in-from-right-4 duration-300">
                              <div className="flex items-center gap-2 mb-1.5">
                                  {getEventIcon(event.type)}
                                  <span className="text-[9px] font-bold text-slate-600 uppercase tracking-wider">{event.title}</span>
                                  <span className="ml-auto text-[8px] text-slate-300 font-mono">{new Date(event.timestamp).toLocaleTimeString([], {second: '2-digit'})}</span>
                              </div>
                              <div className="text-[10px] text-slate-500 leading-snug border-l-2 border-slate-100 pl-2 break-words">
                                  {event.detail || "Processing..."}
                              </div>
                          </div>
                      ))}
                      <div ref={messagesEndRef} />
                  </div>
              ) : (
                  <div className="p-3 space-y-2">
                      {allResourceTasks.length === 0 && (
                          <div className="text-center py-8 text-slate-400 text-xs italic opacity-60">
                              No resources linked yet.
                          </div>
                      )}
                      {allResourceTasks.map(t => (
                          t.resources?.map((url, i) => (
                              <a key={`${t.id}-${i}`} href={url} target="_blank" rel="noreferrer" className="block bg-white p-2 rounded border border-slate-200 hover:border-primary/50 hover:shadow-sm transition-all group">
                                  <div className="flex items-center gap-2 mb-1">
                                      <ExternalLink size={10} className="text-slate-400 group-hover:text-primary" />
                                      <span className="text-[10px] font-bold text-slate-700 truncate w-full">
                                          {new URL(url).hostname}
                                      </span>
                                  </div>
                                  <div className="text-[9px] text-slate-400 truncate pl-4">{url}</div>
                              </a>
                          ))
                      ))}
                  </div>
              )}
          </div>
      </div>
    </div>
    </>
  );

  // When maximized (especially with autoFullscreen), render in a portal to document.body
  if (isMaximized) {
    return createPortal(content, document.body);
  }

  // Normal rendering when not maximized
  return content;
});

export default NetworkVisualizer;
