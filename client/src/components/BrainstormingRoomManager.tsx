import React, { useState, useEffect } from 'react';
import { Plus, Search, Users, Clock, Archive, ArrowRight, Settings, X } from 'lucide-react';
import { brainstormingRoomApi, BrainstormingRoom, CreateRoomData } from '@src/services/brainstormingRoomApi';
import { toast } from '../services/toastService';
import AttendeeLimitIndicator from './AttendeeLimitIndicator';

interface BrainstormingRoomManagerProps {
  onSelectRoom?: (roomId: string) => void;
  currentRoomId?: string;
  onClose?: () => void;
}

const BrainstormingRoomManager: React.FC<BrainstormingRoomManagerProps> = ({
  onSelectRoom,
  currentRoomId,
  onClose
}) => {
  const [rooms, setRooms] = useState<BrainstormingRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newRoom, setNewRoom] = useState<CreateRoomData>({
    name: '',
    description: '',
    sessionTemplate: 'brainstorm'
  });

  useEffect(() => {
    loadRooms();
  }, []);

  const loadRooms = async () => {
    try {
      setLoading(true);
      const data = await brainstormingRoomApi.getRooms('active', searchQuery || undefined);
      setRooms(data);
    } catch (error: any) {
      toast.error(error.message || 'Failed to load rooms');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchQuery !== '') {
        loadRooms();
      }
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  const handleCreateRoom = async () => {
    try {
      if (!newRoom.name.trim()) {
        toast.error('Room name is required');
        return;
      }

      const room = await brainstormingRoomApi.createRoom(newRoom);
      setRooms([room, ...rooms]);
      setShowCreateModal(false);
      setNewRoom({ name: '', description: '', sessionTemplate: 'brainstorm' });
      toast.success('Room created successfully');
      
      if (onSelectRoom) {
        onSelectRoom(room.id);
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to create room');
    }
  };

  const handleDeleteRoom = async (roomId: string) => {
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
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div>
          <h2 className="text-xl font-semibold">Brainstorming Rooms</h2>
          <p className="text-sm text-gray-500 mt-1">Collaborate and ideate with your team</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-lg hover:from-purple-600 hover:to-blue-600 transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            New Room
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="p-4 border-b">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search rooms..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>
      </div>

      {/* Rooms List */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="text-center py-8 text-gray-500">Loading rooms...</div>
        ) : rooms.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-400 mb-4">
              <Users className="w-12 h-12 mx-auto" />
            </div>
            <p className="text-gray-500 mb-2">No rooms found</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="text-purple-500 hover:text-purple-600 font-medium"
            >
              Create your first room
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {rooms.map(room => (
              <div
                key={room.id}
                className={`border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer ${
                  currentRoomId === room.id ? 'ring-2 ring-purple-500' : ''
                }`}
                onClick={() => onSelectRoom && onSelectRoom(room.id)}
              >
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-semibold text-gray-900 truncate">{room.name}</h3>
                  {room.createdBy === (window as any).user?.id && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteRoom(room.id);
                      }}
                      className="p-1 hover:bg-gray-100 rounded"
                    >
                      <Archive className="w-4 h-4 text-gray-400" />
                    </button>
                  )}
                </div>
                
                {room.topic && (
                  <p className="text-sm text-gray-600 mb-2 line-clamp-2">{room.topic}</p>
                )}
                
                <div className="flex items-center gap-4 text-xs text-gray-500 mt-3">
                  <div className="flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    <span>{room.participants?.length || 0} {room.maxAttendees ? `/ ${room.maxAttendees}` : '/ ∞'}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    <span>{formatDate(room.updatedAt)}</span>
                  </div>
                </div>

                {/* Attendee Limit Indicator */}
                {room.maxAttendees && (
                  <div className="mt-2">
                    <AttendeeLimitIndicator
                      currentCount={room.participants?.length || 0}
                      maxCount={room.maxAttendees}
                      onUpgrade={() => {
                        // Navigate to upgrade page or show upgrade modal
                        window.location.href = '/pricing';
                      }}
                    />
                  </div>
                )}

                {room.ideas && room.ideas.length > 0 && (
                  <div className="mt-2 text-xs text-gray-500">
                    {room.ideas.length} ideas
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Room Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold">Create New Room</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Room Name</label>
                <input
                  type="text"
                  value={newRoom.name}
                  onChange={(e) => setNewRoom({ ...newRoom, name: e.target.value })}
                  placeholder="e.g., Product Brainstorm"
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Description (Optional)</label>
                <textarea
                  value={newRoom.description}
                  onChange={(e) => setNewRoom({ ...newRoom, description: e.target.value })}
                  placeholder="What will this room be used for?"
                  rows={3}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Session Template</label>
                <select
                  value={newRoom.sessionTemplate}
                  onChange={(e) => setNewRoom({ ...newRoom, sessionTemplate: e.target.value as any })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="brainstorm">Brainstorm</option>
                  <option value="design-sprint">Design Sprint</option>
                  <option value="mindmap">Mind Map</option>
                  <option value="custom">Custom</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 p-4 border-t">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateRoom}
                className="px-4 py-2 bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-lg hover:from-purple-600 hover:to-blue-600 transition-colors"
              >
                Create Room
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BrainstormingRoomManager;
