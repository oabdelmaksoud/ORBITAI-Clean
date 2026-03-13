import React, { useState, useEffect } from 'react';
import {
  Ticket,
  MessageCircle,
  FileText,
  BarChart3,
  Users,
  Clock,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  Loader2,
  RefreshCw
} from 'lucide-react';
import TicketList from './TicketList';
import TicketDetail from './TicketDetail';
import LiveChatQueue from './LiveChatQueue';
import LiveChatWindow from './LiveChatWindow';
import ResponseTemplates from './ResponseTemplates';
import { getTicketStats, getChatStats, TicketStats, ChatStats } from '../services/supportApi';

type SupportView = 'tickets' | 'chat' | 'templates';

interface SupportDashboardProps {
  initialView?: SupportView;
  currentAgentId?: string;
  currentAgentName?: string;
}

const SupportDashboard: React.FC<SupportDashboardProps> = ({
  initialView = 'tickets',
  currentAgentId,
  currentAgentName
}) => {
  const [activeView, setActiveView] = useState<SupportView>(initialView);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [ticketStats, setTicketStats] = useState<TicketStats | null>(null);
  const [chatStats, setChatStats] = useState<ChatStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      setLoadingStats(true);
      const [tickets, chats] = await Promise.all([
        getTicketStats(),
        getChatStats()
      ]);
      setTicketStats(tickets);
      setChatStats(chats);
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    } finally {
      setLoadingStats(false);
    }
  };

  const handleSelectTicket = (ticketId: string) => {
    setSelectedTicketId(ticketId);
  };

  const handleBackFromTicket = () => {
    setSelectedTicketId(null);
  };

  const handleSelectChat = (chatId: string) => {
    setSelectedChatId(chatId);
  };

  const handleBackFromChat = () => {
    setSelectedChatId(null);
  };

  const handleChatEnded = () => {
    setSelectedChatId(null);
    fetchStats();
  };

  // If viewing a specific ticket
  if (activeView === 'tickets' && selectedTicketId) {
    return (
      <TicketDetail
        ticketId={selectedTicketId}
        onBack={handleBackFromTicket}
      />
    );
  }

  // If viewing a specific chat
  if (activeView === 'chat' && selectedChatId) {
    return (
      <LiveChatWindow
        chatId={selectedChatId}
        onBack={handleBackFromChat}
        onChatEnded={handleChatEnded}
        currentAgentId={currentAgentId}
        currentAgentName={currentAgentName}
      />
    );
  }

  return (
    <div className="flex flex-col h-full bg-gray-900">
      {/* Header with Stats */}
      <div className="p-6 border-b border-gray-700 bg-gray-800/50">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Customer Support</h1>
            <p className="text-gray-400 mt-1">Manage tickets and live chat support</p>
          </div>
          <button
            onClick={fetchStats}
            disabled={loadingStats}
            className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loadingStats ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {/* Ticket Stats */}
          <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
            <div className="flex items-center gap-2 text-blue-400 mb-2">
              <Ticket className="w-5 h-5" />
              <span className="text-sm font-medium">Open Tickets</span>
            </div>
            <div className="text-2xl font-bold text-white">
              {loadingStats ? <Loader2 className="w-5 h-5 animate-spin" /> : ticketStats?.byStatus?.open || 0}
            </div>
          </div>

          <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
            <div className="flex items-center gap-2 text-yellow-400 mb-2">
              <Clock className="w-5 h-5" />
              <span className="text-sm font-medium">In Progress</span>
            </div>
            <div className="text-2xl font-bold text-white">
              {loadingStats ? <Loader2 className="w-5 h-5 animate-spin" /> : ticketStats?.byStatus?.in_progress || 0}
            </div>
          </div>

          <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
            <div className="flex items-center gap-2 text-orange-400 mb-2">
              <AlertCircle className="w-5 h-5" />
              <span className="text-sm font-medium">Unassigned</span>
            </div>
            <div className="text-2xl font-bold text-white">
              {loadingStats ? <Loader2 className="w-5 h-5 animate-spin" /> : ticketStats?.unassigned || 0}
            </div>
          </div>

          {/* Chat Stats */}
          <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
            <div className="flex items-center gap-2 text-red-400 mb-2">
              <Users className="w-5 h-5" />
              <span className="text-sm font-medium">Chat Queue</span>
            </div>
            <div className="text-2xl font-bold text-white">
              {loadingStats ? <Loader2 className="w-5 h-5 animate-spin" /> : chatStats?.queueCount || 0}
            </div>
          </div>

          <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
            <div className="flex items-center gap-2 text-green-400 mb-2">
              <MessageCircle className="w-5 h-5" />
              <span className="text-sm font-medium">Active Chats</span>
            </div>
            <div className="text-2xl font-bold text-white">
              {loadingStats ? <Loader2 className="w-5 h-5 animate-spin" /> : chatStats?.activeCount || 0}
            </div>
          </div>

          <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
            <div className="flex items-center gap-2 text-purple-400 mb-2">
              <TrendingUp className="w-5 h-5" />
              <span className="text-sm font-medium">Today's Chats</span>
            </div>
            <div className="text-2xl font-bold text-white">
              {loadingStats ? <Loader2 className="w-5 h-5 animate-spin" /> : chatStats?.todayChats || 0}
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-gray-700 px-6">
        <button
          onClick={() => setActiveView('tickets')}
          className={`flex items-center gap-2 px-6 py-4 text-sm font-medium transition-colors relative ${
            activeView === 'tickets'
              ? 'text-blue-400'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          <Ticket className="w-5 h-5" />
          Support Tickets
          {ticketStats && (ticketStats.byStatus?.open || 0) + (ticketStats.byStatus?.in_progress || 0) > 0 && (
            <span className="px-2 py-0.5 text-xs bg-blue-600 text-white rounded-full">
              {(ticketStats.byStatus?.open || 0) + (ticketStats.byStatus?.in_progress || 0)}
            </span>
          )}
          {activeView === 'tickets' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-400" />
          )}
        </button>
        <button
          onClick={() => setActiveView('chat')}
          className={`flex items-center gap-2 px-6 py-4 text-sm font-medium transition-colors relative ${
            activeView === 'chat'
              ? 'text-green-400'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          <MessageCircle className="w-5 h-5" />
          Live Chat
          {chatStats && chatStats.queueCount > 0 && (
            <span className="px-2 py-0.5 text-xs bg-red-600 text-white rounded-full animate-pulse">
              {chatStats.queueCount}
            </span>
          )}
          {activeView === 'chat' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-green-400" />
          )}
        </button>
        <button
          onClick={() => setActiveView('templates')}
          className={`flex items-center gap-2 px-6 py-4 text-sm font-medium transition-colors relative ${
            activeView === 'templates'
              ? 'text-purple-400'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          <FileText className="w-5 h-5" />
          Response Templates
          {activeView === 'templates' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-400" />
          )}
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {activeView === 'tickets' && (
          <TicketList
            onSelectTicket={handleSelectTicket}
            selectedTicketId={selectedTicketId || undefined}
          />
        )}
        {activeView === 'chat' && (
          <LiveChatQueue
            onSelectChat={handleSelectChat}
            selectedChatId={selectedChatId || undefined}
            currentAgentId={currentAgentId}
            currentAgentName={currentAgentName}
          />
        )}
        {activeView === 'templates' && (
          <ResponseTemplates mode="manage" />
        )}
      </div>
    </div>
  );
};

export default SupportDashboard;




