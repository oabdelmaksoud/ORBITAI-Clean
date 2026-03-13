import React, { useState, useEffect, useCallback } from 'react';
import {
  Search,
  Filter,
  ChevronDown,
  ChevronUp,
  MoreVertical,
  Clock,
  User,
  Tag,
  AlertCircle,
  CheckCircle,
  XCircle,
  Loader2,
  RefreshCw,
  Download,
  Trash2,
  UserPlus,
  ArrowUpDown
} from 'lucide-react';
import {
  getTickets,
  getTicketStats,
  bulkTicketAction,
  SupportTicket,
  TicketStatus,
  TicketPriority,
  TicketCategory,
  TicketStats,
  getStatusColor,
  getPriorityColor,
  getCategoryIcon
} from '../services/supportApi';

interface TicketListProps {
  onSelectTicket: (ticketId: string) => void;
  selectedTicketId?: string;
}

const STATUS_OPTIONS: { value: TicketStatus | ''; label: string }[] = [
  { value: '', label: 'All Status' },
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'waiting_on_customer', label: 'Waiting on Customer' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' }
];

const PRIORITY_OPTIONS: { value: TicketPriority | ''; label: string }[] = [
  { value: '', label: 'All Priority' },
  { value: 'urgent', label: 'Urgent' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' }
];

const CATEGORY_OPTIONS: { value: TicketCategory | ''; label: string }[] = [
  { value: '', label: 'All Categories' },
  { value: 'billing', label: 'Billing' },
  { value: 'technical', label: 'Technical' },
  { value: 'account', label: 'Account' },
  { value: 'general', label: 'General' }
];

const TicketList: React.FC<TicketListProps> = ({ onSelectTicket, selectedTicketId }) => {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [stats, setStats] = useState<TicketStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<TicketStatus | ''>('');
  const [priorityFilter, setPriorityFilter] = useState<TicketPriority | ''>('');
  const [categoryFilter, setCategoryFilter] = useState<TicketCategory | ''>('');
  const [assignedFilter, setAssignedFilter] = useState<string>('');
  
  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [limit] = useState(20);
  
  // Sorting
  const [sortBy, setSortBy] = useState<string>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  
  // Bulk selection
  const [selectedTickets, setSelectedTickets] = useState<Set<string>>(new Set());
  const [showBulkActions, setShowBulkActions] = useState(false);

  const fetchTickets = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const params: any = { page, limit, sortBy, sortOrder };
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      if (priorityFilter) params.priority = priorityFilter;
      if (categoryFilter) params.category = categoryFilter;
      if (assignedFilter) params.assignedTo = assignedFilter;
      
      const response = await getTickets(params);
      setTickets(response.tickets);
      setTotalPages(response.pagination.pages);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tickets');
    } finally {
      setLoading(false);
    }
  }, [page, limit, sortBy, sortOrder, search, statusFilter, priorityFilter, categoryFilter, assignedFilter]);

  const fetchStats = useCallback(async () => {
    try {
      const data = await getTicketStats();
      setStats(data);
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    }
  }, []);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  const handleSelectAll = () => {
    if (selectedTickets.size === tickets.length) {
      setSelectedTickets(new Set());
    } else {
      setSelectedTickets(new Set(tickets.map(t => t._id)));
    }
  };

  const handleSelectTicket = (ticketId: string) => {
    const newSelected = new Set(selectedTickets);
    if (newSelected.has(ticketId)) {
      newSelected.delete(ticketId);
    } else {
      newSelected.add(ticketId);
    }
    setSelectedTickets(newSelected);
  };

  const handleBulkAction = async (action: string, value?: any) => {
    if (selectedTickets.size === 0) return;
    
    try {
      await bulkTicketAction(Array.from(selectedTickets), action, value);
      setSelectedTickets(new Set());
      fetchTickets();
      fetchStats();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bulk action failed');
    }
  };

  const formatDate = (dateString: string) => {
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

  return (
    <div className="flex flex-col h-full bg-gray-900">
      {/* Stats Bar */}
      {stats && (
        <div className="flex items-center gap-4 p-4 border-b border-gray-700 bg-gray-800/50">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-blue-500"></div>
            <span className="text-sm text-gray-400">Open:</span>
            <span className="text-sm font-medium text-white">{stats.byStatus?.open || 0}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
            <span className="text-sm text-gray-400">In Progress:</span>
            <span className="text-sm font-medium text-white">{stats.byStatus?.in_progress || 0}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-orange-500"></div>
            <span className="text-sm text-gray-400">Unassigned:</span>
            <span className="text-sm font-medium text-white">{stats.unassigned || 0}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500"></div>
            <span className="text-sm text-gray-400">Resolved:</span>
            <span className="text-sm font-medium text-white">{stats.byStatus?.resolved || 0}</span>
          </div>
          <div className="ml-auto">
            <button
              onClick={() => { fetchTickets(); fetchStats(); }}
              className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="p-4 border-b border-gray-700 space-y-3">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search tickets..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        
        {/* Filter dropdowns */}
        <div className="flex flex-wrap gap-2">
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value as TicketStatus | ''); setPage(1); }}
            className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {STATUS_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          
          <select
            value={priorityFilter}
            onChange={(e) => { setPriorityFilter(e.target.value as TicketPriority | ''); setPage(1); }}
            className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {PRIORITY_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          
          <select
            value={categoryFilter}
            onChange={(e) => { setCategoryFilter(e.target.value as TicketCategory | ''); setPage(1); }}
            className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {CATEGORY_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          
          <select
            value={assignedFilter}
            onChange={(e) => { setAssignedFilter(e.target.value); setPage(1); }}
            className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Agents</option>
            <option value="unassigned">Unassigned</option>
            <option value="me">Assigned to Me</option>
          </select>
        </div>
      </div>

      {/* Bulk Actions */}
      {selectedTickets.size > 0 && (
        <div className="flex items-center gap-2 p-3 bg-blue-900/30 border-b border-blue-700">
          <span className="text-sm text-blue-300">{selectedTickets.size} selected</span>
          <div className="flex gap-2 ml-4">
            <button
              onClick={() => handleBulkAction('status', 'in_progress')}
              className="px-3 py-1 text-xs bg-yellow-600 hover:bg-yellow-700 text-white rounded transition-colors"
            >
              Mark In Progress
            </button>
            <button
              onClick={() => handleBulkAction('status', 'resolved')}
              className="px-3 py-1 text-xs bg-green-600 hover:bg-green-700 text-white rounded transition-colors"
            >
              Mark Resolved
            </button>
            <button
              onClick={() => handleBulkAction('status', 'closed')}
              className="px-3 py-1 text-xs bg-gray-600 hover:bg-gray-700 text-white rounded transition-colors"
            >
              Close
            </button>
          </div>
          <button
            onClick={() => setSelectedTickets(new Set())}
            className="ml-auto text-sm text-gray-400 hover:text-white"
          >
            Clear selection
          </button>
        </div>
      )}

      {/* Ticket List */}
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
              onClick={fetchTickets}
              className="mt-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
            >
              Retry
            </button>
          </div>
        ) : tickets.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-400">
            <CheckCircle className="w-12 h-12 mb-2" />
            <p>No tickets found</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-700">
            {/* Header */}
            <div className="flex items-center px-4 py-2 bg-gray-800/50 text-xs font-medium text-gray-400 uppercase tracking-wider">
              <div className="w-8">
                <input
                  type="checkbox"
                  checked={selectedTickets.size === tickets.length && tickets.length > 0}
                  onChange={handleSelectAll}
                  className="rounded border-gray-600 bg-gray-700 text-blue-600 focus:ring-blue-500"
                />
              </div>
              <div className="flex-1 min-w-0 flex items-center gap-2 cursor-pointer" onClick={() => handleSort('ticketNumber')}>
                Ticket
                {sortBy === 'ticketNumber' && (sortOrder === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
              </div>
              <div className="w-24 text-center">Status</div>
              <div className="w-20 text-center">Priority</div>
              <div className="w-32 flex items-center gap-1 cursor-pointer" onClick={() => handleSort('createdAt')}>
                Created
                {sortBy === 'createdAt' && (sortOrder === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
              </div>
              <div className="w-32">Assigned</div>
            </div>
            
            {/* Tickets */}
            {tickets.map((ticket) => (
              <div
                key={ticket._id}
                className={`flex items-center px-4 py-3 hover:bg-gray-800/50 cursor-pointer transition-colors ${
                  selectedTicketId === ticket._id ? 'bg-blue-900/20 border-l-2 border-blue-500' : ''
                }`}
                onClick={() => onSelectTicket(ticket._id)}
              >
                <div className="w-8" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={selectedTickets.has(ticket._id)}
                    onChange={() => handleSelectTicket(ticket._id)}
                    className="rounded border-gray-600 bg-gray-700 text-blue-600 focus:ring-blue-500"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 font-mono">{ticket.ticketNumber}</span>
                    <span className="text-xs">{getCategoryIcon(ticket.category)}</span>
                  </div>
                  <p className="text-sm text-white truncate">{ticket.subject}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <User className="w-3 h-3 text-gray-500" />
                    <span className="text-xs text-gray-400 truncate">{ticket.userName}</span>
                  </div>
                </div>
                <div className="w-24 text-center">
                  <span className={`inline-block px-2 py-0.5 text-xs rounded-full ${getStatusColor(ticket.status)}`}>
                    {ticket.status.replace('_', ' ')}
                  </span>
                </div>
                <div className="w-20 text-center">
                  <span className={`inline-block px-2 py-0.5 text-xs rounded-full ${getPriorityColor(ticket.priority)}`}>
                    {ticket.priority}
                  </span>
                </div>
                <div className="w-32 text-xs text-gray-400 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {formatDate(ticket.createdAt)}
                </div>
                <div className="w-32 text-xs text-gray-400 truncate">
                  {ticket.assignedToName || <span className="text-orange-400">Unassigned</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between p-4 border-t border-gray-700">
          <span className="text-sm text-gray-400">
            Page {page} of {totalPages}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1 bg-gray-800 border border-gray-700 rounded text-sm text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-700 transition-colors"
            >
              Previous
            </button>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1 bg-gray-800 border border-gray-700 rounded text-sm text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-700 transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TicketList;




