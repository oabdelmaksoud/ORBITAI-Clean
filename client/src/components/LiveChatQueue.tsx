import React, { useState, useEffect, useCallback } from 'react';
import {
  Users,
  Clock,
  MessageCircle,
  UserCheck,
  RefreshCw,
  AlertCircle,
  Loader2,
  Crown,
  Zap,
  TrendingUp,
  Play
} from 'lucide-react';
import {
  getChatQueue,
  getChatStats,
  getActiveChats,
  acceptChat,
  ChatQueueItem,
  ChatStats,
  SupportChat,
  formatWaitTime
} from '../services/supportApi';
import { supportWebSocket } from '../services/supportWebsocket';

interface LiveChatQueueProps {
  onSelectChat: (chatId: string) => void;
  selectedChatId?: string;
  currentAgentId?: string;
  currentAgentName?: string;
}

const LiveChatQueue: React.FC<LiveChatQueueProps> = ({
  onSelectChat,
  selectedChatId,
  currentAgentId,
  currentAgentName
}) => {
  const [queue, setQueue] = useState<ChatQueueItem[]>([]);
  const [activeChats, setActiveChats] = useState<SupportChat[]>([]);
  const [stats, setStats] = useState<ChatStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'queue' | 'my-chats' | 'all-active'>('queue');

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [queueData, statsData, myChats, allActive] = await Promise.all([
        getChatQueue(),
        getChatStats(),
        getActiveChats('me'),
        getActiveChats()
      ]);
      
      setQueue(queueData);
      setStats(statsData);
      setActiveChats(activeTab === 'my-chats' ? myChats : allActive);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load chat data');
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    fetchData();
    
    // Set up polling for real-time updates
    const interval = setInterval(fetchData, 10000);
    
    return () => clearInterval(interval);
  }, [fetchData]);

  useEffect(() => {
    // Connect to WebSocket and join support agents room
    const token = localStorage.getItem('admin_token') || '';
    
    supportWebSocket.connect(token).then(() => {
      if (currentAgentId && currentAgentName) {
        supportWebSocket.joinSupportAgents(currentAgentId, currentAgentName);
      }
    }).catch(err => {
      console.error('WebSocket connection failed:', err);
    });

    // Listen for queue updates
    const unsubscribeQueue = supportWebSocket.on('queue_updated', () => {
      fetchData();
    });

    const unsubscribeNewChat = supportWebSocket.on('new_chat_queued', () => {
      fetchData();
    });

    const unsubscribeChatEnded = supportWebSocket.on('chat_ended', () => {
      fetchData();
    });

    return () => {
      unsubscribeQueue();
      unsubscribeNewChat();
      unsubscribeChatEnded();
      supportWebSocket.leaveSupportAgents();
    };
  }, [currentAgentId, currentAgentName, fetchData]);

  const handleAcceptChat = async (chatId: string) => {
    try {
      setAccepting(chatId);
      await acceptChat(chatId);
      onSelectChat(chatId);
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to accept chat');
    } finally {
      setAccepting(null);
    }
  };

  const getPlanBadge = (plan: string) => {
    switch (plan) {
      case 'Enterprise':
        return <Crown className="w-4 h-4 text-yellow-400" />;
      case 'Pro':
        return <Zap className="w-4 h-4 text-blue-400" />;
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-900">
      {/* Stats Bar */}
      {stats && (
        <div className="grid grid-cols-4 gap-4 p-4 border-b border-gray-700 bg-gray-800/50">
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-400">{stats.queueCount}</div>
            <div className="text-xs text-gray-400">In Queue</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-400">{stats.activeCount}</div>
            <div className="text-xs text-gray-400">Active Chats</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-400">{stats.todayChats}</div>
            <div className="text-xs text-gray-400">Today</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-400">
              {stats.avgWaitTime > 0 ? formatWaitTime(stats.avgWaitTime) : '-'}
            </div>
            <div className="text-xs text-gray-400">Avg Wait</div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-gray-700">
        <button
          onClick={() => setActiveTab('queue')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
            activeTab === 'queue'
              ? 'text-orange-400 border-b-2 border-orange-400'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          <Users className="w-4 h-4" />
          Queue
          {queue.length > 0 && (
            <span className="px-2 py-0.5 text-xs bg-orange-600 text-white rounded-full">
              {queue.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('my-chats')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
            activeTab === 'my-chats'
              ? 'text-green-400 border-b-2 border-green-400'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          <MessageCircle className="w-4 h-4" />
          My Chats
        </button>
        <button
          onClick={() => setActiveTab('all-active')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
            activeTab === 'all-active'
              ? 'text-blue-400 border-b-2 border-blue-400'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          All Active
        </button>
        <div className="ml-auto flex items-center pr-2">
          <button
            onClick={fetchData}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-64 text-red-400">
            <AlertCircle className="w-8 h-8 mb-2" />
            <p>{error}</p>
            <button
              onClick={fetchData}
              className="mt-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
            >
              Retry
            </button>
          </div>
        ) : activeTab === 'queue' ? (
          queue.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-400">
              <UserCheck className="w-12 h-12 mb-2" />
              <p>No customers waiting</p>
              <p className="text-sm text-gray-500 mt-1">Queue is empty</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-700">
              {queue.map((item) => (
                <div
                  key={item.chatId}
                  className="p-4 hover:bg-gray-800/50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-white">{item.userName}</span>
                        {getPlanBadge(item.userPlan)}
                        <span className="text-xs text-gray-500">{item.userPlan}</span>
                      </div>
                      <p className="text-sm text-gray-400 truncate">{item.userEmail}</p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Waiting: {formatWaitTime(item.waitTime)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          Position: #{item.queuePosition}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleAcceptChat(item.chatId)}
                      disabled={accepting === item.chatId}
                      className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
                    >
                      {accepting === item.chatId ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Play className="w-4 h-4" />
                      )}
                      Accept
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          activeChats.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-400">
              <MessageCircle className="w-12 h-12 mb-2" />
              <p>No active chats</p>
              <p className="text-sm text-gray-500 mt-1">
                {activeTab === 'my-chats' ? 'Accept a chat from the queue' : 'No chats in progress'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-700">
              {activeChats.map((chat) => (
                <div
                  key={chat.chatId}
                  className={`p-4 hover:bg-gray-800/50 cursor-pointer transition-colors ${
                    selectedChatId === chat.chatId ? 'bg-blue-900/20 border-l-2 border-blue-500' : ''
                  }`}
                  onClick={() => onSelectChat(chat.chatId)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-white">{chat.userName}</span>
                        {getPlanBadge(chat.userPlan)}
                        <span className={`px-2 py-0.5 text-xs rounded-full ${
                          chat.status === 'active' ? 'bg-green-900 text-green-300' : 'bg-gray-700 text-gray-300'
                        }`}>
                          {chat.status}
                        </span>
                      </div>
                      <p className="text-sm text-gray-400 truncate">{chat.userEmail}</p>
                      {activeTab === 'all-active' && chat.agentName && (
                        <p className="text-xs text-gray-500 mt-1">
                          Agent: {chat.agentName}
                        </p>
                      )}
                      <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <MessageCircle className="w-3 h-3" />
                          {chat.messages.length} messages
                        </span>
                        {chat.startedAt && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            Started: {new Date(chat.startedAt).toLocaleTimeString()}
                          </span>
                        )}
                      </div>
                    </div>
                    {chat.messages.length > 0 && (
                      <div className="ml-4 max-w-[200px]">
                        <p className="text-xs text-gray-400 truncate">
                          {chat.messages[chat.messages.length - 1].content}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </div>

      {/* Agent Stats */}
      {stats && stats.agentStats && stats.agentStats.length > 0 && (
        <div className="p-4 border-t border-gray-700 bg-gray-800/30">
          <h4 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">
            Online Agents
          </h4>
          <div className="flex flex-wrap gap-2">
            {stats.agentStats.map((agent) => (
              <div
                key={agent._id}
                className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 rounded-lg"
              >
                <div className="w-2 h-2 rounded-full bg-green-500" />
                <span className="text-sm text-white">{agent.agentName}</span>
                <span className="text-xs text-gray-400">({agent.activeChats} active)</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default LiveChatQueue;




