import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

interface Notification {
  _id: string;
  type: 'mention' | 'comment' | 'reply' | 'assignment' | 'project_share' | 'workspace_invite';
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  data?: {
    workspace?: { name: string; slug: string };
    project?: { name: string };
    actor?: { name: string; avatar: string };
    resourceType?: string;
    resourceId?: string;
  };
}

interface NotificationCenterProps {
  onClose?: () => void;
}

const NOTIFICATION_ICONS = {
  mention: '💬',
  comment: '💭',
  reply: '↩️',
  assignment: '📋',
  project_share: '🤝',
  workspace_invite: '📧'
};

const NotificationCenter: React.FC<NotificationCenterProps> = ({ onClose }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    fetchNotifications();
    fetchUnreadCount();
  }, []);

  const fetchNotifications = async () => {
    try {
      const response = await fetch('/api/notifications?limit=50', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setNotifications(data.notifications);
      }
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUnreadCount = async () => {
    try {
      const response = await fetch('/api/notifications/unread', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setUnreadCount(data.count);
      }
    } catch (error) {
      console.error('Failed to fetch unread count:', error);
    }
  };

  const markAsRead = async (notificationId: string) => {
    try {
      const response = await fetch(`/api/notifications/${notificationId}/read`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        setNotifications(
          notifications.map(n =>
            n._id === notificationId ? { ...n, read: true } : n
          )
        );
        setUnreadCount(Math.max(0, unreadCount - 1));
      }
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const response = await fetch('/api/notifications/read-all', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        setNotifications(
          notifications.map(n => ({ ...n, read: true }))
        );
        setUnreadCount(0);
      }
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    markAsRead(notification._id);
    
    // Navigate based on notification type
    if (notification.data?.workspace && notification.data?.project) {
      navigate(`/workspace/${notification.data.workspace.slug}/project/${notification.data.project.name}`);
    } else if (notification.data?.workspace) {
      navigate(`/workspace/${notification.data.workspace.slug}`);
    }
    
    onClose?.();
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="w-96 max-h-[600px] bg-slate-800 rounded-lg shadow-xl border border-slate-700 overflow-hidden">
        <div className="p-4 border-b border-slate-700">
          <div className="h-6 bg-slate-700 rounded w-1/3 animate-pulse"></div>
        </div>
        <div className="p-4 space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex space-x-3">
              <div className="w-10 h-10 bg-slate-700 rounded-full animate-pulse"></div>
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-slate-700 rounded w-3/4 animate-pulse"></div>
                <div className="h-3 bg-slate-700 rounded w-1/2 animate-pulse"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="w-96 max-h-[600px] bg-slate-800 rounded-lg shadow-xl border border-slate-700 overflow-hidden flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-slate-700 flex items-center justify-between">
        <h3 className="text-white font-semibold">Notifications</h3>
        {unreadCount > 0 && (
          <button
            onClick={markAllAsRead}
            className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
          >
            Mark all as read
          </button>
        )}
      </div>

      {/* Notifications List */}
      <div className="flex-1 overflow-y-auto">
        {notifications.length === 0 ? (
          <div className="p-8 text-center text-slate-400">
            <div className="text-4xl mb-2">🔔</div>
            <p className="text-sm">No notifications yet</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-700">
            {notifications.map((notification) => (
              <button
                key={notification._id}
                onClick={() => handleNotificationClick(notification)}
                className={`w-full p-4 text-left hover:bg-slate-700 transition-colors ${
                  !notification.read ? 'bg-slate-700/50' : ''
                }`}
              >
                <div className="flex items-start space-x-3">
                  {/* Icon */}
                  <div className="text-2xl flex-shrink-0">
                    {NOTIFICATION_ICONS[notification.type]}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between mb-1">
                      <p className="text-sm font-medium text-white truncate">
                        {notification.title}
                      </p>
                      {!notification.read && (
                        <span className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 ml-2"></span>
                      )}
                    </div>
                    
                    <p className="text-xs text-slate-300 line-clamp-2 mb-1">
                      {notification.message}
                    </p>

                    <div className="flex items-center space-x-2 text-xs text-slate-400">
                      <span>{formatDate(notification.createdAt)}</span>
                      {notification.data?.actor && (
                        <>
                          <span>•</span>
                          <span>{notification.data.actor.name}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      {notifications.length > 0 && (
        <div className="p-3 border-t border-slate-700 text-center">
          <button
            onClick={() => {
              navigate('/notifications');
              onClose?.();
            }}
            className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
          >
            View all notifications
          </button>
        </div>
      )}
    </div>
  );
};

export default NotificationCenter;
