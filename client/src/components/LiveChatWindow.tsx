import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ArrowLeft,
  Send,
  Phone,
  Video,
  MoreVertical,
  User,
  Clock,
  Tag,
  FileText,
  X,
  Loader2,
  AlertCircle,
  RefreshCw,
  Copy,
  ExternalLink,
  ArrowRightLeft,
  XCircle,
  Ticket,
  Star,
  MessageSquare,
  Crown,
  Zap,
  Paperclip
} from 'lucide-react';
import {
  getChatDetails,
  sendChatMessage,
  transferChat,
  endChat,
  createTicketFromChat,
  getSupportAgents,
  getResponseTemplates,
  SupportChat,
  ChatMessage,
  SupportAgent,
  UserContext,
  ResponseTemplate,
  formatWaitTime
} from '../services/supportApi';
import { supportWebSocket, ChatMessageEvent, TypingIndicatorEvent } from '../services/supportWebsocket';

interface LiveChatWindowProps {
  chatId: string;
  onBack: () => void;
  onChatEnded?: () => void;
  currentAgentId?: string;
  currentAgentName?: string;
}

const LiveChatWindow: React.FC<LiveChatWindowProps> = ({
  chatId,
  onBack,
  onChatEnded,
  currentAgentId,
  currentAgentName
}) => {
  const [chat, setChat] = useState<SupportChat | null>(null);
  const [userContext, setUserContext] = useState<UserContext | null>(null);
  const [agents, setAgents] = useState<SupportAgent[]>([]);
  const [templates, setTemplates] = useState<ResponseTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Message input
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  
  // Typing indicator
  const [isTyping, setIsTyping] = useState(false);
  const [userTyping, setUserTyping] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Actions
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showEndModal, setShowEndModal] = useState(false);
  const [showCreateTicketModal, setShowCreateTicketModal] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [transferAgentId, setTransferAgentId] = useState('');
  const [transferReason, setTransferReason] = useState('');
  const [endReason, setEndReason] = useState('');
  const [ticketSubject, setTicketSubject] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  
  // Sidebar
  const [showSidebar, setShowSidebar] = useState(true);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const fetchChatDetails = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getChatDetails(chatId);
      setChat(data.chat);
      setUserContext(data.userContext);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load chat');
    } finally {
      setLoading(false);
    }
  }, [chatId]);

  const fetchAgents = useCallback(async () => {
    try {
      const data = await getSupportAgents();
      setAgents(data.filter(a => a._id !== currentAgentId));
    } catch (err) {
      console.error('Failed to fetch agents:', err);
    }
  }, [currentAgentId]);

  const fetchTemplates = useCallback(async () => {
    try {
      const data = await getResponseTemplates();
      setTemplates(data);
    } catch (err) {
      console.error('Failed to fetch templates:', err);
    }
  }, []);

  useEffect(() => {
    fetchChatDetails();
    fetchAgents();
    fetchTemplates();
  }, [fetchChatDetails, fetchAgents, fetchTemplates]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chat?.messages]);

  useEffect(() => {
    // Join the chat room
    supportWebSocket.joinChat(chatId);

    // Listen for new messages
    const unsubscribeMessage = supportWebSocket.on<ChatMessageEvent>('message', (data) => {
      if (data.chatId === chatId) {
        setChat(prev => {
          if (!prev) return prev;
          const messageExists = prev.messages.some(m => m.id === data.messageId);
          if (messageExists) return prev;
          
          return {
            ...prev,
            messages: [...prev.messages, {
              id: data.messageId,
              sender: data.sender,
              senderId: data.senderId,
              senderName: data.senderName,
              content: data.content,
              createdAt: new Date(data.timestamp).toISOString()
            }]
          };
        });
      }
    });

    // Listen for typing indicators
    const unsubscribeTyping = supportWebSocket.on<TypingIndicatorEvent>('typing', (data) => {
      if (data.chatId === chatId && !data.isAgent) {
        setUserTyping(data.isTyping);
      }
    });

    // Listen for chat ended
    const unsubscribeChatEnded = supportWebSocket.on('chat_ended', (data: any) => {
      if (data.chatId === chatId) {
        setChat(prev => prev ? { ...prev, status: 'ended' } : prev);
        onChatEnded?.();
      }
    });

    return () => {
      supportWebSocket.leaveChat(chatId);
      unsubscribeMessage();
      unsubscribeTyping();
      unsubscribeChatEnded();
    };
  }, [chatId, onChatEnded]);

  const handleSendMessage = async () => {
    if (!message.trim() || sending || chat?.status === 'ended') return;
    
    try {
      setSending(true);
      const sentMessage = await sendChatMessage(chatId, message.trim());
      
      // Add message to local state
      setChat(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          messages: [...prev.messages, sentMessage]
        };
      });
      
      setMessage('');
      
      // Send via WebSocket for real-time update
      supportWebSocket.sendMessage(chatId, sentMessage.id, sentMessage.content);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const handleTyping = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value);
    
    // Send typing indicator
    if (!isTyping) {
      setIsTyping(true);
      supportWebSocket.sendTypingIndicator(chatId, true);
    }
    
    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    // Set timeout to stop typing indicator
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      supportWebSocket.sendTypingIndicator(chatId, false);
    }, 2000);
  };

  const handleTransfer = async () => {
    if (!transferAgentId) return;
    
    try {
      setActionLoading(true);
      await transferChat(chatId, transferAgentId, transferReason);
      setShowTransferModal(false);
      onBack();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to transfer chat');
    } finally {
      setActionLoading(false);
    }
  };

  const handleEndChat = async () => {
    try {
      setActionLoading(true);
      await endChat(chatId, endReason);
      setShowEndModal(false);
      onChatEnded?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to end chat');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateTicket = async () => {
    try {
      setActionLoading(true);
      await createTicketFromChat(chatId, { subject: ticketSubject });
      setShowCreateTicketModal(false);
      // Show success message
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create ticket');
    } finally {
      setActionLoading(false);
    }
  };

  const handleInsertTemplate = (content: string) => {
    setMessage(prev => prev + content);
    setShowTemplates(false);
    inputRef.current?.focus();
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  if (error || !chat) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-red-400">
        <AlertCircle className="w-8 h-8 mb-2" />
        <p>{error || 'Chat not found'}</p>
        <button
          onClick={onBack}
          className="mt-4 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
        >
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-gray-900">
      {/* Header */}
      <div className="flex items-center gap-4 p-4 border-b border-gray-700 bg-gray-800/50">
        <button
          onClick={onBack}
          className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-white">{chat.userName}</span>
            {getPlanBadge(chat.userPlan)}
            <span className={`px-2 py-0.5 text-xs rounded-full ${
              chat.status === 'active' ? 'bg-green-900 text-green-300' : 
              chat.status === 'ended' ? 'bg-gray-700 text-gray-300' :
              'bg-yellow-900 text-yellow-300'
            }`}>
              {chat.status}
            </span>
          </div>
          <p className="text-sm text-gray-400">{chat.userEmail}</p>
        </div>
        
        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowTransferModal(true)}
            disabled={chat.status === 'ended'}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
            title="Transfer Chat"
          >
            <ArrowRightLeft className="w-5 h-5" />
          </button>
          <button
            onClick={() => setShowCreateTicketModal(true)}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
            title="Create Ticket"
          >
            <Ticket className="w-5 h-5" />
          </button>
          <button
            onClick={() => setShowEndModal(true)}
            disabled={chat.status === 'ended'}
            className="p-2 text-gray-400 hover:text-red-400 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
            title="End Chat"
          >
            <XCircle className="w-5 h-5" />
          </button>
          <button
            onClick={() => setShowSidebar(!showSidebar)}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
            title="Toggle Sidebar"
          >
            <User className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Chat Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {chat.messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.sender === 'agent' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[70%] rounded-lg p-3 ${
                    msg.sender === 'agent'
                      ? 'bg-blue-600 text-white'
                      : msg.sender === 'system'
                      ? 'bg-gray-700 text-gray-300 text-center w-full max-w-full text-sm'
                      : 'bg-gray-800 text-white'
                  }`}
                >
                  {msg.sender !== 'system' && (
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium opacity-80">{msg.senderName}</span>
                      <span className="text-xs opacity-60">{formatDate(msg.createdAt)}</span>
                    </div>
                  )}
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                </div>
              </div>
            ))}
            
            {/* Typing indicator */}
            {userTyping && (
              <div className="flex justify-start">
                <div className="bg-gray-800 rounded-lg px-4 py-2">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          {chat.status !== 'ended' ? (
            <div className="p-4 border-t border-gray-700">
              {/* Templates button */}
              <div className="flex items-center gap-2 mb-2">
                <button
                  onClick={() => setShowTemplates(!showTemplates)}
                  className="flex items-center gap-1 px-3 py-1 text-xs text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <FileText className="w-3 h-3" />
                  Templates
                </button>
              </div>
              
              {/* Templates dropdown */}
              {showTemplates && (
                <div className="mb-2 max-h-48 overflow-y-auto bg-gray-800 border border-gray-700 rounded-lg">
                  {templates.length === 0 ? (
                    <p className="p-3 text-sm text-gray-400">No templates available</p>
                  ) : (
                    templates.map((template) => (
                      <button
                        key={template._id}
                        onClick={() => handleInsertTemplate(template.content)}
                        className="w-full text-left px-3 py-2 hover:bg-gray-700 transition-colors"
                      >
                        <p className="text-sm font-medium text-white">{template.name}</p>
                        <p className="text-xs text-gray-400 truncate">{template.content}</p>
                      </button>
                    ))
                  )}
                </div>
              )}
              
              <div className="flex gap-2">
                <textarea
                  ref={inputRef}
                  value={message}
                  onChange={handleTyping}
                  placeholder="Type your message..."
                  rows={2}
                  className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!message.trim() || sending}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center gap-2 self-end"
                >
                  {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1">Press Enter to send, Shift+Enter for new line</p>
            </div>
          ) : (
            <div className="p-4 border-t border-gray-700 bg-gray-800/50 text-center">
              <p className="text-gray-400">This chat has ended</p>
              {chat.rating && (
                <div className="flex items-center justify-center gap-1 mt-2">
                  <span className="text-sm text-gray-400">Rating:</span>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={`w-4 h-4 ${star <= chat.rating! ? 'text-yellow-400 fill-yellow-400' : 'text-gray-600'}`}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sidebar */}
        {showSidebar && (
          <div className="w-80 border-l border-gray-700 overflow-y-auto">
            {/* User Info */}
            <div className="p-4 border-b border-gray-700">
              <h3 className="text-sm font-medium text-gray-400 mb-3">Customer</h3>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-gray-500" />
                  <span className="text-sm text-white">{chat.userName}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">{chat.userEmail}</span>
                  <button
                    onClick={() => navigator.clipboard.writeText(chat.userEmail)}
                    className="p-1 text-gray-500 hover:text-white transition-colors"
                  >
                    <Copy className="w-3 h-3" />
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  {getPlanBadge(chat.userPlan)}
                  <span className="text-xs text-gray-400">{chat.userPlan} Plan</span>
                </div>
                {userContext?.user && (
                  <div className="text-xs text-gray-400">
                    Member since: {new Date(userContext.user.createdAt).toLocaleDateString()}
                  </div>
                )}
              </div>
            </div>

            {/* Chat Info */}
            <div className="p-4 border-b border-gray-700">
              <h3 className="text-sm font-medium text-gray-400 mb-3">Chat Info</h3>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-500">Chat ID</span>
                  <span className="text-gray-300 font-mono">{chat.chatId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Started</span>
                  <span className="text-gray-300">
                    {chat.startedAt ? new Date(chat.startedAt).toLocaleString() : '-'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Messages</span>
                  <span className="text-gray-300">{chat.messages.length}</span>
                </div>
                {chat.transfers && chat.transfers.length > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Transfers</span>
                    <span className="text-gray-300">{chat.transfers.length}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Recent Tickets */}
            {userContext?.recentTickets && userContext.recentTickets.length > 0 && (
              <div className="p-4 border-b border-gray-700">
                <h3 className="text-sm font-medium text-gray-400 mb-3">Recent Tickets</h3>
                <div className="space-y-2">
                  {userContext.recentTickets.map((ticket: any) => (
                    <div key={ticket._id} className="p-2 bg-gray-800 rounded-lg">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500 font-mono">{ticket.ticketNumber}</span>
                        <span className={`px-1.5 py-0.5 text-xs rounded ${
                          ticket.status === 'open' ? 'bg-blue-900 text-blue-300' :
                          ticket.status === 'resolved' ? 'bg-green-900 text-green-300' :
                          'bg-gray-700 text-gray-300'
                        }`}>
                          {ticket.status}
                        </span>
                      </div>
                      <p className="text-xs text-gray-300 truncate mt-1">{ticket.subject}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recent Chats */}
            {userContext?.recentChats && userContext.recentChats.length > 0 && (
              <div className="p-4">
                <h3 className="text-sm font-medium text-gray-400 mb-3">Recent Chats</h3>
                <div className="space-y-2">
                  {userContext.recentChats.map((prevChat: any) => (
                    <div key={prevChat._id} className="p-2 bg-gray-800 rounded-lg">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-500">
                          {new Date(prevChat.createdAt).toLocaleDateString()}
                        </span>
                        {prevChat.rating && (
                          <div className="flex items-center gap-0.5">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <Star
                                key={star}
                                className={`w-3 h-3 ${star <= prevChat.rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-600'}`}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Transfer Modal */}
      {showTransferModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-gray-800 rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Transfer Chat</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Transfer to Agent
                </label>
                <select
                  value={transferAgentId}
                  onChange={(e) => setTransferAgentId(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select an agent</option>
                  {agents.map(agent => (
                    <option key={agent._id} value={agent._id}>
                      {agent.name} ({agent.activeChats} active chats)
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Reason (optional)
                </label>
                <textarea
                  value={transferReason}
                  onChange={(e) => setTransferReason(e.target.value)}
                  placeholder="Why are you transferring this chat?"
                  rows={2}
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setShowTransferModal(false)}
                className="px-4 py-2 text-gray-300 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleTransfer}
                disabled={!transferAgentId || actionLoading}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
              >
                {actionLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                Transfer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* End Chat Modal */}
      {showEndModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-gray-800 rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold text-white mb-4">End Chat</h3>
            <p className="text-gray-400 mb-4">Are you sure you want to end this chat?</p>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Reason (optional)
              </label>
              <textarea
                value={endReason}
                onChange={(e) => setEndReason(e.target.value)}
                placeholder="Why are you ending this chat?"
                rows={2}
                className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setShowEndModal(false)}
                className="px-4 py-2 text-gray-300 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleEndChat}
                disabled={actionLoading}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
              >
                {actionLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                End Chat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Ticket Modal */}
      {showCreateTicketModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-gray-800 rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Create Ticket from Chat</h3>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Ticket Subject
              </label>
              <input
                type="text"
                value={ticketSubject}
                onChange={(e) => setTicketSubject(e.target.value)}
                placeholder={`Follow-up from chat ${chat.chatId}`}
                className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <p className="text-xs text-gray-500 mt-2">
              The chat transcript will be included in the ticket description.
            </p>
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setShowCreateTicketModal(false)}
                className="px-4 py-2 text-gray-300 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateTicket}
                disabled={actionLoading}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
              >
                {actionLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                Create Ticket
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LiveChatWindow;




