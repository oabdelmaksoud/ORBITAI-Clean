import React, { useState, useEffect } from 'react';
import { Plus, Search, Users, Clock, Archive, X, ChevronLeft, MessageSquare, Lightbulb, Target, Layers, Sparkles } from 'lucide-react';
import { brainstormingRoomApi, BrainstormingRoom, CreateRoomData } from '@src/services/brainstormingRoomApi';
import { toast } from '../services/toastService';
import AttendeeLimitIndicator from './AttendeeLimitIndicator';
import { Idea } from './OrbGraph';

interface RoomsSidebarProps {
  currentRoomId?: string | null;
  currentRoom?: BrainstormingRoom | null;
  ideas?: Idea[];
  currentPhase?: 0 | 1 | 2 | 3 | 4;
  activeSubProjectId?: string | null;
  roomUsers?: Array<{ userId: string; userName: string }>;
  isWebSocketConnected?: boolean;
  onSelectRoom: (roomId: string) => void;
  onClose: () => void;
  onCreateNewRoom?: () => void;
}

const RoomsSidebar: React.FC<RoomsSidebarProps> = ({
  currentRoomId,
  currentRoom,
  ideas = [],
  currentPhase = 0,
  activeSubProjectId,
  roomUsers = [],
  isWebSocketConnected = false,
  onSelectRoom,
  onClose,
  onCreateNewRoom
}) => {
  const [rooms, setRooms] = useState<BrainstormingRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showOtherRooms, setShowOtherRooms] = useState(false);

  useEffect(() => {
    loadRooms();
  }, []);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      loadRooms();
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  const loadRooms = async () => {
    try {
      setLoading(true);
      const data = await brainstormingRoomApi.getRooms('active', searchQuery || undefined);
      // Filter out current room from the list
      const otherRooms = data.filter(r => r.id !== currentRoomId);
      setRooms(otherRooms);
    } catch (error: any) {
      toast.error(error.message || 'Failed to load rooms');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRoom = async () => {
    try {
      const roomData: CreateRoomData = {
        name: `New Room ${new Date().toLocaleDateString()}`,
        description: '',
        sessionTemplate: 'brainstorm'
      };
      const room = await brainstormingRoomApi.createRoom(roomData);
      setRooms([room, ...rooms]);
      toast.success('Room created successfully');
      onSelectRoom(room.id);
      if (onCreateNewRoom) {
        onCreateNewRoom();
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to create room');
    }
  };

  const handleDeleteRoom = async (roomId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to archive this room?')) return;

    try {
      await brainstormingRoomApi.deleteRoom(roomId);
      setRooms(rooms.filter(r => r.id !== roomId));
      toast.success('Room archived');
    } catch (error: any) {
      toast.error(error.message || 'Failed to archive room');
    }
  };

  const formatDate = (date: Date | string) => {
    const d = typeof date === 'string' ? new Date(date) : date;
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // Calculate statistics for current room
  const roomStats = currentRoom ? {
    ideasCount: currentRoom.ideas?.length || ideas.length || 0,
    participantsCount: currentRoom.participants?.length || 0,
    subProjectsCount: currentRoom.subProjects?.length || 0,
    activeSubProject: currentRoom.subProjects?.find(sp => sp.id === activeSubProjectId)
  } : null;

  // Phase labels
  const phaseLabels = {
    0: 'Ideation',
    1: 'Planning',
    2: 'Development',
    3: 'Prototyping',
    4: 'Launched'
  };

  return (
    <div className="h-full flex flex-col backdrop-blur-xl bg-white/40 border-r border-white/60 shadow-2xl">
      {/* Header */}
      <div className="border-b border-slate-300/30 pb-4 pt-6 px-6 shrink-0">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs font-bold tracking-widest text-slate-500 uppercase">Session Context</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-white/40 rounded-lg transition-colors"
            title="Close sidebar"
          >
            <ChevronLeft size={16} className="text-slate-600" />
          </button>
        </div>
      </div>

      {/* Current Room Context */}
      <div className="flex-1 overflow-y-auto custom-scrollbar px-6 py-4 space-y-6">
        {currentRoom ? (
          <>
            {/* Current Focus / Topic */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-slate-600">
                <Target size={16} className="opacity-90" />
                <h3 className="font-semibold text-sm">Current Focus:</h3>
              </div>
              <div className="ml-6">
                <p className="text-base font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-violet-600 leading-tight">
                  {currentRoom.topic || currentRoom.name || 'Brainstorming Session'}
                </p>
                {currentRoom.description && (
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed bg-white/40 p-2 rounded-lg border border-white/50">
                    {currentRoom.description}
                  </p>
                )}
              </div>
            </div>

            {/* Session Statistics */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-slate-600">
                <Sparkles size={16} className="opacity-90" />
                <h3 className="font-semibold text-sm">Session Stats</h3>
              </div>
              <div className="ml-6 space-y-2">
                <div className="flex items-center justify-between bg-white/40 p-2 rounded-lg border border-white/50">
                  <div className="flex items-center gap-2">
                    <Lightbulb size={14} className="text-amber-500" />
                    <span className="text-xs text-slate-700">Ideas Generated</span>
                  </div>
                  <span className="text-xs font-bold text-slate-800">{roomStats?.ideasCount || 0}</span>
                </div>
                
                <div className="flex items-center justify-between bg-white/40 p-2 rounded-lg border border-white/50">
                  <div className="flex items-center gap-2">
                    <Users size={14} className="text-blue-500" />
                    <span className="text-xs text-slate-700">Participants</span>
                  </div>
                  <span className="text-xs font-bold text-slate-800">
                    {roomStats?.participantsCount || 0}
                    {isWebSocketConnected && (
                      <span className="ml-1.5 w-1.5 h-1.5 bg-green-500 rounded-full inline-block animate-pulse" title="Connected" />
                    )}
                  </span>
                </div>

                {currentPhase !== undefined && (
                  <div className="flex items-center justify-between bg-white/40 p-2 rounded-lg border border-white/50">
                    <div className="flex items-center gap-2">
                      <Layers size={14} className="text-purple-500" />
                      <span className="text-xs text-slate-700">Phase</span>
                    </div>
                    <span className="text-xs font-bold text-slate-800">{phaseLabels[currentPhase] || 'Phase ' + currentPhase}</span>
                  </div>
                )}

                {roomStats?.subProjectsCount && roomStats.subProjectsCount > 0 && (
                  <div className="flex items-center justify-between bg-white/40 p-2 rounded-lg border border-white/50">
                    <div className="flex items-center gap-2">
                      <Target size={14} className="text-violet-500" />
                      <span className="text-xs text-slate-700">Sub-Projects</span>
                    </div>
                    <span className="text-xs font-bold text-slate-800">{roomStats.subProjectsCount}</span>
                  </div>
                )}

                {roomStats?.activeSubProject && (
                  <div className="bg-gradient-to-r from-purple-500/20 to-blue-500/20 p-2 rounded-lg border border-purple-300/50">
                    <div className="flex items-center gap-2 mb-1">
                      <Target size={12} className="text-purple-600" />
                      <span className="text-xs font-semibold text-slate-700">Active Sub-Project</span>
                    </div>
                    <p className="text-xs text-slate-800 ml-4 font-medium">{roomStats.activeSubProject.name}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Online Participants */}
            {roomUsers && roomUsers.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-slate-600">
                  <Users size={16} className="opacity-90" />
                  <h3 className="font-semibold text-sm">Online Now</h3>
                </div>
                <div className="ml-6 flex flex-wrap gap-1.5">
                  {roomUsers.map(p => (
                    <span key={p.userId} className="px-2 py-1 bg-white/40 rounded-lg border border-white/50 text-xs text-slate-700">
                      {p.userName}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Attendee Limit Indicator */}
            {currentRoom.maxAttendees !== undefined && (
              <div className="ml-6">
                <AttendeeLimitIndicator
                  currentCount={currentRoom.participants?.length || 0}
                  maxCount={currentRoom.maxAttendees}
                  onUpgrade={() => {
                    window.location.href = '/pricing';
                  }}
                />
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-8">
            <MessageSquare size={32} className="mx-auto mb-3 opacity-50 text-slate-400" />
            <p className="text-xs text-slate-500 mb-4">No active session</p>
            <button
              onClick={handleCreateRoom}
              className="px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 transition-all text-xs font-medium flex items-center gap-2 mx-auto"
            >
              <Plus size={14} />
              <span>Start New Session</span>
            </button>
          </div>
        )}

        {/* Other Rooms Section */}
        {currentRoom && (
          <div className="space-y-3 pt-4 border-t border-slate-300/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-slate-600">
                <MessageSquare size={16} className="opacity-90" />
                <h3 className="font-semibold text-sm">Other Rooms</h3>
              </div>
              <button
                onClick={() => setShowOtherRooms(!showOtherRooms)}
                className="text-xs text-slate-500 hover:text-slate-700 transition-colors"
              >
                {showOtherRooms ? 'Hide' : `Show (${rooms.length})`}
              </button>
            </div>

            {showOtherRooms && (
              <>
                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search rooms..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-2 py-1.5 text-xs border border-white/60 rounded-lg bg-white/40 focus:outline-none focus:ring-1 focus:ring-purple-500/50 focus:border-purple-300/50"
                  />
                </div>

                {/* New Room Button */}
                <button
                  onClick={handleCreateRoom}
                  className="w-full px-3 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 transition-all text-xs font-medium flex items-center gap-2 justify-center"
                >
                  <Plus size={14} />
                  <span>New Room</span>
                </button>

                {/* Rooms List */}
                <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar">
                  {loading ? (
                    <div className="text-center py-4 text-slate-400 text-xs">Loading...</div>
                  ) : rooms.length === 0 ? (
                    <div className="text-center py-4 text-slate-400">
                      <p className="text-xs">No other rooms found</p>
                    </div>
                  ) : (
                    rooms.map(room => (
                      <div
                        key={room.id}
                        className="p-2 bg-white/40 hover:bg-white/60 border border-white/50 rounded-lg cursor-pointer transition-all group"
                        onClick={() => onSelectRoom(room.id)}
                      >
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <h4 className="text-xs font-semibold text-slate-700 line-clamp-1 flex-1">
                            {room.name}
                          </h4>
                          <button
                            onClick={(e) => handleDeleteRoom(room.id, e)}
                            className="p-1 hover:bg-rose-50 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Archive room"
                          >
                            <Archive size={11} className="text-rose-500" />
                          </button>
                        </div>

                        {room.topic && (
                          <p className="text-[10px] text-slate-500 line-clamp-1 mb-1.5">
                            {room.topic}
                          </p>
                        )}

                        <div className="flex items-center gap-2 text-[9px] text-slate-400">
                          <div className="flex items-center gap-1">
                            <Users size={10} />
                            <span>{room.participants?.length || 0}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Lightbulb size={10} />
                            <span>{room.ideas?.length || 0}</span>
                          </div>
                          <div className="flex items-center gap-1 ml-auto">
                            <Clock size={10} />
                            <span>{formatDate(room.updatedAt)}</span>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default RoomsSidebar;
