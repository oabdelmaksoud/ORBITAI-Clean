import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft,
  Send,
  Clock,
  User,
  Tag,
  MessageSquare,
  FileText,
  History,
  StickyNote,
  Edit,
  Check,
  X,
  ChevronDown,
  Loader2,
  AlertCircle,
  UserPlus,
  RefreshCw,
  Copy,
  ExternalLink
} from 'lucide-react';
import {
  getTicketDetails,
  updateTicket,
  addTicketMessage,
  addInternalNote,
  getSupportAgents,
  SupportTicket,
  TicketMessage,
  InternalNote,
  TicketHistoryEntry,
  TicketStatus,
  TicketPriority,
  TicketCategory,
  SupportAgent,
  UserContext,
  getStatusColor,
  getPriorityColor,
  getCategoryIcon
} from '../services/supportApi';

interface TicketDetailProps {
  ticketId: string;
  onBack: () => void;
  onInsertTemplate?: (content: string) => void;
}

const STATUS_OPTIONS: { value: TicketStatus; label: string }[] = [
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'waiting_on_customer', label: 'Waiting on Customer' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' }
];

const PRIORITY_OPTIONS: { value: TicketPriority; label: string }[] = [
  { value: 'urgent', label: 'Urgent' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' }
];

const CATEGORY_OPTIONS: { value: TicketCategory; label: string }[] = [
  { value: 'billing', label: 'Billing' },
  { value: 'technical', label: 'Technical' },
  { value: 'account', label: 'Account' },
  { value: 'general', label: 'General' }
];

const TicketDetail: React.FC<TicketDetailProps> = ({ ticketId, onBack, onInsertTemplate }) => {
  const [ticket, setTicket] = useState<SupportTicket | null>(null);
  const [userContext, setUserContext] = useState<UserContext | null>(null);
  const [agents, setAgents] = useState<SupportAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'conversation' | 'notes' | 'history'>('conversation');
  
  // Message input
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  
  // Note input
  const [note, setNote] = useState('');
  const [addingNote, setAddingNote] = useState(false);
  
  // Editing state
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<any>(null);
  const [updating, setUpdating] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchTicketDetails();
    fetchAgents();
  }, [ticketId]);

  useEffect(() => {
    if (activeTab === 'conversation') {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [ticket?.messages, activeTab]);

  const fetchTicketDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getTicketDetails(ticketId);
      setTicket(data.ticket);
      setUserContext(data.userContext);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load ticket');
    } finally {
      setLoading(false);
    }
  };

  const fetchAgents = async () => {
    try {
      const data = await getSupportAgents();
      setAgents(data);
    } catch (err) {
      console.error('Failed to fetch agents:', err);
    }
  };

  const handleSendMessage = async () => {
    if (!message.trim() || sending) return;
    
    try {
      setSending(true);
      const updatedTicket = await addTicketMessage(ticketId, message.trim());
      setTicket(updatedTicket);
      setMessage('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const handleAddNote = async () => {
    if (!note.trim() || addingNote) return;
    
    try {
      setAddingNote(true);
      const updatedTicket = await addInternalNote(ticketId, note.trim());
      setTicket(updatedTicket);
      setNote('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add note');
    } finally {
      setAddingNote(false);
    }
  };

  const handleUpdateField = async (field: string, value: any) => {
    if (!ticket || updating) return;
    
    try {
      setUpdating(true);
      const updates: any = { [field]: value };
      const updatedTicket = await updateTicket(ticketId, updates);
      setTicket(updatedTicket);
      setEditingField(null);
      setEditValue(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update ticket');
    } finally {
      setUpdating(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    
    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  if (error || !ticket) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-red-400">
        <AlertCircle className="w-8 h-8 mb-2" />
        <p>{error || 'Ticket not found'}</p>
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
            <span className="text-sm text-gray-400 font-mono">{ticket.ticketNumber}</span>
            <span className={`px-2 py-0.5 text-xs rounded-full ${getStatusColor(ticket.status)}`}>
              {ticket.status.replace('_', ' ')}
            </span>
            <span className={`px-2 py-0.5 text-xs rounded-full ${getPriorityColor(ticket.priority)}`}>
              {ticket.priority}
            </span>
          </div>
          <h2 className="text-lg font-semibold text-white truncate">{ticket.subject}</h2>
        </div>
        <button
          onClick={fetchTicketDetails}
          className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
          title="Refresh"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-gray-700">
            <button
              onClick={() => setActiveTab('conversation')}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === 'conversation'
                  ? 'text-blue-400 border-b-2 border-blue-400'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              Conversation
            </button>
            <button
              onClick={() => setActiveTab('notes')}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === 'notes'
                  ? 'text-blue-400 border-b-2 border-blue-400'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <StickyNote className="w-4 h-4" />
              Internal Notes
              {ticket.internalNotes.length > 0 && (
                <span className="px-1.5 py-0.5 text-xs bg-gray-700 rounded-full">
                  {ticket.internalNotes.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === 'history'
                  ? 'text-blue-400 border-b-2 border-blue-400'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <History className="w-4 h-4" />
              History
            </button>
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-y-auto p-4">
            {activeTab === 'conversation' && (
              <div className="space-y-4">
                {ticket.messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.sender === 'agent' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-lg p-3 ${
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
                          <span className="text-xs opacity-60">{formatRelativeTime(msg.createdAt)}</span>
                        </div>
                      )}
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            )}

            {activeTab === 'notes' && (
              <div className="space-y-4">
                {ticket.internalNotes.length === 0 ? (
                  <p className="text-center text-gray-400 py-8">No internal notes yet</p>
                ) : (
                  ticket.internalNotes.map((noteItem) => (
                    <div key={noteItem.id} className="bg-yellow-900/20 border border-yellow-700/50 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-sm font-medium text-yellow-400">{noteItem.agentName}</span>
                        <span className="text-xs text-gray-400">{formatRelativeTime(noteItem.createdAt)}</span>
                      </div>
                      <p className="text-gray-300 whitespace-pre-wrap">{noteItem.content}</p>
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === 'history' && (
              <div className="space-y-3">
                {ticket.history.map((entry) => (
                  <div key={entry.id} className="flex items-start gap-3 text-sm">
                    <div className="w-2 h-2 mt-2 rounded-full bg-gray-600" />
                    <div className="flex-1">
                      <p className="text-gray-300">
                        <span className="font-medium text-white">{entry.performedByName}</span>
                        {' '}{entry.details}
                      </p>
                      <p className="text-xs text-gray-500">{formatDate(entry.createdAt)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Message/Note Input */}
          {activeTab === 'conversation' && (
            <div className="p-4 border-t border-gray-700">
              <div className="flex gap-2">
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Type your reply..."
                  rows={3}
                  className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                      handleSendMessage();
                    }
                  }}
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!message.trim() || sending}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center gap-2"
                >
                  {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Send
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-2">Press Cmd/Ctrl + Enter to send</p>
            </div>
          )}

          {activeTab === 'notes' && (
            <div className="p-4 border-t border-gray-700">
              <div className="flex gap-2">
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Add internal note (only visible to agents)..."
                  rows={2}
                  className="flex-1 px-3 py-2 bg-gray-800 border border-yellow-700/50 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-500 resize-none"
                />
                <button
                  onClick={handleAddNote}
                  disabled={!note.trim() || addingNote}
                  className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center gap-2"
                >
                  {addingNote ? <Loader2 className="w-4 h-4 animate-spin" /> : <StickyNote className="w-4 h-4" />}
                  Add Note
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="w-80 border-l border-gray-700 overflow-y-auto">
          {/* Ticket Properties */}
          <div className="p-4 border-b border-gray-700">
            <h3 className="text-sm font-medium text-gray-400 mb-3">Properties</h3>
            
            {/* Status */}
            <div className="mb-3">
              <label className="text-xs text-gray-500">Status</label>
              <select
                value={ticket.status}
                onChange={(e) => handleUpdateField('status', e.target.value)}
                disabled={updating}
                className="w-full mt-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {STATUS_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            {/* Priority */}
            <div className="mb-3">
              <label className="text-xs text-gray-500">Priority</label>
              <select
                value={ticket.priority}
                onChange={(e) => handleUpdateField('priority', e.target.value)}
                disabled={updating}
                className="w-full mt-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {PRIORITY_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            {/* Category */}
            <div className="mb-3">
              <label className="text-xs text-gray-500">Category</label>
              <select
                value={ticket.category}
                onChange={(e) => handleUpdateField('category', e.target.value)}
                disabled={updating}
                className="w-full mt-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {CATEGORY_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            {/* Assigned To */}
            <div className="mb-3">
              <label className="text-xs text-gray-500">Assigned To</label>
              <select
                value={ticket.assignedTo || ''}
                onChange={(e) => handleUpdateField('assignedTo', e.target.value || null)}
                disabled={updating}
                className="w-full mt-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Unassigned</option>
                {agents.map(agent => (
                  <option key={agent._id} value={agent._id}>{agent.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* User Info */}
          <div className="p-4 border-b border-gray-700">
            <h3 className="text-sm font-medium text-gray-400 mb-3">Customer</h3>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-gray-500" />
                <span className="text-sm text-white">{ticket.userName}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">{ticket.userEmail}</span>
                <button
                  onClick={() => navigator.clipboard.writeText(ticket.userEmail)}
                  className="p-1 text-gray-500 hover:text-white transition-colors"
                >
                  <Copy className="w-3 h-3" />
                </button>
              </div>
              {userContext?.user && (
                <>
                  <div className="text-xs text-gray-400">
                    Plan: <span className="text-white">{userContext.user.plan}</span>
                  </div>
                  <div className="text-xs text-gray-400">
                    Member since: {new Date(userContext.user.createdAt).toLocaleDateString()}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Recent Tickets */}
          {userContext?.recentTickets && userContext.recentTickets.length > 0 && (
            <div className="p-4">
              <h3 className="text-sm font-medium text-gray-400 mb-3">Recent Tickets</h3>
              <div className="space-y-2">
                {userContext.recentTickets.map((t: any) => (
                  <div key={t._id} className="p-2 bg-gray-800 rounded-lg">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500 font-mono">{t.ticketNumber}</span>
                      <span className={`px-1.5 py-0.5 text-xs rounded ${getStatusColor(t.status)}`}>
                        {t.status}
                      </span>
                    </div>
                    <p className="text-xs text-gray-300 truncate mt-1">{t.subject}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Timestamps */}
          <div className="p-4 border-t border-gray-700">
            <h3 className="text-sm font-medium text-gray-400 mb-3">Timeline</h3>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-500">Created</span>
                <span className="text-gray-300">{formatDate(ticket.createdAt)}</span>
              </div>
              {ticket.firstResponseAt && (
                <div className="flex justify-between">
                  <span className="text-gray-500">First Response</span>
                  <span className="text-gray-300">{formatDate(ticket.firstResponseAt)}</span>
                </div>
              )}
              {ticket.resolvedAt && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Resolved</span>
                  <span className="text-gray-300">{formatDate(ticket.resolvedAt)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-500">Last Updated</span>
                <span className="text-gray-300">{formatDate(ticket.updatedAt)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TicketDetail;




