/**
 * User Support Widget
 * Floating support button with options for live chat and ticket submission
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  MessageCircle,
  Ticket,
  X,
  ChevronUp,
  HelpCircle,
  Send,
  Paperclip,
  Clock,
  CheckCircle,
  AlertCircle,
  Loader2,
  User,
  ArrowLeft,
  History
} from 'lucide-react';
import { io, Socket } from 'socket.io-client';

// Types
interface SupportTicket {
  _id: string;
  ticketNumber: string;
  subject: string;
  status: 'open' | 'in_progress' | 'waiting_on_customer' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  category: string;
  createdAt: string;
  updatedAt: string;
}

interface ChatMessage {
  id: string;
  sender: 'user' | 'agent' | 'ai' | 'system';
  senderName: string;
  content: string;
  createdAt: string;
}

interface UserSupportWidgetProps {
  userId?: string;
  userName?: string;
  userEmail?: string;
  userPlan?: string;
  position?: 'bottom-right' | 'bottom-left';
}

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3002';

// API helpers
function getToken(): string {
  // Use the same token key as the rest of the app
  return localStorage.getItem('authToken') || '';
}

async function apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` }),
      ...options.headers,
    },
  });
  
  // Handle non-JSON responses
  if (!response.ok) {
    let errorMessage = 'Request failed';
    let errorData: any = null;
    try {
      errorData = await response.json();
      errorMessage = errorData.message || errorData.error || errorData.error?.message || errorMessage;
    } catch {
      errorMessage = `HTTP ${response.status}: ${response.statusText}`;
    }
    
    // Handle specific status codes
    if (response.status === 401) {
      errorMessage = 'Please log in to use support chat';
    } else if (response.status === 500) {
      errorMessage = errorData?.error?.message || errorData?.message || 'Server error. Please try again later.';
    }
    
    const error = new Error(errorMessage);
    (error as any).status = response.status;
    (error as any).data = errorData;
    throw error;
  }
  
  const data = await response.json();
  return data;
}

type WidgetView = 'closed' | 'menu' | 'chat' | 'ticket' | 'history';

const UserSupportWidget: React.FC<UserSupportWidgetProps> = ({
  userId,
  userName = 'User',
  userEmail,
  userPlan = 'Free',
  position = 'bottom-right'
}) => {
  const [view, setView] = useState<WidgetView>('closed');
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Chat state
  const [chatId, setChatId] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatStatus, setChatStatus] = useState<'connecting' | 'ai_active' | 'queued' | 'active' | 'ended'>('connecting');
  const [queuePosition, setQueuePosition] = useState<number | null>(null);
  const [agentName, setAgentName] = useState<string | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [isAiPowered, setIsAiPowered] = useState(true);
  
  // Ticket state
  const [ticketSubject, setTicketSubject] = useState('');
  const [ticketDescription, setTicketDescription] = useState('');
  const [ticketCategory, setTicketCategory] = useState<string>('general');
  const [ticketPriority, setTicketPriority] = useState<string>('medium');
  const [submittingTicket, setSubmittingTicket] = useState(false);
  const [ticketSubmitted, setTicketSubmitted] = useState(false);
  const [submittedTicketNumber, setSubmittedTicketNumber] = useState<string | null>(null);
  
  // History state
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<Socket | null>(null);

  // Position classes
  const positionClasses = position === 'bottom-right' 
    ? 'right-6 bottom-6' 
    : 'left-6 bottom-6';

  // Scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // Socket.IO connection for live chat
  useEffect(() => {
    if (view === 'chat' && chatId) {
      const token = getToken();
      
      // Connect to Socket.IO server
      const socket: Socket = io(API_BASE, {
        auth: { token },
        transports: ['polling', 'websocket'], // Try polling first (less noisy)
        reconnection: false, // Disable automatic reconnection
        reconnectionDelay: 5000,
        reconnectionAttempts: 1, // Only try once
        timeout: 5000, // Fail fast
        upgrade: false // Disable automatic upgrade
      });
      
      socket.on('connect', () => {
        if (import.meta.env.DEV) {
          console.log('Support chat Socket.IO connected');
        }
        // Authenticate with token
        socket.emit('authenticate', { token });
        // Join the chat room
        socket.emit('join-chat', { chatId });
      });
      
      socket.on('connect_error', () => {
        // Silently handle connection errors - backend may not be running
        // Connection errors are expected when backend is not available
      });
      
      socket.on('new_message', (data: { message: any; chatId: string }) => {
        if (data.chatId === chatId) {
          setChatMessages(prev => {
            // Avoid duplicates
            if (prev.some(m => m.id === data.message.id)) return prev;
            return [...prev, {
              id: data.message.id,
              sender: data.message.sender,
              senderName: data.message.senderName,
              content: data.message.content,
              createdAt: data.message.createdAt
            }];
          });
          setIsTyping(false);
        }
      });
      
      socket.on('queue_update', (data: { chatId: string; position: number }) => {
        if (data.chatId === chatId) {
          setQueuePosition(data.position);
          setChatStatus('queued');
          setIsAiPowered(false);
        }
      });
      
      socket.on('agent_assigned', (data: { chatId: string; agentName: string }) => {
        if (data.chatId === chatId) {
          setAgentName(data.agentName);
          setChatStatus('active');
          setQueuePosition(null);
          setIsAiPowered(false);
        }
      });
      
      socket.on('agent_joined', (data: { chatId: string; agentName: string }) => {
        if (data.chatId === chatId) {
          setAgentName(data.agentName);
          setChatStatus('active');
          setQueuePosition(null);
          setIsAiPowered(false);
        }
      });
      
      socket.on('typing', (data: { chatId: string; isTyping: boolean }) => {
        if (data.chatId === chatId) {
          setIsTyping(data.isTyping);
        }
      });
      
      socket.on('chat_ended', (data: { chatId: string }) => {
        if (data.chatId === chatId) {
          setChatStatus('ended');
        }
      });
      
      socket.on('escalated_to_human', (data: { chatId: string; queuePosition: number }) => {
        if (data.chatId === chatId) {
          setChatStatus('queued');
          setQueuePosition(data.queuePosition);
          setIsAiPowered(false);
          setAgentName(null);
        }
      });
      
      socket.on('task_completed', (data: { chatId: string; taskId: string; result?: string }) => {
        if (data.chatId === chatId) {
          setChatMessages(prev => [...prev, {
            id: `task-${data.taskId}`,
            sender: 'system',
            senderName: 'System',
            content: `✅ Your issue has been resolved! ${data.result || ''}`,
            createdAt: new Date().toISOString()
          }]);
        }
      });
      
      socket.on('disconnect', () => {
        console.log('Support chat Socket.IO disconnected');
      });
      
      socket.on('connect_error', (error) => {
        console.error('Support chat Socket.IO connection error:', error);
      });
      
      wsRef.current = socket;
      
      return () => {
        socket.disconnect();
      };
    }
  }, [view, chatId]);

  // Start live chat with AI agent
  const startChat = async () => {
    try {
      setChatStatus('connecting');
      setView('chat');
      
      const response = await apiRequest<{ success: boolean; data: { chat: any; aiPowered?: boolean } }>(
        '/api/support/chat/start',
        { method: 'POST' }
      );
      
      const chat = response.data.chat;
      setChatId(chat.chatId);
      setIsAiPowered(response.data.aiPowered || chat.status === 'ai_active');
      
      if (chat.status === 'ai_active') {
        setChatStatus('ai_active');
        setAgentName('AI Support Agent');
        // Load existing messages from chat
        if (chat.messages && chat.messages.length > 0) {
          setChatMessages(chat.messages.map((m: any) => ({
            id: m.id,
            sender: m.sender,
            senderName: m.senderName,
            content: m.content,
            createdAt: m.createdAt
          })));
        }
      } else if (chat.status === 'queued') {
        setQueuePosition(chat.queuePosition);
        setChatStatus('queued');
        setChatMessages([{
          id: 'system-1',
          sender: 'system',
          senderName: 'System',
          content: 'You are now in the support queue. An agent will be with you shortly.',
          createdAt: new Date().toISOString()
        }]);
      } else {
        setChatStatus('active');
        setAgentName(chat.agentName);
      }
    } catch (err: any) {
      console.error('Failed to start chat:', err);
      const errorMessage = err?.message || 'Unable to connect to support. Please try again or submit a ticket.';
      setChatMessages([{
        id: 'error-1',
        sender: 'system',
        senderName: 'System',
        content: errorMessage,
        createdAt: new Date().toISOString()
      }]);
      setChatStatus('ended');
    }
  };

  // Send chat message
  const sendChatMessage = async () => {
    if (!chatInput.trim() || !chatId || sendingMessage) return;
    
    const messageContent = chatInput.trim();
    setChatInput('');
    setSendingMessage(true);
    
    // Optimistically add message
    const tempMessage: ChatMessage = {
      id: `temp-${Date.now()}`,
      sender: 'user',
      senderName: userName,
      content: messageContent,
      createdAt: new Date().toISOString()
    };
    setChatMessages(prev => [...prev, tempMessage]);
    
    try {
      await apiRequest(`/api/support/chat/${chatId}/message`, {
        method: 'POST',
        body: JSON.stringify({ content: messageContent })
      });
    } catch (err) {
      console.error('Failed to send message:', err);
    } finally {
      setSendingMessage(false);
    }
  };

  // End chat
  const endChat = async () => {
    if (chatId) {
      try {
        await apiRequest(`/api/support/chat/${chatId}/end`, { method: 'POST' });
      } catch (err) {
        console.error('Failed to end chat:', err);
      }
    }
    setChatId(null);
    setChatMessages([]);
    setChatStatus('connecting');
    setAgentName(null);
    setView('menu');
  };

  // Submit ticket
  const submitTicket = async () => {
    if (!ticketSubject.trim() || !ticketDescription.trim()) return;
    
    setSubmittingTicket(true);
    
    try {
      const response = await apiRequest<{ success: boolean; data: { ticket: SupportTicket } }>(
        '/api/support/tickets',
        {
          method: 'POST',
          body: JSON.stringify({
            subject: ticketSubject,
            description: ticketDescription,
            category: ticketCategory,
            priority: ticketPriority
          })
        }
      );
      
      setSubmittedTicketNumber(response.data.ticket.ticketNumber);
      setTicketSubmitted(true);
      setTicketSubject('');
      setTicketDescription('');
    } catch (err) {
      console.error('Failed to submit ticket:', err);
    } finally {
      setSubmittingTicket(false);
    }
  };

  // Load ticket history
  const loadTicketHistory = async () => {
    setLoadingTickets(true);
    setView('history');
    
    try {
      const response = await apiRequest<{ success: boolean; data: { tickets: SupportTicket[] } }>(
        '/api/support/tickets/my'
      );
      setTickets(response.data.tickets);
    } catch (err) {
      console.error('Failed to load tickets:', err);
    } finally {
      setLoadingTickets(false);
    }
  };

  // Reset ticket form
  const resetTicketForm = () => {
    setTicketSubmitted(false);
    setSubmittedTicketNumber(null);
    setTicketSubject('');
    setTicketDescription('');
    setTicketCategory('general');
    setTicketPriority('medium');
  };

  // Status badge colors
  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      open: 'bg-blue-500/20 text-blue-400',
      in_progress: 'bg-yellow-500/20 text-yellow-400',
      waiting_on_customer: 'bg-purple-500/20 text-purple-400',
      resolved: 'bg-green-500/20 text-green-400',
      closed: 'bg-gray-500/20 text-gray-400'
    };
    return colors[status] || colors.open;
  };

  // Render closed state (floating button)
  if (view === 'closed') {
    return (
      <button
        onClick={() => setView('menu')}
        className={`fixed ${positionClasses} z-50 w-14 h-14 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-full shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300 flex items-center justify-center group`}
      >
        <HelpCircle className="w-7 h-7 text-white group-hover:scale-110 transition-transform" />
        <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-white animate-pulse" />
      </button>
    );
  }

  return (
    <div className={`fixed ${positionClasses} z-50 w-96 max-h-[600px] bg-gray-900 rounded-2xl shadow-2xl border border-gray-700 overflow-hidden flex flex-col animate-in slide-in-from-bottom-4 duration-300`}>
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {view !== 'menu' && (
            <button
              onClick={() => {
                if (view === 'chat' && chatStatus === 'active') {
                  if (confirm('Are you sure you want to leave the chat?')) {
                    endChat();
                  }
                } else if (view === 'ticket' && !ticketSubmitted) {
                  setView('menu');
                } else {
                  resetTicketForm();
                  setView('menu');
                }
              }}
              className="p-1 hover:bg-white/20 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-white" />
            </button>
          )}
          <div>
            <h3 className="text-white font-semibold">
              {view === 'menu' && 'How can we help?'}
              {view === 'chat' && chatStatus === 'ai_active' && '🤖 AI Support Agent'}
              {view === 'chat' && chatStatus === 'active' && `💬 ${agentName || 'Support Agent'}`}
              {view === 'chat' && chatStatus === 'queued' && '⏳ Connecting...'}
              {view === 'chat' && chatStatus === 'connecting' && 'Starting chat...'}
              {view === 'chat' && chatStatus === 'ended' && 'Chat Ended'}
              {view === 'ticket' && 'Submit a Ticket'}
              {view === 'history' && 'Your Tickets'}
            </h3>
            {view === 'chat' && chatStatus === 'ai_active' && (
              <p className="text-white/70 text-sm">AI-powered instant support</p>
            )}
            {view === 'chat' && chatStatus === 'queued' && queuePosition && (
              <p className="text-white/70 text-sm">Queue position: {queuePosition}</p>
            )}
          </div>
        </div>
        <button
          onClick={() => {
            if (view === 'chat' && chatStatus === 'active') {
              if (confirm('Are you sure you want to close? The chat will end.')) {
                endChat();
                setView('closed');
              }
            } else {
              setView('closed');
            }
          }}
          className="p-1 hover:bg-white/20 rounded-lg transition-colors"
        >
          <X className="w-5 h-5 text-white" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Menu View */}
        {view === 'menu' && (
          <div className="p-4 space-y-3">
            <p className="text-gray-400 text-sm mb-4">
              Choose how you'd like to get help:
            </p>
            
            {/* Live Chat Option - AI First */}
            <button
              onClick={startChat}
              className="w-full p-4 bg-gray-800 hover:bg-gray-750 rounded-xl border border-gray-700 hover:border-purple-500/50 transition-all group text-left"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gradient-to-br from-purple-500/20 to-indigo-500/20 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                  <MessageCircle className="w-6 h-6 text-purple-400" />
                </div>
                <div>
                  <h4 className="text-white font-medium">AI Chat Support</h4>
                  <p className="text-gray-400 text-sm">Get instant help from our AI agent</p>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <div className="flex items-center gap-2 text-purple-400 text-sm">
                  <span className="w-2 h-2 bg-purple-400 rounded-full animate-pulse" />
                  AI available 24/7
                </div>
                <span className="text-xs text-gray-500">Human backup available</span>
              </div>
            </button>
            
            {/* Submit Ticket Option */}
            <button
              onClick={() => setView('ticket')}
              className="w-full p-4 bg-gray-800 hover:bg-gray-750 rounded-xl border border-gray-700 hover:border-blue-500/50 transition-all group text-left"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Ticket className="w-6 h-6 text-blue-400" />
                </div>
                <div>
                  <h4 className="text-white font-medium">Submit a Ticket</h4>
                  <p className="text-gray-400 text-sm">Get help via email within 24 hours</p>
                </div>
              </div>
            </button>
            
            {/* View History Option */}
            <button
              onClick={loadTicketHistory}
              className="w-full p-4 bg-gray-800 hover:bg-gray-750 rounded-xl border border-gray-700 hover:border-blue-500/50 transition-all group text-left"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                  <History className="w-6 h-6 text-purple-400" />
                </div>
                <div>
                  <h4 className="text-white font-medium">View My Tickets</h4>
                  <p className="text-gray-400 text-sm">Check status of your support requests</p>
                </div>
              </div>
            </button>
          </div>
        )}

        {/* Chat View */}
        {view === 'chat' && (
          <div className="flex flex-col h-[400px]">
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {chatMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                      msg.sender === 'user'
                        ? 'bg-blue-600 text-white rounded-br-md'
                        : msg.sender === 'system'
                        ? 'bg-gray-700 text-gray-300 text-center text-sm'
                        : msg.sender === 'ai'
                        ? 'bg-gradient-to-br from-purple-800 to-indigo-800 text-white rounded-bl-md border border-purple-500/30'
                        : 'bg-gray-800 text-white rounded-bl-md'
                    }`}
                  >
                    {(msg.sender === 'agent' || msg.sender === 'ai') && (
                      <p className={`text-xs mb-1 ${msg.sender === 'ai' ? 'text-purple-300' : 'text-blue-400'}`}>
                        {msg.sender === 'ai' ? '🤖 ' : ''}{msg.senderName}
                      </p>
                    )}
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                    <p className={`text-xs mt-1 ${msg.sender === 'user' ? 'text-blue-200' : msg.sender === 'ai' ? 'text-purple-300/70' : 'text-gray-500'}`}>
                      {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              ))}
              
              {isTyping && (
                <div className="flex justify-start">
                  <div className="bg-gray-800 rounded-2xl px-4 py-2 rounded-bl-md">
                    <div className="flex gap-1">
                      <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>
            
            {/* Chat Input */}
            {chatStatus !== 'ended' && (
              <div className="p-4 border-t border-gray-700">
                {chatStatus === 'ai_active' && (
                  <p className="text-xs text-gray-500 mb-2 text-center">
                    💡 Type "speak to human" anytime to connect with a human agent
                  </p>
                )}
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendChatMessage()}
                    placeholder={
                      chatStatus === 'queued' 
                        ? 'Waiting for agent...' 
                        : chatStatus === 'ai_active'
                        ? 'Ask me anything...'
                        : 'Type a message...'
                    }
                    disabled={chatStatus === 'queued' || chatStatus === 'connecting'}
                    className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 disabled:opacity-50"
                  />
                  <button
                    onClick={sendChatMessage}
                    disabled={!chatInput.trim() || chatStatus === 'queued' || chatStatus === 'connecting' || sendingMessage}
                    className={`p-2 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                      chatStatus === 'ai_active' 
                        ? 'bg-purple-600 hover:bg-purple-700' 
                        : 'bg-blue-600 hover:bg-blue-700'
                    }`}
                  >
                    {sendingMessage ? (
                      <Loader2 className="w-5 h-5 text-white animate-spin" />
                    ) : (
                      <Send className="w-5 h-5 text-white" />
                    )}
                  </button>
                </div>
              </div>
            )}
            
            {chatStatus === 'ended' && (
              <div className="p-4 border-t border-gray-700 text-center">
                <p className="text-gray-400 mb-2">Chat ended</p>
                <button
                  onClick={() => setView('menu')}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                >
                  Back to Menu
                </button>
              </div>
            )}
          </div>
        )}

        {/* Ticket View */}
        {view === 'ticket' && (
          <div className="p-4">
            {ticketSubmitted ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-8 h-8 text-green-400" />
                </div>
                <h4 className="text-white font-semibold text-lg mb-2">Ticket Submitted!</h4>
                <p className="text-gray-400 mb-4">
                  Your ticket number is <span className="text-blue-400 font-mono">{submittedTicketNumber}</span>
                </p>
                <p className="text-gray-500 text-sm mb-6">
                  We'll respond to your request within 24 hours.
                </p>
                <button
                  onClick={() => {
                    resetTicketForm();
                    setView('menu');
                  }}
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                >
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={(e) => { e.preventDefault(); submitTicket(); }} className="space-y-4">
                {/* Subject */}
                <div>
                  <label className="block text-gray-400 text-sm mb-1">Subject *</label>
                  <input
                    type="text"
                    value={ticketSubject}
                    onChange={(e) => setTicketSubject(e.target.value)}
                    placeholder="Brief description of your issue"
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                    required
                  />
                </div>
                
                {/* Category & Priority */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-gray-400 text-sm mb-1">Category</label>
                    <select
                      value={ticketCategory}
                      onChange={(e) => setTicketCategory(e.target.value)}
                      className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-blue-500"
                    >
                      <option value="general">General</option>
                      <option value="billing">Billing</option>
                      <option value="technical">Technical</option>
                      <option value="account">Account</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-gray-400 text-sm mb-1">Priority</label>
                    <select
                      value={ticketPriority}
                      onChange={(e) => setTicketPriority(e.target.value)}
                      className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-blue-500"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="urgent">Urgent</option>
                    </select>
                  </div>
                </div>
                
                {/* Description */}
                <div>
                  <label className="block text-gray-400 text-sm mb-1">Description *</label>
                  <textarea
                    value={ticketDescription}
                    onChange={(e) => setTicketDescription(e.target.value)}
                    placeholder="Please describe your issue in detail..."
                    rows={5}
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 resize-none"
                    required
                  />
                </div>
                
                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={!ticketSubject.trim() || !ticketDescription.trim() || submittingTicket}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                  {submittingTicket ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <Send className="w-5 h-5" />
                      Submit Ticket
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        )}

        {/* History View */}
        {view === 'history' && (
          <div className="p-4">
            {loadingTickets ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
              </div>
            ) : tickets.length === 0 ? (
              <div className="text-center py-12">
                <Ticket className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400">No tickets found</p>
                <button
                  onClick={() => setView('ticket')}
                  className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                >
                  Create Your First Ticket
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {tickets.map((ticket) => (
                  <div
                    key={ticket._id}
                    className="p-4 bg-gray-800 rounded-xl border border-gray-700 hover:border-gray-600 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-medium truncate">{ticket.subject}</p>
                        <p className="text-gray-500 text-sm font-mono">{ticket.ticketNumber}</p>
                      </div>
                      <span className={`px-2 py-1 rounded-lg text-xs font-medium ${getStatusColor(ticket.status)}`}>
                        {ticket.status.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 mt-3 text-gray-500 text-sm">
                      <span className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {new Date(ticket.createdAt).toLocaleDateString()}
                      </span>
                      <span className="capitalize">{ticket.category}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-gray-700 bg-gray-800/50">
        <p className="text-gray-500 text-xs text-center">
          Powered by OrbitAI Support
        </p>
      </div>
    </div>
  );
};

export default UserSupportWidget;

