import mongoose, { Schema, Document } from 'mongoose';

export interface IMCPServer extends Document {
  id: string;
  name: string;
  description: string;
  status: 'active' | 'inactive';
  source: 'system' | 'user' | 'agent'; // system = default, user = created by user, agent = created by agent
  tools: string[]; // List of tool names provided by this server
  config: {
    type: 'e2b' | 'http' | 'stdio' | 'websocket' | 'custom';
    endpoint?: string; // For HTTP/WebSocket
    command?: string; // For stdio
    args?: string[]; // For stdio
    headers?: Record<string, string>; // For HTTP
    apiKey?: string; // Encrypted API key if needed
  };
  metadata?: {
    createdBy?: string; // User ID or agent role
    createdFor?: string; // Project ID or task ID
    tags?: string[];
    notes?: string;
  };
  createdAt: Date;
  updatedAt: Date;
  lastUsed?: Date;
}

const mcpServerSchema = new Schema<IMCPServer>(
  {
    id: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      default: ''
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
      index: true
    },
    source: {
      type: String,
      enum: ['system', 'user', 'agent'],
      default: 'user',
      index: true
    },
    tools: {
      type: [String],
      default: []
    },
    config: {
      type: {
        type: String,
        enum: ['e2b', 'http', 'stdio', 'websocket', 'custom'],
        required: true
      },
      endpoint: String,
      command: String,
      args: [String],
      headers: Schema.Types.Mixed,
      apiKey: String // Should be encrypted in production
    },
    metadata: {
      createdBy: String,
      createdFor: String,
      tags: [String],
      notes: String
    },
    lastUsed: Date
  },
  {
    timestamps: true,
    collection: 'mcpservers'
  }
);

// Indexes for efficient queries
mcpServerSchema.index({ source: 1, status: 1 });
mcpServerSchema.index({ 'metadata.createdBy': 1 });
mcpServerSchema.index({ 'metadata.createdFor': 1 });
mcpServerSchema.index({ createdAt: -1 });

export const MCPServer = mongoose.model<IMCPServer>('MCPServer', mcpServerSchema);
















