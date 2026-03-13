/**
 * Support API Service
 * Frontend API client for support tickets and live chat
 */

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5001';

// ==================== TYPES ====================

export type TicketStatus = 'open' | 'in_progress' | 'waiting_on_customer' | 'resolved' | 'closed';
export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TicketCategory = 'billing' | 'technical' | 'account' | 'general';
export type ChatStatus = 'queued' | 'active' | 'transferred' | 'ended';

export interface TicketMessage {
  id: string;
  sender: 'user' | 'agent' | 'system';
  senderId: string;
  senderName: string;
  content: string;
  attachments?: string[];
  createdAt: string;
}

export interface InternalNote {
  id: string;
  agentId: string;
  agentName: string;
  content: string;
  createdAt: string;
}

export interface TicketHistoryEntry {
  id: string;
  action: string;
  performedBy: string;
  performedByName: string;
  details: string;
  previousValue?: string;
  newValue?: string;
  createdAt: string;
}

export interface SupportTicket {
  _id: string;
  ticketNumber: string;
  userId: string;
  userName: string;
  userEmail: string;
  subject: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  category: TicketCategory;
  assignedTo?: string;
  assignedToName?: string;
  messages: TicketMessage[];
  internalNotes: InternalNote[];
  history: TicketHistoryEntry[];
  tags: string[];
  metadata: Record<string, any>;
  firstResponseAt?: string;
  resolvedAt?: string;
  closedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'agent' | 'system';
  senderId: string;
  senderName: string;
  content: string;
  attachments?: string[];
  isTyping?: boolean;
  createdAt: string;
}

export interface ChatTransfer {
  id: string;
  fromAgentId: string;
  fromAgentName: string;
  toAgentId: string;
  toAgentName: string;
  reason?: string;
  transferredAt: string;
}

export interface SupportChat {
  _id: string;
  chatId: string;
  userId: string;
  userName: string;
  userEmail: string;
  userPlan: string;
  agentId?: string;
  agentName?: string;
  status: ChatStatus;
  messages: ChatMessage[];
  transfers: ChatTransfer[];
  queuePosition?: number;
  queuedAt?: string;
  startedAt?: string;
  endedAt?: string;
  endedBy?: 'user' | 'agent' | 'system';
  endReason?: string;
  rating?: number;
  feedback?: string;
  metadata: Record<string, any>;
  relatedTicketId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ResponseTemplate {
  _id: string;
  name: string;
  category: string;
  shortcut: string;
  content: string;
  variables: string[];
  isActive: boolean;
  usageCount: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface TicketStats {
  total: number;
  unassigned: number;
  byStatus: Record<string, number>;
  byPriority: Record<string, number>;
  byCategory: Record<string, number>;
  byAgent: { _id: string; assignedToName: string; count: number }[];
  recentTickets: SupportTicket[];
}

export interface ChatStats {
  queueCount: number;
  activeCount: number;
  todayChats: number;
  avgRating: number;
  avgWaitTime: number;
  agentStats: { _id: string; agentName: string; totalChats: number; activeChats: number }[];
}

export interface ChatQueueItem {
  chatId: string;
  userId: string;
  userName: string;
  userEmail: string;
  userPlan: string;
  queuePosition: number;
  waitTime: number;
  queuedAt: string;
}

export interface SupportAgent {
  _id: string;
  name: string;
  email: string;
  role: string;
  lastLogin?: string;
  activeChats: number;
}

export interface UserContext {
  user: {
    _id: string;
    name: string;
    email: string;
    plan: string;
    role: string;
    createdAt: string;
    lastLogin?: string;
  };
  recentTickets: SupportTicket[];
  recentChats?: SupportChat[];
}

// ==================== API HELPERS ====================

function getToken(): string {
  return localStorage.getItem('admin_token') || localStorage.getItem('token') || '';
}

async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...options.headers,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || data.error || 'API request failed');
  }

  return data;
}

// ==================== TICKET API ====================

export async function getTickets(params: {
  status?: TicketStatus;
  priority?: TicketPriority;
  category?: TicketCategory;
  assignedTo?: string;
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
} = {}): Promise<{ tickets: SupportTicket[]; pagination: any; stats: any }> {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined) searchParams.append(key, String(value));
  });
  
  const response = await apiRequest<{ success: boolean; data: any }>(
    `/api/support/admin/tickets?${searchParams.toString()}`
  );
  return response.data;
}

export async function getTicketStats(): Promise<TicketStats> {
  const response = await apiRequest<{ success: boolean; data: TicketStats }>(
    '/api/support/admin/tickets/stats'
  );
  return response.data;
}

export async function getTicketDetails(ticketId: string): Promise<{ ticket: SupportTicket; userContext: UserContext }> {
  const response = await apiRequest<{ success: boolean; data: any }>(
    `/api/support/admin/tickets/${ticketId}`
  );
  return response.data;
}

export async function updateTicket(ticketId: string, updates: {
  status?: TicketStatus;
  priority?: TicketPriority;
  category?: TicketCategory;
  assignedTo?: string | null;
  tags?: string[];
}): Promise<SupportTicket> {
  const response = await apiRequest<{ success: boolean; data: { ticket: SupportTicket } }>(
    `/api/support/admin/tickets/${ticketId}`,
    {
      method: 'PUT',
      body: JSON.stringify(updates),
    }
  );
  return response.data.ticket;
}

export async function addTicketMessage(ticketId: string, content: string, attachments?: string[]): Promise<SupportTicket> {
  const response = await apiRequest<{ success: boolean; data: { ticket: SupportTicket } }>(
    `/api/support/admin/tickets/${ticketId}/messages`,
    {
      method: 'POST',
      body: JSON.stringify({ content, attachments }),
    }
  );
  return response.data.ticket;
}

export async function addInternalNote(ticketId: string, content: string): Promise<SupportTicket> {
  const response = await apiRequest<{ success: boolean; data: { ticket: SupportTicket } }>(
    `/api/support/admin/tickets/${ticketId}/notes`,
    {
      method: 'POST',
      body: JSON.stringify({ content }),
    }
  );
  return response.data.ticket;
}

export async function bulkTicketAction(ticketIds: string[], action: string, value?: any): Promise<{ modifiedCount: number }> {
  const response = await apiRequest<{ success: boolean; data: { modifiedCount: number } }>(
    '/api/support/admin/tickets/bulk',
    {
      method: 'POST',
      body: JSON.stringify({ ticketIds, action, value }),
    }
  );
  return response.data;
}

// ==================== CHAT API ====================

export async function getChatQueue(): Promise<ChatQueueItem[]> {
  const response = await apiRequest<{ success: boolean; data: { queue: ChatQueueItem[] } }>(
    '/api/support/admin/chat/queue'
  );
  return response.data.queue;
}

export async function getActiveChats(agentId?: string): Promise<SupportChat[]> {
  const params = agentId ? `?agentId=${agentId}` : '';
  const response = await apiRequest<{ success: boolean; data: { chats: SupportChat[] } }>(
    `/api/support/admin/chat/active${params}`
  );
  return response.data.chats;
}

export async function getChatStats(): Promise<ChatStats> {
  const response = await apiRequest<{ success: boolean; data: ChatStats }>(
    '/api/support/admin/chat/stats'
  );
  return response.data;
}

export async function getChatDetails(chatId: string): Promise<{ chat: SupportChat; userContext: UserContext }> {
  const response = await apiRequest<{ success: boolean; data: any }>(
    `/api/support/admin/chat/${chatId}`
  );
  return response.data;
}

export async function acceptChat(chatId: string): Promise<SupportChat> {
  const response = await apiRequest<{ success: boolean; data: { chat: SupportChat } }>(
    `/api/support/admin/chat/${chatId}/accept`,
    { method: 'POST' }
  );
  return response.data.chat;
}

export async function sendChatMessage(chatId: string, content: string, attachments?: string[]): Promise<ChatMessage> {
  const response = await apiRequest<{ success: boolean; data: { message: ChatMessage } }>(
    `/api/support/admin/chat/${chatId}/message`,
    {
      method: 'POST',
      body: JSON.stringify({ content, attachments }),
    }
  );
  return response.data.message;
}

export async function transferChat(chatId: string, toAgentId: string, reason?: string): Promise<SupportChat> {
  const response = await apiRequest<{ success: boolean; data: { chat: SupportChat } }>(
    `/api/support/admin/chat/${chatId}/transfer`,
    {
      method: 'POST',
      body: JSON.stringify({ toAgentId, reason }),
    }
  );
  return response.data.chat;
}

export async function endChat(chatId: string, reason?: string): Promise<SupportChat> {
  const response = await apiRequest<{ success: boolean; data: { chat: SupportChat } }>(
    `/api/support/admin/chat/${chatId}/end`,
    {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }
  );
  return response.data.chat;
}

export async function createTicketFromChat(chatId: string, data: {
  subject?: string;
  category?: TicketCategory;
  priority?: TicketPriority;
}): Promise<SupportTicket> {
  const response = await apiRequest<{ success: boolean; data: { ticket: SupportTicket } }>(
    `/api/support/admin/chat/${chatId}/create-ticket`,
    {
      method: 'POST',
      body: JSON.stringify(data),
    }
  );
  return response.data.ticket;
}

export async function getChatHistory(params: {
  agentId?: string;
  userId?: string;
  status?: ChatStatus;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
} = {}): Promise<{ chats: SupportChat[]; pagination: any }> {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined) searchParams.append(key, String(value));
  });
  
  const response = await apiRequest<{ success: boolean; data: any }>(
    `/api/support/admin/chat/history?${searchParams.toString()}`
  );
  return response.data;
}

export async function getSupportAgents(): Promise<SupportAgent[]> {
  const response = await apiRequest<{ success: boolean; data: { agents: SupportAgent[] } }>(
    '/api/support/admin/agents'
  );
  return response.data.agents;
}

// ==================== TEMPLATE API ====================

export async function getResponseTemplates(params: {
  category?: string;
  search?: string;
} = {}): Promise<ResponseTemplate[]> {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined) searchParams.append(key, String(value));
  });
  
  const response = await apiRequest<{ success: boolean; data: { templates: ResponseTemplate[] } }>(
    `/api/support/admin/templates?${searchParams.toString()}`
  );
  return response.data.templates;
}

export async function createTemplate(template: {
  name: string;
  category: string;
  shortcut: string;
  content: string;
  variables?: string[];
}): Promise<ResponseTemplate> {
  const response = await apiRequest<{ success: boolean; data: { template: ResponseTemplate } }>(
    '/api/support/admin/templates',
    {
      method: 'POST',
      body: JSON.stringify(template),
    }
  );
  return response.data.template;
}

export async function updateTemplate(templateId: string, updates: Partial<{
  name: string;
  category: string;
  shortcut: string;
  content: string;
  variables: string[];
}>): Promise<ResponseTemplate> {
  const response = await apiRequest<{ success: boolean; data: { template: ResponseTemplate } }>(
    `/api/support/admin/templates/${templateId}`,
    {
      method: 'PUT',
      body: JSON.stringify(updates),
    }
  );
  return response.data.template;
}

export async function deleteTemplate(templateId: string): Promise<void> {
  await apiRequest<{ success: boolean }>(
    `/api/support/admin/templates/${templateId}`,
    { method: 'DELETE' }
  );
}

export async function trackTemplateUsage(templateId: string): Promise<void> {
  await apiRequest<{ success: boolean }>(
    `/api/support/admin/templates/${templateId}/use`,
    { method: 'POST' }
  );
}

// ==================== UTILITY FUNCTIONS ====================

export function getStatusColor(status: TicketStatus | ChatStatus): string {
  const colors: Record<string, string> = {
    open: 'bg-blue-100 text-blue-800',
    in_progress: 'bg-yellow-100 text-yellow-800',
    waiting_on_customer: 'bg-purple-100 text-purple-800',
    resolved: 'bg-green-100 text-green-800',
    closed: 'bg-gray-100 text-gray-800',
    queued: 'bg-orange-100 text-orange-800',
    active: 'bg-green-100 text-green-800',
    transferred: 'bg-blue-100 text-blue-800',
    ended: 'bg-gray-100 text-gray-800',
  };
  return colors[status] || 'bg-gray-100 text-gray-800';
}

export function getPriorityColor(priority: TicketPriority): string {
  const colors: Record<TicketPriority, string> = {
    low: 'bg-gray-100 text-gray-800',
    medium: 'bg-blue-100 text-blue-800',
    high: 'bg-orange-100 text-orange-800',
    urgent: 'bg-red-100 text-red-800',
  };
  return colors[priority];
}

export function getCategoryIcon(category: TicketCategory): string {
  const icons: Record<TicketCategory, string> = {
    billing: '💳',
    technical: '🔧',
    account: '👤',
    general: '📋',
  };
  return icons[category];
}

export function formatWaitTime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}




