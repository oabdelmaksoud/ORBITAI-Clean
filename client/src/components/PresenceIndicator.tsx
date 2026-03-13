/**
 * PresenceIndicator Component
 * Displays active users viewing a project in real-time
 * 
 * @component
 * @example
 * ```tsx
 * <PresenceIndicator 
 *   projectId="project123" 
 *   currentUserId="user456" 
 * />
 * ```
 */

import React, { useState, useEffect } from 'react';
import { Users } from 'lucide-react';

interface PresenceUser {
  userId: string;
  userName: string;
}

interface PresenceIndicatorProps {
  /** The ID of the project being viewed */
  projectId: string;
  /** The ID of the current user (to exclude from the list) */
  currentUserId?: string;
}

export const PresenceIndicator: React.FC<PresenceIndicatorProps> = ({
  projectId,
  currentUserId
}) => {
  const [users, setUsers] = useState<PresenceUser[]>([]);

  useEffect(() => {
    const handlePresenceList = (event: CustomEvent) => {
      setUsers(event.detail.users || []);
    };

    const handleUserJoined = (event: CustomEvent) => {
      const { userId, userName } = event.detail;
      if (userId !== currentUserId) {
        setUsers(prev => {
          if (!prev.find(u => u.userId === userId)) {
            return [...prev, { userId, userName }];
          }
          return prev;
        });
      }
    };

    const handleUserLeft = (event: CustomEvent) => {
      const { userId } = event.detail;
      setUsers(prev => prev.filter(u => u.userId !== userId));
    };

    window.addEventListener('websocket-presence-list', handleUserJoined);
    window.addEventListener('websocket-user-left', handleUserLeft as EventListener);

    return () => {
      window.removeEventListener('websocket-presence-list', handlePresenceList as EventListener);
      window.removeEventListener('websocket-user-joined', handleUserJoined as EventListener);
      window.removeEventListener('websocket-user-left', handleUserLeft as EventListener);
    };
  }, [currentUserId]);

  if (users.length === 0) return null;

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-lg border border-slate-200">
      <Users size={14} className="text-slate-500" />
      <div className="flex items-center gap-1">
        {users.slice(0, 3).map((user) => (
          <div
            key={user.userId}
            className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center text-xs font-bold"
            title={user.userName}
            aria-label={`${user.userName} is viewing this project`}
          >
            {user.userName.charAt(0).toUpperCase()}
          </div>
        ))}
        {users.length > 3 && (
          <span className="text-xs text-slate-600 font-medium">
            +{users.length - 3}
          </span>
        )}
      </div>
    </div>
  );
};

