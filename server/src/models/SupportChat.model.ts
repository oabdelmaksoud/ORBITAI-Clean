import mongoose, { Schema, Document } from 'mongoose';

export type ChatStatus = 'queued' | 'active' | 'ai_active' | 'transferred' | 'ended';

export interface IChatMessage {
  id: string;
  sender: 'user' | 'agent' | 'ai' | 'system';
  senderId: string;
  senderName: string;
  content: string;
  attachments?: string[];
  isTyping?: boolean;
  createdAt: Date;
}

export interface IChatTransfer {
  id: string;
  fromAgentId: string;
  fromAgentName: string;
  toAgentId: string;
  toAgentName: string;
  reason?: string;
  transferredAt: Date;
}

export interface ISupportChat extends Document {
  chatId: string;
  userId: string;
  userName: string;
  userEmail: string;
  userPlan: string;
  agentId?: string;
  agentName?: string;
  status: ChatStatus;
  messages: IChatMessage[];
  transfers: IChatTransfer[];
  queuePosition?: number;
  queuedAt?: Date;
  startedAt?: Date;
  endedAt?: Date;
  endedBy?: 'user' | 'agent' | 'system';
  endReason?: string;
  rating?: number;
  feedback?: string;
  metadata: Record<string, any>;
  relatedTicketId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const chatMessageSchema = new Schema<IChatMessage>(
  {
    id: { type: String, required: true },
    sender: { type: String, enum: ['user', 'agent', 'ai', 'system'], required: true },
    senderId: { type: String, required: true },
    senderName: { type: String, required: true },
    content: { type: String, required: true },
    attachments: [{ type: String }],
    isTyping: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }
  },
  { _id: false }
);

const chatTransferSchema = new Schema<IChatTransfer>(
  {
    id: { type: String, required: true },
    fromAgentId: { type: String, required: true },
    fromAgentName: { type: String, required: true },
    toAgentId: { type: String, required: true },
    toAgentName: { type: String, required: true },
    reason: { type: String },
    transferredAt: { type: Date, default: Date.now }
  },
  { _id: false }
);

const supportChatSchema = new Schema<ISupportChat>(
  {
    chatId: {
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
      required: true
    },
    userPlan: {
      type: String,
      default: 'Free'
    },
    agentId: {
      type: String,
      index: true,
      sparse: true
    },
    agentName: {
      type: String
    },
    status: {
      type: String,
      enum: ['queued', 'active', 'ai_active', 'transferred', 'ended'],
      default: 'ai_active',
      index: true
    },
    messages: [chatMessageSchema],
    transfers: [chatTransferSchema],
    queuePosition: {
      type: Number
    },
    queuedAt: {
      type: Date
    },
    startedAt: {
      type: Date
    },
    endedAt: {
      type: Date
    },
    endedBy: {
      type: String,
      enum: ['user', 'agent', 'system']
    },
    endReason: {
      type: String
    },
    rating: {
      type: Number,
      min: 1,
      max: 5
    },
    feedback: {
      type: String
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {}
    },
    relatedTicketId: {
      type: String,
      index: true,
      sparse: true
    }
  },
  {
    timestamps: true
  }
);

// Compound indexes for efficient queries
supportChatSchema.index({ status: 1, queuedAt: 1 });
supportChatSchema.index({ agentId: 1, status: 1 });
supportChatSchema.index({ userId: 1, createdAt: -1 });

// Auto-generate chat ID before saving
supportChatSchema.pre('save', async function (next) {
  if (this.isNew && !this.chatId) {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    this.chatId = `CHAT-${timestamp}-${random}`.toUpperCase();
  }
  next();
});

export const SupportChat = mongoose.model<ISupportChat>('SupportChat', supportChatSchema);

// Response Templates Model
export interface IResponseTemplate extends Document {
  name: string;
  category: string;
  shortcut: string;
  content: string;
  variables: string[];
  isActive: boolean;
  usageCount: number;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const responseTemplateSchema = new Schema<IResponseTemplate>(
  {
    name: {
      type: String,
      required: true
    },
    category: {
      type: String,
      required: true,
      index: true
    },
    shortcut: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    content: {
      type: String,
      required: true
    },
    variables: [{
      type: String
    }],
    isActive: {
      type: Boolean,
      default: true,
      index: true
    },
    usageCount: {
      type: Number,
      default: 0
    },
    createdBy: {
      type: String,
      required: true
    }
  },
  {
    timestamps: true
  }
);

export const ResponseTemplate = mongoose.model<IResponseTemplate>('ResponseTemplate', responseTemplateSchema);

