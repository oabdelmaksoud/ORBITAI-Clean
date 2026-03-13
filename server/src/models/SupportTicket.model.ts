import mongoose, { Schema, Document } from 'mongoose';

export type TicketStatus = 'open' | 'in_progress' | 'waiting_on_customer' | 'resolved' | 'closed';
export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TicketCategory = 'billing' | 'technical' | 'account' | 'general';

export interface ITicketMessage {
  id: string;
  sender: 'user' | 'agent' | 'system';
  senderId: string;
  senderName: string;
  content: string;
  attachments?: string[];
  createdAt: Date;
}

export interface IInternalNote {
  id: string;
  agentId: string;
  agentName: string;
  content: string;
  createdAt: Date;
}

export interface ITicketHistoryEntry {
  id: string;
  action: string;
  performedBy: string;
  performedByName: string;
  details: string;
  previousValue?: string;
  newValue?: string;
  createdAt: Date;
}

export interface ISupportTicket extends Document {
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
  messages: ITicketMessage[];
  internalNotes: IInternalNote[];
  history: ITicketHistoryEntry[];
  tags: string[];
  metadata: Record<string, any>;
  firstResponseAt?: Date;
  resolvedAt?: Date;
  closedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ticketMessageSchema = new Schema<ITicketMessage>(
  {
    id: { type: String, required: true },
    sender: { type: String, enum: ['user', 'agent', 'system'], required: true },
    senderId: { type: String, required: true },
    senderName: { type: String, required: true },
    content: { type: String, required: true },
    attachments: [{ type: String }],
    createdAt: { type: Date, default: Date.now }
  },
  { _id: false }
);

const internalNoteSchema = new Schema<IInternalNote>(
  {
    id: { type: String, required: true },
    agentId: { type: String, required: true },
    agentName: { type: String, required: true },
    content: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
  },
  { _id: false }
);

const historyEntrySchema = new Schema<ITicketHistoryEntry>(
  {
    id: { type: String, required: true },
    action: { type: String, required: true },
    performedBy: { type: String, required: true },
    performedByName: { type: String, required: true },
    details: { type: String, required: true },
    previousValue: { type: String },
    newValue: { type: String },
    createdAt: { type: Date, default: Date.now }
  },
  { _id: false }
);

const supportTicketSchema = new Schema<ISupportTicket>(
  {
    ticketNumber: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    userId: {
      type: String,
      required: true,
      index: true
    },
    userName: {
      type: String,
      required: true
    },
    userEmail: {
      type: String,
      required: true,
      index: true
    },
    subject: {
      type: String,
      required: true
    },
    description: {
      type: String,
      required: true
    },
    status: {
      type: String,
      enum: ['open', 'in_progress', 'waiting_on_customer', 'resolved', 'closed'],
      default: 'open',
      index: true
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'urgent'],
      default: 'medium',
      index: true
    },
    category: {
      type: String,
      enum: ['billing', 'technical', 'account', 'general'],
      default: 'general',
      index: true
    },
    assignedTo: {
      type: String,
      index: true,
      sparse: true
    },
    assignedToName: {
      type: String
    },
    messages: [ticketMessageSchema],
    internalNotes: [internalNoteSchema],
    history: [historyEntrySchema],
    tags: [{ type: String }],
    metadata: {
      type: Schema.Types.Mixed,
      default: {}
    },
    firstResponseAt: {
      type: Date
    },
    resolvedAt: {
      type: Date
    },
    closedAt: {
      type: Date
    }
  },
  {
    timestamps: true
  }
);

// Compound indexes for efficient queries
supportTicketSchema.index({ status: 1, priority: -1, createdAt: -1 });
supportTicketSchema.index({ assignedTo: 1, status: 1 });
supportTicketSchema.index({ userId: 1, createdAt: -1 });
supportTicketSchema.index({ category: 1, status: 1 });

// Auto-generate ticket number before saving
supportTicketSchema.pre('save', async function (next) {
  if (this.isNew && !this.ticketNumber) {
    const count = await mongoose.model('SupportTicket').countDocuments();
    this.ticketNumber = `TKT-${String(count + 1).padStart(6, '0')}`;
  }
  next();
});

export const SupportTicket = mongoose.model<ISupportTicket>('SupportTicket', supportTicketSchema);




